import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Ban,
  FolderPlus,
  ExternalLink,
  Package,
  FolderTree,
  ReceiptText,
  X,
  Phone,
  MapPin,
} from 'lucide-react';
import type {
  AdminPageKey,
  PlanTier,
  Profile,
  StorePhoneItem,
  StoreRow,
  StoreStatus,
  SubscriptionStatus,
} from '../types/database';
import {
  COUNTRIES,
  findCountry,
  formatDateTime,
  getStoreTypeLabel,
  LICENCE_TYPES,
  PAYMENT_METHODS,
  profileDisplayName,
  STORE_STATUS_META,
  STORE_TYPES,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS_META,
  toLocalDatetimeInput,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, ImageUploadField, useToast } from '../components/ToastContext';

interface StoreFormState {
  id?: string;
  name: string;
  owner_id: string;
  type: string;
  status: StoreStatus;
  country_code: string;
  province: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  phones: StorePhoneItem[];
  logo_url: string;
  currency: string;
  vat_enabled: boolean;
  vat_percent: string;
  accepted_payments: string[];
  delivers: boolean;
  open_now: boolean;
  plan_tier: PlanTier;
  plan_name: string;
  subscription_status: SubscriptionStatus;
  subscription_price: string;
  max_images: string;
  extra_images: string;
  subscription_expires_at: string;
  licence_type: string;
  licence_number: string;
  licence_url: string;
  bank_account: string;
  admin_note: string;
}

function emptyStoreForm(): StoreFormState {
  return {
    name: '',
    owner_id: '',
    type: 'mini_market',
    status: 'approved',
    country_code: 'SY',
    province: 'دمشق',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    phones: [],
    logo_url: '',
    currency: 'ل.س',
    vat_enabled: false,
    vat_percent: '0',
    accepted_payments: ['cashOnDelivery'],
    delivers: true,
    open_now: true,
    plan_tier: 'small',
    plan_name: 'خطة المتاجر الصغيرة (50-200 م²)',
    subscription_status: 'active',
    subscription_price: '100',
    max_images: '2000',
    extra_images: '0',
    subscription_expires_at: '',
    licence_type: 'commercial',
    licence_number: '',
    licence_url: '',
    bank_account: '',
    admin_note: '',
  };
}

export function StoresPage({
  stores,
  profiles,
  productCountByStore,
  categoryCountByStore,
  orderCountByStore,
  onJumpStore,
  onReload,
}: {
  stores: StoreRow[];
  profiles: Profile[];
  productCountByStore: Record<string, number>;
  categoryCountByStore: Record<string, number>;
  orderCountByStore: Record<string, number>;
  onJumpStore: (storeId: string, page: AdminPageKey) => void;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [editing, setEditing] = useState<StoreFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (countryFilter !== 'all' && s.country_code !== countryFilter) return false;
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (!q) return true;
      const owner = s.owner_id ? profileMap.get(s.owner_id) : null;
      const hay = [
        s.name,
        s.phone,
        s.email,
        s.province,
        s.address,
        s.id,
        s.licence_number,
        owner ? profileDisplayName(owner) : '',
        owner?.email || '',
        owner?.phone || '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [stores, query, statusFilter, countryFilter, typeFilter, profileMap]);

  const openEdit = (row: StoreRow) => {
    setEditing({
      id: row.id,
      name: row.name || '',
      owner_id: row.owner_id || '',
      type: row.type || 'mini_market',
      status: row.status || 'pending',
      country_code: row.country_code || 'SY',
      province: row.province || '',
      address: row.address || '',
      latitude: row.latitude !== null && row.latitude !== undefined ? String(row.latitude) : '',
      longitude: row.longitude !== null && row.longitude !== undefined ? String(row.longitude) : '',
      phone: row.phone || '',
      email: row.email || '',
      phones: Array.isArray(row.phones) ? row.phones : [],
      logo_url: row.logo_url || '',
      currency: row.currency || 'ل.س',
      vat_enabled: Boolean(row.vat_enabled),
      vat_percent: String(row.vat_percent ?? 0),
      accepted_payments:
        Array.isArray(row.accepted_payments) && row.accepted_payments.length > 0
          ? row.accepted_payments
          : ['cashOnDelivery'],
      delivers: row.delivers !== false,
      open_now: row.open_now !== false,
      plan_tier: (row.plan_tier as PlanTier) || 'small',
      plan_name: row.plan_name || 'خطة المتاجر الصغيرة (50-200 م²)',
      subscription_status: (row.subscription_status as SubscriptionStatus) || 'unpaid',
      subscription_price: String(row.subscription_price ?? 100),
      max_images: String(row.max_images ?? 2000),
      extra_images: String(row.extra_images ?? 0),
      subscription_expires_at: toLocalDatetimeInput(row.subscription_expires_at),
      licence_type: row.licence_type || 'commercial',
      licence_number: row.licence_number || '',
      licence_url: row.licence_url || '',
      bank_account: row.bank_account || '',
      admin_note: row.admin_note || '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      notify('يرجى إدخال اسم المتجر', 'error');
      return;
    }
    setSaving(true);
    try {
      const basePayload: Record<string, unknown> = {
        name: editing.name.trim(),
        owner_id: editing.owner_id.trim() || null,
        type: editing.type,
        status: editing.status,
        country_code: editing.country_code || null,
        province: editing.province.trim() || null,
        address: editing.address.trim() || null,
        latitude: editing.latitude.trim() !== '' ? Number(editing.latitude) : null,
        longitude: editing.longitude.trim() !== '' ? Number(editing.longitude) : null,
        phone: editing.phone.trim() || null,
        logo_url: editing.logo_url.trim() || null,
        currency: editing.currency.trim() || 'ل.س',
        vat_enabled: editing.vat_enabled,
        vat_percent: Number(editing.vat_percent || 0),
        accepted_payments: editing.accepted_payments,
        delivers: editing.delivers,
        open_now: editing.open_now,
        plan_tier: editing.plan_tier,
        plan_name: editing.plan_name.trim() || null,
        subscription_status: editing.subscription_status,
        subscription_price: Number(editing.subscription_price || 0),
        max_images: Number(editing.max_images || 2000),
        extra_images: Number(editing.extra_images || 0),
        subscription_expires_at: editing.subscription_expires_at
          ? new Date(editing.subscription_expires_at).toISOString()
          : null,
      };

      const extendedPayload: Record<string, unknown> = {
        ...basePayload,
        email: editing.email.trim() || null,
        phones: editing.phones.filter((p) => p.number.trim() !== ''),
        licence_type: editing.licence_type || null,
        licence_number: editing.licence_number.trim() || null,
        licence_url: editing.licence_url.trim() || null,
        bank_account: editing.bank_account.trim() || null,
        admin_note: editing.admin_note.trim() || null,
      };

      let saveError: Error | null = null;
      if (editing.id) {
        const { error } = await supabase
          .from('stores')
          .update(extendedPayload)
          .eq('id', editing.id);
        if (error) {
          if (error.message.includes('column')) {
            const { error: fallbackErr } = await supabase
              .from('stores')
              .update(basePayload)
              .eq('id', editing.id);
            if (fallbackErr) saveError = fallbackErr;
          } else {
            saveError = error;
          }
        }
      } else {
        const { error } = await supabase.from('stores').insert(extendedPayload);
        if (error) {
          if (error.message.includes('column')) {
            const { error: fallbackErr } = await supabase.from('stores').insert(basePayload);
            if (fallbackErr) saveError = fallbackErr;
          } else {
            saveError = error;
          }
        }
      }

      if (saveError) throw saveError;

      notify(editing.id ? 'تم حفظ تعديلات المتجر بنجاح' : 'تم إنشاء المتجر الجديد بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ المتجر', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (storeId: string, status: StoreStatus) => {
    const { error } = await supabase.from('stores').update({ status }).eq('id', storeId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(`تم تحديث حالة المتجر إلى: ${STORE_STATUS_META[status].label}`);
    await onReload();
  };

  const handleToggleOpenNow = async (store: StoreRow) => {
    const next = !store.open_now;
    const { error } = await supabase
      .from('stores')
      .update({ open_now: next })
      .eq('id', store.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(next ? 'المتجر مفتوح الآن للطلبات' : 'تم وضع المتجر بحالة مغلق مؤقتاً');
    await onReload();
  };

  const handleSeedCategories = async (storeId: string) => {
    const { data, error } = await supabase.rpc('admin_seed_store_categories', {
      p_store_id: storeId,
    });
    if (error) {
      notify(
        `تعذر التعبئة (${error.message}) — تأكد من تطبيق 0012 و 0013 في SQL Editor`,
        'error'
      );
      return;
    }
    notify(`تم فحص وتعبئة الأقسام الإلزامية (أُضيف ${data ?? 0} قسم جديد)`);
    await onReload();
  };

  const handleDeleteStore = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('stores').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      notify(`تم حذف المتجر «${deleteTarget.name}» وجميع توابعه بنجاح`);
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حذف المتجر', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const selectedCountry = editing ? findCountry(editing.country_code) : undefined;

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث باسم المتجر، الهاتف، المالك، المحافظة، الترخيص..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل حالات الاعتماد ({stores.length})</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">معتمد ونشط</option>
            <option value="suspended">موقوف</option>
            <option value="rejected">مرفوض</option>
          </select>

          <select
            className="select"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="all">كل الدول</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>

          <select
            className="select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">كل أنواع المتاجر</option>
            {STORE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing(emptyStoreForm())}
          >
            <Plus size={16} />
            إضافة متجر جديد
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>المتجر</th>
              <th>النوع والمالك</th>
              <th>الموقع والعملة</th>
              <th>الخطة وحصة الصور</th>
              <th>الإحصائيات والروابط</th>
              <th>الحالة والفتح</th>
              <th>إجراءات التحكم</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((st) => {
              const owner = st.owner_id ? profileMap.get(st.owner_id) : null;
              const statusMeta = STORE_STATUS_META[st.status] || STORE_STATUS_META.pending;
              const subMeta =
                SUBSCRIPTION_STATUS_META[
                  (st.subscription_status as SubscriptionStatus) || 'unpaid'
                ] || SUBSCRIPTION_STATUS_META.unpaid;
              const usedImages =
                (productCountByStore[st.id] || 0) + (categoryCountByStore[st.id] || 0);
              const totalQuota = Number(st.max_images || 2000) + Number(st.extra_images || 0);

              return (
                <tr key={st.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {st.logo_url ? (
                        <img src={st.logo_url} alt="" className="thumb" />
                      ) : (
                        <div className="thumb-placeholder">متجر</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{st.name}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }} dir="ltr">
                          {st.phone || 'بدون هاتف'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          أُنشئ: {formatDateTime(st.created_at)}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ fontWeight: 700 }}>{getStoreTypeLabel(st.type)}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      المالك: {owner ? profileDisplayName(owner) : 'غير مربوط'}
                    </div>
                    {st.licence_number && (
                      <div style={{ fontSize: 11.5, color: '#15803d' }}>
                        ترخيص: {st.licence_number}
                      </div>
                    )}
                  </td>

                  <td>
                    <div style={{ fontWeight: 700 }}>
                      {findCountry(st.country_code)?.name || st.country_code || '—'} —{' '}
                      {st.province || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      العملة: <strong>{st.currency}</strong> • الضريبة:{' '}
                      {st.vat_enabled ? `${st.vat_percent}%` : 'معفاه'}
                    </div>
                    {st.latitude !== null && st.longitude !== null && (
                      <a
                        href={`https://www.google.com/maps?q=${st.latitude},${st.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        <MapPin size={12} /> الخريطة <ExternalLink size={11} />
                      </a>
                    )}
                  </td>

                  <td>
                    <div>
                      <span className={`badge ${subMeta.badgeClass}`}>{subMeta.label}</span>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                      {st.plan_tier === 'large'
                        ? 'كبيرة ($800)'
                        : st.plan_tier === 'medium'
                        ? 'متوسطة ($300)'
                        : 'صغيرة ($100)'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      الصور: {usedImages} / {totalQuota}
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onJumpStore(st.id, 'categories')}
                        title="عرض أقسام المتجر"
                      >
                        <FolderTree size={13} /> {categoryCountByStore[st.id] || 0} قسم
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onJumpStore(st.id, 'products')}
                        title="عرض مواد المتجر"
                      >
                        <Package size={13} /> {productCountByStore[st.id] || 0} مادة
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onJumpStore(st.id, 'orders')}
                        title="عرض طلبات المتجر"
                      >
                        <ReceiptText size={13} /> {orderCountByStore[st.id] || 0} طلب
                      </button>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                      <span className={`badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                      <button
                        type="button"
                        className={`badge ${st.open_now ? 'badge-green' : 'badge-slate'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => handleToggleOpenNow(st)}
                      >
                        {st.open_now ? '● مفتوح الآن' : '○ مغلق الآن'}
                      </button>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {st.status !== 'approved' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleQuickStatus(st.id, 'approved')}
                          title="اعتماد المتجر"
                        >
                          <CheckCircle2 size={14} /> اعتماد
                        </button>
                      )}
                      {st.status === 'approved' && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleQuickStatus(st.id, 'suspended')}
                          title="إيقاف مؤقت"
                        >
                          <Ban size={14} /> إيقاف
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleSeedCategories(st.id)}
                        title="تعبئة الأقسام الإلزامية الناقصة"
                      >
                        <FolderPlus size={14} /> الأقسام
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(st)}
                      >
                        <Edit3 size={14} /> تعديل شامل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(st)}
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
                  لا توجد متاجر مطابقة لمعايير البحث الحالية
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Store Modal */}
      {editing && (
        <div className="modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing.id ? `تعديل المتجر: ${editing.name}` : 'إنشاء متجر جديد'}</h3>
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
                {/* 1. البيانات الأساسية */}
                <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>١. الهوية والمالك والحالة</h4>
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div className="field">
                    <label>اسم المتجر *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>نوع المتجر / النشاط</label>
                    <select
                      className="select"
                      value={editing.type}
                      onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                    >
                      {STORE_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} ({t.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>حالة الاعتماد في المنصة</label>
                    <select
                      className="select"
                      value={editing.status}
                      onChange={(e) =>
                        setEditing({ ...editing, status: e.target.value as StoreStatus })
                      }
                    >
                      <option value="approved">معتمد ونشط (Approved)</option>
                      <option value="pending">قيد المراجعة (Pending)</option>
                      <option value="suspended">موقوف مؤقتاً (Suspended)</option>
                      <option value="rejected">مرفوض (Rejected)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>مالك المتجر (حساب المستخدم)</label>
                    <select
                      className="select"
                      value={editing.owner_id}
                      onChange={(e) => setEditing({ ...editing, owner_id: e.target.value })}
                    >
                      <option value="">— بدون ربط / المشرف الحالي —</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {profileDisplayName(p)} ({p.role}) — {p.email || p.phone || p.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>الهاتف الرئيسي للمتجر</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.phone}
                      onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                      placeholder="+963..."
                    />
                  </div>

                  <div className="field">
                    <label>البريد الإلكتروني الخاص بالتقارير والفواتير</label>
                    <input
                      type="email"
                      className="input"
                      dir="ltr"
                      value={editing.email}
                      onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <ImageUploadField
                      label="شعار / صورة واجهة المتجر (Logo)"
                      value={editing.logo_url}
                      onChange={(url) => setEditing({ ...editing, logo_url: url })}
                      folderPath={`${editing.id || 'admin'}/store`}
                    />
                  </div>

                  {/* أرقام هواتف إضافية مسماة */}
                  <div className="col-span-2 field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>أرقام هواتف المتجر الإضافية المسماة (موبايل، أرضي، توصيل...)</label>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            phones: [...editing.phones, { label: 'خدمة التوصيل', number: '' }],
                          })
                        }
                      >
                        <Phone size={13} /> إضافة رقم
                      </button>
                    </div>
                    {editing.phones.map((ph, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="التسمية (مثلاً: قسم التوصيل)"
                          value={ph.label}
                          onChange={(e) => {
                            const next = [...editing.phones];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setEditing({ ...editing, phones: next });
                          }}
                        />
                        <input
                          type="text"
                          className="input"
                          dir="ltr"
                          placeholder="رقم الهاتف"
                          value={ph.number}
                          onChange={(e) => {
                            const next = [...editing.phones];
                            next[idx] = { ...next[idx], number: e.target.value };
                            setEditing({ ...editing, phones: next });
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              phones: editing.phones.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. الموقع والعملة والضريبة */}
                <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>٢. الدولة، الموقع الجغرافي، العملة والضريبة</h4>
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div className="field">
                    <label>الدولة (تُشتق منها العملة تلقائياً)</label>
                    <select
                      className="select"
                      value={editing.country_code}
                      onChange={(e) => {
                        const c = findCountry(e.target.value);
                        setEditing({
                          ...editing,
                          country_code: e.target.value,
                          currency: c ? c.currencySymbol : editing.currency,
                          province: c?.provinces[0] || '',
                        });
                      }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.currencySymbol} / {c.dialCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>المحافظة / المنطقة</label>
                    {selectedCountry && selectedCountry.provinces.length > 0 ? (
                      <select
                        className="select"
                        value={editing.province}
                        onChange={(e) => setEditing({ ...editing, province: e.target.value })}
                      >
                        <option value="">— اختر المحافظة —</option>
                        {selectedCountry.provinces.map((pr) => (
                          <option key={pr} value={pr}>
                            {pr}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input"
                        value={editing.province}
                        onChange={(e) => setEditing({ ...editing, province: e.target.value })}
                        placeholder="اسم المحافظة أو المدينة"
                      />
                    )}
                  </div>

                  <div className="field">
                    <label>عملة التسعير والفواتير في المتجر</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.currency}
                      onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>العنوان التفصيلي</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.address}
                      onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                      placeholder="الشارع، البناء، الطابق..."
                    />
                  </div>

                  <div className="field">
                    <label>خط العرض (Latitude)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      dir="ltr"
                      value={editing.latitude}
                      onChange={(e) => setEditing({ ...editing, latitude: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>خط الطول (Longitude)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      dir="ltr"
                      value={editing.longitude}
                      onChange={(e) => setEditing({ ...editing, longitude: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الضريبة المضافة (VAT %)</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={editing.vat_enabled}
                          onChange={(e) =>
                            setEditing({ ...editing, vat_enabled: e.target.checked })
                          }
                        />
                        تفعيل الضريبة
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="input"
                        style={{ width: 110 }}
                        disabled={!editing.vat_enabled}
                        value={editing.vat_percent}
                        onChange={(e) => setEditing({ ...editing, vat_percent: e.target.value })}
                      />
                      <span>%</span>
                    </div>
                  </div>

                  <div className="field">
                    <label>الحساب البنكي / IBAN (للدفع الإلكتروني)</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.bank_account}
                      onChange={(e) => setEditing({ ...editing, bank_account: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2 field">
                    <label>طرق الدفع المقبولة لدى المتجر</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 4 }}>
                      {PAYMENT_METHODS.map((pm) => {
                        const checked = editing.accepted_payments.includes(pm.id);
                        return (
                          <label key={pm.id} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...editing.accepted_payments, pm.id]
                                  : editing.accepted_payments.filter((x) => x !== pm.id);
                                setEditing({ ...editing, accepted_payments: next });
                              }}
                            />
                            {pm.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="col-span-2" style={{ display: 'flex', gap: 24 }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.delivers}
                        onChange={(e) => setEditing({ ...editing, delivers: e.target.checked })}
                      />
                      يوفر خدمة التوصيل (Delivers)
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.open_now}
                        onChange={(e) => setEditing({ ...editing, open_now: e.target.checked })}
                      />
                      مفتوح الآن لاستقبال الطلبات (Open Now)
                    </label>
                  </div>
                </div>

                {/* 3. الاشتراك وحصة الصور */}
                <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>٣. خطة الاشتراك السنوي وحصة الصور</h4>
                <div className="form-grid-3" style={{ marginBottom: 20 }}>
                  <div className="field">
                    <label>فئة المساحة والخطة</label>
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
                          subscription_price: found
                            ? String(found.priceUsd)
                            : editing.subscription_price,
                          max_images: found ? String(found.maxImages) : editing.max_images,
                        });
                      }}
                    >
                      {SUBSCRIPTION_PLANS.map((p) => (
                        <option key={p.tier} value={p.tier}>
                          {p.name} — ${p.priceUsd} ({p.maxImages} صورة)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>حالة الاشتراك</label>
                    <select
                      className="select"
                      value={editing.subscription_status}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          subscription_status: e.target.value as SubscriptionStatus,
                        })
                      }
                    >
                      <option value="active">نشط (Active)</option>
                      <option value="trial">تجريبي (Trial)</option>
                      <option value="unpaid">غير مدفوع (Unpaid)</option>
                      <option value="expired">منتهي (Expired)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>تاريخ انتهاء الاشتراك</label>
                    <input
                      type="datetime-local"
                      className="input"
                      dir="ltr"
                      value={editing.subscription_expires_at}
                      onChange={(e) =>
                        setEditing({ ...editing, subscription_expires_at: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>سعر الاشتراك ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={editing.subscription_price}
                      onChange={(e) =>
                        setEditing({ ...editing, subscription_price: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>الحد الأساسي للصور (max_images)</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.max_images}
                      onChange={(e) => setEditing({ ...editing, max_images: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الصور الإضافية الممنوحة (extra_images)</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.extra_images}
                      onChange={(e) => setEditing({ ...editing, extra_images: e.target.value })}
                    />
                  </div>
                </div>

                {/* 4. الترخيص والملاحظات الإدارية */}
                <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>٤. توثيق الرخصة وملاحظات الإدارة</h4>
                <div className="form-grid">
                  <div className="field">
                    <label>نوع الترخيص</label>
                    <select
                      className="select"
                      value={editing.licence_type}
                      onChange={(e) => setEditing({ ...editing, licence_type: e.target.value })}
                    >
                      {LICENCE_TYPES.map((lt) => (
                        <option key={lt.id} value={lt.id}>
                          {lt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>رقم السجل / الرخصة</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.licence_number}
                      onChange={(e) => setEditing({ ...editing, licence_number: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <ImageUploadField
                      label="صورة الرخصة التجارية"
                      value={editing.licence_url}
                      onChange={(url) => setEditing({ ...editing, licence_url: url })}
                      folderPath={`${editing.id || 'admin'}/licences`}
                    />
                  </div>

                  <div className="col-span-2 field">
                    <label>ملاحظة داخلية للإدارة فقط (لا تظهر للتاجر ولا للمتسوق)</label>
                    <textarea
                      rows={2}
                      className="textarea"
                      value={editing.admin_note}
                      onChange={(e) => setEditing({ ...editing, admin_note: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={saving}
                  onClick={() => setEditing(null)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : editing.id ? 'حفظ جميع التعديلات' : 'إنشاء المتجر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف المتجر نهائياً"
        message={`هل أنت متأكد من حذف المتجر «${deleteTarget?.name}»؟ سيتم حذف جميع أقسامه ومواده وعروضه واشتراكاته وطلباته بشكل نهائي لا يمكن التراجع عنه.`}
        busy={deleting}
        onConfirm={handleDeleteStore}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
