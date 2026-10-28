import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  FolderPlus,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import type { StoreCategory, StoreRow } from '../types/database';
import { CATEGORY_ICON_KEYS, formatDateTime } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, ImageUploadField, useToast } from '../components/ToastContext';

interface CategoryFormState {
  id?: string;
  store_id: string;
  name: string;
  image_key: string;
  image_url: string;
  position: string;
  is_hidden: boolean;
}

export function CategoriesPage({
  categories,
  stores,
  productCountByCategory,
  selectedStoreId,
  onReload,
}: {
  categories: StoreCategory[];
  stores: StoreRow[];
  productCountByCategory: Record<string, number>;
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId || 'all');
  const [visFilter, setVisFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  const [editing, setEditing] = useState<CategoryFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const effectiveStore = selectedStoreId || storeFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => {
        if (effectiveStore !== 'all' && c.store_id !== effectiveStore) return false;
        const hidden = Boolean(c.is_hidden) || c.position >= 10000;
        if (visFilter === 'visible' && hidden) return false;
        if (visFilter === 'hidden' && !hidden) return false;
        if (!q) return true;
        const st = storeMap.get(c.store_id);
        return [c.name, c.image_key || '', st?.name || '']
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const ha = Boolean(a.is_hidden) || a.position >= 10000 ? 1 : 0;
        const hb = Boolean(b.is_hidden) || b.position >= 10000 ? 1 : 0;
        if (ha !== hb) return ha - hb;
        return a.position - b.position;
      });
  }, [categories, effectiveStore, visFilter, query, storeMap]);

  const handleToggleHidden = async (cat: StoreCategory) => {
    const currentlyHidden = Boolean(cat.is_hidden) || cat.position >= 10000;
    const nextHidden = !currentlyHidden;
    const nextPos = nextHidden
      ? cat.position < 10000
        ? 10000 + cat.position
        : cat.position
      : cat.position >= 10000
      ? cat.position - 10000
      : cat.position;

    const { error } = await supabase
      .from('store_categories')
      .update({ is_hidden: nextHidden, position: nextPos })
      .eq('id', cat.id);

    if (error) {
      if (error.message.includes('is_hidden')) {
        await supabase
          .from('store_categories')
          .update({ position: nextPos })
          .eq('id', cat.id);
      } else {
        notify(error.message, 'error');
        return;
      }
    }
    notify(nextHidden ? `تم إخفاء قسم «${cat.name}»` : `تم إظهار قسم «${cat.name}»`);
    await onReload();
  };

  const handleMove = async (cat: StoreCategory, delta: -1 | 1) => {
    const nextPos = Math.max(0, cat.position + delta);
    const { error } = await supabase
      .from('store_categories')
      .update({ position: nextPos })
      .eq('id', cat.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    await onReload();
  };

  const handleSeedStore = async () => {
    setSeeding(true);
    try {
      if (effectiveStore !== 'all') {
        const { data, error } = await supabase.rpc('admin_seed_store_categories', {
          p_store_id: effectiveStore,
        });
        if (error) throw error;
        notify(`تمت تعبئة الأقسام الإلزامية الناقصة (${data ?? 0} قسم مضاف)`);
      } else {
        let totalAdded = 0;
        for (const st of stores) {
          const { data, error } = await supabase.rpc('admin_seed_store_categories', {
            p_store_id: st.id,
          });
          if (!error && typeof data === 'number') totalAdded += data;
        }
        notify(`تمت تعبئة الأقسام الإلزامية لجميع المتاجر (أُضيف ${totalAdded} قسم)`);
      }
      await onReload();
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : 'تعذر تعبئة الأقسام — تأكد من تطبيق 0012 و 0013 في SQL Editor',
        'error'
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.store_id || !editing.name.trim()) {
      notify('يرجى تحديد المتجر واسم القسم', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: editing.store_id,
        name: editing.name.trim(),
        image_key: editing.image_key.trim() || null,
        image_url: editing.image_url.trim() || null,
        position: Number(editing.position || 0),
        is_hidden: editing.is_hidden,
      };

      if (editing.id) {
        const { error } = await supabase
          .from('store_categories')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_categories').insert(payload);
        if (error) throw error;
      }

      notify(editing.id ? 'تم حفظ تعديلات القسم' : 'تم إنشاء القسم بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ القسم', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('store_categories')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      notify(`تم حذف القسم «${deleteTarget.name}» ومواده التابعة`);
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
              placeholder="بحث باسم القسم أو رمز الأيقونة أو المتجر..."
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
            value={visFilter}
            onChange={(e) => setVisFilter(e.target.value as 'all' | 'visible' | 'hidden')}
          >
            <option value="all">الكل (ظاهر ومخفي)</option>
            <option value="visible">الأقسام الظاهرة فقط</option>
            <option value="hidden">الأقسام المخفية فقط</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-yellow"
            disabled={seeding}
            onClick={handleSeedStore}
          >
            <FolderPlus size={16} />
            {seeding
              ? 'جاري التعبئة...'
              : effectiveStore !== 'all'
              ? 'تعبئة الأقسام الإلزامية لهذا المتجر'
              : 'تعبئة الأقسام الإلزامية لكل المتاجر'}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setEditing({
                store_id:
                  effectiveStore !== 'all' ? effectiveStore : stores[0]?.id || '',
                name: '',
                image_key: 'vegetables',
                image_url: '',
                position: String(filtered.length),
                is_hidden: false,
              })
            }
          >
            <Plus size={16} />
            إضافة قسم جديد
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الصورة / الأيقونة</th>
              <th>اسم القسم</th>
              <th>المتجر</th>
              <th>عدد المواد</th>
              <th>الترتيب (Position)</th>
              <th>الظهور للمتسوقين</th>
              <th>تاريخ الإنشاء</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cat) => {
              const st = storeMap.get(cat.store_id);
              const hidden = Boolean(cat.is_hidden) || cat.position >= 10000;
              const pCount = productCountByCategory[cat.id] || 0;

              return (
                <tr key={cat.id} className={hidden ? 'row-faded' : ''}>
                  <td>
                    {cat.image_url ? (
                      <img src={cat.image_url} alt="" className="thumb" />
                    ) : (
                      <div className="thumb-placeholder" dir="ltr">
                        {cat.image_key ? cat.image_key.slice(0, 6) : 'قسم'}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{cat.name}</div>
                    {cat.image_key && (
                      <div style={{ fontSize: 11.5, color: '#64748b' }} dir="ltr">
                        key: {cat.image_key}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{st?.name || cat.store_id.slice(0, 8)}</td>
                  <td>
                    <span className="badge badge-blue">{pCount} مادة</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span dir="ltr" style={{ fontWeight: 700, minWidth: 32 }}>
                        {cat.position}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleMove(cat, -1)}
                        title="تقديم للأعلى"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleMove(cat, 1)}
                        title="تأخير للأسفل"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </td>
                  <td>
                    {hidden ? (
                      <span className="badge badge-slate">مخفي (آخر القائمة)</span>
                    ) : (
                      <span className="badge badge-green">ظاهر للمتسوقين</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>
                    {formatDateTime(cat.created_at)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleToggleHidden(cat)}
                      >
                        {hidden ? (
                          <>
                            <Eye size={14} /> إظهار
                          </>
                        ) : (
                          <>
                            <EyeOff size={14} /> إخفاء
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setEditing({
                            id: cat.id,
                            store_id: cat.store_id,
                            name: cat.name,
                            image_key: cat.image_key || '',
                            image_url: cat.image_url || '',
                            position: String(cat.position),
                            is_hidden: hidden,
                          })
                        }
                      >
                        <Edit3 size={14} /> تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(cat)}
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
                  لا توجد أقسام مطابقة لمعايير الفلترة
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
              <h3>{editing.id ? `تعديل القسم: ${editing.name}` : 'إضافة قسم جديد'}</h3>
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
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>اسم القسم (يقبل حتى ٣ أسطر في التطبيق) *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>رمز الأيقونة المدمجة في التطبيق (image_key)</label>
                    <select
                      className="select"
                      value={editing.image_key}
                      onChange={(e) => setEditing({ ...editing, image_key: e.target.value })}
                    >
                      <option value="">— بدون رمز مدمج (صورة خاصة فقط) —</option>
                      {CATEGORY_ICON_KEYS.map((ic) => (
                        <option key={ic.key} value={ic.key}>
                          {ic.label} ({ic.key})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>رقم الترتيب (Position)</label>
                    <input
                      type="number"
                      className="input"
                      dir="ltr"
                      value={editing.position}
                      onChange={(e) => setEditing({ ...editing, position: e.target.value })}
                    />
                  </div>

                  <div className="field" style={{ justifyContent: 'flex-end' }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editing.is_hidden}
                        onChange={(e) =>
                          setEditing({ ...editing, is_hidden: e.target.checked })
                        }
                      />
                      إخفاء القسم عن المتسوقين (ينزل لآخر قائمة التاجر بلون هافت)
                    </label>
                  </div>

                  <div className="col-span-2">
                    <ImageUploadField
                      label="صورة مخصصة للقسم (اختياري — تحل محل الأيقونة المدمجة)"
                      value={editing.image_url}
                      onChange={(url) => setEditing({ ...editing, image_url: url })}
                      folderPath={`${editing.store_id || 'admin'}/sections`}
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
                  {saving ? 'جاري الحفظ...' : 'حفظ القسم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف القسم"
        message={`هل تريد حذف القسم «${deleteTarget?.name}»؟ ملاحظة: المواد المرتبطة بهذا القسم ستُحذف معه تلقائياً (أو يمكنك إخفاء القسم بدلاً من حذفه).`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

