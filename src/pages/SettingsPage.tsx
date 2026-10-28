import React, { useEffect, useState } from 'react';
import {
  Settings,
  HardDrive,
  ShieldCheck,
  Folder,
  ArrowRight,
  Upload,
  Trash2,
  Copy,
  RefreshCw,
} from 'lucide-react';
import type { AppSettingsRow } from '../types/database';
import {
  CATALOG_BUCKET,
  checkServerAdminApi,
  supabase,
  SUPABASE_URL,
  uploadCatalogMedia,
} from '../lib/supabase';
import { useToast } from '../components/ToastContext';

interface StorageEntry {
  name: string;
  id: string | null;
  created_at?: string;
  metadata?: { size?: number; mimetype?: string } | null;
}

export function SettingsPage({
  settings,
  advertsTableReady,
  authRpcReady,
  onReload,
}: {
  settings: AppSettingsRow | null;
  advertsTableReady: boolean;
  authRpcReady: boolean;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [tab, setTab] = useState<'platform' | 'storage' | 'diagnostics'>('platform');

  // Platform settings form
  const [form, setForm] = useState({
    auto_approve_stores: settings?.auto_approve_stores ?? true,
    maintenance_mode: settings?.maintenance_mode ?? false,
    announcement_banner: settings?.announcement_banner ?? '',
    app_version_name: settings?.app_version_name ?? '1.0.0',
    app_build_number: String(settings?.app_build_number ?? 1),
    force_update: settings?.force_update ?? false,
    update_url: settings?.update_url ?? '',
    android_url: settings?.android_url ?? '',
    ios_url: settings?.ios_url ?? '',
    support_phone: settings?.support_phone ?? '',
    support_whatsapp: settings?.support_whatsapp ?? '',
    support_email: settings?.support_email ?? '',
    website_url: settings?.website_url ?? '',
    billing_instructions: settings?.billing_instructions ?? '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Storage browser state
  const [currentPrefix, setCurrentPrefix] = useState<string>('');
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Diagnostics
  const [serverApiReady, setServerApiReady] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        auto_approve_stores: Boolean(settings.auto_approve_stores),
        maintenance_mode: Boolean(settings.maintenance_mode),
        announcement_banner: settings.announcement_banner || '',
        app_version_name: settings.app_version_name || '1.0.0',
        app_build_number: String(settings.app_build_number ?? 1),
        force_update: Boolean(settings.force_update),
        update_url: settings.update_url || '',
        android_url: settings.android_url || '',
        ios_url: settings.ios_url || '',
        support_phone: settings.support_phone || '',
        support_whatsapp: settings.support_whatsapp || '',
        support_email: settings.support_email || '',
        website_url: settings.website_url || '',
        billing_instructions: settings.billing_instructions || '',
      });
    }
  }, [settings]);

  useEffect(() => {
    checkServerAdminApi().then(setServerApiReady);
  }, []);

  const loadStorageFolder = async (prefix: string) => {
    setLoadingStorage(true);
    try {
      const { data, error } = await supabase.storage
        .from(CATALOG_BUCKET)
        .list(prefix || undefined, {
          limit: 200,
          sortBy: { column: 'name', order: 'asc' },
        });
      if (error) throw error;
      setEntries((data as StorageEntry[]) || []);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر قراءة ملفات التخزين', 'error');
    } finally {
      setLoadingStorage(false);
    }
  };

  useEffect(() => {
    if (tab === 'storage') {
      loadStorageFolder(currentPrefix);
    }
  }, [tab, currentPrefix]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const extPayload = {
        id: true,
        auto_approve_stores: form.auto_approve_stores,
        maintenance_mode: form.maintenance_mode,
        announcement_banner: form.announcement_banner.trim() || null,
        app_version_name: form.app_version_name.trim() || '1.0.0',
        app_build_number: Number(form.app_build_number || 1),
        force_update: form.force_update,
        update_url: form.update_url.trim() || null,
        android_url: form.android_url.trim() || null,
        ios_url: form.ios_url.trim() || null,
        support_phone: form.support_phone.trim() || null,
        support_whatsapp: form.support_whatsapp.trim() || null,
        support_email: form.support_email.trim() || null,
        website_url: form.website_url.trim() || null,
        billing_instructions: form.billing_instructions.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('app_settings').upsert(extPayload);
      if (error) {
        if (error.message.includes('column')) {
          const { error: fbErr } = await supabase.from('app_settings').upsert({
            id: true,
            auto_approve_stores: form.auto_approve_stores,
            updated_at: new Date().toISOString(),
          });
          if (fbErr) throw fbErr;
          notify(
            'تم حفظ الاعتماد التلقائي — شغّل ملف 0013 لحفظ بقية حقول التحديث والتواصل المتقدمة'
          );
        } else {
          throw error;
        }
      } else {
        notify('تم حفظ جميع إعدادات المنصة والتطبيق بنجاح');
      }
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ الإعدادات', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStorageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      await uploadCatalogMedia(file, currentPrefix || 'admin/uploads');
      notify('تم رفع الملف بنجاح');
      await loadStorageFolder(currentPrefix);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteStorageFile = async (fileName: string) => {
    const fullPath = currentPrefix ? `${currentPrefix}/${fileName}` : fileName;
    if (!window.confirm(`هل تريد حذف الملف «${fullPath}» نهائياً من التخزين السحابي؟`)) return;
    const { error } = await supabase.storage.from(CATALOG_BUCKET).remove([fullPath]);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم حذف الملف من التخزين');
    await loadStorageFolder(currentPrefix);
  };

  const goUpFolder = () => {
    if (!currentPrefix) return;
    const parts = currentPrefix.split('/').filter(Boolean);
    parts.pop();
    setCurrentPrefix(parts.join('/'));
  };

  return (
    <div>
      <div className="tabs-bar">
        <button
          type="button"
          className={`tab-pill ${tab === 'platform' ? 'active' : ''}`}
          onClick={() => setTab('platform')}
        >
          <Settings size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
          إعدادات المنصة والتحديثات والتواصل
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'storage' ? 'active' : ''}`}
          onClick={() => setTab('storage')}
        >
          <HardDrive size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
          متصفح ملفات وصور التخزين (catalog)
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setTab('diagnostics')}
        >
          <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
          فحص النظام وقاعدة البيانات
        </button>
      </div>

      {/* TAB 1: PLATFORM SETTINGS */}
      {tab === 'platform' && (
        <form onSubmit={handleSaveSettings} className="card card-pad">
          <h3 style={{ marginTop: 0 }}>١. سياسات التشغيل والاعتماد</h3>
          <div className="form-grid" style={{ marginBottom: 22 }}>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.auto_approve_stores}
                  onChange={(e) =>
                    setForm({ ...form, auto_approve_stores: e.target.checked })
                  }
                />
                <strong>الاعتماد التلقائي للمتاجر الجديدة (auto_approve_stores)</strong>
              </label>
              <div className="field-hint" style={{ marginTop: 6 }}>
                عند تفعيله يولد المتجر الجديد بحالة <code>approved</code> فوراً للتجربة. أوقفه عند
                الإطلاق الرسمي ليخضع كل متجر لمراجعة المشرف أولاً.
              </div>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.maintenance_mode}
                  onChange={(e) =>
                    setForm({ ...form, maintenance_mode: e.target.checked })
                  }
                />
                <strong>وضع الصيانة المؤقت (Maintenance Mode)</strong>
              </label>
              <div className="field-hint" style={{ marginTop: 6 }}>
                يُستخدم لإشعار المستخدمين بوجود صيانة مجدولة على الخادم.
              </div>
            </div>

            <div className="col-span-2 field">
              <label>شريط الإعلان الإداري العام (Announcement Banner)</label>
              <input
                type="text"
                className="input"
                placeholder="رسالة عامة تظهر أعلى التطبيق (اتركها فارغة لإخفائها)"
                value={form.announcement_banner}
                onChange={(e) =>
                  setForm({ ...form, announcement_banner: e.target.value })
                }
              />
            </div>
          </div>

          <h3>٢. إصدار التطبيق والتحديث الإجباري («التحقق من وجود تحديث»)</h3>
          <div className="form-grid-3" style={{ marginBottom: 22 }}>
            <div className="field">
              <label>رقم الإصدار الحالي (Version Name)</label>
              <input
                type="text"
                className="input"
                dir="ltr"
                value={form.app_version_name}
                onChange={(e) =>
                  setForm({ ...form, app_version_name: e.target.value })
                }
              />
            </div>

            <div className="field">
              <label>رقم البناء (Build Number)</label>
              <input
                type="number"
                className="input"
                dir="ltr"
                value={form.app_build_number}
                onChange={(e) =>
                  setForm({ ...form, app_build_number: e.target.value })
                }
              />
            </div>

            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.force_update}
                  onChange={(e) =>
                    setForm({ ...form, force_update: e.target.checked })
                  }
                />
                تحديث إجباري للإصدارات الأقدم
              </label>
            </div>

            <div className="field">
              <label>رابط التحميل المباشر / الموقع</label>
              <input
                type="text"
                className="input"
                dir="ltr"
                placeholder="https://..."
                value={form.update_url}
                onChange={(e) => setForm({ ...form, update_url: e.target.value })}
              />
            </div>

            <div className="field">
              <label>رابط Google Play (Android)</label>
              <input
                type="text"
                className="input"
                dir="ltr"
                value={form.android_url}
                onChange={(e) => setForm({ ...form, android_url: e.target.value })}
              />
            </div>

            <div className="field">
              <label>رابط App Store (iOS)</label>
              <input
                type="text"
                className="input"
                dir="ltr"
                value={form.ios_url}
                onChange={(e) => setForm({ ...form, ios_url: e.target.value })}
              />
            </div>
          </div>

          <h3>٣. قنوات «تواصل مع H» وتعليمات تسديد الاشتراكات</h3>
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="field">
              <label>رقم هاتف الدعم الفني</label>
              <input
                type="text"
                className="input"
                dir="ltr"
                value={form.support_phone}
                onChange={(e) =>
                  setForm({ ...form, support_phone: e.target.value })
                }
              />
            </div>

            <div className="field">
              <label>رقم واتساب الدعم والمبيعات</label>
              <input
                type="text"
                className="input"
                dir="ltr"
                value={form.support_whatsapp}
                onChange={(e) =>
                  setForm({ ...form, support_whatsapp: e.target.value })
                }
              />
            </div>

            <div className="field">
              <label>البريد الإلكتروني الرسمي للدعم</label>
              <input
                type="email"
                className="input"
                dir="ltr"
                value={form.support_email}
                onChange={(e) =>
                  setForm({ ...form, support_email: e.target.value })
                }
              />
            </div>

            <div className="field">
              <label>الموقع الرسمي للمنصة</label>
              <input
                type="text"
                className="input"
                dir="ltr"
                value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              />
            </div>

            <div className="col-span-2 field">
              <label>تعليمات التحويل البنكي / الدفع لاشتراكات المتاجر</label>
              <textarea
                rows={3}
                className="textarea"
                value={form.billing_instructions}
                onChange={(e) =>
                  setForm({ ...form, billing_instructions: e.target.value })
                }
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={savingSettings}>
              {savingSettings ? 'جاري الحفظ...' : 'حفظ جميع إعدادات المنصة'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CLOUD STORAGE BROWSER */}
      {tab === 'storage' && (
        <div>
          <div className="toolbar">
            <div className="toolbar-filters">
              {currentPrefix && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={goUpFolder}
                >
                  <ArrowRight size={14} /> رجوع للمجلد الأعلى
                </button>
              )}
              <span style={{ fontWeight: 700, fontSize: 13.5 }} dir="ltr">
                catalog / {currentPrefix || '(الجذر)'}
              </span>
            </div>

            <div className="toolbar-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => loadStorageFolder(currentPrefix)}
              >
                <RefreshCw size={14} /> تحديث
              </button>
              <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                {uploadingFile ? 'جاري الرفع...' : 'رفع صورة إلى هذا المجلد'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  disabled={uploadingFile}
                  onChange={handleStorageUpload}
                />
              </label>
            </div>
          </div>

          <div className="card card-pad">
            {loadingStorage ? (
              <div className="empty-state">جاري تحميل محتويات المجلد...</div>
            ) : entries.length === 0 ? (
              <div className="empty-state">المجلد فارغ</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: 14,
                }}
              >
                {entries.map((en) => {
                  const isFolder = !en.id;
                  const fullPath = currentPrefix ? `${currentPrefix}/${en.name}` : en.name;
                  const publicUrl = !isFolder
                    ? supabase.storage.from(CATALOG_BUCKET).getPublicUrl(fullPath).data
                        .publicUrl
                    : '';

                  if (isFolder) {
                    return (
                      <div
                        key={en.name}
                        onClick={() => setCurrentPrefix(fullPath)}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 12,
                          padding: 16,
                          cursor: 'pointer',
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Folder size={24} color="#eab308" />
                        <div
                          dir="ltr"
                          style={{
                            fontWeight: 700,
                            fontSize: 12.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {en.name}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={en.name}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <img
                        src={publicUrl}
                        alt={en.name}
                        style={{
                          width: '100%',
                          height: 130,
                          objectFit: 'cover',
                          borderRadius: 8,
                          background: '#f1f5f9',
                        }}
                      />
                      <div
                        dir="ltr"
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={en.name}
                      >
                        {en.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl);
                            notify('تم نسخ الرابط العام للصورة');
                          }}
                        >
                          <Copy size={12} /> نسخ الرابط
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteStorageFile(en.name)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DIAGNOSTICS */}
      {tab === 'diagnostics' && (
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>حالة ربط لوحة الإدارة وجاهزية قاعدة البيانات</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10 }}>
              <span>رابط مشروع Supabase</span>
              <strong dir="ltr">{SUPABASE_URL}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10 }}>
              <span>ترحيل التحكم الكامل للمشرفين (0013_admin_full_control.sql)</span>
              {advertsTableReady && authRpcReady ? (
                <span className="badge badge-green">مفعّل بالكامل ✓</span>
              ) : (
                <span className="badge badge-amber">بانتظار تشغيل ملف 0013 في SQL Editor</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10 }}>
              <span>واجهة الخادم السرية على Vercel (/api/admin-auth)</span>
              {serverApiReady ? (
                <span className="badge badge-green">مفعّلة (SUPABASE_SERVICE_ROLE_KEY جاهز) ✓</span>
              ) : (
                <span className="badge badge-slate">اختيارية — تعمل اللوحة مباشرة عبر سياسات RLS</span>
              )}
            </div>
          </div>

          <div className="alert alert-green" style={{ marginBottom: 0 }}>
            لتفعيل كافة الجداول والدوال الإدارية، افتح Supabase SQL Editor ونفّذ محتوى الملف المرفق في
            المشروع: <code dir="ltr">supabase/0013_admin_full_control.sql</code>.
          </div>
        </div>
      )}
    </div>
  );
}
