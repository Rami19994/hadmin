-- =====================================================================
-- 0022 — إضافة صور إضافية متعددة للمادة
-- =====================================================================

alter table public.products
  add column if not exists extra_image_urls jsonb not null default '[]'::jsonb;
