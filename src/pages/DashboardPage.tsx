import React from 'react';
import {
  Store,
  Users,
  ReceiptText,
  DollarSign,
  Package,
  Sparkles,
  BookOpen,
  Megaphone,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import type {
  AdminPageKey,
  AdvertRow,
  CreditAccountRow,
  DailyOfferRow,
  OrderRow,
  ProductRow,
  Profile,
  PromotionRow,
  StoreCategory,
  StoreRow,
  StoreSubscription,
} from '../types/database';
import {
  formatDateTime,
  formatMoney,
  getStoreTypeLabel,
  ORDER_STATUS_META,
  profileDisplayName,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';

export function DashboardPage({
  stores,
  profiles,
  orders,
  subscriptions,
  categories,
  products,
  promotions,
  dailyOffers,
  creditAccounts,
  adverts,
  onNavigate,
  onJumpStore,
  onReload,
}: {
  stores: StoreRow[];
  profiles: Profile[];
  orders: OrderRow[];
  subscriptions: StoreSubscription[];
  categories: StoreCategory[];
  products: ProductRow[];
  promotions: PromotionRow[];
  dailyOffers: DailyOfferRow[];
  creditAccounts: CreditAccountRow[];
  adverts: AdvertRow[];
  onNavigate: (page: AdminPageKey) => void;
  onJumpStore: (storeId: string, page: AdminPageKey) => void;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();

  const pendingStores = stores.filter((s) => s.status === 'pending');
  const approvedStores = stores.filter((s) => s.status === 'approved');
  const suspendedStores = stores.filter((s) => s.status === 'suspended');

  const consumersCount = profiles.filter((p) => p.role === 'consumer').length;
  const merchantsCount = profiles.filter((p) => p.role === 'merchant').length;
  const identifiedCount = profiles.filter((p) => p.trust === 'identified').length;
  const unverifiedWithId = profiles.filter(
    (p) => p.trust === 'basic' && (p.id_photo_url || p.role === 'merchant')
  );

  const liveOrders = orders.filter((o) =>
    ['pending', 'edited', 'approved', 'preparing', 'delivering'].includes(o.status)
  );
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');

  // GMV per currency for delivered + approved orders
  const gmvByCurrency: Record<string, number> = {};
  for (const ord of orders) {
    if (ord.status === 'rejected' || ord.status === 'cancelled') continue;
    const items = ord.order_items || [];
    const sub = items
      .filter((i) => !i.unavailable)
      .reduce((acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0), 0);
    const total = sub * (1 + Number(ord.vat_percent || 0) / 100);
    const cur = ord.currency || '—';
    gmvByCurrency[cur] = (gmvByCurrency[cur] || 0) + total;
  }

  const paidSubsUsd = subscriptions
    .filter((s) => s.payment_status === 'paid')
    .reduce((acc, s) => acc + Number(s.amount || 0), 0);

  const liveDaily = dailyOffers.filter((d) => new Date(d.expires_at).getTime() > Date.now());
  const publishedPromos = promotions.filter((p) => p.status === 'published');
  const pendingCredits = creditAccounts.filter((c) => c.status === 'pending');
  const activeAdverts = adverts.filter((a) => a.active);

  const storeMap = new Map(stores.map((s) => [s.id, s]));

  const quickStoreStatus = async (storeId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('stores').update({ status }).eq('id', storeId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(status === 'approved' ? 'تم اعتماد المتجر بنجاح' : 'تم رفض المتجر');
    await onReload();
  };

  const quickVerifyUser = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ trust: 'identified' })
      .eq('id', userId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم توثيق هوية المستخدم بنجاح');
    await onReload();
  };

  const quickCreditStatus = async (accId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('credit_accounts')
      .update({ status })
      .eq('id', accId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(status === 'approved' ? 'تم اعتماد حساب الائتمان' : 'تم رفض الطلب');
    await onReload();
  };

  return (
    <div>
      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card clickable" onClick={() => onNavigate('stores')}>
          <div>
            <div className="kpi-label">إجمالي المتاجر</div>
            <div className="kpi-value">{stores.length}</div>
            <div className="kpi-sub">
              {approvedStores.length} معتمد • {pendingStores.length} قيد المراجعة •{' '}
              {suspendedStores.length} موقوف
            </div>
          </div>
          <div className="kpi-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Store size={22} />
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigate('subscriptions')}>
          <div>
            <div className="kpi-label">إيرادات اشتراكات المتاجر</div>
            <div className="kpi-value">${paidSubsUsd.toLocaleString('en-US')}</div>
            <div className="kpi-sub">
              {subscriptions.filter((s) => s.payment_status === 'paid').length} اشتراك مدفوع من أصل{' '}
              {subscriptions.length}
            </div>
          </div>
          <div className="kpi-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <DollarSign size={22} />
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigate('orders')}>
          <div>
            <div className="kpi-label">الطلبات والفواتير</div>
            <div className="kpi-value">{orders.length}</div>
            <div className="kpi-sub">
              {liveOrders.length} طلب نشط الآن • {deliveredOrders.length} تم تسليمه
            </div>
          </div>
          <div className="kpi-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <ReceiptText size={22} />
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigate('users')}>
          <div>
            <div className="kpi-label">المستخدمون والحسابات</div>
            <div className="kpi-value">{profiles.length}</div>
            <div className="kpi-sub">
              {consumersCount} مستهلك • {merchantsCount} تاجر • {identifiedCount} موثّق الهوية
            </div>
          </div>
          <div className="kpi-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <Users size={22} />
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigate('products')}>
          <div>
            <div className="kpi-label">المواد والأقسام</div>
            <div className="kpi-value">{products.length}</div>
            <div className="kpi-sub">
              ضمن {categories.length} قسم ({products.filter((p) => p.available).length} متوفر)
            </div>
          </div>
          <div className="kpi-icon" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            <Package size={22} />
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigate('promotions')}>
          <div>
            <div className="kpi-label">العروض والتخفيضات واليومية</div>
            <div className="kpi-value">{publishedPromos.length + liveDaily.length}</div>
            <div className="kpi-sub">
              {publishedPromos.length} عرض/تخفيض منشور • {liveDaily.length} عرض ٢٤ ساعة نشط
            </div>
          </div>
          <div className="kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Sparkles size={22} />
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigate('credit')}>
          <div>
            <div className="kpi-label">دفاتر «على الحساب»</div>
            <div className="kpi-value">{creditAccounts.length}</div>
            <div className="kpi-sub">
              {creditAccounts.filter((c) => c.status === 'approved').length} دفتر فعّال •{' '}
              {pendingCredits.length} بانتظار الموافقة
            </div>
          </div>
          <div className="kpi-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <BookOpen size={22} />
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigate('adverts')}>
          <div>
            <div className="kpi-label">إعلانات الصفحة الرئيسية</div>
            <div className="kpi-value">{activeAdverts.length}</div>
            <div className="kpi-sub">من أصل {adverts.length} حملة إعلانية مسجلة</div>
          </div>
          <div className="kpi-icon" style={{ background: '#fce7f3', color: '#be185d' }}>
            <Megaphone size={22} />
          </div>
        </div>
      </div>

      {/* GMV Breakdown */}
      {Object.keys(gmvByCurrency).length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
            إجمالي قيمة الفواتير النشطة والمسلّمة حسب عملة المتجر
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {Object.entries(gmvByCurrency).map(([cur, val]) => (
              <div
                key={cur}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '10px 16px',
                  minWidth: 160,
                }}
              >
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                  عملة ({cur})
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {formatMoney(val, cur)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Action Queues */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 18,
          marginBottom: 22,
        }}
      >
        {/* Pending Stores */}
        <div className="card card-pad">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800 }}>
              متاجر بانتظار المراجعة والاعتماد ({pendingStores.length})
            </h3>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('stores')}
            >
              كل المتاجر <ArrowLeft size={13} />
            </button>
          </div>

          {pendingStores.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 10px' }}>
              لا توجد متاجر معلّقة بانتظار الموافقة حالياً
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingStores.slice(0, 6).map((st) => (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{st.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {getStoreTypeLabel(st.type)} • {st.country_code || '—'} / {st.province || '—'} •{' '}
                      {st.phone || 'بدون هاتف'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => quickStoreStatus(st.id, 'approved')}
                    >
                      <CheckCircle2 size={14} /> اعتماد
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => quickStoreStatus(st.id, 'rejected')}
                    >
                      <XCircle size={14} /> رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unverified Users / Credit Requests */}
        <div className="card card-pad">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800 }}>
              توثيق الهويات وطلبات «على الحساب» ({unverifiedWithId.length + pendingCredits.length})
            </h3>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('users')}
            >
              إدارة المستخدمين <ArrowLeft size={13} />
            </button>
          </div>

          {unverifiedWithId.length === 0 && pendingCredits.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 10px' }}>
              لا توجد طلبات توثيق أو دفاتر ائتمان معلّقة حالياً
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unverifiedWithId.slice(0, 4).map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                      {profileDisplayName(u)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {u.role === 'merchant' ? 'تاجر' : 'مستهلك'} • {u.phone || u.email || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => quickVerifyUser(u.id)}
                  >
                    <ShieldCheck size={14} /> توثيق الهوية
                  </button>
                </div>
              ))}

              {pendingCredits.slice(0, 4).map((c) => {
                const st = storeMap.get(c.store_id);
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      background: '#fffbeb',
                      borderRadius: 10,
                      border: '1px solid #fde68a',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                        طلب دفتر على الحساب: {c.customer_name || 'زبون'}
                      </div>
                      <div style={{ fontSize: 12, color: '#92400e' }}>
                        لدى متجر: {st?.name || c.store_id.slice(0, 8)} • {c.customer_phone || '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => quickCreditStatus(c.id, 'approved')}
                      >
                        موافقة
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => quickCreditStatus(c.id, 'rejected')}
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Latest Orders Table */}
      <div className="card card-pad">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>أحدث الطلبات والفواتير</h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate('orders')}
          >
            عرض وإدارة كل الطلبات <ArrowLeft size={14} />
          </button>
        </div>

        <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>المتجر</th>
                <th>العميل</th>
                <th>عدد البنود</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o) => {
                const st = storeMap.get(o.store_id);
                const items = o.order_items || [];
                const sub = items
                  .filter((i) => !i.unavailable)
                  .reduce(
                    (acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0),
                    0
                  );
                const total = sub * (1 + Number(o.vat_percent || 0) / 100);
                const stMeta = ORDER_STATUS_META[o.status] || {
                  label: o.status,
                  badgeClass: 'badge-slate',
                };
                return (
                  <tr key={o.id}>
                    <td dir="ltr" style={{ fontWeight: 700 }}>
                      #{o.id.slice(0, 8)}
                    </td>
                    <td>
                      {st ? (
                        <button
                          type="button"
                          onClick={() => onJumpStore(st.id, 'orders')}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#2563eb',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {st.name}
                        </button>
                      ) : (
                        o.store_id.slice(0, 8)
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{o.customer_name || 'زبون'}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }} dir="ltr">
                        {o.customer_phone || ''}
                      </div>
                    </td>
                    <td>{items.length}</td>
                    <td style={{ fontWeight: 800 }}>{formatMoney(total, o.currency)}</td>
                    <td>
                      <span className={`badge ${stMeta.badgeClass}`}>{stMeta.label}</span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {formatDateTime(o.created_at)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onJumpStore(o.store_id, 'orders')}
                      >
                        فتح الفاتورة
                      </button>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    لا توجد طلبات مسجلة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
