import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function CreditConsentPage() {
  const invitation = new URLSearchParams(window.location.search).get('invitation') || '';
  const [details, setDetails] = useState<{ store_name: string; phone: string; status: string; expires_at: string } | null>(null);
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    supabase.functions.invoke('credit-invitations', { body: { action: 'details', invitation_id: invitation } })
      .then(({ data, error }) => {
        if (error || !data?.store_name) { setError('رابط التأكيد غير متاح أو انتهت صلاحيته'); return; }
        setDetails(data);
        setDone(data.status === 'confirmed');
      }).catch(() => setError('تعذر الاتصال، أعد فتح الرابط لاحقاً'));
  }, [invitation]);
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !agreed || !/^\d{6}$/.test(code)) return;
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.functions.invoke('credit-invitations', {
        body: { action: 'confirm', invitation_id: invitation, code },
      });
      if (error) {
        const body = await error.context?.json?.().catch(() => null);
        throw new Error(body?.error || 'تعذر تأكيد الرمز');
      }
      if (!data?.ok) throw new Error(data?.error || 'رمز التأكيد غير صحيح');
      setDone(true); setCode('');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر التأكيد'); }
    finally { setBusy(false); }
  };
  return <main dir="rtl" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8faf9', padding: 20 }}>
    <section style={{ maxWidth: 450, width: '100%', background: 'white', border: '1px solid #dde3df', borderRadius: 20, padding: 26 }}>
      <h1 style={{ marginTop: 0 }}>موافقتك على فتح دفتر على الحساب</h1>
      {done ? <p role="status">تم تأكيد موافقتك لفتح الدفتر لدى {details?.store_name}. يمكنك متابعة الحساب من تطبيق H-store.</p>
        : <form onSubmit={confirm}>
          {details && <><p>متجر <strong>{details.store_name}</strong> يطلب فتح دفتر على الحساب باسمك.</p>
            <p>أدخل الرمز المرسل إلى هاتفك <span dir="ltr">{details.phone}</span>. لا تعطِ الرمز للتاجر.</p></>}
          <label htmlFor="consent-code">رمز التأكيد</label>
          <input id="consent-code" className="input" inputMode="numeric" autoComplete="one-time-code" dir="ltr"
            maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy || !details} required pattern="[0-9]{6}" />
          <label style={{ display: 'flex', gap: 10, margin: '18px 0', lineHeight: 1.8 }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} />
            أوافق على فتح هذا الدفتر لدى المتجر المذكور بعد مراجعة اسمه.
          </label>
          <button className="btn btn-primary" disabled={busy || !details || !agreed || code.length !== 6}>
            {busy ? 'جارٍ التأكيد…' : 'تأكيد موافقتي'}
          </button>
          <p style={{ color: '#666', fontSize: 13 }}>إذا لم تطلب هذه الخدمة، أغلق الصفحة وتجاهل الرسالة. لن يُفتح الدفتر دون التأكيد.</p>
        </form>}
      {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    </section>
  </main>;
}
