import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const body = await request.json();
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (body.action === 'details' || body.action === 'confirm') {
      if (!uuid.test(String(body.invitation_id || ''))) return json(400, { error: 'رابط التأكيد غير صحيح' });
      if (body.action === 'details') {
        const { data, error } = await admin.rpc('credit_consent_details', { p_id: body.invitation_id });
        if (error) throw error;
        return data ? json(200, data) : json(404, { error: 'طلب التأكيد غير موجود' });
      }
      if (!/^\d{6}$/.test(String(body.code || ''))) return json(400, { error: 'أدخل الرمز المكوّن من 6 أرقام' });
      const pepper = Deno.env.get('CREDIT_OTP_SECRET');
      if (!pepper || pepper.length < 32) return json(503, { error: 'خدمة تأكيد الهاتف غير مفعّلة حالياً' });
      const hash = await hashCode(body.invitation_id, body.code, pepper);
      const { data, error } = await admin.rpc('confirm_credit_consent', { p_id: body.invitation_id, p_hash: hash });
      if (error) throw error;
      return json(data?.ok ? 200 : 400, data);
    }
    if (body.action !== 'request') return json(400, { error: 'عملية غير معروفة' });
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json(401, { error: 'سجّل الدخول لإضافة حساب مستهلك' });
    const provider = Deno.env.get('CREDIT_SMS_PROVIDER');
    const consentUrl = Deno.env.get('CREDIT_CONSENT_URL');
    const pepper = Deno.env.get('CREDIT_OTP_SECRET');
    if (!provider || !consentUrl || !pepper || pepper.length < 32 || !smsConfigured(provider)) {
      return json(503, { error: 'خدمة رسائل تأكيد الهاتف غير مفعّلة حالياً. لا يمكن فتح الدفتر قبل ربطها.' });
    }
    if (!uuid.test(String(body.store_id || ''))) return json(400, { error: 'اختر المتجر' });
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: invitation, error } = await user.rpc('request_credit_invitation', {
      p_store_id: body.store_id, p_phone: String(body.phone || ''), p_email: String(body.email || ''),
    });
    if (error) return json(400, { error: error.message });
    const code = randomCode();
    const hash = await hashCode(invitation.id, code, pepper);
    const { error: prepareError } = await admin.rpc('prepare_credit_sms', { p_id: invitation.id, p_hash: hash });
    if (prepareError) throw prepareError;
    const link = new URL(consentUrl);
    if (link.protocol !== 'https:') throw new Error('رابط تأكيد الهاتف يجب أن يستخدم HTTPS');
    link.searchParams.set('invitation', invitation.id);
    const message = `متجر ${String(invitation.store_name).slice(0, 70)} يطلب موافقتك لفتح دفتر على الحساب باسمك. ` +
      `رمز الموافقة: ${code}. وافق بنفسك عبر ${link.toString()} . ` +
      'لا ترسل الرمز للتاجر. تجاهل الرسالة إن لم توافق. الرمز صالح 10 دقائق.';
    let sent = false;
    try { await sendSms(provider, invitation.phone, message); sent = true; }
    catch { throw new Error('تعذر إرسال رسالة تأكيد الهاتف، حاول لاحقاً'); }
    finally {
      const { error: finishError } = await admin.rpc('finish_credit_sms', { p_id: invitation.id, p_sent: sent });
      if (finishError) throw finishError;
    }
    return json(201, { id: invitation.id, status: 'sent', expires_at: invitation.expires_at });
  } catch (error) {
    // Do not log the OTP, provider credentials, or full recipient details.
    const message = error instanceof Error ? error.message : 'تعذر إرسال طلب تأكيد الهاتف';
    return json(400, { error: message });
  }
});

function randomCode(): string {
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 4294000000);
  return String(value[0] % 1000000).padStart(6, '0');
}
async function hashCode(id: string, code: string, pepper: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}:${code}:${pepper}`));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function smsConfigured(provider: string): boolean {
  if (provider === 'twilio') return Boolean(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && Deno.env.get('TWILIO_FROM'));
  if (provider === 'vonage') return Boolean(Deno.env.get('VONAGE_API_KEY') && Deno.env.get('VONAGE_API_SECRET') && Deno.env.get('VONAGE_FROM'));
  return false;
}
async function sendSms(provider: string, phone: string, message: string): Promise<void> {
  if (provider === 'twilio') {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST', headers: {
        Authorization: `Basic ${btoa(`${sid}:${Deno.env.get('TWILIO_AUTH_TOKEN')!}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: Deno.env.get('TWILIO_FROM')!, Body: message }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('تعذر إرسال رسالة الهاتف، حاول لاحقاً');
  } else {
    const response = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: Deno.env.get('VONAGE_API_KEY'), api_secret: Deno.env.get('VONAGE_API_SECRET'),
        from: Deno.env.get('VONAGE_FROM'), to: phone.replace('+', ''), text: message, type: 'unicode' }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result.messages?.[0]?.status !== '0') throw new Error('تعذر إرسال رسالة الهاتف، حاول لاحقاً');
  }
}
