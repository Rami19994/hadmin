-- =====================================================================
-- 0013 — لوحة تحكم الإدارة الكاملة (Admin Full Control)
--
-- يوفّر هذا الترحيل صلاحيات التحكم الشامل (قراءة، إضافة، تعديل، حذف)
-- لحسابات المشرفين (`profiles.role = 'admin'`) عبر دالة `public.is_admin()`
-- على جميع جداول المنصة ودلو التخزين `catalog`، مع الحفاظ التام على قيود
-- الحماية للمتاجر والمستهلكين العاديين.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. توسيع الجداول بالأعمدة الإدارية والتشغيلية الناقصة (بشكل آمن Idempotent)
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists photo_url    text,
  add column if not exists id_photo_url text,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists admin_note   text;

alter table public.stores
  add column if not exists email            text,
  add column if not exists phones           jsonb not null default '[]'::jsonb,
  add column if not exists licence_type     text,
  add column if not exists licence_number   text,
  add column if not exists licence_url      text,
  add column if not exists working_hours    jsonb,
  add column if not exists delivery_options jsonb,
  add column if not exists bank_account     text,
  add column if not exists admin_note       text;

alter table public.app_settings
  add column if not exists app_version_name     text not null default '1.0.0',
  add column if not exists app_build_number     integer not null default 1,
  add column if not exists force_update         boolean not null default false,
  add column if not exists update_url           text,
  add column if not exists android_url          text,
  add column if not exists ios_url              text,
  add column if not exists support_phone        text,
  add column if not exists support_whatsapp     text,
  add column if not exists support_email        text,
  add column if not exists website_url          text,
  add column if not exists billing_instructions text,
  add column if not exists maintenance_mode     boolean not null default false,
  add column if not exists announcement_banner  text;

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. جدول إعلانات الصفحة الرئيسية (Homepage Adverts)
-- ---------------------------------------------------------------------

create table if not exists public.adverts (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid references public.stores(id) on delete set null,
  store_name   text not null default '',
  headline     text not null,
  subline      text not null default '',
  image_url    text,
  image_key    text,
  country_code text,
  provinces    text[] not null default '{}',
  accent_color text not null default '#16A34A',
  price_paid   numeric(10,2) not null default 0,
  currency     text not null default 'USD',
  position     integer not null default 0,
  active       boolean not null default true,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz not null default (now() + interval '30 days'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.adverts enable row level security;

create index if not exists adverts_active_window_idx
  on public.adverts (active, starts_at, ends_at);
create index if not exists adverts_store_id_idx
  on public.adverts (store_id);

drop trigger if exists adverts_touch on public.adverts;
create trigger adverts_touch
  before update on public.adverts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. تعديل مفاتيح الربط في جدول الطلبات للسماح بالحذف النظيف من الإدارة
-- ---------------------------------------------------------------------

alter table public.orders
  drop constraint if exists orders_store_id_fkey,
  add constraint orders_store_id_fkey
    foreign key (store_id) references public.stores(id) on delete cascade;

alter table public.orders
  drop constraint if exists orders_consumer_id_fkey,
  add constraint orders_consumer_id_fkey
    foreign key (consumer_id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 4. تثبيت دالة التحقق من المشرف `is_admin()` ودالة تفعيل أول مشرف حقيقي
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.is_suspended, false) = false
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- تتيح لصاحب المشروع ترقية حسابه المسجّل بالبريد إلى `admin` مرة واحدة فقط
-- في حال لم يكن هناك أي مشرف غير ضيف (حساب حقيقي) في قاعدة البيانات بعد.
create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_anon boolean;
  v_has_real_admin boolean;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  select coalesce(u.is_anonymous, false)
    into v_is_anon
    from auth.users u
   where u.id = v_uid;

  if coalesce(v_is_anon, true) then
    raise exception 'لا يمكن لحساب ضيف أن يصبح مشرفاً — سجّل الدخول بالبريد وكلمة المرور';
  end if;

  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'admin'
      and coalesce(u.is_anonymous, false) = false
  ) into v_has_real_admin;

  if v_has_real_admin then
    raise exception 'يوجد مشرف مفعّل مسبقاً في النظام';
  end if;

  -- إزالة صلاحية admin عن أي جلسات ضيف قديمة أخذتها بالخطأ عند أول تشغيل
  update public.profiles p
     set role = 'consumer'
    from auth.users u
   where p.id = u.id
     and p.role = 'admin'
     and coalesce(u.is_anonymous, false) = true;

  update public.profiles
     set role = 'admin',
         trust = 'identified'
   where id = v_uid;

  return true;
end;
$$;

revoke execute on function public.claim_first_admin() from public;
grant  execute on function public.claim_first_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 5. تحديث دوال الحراسة (Guard Triggers) لتسمح للمشرف بالتحكم الكامل
-- ---------------------------------------------------------------------

create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  new.role         := old.role;
  new.trust        := old.trust;
  new.is_suspended := old.is_suspended;
  new.admin_note   := old.admin_note;
  new.id           := old.id;
  return new;
end;
$$;

revoke execute on function public.guard_profile_columns() from public;

create or replace function public.guard_store_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  auto boolean;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    if tg_op = 'INSERT' and new.owner_id is null then
      new.owner_id := auth.uid();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.subscription_expires_at := null;
    select auto_approve_stores into auto from public.app_settings limit 1;
    new.status := case when coalesce(auto, false) then 'approved' else 'pending' end;
  else
    new.owner_id := old.owner_id;
    new.subscription_expires_at := old.subscription_expires_at;
    new.admin_note := old.admin_note;
    if new.status is distinct from old.status then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_store_columns() from public;

create or replace function public.guard_daily_offer()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.published_at   := now();
    new.expires_at     := now() + interval '24 hours';
    new.extended_count := 0;
  else
    new.published_at   := old.published_at;
    new.expires_at     := old.expires_at;
    new.extended_count := old.extended_count;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_daily_offer() from public;

create or replace function public.guard_promotion_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.sold_count := 0;
  else
    new.sold_count := old.sold_count;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_promotion_columns() from public;

create or replace function public.reprice_order_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  shelf public.products;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.product_id is not null then
    select * into shelf from public.products where id = new.product_id;
    if shelf.id is not null then
      new.unit_price := shelf.price;
      new.name := shelf.name;
      if new.unit is distinct from shelf.unit
         and not exists (
           select 1 from jsonb_array_elements(shelf.extra_units) u
           where u->>'unit' = new.unit
         ) then
        new.unit := shelf.unit;
      elsif new.unit is distinct from shelf.unit then
        select (u->>'price')::numeric into new.unit_price
          from jsonb_array_elements(shelf.extra_units) u
         where u->>'unit' = new.unit
         limit 1;
      end if;
    end if;
  end if;
  new.unavailable := false;
  return new;
end;
$$;

revoke execute on function public.reprice_order_item() from public;

create or replace function public.guard_order_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prof record;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    if tg_op = 'INSERT' and (new.currency is null or new.currency = '') then
      select s.vat_percent * (case when s.vat_enabled then 1 else 0 end),
             s.currency
        into new.vat_percent, new.currency
        from public.stores s where s.id = new.store_id;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.consumer_id := auth.uid();
    new.status := 'pending';
    new.approved_at := null;
    new.delivered_at := null;
    new.opened := false;

    select s.vat_percent * (case when s.vat_enabled then 1 else 0 end),
           s.currency
      into new.vat_percent, new.currency
      from public.stores s where s.id = new.store_id;

    if (new.customer_name is null or trim(new.customer_name) = '') or
       (new.customer_phone is null or trim(new.customer_phone) = '') then
      select first_name_ar, last_name_ar, first_name_en, last_name_en, phone
        into prof
        from public.profiles
       where id = auth.uid();

      if new.customer_name is null or trim(new.customer_name) = '' then
        new.customer_name := nullif(trim(concat_ws(' ', nullif(trim(prof.first_name_ar), ''), nullif(trim(prof.last_name_ar), ''))), '');
        if new.customer_name is null or trim(new.customer_name) = '' then
          new.customer_name := nullif(trim(concat_ws(' ', nullif(trim(prof.first_name_en), ''), nullif(trim(prof.last_name_en), ''))), '');
        end if;
      end if;

      if new.customer_phone is null or trim(new.customer_phone) = '' then
        new.customer_phone := prof.phone;
      end if;
    end if;

    if new.customer_name is null or trim(new.customer_name) = '' then
      new.customer_name := 'زبون';
    end if;

  else
    new.consumer_id := old.consumer_id;
    new.store_id := old.store_id;
    new.created_at := old.created_at;
    new.currency := old.currency;
    new.vat_percent := old.vat_percent;
    new.customer_name := coalesce(new.customer_name, old.customer_name);
    new.customer_phone := coalesce(new.customer_phone, old.customer_phone);

    if new.status is distinct from old.status then
      if public.is_store_owner(new.store_id) then
        if new.status = 'approved' and old.approved_at is null then
          new.approved_at := now();
        end if;
        if new.status = 'delivered' then
          new.delivered_at := now();
        end if;
        if new.status = 'edited' then
          new.approved_at := null;
        end if;
      elsif new.consumer_id = auth.uid() then
        if (old.status in ('pending', 'edited') and new.status = 'cancelled') then
          -- مسموح
        elsif (old.status in ('edited', 'approved', 'preparing', 'pending') and new.status = 'pending') then
          new.approved_at := null;
        else
          raise exception 'only the shop may move this order';
        end if;
      else
        raise exception 'not your order';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_order_columns() from public;

create or replace function public.guard_credit_account()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.balance := old.balance;
    new.store_id := old.store_id;
    new.consumer_id := old.consumer_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_credit_account() from public;

-- ---------------------------------------------------------------------
-- 6. الدوال الإجرائية للإدارة (العروض اليومية، دفتر على الحساب، المستخدمين)
-- ---------------------------------------------------------------------

create or replace function public.extend_daily_offer(offer uuid)
returns public.daily_offers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row public.daily_offers;
begin
  select * into row from public.daily_offers where id = offer;
  if row.id is null then
    raise exception 'offer not found';
  end if;
  if not public.is_store_owner(row.store_id) and not public.is_admin() then
    raise exception 'not your offer';
  end if;
  update public.daily_offers
     set expires_at = greatest(expires_at, now()) + interval '24 hours',
         extended_count = extended_count + 1
   where id = offer
   returning * into row;
  return row;
end;
$$;

revoke execute on function public.extend_daily_offer(uuid) from public;
grant  execute on function public.extend_daily_offer(uuid) to authenticated;

create or replace function public.post_credit_entry(
  account      uuid,
  entry_kind   text,
  entry_amount numeric,
  entry_note   text default null,
  entry_note_en text default null,
  entry_order  uuid default null
)
returns public.credit_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acc public.credit_accounts;
  credits boolean;
  moved numeric;
  row public.credit_entries;
begin
  if entry_amount is null or entry_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select * into acc from public.credit_accounts where id = account for update;
  if acc.id is null then
    raise exception 'account not found';
  end if;

  if not public.is_store_owner(acc.store_id) and not public.is_admin() then
    raise exception 'only the shop or admin may post to this book';
  end if;

  credits := entry_kind in ('topUp', 'settlement', 'transferIn', 'creditAdjustment');
  moved := case when credits then entry_amount else -entry_amount end;

  update public.credit_accounts
     set balance = balance + moved
   where id = account
   returning * into acc;

  insert into public.credit_entries
        (account_id, kind, amount, balance_after, note, note_en, order_id)
  values (account, entry_kind, entry_amount, acc.balance,
          entry_note, entry_note_en, entry_order)
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.post_credit_entry(uuid, text, numeric, text, text, uuid) from public;
grant  execute on function public.post_credit_entry(uuid, text, numeric, text, text, uuid) to authenticated;

-- إعادة احتساب أرصدة دفتر «على الحساب» ذرياً بعد تعديل أو حذف قيد من الإدارة
create or replace function public.admin_recalculate_credit_account(p_account_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_running numeric(12,2) := 0;
  v_credits boolean;
begin
  if not public.is_admin() then
    raise exception 'غير مصرح — للمشرفين فقط';
  end if;

  perform 1 from public.credit_accounts where id = p_account_id for update;

  for r in
    select id, kind, amount
      from public.credit_entries
     where account_id = p_account_id
     order by at asc, id asc
  loop
    v_credits := r.kind in ('topUp', 'settlement', 'transferIn', 'creditAdjustment');
    v_running := v_running + (case when v_credits then r.amount else -r.amount end);
    update public.credit_entries
       set balance_after = v_running
     where id = r.id
       and balance_after is distinct from v_running;
  end loop;

  update public.credit_accounts
     set balance = v_running
   where id = p_account_id;

  return v_running;
end;
$$;

revoke execute on function public.admin_recalculate_credit_account(uuid) from public;
grant  execute on function public.admin_recalculate_credit_account(uuid) to authenticated;

-- حذف قيد خاطئ من دفتر على الحساب مع إعادة احتساب الرصيد التراكمي تلقائياً
create or replace function public.admin_delete_credit_entry(p_entry_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_id uuid;
begin
  if not public.is_admin() then
    raise exception 'غير مصرح — للمشرفين فقط';
  end if;

  delete from public.credit_entries
   where id = p_entry_id
   returning account_id into v_account_id;

  if v_account_id is null then
    raise exception 'القيد غير موجود';
  end if;

  return public.admin_recalculate_credit_account(v_account_id);
end;
$$;

revoke execute on function public.admin_delete_credit_entry(uuid) from public;
grant  execute on function public.admin_delete_credit_entry(uuid) to authenticated;

-- عرض بيانات حسابات المصادقة للمشرفين (حالة الضيف، آخر دخول، تأكيد البريد)
create or replace function public.admin_list_auth_users()
returns table (
  id                 uuid,
  email              text,
  phone              text,
  is_anonymous       boolean,
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz,
  created_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مصرح — للمشرفين فقط';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.phone::text,
    coalesce(u.is_anonymous, false),
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.created_at
  from auth.users u
  order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_auth_users() from public;
grant  execute on function public.admin_list_auth_users() to authenticated;

-- حذف مستخدم بالكامل من `auth.users` (وما يتبعه في `profiles` وغيرها)
create or replace function public.admin_delete_auth_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مصرح — للمشرفين فقط';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'لا يمكنك حذف حساب المشرف الذي تسجّل الدخول به حالياً';
  end if;

  delete from auth.users where id = target_user_id;
  return true;
end;
$$;

revoke execute on function public.admin_delete_auth_user(uuid) from public;
grant  execute on function public.admin_delete_auth_user(uuid) to authenticated;

-- تعبئة الأقسام الإلزامية لمتجر معيّن بطلب من المشرف
create or replace function public.admin_seed_store_categories(p_store_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store public.stores;
  v_before integer;
  v_after  integer;
begin
  if not public.is_admin() and not public.is_store_owner(p_store_id) then
    raise exception 'غير مصرح';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if v_store.id is null then
    raise exception 'المتجر غير موجود';
  end if;

  select count(*) into v_before from public.store_categories where store_id = p_store_id;
  perform public.seed_mandatory_categories_for_store(v_store.id, v_store.type, v_store.name);
  select count(*) into v_after from public.store_categories where store_id = p_store_id;

  return v_after - v_before;
end;
$$;

revoke execute on function public.admin_seed_store_categories(uuid) from public;
grant  execute on function public.admin_seed_store_categories(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. سياسات أمان الصفوف الشاملة للمشرفين (RLS Policies for Admins)
-- ---------------------------------------------------------------------

-- profiles
drop policy if exists "admin: full profiles" on public.profiles;
create policy "admin: full profiles"
  on public.profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- consumer_addresses
drop policy if exists "admin: full addresses" on public.consumer_addresses;
create policy "admin: full addresses"
  on public.consumer_addresses for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- stores
drop policy if exists "admin: full stores" on public.stores;
create policy "admin: full stores"
  on public.stores for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- store_subscriptions
drop policy if exists "admin: full store_subscriptions" on public.store_subscriptions;
create policy "admin: full store_subscriptions"
  on public.store_subscriptions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- store_categories
drop policy if exists "admin: full store_categories" on public.store_categories;
create policy "admin: full store_categories"
  on public.store_categories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- products
drop policy if exists "admin: full products" on public.products;
create policy "admin: full products"
  on public.products for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- daily_offers
drop policy if exists "admin: full daily_offers" on public.daily_offers;
create policy "admin: full daily_offers"
  on public.daily_offers for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- promotions
drop policy if exists "admin: full promotions" on public.promotions;
create policy "admin: full promotions"
  on public.promotions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- orders
drop policy if exists "admin: full orders" on public.orders;
create policy "admin: full orders"
  on public.orders for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- order_items
drop policy if exists "admin: full order_items" on public.order_items;
create policy "admin: full order_items"
  on public.order_items for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- credit_accounts
drop policy if exists "admin: full credit_accounts" on public.credit_accounts;
create policy "admin: full credit_accounts"
  on public.credit_accounts for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- credit_entries
drop policy if exists "admin: full credit_entries" on public.credit_entries;
create policy "admin: full credit_entries"
  on public.credit_entries for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- favourites
drop policy if exists "admin: full favourites" on public.favourites;
create policy "admin: full favourites"
  on public.favourites for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- carts
drop policy if exists "admin: full carts" on public.carts;
create policy "admin: full carts"
  on public.carts for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- shopper_layouts
drop policy if exists "admin: full shopper_layouts" on public.shopper_layouts;
create policy "admin: full shopper_layouts"
  on public.shopper_layouts for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- app_settings
drop policy if exists "admin: full app_settings" on public.app_settings;
create policy "admin: full app_settings"
  on public.app_settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- adverts (قراءة عامة للإعلانات النشطة + تحكم كامل للمشرفين)
drop policy if exists "adverts: public reads active" on public.adverts;
create policy "adverts: public reads active"
  on public.adverts for select to anon, authenticated
  using (active = true and now() between starts_at and ends_at);

drop policy if exists "admin: full adverts" on public.adverts;
create policy "admin: full adverts"
  on public.adverts for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 8. سياسات دلو التخزين `catalog` للمشرفين (رفع، تعديل، وحذف أي صورة)
-- ---------------------------------------------------------------------

do $$
begin
  execute 'drop policy if exists "catalog: admin manages all" on storage.objects';
  execute $p$
    create policy "catalog: admin manages all"
      on storage.objects for all to authenticated
      using (bucket_id = 'catalog' and (select public.is_admin()))
      with check (bucket_id = 'catalog' and (select public.is_admin()))
  $p$;
  raise notice 'policy applied: catalog: admin manages all';
exception
  when insufficient_privilege then
    raise notice 'SKIPPED storage policy: add "catalog: admin manages all" from Storage -> Policies if needed.';
end
$$;
