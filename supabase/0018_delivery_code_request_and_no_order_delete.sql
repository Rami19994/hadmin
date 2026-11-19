-- =====================================================================
-- 0018 — طلب كود التسليم عند وصول المندوب + منع حذف الفواتير + إخفاء لدى المستهلك فقط
-- =====================================================================

-- 1. إضافة عمود طلب كود التسليم عند الضغط على «تم التسليم» وعمود إخفاء الفاتورة لدى المستهلك فقط
alter table public.orders
  add column if not exists delivery_code_requested_at timestamptz,
  add column if not exists consumer_hidden boolean not null default false;

-- ضمان شمول حالة 'edited' ضمن قيد حالة الفاتورة
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'approved', 'preparing',
                    'delivering', 'delivered',
                    'rejected', 'cancelled', 'edited'));

-- 2. تحديث دالة الحماية guard_order_columns
create or replace function public.guard_order_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof record;
begin
  if current_user not in ('authenticated', 'anon') then
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

-- 3. منع حذف الفواتير في لوحة المشرف (أمان البيانات): السماح بالقراءة والإضافة والتعديل فقط دون DELETE
drop policy if exists "admin: full orders" on public.orders;
drop policy if exists "admin: select orders" on public.orders;
drop policy if exists "admin: insert orders" on public.orders;
drop policy if exists "admin: update orders" on public.orders;

create policy "admin: select orders"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

create policy "admin: insert orders"
  on public.orders for insert to authenticated
  with check ((select public.is_admin()));

create policy "admin: update orders"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 4. ضمان صلاحيات إدراج وحذف البدائل في جدول order_items للتاجر والمستهلك
drop policy if exists "order item: shop inserts substitutes" on public.order_items;
create policy "order item: shop inserts substitutes"
  on public.order_items for insert to authenticated
  with check (
    substitute_of is not null
    and exists (
      select 1 from public.orders o
      where o.id = order_id and public.is_store_owner(o.store_id)
    )
  );

drop policy if exists "order item: shop deletes items" on public.order_items;
create policy "order item: shop deletes items"
  on public.order_items for delete to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.is_store_owner(o.store_id)
    )
  );

drop policy if exists "order item: consumer inserts substitutes" on public.order_items;
create policy "order item: consumer inserts substitutes"
  on public.order_items for insert to authenticated
  with check (
    substitute_of is not null
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.consumer_id = auth.uid()
    )
  );

drop policy if exists "order item: consumer deletes items" on public.order_items;
create policy "order item: consumer deletes items"
  on public.order_items for delete to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.consumer_id = auth.uid()
    )
  );
