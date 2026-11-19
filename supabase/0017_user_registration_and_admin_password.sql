-- =====================================================================
-- 0017 — تسجيل بيانات المستخدم الدائم وتسجيل الدخول بالهاتف وتعيين كلمة المرور للمشرف
-- =====================================================================

-- 1. دالة استرجاع البريد الإلكتروني للمستخدم عند تسجيل الدخول برقم الهاتف أو البريد
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_clean text;
  v_digits text;
  v_email text;
begin
  v_clean := trim(p_identifier);
  if v_clean = '' then
    return '';
  end if;

  -- إذا أدخل المستخدم بريداً إلكترونياً
  if v_clean like '%@%' then
    return v_clean;
  end if;

  -- استخراج الأرقام فقط من رقم الهاتف
  v_digits := regexp_replace(v_clean, '[^0-9]', '', 'g');
  if v_digits = '' then
    return v_clean;
  end if;

  -- أ. البحث في جدول الملفات الشخصية profiles عن هاتف مطابق
  select p.email into v_email
  from public.profiles p
  where regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') = v_digits
    and p.email is not null
    and trim(p.email) != ''
  order by p.updated_at desc
  limit 1;

  if v_email is not null and trim(v_email) != '' then
    return v_email;
  end if;

  -- ب. البحث في جدول auth.users
  select u.email into v_email
  from auth.users u
  where regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g') = v_digits
    and u.email is not null
    and trim(u.email) != ''
  limit 1;

  if v_email is not null and trim(v_email) != '' then
    return v_email;
  end if;

  -- ج. الحسابات المسجلة برقم الهاتف فقط بدون بريد مخصص
  return v_digits || '@phone.aitch.app';
end;
$$;

revoke execute on function public.resolve_login_email(text) from public;
grant  execute on function public.resolve_login_email(text) to anon, authenticated;

-- 2. دالة تمكين المشرف العام من تغيير وتعيين كلمة مرور أي مستخدم لدعم العملاء
create or replace function public.admin_set_user_password(target_user_id uuid, new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مصرح — هذه العملية متاحة للمشرفين فقط';
  end if;

  if length(trim(new_password)) < 6 then
    raise exception 'كلمة المرور يجب أن تتكون من 6 خانات على الأقل';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(trim(new_password), extensions.gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;

  return true;
end;
$$;

revoke execute on function public.admin_set_user_password(uuid, text) from public;
grant  execute on function public.admin_set_user_password(uuid, text) to authenticated;

-- 3. سياسة السماح للمستخدم بإنشاء أو إدخال ملفه الشخصي (insert own profile)
drop policy if exists "profile: insert own" on public.profiles;
create policy "profile: insert own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- 4. سياسة تخزين وسائط المستخدمين في سلة catalog (الصور الشخصية وصور الهوية)
do $$
begin
  execute 'drop policy if exists "catalog: user manages own media" on storage.objects';
  execute $p$
    create policy "catalog: user manages own media"
      on storage.objects for all to authenticated
      using (
        bucket_id = 'catalog'
        and name like 'users/' || auth.uid()::text || '/%'
      )
      with check (
        bucket_id = 'catalog'
        and name like 'users/' || auth.uid()::text || '/%'
      )
  $p$;
exception
  when insufficient_privilege then
    null;
end
$$;

