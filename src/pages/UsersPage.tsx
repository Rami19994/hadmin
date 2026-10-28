import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Edit3,
  Trash2,
  ShieldCheck,
  MapPin,
  Plus,
  X,
} from 'lucide-react';
import type {
  AuthUserMeta,
  ConsumerAddress,
  Profile,
  StoreRow,
  UserRole,
  UserTrust,
} from '../types/database';
import {
  COUNTRIES,
  findCountry,
  formatDateTime,
  profileDisplayName,
  USER_ROLE_META,
  USER_TRUST_META,
} from '../lib/constants';
import { callServerAdminApi, checkServerAdminApi, supabase } from '../lib/supabase';
import { ConfirmModal, ImageUploadField, useToast } from '../components/ToastContext';

interface UserEditState {
  id: string;
  role: UserRole;
  trust: UserTrust;
  first_name_ar: string;
  last_name_ar: string;
  first_name_en: string;
  last_name_en: string;
  phone: string;
  email: string;
  country_code: string;
  province: string;
  favourite_store_id: string;
  photo_url: string;
  id_photo_url: string;
  is_suspended: boolean;
  admin_note: string;
  newPassword: string;
}

export function UsersPage({
  profiles,
  authUsers,
  stores,
  currentAdminId,
  onReload,
}: {
  profiles: Profile[];
  authUsers: AuthUserMeta[];
  stores: StoreRow[];
  currentAdminId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [trustFilter, setTrustFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'registered' | 'guest'>('all');

  const [serverApiReady, setServerApiReady] = useState(false);

  // Create User Modal (via Server API)
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    email: '',
    password: '',
    phone: '',
    role: 'consumer' as UserRole,
    trust: 'basic' as UserTrust,
    first_name_ar: '',
    last_name_ar: '',
    country_code: 'SY',
    province: '',
  });
  const [creatingBusy, setCreatingBusy] = useState(false);

  // Edit User + Addresses Modal
  const [editing, setEditing] = useState<UserEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState<ConsumerAddress[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({
    label: 'المنزل',
    province: '',
    city: '',
    street: '',
    building: '',
    floor: '',
    unit: '',
    is_default: false,
  });

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkServerAdminApi().then(setServerApiReady);
  }, []);

  const authMap = useMemo(() => new Map(authUsers.map((u) => [u.id, u])), [authUsers]);

  const storesByOwner = useMemo(() => {
    const m: Record<string, StoreRow[]> = {};
    for (const s of stores) {
      if (s.owner_id) {
        if (!m[s.owner_id]) m[s.owner_id] = [];
        m[s.owner_id].push(s);
      }
    }
    return m;
  }, [stores]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (trustFilter !== 'all' && p.trust !== trustFilter) return false;
      const au = authMap.get(p.id);
      const isGuest = au ? au.is_anonymous : !p.email && !p.phone;
      if (typeFilter === 'guest' && !isGuest) return false;
      if (typeFilter === 'registered' && isGuest) return false;
      if (!q) return true;
      return [
        p.id,
        p.first_name_ar || '',
        p.last_name_ar || '',
        p.first_name_en || '',
        p.last_name_en || '',
        p.email || '',
        p.phone || '',
        p.province || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [profiles, authMap, roleFilter, trustFilter, typeFilter, query]);

  const loadUserAddresses = async (userId: string) => {
    setLoadingAddr(true);
    try {
      const { data, error } = await supabase
        .from('consumer_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAddresses((data as ConsumerAddress[]) || []);
    } catch {
      setAddresses([]);
    } finally {
      setLoadingAddr(false);
    }
  };

  const openEdit = async (p: Profile) => {
    setEditing({
      id: p.id,
      role: p.role,
      trust: p.trust,
      first_name_ar: p.first_name_ar || '',
      last_name_ar: p.last_name_ar || '',
      first_name_en: p.first_name_en || '',
      last_name_en: p.last_name_en || '',
      phone: p.phone || '',
      email: p.email || '',
      country_code: p.country_code || '',
      province: p.province || '',
      favourite_store_id: p.favourite_store_id || '',
      photo_url: p.photo_url || '',
      id_photo_url: p.id_photo_url || '',
      is_suspended: Boolean(p.is_suspended),
      admin_note: p.admin_note || '',
      newPassword: '',
    });
    await loadUserAddresses(p.id);
  };

  const handleQuickTrust = async (p: Profile) => {
    const next: UserTrust = p.trust === 'identified' ? 'basic' : 'identified';
    const { error } = await supabase
      .from('profiles')
      .update({ trust: next })
      .eq('id', p.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(next === 'identified' ? 'تم توثيق هوية المستخدم' : 'تم إلغاء توثيق الهوية');
    await onReload();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const basePayload = {
        role: editing.role,
        trust: editing.trust,
        first_name_ar: editing.first_name_ar.trim() || null,
        last_name_ar: editing.last_name_ar.trim() || null,
        first_name_en: editing.first_name_en.trim() || null,
        last_name_en: editing.last_name_en.trim() || null,
        phone: editing.phone.trim() || null,
        email: editing.email.trim() || null,
        country_code: editing.country_code || null,
        province: editing.province.trim() || null,
        favourite_store_id: editing.favourite_store_id || null,
      };

      const extPayload = {
        ...basePayload,
        photo_url: editing.photo_url.trim() || null,
        id_photo_url: editing.id_photo_url.trim() || null,
        is_suspended: editing.is_suspended,
        admin_note: editing.admin_note.trim() || null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(extPayload)
        .eq('id', editing.id);

      if (error) {
        if (error.message.includes('column')) {
          const { error: fbErr } = await supabase
            .from('profiles')
            .update(basePayload)
            .eq('id', editing.id);
          if (fbErr) throw fbErr;
        } else {
          throw error;
        }
      }

      if (editing.newPassword.trim() && serverApiReady) {
        await callServerAdminApi({
          action: 'update_auth',
          user_id: editing.id,
          password: editing.newPassword.trim(),
          email: editing.email.trim() || undefined,
        });
      }

      notify('تم حفظ تعديلات الملف الشخصي والصلاحيات بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ المستخدم', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !newAddr.label.trim()) return;
    const { error } = await supabase.from('consumer_addresses').insert({
      user_id: editing.id,
      label: newAddr.label.trim(),
      province: newAddr.province.trim() || null,
      city: newAddr.city.trim() || null,
      street: newAddr.street.trim() || null,
      building: newAddr.building.trim() || null,
      floor: newAddr.floor.trim() || null,
      unit: newAddr.unit.trim() || null,
      is_default: newAddr.is_default,
    });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تمت إضافة العنوان بنجاح');
    setNewAddr({
      label: 'المنزل',
      province: '',
      city: '',
      street: '',
      building: '',
      floor: '',
      unit: '',
      is_default: false,
    });
    await loadUserAddresses(editing.id);
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!editing) return;
    const { error } = await supabase.from('consumer_addresses').delete().eq('id', addrId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم حذف العنوان');
    await loadUserAddresses(editing.id);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBusy(true);
    try {
      await callServerAdminApi({
        action: 'create_user',
        ...newForm,
      });
      notify('تم إنشاء حساب المستخدم الجديد بنجاح');
      setCreating(false);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل إنشاء المستخدم', 'error');
    } finally {
      setCreatingBusy(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentAdminId) {
      notify('لا يمكنك حذف حساب المشرف الحالي الذي تسجل الدخول به', 'error');
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('admin_delete_auth_user', {
        target_user_id: deleteTarget.id,
      });
      if (error) {
        if (serverApiReady) {
          await callServerAdminApi({
            action: 'delete_user',
            user_id: deleteTarget.id,
          });
        } else {
          const { error: profDelErr } = await supabase
            .from('profiles')
            .delete()
            .eq('id', deleteTarget.id);
          if (profDelErr) throw profDelErr;
        }
      }
      notify('تم حذف حساب المستخدم وتوابعه نهائياً');
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حذف المستخدم', 'error');
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
              placeholder="بحث بالاسم العربي/الأجنبي، البريد، الهاتف، المحافظة..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            className="select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">كل الأدوار ({profiles.length})</option>
            <option value="consumer">مستهلكون</option>
            <option value="merchant">تجار</option>
            <option value="admin">مشرفون (Admins)</option>
          </select>

          <select
            className="select"
            value={trustFilter}
            onChange={(e) => setTrustFilter(e.target.value)}
          >
            <option value="all">كل حالات التوثيق</option>
            <option value="identified">موثّق الهوية</option>
            <option value="basic">أساسي (بدون توثيق)</option>
          </select>

          <select
            className="select"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as 'all' | 'registered' | 'guest')
            }
          >
            <option value="all">مسجلون + ضيوف</option>
            <option value="registered">حسابات مسجلة فقط</option>
            <option value="guest">جلسات ضيوف فقط</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreating(true)}
          >
            <UserPlus size={16} /> إنشاء مستخدم / مشرف جديد
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>البريد والهاتف</th>
              <th>الدولة والمحافظة</th>
              <th>الدور والصلاحية</th>
              <th>درجة التوثيق</th>
              <th>المتاجر المملوكة</th>
              <th>التسجيل / آخر دخول</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const au = authMap.get(p.id);
              const isGuest = au ? au.is_anonymous : !p.email && !p.phone;
              const roleMeta = USER_ROLE_META[p.role] || USER_ROLE_META.consumer;
              const trustMeta = USER_TRUST_META[p.trust] || USER_TRUST_META.basic;
              const ownedStores = storesByOwner[p.id] || [];

              return (
                <tr key={p.id} className={p.is_suspended ? 'row-faded' : ''}>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      {profileDisplayName(p)}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                      {isGuest && <span className="badge badge-slate">ضيف</span>}
                      {p.is_suspended && <span className="badge badge-red">موقوف</span>}
                    </div>
                  </td>
                  <td>
                    <div dir="ltr" style={{ fontSize: 12.5 }}>
                      {p.email || au?.email || '—'}
                    </div>
                    <div dir="ltr" style={{ fontSize: 12, color: '#64748b' }}>
                      {p.phone || au?.phone || ''}
                    </div>
                  </td>
                  <td>
                    <div>
                      {findCountry(p.country_code)?.name || p.country_code || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{p.province || '—'}</div>
                  </td>
                  <td>
                    <span className={`badge ${roleMeta.badgeClass}`}>{roleMeta.label}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`badge ${trustMeta.badgeClass}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => handleQuickTrust(p)}
                      title="اضغط لتبديل حالة توثيق الهوية"
                    >
                      {trustMeta.label}
                    </button>
                  </td>
                  <td>
                    {ownedStores.length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                    ) : (
                      ownedStores.map((s) => (
                        <div key={s.id} style={{ fontSize: 12, fontWeight: 700 }}>
                          {s.name}
                        </div>
                      ))
                    )}
                  </td>
                  <td style={{ fontSize: 11.5, color: '#64748b' }}>
                    <div>انضم: {formatDateTime(p.created_at)}</div>
                    {au?.last_sign_in_at && (
                      <div>دخول: {formatDateTime(au.last_sign_in_at)}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.trust !== 'identified' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleQuickTrust(p)}
                          title="توثيق الهوية"
                        >
                          <ShieldCheck size={14} /> توثيق
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(p)}
                      >
                        <Edit3 size={14} /> تعديل وعناوين
                      </button>
                      {p.id !== currentAdminId && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  لا يوجد مستخدمون مطابقون لمعايير البحث
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {creating && (
        <div className="modal-backdrop" onClick={() => !creatingBusy && setCreating(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>إنشاء حساب مستخدم / تاجر / مشرف جديد</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setCreating(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {!serverApiReady && (
                  <div className="alert alert-amber">
                    ملاحظة: لإنشاء حساب بكلمة مرور من هنا على Vercel، أضف المتغير السري{' '}
                    <code dir="ltr">SUPABASE_SERVICE_ROLE_KEY</code> في إعدادات مشروع Vercel (بدون
                    بادئة VITE_). أو يمكن للمستخدم التسجيل من التطبيق ثم ترقيته وتعديله فوراً من
                    الجدول.
                  </div>
                )}

                <div className="form-grid">
                  <div className="field">
                    <label>البريد الإلكتروني *</label>
                    <input
                      type="email"
                      className="input"
                      dir="ltr"
                      required
                      value={newForm.email}
                      onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>كلمة المرور (8 أحرف على الأقل) *</label>
                    <input
                      type="password"
                      className="input"
                      dir="ltr"
                      required
                      minLength={8}
                      value={newForm.password}
                      onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الاسم الأول (عربي)</label>
                    <input
                      type="text"
                      className="input"
                      value={newForm.first_name_ar}
                      onChange={(e) =>
                        setNewForm({ ...newForm, first_name_ar: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>الكنية / العائلة (عربي)</label>
                    <input
                      type="text"
                      className="input"
                      value={newForm.last_name_ar}
                      onChange={(e) =>
                        setNewForm({ ...newForm, last_name_ar: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>رقم الهاتف</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={newForm.phone}
                      onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الدور (Role)</label>
                    <select
                      className="select"
                      value={newForm.role}
                      onChange={(e) =>
                        setNewForm({ ...newForm, role: e.target.value as UserRole })
                      }
                    >
                      <option value="consumer">مستهلك (Consumer)</option>
                      <option value="merchant">تاجر (Merchant)</option>
                      <option value="admin">مشرف عام (Admin)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>درجة الثقة والتوثيق</label>
                    <select
                      className="select"
                      value={newForm.trust}
                      onChange={(e) =>
                        setNewForm({ ...newForm, trust: e.target.value as UserTrust })
                      }
                    >
                      <option value="basic">أساسي</option>
                      <option value="identified">موثّق الهوية</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>الدولة</label>
                    <select
                      className="select"
                      value={newForm.country_code}
                      onChange={(e) =>
                        setNewForm({ ...newForm, country_code: e.target.value })
                      }
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCreating(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingBusy || !serverApiReady}
                >
                  {creatingBusy ? 'جاري الإنشاء...' : 'إنشاء الحساب الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile & Consumer Addresses Modal */}
      {editing && (
        <div className="modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تعديل بيانات وصلاحيات وعناوين المستخدم</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditing(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSaveEdit} style={{ marginBottom: 24 }}>
                <div className="form-grid-3">
                  <div className="field">
                    <label>الدور والصلاحية</label>
                    <select
                      className="select"
                      value={editing.role}
                      disabled={editing.id === currentAdminId}
                      onChange={(e) =>
                        setEditing({ ...editing, role: e.target.value as UserRole })
                      }
                    >
                      <option value="consumer">مستهلك (Consumer)</option>
                      <option value="merchant">تاجر (Merchant)</option>
                      <option value="admin">مشرف عام (Admin)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>حالة توثيق الهوية</label>
                    <select
                      className="select"
                      value={editing.trust}
                      onChange={(e) =>
                        setEditing({ ...editing, trust: e.target.value as UserTrust })
                      }
                    >
                      <option value="basic">أساسي (بدون توثيق)</option>
                      <option value="identified">موثّق الهوية ✓</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>متجره المفضل (يفتح عليه التطبيق)</label>
                    <select
                      className="select"
                      value={editing.favourite_store_id}
                      onChange={(e) =>
                        setEditing({ ...editing, favourite_store_id: e.target.value })
                      }
                    >
                      <option value="">— غير محدد —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>الاسم الأول (عربي)</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.first_name_ar}
                      onChange={(e) =>
                        setEditing({ ...editing, first_name_ar: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>اسم العائلة (عربي)</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.last_name_ar}
                      onChange={(e) =>
                        setEditing({ ...editing, last_name_ar: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>رقم الهاتف</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.phone}
                      onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الاسم الأول (إنجليزي)</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.first_name_en}
                      onChange={(e) =>
                        setEditing({ ...editing, first_name_en: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>اسم العائلة (إنجليزي)</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.last_name_en}
                      onChange={(e) =>
                        setEditing({ ...editing, last_name_en: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>البريد الإلكتروني</label>
                    <input
                      type="email"
                      className="input"
                      dir="ltr"
                      value={editing.email}
                      onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>الدولة</label>
                    <select
                      className="select"
                      value={editing.country_code}
                      onChange={(e) =>
                        setEditing({ ...editing, country_code: e.target.value })
                      }
                    >
                      <option value="">— غير محدد —</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>المحافظة</label>
                    <input
                      type="text"
                      className="input"
                      value={editing.province}
                      onChange={(e) => setEditing({ ...editing, province: e.target.value })}
                    />
                  </div>

                  {serverApiReady && (
                    <div className="field">
                      <label>تعيين كلمة مرور جديدة (اختياري)</label>
                      <input
                        type="password"
                        className="input"
                        dir="ltr"
                        placeholder="اتركه فارغاً لعدم التغيير"
                        value={editing.newPassword}
                        onChange={(e) =>
                          setEditing({ ...editing, newPassword: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="form-grid" style={{ marginTop: 14 }}>
                  <ImageUploadField
                    label="صورة الوثيقة / الهوية الشخصية للمراجعة"
                    value={editing.id_photo_url}
                    onChange={(url) => setEditing({ ...editing, id_photo_url: url })}
                    folderPath={`admin/identities/${editing.id}`}
                  />

                  <div className="field">
                    <label>ملاحظة إدارية على الحساب</label>
                    <textarea
                      rows={2}
                      className="textarea"
                      value={editing.admin_note}
                      onChange={(e) =>
                        setEditing({ ...editing, admin_note: e.target.value })
                      }
                    />
                    {editing.id !== currentAdminId && (
                      <label className="checkbox-row" style={{ marginTop: 8, color: '#dc2626' }}>
                        <input
                          type="checkbox"
                          checked={editing.is_suspended}
                          onChange={(e) =>
                            setEditing({ ...editing, is_suspended: e.target.checked })
                          }
                        />
                        إيقاف هذا الحساب إدارياً (Suspended)
                      </label>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'جاري الحفظ...' : 'حفظ بيانات الملف الشخصي'}
                  </button>
                </div>
              </form>

              {/* Saved Consumer Addresses Section */}
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 18,
                }}
              >
                <h4 style={{ margin: '0 0 10px' }}>
                  <MapPin size={16} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
                  عناوين التوصيل المحفوظة للمستخدم ({addresses.length})
                </h4>

                <div className="table-wrap" style={{ marginBottom: 14 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>التسمية</th>
                        <th>المحافظة / المدينة</th>
                        <th>الشارع والبناء</th>
                        <th>افتراضي</th>
                        <th>حذف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingAddr ? (
                        <tr>
                          <td colSpan={5} className="empty-state">
                            جاري التحميل...
                          </td>
                        </tr>
                      ) : addresses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="empty-state">
                            لا توجد عناوين محفوظة لهذا المستخدم
                          </td>
                        </tr>
                      ) : (
                        addresses.map((ad) => (
                          <tr key={ad.id}>
                            <td style={{ fontWeight: 700 }}>{ad.label}</td>
                            <td>
                              {ad.province || '—'} / {ad.city || '—'}
                            </td>
                            <td>
                              {[ad.street, ad.building, ad.floor && `ط ${ad.floor}`, ad.unit && `شقة ${ad.unit}`]
                                .filter(Boolean)
                                .join(' — ') || '—'}
                            </td>
                            <td>
                              {ad.is_default ? (
                                <span className="badge badge-green">افتراضي</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteAddress(ad.id)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <form
                  onSubmit={handleAddAddress}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 8,
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <input
                    type="text"
                    className="input"
                    placeholder="التسمية (المنزل/العمل) *"
                    required
                    value={newAddr.label}
                    onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="المحافظة"
                    value={newAddr.province}
                    onChange={(e) => setNewAddr({ ...newAddr, province: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="المدينة / الحي"
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="الشارع والبناء"
                    value={newAddr.street}
                    onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })}
                  />
                  <button type="submit" className="btn btn-outline">
                    <Plus size={14} /> إضافة عنوان
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف حساب المستخدم نهائياً"
        message={`هل أنت متأكد من حذف حساب «${
          deleteTarget ? profileDisplayName(deleteTarget) : ''
        }» وجميع عناوينه وطلباته وسلاله نهائياً؟`}
        busy={deleting}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

