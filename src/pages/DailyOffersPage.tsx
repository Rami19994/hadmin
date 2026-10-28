import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Clock,
  X,
} from 'lucide-react';
import type { DailyOfferRow, ProductRow, StoreRow } from '../types/database';
import {
  formatDateTime,
  formatMoney,
  toLocalDatetimeInput,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, ImageUploadField, useToast } from '../components/ToastContext';

interface DailyFormState {
  id?: string;
  store_id: string;
  product_id: string;
  title: string;
  price: string;
  old_price: string;
  image_url: string;
  note: string;
  expires_at: string;
}

export function DailyOffersPage({
  dailyOffers,
  products,
  stores,
  selectedStoreId,
  onReload,
}: {
  dailyOffers: DailyOfferRow[];
  products: ProductRow[];
  stores: StoreRow[];
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId || 'all');
  const [stateFilter, setStateFilter] = useState<'all' | 'live' | 'expired'>('all');

  const [editing, setEditing] = useState<DailyFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DailyOfferRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const effectiveStore = selectedStoreId || storeFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return dailyOffers.filter((d) => {
      if (effectiveStore !== 'all' && d.store_id !== effectiveStore) return false;
      const live = new Date(d.expires_at).getTime() > now;
      if (stateFilter === 'live' && !live) return false;
      if (stateFilter === 'expired' && live) return false;
      if (!q) return true;
      const st = storeMap.get(d.store_id);
      return [d.title, d.note || '', st?.name || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [dailyOffers, effectiveStore, stateFilter, query, storeMap]);

  const handleExtend24h = async (offer: DailyOfferRow) => {
    const { error } = await supabase.rpc('extend_daily_offer', { offer: offer.id });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(`تم تمديد «${offer.title}» لمدة ٢٤ ساعة إضافية`);
    await onReload();
  };

  const handleDeleteAllExpired = async () => {
    const expiredIds = filtered
      .filter((d) => new Date(d.expires_at).getTime() <= Date.now())
      .map((d) => d.id);
    if (expiredIds.length === 0) {
      notify('لا توجد عروض يومية منتهية لحذفها');
      return;
    }
    if (!window.confirm(`هل تريد حذف ${expiredIds.length} عرض يومي منتهي الصلاحية؟`)) return;
    const { error } = await supabase.from('daily_offers').delete().in('id', expiredIds);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(`تم حذف ${expiredIds.length} عرض يومي منتهي`);
    await onReload();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.store_id || !editing.title.trim()) {
      notify('يرجى تحديد المتجر وعنوان العرض اليومي', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: editing.store_id,
        product_id: editing.product_id || null,
        title: editing.title.trim(),
        price: editing.price.trim() !== '' ? Number(editing.price) : null,
        old_price: editing.old_price.trim() !== '' ? Number(editing.old_price) : null,
        image_url: editing.image_url.trim() || null,
        note: editing.note.trim() || null,
        expires_at: editing.expires_at
          ? new Date(editing.expires_at).toISOString()
          : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      if (editing.id) {
        const { error } = await supabase
          .from('daily_offers')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('daily_offers').insert(payload);
        if (error) throw error;
      }

      notify(editing.id ? 'تم حفظ تعديلات العرض اليومي' : 'تم نشر العرض اليومي بنجاح');
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
        .from('daily_offers')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      notify('تم حذف العرض اليومي');
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الحذف', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const storeProducts = useMemo(
    () => (editing ? products.filter((p) => p.store_id === editing.store_id) : []),
    [products, editing]
  );

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث بعنوان العرض اليومي أو المتجر..."
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
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as 'all' | 'live' | 'expired')}
          >
            <option value="all">الكل (نشط ومنتهي)</option>
            <option value="live">نشط الآن فقط</option>
            <option value="expired">منتهي الصلاحية فقط</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDeleteAllExpired}
          >
            <Trash2 size={15} /> تنظيف المنتهية
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const stId = effectiveStore !== 'all' ? effectiveStore : stores[0]?.id || '';
              const exp = new Date(Date.now() + 24 * 3600 * 1000);
              setEditing({
                store_id: stId,
                product_id: '',
                title: '',
                price: '',
                old_price: '',
                image_url: '',
                note: '',
                expires_at: toLocalDatetimeInput(exp.toISOString()),
              });
            }}
          >
            <Plus size={16} /> نشر عرض ٢٤ ساعة جديد
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>العنوان والملاحظة</th>
              <th>المتجر</th>
              <th>السعر</th>
              <th>نُشر في / ينتهي في</th>
              <th>التمديدات والحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const st = storeMap.get(d.store_id);
              const live = new Date(d.expires_at).getTime() > Date.now();
              return (
                <tr key={d.id} className={!live ? 'row-faded' : ''}>
                  <td>
                    {d.image_url ? (
                      <img src={d.image_url} alt="" className="thumb" />
                    ) : (
                      <div className="thumb-placeholder">٢٤س</div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800 }}>{d.title}</div>
                    {d.note && <div style={{ fontSize: 12, color: '#64748b' }}>{d.note}</div>}
                  </td>
                  <td style={{ fontWeight: 700 }}>{st?.name || '—'}</td>
                  <td>
                    <div style={{ fontWeight: 800, color: '#15803d' }}>
                      {formatMoney(d.price, st?.currency)}
                    </div>
                    {d.old_price && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        <s>{formatMoney(d.old_price, st?.currency)}</s>
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div>نُشر: {formatDateTime(d.published_at)}</div>
                    <div>ينتهي: {formatDateTime(d.expires_at)}</div>
                  </td>
                  <td>
                    <span className={`badge ${live ? 'badge-green' : 'badge-red'}`}>
                      {live ? '● نشط الآن' : 'منتهي الصلاحية'}
                    </span>
                    {d.extended_count > 0 && (
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                        مُمدّد {d.extended_count} مرة
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-yellow btn-sm"
                        onClick={() => handleExtend24h(d)}
                      >
                        <Clock size={13} /> +٢٤ ساعة
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setEditing({
                            id: d.id,
                            store_id: d.store_id,
                            product_id: d.product_id || '',
                            title: d.title,
                            price: d.price !== null ? String(d.price) : '',
                            old_price: d.old_price !== null ? String(d.old_price) : '',
                            image_url: d.image_url || '',
                            note: d.note || '',
                            expires_at: toLocalDatetimeInput(d.expires_at),
                          })
                        }
                      >
                        <Edit3 size={14} /> تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(d)}
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
                  لا توجد عروض يومية مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing.id ? 'تعديل العرض اليومي' : 'نشر عرض يومي جديد (٢٤ ساعة)'}</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditing(null)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>المتجر *</label>
                    <select
                      className="select"
                      required
                      value={editing.store_id}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          store_id: e.target.value,
                          product_id: '',
                        })
                      }
                    >
                      <option value="">— اختر المتجر —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>اختيار مادة من رف المتجر (اختياري — يعبئ البيانات تلقائياً)</label>
                    <select
                      className="select"
                      value={editing.product_id}
                      onChange={(e) => {
                        const prod = storeProducts.find((p) => p.id === e.target.value);
                        if (prod) {
                          setEditing({
                            ...editing,
                            product_id: prod.id,
                            title: prod.name,
                            old_price: String(prod.price),
                            price: String(prod.price),
                            image_url: prod.image_url || editing.image_url,
                          });
                        } else {
                          setEditing({ ...editing, product_id: '' });
                        }
                      }}
                    >
                      <option value="">— عرض مستقل بدون ربط بمادة —</option>
                      {storeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.price})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 field">
                    <label>عنوان العرض اليومي *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>سعر العرض</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={editing.price}
                      onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>السعر السابق (اختياري)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={editing.old_price}
                      onChange={(e) => setEditing({ ...editing, old_price: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>تاريخ ووقت الانتهاء</label>
                    <input
                      type="datetime-local"
                      className="input"
                      dir="ltr"
                      value={editing.expires_at}
                      onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>ملاحظة سريعة</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.note}
                      onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <ImageUploadField
                      label="صورة العرض اليومي"
                      value={editing.image_url}
                      onChange={(url) => setEditing({ ...editing, image_url: url })}
                      folderPath={`${editing.store_id || 'admin'}/daily`}
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
                  {saving ? 'جاري الحفظ...' : 'حفظ العرض اليومي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف العرض اليومي"
        message={`هل تريد حذف العرض اليومي «${deleteTarget?.title}» نهائياً؟`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
