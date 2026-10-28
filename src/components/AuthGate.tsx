import React, { useState } from 'react';
import { ShieldCheck, LogOut, KeyRound, Copy, RefreshCw, UserPlus, LogIn } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import type { Profile } from '../types/database';
import { useToast } from './ToastContext';

export function AuthGate({
  session,
  profile,
  loading,
  onRefreshProfile,
  children,
}: {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  onRefreshProfile: () => Promise<void>;
  children: React.ReactNode;
}) {
  const { notify } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div
            className="brand-mark"
            style={{ width: 56, height: 56, fontSize: 28, margin: '0 auto 14px' }}
          >
            H
          </div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>جاري التحقق من جلسة الإدارة...</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
            الاتصال بـ Supabase
          </div>
        </div>
      </div>
    );
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        notify('تم تسجيل الدخول بنجاح');
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        notify('تم إنشاء الحساب! إذا كان تأكيد البريد مفعّلاً فتحقق من بريدك أو سجّل الدخول.');
      }
      await onRefreshProfile();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إتمام المصادقة');
    } finally {
      setBusy(false);
    }
  };

  const handleClaimFirstAdmin = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.rpc('claim_first_admin');
      if (error) throw error;
      notify('تمت ترقية حسابك إلى مشرف عام (Admin) بنجاح!');
      await onRefreshProfile();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر التفعيل التلقائي — تأكد من تشغيل ملف 0013_admin_full_control.sql في SQL Editor أولاً'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <div className="brand-mark" style={{ width: 50, height: 50, fontSize: 25 }}>
              H
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                لوحة الإدارة الشاملة — H-store
              </h1>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                تحكم كامل بالمتاجر، المواد، الفواتير، الاشتراكات، والمستخدمين
              </div>
            </div>
          </div>

          <div className="tabs-bar" style={{ width: '100%', marginBottom: 18 }}>
            <button
              type="button"
              className={`tab-pill ${mode === 'login' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
            >
              <LogIn size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
              تسجيل دخول المشرف
            </button>
            <button
              type="button"
              className={`tab-pill ${mode === 'signup' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
            >
              <UserPlus size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
              إنشاء حساب مشرف جديد
            </button>
          </div>

          {errorMsg && <div className="alert alert-red">{errorMsg}</div>}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label>البريد الإلكتروني</label>
              <input
                type="email"
                className="input"
                dir="ltr"
                required
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label>كلمة المرور</label>
              <input
                type="password"
                className="input"
                dir="ltr"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-yellow"
              style={{ padding: '11px 16px', fontSize: 14.5, marginTop: 4 }}
              disabled={busy}
            >
              <KeyRound size={17} />
              {busy
                ? 'جاري المعالجة...'
                : mode === 'login'
                ? 'دخول إلى لوحة الإدارة'
                : 'تسجيل الحساب والمتابعة'}
            </button>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 14,
              borderTop: '1px solid #e2e8f0',
              fontSize: 11.5,
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
              direction: 'ltr',
            }}
          >
            <span>Supabase Connected</span>
            <span>{SUPABASE_URL.replace('https://', '')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Signed in, check if role === 'admin'
  if (!profile || profile.role !== 'admin' || profile.is_suspended) {
    const userEmail = session.user.email || '';
    const promoteSql = userEmail
      ? `update public.profiles set role = 'admin', trust = 'identified' where id = '${session.user.id}';`
      : `update public.profiles set role = 'admin', trust = 'identified' where id = '${session.user.id}';`;

    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 580 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div
              className="kpi-icon"
              style={{ background: '#fef3c7', color: '#b45309', width: 48, height: 48 }}
            >
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
                تفعيل صلاحية المشرف العام (Admin)
              </h2>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                مسجّل الدخول حالياً بـ: <strong dir="ltr">{userEmail || session.user.id}</strong> (الدور الحالي:{' '}
                <code>{profile?.role || 'غير محدد'}</code>)
              </div>
            </div>
          </div>

          {profile?.is_suspended && (
            <div className="alert alert-red">هذا الحساب موقوف إدارياً.</div>
          )}

          {errorMsg && <div className="alert alert-red">{errorMsg}</div>}

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
              الخيار ١ (تلقائي لأول مشرف حقيقي):
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569', lineHeight: 1.65 }}>
              بعد تشغيل ملف الترحيل <code>0013_admin_full_control.sql</code> في Supabase SQL Editor،
              اضغط الزر أدناه لترقية حسابك فوراً إذا لم يكن هناك مشرف آخر مفعّل بالبريد:
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handleClaimFirstAdmin}
            >
              <ShieldCheck size={16} />
              {busy ? 'جاري الترقية...' : 'تفعيل حسابي كأول مشرف عام الآن'}
            </button>
          </div>

          <div
            style={{
              background: '#0f172a',
              color: '#f8fafc',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13, color: '#ffd400' }}>
                الخيار ٢ (أمر SQL مباشر لترقية هذا الحساب من Supabase SQL Editor):
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(promoteSql);
                  notify('تم نسخ أمر SQL إلى الحافظة');
                }}
              >
                <Copy size={13} />
                نسخ الأمر
              </button>
            </div>
            <pre
              dir="ltr"
              style={{
                margin: 0,
                fontSize: 12,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: '#e2e8f0',
              }}
            >
              {promoteSql}
            </pre>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onRefreshProfile}
              disabled={busy}
            >
              <RefreshCw size={15} />
              تحقّق مرة أخرى بعد الترقية
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={15} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
