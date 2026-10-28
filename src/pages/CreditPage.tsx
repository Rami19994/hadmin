import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react';
import type {
  CreditAccountRow,
  CreditAccountStatus,
  CreditEntryKind,
  CreditEntryRow,
  Profile,
  StoreRow,
} from '../types/database';
import {
  CREDIT_ACCOUNT_STATUS_META,
  CREDIT_ENTRY_KIND_META,
  formatDateTime,
  formatMoney,
  profileDisplayName,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, useToast } from '../components/ToastContext';

interface AccountFormState {
  id?: string;
  store_id: string;
  consumer_id: string;
  customer_name: string;
  customer_phone: string;
  status: CreditAccountStatus;
  credit_limit: string;
  identity_verified: boolean;
}

export function CreditPage({
  creditAccounts,
  stores,
  profiles,
  selectedStoreId,
  onReload,
}: {
  creditAccounts: CreditAccountRow[];
  stores: StoreRow[];
  profiles: Profile[];
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debt' | 'wallet'>('all');

  const [editing, setEditing] = useState<AccountFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CreditAccountRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Active Ledger Account & Entries
  const [ledgerAccount, setLedgerAccount] = useState<CreditAccountRow | null>(null);
  const [entries, setEntries] = useState<CreditEntryRow[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // New Entry Form
  const [entryKind, setEntryKind] = useState<CreditEntryKind>('settlement');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [postingEntry, setPostingEntry] = useState(false);

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const effectiveStore = selectedStoreId || storeFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return creditAccounts.filter((acc) => {
      if (effectiveStore !== 'all' && acc.store_id !== effectiveStore) return false;
      if (statusFilter !== 'all' && acc.status !== statusFilter) return false;
      if (balanceFilter === 'debt' && Number(acc.balance) >= 0) return false;
      if (balanceFilter === 'wallet' && Number(acc.balance) <= 0) return false;
      if (!q) return true;
      const st = storeMap.get(acc.store_id);
      const pr = profileMap.get(acc.consumer_id);
      return [
        acc.customer_name || '',
        acc.customer_phone || '',
        st?.name || '',
        pr ? profileDisplayName(pr) : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [creditAccounts, effectiveStore, statusFilter, balanceFilter, query, storeMap, profileMap]);

  const loadEntries = async (accountId: string) => {
    setLoadingEntries(true);
    try {
      const { data, error } = await supabase
        .from('credit_entries')
        .select('*')
        .eq('account_id', accountId)
        .order('at', { ascending: false });
      if (error) throw error;
      setEntries((data as CreditEntryRow[]) || []);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحميل القيود', 'error');
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    if (ledgerAccount) {
      const refreshed = creditAccounts.find((c) => c.id === ledgerAccount.id);
      if (refreshed) setLedgerAccount(refreshed);
    }
  }, [creditAccounts, ledgerAccount]);

  const openLedger = async (acc: CreditAccountRow) => {
    setLedgerAccount(acc);
    await loadEntries(acc.id);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.store_id || !editing.consumer_id) {
      notify('يرجى تحديد المتجر والمستهلك', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: editing.store_id,
        consumer_id: editing.consumer_id,
        customer_name: editing.customer_name.trim() || null,
        customer_phone: editing.customer_phone.trim() || null,
        status: editing.status,
        credit_limit: Math.max(0, Number(editing.credit_limit || 0)),
        identity_verified: editing.identity_verified,
      };

      if (editing.id) {
        const { error } = await supabase
          .from('credit_accounts')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('credit_accounts').insert(payload);
        if (error) throw error;
      }

      notify(editing.id ? 'تم تحديث بيانات حساب الائتمان' : 'تم فتح دفتر على الحساب بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerAccount) return;
    const amt = Number(entryAmount);
    if (!amt || amt <= 0) {
      notify('يرجى إدخال مبلغ موجب أكبر من صفر', 'error');
      return;
    }
    setPostingEntry(true);
    try {
      const { error } = await supabase.rpc('post_credit_entry', {
        account: ledgerAccount.id,
        entry_kind: entryKind,
        entry_amount: amt,
        entry_note: entryNote.trim() || null,
        entry_note_en: null,
        entry_order: null,
      });
      if (error) throw error;
      notify('تم ترحيل الحركة المالية وتحديث الرصيد ذرياً');
      setEntryAmount('');
      setEntryNote('');
      await onReload();
      await loadEntries(ledgerAccount.id);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تسجيل القيد', 'error');
    } finally {
      setPostingEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!ledgerAccount) return;
    if (!window.confirm('هل تريد حذف هذا القيد المالي وإعادة احتساب الأرصدة التراكمية تلقائياً؟')) {
      return;
    }
    const { error } = await supabase.rpc('admin_delete_credit_entry', {
      p_entry_id: entryId,
    });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم حذف القيد وإعادة احتساب رصيد الدفتر بدقة');
    await onReload();
    await loadEntries(ledgerAccount.id);
  };

  const handleRecalculate = async () => {
    if (!ledgerAccount) return;
    const { error } = await supabase.rpc('admin_recalculate_credit_account', {
      p_account_id: ledgerAccount.id,
    });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تمت مطابقة وإعادة احتساب الرصيد التراكمي بنجاح');
    await onReload();
    await loadEntries(ledgerAccount.id);
  };

  const handleDeleteAccount = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('credit_accounts')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      notify('تم حذف حساب الائتمان وجميع قيوده');
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
      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث باسم الزبون، الهاتف، أو المتجر..."
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
            <option value="all">كل الحالات</option>
            <option value="pending">بانتظار الموافقة</option>
            <option value="approved">مفعّل</option>
            <option value="suspended">موقوف</option>
            <option value="rejected">مرفوض</option>
          </select>

          <select
            className="select"
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as 'all' | 'debt' | 'wallet')}
          >
            <option value="all">كل الأرصدة</option>
            <option value="debt">مدين للمتجر (رصيد سالب)</option>
            <option value="wallet">له رصيد محفظة (رصيد موجب)</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setEditing({
                store_id: effectiveStore !== 'all' ? effectiveStore : stores[0]?.id || '',
                consumer_id: profiles[0]?.id || '',
                customer_name: '',
                customer_phone: '',
                status: 'approved',
                credit_limit: '500',
                identity_verified: true,
              })
            }
          >
            <Plus size={16} /> فتح دفتر على الحساب جديد
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>العميل</th>
              <th>المتجر</th>
              <th>الرصيد الحالي</th>
              <th>سقف الدين المسموح</th>
              <th>توثيق الهوية</th>
              <th>الحالة</th>
              <th>تاريخ الطلب</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((acc) => {
              const st = storeMap.get(acc.store_id);
              const pr = profileMap.get(acc.consumer_id);
              const bal = Number(acc.balance || 0);
              const stMeta =
                CREDIT_ACCOUNT_STATUS_META[acc.status] || CREDIT_ACCOUNT_STATUS_META.pending;

              return (
                <tr key={acc.id}>
                  <td>
                    <div style={{ fontWeight: 800 }}>
                      {acc.customer_name || (pr ? profileDisplayName(pr) : 'زبون')}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }} dir="ltr">
                      {acc.customer_phone || pr?.phone || ''}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{st?.name || '—'}</td>
                  <td>
                    <span
                      style={{
                        fontWeight: 800,
                        color: bal < 0 ? '#dc2626' : bal > 0 ? '#15803d' : '#475569',
                      }}
                    >
                      {formatMoney(bal, st?.currency)}
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {bal < 0 ? 'عليه للمتجر' : bal > 0 ? 'له عند المتجر' : 'متوازن'}
                    </div>
                  </td>
                  <td>{formatMoney(acc.credit_limit, st?.currency)}</td>
                  <td>
                    <span
                      className={`badge ${
                        acc.identity_verified ? 'badge-green' : 'badge-amber'
                      }`}
                    >
                      {acc.identity_verified ? 'موثّق ✓' : 'غير موثّق'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${stMeta.badgeClass}`}>{stMeta.label}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>
                    {formatDateTime(acc.requested_at)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {acc.status === 'pending' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            await supabase
                              .from('credit_accounts')
                              .update({ status: 'approved' })
                              .eq('id', acc.id);
                            notify('تمت الموافقة على الدفتر');
                            await onReload();
                          }}
                        >
                          <CheckCircle2 size={14} /> اعتماد
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-yellow btn-sm"
                        onClick={() => openLedger(acc)}
                      >
                        <BookOpen size={14} /> كشف القيود
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setEditing({
                            id: acc.id,
                            store_id: acc.store_id,
                            consumer_id: acc.consumer_id,
                            customer_name: acc.customer_name || '',
                            customer_phone: acc.customer_phone || '',
                            status: acc.status,
                            credit_limit: String(acc.credit_limit ?? 0),
                            identity_verified: Boolean(acc.identity_verified),
                          })
                        }
                      >
                        <Edit3 size={14} /> تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(acc)}
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
                  لا توجد دفاتر «على الحساب» مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Credit Account Modal */}
      {editing && (
        <div className="modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing.id ? 'تعديل إعدادات وسقف الدفتر' : 'فتح دفتر على الحساب جديد'}</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditing(null)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveAccount}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>المتجر *</label>
                    <select
                      className="select"
                      required
                      disabled={Boolean(editing.id)}
                      value={editing.store_id}
                      onChange={(e) => setEditing({ ...editing, store_id: e.target.value })}
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
                    <label>المستهلك *</label>
                    <select
                      className="select"
                      required
                      disabled={Boolean(editing.id)}
                      value={editing.consumer_id}
                      onChange={(e) => {
                        const pr = profileMap.get(e.target.value);
                        setEditing({
                          ...editing,
                          consumer_id: e.target.value,
                          customer_name: pr ? profileDisplayName(pr) : editing.customer_name,
                          customer_phone: pr?.phone || editing.customer_phone,
                        });
                      }}
                    >
                      <option value="">— اختر المستهلك —</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {profileDisplayName(p)} ({p.phone || p.email || p.id.slice(0, 8)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>اسم العميل في الدفتر</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.customer_name}
                      onChange={(e) =>
                        setEditing({ ...editing, customer_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>هاتف العميل</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.customer_phone}
                      onChange={(e) =>
                        setEditing({ ...editing, customer_phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>حالة الدفتر</label>
                    <select
                      className="select"
                      value={editing.status}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          status: e.target.value as CreditAccountStatus,
                        })
                      }
                    >
                      <option value="approved">مفعّل (Approved)</option>
                      <option value="pending">قيد المراجعة (Pending)</option>
                      <option value="suspended">موقوف (Suspended)</option>
                      <option value="rejected">مرفوض (Rejected)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>سقف الدين الأقصى المسموح</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      dir="ltr"
                      value={editing.credit_limit}
                      onChange={(e) =>
                        setEditing({ ...editing, credit_limit: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.identity_verified}
                        onChange={(e) =>
                          setEditing({ ...editing, identity_verified: e.target.checked })
                        }
                      />
                      تم التحقق من الهوية الشخصية للعميل لهذا الدفتر
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
                  {saving ? 'جاري الحفظ...' : 'حفظ الدفتر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Entries Modal */}
      {ledgerAccount && (
        <div className="modal-backdrop" onClick={() => setLedgerAccount(null)}>
          <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>
                  كشف حساب: {ledgerAccount.customer_name || 'زبون'} — متجر:{' '}
                  {storeMap.get(ledgerAccount.store_id)?.name || ''}
                </h3>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  الرصيد الحالي:{' '}
                  <strong
                    style={{
                      color:
                        Number(ledgerAccount.balance) < 0 ? '#dc2626' : '#15803d',
                    }}
                  >
                    {formatMoney(
                      ledgerAccount.balance,
                      storeMap.get(ledgerAccount.store_id)?.currency
                    )}
                  </strong>{' '}
                  • سقف الدين:{' '}
                  {formatMoney(
                    ledgerAccount.credit_limit,
                    storeMap.get(ledgerAccount.store_id)?.currency
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleRecalculate}
                >
                  <RefreshCw size={14} /> إعادة مطابقة الرصيد
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setLedgerAccount(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Post New Entry */}
              <form
                onSubmit={handlePostEntry}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 18,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>
                  تسجيل قيد مالي جديد في الدفتر (ذرياً مع تحديث الرصيد)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.3fr 0.9fr 1.6fr auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <select
                    className="select"
                    value={entryKind}
                    onChange={(e) => setEntryKind(e.target.value as CreditEntryKind)}
                  >
                    {Object.entries(CREDIT_ENTRY_KIND_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="input"
                    dir="ltr"
                    placeholder="المبلغ *"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                  />

                  <input
                    type="text"
                    className="input"
                    placeholder="البيان / الملاحظة (مثلاً: دفعة نقدية باليد)"
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                  />

                  <button type="submit" className="btn btn-primary" disabled={postingEntry}>
                    <Plus size={15} /> {postingEntry ? 'يرحّل...' : 'ترحيل القيد'}
                  </button>
                </div>
              </form>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>التاريخ والوقت</th>
                      <th>نوع الحركة</th>
                      <th>المبلغ</th>
                      <th>الرصيد بعد الحركة</th>
                      <th>البيان / الفاتورة</th>
                      <th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEntries ? (
                      <tr>
                        <td colSpan={6} className="empty-state">
                          جاري تحميل سجل الحركات...
                        </td>
                      </tr>
                    ) : entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-state">
                          لا توجد حركات مسجلة في هذا الدفتر بعد
                        </td>
                      </tr>
                    ) : (
                      entries.map((en) => {
                        const meta = CREDIT_ENTRY_KIND_META[en.kind] || {
                          label: en.kind,
                          isCredit: true,
                          badgeClass: 'badge-slate',
                        };
                        const cur = storeMap.get(ledgerAccount.store_id)?.currency;
                        return (
                          <tr key={en.id}>
                            <td style={{ fontSize: 12 }}>{formatDateTime(en.at)}</td>
                            <td>
                              <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                            </td>
                            <td
                              style={{
                                fontWeight: 800,
                                color: meta.isCredit ? '#15803d' : '#dc2626',
                              }}
                            >
                              {meta.isCredit ? '+' : '-'}
                              {formatMoney(en.amount, cur)}
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              {formatMoney(en.balance_after, cur)}
                            </td>
                            <td style={{ fontSize: 12.5 }}>
                              {en.note || '—'}
                              {en.order_id && (
                                <span
                                  dir="ltr"
                                  style={{ marginRight: 6, color: '#2563eb', fontSize: 11.5 }}
                                >
                                  (فاتورة #{en.order_id.slice(0, 8)})
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteEntry(en.id)}
                                title="حذف القيد وإعادة احتساب الرصيد"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف دفتر على الحساب"
        message={`هل تريد حذف حساب الائتمان الخاص بـ «${deleteTarget?.customer_name || 'العميل'}» وجميع حركاته المالية؟`}
        busy={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
