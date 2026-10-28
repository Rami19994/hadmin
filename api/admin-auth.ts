import { createClient } from '@supabase/supabase-js';

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: unknown) => void;
  end: () => void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // مربوط حصرياً بمشروع Supabase الرسمي (aitch.aitchstore@gmail.com's Project)
  const supabaseUrl = 'https://ffoeosleputnezuafpcu.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (req.method === 'GET') {
    return res.status(200).json({
      configured: Boolean(serviceRoleKey),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!serviceRoleKey) {
    return res.status(501).json({
      error:
        'مفتاح SUPABASE_SERVICE_ROLE_KEY غير مضاف بعد في متغيرات بيئة Vercel. يمكنك إضافته لتفعيل إنشاء المستخدمين وتعيين كلمات المرور مباشرة.',
      configured: false,
    });
  }

  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] || '' : rawAuth || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'مطلوب رمز جلسة مصادقة صالح' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerErr } = await adminClient.auth.getUser(token);
  if (callerErr || !callerData.user) {
    return res.status(401).json({ error: 'جلسة الدخول غير صالحة أو منتهية' });
  }

  const { data: callerProfile, error: profErr } = await adminClient
    .from('profiles')
    .select('role, is_suspended')
    .eq('id', callerData.user.id)
    .single();

  if (profErr || !callerProfile || callerProfile.role !== 'admin' || callerProfile.is_suspended) {
    return res.status(403).json({ error: 'غير مصرح — هذه العملية متاحة للمشرفين فقط' });
  }

  const body =
    typeof req.body === 'string'
      ? (JSON.parse(req.body || '{}') as Record<string, unknown>)
      : ((req.body || {}) as Record<string, unknown>);
  const action = String(body.action || '');

  try {
    if (action === 'create_user') {
      const {
        email,
        password,
        phone,
        role = 'consumer',
        trust = 'basic',
        first_name_ar,
        last_name_ar,
        first_name_en,
        last_name_en,
        country_code,
        province,
      } = body;

      if (!email || !password || String(password).length < 8) {
        return res
          .status(400)
          .json({ error: 'يرجى إدخال بريد إلكتروني صحيح وكلمة مرور من 8 أحرف على الأقل' });
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: String(email).trim(),
        password: String(password),
        phone: phone ? String(phone).trim() : undefined,
        email_confirm: true,
      });

      if (createErr || !created.user) {
        return res.status(400).json({ error: createErr?.message || 'تعذر إنشاء الحساب' });
      }

      const { error: upsertErr } = await adminClient.from('profiles').upsert({
        id: created.user.id,
        email: String(email).trim(),
        phone: phone ? String(phone).trim() : null,
        role,
        trust,
        first_name_ar: first_name_ar || null,
        last_name_ar: last_name_ar || null,
        first_name_en: first_name_en || null,
        last_name_en: last_name_en || null,
        country_code: country_code || null,
        province: province || null,
      });

      if (upsertErr) {
        return res.status(400).json({ error: upsertErr.message });
      }

      return res.status(200).json({ success: true, user_id: created.user.id });
    }

    if (action === 'update_auth') {
      const { user_id, email, password, phone, confirm_email } = body;
      if (!user_id) {
        return res.status(400).json({ error: 'معرف المستخدم مطلوب' });
      }

      const attrs: Record<string, unknown> = {};
      if (email) attrs.email = String(email).trim();
      if (phone !== undefined) attrs.phone = phone ? String(phone).trim() : '';
      if (password) {
        if (String(password).length < 8) {
          return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
        }
        attrs.password = String(password);
      }
      if (confirm_email) {
        attrs.email_confirm = true;
      }

      const { error: updErr } = await adminClient.auth.admin.updateUserById(
        String(user_id),
        attrs
      );
      if (updErr) {
        return res.status(400).json({ error: updErr.message });
      }

      if (email || phone !== undefined) {
        await adminClient
          .from('profiles')
          .update({
            ...(email ? { email: String(email).trim() } : {}),
            ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
          })
          .eq('id', String(user_id));
      }

      return res.status(200).json({ success: true });
    }

    if (action === 'delete_user') {
      const { user_id } = body;
      if (!user_id) {
        return res.status(400).json({ error: 'معرف المستخدم مطلوب' });
      }
      if (String(user_id) === callerData.user.id) {
        return res.status(400).json({ error: 'لا يمكنك حذف حساب المشرف الحالي' });
      }

      const { error: delErr } = await adminClient.auth.admin.deleteUser(String(user_id));
      if (delErr) {
        return res.status(400).json({ error: delErr.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `عملية غير معروفة: ${action}` });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'حدث خطأ داخلي في الخادم',
    });
  }
}
