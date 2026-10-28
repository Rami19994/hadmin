import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import type {
  PromotionAfterExpiry,
  PromotionExpiryMode,
  PromotionKind,
  PromotionRow,
  PromotionStatus,
  StoreRow,
} from '../types/database';
import {
  formatDateTime,
  formatMoney,
  PROMOTION_KIND_META,
  PROMOTION_STATUS_META,
  toLocalDatetimeInput,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, ImageUploadField, useToast } from '../components/ToastContext';

interface PromoFormState {
  id?: string;
  store_id: string;
  kind: PromotionKind;
  title: string;
  description: string;
  price: string;
  old_price: string;
  currency: string;
  media_url: string;
  media_type: string;
  artwork_has_prices: boolean;
  expiry_mode: PromotionExpiryMode;
  total_count: string;
  sold_count: string;
  starts_at: string;
  ends_at: string;
  show_remaining: boolean;
  exclusive: boolean;
  max_per_person: string;
  after_expiry: PromotionAfterExpiry;
  status: PromotionStatus;
}

export function PromotionsPage({
  promotions,
  stores,
  selectedStoreId,
  onReload,
}: {
  promotions: PromotionRow[];
  stores: StoreRow[];
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [kindTab, setKindTab] = useState<'all' | PromotionKind>('all');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | PromotionStatus>('all');
  const [query, setQuery] = useState('');

  const [editing, setEditing] = useState<PromoFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromotionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const effectiveStore = selectedStoreId || storeFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return promotions.filter((p) => {
      if (effectiveStore !== 'all' && p.store_id !== effectiveStore) return false;
      if (kindTab !== 'all' && p.kind !== kindTab) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      const st = storeMap.get(p.store_id);
      return [p.title || '', p.description || '', st?.name || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [promotions, effectiveStore, kindTab, statusFilter, query, storeMap]);

  const openNew = (defaultKind: PromotionKind = 'offer') => {
    const stId = effectiveStore !== 'all' ? effectiveStore : stores[0]?.id || '';
    const st = storeMap.get(stId);
    const now = new Date();
    const inWeek = new Date(now.getTime() + 7 * 86400 * 1000);
    setEditing({
      store_id: stId,
      kind: defaultKind,
      title: '',
      description: '',
      price: '0',
      old_price: '',
      currency: st?.currency || 'ل.س',
      media_url: '',
      media_type: 'image',
      artwork_has_prices: false,
      expiry_mode: 'date',
      total_count: '',
      sold_count: '0',
      starts_at: toLocalDatetimeInput(now.toISOString()),
      ends_at: toLocalDatetimeInput(inWeek.toISOString()),
      show_remaining: true,
      exclusive: false,
      max_per_person: '',
      after_expiry: 'keepWatermarked',
      status: 'published',
    });
  };

  const openEdit = (p: PromotionRow) => {
    setEditing({
      id: p.id,
      store_id: p.store_id,
      kind: p.kind,
      title: p.title || '',
      description: p.description || '',
      price: String(p.price ?? 0),
      old_price: p.old_price !== null && p.old_price !== undefined ? String(p.old_price) : '',
      currency: p.currency || 'ل.س',
      media_url: p.media_url || '',
      media_type: p.media_type || 'image',
      artwork_has_prices: Boolean(p.artwork_has_prices),
      expiry_mode: p.expiry_mode || 'date',
      total_count: p.total_count !== null && p.total_count !== undefined ? String(p.total_count) : '',
      sold_count: String(p.sold_count ?? 0),
      starts_at: toLocalDatetimeInput(p.starts_at),
      ends_at: toLocalDatetimeInput(p.ends_at),
      show_remaining: Boolean(p.show_remaining),
      exclusive: Boolean(p.exclusive),
      max_per_person:
        p.max_per_person !== null && p.max_per_person !== undefined
          ? String(p.max_per_person)
          : '',
      after_expiry: p.after_expiry || 'keepWatermarked',
      status: p.status || 'published',
    });
  };

  const handleToggleStatus = async (p: PromotionRow) => {
    const next: PromotionStatus = p.status === 'published' ? 'hidden' : 'published';
    const { error } = await supabase
      .from('promotions')
      .update({
        status: next,
        ...(next === 'published' && !p.published_at
          ? { published_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', p.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(next === 'published' ? 'تم نشر العرض للعامة' : 'تم إخفاء العرض');
    await onReload();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.store_id) {
      notify('يرجى اختيار المتجر', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: editing.store_id,
        kind: editing.kind,
        title: editing.title.trim() || null,
        description: editing.description.trim() || null,
        price: Math.max(0, Number(editing.price || 0)),
        old_price: editing.old_price.trim() !== '' ? Number(editing.old_price) : null,
        currency: editing.currency.trim() || storeMap.get(editing.store_id)?.currency || 'ل.س',
        media_url: editing.media_url.trim() || null,
        media_type: editing.media_type || 'image',
        artwork_has_prices: editing.artwork_has_prices,
        expiry_mode: editing.expiry_mode,
        total_count:
          editing.total_count.trim() !== '' ? Number(editing.total_count) : null,
        sold_count: Math.max(0, Number(editing.sold_count || 0)),
        starts_at: editing.starts_at ? new Date(editing.starts_at).toISOString() : null,
        ends_at: editing.ends_at ? new Date(editing.ends_at).toISOString() : null,
        show_remaining: editing.show_remaining,
        exclusive: editing.exclusive,
        max_per_person:
          editing.max_per_person.trim() !== '' ? Number(editing.max_per_person) : null,
        after_expiry: editing.after_expiry,
        status: editing.status,
        published_at:
          editing.status === 'published' ? new Date().toISOString() : null,
      };

      if (editing.id) {
        const { error } = await supabase
          .from('promotions')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('promotions').insert(payload);
        if (error) throw error;
      }

      notify(editing.id ? 'تم حفظ تعديلات العرض/التخفيض' : 'تم إنشاء العرض/التخفيض بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      notify('تم حذف العرض/التخفيض نهائياً');
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الحذف', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="tabs-bar">
        <button
          type="button"
          className={`tab-pill ${kindTab === 'all' ? 'active' : ''}`}
          onClick={() => setKindTab('all')}
        >
          الكل ({promotions.length})
        </button>
        <button
          type="button"
          className={`tab-pill ${kindTab === 'offer' ? 'active' : ''}`}
          onClick={() => setKindTab('offer')}
        >
          العروض ({promotions.filter((p) => p.kind === 'offer').length})
        </button>
        <button
          type="button"
          className={`tab-pill ${kindTab === 'discount' ? 'active' : ''}`}
          onClick={() => setKindTab('discount')}
        >
          التخفيضات ({promotions.filter((p) => p.kind === 'discount').length})
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث بعنوان العرض أو الوصف أو المتجر..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {!selectedStoreId && (
            <select
              className="select"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="all">كل المتاجر</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | PromotionStatus)}
          >
            <option value="all">كل الحالات</option>
            <option value="published">منشور</option>
            <option value="draft">مسودة</option>
            <option value="hidden">مخفي</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-yellow"
            onClick={() => openNew('offer')}
          >
            <Plus size={16} /> إضافة عرض جديد
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openNew('discount')}
          >
            <Plus size={16} /> إضافة تخفيض جديد
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>النوع والعنوان</th>
              <th>المتجر</th>
              <th>السعر والخصم</th>
              <th>الانتهاء / الكمية المباعة</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const st = storeMap.get(p.store_id);
              const kindMeta = PROMOTION_KIND_META[p.kind];
              const stMeta = PROMOTION_STATUS_META[p.status] || PROMOTION_STATUS_META.draft;
              const pct =
                p.old_price && p.old_price > p.price
                  ? Math.round(((p.old_price - p.price) / p.old_price) * 100)
                  : null;

              return (
                <tr key={p.id}>
                  <td>
                    {p.media_url ? (
                      <img src={p.media_url} alt="" className="thumb" />
                    ) : (
                      <div className="thumb-placeholder">إعلان</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 4 }}>
                      <span className={`badge ${kindMeta.badgeClass}`}>{kindMeta.label}</span>
                      {p.exclusive && <span className="badge badge-purple">حصري</span>}
                    </div>
                    <div style={{ fontWeight: 800 }}>{p.title || '(صورة إعلانية بدون عنوان)'}</div>
                    {p.description && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {p.description.slice(0, 60)}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{st?.name || '—'}</td>
                  <td>
                    <div style={{ fontWeight: 800, color: '#15803d' }}>
                      {formatMoney(p.price, p.currency)}
                    </div>
                    {p.old_price && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        <s>{formatMoney(p.old_price, p.currency)}</s>{' '}
                        {pct !== null && (
                          <span className="badge badge-red">خصم {pct}%</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {p.expiry_mode === 'count' ? (
                      <div>
                        مباع: <strong>{p.sold_count}</strong> / {p.total_count ?? '∞'}
                      </div>
                    ) : (
                      <div>ينتهي: {formatDateTime(p.ends_at)}</div>
                    )}
                    {p.max_per_person && (
                      <div style={{ color: '#64748b' }}>حد الفرد: {p.max_per_person}</div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${stMeta.badgeClass}`}>{stMeta.label}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleToggleStatus(p)}
                      >
                        {p.status === 'published' ? (
                          <>
                            <EyeOff size={14} /> إخفاء
                          </>
                        ) : (
                          <>
                            <Eye size={14} /> نشر
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(p)}
                      >
                        <Edit3 size={14} /> تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  لا توجد عروض أو تخفيضات مطابقة
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
              <h3>
                {editing.id
                  ? 'تعديل العرض / التخفيض'
                  : editing.kind === 'offer'
                  ? 'إنشاء عرض جديد'
                  : 'إنشاء تخفيض جديد'}
              </h3>
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
                    <label>المتجر *</label>
                    <select
                      className="select"
                      required
                      value={editing.store_id}
                      onChange={(e) => {
                        const st = storeMap.get(e.target.value);
                        setEditing({
                          ...editing,
                          store_id: e.target.value,
                          currency: st?.currency || editing.currency,
                        });
                      }}
                    >
                      <option value="">— اختر المتجر —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>النوع</label>
                    <select
                      className="select"
                      value={editing.kind}
                      onChange={(e) =>
                        setEditing({ ...editing, kind: e.target.value as PromotionKind })
                      }
                    >
                      <option value="offer">عرض (قسم العروض)</option>
                      <option value="discount">تخفيض (قسم التخفيضات)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>العنوان</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>حالة النشر</label>
                    <select
                      className="select"
                      value={editing.status}
                      onChange={(e) =>
                        setEditing({ ...editing, status: e.target.value as PromotionStatus })
                      }
                    >
                      <option value="published">منشور (Published)</option>
                      <option value="draft">مسودة (Draft)</option>
                      <option value="hidden">مخفي (Hidden)</option>
                    </select>
                  </div>

                  <div className="col-span-2 field">
                    <label>الوصف والتفاصيل</label>
                    <textarea
                      rows={2}
                      className="textarea"
                      value={editing.description}
                      onChange={(e) =>
                        setEditing({ ...editing, description: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>السعر الحالي بعد العرض ({editing.currency}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      dir="ltr"
                      required
                      value={editing.price}
                      onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>السعر القديم قبل الخصم (اختياري — يحسب النسبة تلقائياً)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      dir="ltr"
                      value={editing.old_price}
                      onChange={(e) => setEditing({ ...editing, old_price: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>آلية انتهاء العرض</label>
                    <select
                      className="select"
                      value={editing.expiry_mode}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          expiry_mode: e.target.value as PromotionExpiryMode,
                        })
                      }
                    >
                      <option value="date">ينتهي بتاريخ ووقت محدد</option>
                      <option value="count">ينتهي بنفاد الكمية المحددة</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>بعد انتهاء العرض</label>
                    <select
                      className="select"
                      value={editing.after_expiry}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          after_expiry: e.target.value as PromotionAfterExpiry,
                        })
                      }
                    >
                      <option value="keepWatermarked">إبقاء بختم «انتهى العرض»</option>
                      <option value="delete">إخفاء/حذف تلقائي</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>تاريخ البدء</label>
                    <input
                      type="datetime-local"
                      className="input"
                      dir="ltr"
                      value={editing.starts_at}
                      onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })}
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

                  <div className="field">
                    <label>الكمية الكلية المتاحة (total_count)</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.total_count}
                      onChange={(e) =>
                        setEditing({ ...editing, total_count: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>العدد المباع حتى الآن (sold_count)</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.sold_count}
                      onChange={(e) => setEditing({ ...editing, sold_count: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الحد الأقصى للشخص الواحد (اختياري)</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.max_per_person}
                      onChange={(e) =>
                        setEditing({ ...editing, max_per_person: e.target.value })
                      }
                    />
                  </div>

                  <div className="field" style={{ justifyContent: 'center', gap: 8 }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.exclusive}
                        onChange={(e) =>
                          setEditing({ ...editing, exclusive: e.target.checked })
                        }
                      />
                      شارة «عرض حصري»
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.show_remaining}
                        onChange={(e) =>
                          setEditing({ ...editing, show_remaining: e.target.checked })
                        }
                      />
                      إظهار عداد الكمية المتبقية
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.artwork_has_prices}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            artwork_has_prices: e.target.checked,
                          })
                        }
                      />
                      الصورة تتضمن السعر مسبقاً
                    </label>
                  </div>

                  <div className="col-span-2">
                    <ImageUploadField
                      label="صورة العرض / التخفيض (تظهر في البطاقة وفي السلة)"
                      value={editing.media_url}
                      onChange={(url) => setEditing({ ...editing, media_url: url })}
                      folderPath={`${editing.store_id || 'admin'}/promotions`}
                    />
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
                  {saving ? 'جاري الحفظ...' : 'حفظ العرض / التخفيض'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف العرض / التخفيض"
        message={`هل تريد حذف «${deleteTarget?.title || 'هذا الإعلان'}» نهائياً؟`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

