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
-- 1b. متطلبات خطط الاشتراكات (0011) والأقسام الإلزامية والإخفاء (0012)
--     مدمجة هنا بشكل آمن (Idempotent) ليعمل الملف دفعة واحدة على المشروع
--     `ffoeosleputnezuafpcu` (aitch.aitchstore@gmail.com's Project)
-- ---------------------------------------------------------------------

alter table public.stores
  add column if not exists plan_tier text check (plan_tier in ('small', 'medium', 'large')),
  add column if not exists plan_name text,
  add column if not exists max_images int not null default 2000,
  add column if not exists extra_images int not null default 0,
  add column if not exists subscription_status text not null default 'unpaid'
    check (subscription_status in ('unpaid', 'active', 'expired', 'trial')),
  add column if not exists subscription_price numeric(10,2) default 100.00,
  add column if not exists subscription_started_at timestamptz;

create table if not exists public.store_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references public.stores(id) on delete cascade,
  plan_tier           text not null check (plan_tier in ('small', 'medium', 'large')),
  plan_name           text not null,
  amount              numeric(10,2) not null,
  currency            text not null default 'USD',
  duration_months     int not null default 12,
  payment_method      text not null,
  payment_reference   text,
  payment_status      text not null default 'paid' check (payment_status in ('pending', 'paid', 'failed')),
  max_images          int not null default 2000,
  starts_at           timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '1 year'),
  created_at          timestamptz not null default now()
);

alter table public.store_subscriptions enable row level security;
grant select, insert, update, delete on table public.store_subscriptions to authenticated;
create index if not exists store_subscriptions_store_id_idx on public.store_subscriptions (store_id);

drop policy if exists "store_subscriptions: owner reads" on public.store_subscriptions;
create policy "store_subscriptions: owner reads"
  on public.store_subscriptions for select to authenticated
  using ((select public.is_store_owner(store_id)) or (select public.is_admin()));

drop policy if exists "store_subscriptions: owner inserts" on public.store_subscriptions;
create policy "store_subscriptions: owner inserts"
  on public.store_subscriptions for insert to authenticated
  with check ((select public.is_store_owner(store_id)) or (select public.is_admin()));

create or replace function public.subscribe_store(
  p_store_id          uuid,
  p_plan_tier         text,
  p_payment_method    text,
  p_payment_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount    numeric(10,2);
  v_images    int;
  v_plan_name text;
  v_expires   timestamptz;
  v_sub_id    uuid;
begin
  if not public.is_store_owner(p_store_id) and not public.is_admin() then
    raise exception 'غير مصرح لك بإدارة هذا المتجر';
  end if;

  if p_plan_tier = 'small' then
    v_amount := 100.0;
    v_images := 2000;
    v_plan_name := 'خطة المتاجر الصغيرة (50-200 م²)';
  elsif p_plan_tier = 'medium' then
    v_amount := 300.0;
    v_images := 4000;
    v_plan_name := 'خطة المتاجر المتوسطة (200-500 م²)';
  elsif p_plan_tier = 'large' then
    v_amount := 800.0;
    v_images := 8000;
    v_plan_name := 'خطة المتاجر الكبيرة (500-2500 م²)';
  else
    raise exception 'خطة غير معروفة: %', p_plan_tier;
  end if;

  v_expires := now() + interval '1 year';

  insert into public.store_subscriptions (
    store_id, plan_tier, plan_name, amount, currency, duration_months,
    payment_method, payment_reference, payment_status, max_images,
    starts_at, expires_at
  ) values (
    p_store_id, p_plan_tier, v_plan_name, v_amount, 'USD', 12,
    p_payment_method, p_payment_reference, 'paid', v_images,
    now(), v_expires
  ) returning id into v_sub_id;

  update public.stores
  set subscription_expires_at = v_expires,
      subscription_started_at = now(),
      plan_tier = p_plan_tier,
      plan_name = v_plan_name,
      max_images = v_images,
      subscription_status = 'active',
      subscription_price = v_amount
  where id = p_store_id;

  return jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'plan_tier', p_plan_tier,
    'plan_name', v_plan_name,
    'amount', v_amount,
    'max_images', v_images,
    'expires_at', v_expires
  );
end;
$$;

revoke execute on function public.subscribe_store(uuid, text, text, text) from public;
grant  execute on function public.subscribe_store(uuid, text, text, text) to authenticated;

alter table public.store_categories
  add column if not exists is_hidden boolean not null default false;

update public.store_categories
set is_hidden = true
where position >= 10000 and is_hidden = false;

create index if not exists store_categories_store_hidden_pos_idx
  on public.store_categories (store_id, is_hidden, position);

create or replace function public.category_is_visible(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when target is null then true
    else exists (
      select 1
      from public.store_categories c
      where c.id = target and c.is_hidden = false
    )
  end;
$$;

drop policy if exists "category: public read" on public.store_categories;
create policy "category: public read"
  on public.store_categories for select
  using (
    (public.store_is_public(store_id) and not is_hidden)
    or public.is_store_owner(store_id)
  );

drop policy if exists "product: public read" on public.products;
create policy "product: public read"
  on public.products for select
  using (
    (public.store_is_public(store_id) and public.category_is_visible(category_id))
    or public.is_store_owner(store_id)
  );

create or replace function public.normalize_arabic_category(input text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(input, '')),
        'أإآةىؤئ'
          || chr(1600)
          || chr(1611) || chr(1612) || chr(1613) || chr(1614)
          || chr(1615) || chr(1616) || chr(1617) || chr(1618)
          || chr(1648),
        'اااهيوي'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

create or replace function public.seed_mandatory_categories_for_store(
  p_store_id   uuid,
  p_store_type text default 'miniMarket',
  p_store_name text default ''
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind     text;
  v_base_pos integer;
begin
  if lower(coalesce(p_store_type, '')) = 'pharmacy'
     or coalesce(p_store_name, '') like '%صيدلية%' then
    v_kind := 'pharmacy';
  elsif lower(replace(coalesce(p_store_type, ''), '_', '')) = 'autoparts' then
    v_kind := 'auto_parts';
  else
    v_kind := 'grocery';
  end if;

  select coalesce(max(position), -1) + 1
    into v_base_pos
    from public.store_categories
   where store_id = p_store_id
     and is_hidden = false
     and position < 10000;

  with catalog(ord, image_key, name, aliases) as (
    select * from (values
      ( 1, 'vegetables',     'خضار',                  array['خضروات','خضار وفواكه']),
      ( 2, 'fruits',         'فواكه',                 array['فاكهة']),
      ( 3, 'milk',           'حليب وألبان',           array['البان واجبان','ألبان وأجبان','البان','ألبان']),
      ( 4, 'cheese',         'أجبان',                 array['جبنة','اجبان']),
      ( 5, 'eggs',           'بيض',                   array[]::text[]),
      ( 6, 'butter',         'زبدة وسمنة',            array['سمنة وزبدة','زبدة','سمنة']),
      ( 7, 'meat',           'لحوم',                  array['ملحمة','لحم']),
      ( 8, 'chicken',        'دجاج',                  array['فروج','دواجن']),
      ( 9, 'fish',           'سمك',                   array['أسماك','ماكولات بحرية','مأكولات بحرية']),
      (10, 'bread',          'خبز',                   array['خبز ومعجنات','مخبوزات','معجنات']),
      (11, 'rice',           'أرز وحبوب',             array['رز','ارز','أرز','ارز وحبوب','حبوب']),
      (12, 'pasta',          'معكرونة',               array['مكرونة','معكرونة وشعيرية']),
      (13, 'flour',          'طحين',                  array['دقيق','طحين وخبيز']),
      (14, 'legumes',        'بقوليات',               array['بقول']),
      (15, 'oil',            'زيوت',                  array['زيوت وسمن','زيت']),
      (16, 'canned',         'معلبات وصلصات',         array['معلبات','صلصات']),
      (17, 'spices',         'بهارات وتوابل',         array['بهارات','توابل','عطارة']),
      (18, 'salt',           'ملح وسكر',              array['مستلزمات الطبخ','سكر وملح']),
      (19, 'honey',          'عسل ومربى',             array['عسل','مربى','مربيات']),
      (20, 'nuts',           'مكسرات وبزورية',        array['مكسرات','بزورية','محمصة']),
      (21, 'sweets',         'حلويات وبسكويت',        array['حلويات','بسكويت','شوكولا','سكاكر']),
      (22, 'chips',          'شيبس ومقرمشات',         array['مقرمشات','شيبس وبسكويت','شيبس','سناك']),
      (23, 'water',          'مياه',                  array['مياه ومشروبات باردة','ماء']),
      (24, 'juice',          'عصائر',                 array['عصير']),
      (25, 'soda',           'مشروبات غازية',         array['مشروبات باردة','غازيات']),
      (26, 'tea',            'شاي',                   array['شاي وقهوة']),
      (27, 'coffee',         'قهوة',                  array['بن','بن وقهوة']),
      (28, 'detergent',      'مواد تنظيف',            array['منظفات','منظفات وورقيات']),
      (29, 'cleaning_tools', 'أدوات تنظيف',           array['ادوات تنظيف']),
      (30, 'soap',           'صابون وعناية شخصية',    array['صابون','عناية شخصية','شامبو وصابون']),
      (31, 'tissues',        'مناديل ورقية',          array['ورقيات','محارم','مناديل']),
      (32, 'baby',           'مستلزمات أطفال',        array['اطفال','أطفال','حفاضات']),
      (33, 'household',      'أدوات منزلية',          array['ادوات منزلية','مستهلكات منزلية']),
      (34, 'batteries',      'بطاريات',               array['كهربائيات خفيفة']),
      (35, 'stationery',     'قرطاسية',               array['أدوات مكتبية']),
      (36, 'box',            'متنوعات',               array['أخرى','اخرى'])
    ) as g(ord, image_key, name, aliases)
    where v_kind = 'grocery'

    union all

    select * from (values
      ( 1, 'medicine',       'أدوية ومسكنات',         array['أدوية','مسكنات']),
      ( 2, 'capsule',        'كبسولات ومضادات',       array['مضادات','كبسولات']),
      ( 3, 'syrup',          'شراب طبي وسعال',        array['شراب طبي']),
      ( 4, 'vitamins',       'فيتامينات ومكملات',     array['فيتامينات','مكملات غذائية']),
      ( 5, 'ointment',       'مراهم وعناية بالبشرة',  array['مرهم وكريم طبي','مستحضرات العناية بالبشرة','كريمات تنظيف البشرة']),
      ( 6, 'first_aid',      'إسعافات أولية',         array[]::text[]),
      ( 7, 'bandage',        'ضمادات وشاش طبي',       array['ضمادات','شاش طبي']),
      ( 8, 'thermometer',    'أجهزة قياس طبية',       array['ميزان حرارة']),
      ( 9, 'eyedrops',       'قطرات عين وأذن وأنف',   array['قطرة عين وأذن']),
      (10, 'mask',           'كمامات ومستلزمات وقاية',array['كمامات طبية','معقمات وكمامات']),
      (11, 'baby_milk',      'حليب ومغذيات أطفال',    array['حليب أطفال طبي']),
      (12, 'baby',           'مستلزمات أطفال',        array[]::text[]),
      (13, 'soap',           'عناية شخصية وصابون',    array['صابون']),
      (14, 'tissues',        'مناديل وقطن طبي',       array['مناديل ورقية'])
    ) as p(ord, image_key, name, aliases)
    where v_kind = 'pharmacy'

    union all

    select * from (values
      ( 1, 'motor_oil',      'زيوت وسوائل المحرك',    array[]::text[]),
      ( 2, 'oil_filter',     'فلاتر زيت وهواء ومكيف', array['فلاتر زيت وهواء']),
      ( 3, 'brake_pads',     'فحمات وديسكات فرامل',   array[]::text[]),
      ( 4, 'spark_plugs',    'بواجي وشمعات احتراق',   array[]::text[]),
      ( 5, 'car_battery',    'بطاريات وكهرباء سيارات',array['بطاريات سيارات']),
      ( 6, 'shock_absorber', 'مساعدات ونظام تعليق',   array['مساعدات وممتص صدمات']),
      ( 7, 'tires',          'إطارات وجنوط',          array[]::text[]),
      ( 8, 'headlight',      'أضواء وإنارة سيارات',   array[]::text[]),
      ( 9, 'car_wipers',     'مساحات وزجاج',          array['مساحات زجاج']),
      (10, 'car_accessories','إكسسوارات وعناية بالسيارة', array[]::text[])
    ) as a(ord, image_key, name, aliases)
    where v_kind = 'auto_parts'
  ),
  missing as (
    select
      c.image_key,
      c.name,
      row_number() over (order by c.ord) - 1 as idx
    from catalog c
    where not exists (
      select 1
      from public.store_categories existing
      where existing.store_id = p_store_id
        and (
          existing.image_key = c.image_key
          or public.normalize_arabic_category(existing.name) = public.normalize_arabic_category(c.name)
          or public.normalize_arabic_category(existing.name) = any(
            select public.normalize_arabic_category(al) from unnest(c.aliases) as al
          )
        )
    )
  )
  insert into public.store_categories (store_id, name, image_key, position, is_hidden)
  select p_store_id, m.name, m.image_key, v_base_pos + m.idx, false
  from missing m
  order by m.idx;
end;
$$;

create or replace function public.on_store_created_seed_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_mandatory_categories_for_store(new.id, new.type, new.name);
  return new;
end;
$$;

drop trigger if exists stores_seed_mandatory_categories on public.stores;
create trigger stores_seed_mandatory_categories
  after insert on public.stores
  for each row execute function public.on_store_created_seed_categories();

do $$
declare
  r record;
begin
  for r in select id, type, name from public.stores loop
    perform public.seed_mandatory_categories_for_store(r.id, r.type, r.name);
  end loop;
end;
$$;

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
grant select on table public.adverts to anon, authenticated;
grant insert, update, delete on table public.adverts to authenticated;

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
