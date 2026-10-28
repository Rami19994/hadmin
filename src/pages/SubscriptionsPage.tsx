import React, { useMemo, useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  ImagePlus,
  Award,
  X,
  CheckCircle2,
} from 'lucide-react';
import type {
  PaymentStatus,
  PlanTier,
  StoreRow,
  StoreSubscription,
} from '../types/database';
import {
  formatDateTime,
  PAYMENT_STATUS_META,
  SUBSCRIPTION_PLANS,
  toLocalDatetimeInput,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, useToast } from '../components/ToastContext';

interface SubFormState {
  id?: string;
  store_id: string;
  plan_tier: PlanTier;
  plan_name: string;
  amount: string;
  currency: string;
  duration_months: string;
  payment_method: string;
  payment_reference: string;
  payment_status: PaymentStatus;
  max_images: string;
  starts_at: string;
  expires_at: string;
  syncStoreRow: boolean;
}

function defaultSubForm(firstStoreId = ''): SubFormState {
  const now = new Date();
  const nextYear = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
  return {
    store_id: firstStoreId,
    plan_tier: 'small',
    plan_name: 'خطة المتاجر الصغيرة (50-200 م²)',
    amount: '100',
    currency: 'USD',
    duration_months: '12',
    payment_method: 'admin_grant',
    payment_reference: '',
    payment_status: 'paid',
    max_images: '2000',
    starts_at: toLocalDatetimeInput(now.toISOString()),
    expires_at: toLocalDatetimeInput(nextYear.toISOString()),
    syncStoreRow: true,
  };
}

export function SubscriptionsPage({
  subscriptions,
  stores,
  selectedStoreId,
  onReload,
}: {
  subscriptions: StoreSubscription[];
  stores: StoreRow[];
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId || 'all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [editing, setEditing] = useState<SubFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreSubscription | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [packStoreId, setPackStoreId] = useState<string>(stores[0]?.id || '');
  const [packAmount, setPackAmount] = useState<string>('500');

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      const effectiveStore = selectedStoreId || storeFilter;
      if (effectiveStore !== 'all' && sub.store_id !== effectiveStore) return false;
      if (tierFilter !== 'all' && sub.plan_tier !== tierFilter) return false;
      if (statusFilter !== 'all' && sub.payment_status !== statusFilter) return false;
      if (!q) return true;
      const st = storeMap.get(sub.store_id);
      return [
        st?.name || '',
        sub.plan_name,
        sub.payment_method,
        sub.payment_reference || '',
        sub.id,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [subscriptions, selectedStoreId, storeFilter, tierFilter, statusFilter, query, storeMap]);

  const totalPaidUsd = useMemo(
    () =>
      filtered
        .filter((s) => s.payment_status === 'paid')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [filtered]
  );

  const openEdit = (sub: StoreSubscription) => {
    setEditing({
      id: sub.id,
      store_id: sub.store_id,
      plan_tier: sub.plan_tier,
      plan_name: sub.plan_name,
      amount: String(sub.amount),
      currency: sub.currency || 'USD',
      duration_months: String(sub.duration_months || 12),
      payment_method: sub.payment_method || 'manual',
      payment_reference: sub.payment_reference || '',
      payment_status: sub.payment_status || 'paid',
      max_images: String(sub.max_images || 2000),
      starts_at: toLocalDatetimeInput(sub.starts_at),
      expires_at: toLocalDatetimeInput(sub.expires_at),
      syncStoreRow: true,
    });
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
        plan_tier: editing.plan_tier,
        plan_name: editing.plan_name.trim(),
        amount: Number(editing.amount || 0),
        currency: editing.currency.trim() || 'USD',
        duration_months: Number(editing.duration_months || 12),
        payment_method: editing.payment_method.trim() || 'admin_grant',
        payment_reference: editing.payment_reference.trim() || null,
        payment_status: editing.payment_status,
        max_images: Number(editing.max_images || 2000),
        starts_at: editing.starts_at ? new Date(editing.starts_at).toISOString() : new Date().toISOString(),
        expires_at: editing.expires_at
          ? new Date(editing.expires_at).toISOString()
          : new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
      };

      if (editing.id) {
        const { error } = await supabase
          .from('store_subscriptions')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_subscriptions').insert(payload);
        if (error) throw error;
      }

      if (editing.syncStoreRow) {
        const { error: stErr } = await supabase
          .from('stores')
          .update({
            plan_tier: payload.plan_tier,
            plan_name: payload.plan_name,
            max_images: payload.max_images,
            subscription_price: payload.amount,
            subscription_started_at: payload.starts_at,
            subscription_expires_at: payload.expires_at,
            subscription_status:
              payload.payment_status === 'paid' ? 'active' : 'unpaid',
          })
          .eq('id', payload.store_id);
        if (stErr) throw stErr;
      }

      notify(editing.id ? 'تم تحديث سجل الاشتراك بنجاح' : 'تم تفعيل وتسجيل الاشتراك بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حفظ الاشتراك', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBoostExtraImages = async () => {
    const targetId = selectedStoreId || packStoreId;
    const st = storeMap.get(targetId);
    const delta = Number(packAmount || 0);
    if (!st || !delta) {
      notify('اختر المتجر وعدد الصور الإضافية', 'error');
      return;
    }
    const nextExtra = Math.max(0, Number(st.extra_images || 0) + delta);
    const { error } = await supabase
      .from('stores')
      .update({ extra_images: nextExtra })
      .eq('id', st.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(`تم تحديث الصور الإضافية لمتجر «${st.name}» إلى ${nextExtra} صورة إضافية`);
    await onReload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('store_subscriptions')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      notify('تم حذف سجل الاشتراك');
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
      {/* Plans Reference & Extra Images Booster */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        {SUBSCRIPTION_PLANS.map((plan) => (
          <div key={plan.tier} className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-amber">{plan.areaLabel}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>
                ${plan.priceUsd} / سنة
              </span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 8 }}>{plan.name}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              تشمل حتى <strong>{plan.maxImages.toLocaleString('en-US')}</strong> صورة مرفوعة
            </div>
          </div>
        ))}

        <div className="card card-pad" style={{ background: '#f8fafc' }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
            <ImagePlus size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
            منح حزمة صور إضافية لمتجر (+500 صورة)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!selectedStoreId && (
              <select
                className="select"
                value={packStoreId}
                onChange={(e) => setPackStoreId(e.target.value)}
              >
                <option value="">— اختر المتجر —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (إضافي حالي: {s.extra_images || 0})
                  </option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                className="input"
                dir="ltr"
                style={{ width: 110 }}
                value={packAmount}
                onChange={(e) => setPackAmount(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-yellow"
                style={{ flex: 1 }}
                onClick={handleBoostExtraImages}
              >
                إضافة الحصة فوراً
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث باسم المتجر أو مرجع الدفع..."
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
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
          >
            <option value="all">كل الخطط</option>
            <option value="small">صغيرة ($100)</option>
            <option value="medium">متوسطة ($300)</option>
            <option value="large">كبيرة ($800)</option>
          </select>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل حالات الدفع</option>
            <option value="paid">مدفوع</option>
            <option value="pending">قيد الانتظار</option>
            <option value="failed">فشل الدفع</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <span className="badge badge-green" style={{ padding: '7px 12px', fontSize: 13 }}>
            إجمالي المدفوع: ${totalPaidUsd.toLocaleString('en-US')}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing(defaultSubForm(selectedStoreId || stores[0]?.id || ''))}
          >
            <Plus size={16} />
            منح / تسجيل اشتراك جديد
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>المتجر</th>
              <th>الخطة</th>
              <th>المبلغ والمدة</th>
              <th>حصة الصور</th>
              <th>طريقة ومرجع الدفع</th>
              <th>حالة الدفع</th>
              <th>تاريخ البدء والانتهاء</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sub) => {
              const st = storeMap.get(sub.store_id);
              const payMeta = PAYMENT_STATUS_META[sub.payment_status] || PAYMENT_STATUS_META.paid;
              return (
                <tr key={sub.id}>
                  <td style={{ fontWeight: 800 }}>{st?.name || sub.store_id.slice(0, 8)}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{sub.plan_name}</div>
                    <span className="badge badge-slate">{sub.plan_tier}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, color: '#15803d' }}>
                      {sub.amount} {sub.currency}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      المدة: {sub.duration_months} شهر
                    </div>
                  </td>
                  <td>{sub.max_images.toLocaleString('en-US')} صورة</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{sub.payment_method}</div>
                    {sub.payment_reference && (
                      <div style={{ fontSize: 11.5, color: '#64748b' }} dir="ltr">
                        Ref: {sub.payment_reference}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${payMeta.badgeClass}`}>{payMeta.label}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div>من: {formatDateTime(sub.starts_at)}</div>
                    <div>إلى: {formatDateTime(sub.expires_at)}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {sub.payment_status !== 'paid' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            await supabase
                              .from('store_subscriptions')
                              .update({ payment_status: 'paid' })
                              .eq('id', sub.id);
                            await supabase
                              .from('stores')
                              .update({
                                subscription_status: 'active',
                                subscription_expires_at: sub.expires_at,
                              })
                              .eq('id', sub.store_id);
                            notify('تم تأكيد الدفع وتفعيل اشتراك المتجر');
                            await onReload();
                          }}
                        >
                          <CheckCircle2 size={14} /> تأكيد
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(sub)}
                      >
                        <Edit3 size={14} /> تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(sub)}
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
                <td colSpan={8} className="empty-state">
                  لا توجد سجلات اشتراك مطابقة
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
              <h3>
                <Award size={18} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
                {editing.id ? 'تعديل سجل الاشتراك' : 'تسجيل / منح اشتراك سنوي لمتجر'}
              </h3>
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
                  <div className="col-span-2 field">
                    <label>المتجر *</label>
                    <select
                      className="select"
                      required
                      value={editing.store_id}
                      onChange={(e) => setEditing({ ...editing, store_id: e.target.value })}
                    >
                      <option value="">— اختر المتجر —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.country_code || '—'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>فئة الخطة</label>
                    <select
                      className="select"
                      value={editing.plan_tier}
                      onChange={(e) => {
                        const tier = e.target.value as PlanTier;
                        const found = SUBSCRIPTION_PLANS.find((p) => p.tier === tier);
                        setEditing({
                          ...editing,
                          plan_tier: tier,
                          plan_name: found ? found.name : editing.plan_name,
                          amount: found ? String(found.priceUsd) : editing.amount,
                          max_images: found ? String(found.maxImages) : editing.max_images,
                        });
                      }}
                    >
                      {SUBSCRIPTION_PLANS.map((p) => (
                        <option key={p.tier} value={p.tier}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>اسم الخطة على الإيصال</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.plan_name}
                      onChange={(e) => setEditing({ ...editing, plan_name: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>المبلغ</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={editing.amount}
                      onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>العملة</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.currency}
                      onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>المدة بالأشهر</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.duration_months}
                      onChange={(e) =>
                        setEditing({ ...editing, duration_months: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>حصة الصور المشمولة</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.max_images}
                      onChange={(e) => setEditing({ ...editing, max_images: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>طريقة الدفع</label>
                    <select
                      className="select"
                      value={editing.payment_method}
                      onChange={(e) =>
                        setEditing({ ...editing, payment_method: e.target.value })
                      }
                    >
                      <option value="admin_grant">منح إداري مباشر</option>
                      <option value="cash">نقدي</option>
                      <option value="bank_transfer">حوالة بنكية</option>
                      <option value="card">بطاقة إلكترونية</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>حالة الدفع</label>
                    <select
                      className="select"
                      value={editing.payment_status}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          payment_status: e.target.value as PaymentStatus,
                        })
                      }
                    >
                      <option value="paid">مدفوع (Paid)</option>
                      <option value="pending">بانتظار التأكيد (Pending)</option>
                      <option value="failed">فشل الدفع (Failed)</option>
                    </select>
                  </div>

                  <div className="col-span-2 field">
                    <label>رقم مرجع العملية / ملاحظة الحوالة</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.payment_reference}
                      onChange={(e) =>
                        setEditing({ ...editing, payment_reference: e.target.value })
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
                      onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>تاريخ الانتهاء</label>
                    <input
                      type="datetime-local"
                      className="input"
                      dir="ltr"
                      value={editing.expires_at}
                      onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.syncStoreRow}
                        onChange={(e) =>
                          setEditing({ ...editing, syncStoreRow: e.target.checked })
                        }
                      />
                      مزامنة وتحديث حقول الاشتراك وحصة الصور على سجل المتجر مباشرة
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
                  {saving ? 'جاري الحفظ...' : 'حفظ الاشتراك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف سجل الاشتراك"
        message="هل تريد حذف هذا السجل المالي من جدول اشتراكات المتاجر؟"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
