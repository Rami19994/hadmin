begin;
-- Quantity selectors support thousandths (for example, grams within a kilo).
alter table public.products alter column quantity type numeric(14,3);
alter table public.order_items alter column quantity type numeric(14,3);
alter table public.products
  add column if not exists stock_action text not null default 'show_unavailable'
    check(stock_action in ('show_unavailable','hide')),
  add column if not exists stock_exhausted boolean not null default false,
  add column if not exists stock_version bigint not null default 0;
alter table public.order_items
  add column if not exists stock_reserved_quantity numeric(14,3),
  add column if not exists stock_consumed boolean not null default false;
create index order_items_stock_product_idx on public.order_items(product_id)
  where stock_reserved_quantity > 0;

create or replace function private.product_stock_flags()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.quantity < 0 or new.quantity::text in ('NaN','Infinity','-Infinity') then
    raise exception 'الكمية المتوفرة يجب أن تكون صفراً أو أكبر';
  end if;
  if jsonb_typeof(new.extra_units) is distinct from 'array' then raise exception 'وحدات المادة غير صحيحة'; end if;
  if exists(select 1 from jsonb_array_elements(new.extra_units) u
    where (u->>'quantity')::numeric < 0 or (u->>'quantity')::numeric::text in ('NaN','Infinity','-Infinity')) then
    raise exception 'كمية الوحدة الإضافية غير صحيحة';
  end if;
  if tg_op = 'UPDATE' then
    if exists(select 1 from public.order_items i join public.orders o on o.id = i.order_id
      where i.product_id = old.id and i.stock_reserved_quantity > 0 and not i.stock_consumed
      and i.unit <> new.unit and not exists(select 1 from jsonb_array_elements(new.extra_units) u where u->>'unit' = i.unit)
      and o.status not in ('cancelled','rejected','delivered')) then
      raise exception 'لا يمكن حذف أو تغيير وحدة عليها طلبات نشطة';
    end if;
    new.stock_version := old.stock_version + case when new.quantity is distinct from old.quantity
      or new.extra_units is distinct from old.extra_units then 1 else 0 end;
  else new.stock_version := 0; end if;
  new.stock_exhausted := new.quantity <= 0 and not exists(
    select 1 from jsonb_array_elements(new.extra_units) u where coalesce((u->>'quantity')::numeric,0) > 0);
  return new;
end;
$$;
revoke all on function private.product_stock_flags() from public, anon, authenticated;
create trigger products_stock_flags before insert or update on public.products
  for each row execute function private.product_stock_flags();
update public.products set quantity = quantity;

-- Out-of-stock products may be hidden from shoppers; their merchant retains
-- the row for replenishment and historical invoices retain their item ids.
drop policy if exists "product: public read" on public.products;
create policy "product: public read" on public.products for select using (
  public.is_store_owner(store_id) or (public.store_is_public(store_id)
    and public.category_is_visible(category_id)
    and not (stock_exhausted and stock_action = 'hide')));

create or replace function private.change_product_stock(p_id uuid, p_unit text, p_delta numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare product public.products; stock numeric; units jsonb;
begin
  if p_delta = 0 then return; end if;
  select * into product from public.products where id = p_id for update;
  if product.id is null then
    if p_delta > 0 then return; end if;
    raise exception 'المادة لم تعد موجودة في المتجر';
  end if;
  if p_delta < 0 and not product.available then raise exception 'هذه المادة غير متوفرة الآن'; end if;
  if p_unit = product.unit then stock := product.quantity;
  else
    select (u->>'quantity')::numeric into stock from jsonb_array_elements(product.extra_units) u
      where u->>'unit' = p_unit;
  end if;
  if stock is null then raise exception 'وحدة البيع لم تعد متاحة'; end if;
  if stock + p_delta < 0 then raise exception 'الكمية المطلوبة تتجاوز المتوفر من مادة % بوحدة %', product.name, p_unit; end if;
  if p_unit = product.unit then
    update public.products set quantity = quantity + p_delta where id = p_id;
  else
    select jsonb_agg(case when u->>'unit' = p_unit then jsonb_set(u, '{quantity}', to_jsonb(stock + p_delta)) else u end order by n)
      into units from jsonb_array_elements(product.extra_units) with ordinality x(u,n);
    update public.products set extra_units = units where id = p_id;
  end if;
end;
$$;
revoke all on function private.change_product_stock(uuid, text, numeric) from public, anon, authenticated;

create or replace function private.reserve_invoice_stock()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare invoice public.orders; wanted numeric := 0; reserved numeric := 0;
begin
  select * into invoice from public.orders
    where id = case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  if invoice.id is not null and auth.uid() is not null and invoice.consumer_id <> auth.uid()
    and not public.is_store_owner(invoice.store_id) and not public.is_admin() then
    raise exception 'لا يمكنك تغيير مخزون فاتورة حساب آخر';
  end if;
  if tg_op <> 'INSERT' then
    reserved := coalesce(old.stock_reserved_quantity,0);
    if old.stock_consumed then
      if tg_op = 'DELETE' then return old; end if;
      new.stock_reserved_quantity := reserved; new.stock_consumed := true; return new;
    end if;
  end if;
  if tg_op = 'DELETE' then
    if old.product_id is not null then perform private.change_product_stock(old.product_id, old.unit, reserved); end if;
    return old;
  end if;
  new.stock_consumed := invoice.status = 'delivered';
  -- Existing invoices predate inventory tracking; do not deduct historical sales.
  if tg_op = 'UPDATE' and old.stock_reserved_quantity is null and new.stock_consumed then
    new.stock_reserved_quantity := 0; return new;
  end if;
  if invoice.id is not null and invoice.status not in ('cancelled','rejected')
    and not new.unavailable and new.product_id is not null then wanted := new.quantity; end if;
  if tg_op = 'UPDATE' and (new.product_id is distinct from old.product_id or new.unit is distinct from old.unit) then
    if old.product_id is not null then perform private.change_product_stock(old.product_id, old.unit, reserved); end if;
    reserved := 0;
  end if;
  if new.product_id is not null then perform private.change_product_stock(new.product_id, new.unit, reserved - wanted); end if;
  new.stock_reserved_quantity := wanted;
  return new;
end;
$$;
revoke all on function private.reserve_invoice_stock() from public, anon, authenticated;
-- Runs after the price/ownership guards and repricing trigger.
create trigger order_items_stock before insert or update or delete on public.order_items
  for each row execute function private.reserve_invoice_stock();

create or replace function private.invoice_stock_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.order_items set stock_reserved_quantity = stock_reserved_quantity where order_id = new.id;
  return new;
end;
$$;
revoke all on function private.invoice_stock_status() from public, anon, authenticated;
create trigger orders_stock_status after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function private.invoice_stock_status();
notify pgrst, 'reload schema';
commit;
