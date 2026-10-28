import React, { useMemo, useState } from 'react';
import {
  ShoppingBasket,
  Star,
  Heart,
  Trash2,
  Edit3,
  Plus,
  X,
} from 'lucide-react';
import type {
  CartLineItem,
  CartRow,
  FavouriteRow,
  ProductRow,
  Profile,
  ShopperLayoutRow,
  StoreRow,
} from '../types/database';
import {
  formatDateTime,
  formatMoney,
  profileDisplayName,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';

export function CustomerDataPage({
  carts,
  favourites,
  layouts,
  profiles,
  stores,
  products,
  selectedStoreId,
  onReload,
}: {
  carts: CartRow[];
  favourites: FavouriteRow[];
  layouts: ShopperLayoutRow[];
  profiles: Profile[];
  stores: StoreRow[];
  products: ProductRow[];
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [tab, setTab] = useState<'carts' | 'favourites' | 'layouts'>('carts');
  const [editingCart, setEditingCart] = useState<CartRow | null>(null);
  const [draftLines, setDraftLines] = useState<CartLineItem[]>([]);

  // New Favourite Form
  const [favUserId, setFavUserId] = useState(profiles[0]?.id || '');
  const [favStoreId, setFavStoreId] = useState(selectedStoreId || stores[0]?.id || '');

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const visibleCarts = useMemo(
    () =>
      selectedStoreId ? carts.filter((c) => c.store_id === selectedStoreId) : carts,
    [carts, selectedStoreId]
  );

  const visibleFavs = useMemo(
    () =>
      selectedStoreId
        ? favourites.filter((f) => f.store_id === selectedStoreId)
        : favourites,
    [favourites, selectedStoreId]
  );

  const visibleLayouts = useMemo(
    () =>
      selectedStoreId
        ? layouts.filter((l) => l.store_id === selectedStoreId)
        : layouts,
    [layouts, selectedStoreId]
  );

  const handleSaveCart = async () => {
    if (!editingCart) return;
    const { error } = await supabase
      .from('carts')
      .update({ lines: draftLines })
      .eq('id', editingCart.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم تحديث محتويات سلة المتسوق');
    setEditingCart(null);
    await onReload();
  };

  const handleDeleteCart = async (id: string) => {
    if (!window.confirm('هل تريد حذف/إفراغ هذه السلة؟')) return;
    const { error } = await supabase.from('carts').delete().eq('id', id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم حذف السلة');
    await onReload();
  };

  const handleAddFavourite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!favUserId || !favStoreId) return;
    const { error } = await supabase
      .from('favourites')
      .upsert({ user_id: favUserId, store_id: favStoreId });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تمت إضافة المتجر إلى مفضلة المستخدم');
    await onReload();
  };

  const handleDeleteFavourite = async (userId: string, storeId: string) => {
    const { error } = await supabase
      .from('favourites')
      .delete()
      .eq('user_id', userId)
      .eq('store_id', storeId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تمت إزالة المتجر من المفضلة');
    await onReload();
  };

  const handleDeleteLayout = async (userId: string, storeId: string) => {
    if (!window.confirm('هل تريد إعادة ضبط الترتيب واليوميات لهذا المتسوق في هذا المتجر؟')) return;
    const { error } = await supabase
      .from('shopper_layouts')
      .delete()
      .eq('user_id', userId)
      .eq('store_id', storeId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تمت إعادة ضبط الترتيب واليوميات');
    await onReload();
  };

  return (
    <div>
      <div className="tabs-bar">
        <button
          type="button"
          className={`tab-pill ${tab === 'carts' ? 'active' : ''}`}
          onClick={() => setTab('carts')}
        >
          <ShoppingBasket size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
          السلال المفتوحة غير المرسلة ({visibleCarts.length})
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'favourites' ? 'active' : ''}`}
          onClick={() => setTab('favourites')}
        >
          <Star size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
          متاجر المفضلة ({visibleFavs.length})
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'layouts' ? 'active' : ''}`}
          onClick={() => setTab('layouts')}
        >
          <Heart size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
          المشتريات اليومية وترتيب المتسوقين ({visibleLayouts.length})
        </button>
      </div>

      {/* TAB 1: CARTS */}
      {tab === 'carts' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>المتسوق</th>
                <th>المتجر</th>
                <th>عدد البنود في السلة</th>
                <th>القيمة التقديرية</th>
                <th>آخر تحديث</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visibleCarts.map((c) => {
                const pr = profileMap.get(c.user_id);
                const st = storeMap.get(c.store_id);
                const lines = Array.isArray(c.lines) ? c.lines : [];
                const sum = lines.reduce(
                  (acc, l) => acc + Number(l.unitPrice || 0) * Number(l.quantity || 0),
                  0
                );
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>
                      {pr ? profileDisplayName(pr) : c.user_id.slice(0, 8)}
                    </td>
                    <td style={{ fontWeight: 700 }}>{st?.name || c.store_id.slice(0, 8)}</td>
                    <td>{lines.length} مادة</td>
                    <td style={{ fontWeight: 800, color: '#15803d' }}>
                      {formatMoney(sum, st?.currency)}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {formatDateTime(c.updated_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setEditingCart(c);
                            setDraftLines(Array.isArray(c.lines) ? [...c.lines] : []);
                          }}
                        >
                          <Edit3 size={14} /> معاينة وتعديل البنود
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteCart(c.id)}
                        >
                          <Trash2 size={14} /> حذف السلة
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleCarts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    لا توجد سلال مفتوحة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: FAVOURITES */}
      {tab === 'favourites' && (
        <div>
          <form onSubmit={handleAddFavourite} className="toolbar">
            <div className="toolbar-filters">
              <select
                className="select"
                value={favUserId}
                onChange={(e) => setFavUserId(e.target.value)}
              >
                <option value="">— اختر المستخدم —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {profileDisplayName(p)}
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={favStoreId}
                onChange={(e) => setFavStoreId(e.target.value)}
              >
                <option value="">— اختر المتجر —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              <Plus size={15} /> ربط متجر بمفضلة مستخدم
            </button>
          </form>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>المتجر المفضل</th>
                  <th>تاريخ الإضافة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {visibleFavs.map((f) => {
                  const pr = profileMap.get(f.user_id);
                  const st = storeMap.get(f.store_id);
                  return (
                    <tr key={`${f.user_id}-${f.store_id}`}>
                      <td style={{ fontWeight: 700 }}>
                        {pr ? profileDisplayName(pr) : f.user_id.slice(0, 8)}
                      </td>
                      <td style={{ fontWeight: 700 }}>{st?.name || f.store_id.slice(0, 8)}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>
                        {formatDateTime(f.created_at)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteFavourite(f.user_id, f.store_id)}
                        >
                          <Trash2 size={14} /> إزالة
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visibleFavs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      لا توجد سجلات مفضلة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SHOPPER LAYOUTS & DAILY PICKS */}
      {tab === 'layouts' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>المتسوق</th>
                <th>المتجر</th>
                <th>المواد المحفوظة في «اليوميات» (♥)</th>
                <th>تخصيص ترتيب الأقسام</th>
                <th>آخر تحديث</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {visibleLayouts.map((l) => {
                const pr = profileMap.get(l.user_id);
                const st = storeMap.get(l.store_id);
                const dailyIds = Array.isArray(l.daily) ? l.daily : [];
                const catIds = Array.isArray(l.categories) ? l.categories : [];
                return (
                  <tr key={`${l.user_id}-${l.store_id}`}>
                    <td style={{ fontWeight: 700 }}>
                      {pr ? profileDisplayName(pr) : l.user_id.slice(0, 8)}
                    </td>
                    <td style={{ fontWeight: 700 }}>{st?.name || l.store_id.slice(0, 8)}</td>
                    <td>
                      {dailyIds.length === 0 ? (
                        <span style={{ color: '#94a3b8' }}>لا يوجد</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {dailyIds.map((pid) => (
                            <span key={pid} className="badge badge-green">
                              ♥ {productMap.get(pid)?.name || pid.slice(0, 6)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{catIds.length} قسم مرتّب</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {formatDateTime(l.updated_at)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteLayout(l.user_id, l.store_id)}
                      >
                        <Trash2 size={14} /> إعادة ضبط وحذف
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleLayouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    لا توجد تخصيصات ترتيب أو مشتريات يومية محفوظة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Cart Modal */}
      {editingCart && (
        <div className="modal-backdrop" onClick={() => setEditingCart(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>معاينة وتعديل بنود سلة المتسوق</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditingCart(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {draftLines.length === 0 ? (
                <div className="empty-state">السلة فارغة</div>
              ) : (
                draftLines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr auto',
                      gap: 8,
                      marginBottom: 8,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      className="input"
                      value={line.name}
                      onChange={(e) => {
                        const next = [...draftLines];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setDraftLines(next);
                      }}
                    />
                    <input
                      type="text"
                      className="input"
                      value={line.unit}
                      onChange={(e) => {
                        const next = [...draftLines];
                        next[idx] = { ...next[idx], unit: e.target.value };
                        setDraftLines(next);
                      }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const next = [...draftLines];
                        next[idx] = { ...next[idx], unitPrice: Number(e.target.value) };
                        setDraftLines(next);
                      }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...draftLines];
                        next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                        setDraftLines(next);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        setDraftLines(draftLines.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingCart(null)}
              >
                إلغاء
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveCart}>
                حفظ تعديلات السلة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
