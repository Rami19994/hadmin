-- =====================================================================
-- 0014 — معرض صور التطبيق الموحّد (App Image Gallery)
--
-- يتيح للمشرفين في لوحة الأدمن رفع وإدارة صور عامة للمعرض من أجهزتهم،
-- مصنّفة حسب الأقسام (خضار وفواكه، لحوم وألبان، مواد غذائية، إلخ)،
-- لتظهر تلقائياً في معرض التطبيق ليتمكن المستخدمون والتجار من اختيارها
-- مباشرة لأقسامهم وموادهم دون الحاجة لرفع صور مكررة.
-- =====================================================================

create table if not exists public.app_gallery (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,                 -- اسم الصورة / المادة (مثل: لبنة، جبنة بيضاء، فاصولياء)
  category     text not null default 'عام',   -- القسم أو التصنيف (مثل: خضار وفواكه، لحوم وألبان، مواد غذائية، مشروبات، صيدلية، قطع غيار سيارات، أخرى)
  image_url    text not null,                -- رابط الصورة المخزنة في Supabase Storage (دلو catalog)
  image_key    text,                         -- رمز تعريفي اختياري
  position     integer not null default 0,    -- ترتيب العرض
  is_active    boolean not null default true, -- إظهار أو إخفاء الصورة في التطبيق
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.app_gallery enable row level security;

-- فهارس لتحسين سرعة الاستعلام والفلترة بالأقسام
create index if not exists app_gallery_category_idx on public.app_gallery (category, position);
create index if not exists app_gallery_active_idx on public.app_gallery (is_active, position);
create index if not exists app_gallery_created_idx on public.app_gallery (created_at desc);

-- تحديث توقيت التعديل تلقائياً
drop trigger if exists app_gallery_touch on public.app_gallery;
create trigger app_gallery_touch
  before update on public.app_gallery
  for each row execute function public.touch_updated_at();

-- سياسة القراءة العامة لجميع المستخدمين والتجار والضيوف (لإظهار الصور في معرض التطبيق)
drop policy if exists "app_gallery: public reads active" on public.app_gallery;
create policy "app_gallery: public reads active"
  on public.app_gallery for select
  to anon, authenticated
  using (is_active = true);

-- سياسة التحكم الشامل للمشرفين العامين (إضافة، تعديل، حذف، رفع من الجهاز)
drop policy if exists "admin: full app_gallery" on public.app_gallery;
create policy "admin: full app_gallery"
  on public.app_gallery for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- منح الصلاحيات للأدوار
grant select on public.app_gallery to anon, authenticated;
grant insert, update, delete on public.app_gallery to authenticated;

