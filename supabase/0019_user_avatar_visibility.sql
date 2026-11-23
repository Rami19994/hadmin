-- =====================================================================
-- 0019 — إظهار الصورة الشخصية للمستخدم عند التجار وباقي المستخدمين
-- =====================================================================

-- 1. إضافة عمود احتياطي لصورة العميل على الطلب إن لزم
alter table public.orders
  add column if not exists customer_photo_url text;

-- 2. السماح لأصحاب المتاجر بقراءة ملفات عملائهم (الاسم والصورة الشخصية)
drop policy if exists "profile: store owner reads customers" on public.profiles;
create policy "profile: store owner reads customers"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.orders o
      join public.stores s on s.id = o.store_id
      where o.consumer_id = profiles.id
        and s.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.credit_accounts c
      join public.stores s on s.id = c.store_id
      where c.consumer_id = profiles.id
        and s.owner_id = auth.uid()
    )
  );

-- 3. دالة آمنة لإرجاع الاسم والصورة الشخصية فقط للمستخدمين (دون البريد أو الهوية)
create or replace function public.get_public_profiles(p_uids uuid[])
returns table (
  id            uuid,
  first_name_ar text,
  last_name_ar  text,
  first_name_en text,
  last_name_en  text,
  photo_url     text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.first_name_ar,
    p.last_name_ar,
    p.first_name_en,
    p.last_name_en,
    p.photo_url
  from public.profiles p
  where p.id = any(p_uids);
$$;

revoke all on function public.get_public_profiles(uuid[]) from public;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;

-- 4. ضمان صلاحية رفع المستخدم لصورته الشخصية في سلة catalog/users/<uid>/...
do $$
begin
  execute 'drop policy if exists "catalog: user manages own media" on storage.objects';
  execute $p$
    create policy "catalog: user manages own media"
      on storage.objects for all to authenticated
      using (
        bucket_id = 'catalog'
        and (storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      with check (
        bucket_id = 'catalog'
        and (storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
  $p$;
exception
  when insufficient_privilege then
    raise notice 'SKIPPED storage policy: insufficient privilege.';
end $$;

