-- =====================================================================
-- 0020 — صور إضافية للعروض والتخفيضات
-- =====================================================================

alter table public.promotions
  add column if not exists extra_media_urls jsonb not null default '[]'::jsonb;
