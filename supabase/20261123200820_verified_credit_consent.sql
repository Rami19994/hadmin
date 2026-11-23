begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function public.credit_phone(p_phone text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select '+' || regexp_replace(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '^00', '');
$$;
create or replace function public.credit_eligible(p_user uuid)
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_user and p.trust = 'identified' and not p.is_suspended
      and not coalesce(u.is_anonymous, false)
      and public.credit_phone(p.phone) ~ '^\+[1-9][0-9]{9,14}$'
      and p.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
$$;
revoke all on function public.credit_eligible(uuid) from public, anon;
grant execute on function public.credit_eligible(uuid) to authenticated;

alter table public.credit_accounts
  add column if not exists consent_confirmed_at timestamptz,
  add column if not exists consent_phone text,
  add column if not exists consent_email text;

create table public.credit_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  consumer_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  phone text not null,
  email text not null,
  status text not null default 'pending' check (status in ('pending','sent','confirmed','failed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  confirmed_at timestamptz
);
alter table public.credit_invitations enable row level security;
create index credit_invitations_store_created_idx on public.credit_invitations(store_id, created_at desc);
create index credit_invitations_consumer_created_idx on public.credit_invitations(consumer_id, created_at desc);
create policy "credit invitations: participants read" on public.credit_invitations
  for select to authenticated using (consumer_id = (select auth.uid())
    or public.is_store_owner(store_id) or public.is_admin());
revoke insert, update, delete on public.credit_invitations from anon, authenticated;
grant select on public.credit_invitations to authenticated;

create table private.credit_invitation_secrets (
  invitation_id uuid primary key references public.credit_invitations(id) on delete cascade,
  code_hash text not null check (length(code_hash) = 64),
  attempts integer not null default 0
);
alter table private.credit_invitation_secrets enable row level security;

create or replace function public.request_credit_invitation(p_store_id uuid, p_phone text, p_email text)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare buyer public.profiles; shop public.stores; invitation public.credit_invitations;
begin
  if auth.uid() is null or (not public.is_store_owner(p_store_id) and not public.is_admin()) then
    raise exception 'هذه العملية متاحة لصاحب المتجر والإدارة فقط';
  end if;
  select * into shop from public.stores where id = p_store_id and status = 'approved';
  if shop.id is null then raise exception 'المتجر غير متاح'; end if;
  if public.credit_phone(p_phone) !~ '^\+[1-9][0-9]{9,14}$' or p_email is null
     or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'أدخل رقم الهاتف مع مفتاح الدولة والبريد الإلكتروني، كلاهما إلزامي';
  end if;
  select * into buyer from public.profiles p where public.credit_eligible(p.id)
    and public.credit_phone(p.phone) = public.credit_phone(p_phone)
    and lower(trim(p.email)) = lower(trim(p_email));
  if buyer.id is null then raise exception 'لا يوجد حساب موثق من الإدارة يطابق الهاتف والبريد'; end if;
  perform pg_advisory_xact_lock(hashtextextended(buyer.id::text, 0));
  if exists(select 1 from public.credit_invitations where consumer_id = buyer.id
    and created_at > now() - interval '1 minute') then
    raise exception 'انتظر دقيقة قبل طلب رسالة أخرى';
  end if;
  if (select count(*) from public.credit_invitations where consumer_id = buyer.id
    and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'وصلت طلبات تأكيد الهاتف إلى الحد المسموح، حاول لاحقاً';
  end if;
  insert into public.credit_invitations(store_id, consumer_id, requested_by, phone, email)
    values (shop.id, buyer.id, auth.uid(), public.credit_phone(buyer.phone), lower(trim(buyer.email)))
    returning * into invitation;
  return to_jsonb(invitation) || jsonb_build_object('store_name', shop.name);
end;
$$;
revoke all on function public.request_credit_invitation(uuid, text, text) from public, anon;
grant execute on function public.request_credit_invitation(uuid, text, text) to authenticated;

-- Only the SMS server may write or check codes. Clients cannot read the hash.
create or replace function public.prepare_credit_sms(p_id uuid, p_hash text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not exists(select 1 from public.credit_invitations where id = p_id and status = 'pending'
    and expires_at > now()) then raise exception 'طلب التأكيد غير متاح'; end if;
  insert into private.credit_invitation_secrets(invitation_id, code_hash) values(p_id, p_hash);
end;
$$;
create or replace function public.finish_credit_sms(p_id uuid, p_sent boolean)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.credit_invitations set status = case when p_sent then 'sent' else 'failed' end
    where id = p_id and status = 'pending';
$$;
create or replace function public.credit_consent_details(p_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('store_name', s.name, 'phone', '••••' || right(i.phone, 4),
    'status', i.status, 'expires_at', i.expires_at)
    from public.credit_invitations i join public.stores s on s.id = i.store_id where i.id = p_id;
$$;
create or replace function public.confirm_credit_consent(p_id uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare invitation public.credit_invitations; secret private.credit_invitation_secrets;
  buyer public.profiles; account_id uuid;
begin
  select * into invitation from public.credit_invitations where id = p_id for update;
  if invitation.id is null then return jsonb_build_object('ok', false, 'error', 'طلب التأكيد غير موجود'); end if;
  if invitation.status = 'confirmed' then return jsonb_build_object('ok', true); end if;
  if invitation.status <> 'sent' then return jsonb_build_object('ok', false, 'error', 'رسالة التأكيد غير متاحة'); end if;
  if invitation.expires_at <= now() then
    update public.credit_invitations set status = 'expired' where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'انتهت صلاحية الرمز، اطلب رسالة جديدة');
  end if;
  select * into secret from private.credit_invitation_secrets where invitation_id = p_id for update;
  if secret.invitation_id is null then return jsonb_build_object('ok', false, 'error', 'الرمز غير متاح'); end if;
  if secret.attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'انتهى عدد المحاولات المسموح'); end if;
  if secret.code_hash is distinct from p_hash then
    update private.credit_invitation_secrets set attempts = attempts + 1 where invitation_id = p_id;
    if secret.attempts >= 4 then update public.credit_invitations set status = 'failed' where id = p_id; end if;
    return jsonb_build_object('ok', false, 'error', 'رمز التأكيد غير صحيح');
  end if;
  select * into buyer from public.profiles where id = invitation.consumer_id for update;
  if not public.credit_eligible(buyer.id) or public.credit_phone(buyer.phone) <> invitation.phone
    or lower(trim(buyer.email)) <> invitation.email then
    update public.credit_invitations set status = 'failed' where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'بيانات الحساب تحتاج مراجعة الإدارة مجدداً');
  end if;
  update public.credit_invitations set status = 'confirmed', confirmed_at = now() where id = p_id;
  insert into public.credit_accounts(store_id, consumer_id, customer_name, customer_phone,
    status, identity_verified, consent_confirmed_at, consent_phone, consent_email)
  values(invitation.store_id, buyer.id,
    coalesce(nullif(trim(concat_ws(' ', buyer.first_name_ar, buyer.last_name_ar)), ''),
      nullif(trim(concat_ws(' ', buyer.first_name_en, buyer.last_name_en)), ''), 'مستهلك'),
    invitation.phone, 'approved', true, now(), invitation.phone, invitation.email)
  on conflict(store_id, consumer_id) do update set status = 'approved', identity_verified = true,
    customer_name = excluded.customer_name, customer_phone = excluded.customer_phone,
    consent_confirmed_at = excluded.consent_confirmed_at, consent_phone = excluded.consent_phone,
    consent_email = excluded.consent_email returning id into account_id;
  return jsonb_build_object('ok', true, 'account_id', account_id);
end;
$$;
revoke all on function public.prepare_credit_sms(uuid, text) from public, anon, authenticated;
revoke all on function public.finish_credit_sms(uuid, boolean) from public, anon, authenticated;
revoke all on function public.credit_consent_details(uuid) from public, anon, authenticated;
revoke all on function public.confirm_credit_consent(uuid, text) from public, anon, authenticated;
grant execute on function public.prepare_credit_sms(uuid, text), public.finish_credit_sms(uuid, boolean),
  public.credit_consent_details(uuid), public.confirm_credit_consent(uuid, text) to service_role;

create or replace function public.guard_credit_account()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if tg_op = 'UPDATE' then
    new.store_id := old.store_id; new.consumer_id := old.consumer_id;
  end if;
  if not public.credit_eligible(new.consumer_id) then raise exception 'خدمة على الحساب متاحة للحسابات الموثقة من الإدارة فقط'; end if;
  if tg_op = 'INSERT' then
    new.balance := 0; new.identity_verified := true;
    new.consent_confirmed_at := null; new.consent_phone := null; new.consent_email := null;
  else
    new.store_id := old.store_id; new.consumer_id := old.consumer_id; new.balance := old.balance;
    new.identity_verified := true;
    new.consent_confirmed_at := old.consent_confirmed_at;
    new.consent_phone := old.consent_phone; new.consent_email := old.consent_email;
  end if;
  if new.status = 'approved' and new.consent_confirmed_at is null then
    raise exception 'يلزم تأكيد المستهلك عبر رسالة الهاتف قبل فتح الدفتر';
  end if;
  if new.status = 'approved' and not exists(select 1 from public.profiles p where p.id = new.consumer_id
    and public.credit_phone(p.phone) = new.consent_phone and lower(trim(p.email)) = new.consent_email) then
    raise exception 'تغيّرت بيانات التواصل، يلزم تأكيد الهاتف مجدداً';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_credit_account() from public;

-- Existing financial history is preserved, but an unconsented book is not active.
update public.credit_accounts set status = 'pending', identity_verified = false
  where consent_confirmed_at is null and status = 'approved';

create or replace function private.require_credit_consent()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare account public.credit_accounts;
begin
  if tg_table_name = 'credit_entries' then
    select * into account from public.credit_accounts where id = new.account_id;
  else
    if new.payment_method <> 'account' or new.status in ('cancelled','rejected','delivered') then return new; end if;
    select * into account from public.credit_accounts where store_id = new.store_id and consumer_id = new.consumer_id;
  end if;
  if account.id is null or account.status <> 'approved' or account.consent_confirmed_at is null
    or not public.credit_eligible(account.consumer_id) then
    raise exception 'يلزم حساب موثق وموافقة هاتف مؤكدة لاستخدام خدمة على الحساب';
  end if;
  if tg_table_name = 'credit_entries' and new.kind in ('purchase','transferOut','debitAdjustment')
    and account.balance < -account.credit_limit then raise exception 'المبلغ يتجاوز الرصيد والسقف المتاح'; end if;
  return new;
end;
$$;
revoke all on function private.require_credit_consent() from public, anon, authenticated;
create trigger credit_entries_consent before insert on public.credit_entries
  for each row execute function private.require_credit_consent();
create trigger orders_require_credit_consent before insert or update on public.orders
  for each row execute function private.require_credit_consent();

create or replace function private.invalidate_credit_identity()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() and (
    new.phone is distinct from old.phone or new.email is distinct from old.email
    or new.id_photo_url is distinct from old.id_photo_url
    or new.first_name_ar is distinct from old.first_name_ar or new.last_name_ar is distinct from old.last_name_ar
    or new.first_name_en is distinct from old.first_name_en or new.last_name_en is distinct from old.last_name_en
  ) then new.trust := 'basic'; end if;
  return new;
end;
$$;
revoke all on function private.invalidate_credit_identity() from public, anon, authenticated;
create trigger profiles_recheck_identity before update on public.profiles
  for each row execute function private.invalidate_credit_identity();
create or replace function private.sync_credit_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.credit_accounts set identity_verified = public.credit_eligible(new.id),
    status = case when not public.credit_eligible(new.id)
      or (consent_confirmed_at is not null and (consent_phone is distinct from public.credit_phone(new.phone)
        or consent_email is distinct from lower(trim(new.email)))) then 'suspended' else status end
    where consumer_id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_credit_identity() from public, anon, authenticated;
create trigger profiles_sync_credit_identity after update of trust, phone, email, is_suspended on public.profiles
  for each row execute function private.sync_credit_identity();
notify pgrst, 'reload schema';
commit;
