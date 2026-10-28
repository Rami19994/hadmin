import React, { useMemo, useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Megaphone,
  Search,
  X,
} from 'lucide-react';
import type { AdvertRow, StoreRow } from '../types/database';
import {
  COUNTRIES,
  findCountry,
  formatDateTime,
  toLocalDatetimeInput,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, ImageUploadField, useToast } from '../components/ToastContext';

interface AdvertFormState {
  id?: string;
  store_id: string;
  store_name: string;
  headline: string;
  subline: string;
  image_url: string;
  country_code: string;
  provinces: string[];
  accent_color: string;
  price_paid: string;
  currency: string;
  position: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
}

export function AdvertsPage({
  adverts,
  stores,
  advertsTableReady,
  onReload,
}: {
  adverts: AdvertRow[];
  stores: StoreRow[];
  advertsTableReady: boolean;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdvertFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdvertRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return adverts;
    return adverts.filter((a) =>
      [a.headline, a.subline, a.store_name, ...(a.provinces || [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [adverts, query]);

  const openNew = () => {
    const now = new Date();
    const monthLater = new Date(now.getTime() + 30 * 86400 * 1000);
    const firstStore = stores[0];
    setEditing({
      store_id: firstStore?.id || '',
      store_name: firstStore?.name || '',
      headline: '',
      subline: '',
      image_url: '',
      country_code: firstStore?.country_code || 'SY',
      provinces: [],
      accent_color: '#16A34A',
      price_paid: '50',
      currency: 'USD',
      position: String(adverts.length),
      active: true,
      starts_at: toLocalDatetimeInput(now.toISOString()),
      ends_at: toLocalDatetimeInput(monthLater.toISOString()),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.headline.trim()) {
      notify('يرجى إدخال العنوان الرئيسي للإعلان', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: editing.store_id || null,
        store_name: editing.store_name.trim(),
        headline: editing.headline.trim(),
        subline: editing.subline.trim(),
        image_url: editing.image_url.trim() || null,
        country_code: editing.country_code || null,
        provinces: editing.provinces,
        accent_color: editing.accent_color || '#16A34A',
        price_paid: Number(editing.price_paid || 0),
        currency: editing.currency.trim() || 'USD',
        position: Number(editing.position || 0),
        active: editing.active,
        starts_at: editing.starts_at
          ? new Date(editing.starts_at).toISOString()
          : new Date().toISOString(),
        ends_at: editing.ends_at
          ? new Date(editing.ends_at).toISOString()
          : new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      };

      if (editing.id) {
        const { error } = await supabase
          .from('adverts')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('adverts').insert(payload);
        if (error) throw error;
      }

      notify(editing.id ? 'تم تحديث الحملة الإعلانية' : 'تم نشر الحملة الإعلانية بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ الإعلان', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('adverts')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      notify('تم حذف الإعلان');
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حذف الإعلان', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const selectedCountry = editing ? findCountry(editing.country_code) : undefined;

  return (
    <div>
      {!advertsTableReady && (
        <div className="alert alert-amber">
          جدول <code>public.adverts</code> غير منشأ بعد في قاعدة البيانات. قم بتشغيل ملف{' '}
          <code>0013_admin_full_control.sql</code> من تبويب «الإعدادات وفحص النظام» لتفعيل إعلانات
          الصفحة الرئيسية.
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث بعنوان الإعلان، المتجر، أو المحافظة..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!advertsTableReady}
            onClick={openNew}
          >
            <Plus size={16} /> إنشاء حملة إعلانية جديدة
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>البنر</th>
              <th>العنوان والوصف</th>
              <th>المتجر المعلن</th>
              <th>المحافظات المستهدفة</th>
              <th>قيمة الحجز</th>
              <th>فترة الظهور</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ad) => (
              <tr key={ad.id} className={!ad.active ? 'row-faded' : ''}>
                <td>
                  {ad.image_url ? (
                    <img src={ad.image_url} alt="" className="thumb" />
                  ) : (
                    <div
                      className="thumb-placeholder"
                      style={{ background: ad.accent_color, color: '#fff' }}
                    >
                      <Megaphone size={18} />
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 800 }}>{ad.headline}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{ad.subline}</div>
                </td>
                <td style={{ fontWeight: 700 }}>{ad.store_name || 'إعلان عام'}</td>
                <td>
                  {!ad.provinces || ad.provinces.length === 0 ? (
                    <span className="badge badge-blue">كل المحافظات</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ad.provinces.map((pr) => (
                        <span key={pr} className="badge badge-slate">
                          {pr}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ fontWeight: 700, color: '#15803d' }}>
                  {ad.price_paid} {ad.currency}
                </td>
                <td style={{ fontSize: 12 }}>
                  <div>من: {formatDateTime(ad.starts_at)}</div>
                  <div>إلى: {formatDateTime(ad.ends_at)}</div>
                </td>
                <td>
                  <button
                    type="button"
                    className={`badge ${ad.active ? 'badge-green' : 'badge-slate'}`}
                    style={{ border: 'none', cursor: 'pointer' }}
                    onClick={async () => {
                      await supabase
                        .from('adverts')
                        .update({ active: !ad.active })
                        .eq('id', ad.id);
                      await onReload();
                    }}
                  >
                    {ad.active ? '● مفعّل' : '○ متوقف'}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        setEditing({
                          id: ad.id,
                          store_id: ad.store_id || '',
                          store_name: ad.store_name || '',
                          headline: ad.headline,
                          subline: ad.subline || '',
                          image_url: ad.image_url || '',
                          country_code: ad.country_code || 'SY',
                          provinces: ad.provinces || [],
                          accent_color: ad.accent_color || '#16A34A',
                          price_paid: String(ad.price_paid ?? 0),
                          currency: ad.currency || 'USD',
                          position: String(ad.position ?? 0),
                          active: Boolean(ad.active),
                          starts_at: toLocalDatetimeInput(ad.starts_at),
                          ends_at: toLocalDatetimeInput(ad.ends_at),
                        })
                      }
                    >
                      <Edit3 size={14} /> تعديل
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget(ad)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  لا توجد إعلانات مسجلة بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing.id ? 'تعديل الإعلان' : 'إنشاء حملة إعلانية للصفحة الرئيسية'}</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditing(null)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>ربط بمتجر في التطبيق (اختياري)</label>
                    <select
                      className="select"
                      value={editing.store_id}
                      onChange={(e) => {
                        const st = stores.find((s) => s.id === e.target.value);
                        setEditing({
                          ...editing,
                          store_id: e.target.value,
                          store_name: st ? st.name : editing.store_name,
                          country_code: st?.country_code || editing.country_code,
                        });
                      }}
                    >
                      <option value="">— إعلان عام بدون ربط بمتجر —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>اسم الجهة المعلنة الظاهر على البطاقة</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.store_name}
                      onChange={(e) =>
                        setEditing({ ...editing, store_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>العنوان الرئيسي للإعلان *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editing.headline}
                      onChange={(e) =>
                        setEditing({ ...editing, headline: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>النص الفرعي للإعلان</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.subline}
                      onChange={(e) => setEditing({ ...editing, subline: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الدولة المستهدفة</label>
                    <select
                      className="select"
                      value={editing.country_code}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          country_code: e.target.value,
                          provinces: [],
                        })
                      }
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>لون البطاقة المميز (Accent Color)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={editing.accent_color}
                        onChange={(e) =>
                          setEditing({ ...editing, accent_color: e.target.value })
                        }
                        style={{ width: 46, height: 38, border: 'none', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        className="input"
                        dir="ltr"
                        value={editing.accent_color}
                        onChange={(e) =>
                          setEditing({ ...editing, accent_color: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {selectedCountry && selectedCountry.provinces.length > 0 && (
                    <div className="col-span-2 field">
                      <label>
                        المحافظات المستهدفة (اترك الكل غير محدد للظهور في كافة محافظات{' '}
                        {selectedCountry.name})
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                        {selectedCountry.provinces.map((pr) => {
                          const checked = editing.provinces.includes(pr);
                          return (
                            <label key={pr} className="checkbox-row">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...editing.provinces, pr]
                                    : editing.provinces.filter((x) => x !== pr);
                                  setEditing({ ...editing, provinces: next });
                                }}
                              />
                              {pr}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="field">
                    <label>المبلغ المدفوع للحملة</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={editing.price_paid}
                      onChange={(e) =>
                        setEditing({ ...editing, price_paid: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>عملة الحجز</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.currency}
                      onChange={(e) =>
                        setEditing({ ...editing, currency: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>تاريخ البدء</label>
                    <input
                      type="datetime-local"
                      className="input"
                      dir="ltr"
                      value={editing.starts_at}
                      onChange={(e) =>
                        setEditing({ ...editing, starts_at: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>تاريخ الانتهاء</label>
                    <input
                      type="datetime-local"
                      className="input"
                      dir="ltr"
                      value={editing.ends_at}
                      onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <ImageUploadField
                      label="صورة البنر الإعلاني"
                      value={editing.image_url}
                      onChange={(url) => setEditing({ ...editing, image_url: url })}
                      folderPath="admin/adverts"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.active}
                        onChange={(e) =>
                          setEditing({ ...editing, active: e.target.checked })
                        }
                      />
                      الإعلان نشط ومفعّل للظهور فوراً ضمن نافذته الزمنية
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditing(null)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ الإعلان'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف الحملة الإعلانية"
        message={`هل تريد حذف الإعلان «${deleteTarget?.headline}» نهائياً؟`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
