import React, { useMemo, useState } from 'react';
import {
  Search,
  ReceiptText,
  Trash2,
  Plus,
  Printer,
  X,
  Check,
  Ban,
  CornerDownLeft,
} from 'lucide-react';
import type {
  DbOrderStatus,
  OrderItemRow,
  OrderRow,
  ProductRow,
  Profile,
  StoreRow,
} from '../types/database';
import {
  formatDateTime,
  formatMoney,
  getPaymentMethodLabel,
  ORDER_STATUS_META,
  PAYMENT_METHODS,
  PRODUCT_UNITS,
  profileDisplayName,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, useToast } from '../components/ToastContext';

function confirmationCodeFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xfffff;
  }
  return String(hash).padStart(6, '0').slice(0, 6);
}

export function OrdersPage({
  orders,
  stores,
  profiles,
  products,
  selectedStoreId,
  onReload,
}: {
  orders: OrderRow[];
  stores: StoreRow[];
  profiles: Profile[];
  products: ProductRow[];
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payFilter, setPayFilter] = useState<string>('all');

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New Order Creation Modal
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    store_id: selectedStoreId || stores[0]?.id || '',
    consumer_id: profiles[0]?.id || '',
    customer_name: '',
    customer_phone: '',
    address: '',
    payment_method: 'cashOnDelivery',
    note: '',
  });

  // Add Item inside active invoice
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('كيلو');
  const [newItemPrice, setNewItemPrice] = useState('0');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemSubOf, setNewItemSubOf] = useState<string>('');

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const effectiveStore = selectedStoreId || storeFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (effectiveStore !== 'all' && o.store_id !== effectiveStore) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (payFilter !== 'all' && o.payment_method !== payFilter) return false;
      if (!q) return true;
      const st = storeMap.get(o.store_id);
      const consumer = profileMap.get(o.consumer_id);
      return [
        o.id,
        o.customer_name || '',
        o.customer_phone || '',
        o.address,
        o.note || '',
        st?.name || '',
        consumer ? profileDisplayName(consumer) : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [orders, effectiveStore, statusFilter, payFilter, query, storeMap, profileMap]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeOrderId) || null,
    [orders, activeOrderId]
  );

  // Editable header draft synced when opening activeOrder
  const [headerDraft, setHeaderDraft] = useState<{
    status: DbOrderStatus;
    customer_name: string;
    customer_phone: string;
    address: string;
    payment_method: string;
    cash_denomination: string;
    vat_percent: string;
    currency: string;
    note: string;
    merchant_note: string;
    rejection_reason: string;
    opened: boolean;
  } | null>(null);

  const openInvoice = (ord: OrderRow) => {
    setActiveOrderId(ord.id);
    setHeaderDraft({
      status: ord.status,
      customer_name: ord.customer_name || '',
      customer_phone: ord.customer_phone || '',
      address: ord.address || '',
      payment_method: ord.payment_method || 'cashOnDelivery',
      cash_denomination:
        ord.cash_denomination !== null && ord.cash_denomination !== undefined
          ? String(ord.cash_denomination)
          : '',
      vat_percent: String(ord.vat_percent ?? 0),
      currency: ord.currency || 'ل.س',
      note: ord.note || '',
      merchant_note: ord.merchant_note || '',
      rejection_reason: ord.rejection_reason || '',
      opened: Boolean(ord.opened),
    });
    setNewItemProductId('');
    setNewItemName('');
    setNewItemPrice('0');
    setNewItemQty('1');
    setNewItemSubOf('');
  };

  const quickStatusChange = async (orderId: string, status: DbOrderStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'approved') patch.approved_at = new Date().toISOString();
    if (status === 'delivered') patch.delivered_at = new Date().toISOString();

    const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(`تم تحديث حالة الفاتورة إلى: ${ORDER_STATUS_META[status].label}`);
    await onReload();
  };

  const handleSaveHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !headerDraft) return;
    setSavingHeader(true);
    try {
      const payload: Record<string, unknown> = {
        status: headerDraft.status,
        customer_name: headerDraft.customer_name.trim() || 'زبون',
        customer_phone: headerDraft.customer_phone.trim() || null,
        address: headerDraft.address.trim(),
        payment_method: headerDraft.payment_method,
        cash_denomination:
          headerDraft.cash_denomination.trim() !== ''
            ? Number(headerDraft.cash_denomination)
            : null,
        vat_percent: Number(headerDraft.vat_percent || 0),
        currency: headerDraft.currency.trim() || activeOrder.currency,
        note: headerDraft.note.trim() || null,
        merchant_note: headerDraft.merchant_note.trim() || null,
        rejection_reason: headerDraft.rejection_reason.trim() || null,
        opened: headerDraft.opened,
      };
      if (headerDraft.status === 'approved' && !activeOrder.approved_at) {
        payload.approved_at = new Date().toISOString();
      }
      if (headerDraft.status === 'delivered' && !activeOrder.delivered_at) {
        payload.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', activeOrder.id);
      if (error) throw error;
      notify('تم حفظ بيانات ترويسة الفاتورة والحالة بنجاح');
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ الفاتورة', 'error');
    } finally {
      setSavingHeader(false);
    }
  };

  const handleUpdateOrderItem = async (
    itemId: string,
    patch: Partial<Pick<OrderItemRow, 'name' | 'unit' | 'unit_price' | 'quantity' | 'unavailable'>>
  ) => {
    const { error } = await supabase
      .from('order_items')
      .update(patch)
      .eq('id', itemId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم تحديث بند الفاتورة');
    await onReload();
  };

  const handleDeleteOrderItem = async (itemId: string) => {
    const { error } = await supabase.from('order_items').delete().eq('id', itemId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم حذف البند من الفاتورة');
    await onReload();
  };

  const handleAddOrderItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !newItemName.trim()) {
      notify('يرجى إدخال اسم المادة المراد إضافتها للفاتورة', 'error');
      return;
    }
    const items = activeOrder.order_items || [];
    const { error } = await supabase.from('order_items').insert({
      order_id: activeOrder.id,
      product_id: newItemProductId || null,
      name: newItemName.trim(),
      unit: newItemUnit.trim() || 'قطعة',
      unit_price: Math.max(0, Number(newItemPrice || 0)),
      quantity: Math.max(0.01, Number(newItemQty || 1)),
      unavailable: false,
      substitute_of: newItemSubOf || null,
      position: items.length,
    });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(newItemSubOf ? 'تمت إضافة البديل على الفاتورة' : 'تمت إضافة البند إلى الفاتورة');
    setNewItemProductId('');
    setNewItemName('');
    setNewItemPrice('0');
    setNewItemQty('1');
    setNewItemSubOf('');
    await onReload();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.store_id || !newOrderForm.consumer_id || !newOrderForm.address.trim()) {
      notify('يرجى تحديد المتجر والمستهلك وعنوان التوصيل', 'error');
      return;
    }
    const st = storeMap.get(newOrderForm.store_id);
    const { data, error } = await supabase
      .from('orders')
      .insert({
        store_id: newOrderForm.store_id,
        consumer_id: newOrderForm.consumer_id,
        status: 'pending',
        payment_method: newOrderForm.payment_method,
        address: newOrderForm.address.trim(),
        customer_name: newOrderForm.customer_name.trim() || 'زبون',
        customer_phone: newOrderForm.customer_phone.trim() || null,
        note: newOrderForm.note.trim() || null,
        currency: st?.currency || 'ل.س',
        vat_percent: st?.vat_enabled ? Number(st.vat_percent || 0) : 0,
      })
      .select('*, order_items(*)')
      .single();

    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم إنشاء الفاتورة بنجاح — يمكنك الآن إضافة بنودها');
    setCreatingOrder(false);
    await onReload();
    if (data) openInvoice(data as OrderRow);
  };

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      notify('تم حذف الفاتورة وجميع بنودها نهائياً');
      if (activeOrderId === deleteTarget.id) setActiveOrderId(null);
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حذف الطلب', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const activeStoreProducts = useMemo(
    () => (activeOrder ? products.filter((p) => p.store_id === activeOrder.store_id) : []),
    [products, activeOrder]
  );

  const invoiceTotals = useMemo(() => {
    if (!activeOrder) return { subtotal: 0, vat: 0, total: 0, original: 0 };
    const items = activeOrder.order_items || [];
    const original = items
      .filter((i) => !i.substitute_of)
      .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
    const subtotal = items
      .filter((i) => !i.unavailable)
      .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
    const vatPct = Number(headerDraft?.vat_percent ?? activeOrder.vat_percent ?? 0);
    const vat = (subtotal * vatPct) / 100;
    return { subtotal, vat, total: subtotal + vat, original };
  }, [activeOrder, headerDraft]);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث برقم الفاتورة، اسم العميل، الهاتف، العنوان، المتجر..."
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
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل حالات الطلب ({orders.length})</option>
            {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
          >
            <option value="all">كل طرق الدفع</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreatingOrder(true)}
          >
            <Plus size={16} /> إنشاء طلب / فاتورة يدوياً
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>رقم الفاتورة / الكود</th>
              <th>المتجر</th>
              <th>العميل والعنوان</th>
              <th>طريقة الدفع</th>
              <th>البنود والإجمالي</th>
              <th>حالة الفاتورة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ord) => {
              const st = storeMap.get(ord.store_id);
              const items = ord.order_items || [];
              const sub = items
                .filter((i) => !i.unavailable)
                .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
              const total = sub * (1 + Number(ord.vat_percent || 0) / 100);
              const stMeta = ORDER_STATUS_META[ord.status] || {
                label: ord.status,
                badgeClass: 'badge-slate',
              };

              return (
                <tr key={ord.id}>
                  <td>
                    <div dir="ltr" style={{ fontWeight: 800 }}>
                      #{ord.id.slice(0, 8)}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      كود التسليم: <strong>{confirmationCodeFor(ord.id)}</strong>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{st?.name || ord.store_id.slice(0, 8)}</td>
                  <td>
                    <div style={{ fontWeight: 800 }}>{ord.customer_name || 'زبون'}</div>
                    {ord.customer_phone && (
                      <div style={{ fontSize: 12, color: '#475569' }} dir="ltr">
                        {ord.customer_phone}
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      {ord.address.slice(0, 48)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {getPaymentMethodLabel(ord.payment_method)}
                    </div>
                    {ord.cash_denomination && (
                      <div style={{ fontSize: 11.5, color: '#b45309' }}>
                        ورقة نقدية: {formatMoney(ord.cash_denomination, ord.currency)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, color: '#15803d' }}>
                      {formatMoney(total, ord.currency)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{items.length} بند</div>
                  </td>
                  <td>
                    <select
                      className="select"
                      style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700 }}
                      value={ord.status}
                      onChange={(e) =>
                        quickStatusChange(ord.id, e.target.value as DbOrderStatus)
                      }
                    >
                      {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge ${stMeta.badgeClass}`}>{stMeta.label}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>
                    {formatDateTime(ord.created_at)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-yellow btn-sm"
                        onClick={() => openInvoice(ord)}
                      >
                        <ReceiptText size={14} /> الفاتورة والبنود
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(ord)}
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
                  لا توجد طلبات مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Manual Order Modal */}
      {creatingOrder && (
        <div className="modal-backdrop" onClick={() => setCreatingOrder(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>إنشاء طلب / فاتورة جديدة يدوياً</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setCreatingOrder(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>المتجر *</label>
                    <select
                      className="select"
                      required
                      value={newOrderForm.store_id}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, store_id: e.target.value })
                      }
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
                    <label>حساب المستهلك *</label>
                    <select
                      className="select"
                      required
                      value={newOrderForm.consumer_id}
                      onChange={(e) => {
                        const pr = profileMap.get(e.target.value);
                        setNewOrderForm({
                          ...newOrderForm,
                          consumer_id: e.target.value,
                          customer_name: pr ? profileDisplayName(pr) : '',
                          customer_phone: pr?.phone || '',
                        });
                      }}
                    >
                      <option value="">— اختر المستخدم —</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {profileDisplayName(p)} ({p.phone || p.email || p.id.slice(0, 8)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>اسم العميل على الفاتورة</label>
                    <input
                      type="text"
                      className="input"
                      value={newOrderForm.customer_name}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, customer_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>هاتف العميل</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={newOrderForm.customer_phone}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, customer_phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-span-2 field">
                    <label>عنوان التوصيل *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={newOrderForm.address}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, address: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>طريقة الدفع</label>
                    <select
                      className="select"
                      value={newOrderForm.payment_method}
                      onChange={(e) =>
                        setNewOrderForm({
                          ...newOrderForm,
                          payment_method: e.target.value,
                        })
                      }
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>ملاحظة العميل</label>
                    <input
                      type="text"
                      className="input"
                      value={newOrderForm.note}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, note: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCreatingOrder(false)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary">
                  إنشاء وفتح محرر البنود
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Interactive Invoice & Line-Items Editor Modal */}
      {activeOrder && headerDraft && (
        <div className="modal-backdrop" onClick={() => setActiveOrderId(null)}>
          <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>
                  فاتورة الطلب #{activeOrder.id.slice(0, 8)} — كود التسليم:{' '}
                  {confirmationCodeFor(activeOrder.id)}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  المتجر: {storeMap.get(activeOrder.store_id)?.name || '—'} • أُرسلت:{' '}
                  {formatDateTime(activeOrder.created_at)}
                </div>
              </div>
              <div className="no-print" style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => window.print()}
                >
                  <Printer size={14} /> طباعة
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setActiveOrderId(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Header Form */}
              <form onSubmit={handleSaveHeader} style={{ marginBottom: 22 }}>
                <div className="form-grid-3">
                  <div className="field">
                    <label>حالة الطلب</label>
                    <select
                      className="select"
                      value={headerDraft.status}
                      onChange={(e) =>
                        setHeaderDraft({
                          ...headerDraft,
                          status: e.target.value as DbOrderStatus,
                        })
                      }
                    >
                      {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>اسم العميل</label>
                    <input
                      type="text"
                      className="input"
                      value={headerDraft.customer_name}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, customer_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>هاتف العميل</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={headerDraft.customer_phone}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, customer_phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>طريقة الدفع</label>
                    <select
                      className="select"
                      value={headerDraft.payment_method}
                      onChange={(e) =>
                        setHeaderDraft({
                          ...headerDraft,
                          payment_method: e.target.value,
                        })
                      }
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>فئة الورقة النقدية للزبون (لحساب الباقي)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={headerDraft.cash_denomination}
                      onChange={(e) =>
                        setHeaderDraft({
                          ...headerDraft,
                          cash_denomination: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>نسبة الضريبة المضافة (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={headerDraft.vat_percent}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, vat_percent: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-span-2 field">
                    <label>عنوان التوصيل</label>
                    <input
                      type="text"
                      className="input"
                      value={headerDraft.address}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, address: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>العملة</label>
                    <input
                      type="text"
                      className="input"
                      value={headerDraft.currency}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, currency: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>ملاحظة الزبون</label>
                    <input
                      type="text"
                      className="input"
                      value={headerDraft.note}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, note: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>ملاحظة المتجر</label>
                    <input
                      type="text"
                      className="input"
                      value={headerDraft.merchant_note}
                      onChange={(e) =>
                        setHeaderDraft({
                          ...headerDraft,
                          merchant_note: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>سبب الرفض (إن وجد)</label>
                    <input
                      type="text"
                      className="input"
                      value={headerDraft.rejection_reason}
                      onChange={(e) =>
                        setHeaderDraft({
                          ...headerDraft,
                          rejection_reason: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="no-print" style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingHeader}
                  >
                    <Check size={14} />
                    {savingHeader ? 'جاري الحفظ...' : 'حفظ تعديلات بيانات الفاتورة'}
                  </button>
                </div>
              </form>

              {/* Invoice Line Items Table */}
              <h4 style={{ margin: '0 0 10px' }}>
                بنود الفاتورة والبدائل ({(activeOrder.order_items || []).length})
              </h4>
              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>المادة / البديل</th>
                      <th>الوحدة</th>
                      <th>سعر الوحدة</th>
                      <th>الكمية</th>
                      <th>المجموع</th>
                      <th>التوفر</th>
                      <th className="no-print">إجراءات البند</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeOrder.order_items || [])
                      .slice()
                      .sort((a, b) => (a.position || 0) - (b.position || 0))
                      .map((item) => {
                        const lineTot = item.unavailable
                          ? 0
                          : Number(item.unit_price) * Number(item.quantity);
                        return (
                          <OrderItemEditableRow
                            key={item.id}
                            item={item}
                            currency={headerDraft.currency}
                            lineTotal={lineTot}
                            onSave={(patch) => handleUpdateOrderItem(item.id, patch)}
                            onAddSubstitute={() => {
                              setNewItemSubOf(item.id);
                              setNewItemName(`بديل: ${item.name}`);
                              setNewItemUnit(item.unit);
                            }}
                            onDelete={() => handleDeleteOrderItem(item.id)}
                          />
                        );
                      })}
                    {(activeOrder.order_items || []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          لا توجد بنود في هذه الفاتورة بعد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add New Line Item / Substitute */}
              <form
                onSubmit={handleAddOrderItem}
                className="no-print"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 18,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>
                  {newItemSubOf
                    ? 'إضافة مادة بديلة لبند غير متوفر (Substitute)'
                    : 'إضافة بند جديد إلى الفاتورة'}
                  {newItemSubOf && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ marginRight: 10 }}
                      onClick={() => setNewItemSubOf('')}
                    >
                      إلغاء ربط البديل
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.3fr 1.3fr 0.9fr 0.9fr 0.8fr auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <select
                    className="select"
                    value={newItemProductId}
                    onChange={(e) => {
                      const prod = activeStoreProducts.find((p) => p.id === e.target.value);
                      setNewItemProductId(e.target.value);
                      if (prod) {
                        setNewItemName(prod.name);
                        setNewItemUnit(prod.unit);
                        setNewItemPrice(String(prod.price));
                      }
                    }}
                  >
                    <option value="">— اختر من رف المتجر أو اكتب يدوياً —</option>
                    {activeStoreProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price} / {p.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    className="input"
                    placeholder="اسم المادة *"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />

                  <input
                    type="text"
                    list="order-units-dl"
                    className="input"
                    placeholder="الوحدة"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                  />
                  <datalist id="order-units-dl">
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    dir="ltr"
                    placeholder="السعر"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input"
                    dir="ltr"
                    placeholder="الكمية"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                  />

                  <button type="submit" className="btn btn-primary">
                    <Plus size={15} /> إضافة
                  </button>
                </div>
              </form>

              {/* Invoice Totals Box */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#0f172a',
                  color: '#ffffff',
                  borderRadius: 12,
                  padding: '16px 20px',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>المجموع قبل الضريبة</div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>
                      {formatMoney(invoiceTotals.subtotal, headerDraft.currency)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      الضريبة ({headerDraft.vat_percent || 0}%)
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>
                      {formatMoney(invoiceTotals.vat, headerDraft.currency)}
                    </div>
                  </div>
                  {headerDraft.cash_denomination &&
                    Number(headerDraft.cash_denomination) > invoiceTotals.total && (
                      <div>
                        <div style={{ fontSize: 12, color: '#fde047' }}>
                          الباقي الواجب إرجاعه للزبون
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#fde047' }}>
                          {formatMoney(
                            Number(headerDraft.cash_denomination) - invoiceTotals.total,
                            headerDraft.currency
                          )}
                        </div>
                      </div>
                    )}
                </div>

                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>الإجمالي النهائي المستحق</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#ffd400' }}>
                    {formatMoney(invoiceTotals.total, headerDraft.currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف الفاتورة نهائياً"
        message={`هل أنت متأكد من حذف الطلب #${deleteTarget?.id.slice(0, 8)} وجميع بنوده نهائياً من قاعدة البيانات؟`}
        busy={deleting}
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function OrderItemEditableRow({
  item,
  currency,
  lineTotal,
  onSave,
  onAddSubstitute,
  onDelete,
}: {
  item: OrderItemRow;
  currency: string;
  lineTotal: number;
  onSave: (
    patch: Partial<Pick<OrderItemRow, 'name' | 'unit' | 'unit_price' | 'quantity' | 'unavailable'>>
  ) => Promise<void>;
  onAddSubstitute: () => void;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(String(item.unit_price));
  const [qty, setQty] = useState(String(item.quantity));
  const dirty =
    name !== item.name ||
    unit !== item.unit ||
    Number(price) !== Number(item.unit_price) ||
    Number(qty) !== Number(item.quantity);

  return (
    <tr className={item.unavailable ? 'row-faded' : ''}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {item.substitute_of && (
            <span className="badge badge-amber" title="مادة بديلة">
              <CornerDownLeft size={12} /> بديل
            </span>
          )}
          <input
            type="text"
            className="input"
            style={{
              padding: '4px 8px',
              textDecoration: item.unavailable ? 'line-through' : 'none',
              color: item.unavailable ? '#dc2626' : undefined,
            }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </td>
      <td>
        <input
          type="text"
          className="input"
          style={{ width: 85, padding: '4px 8px' }}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          className="input"
          dir="ltr"
          style={{ width: 95, padding: '4px 8px' }}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          className="input"
          dir="ltr"
          style={{ width: 80, padding: '4px 8px' }}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </td>
      <td style={{ fontWeight: 800 }}>
        {item.unavailable ? (
          <span style={{ color: '#dc2626' }}>غير متوفر (0)</span>
        ) : (
          formatMoney(lineTotal, currency)
        )}
      </td>
      <td>
        <button
          type="button"
          className={`badge ${item.unavailable ? 'badge-red' : 'badge-green'}`}
          style={{ border: 'none', cursor: 'pointer' }}
          onClick={() => onSave({ unavailable: !item.unavailable })}
        >
          {item.unavailable ? 'غير متوفر (خط أحمر)' : 'متوفر'}
        </button>
      </td>
      <td className="no-print">
        <div style={{ display: 'flex', gap: 5 }}>
          {dirty && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                onSave({
                  name: name.trim() || item.name,
                  unit: unit.trim() || item.unit,
                  unit_price: Number(price || 0),
                  quantity: Number(qty || 1),
                })
              }
            >
              <Check size={13} /> حفظ
            </button>
          )}
          {!item.substitute_of && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onAddSubstitute}
              title="اقتراح مادة بديلة لهذا البند"
            >
              + بديل
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onSave({ unavailable: !item.unavailable })}
            title="تبديل حالة عدم التوفر"
          >
            <Ban size={13} />
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
