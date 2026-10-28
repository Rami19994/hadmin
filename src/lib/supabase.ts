import { createClient } from '@supabase/supabase-js';

/**
 * الربط الحصري بمشروع Supabase الرسمي للمنصة:
 * Account: aitch.aitchstore@gmail.com's Project
 * Project Ref: ffoeosleputnezuafpcu
 */
export const SUPABASE_ACCOUNT_EMAIL = 'aitch.aitchstore@gmail.com';
export const SUPABASE_PROJECT_REF = 'ffoeosleputnezuafpcu';
export const SUPABASE_URL = 'https://ffoeosleputnezuafpcu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_XdzT2i_YcRcUQ1SLdCkazw_CgNoF5gU';

export const CATALOG_BUCKET = 'catalog';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * يرفع صورة أو ملف وسائط إلى دلو `catalog` ويعيد الرابط العام والمسار.
 */
export async function uploadCatalogMedia(
  file: File,
  folderPath: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeFolder = folderPath.replace(/^\/+|\/+$/g, '') || 'admin/uploads';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'jpg'}`;
  const storagePath = `${safeFolder}/${fileName}`;

  const { error } = await supabase.storage.from(CATALOG_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });

  if (error) {
    throw new Error(`فشل رفع الصورة: ${error.message}`);
  }

  const { data } = supabase.storage.from(CATALOG_BUCKET).getPublicUrl(storagePath);
  return {
    publicUrl: data.publicUrl,
    storagePath,
  };
}

/**
 * يفحص ما إذا كان مسار Vercel API المزود بـ SUPABASE_SERVICE_ROLE_KEY مفعّلاً.
 */
export async function checkServerAdminApi(): Promise<boolean> {
  try {
    const resp = await fetch('/api/admin-auth', { method: 'GET' });
    if (!resp.ok) return false;
    const json = await resp.json();
    return Boolean(json?.configured);
  } catch {
    return false;
  }
}

/**
 * يستدعي وظيفة `/api/admin-auth` على الخادم مرفقة برمز جلسة المشرف الحالي.
 */
export async function callServerAdminApi<T = Record<string, unknown>>(
  payload: Record<string, unknown>
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('لا توجد جلسة مصادقة نشطة');
  }

  const resp = await fetch('/api/admin-auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.error || `خطأ خادم (${resp.status})`);
  }
  return json as T;
}
