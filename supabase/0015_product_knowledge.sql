-- =====================================================================
-- 0015 — موسوعة وقاموس المواد والبضائع (Product Knowledge / Encyclopedia)
--
-- يحتوي على الحقول التفصيلية للمواد والسلع (الغذائية، الصحية، الاستخدامات، الحفظ)
-- لملء معلومات المنتجات تلقائياً بمجرد كتابة اسم المادة.
-- =====================================================================

create table if not exists public.product_knowledge (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,                         -- الاسم بالعربية (سلق، بندورة، خيار...)
  name_en             text,                                  -- الاسم بالإنكليزية (Swiss Chard...)
  classification      text,                                  -- التصنيف (ورقيات، حمضيات، لحوم...)
  nutrition_per_100g  text,                                  -- يحتوي على: لكل 100 غ
  calories_per_100g   text,                                  -- السعرات الحرارية: لكل 100 غ
  fiber_per_100g      text,                                  -- الألياف: لكل 100 غ
  vitamins_minerals   text,                                  -- الفيتامينات والمعادن: لكل 100 غ
  health_benefits     text,                                  -- الفوائد الصحية: لكل 100 غ
  warnings            text,                                  -- لا ينصح به لـ
  uses                text,                                  -- الاستخدامات والطهي
  origin              text,                                  -- الموطن الأصلي
  storage_method      text,                                  -- طريقة الحفظ
  image_url           text,                                  -- صورة المادة
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- فهرس سريع لاسم المادة للبحث والتعبئة التلقائية
create unique index if not exists product_knowledge_name_idx on public.product_knowledge (lower(trim(name)));
create index if not exists product_knowledge_class_idx on public.product_knowledge (classification);

alter table public.product_knowledge enable row level security;

-- سياسة القراءة العامة للجميع (تجار وزبائن)
drop policy if exists "product_knowledge: public read" on public.product_knowledge;
create policy "product_knowledge: public read"
  on public.product_knowledge for select
  to anon, authenticated
  using (true);

-- سياسة الإدارة الكاملة للوحة التحكم
drop policy if exists "admin: full product_knowledge" on public.product_knowledge;
create policy "admin: full product_knowledge"
  on public.product_knowledge for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.product_knowledge to anon, authenticated;
grant insert, update, delete on public.product_knowledge to authenticated;

-- إضافة أعمدة الموسوعة أيضاً إلى جدول المنتجات الأساسي public.products إن لم تكن موجودة
alter table public.products add column if not exists classification text;
alter table public.products add column if not exists nutrition_per_100g text;
alter table public.products add column if not exists calories_per_100g text;
alter table public.products add column if not exists fiber_per_100g text;
alter table public.products add column if not exists vitamins_minerals text;
alter table public.products add column if not exists health_benefits text;
alter table public.products add column if not exists warnings text;
alter table public.products add column if not exists uses text;
alter table public.products add column if not exists origin text;
alter table public.products add column if not exists storage_method text;

-- إدخال مادة السلق المرفقة في صورة المستخدم كعنصر قياسي أولي
insert into public.product_knowledge (
  name,
  name_en,
  classification,
  nutrition_per_100g,
  calories_per_100g,
  fiber_per_100g,
  vitamins_minerals,
  health_benefits,
  warnings,
  uses,
  origin,
  storage_method,
  image_url
) values (
  'سلق',
  'Swiss Chard',
  'ورقيات',
  'ماء 92.6 غرام، بروتين 1.8 غرام، كربوهيدرات 3.7 غرام، دهون 0.2 غرام، ألياف 1.6 غرام.',
  '19 سعرة حرارية لكل 100 غرام نيء، و 35 سعرة حرارية لكل 3.7 غرام لكل كوب مطبوخ (175 غرام).',
  '1.6 غرام لكل 100 غرام نيء، و 3.7 غرام لكل كوب مطبوخ (175 غرام).',
  'فيتامين K: 830 ميكروغرام (أعلى من السبانخ)، فيتامين A: 306 ميكروغرام، فيتامين C: 30 مليغرام، حمض الفوليك (فيتامين B9 الطبيعي لتجديد الدم والخلايا): 14 ميكروغرام، فيتامين E: 1.8 مليغرام، كالسيوم 51 مليغرام، حديد 1.8 مليغرام، مغنيسيوم 81 مليغرام، بوتاسيوم 379 مليغرام، صوديوم 213 مليغرام، منغنيز ونحاس.',
  'يقوي العظام وتخثر الدم لاحتوائه على نسبة عالية جداً من فيتامين K، ينظم ضغط الدم بسبب البوتاسيوم والمغنيسيوم، مضاد أكسدة قوي، يحسن الهضم، مفيد لمرضى السكري لانخفاض سعراته، يعزز المناعة، يحمي النظر، يساعد على فقدان الوزن.',
  'مرضى حصى الكلى بسبب احتوائه على الأوكسالات، مرضى سيولة الدم الذين يتناولون الوارفارين بسبب فيتامين K العالي، مرضى القولون عند الإكثار نيئاً، من لديهم حساسية من النباتات القطيفية.',
  'محاشي السلق، بخنة السلق بالحمص، مقلي مع البصل وزيت الزيتون، مع العدس، في الحساء، في الفطائر والمعجنات، مطبوخ مع الأرز، سلطة سلق مسلوقة بالليمون.',
  'منطقة البحر الأبيض المتوسط (صقلية)، ينتمي لعائلة الشمندر، يزرع حالياً في إيطاليا وفرنسا وسوريا ولبنان ومصر.',
  'يحفظ طازجاً في الثلاجة 4 إلى 5 أيام ملفوفاً بمنشفة ورقية رطبة داخل كيس، يغسل عند الاستخدام فقط، يمكن تجميده بعد سلقه 2 دقيقة لمدة 10 إلى 12 شهراً، لا يترك في حرارة الغرفة أكثر من ساعتين.',
  null
) on conflict (lower(trim(name))) do update set
  name_en = excluded.name_en,
  classification = excluded.classification,
  nutrition_per_100g = excluded.nutrition_per_100g,
  calories_per_100g = excluded.calories_per_100g,
  fiber_per_100g = excluded.fiber_per_100g,
  vitamins_minerals = excluded.vitamins_minerals,
  health_benefits = excluded.health_benefits,
  warnings = excluded.warnings,
  uses = excluded.uses,
  origin = excluded.origin,
  storage_method = excluded.storage_method;
