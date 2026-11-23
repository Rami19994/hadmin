-- Orders and invoice revisions commit together. Retrying a checkout reuses
-- the same request id, including when the previous response was lost.
begin;

alter table public.orders add column if not exists client_request_id text;
create unique index if not exists orders_consumer_request_idx
  on public.orders (consumer_id, client_request_id)
  where client_request_id is not null;
alter table public.order_items
  add column if not exists consumer_decision text
    check (consumer_decision in ('accepted', 'rejected', 'replaced'));

-- RLS continues to decide which orders the caller can see.
create or replace function public.order_receipt(p_order_id uuid)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp
as $$
  select to_jsonb(o) || jsonb_build_object('order_items', coalesce((
    select jsonb_agg(to_jsonb(i) order by i.position, i.id)
    from public.order_items i where i.order_id = o.id
  ), '[]'::jsonb))
  from public.orders o where o.id = p_order_id;
$$;
revoke all on function public.order_receipt(uuid) from public;
grant execute on function public.order_receipt(uuid) to authenticated;

-- These triggers must run as the caller: current_user inside a definer
-- function is the function owner and previously skipped all validation.
create or replace function public.reprice_order_item()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  shelf public.products;
  order_store uuid;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  select store_id into order_store from public.orders where id = new.order_id;
  if new.product_id is null then
    if not public.is_store_owner(order_store) then
      raise exception 'اختر مادة موجودة في متجر الفاتورة';
    end if;
    return new;
  end if;
  select * into shelf from public.products
    where id = new.product_id and store_id = order_store and available;
  if shelf.id is null then
    raise exception 'المادة غير متوفرة في هذا المتجر، حدّث السلة وحاول مجدداً';
  end if;
  new.name := shelf.name;
  if new.unit = shelf.unit then
    new.unit_price := shelf.price;
  else
    select (u->>'price')::numeric into new.unit_price
      from jsonb_array_elements(shelf.extra_units) u
      where u->>'unit' = new.unit limit 1;
    if new.unit_price is null then
      raise exception 'وحدة البيع لم تعد متاحة، حدّث السلة وحاول مجدداً';
    end if;
  end if;
  new.unavailable := false;
  return new;
end;
$$;
revoke all on function public.reprice_order_item() from public;

create or replace function public.guard_order_item_change()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  target public.orders;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  select * into target from public.orders
    where id = case when tg_op = 'DELETE' then old.order_id else new.order_id end
    for update;
  if target.id is null or target.status not in ('pending', 'edited', 'approved', 'preparing') then
    raise exception 'لا يمكن تعديل بنود هذه الفاتورة في حالتها الحالية';
  end if;
  if tg_op = 'UPDATE' then
    if new.order_id is distinct from old.order_id
       or new.substitute_of is distinct from old.substitute_of then
      raise exception 'لا يمكن نقل بند إلى فاتورة أخرى';
    end if;
    if not public.is_store_owner(target.store_id) and (
      new.product_id is distinct from old.product_id
      or new.name is distinct from old.name or new.unit is distinct from old.unit
      or new.unit_price is distinct from old.unit_price
    ) then
      raise exception 'سعر المادة ووحدتها يحددهما المتجر';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.guard_order_item_change() from public;
drop trigger if exists order_items_guard on public.order_items;
create trigger order_items_guard before insert or update or delete
  on public.order_items for each row execute function public.guard_order_item_change();

create or replace function public.submit_order(
  p_request_id text, p_store_id uuid, p_address text, p_payment_method text,
  p_items jsonb, p_cash_denomination numeric default null,
  p_note text default null, p_customer_name text default null,
  p_customer_phone text default null
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  order_id uuid;
  old_store uuid;
  line jsonb;
  saved public.order_items;
  position_no integer := 0;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول لإرسال الطلب'; end if;
  if p_request_id is null or length(p_request_id) not between 16 and 128 then
    raise exception 'تعذر تحديد عملية الإرسال، افتح السلة مجدداً';
  end if;
  select id, store_id into order_id, old_store from public.orders
    where consumer_id = auth.uid() and client_request_id = p_request_id;
  if order_id is not null then
    if old_store <> p_store_id then raise exception 'عملية الإرسال تخص متجراً آخر'; end if;
    return public.order_receipt(order_id);
  end if;
  if p_address is null or length(trim(p_address)) = 0 then
    raise exception 'اختر عنوان التوصيل';
  end if;
  if p_payment_method is null or p_payment_method not in
      ('cashOnDelivery', 'cardOnDelivery', 'online', 'account', 'thirdParty') then
    raise exception 'اختر طريقة دفع صحيحة';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'تعذر قراءة مواد الطلب';
  end if;
  if jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'يجب أن يحتوي الطلب على مادة واحدة إلى 200 مادة';
  end if;
  insert into public.orders (store_id, consumer_id, address, payment_method,
    client_request_id, note, cash_denomination, customer_name, customer_phone)
  values (p_store_id, auth.uid(), trim(p_address), p_payment_method,
    p_request_id, p_note, p_cash_denomination, p_customer_name, p_customer_phone)
  on conflict (consumer_id, client_request_id) where client_request_id is not null
    do nothing returning id into order_id;
  if order_id is null then
    select id, store_id into order_id, old_store from public.orders
      where consumer_id = auth.uid() and client_request_id = p_request_id;
    if order_id is null or old_store <> p_store_id then
      raise exception 'تعذر تأكيد عملية الإرسال';
    end if;
    return public.order_receipt(order_id);
  end if;
  for line in select value from jsonb_array_elements(p_items) loop
    if line->>'product_id' is null or line->>'quantity' is null
       or line->>'unit_price' is null then
      raise exception 'بيانات إحدى المواد ناقصة، حدّث السلة';
    end if;
    insert into public.order_items (order_id, product_id, name, unit,
      unit_price, quantity, position)
    values (order_id, (line->>'product_id')::uuid, '', line->>'unit',
      (line->>'unit_price')::numeric, (line->>'quantity')::numeric, position_no)
    returning * into saved;
    if saved.unit_price <> (line->>'unit_price')::numeric then
      raise exception 'تغيّر سعر مادة في السلة، حدّث الأسعار قبل الإرسال';
    end if;
    position_no := position_no + 1;
  end loop;
  return public.order_receipt(order_id);
end;
$$;
revoke all on function public.submit_order(text, uuid, text, text, jsonb, numeric, text, text, text) from public;
grant execute on function public.submit_order(text, uuid, text, text, jsonb, numeric, text, text, text) to authenticated;

create or replace function public.submit_order_revision(
  p_order_id uuid, p_items jsonb, p_actor text
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  target public.orders;
  line jsonb;
  sub jsonb;
  parent_id uuid;
  sub_id uuid;
  kept_parents uuid[] := '{}';
  kept_subs uuid[];
  saved public.order_items;
  parent_count integer;
  position_no integer;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول لإرسال الفاتورة'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if target.id is null then raise exception 'الفاتورة غير موجودة أو غير متاحة لحسابك'; end if;
  if p_actor = 'merchant' then
    if not public.is_store_owner(target.store_id) and not public.is_admin() then
      raise exception 'لا يمكنك إرسال فاتورة متجر آخر';
    end if;
  elsif p_actor = 'consumer' then
    if target.consumer_id <> auth.uid() then raise exception 'هذه ليست فاتورتك'; end if;
  else
    raise exception 'عملية إرسال غير معروفة';
  end if;
  if target.status not in ('pending', 'edited', 'approved', 'preparing') then
    raise exception 'تغيّرت حالة الفاتورة، حدّثها قبل إعادة الإرسال';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'بنود الفاتورة غير صحيحة'; end if;
  if jsonb_array_length(p_items) not between 1 and 200 then raise exception 'لا يمكن إرسال فاتورة فارغة أو أكبر من 200 مادة'; end if;
  select count(*) into parent_count from public.order_items
    where order_id = p_order_id and substitute_of is null;
  for line in select value from jsonb_array_elements(p_items) loop
    parent_id := (line->>'id')::uuid;
    if parent_id = any(kept_parents) then raise exception 'تكرر بند في الفاتورة'; end if;
    kept_parents := array_append(kept_parents, parent_id);
    update public.order_items set quantity = (line->>'quantity')::numeric,
      unavailable = coalesce((line->>'unavailable')::boolean, false),
      consumer_decision = case when p_actor = 'consumer' then line->>'consumer_decision' else null end
      where id = parent_id and order_id = p_order_id and substitute_of is null;
    if not found then raise exception 'تغيّرت بنود الفاتورة، حدّثها قبل إعادة الإرسال'; end if;
    if jsonb_typeof(line->'substitutes') is distinct from 'array' then
      raise exception 'بيانات البدائل غير صحيحة';
    end if;
    if jsonb_array_length(line->'substitutes') > 20 then raise exception 'عدد البدائل أكبر من المسموح'; end if;
    kept_subs := '{}';
    position_no := 0;
    for sub in select value from jsonb_array_elements(line->'substitutes') loop
      sub_id := null;
      if sub->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select id into sub_id from public.order_items
          where id = (sub->>'id')::uuid and order_id = p_order_id and substitute_of = parent_id;
      end if;
      if sub_id is not null then
        update public.order_items set quantity = (sub->>'quantity')::numeric,
          position = position_no where id = sub_id;
      else
        if sub->>'product_id' is null then raise exception 'اختر البديل من مواد المتجر ثم أعد الإرسال'; end if;
        insert into public.order_items (order_id, product_id, name, unit,
          unit_price, quantity, substitute_of, position)
        values (p_order_id, (sub->>'product_id')::uuid, '', sub->>'unit',
          (sub->>'unit_price')::numeric, (sub->>'quantity')::numeric, parent_id, position_no)
        returning * into saved;
        if saved.unit_price <> (sub->>'unit_price')::numeric then
          raise exception 'تغيّر سعر البديل، حدّث الفاتورة قبل الإرسال';
        end if;
        sub_id := saved.id;
      end if;
      if sub_id = any(kept_subs) then raise exception 'تكرر بديل في الفاتورة'; end if;
      kept_subs := array_append(kept_subs, sub_id);
      position_no := position_no + 1;
    end loop;
    delete from public.order_items where order_id = p_order_id
      and substitute_of = parent_id and not (id = any(kept_subs));
  end loop;
  if p_actor = 'merchant' and cardinality(kept_parents) <> parent_count then
    raise exception 'احتفظ بالمادة الأصلية وعلّمها غير متوفرة بدلاً من حذفها';
  end if;
  delete from public.order_items where order_id = p_order_id
    and substitute_of is null and not (id = any(kept_parents));
  if p_actor = 'consumer' and not exists (
    select 1 from public.order_items where order_id = p_order_id and not unavailable
  ) then raise exception 'لا توجد مواد متاحة في الفاتورة، اختر بديلاً أو ألغِ الطلب'; end if;
  update public.orders set
    status = case when p_actor = 'merchant' then 'edited' else 'pending' end,
    approved_at = null,
    opened = case when p_actor = 'consumer' then false else opened end,
    note = nullif(trim(regexp_replace(regexp_replace(coalesce(note, ''),
      '\s*\[SUBS:[A-Za-z0-9_=-]+\]', '', 'g'), '\s*\[MERCHANT_EDITED\]', '', 'g')), '')
    where id = p_order_id;
  return public.order_receipt(p_order_id);
end;
$$;
revoke all on function public.submit_order_revision(uuid, jsonb, text) from public;
grant execute on function public.submit_order_revision(uuid, jsonb, text) to authenticated;

-- guard_order_columns is replaced below before committing this migration.
create or replace function public.guard_order_columns()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  prof record;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.consumer_id := auth.uid();
    new.status := 'pending';
    new.approved_at := null;
    new.delivered_at := null;
    new.opened := false;
    new.delivery_code_requested_at := null;
    new.consumer_hidden := false;

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
    new.client_request_id := old.client_request_id;
    new.approved_at := old.approved_at;
    new.delivered_at := old.delivered_at;
    new.currency := old.currency;
    new.vat_percent := old.vat_percent;
    new.customer_name := coalesce(new.customer_name, old.customer_name);
    new.customer_phone := coalesce(new.customer_phone, old.customer_phone);

    -- حماية طلب كود التسليم: التاجر (أو المشرف) فقط يفعّله
    if not (public.is_store_owner(new.store_id) or public.is_admin()) then
      new.delivery_code_requested_at := old.delivery_code_requested_at;
    end if;

    -- المستهلك وحده يُخفي الفاتورة من حسابه، ولا تُحذف من المتجر أو الإدارة
    if new.consumer_id <> auth.uid() and not public.is_admin() then
      new.consumer_hidden := old.consumer_hidden;
    end if;

    if new.status is distinct from old.status then
      if public.is_store_owner(new.store_id) or public.is_admin() then
        if new.status in ('approved', 'preparing', 'delivering') and old.approved_at is null then
          new.approved_at := now();
        end if;
        if new.status = 'delivered' then
          new.delivered_at := now();
        end if;
        if new.status = 'edited' then
          new.approved_at := null;
        end if;
      elsif new.consumer_id = auth.uid() then
        -- 1. إلغاء الطلب في جميع مراحله النشطة قبل التسليم النهائي
        if (old.status in ('pending', 'edited', 'approved', 'preparing', 'delivering') and new.status = 'cancelled') then
          -- مسموح
        -- 2. إعادة إرسال الطلب بعد التعديل أو الموافقة على تعديل المتجر
        elsif (old.status in ('edited', 'approved', 'preparing', 'pending') and new.status = 'pending') then
          new.approved_at := null;
        -- 3. تأكيد استلام الطلب (تم التسليم) من قبل المستهلك
        elsif (old.status in ('approved', 'preparing', 'delivering') and new.status = 'delivered') then
          new.delivered_at := now();
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

revoke all on function public.guard_order_columns() from public;
notify pgrst, 'reload schema';
commit;
