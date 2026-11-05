import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  X,
  Layers,
  Images,
} from 'lucide-react';
import type {
  ProductExtraUnit,
  ProductRow,
  StoreCategory,
  StoreRow,
} from '../types/database';
import { formatMoney, PRODUCT_UNITS } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { ConfirmModal, ImageUploadField, useToast } from '../components/ToastContext';
import { GalleryPickerModal } from '../components/GalleryPickerModal';

interface ProductFormState {
  id?: string;
  store_id: string;
  category_id: string;
  name: string;
  name_en: string;
  price: string;
  unit: string;
  quantity: string;
  available: boolean;
  position: string;
  source: string;
  image_url: string;
  image_key: string;
  extra_units: ProductExtraUnit[];
  classification?: string;
  nutrition_per_100g?: string;
  calories_per_100g?: string;
  fiber_per_100g?: string;
  vitamins_minerals?: string;
  health_benefits?: string;
  warnings?: string;
  uses?: string;
  origin?: string;
  storage_method?: string;
}

export function ProductsPage({
  products,
  categories,
  stores,
  selectedStoreId,
  onReload,
}: {
  products: ProductRow[];
  categories: StoreCategory[];
  stores: StoreRow[];
  selectedStoreId: string;
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availFilter, setAvailFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<ProductFormState | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const effectiveStore = selectedStoreId || storeFilter;

  const storeCategories = useMemo(
    () =>
      effectiveStore === 'all'
        ? categories
        : categories.filter((c) => c.store_id === effectiveStore),
    [categories, effectiveStore]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (effectiveStore !== 'all' && p.store_id !== effectiveStore) return false;
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
      if (availFilter === 'available' && !p.available) return false;
      if (availFilter === 'unavailable' && p.available) return false;
      if (!q) return true;
      const st = storeMap.get(p.store_id);
      const cat = p.category_id ? categoryMap.get(p.category_id) : null;
      return [
        p.name,
        p.name_en || '',
        p.source || '',
        p.unit,
        st?.name || '',
        cat?.name || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [products, effectiveStore, categoryFilter, availFilter, query, storeMap, categoryMap]);

  const openNew = () => {
    const stId = effectiveStore !== 'all' ? effectiveStore : stores[0]?.id || '';
    const firstCat = categories.find((c) => c.store_id === stId)?.id || '';
    setEditing({
      store_id: stId,
      category_id: firstCat,
      name: '',
      name_en: '',
      price: '0',
      unit: 'كيلو',
      quantity: '10',
      available: true,
      position: String(filtered.length),
      source: '',
      image_url: '',
      image_key: '',
      extra_units: [],
      classification: '',
      nutrition_per_100g: '',
      calories_per_100g: '',
      fiber_per_100g: '',
      vitamins_minerals: '',
      health_benefits: '',
      warnings: '',
      uses: '',
      origin: '',
      storage_method: '',
    });
  };

  const openEdit = (p: ProductRow) => {
    setEditing({
      id: p.id,
      store_id: p.store_id,
      category_id: p.category_id || '',
      name: p.name,
      name_en: p.name_en || '',
      price: String(p.price),
      unit: p.unit || 'كيلو',
      quantity: String(p.quantity ?? 0),
      available: Boolean(p.available),
      position: String(p.position ?? 0),
      source: p.source || '',
      image_url: p.image_url || '',
      image_key: p.image_key || '',
      extra_units: Array.isArray(p.extra_units) ? p.extra_units : [],
      classification: p.classification || '',
      nutrition_per_100g: p.nutrition_per_100g || '',
      calories_per_100g: p.calories_per_100g || '',
      fiber_per_100g: p.fiber_per_100g || '',
      vitamins_minerals: p.vitamins_minerals || '',
      health_benefits: p.health_benefits || '',
      warnings: p.warnings || '',
      uses: p.uses || '',
      origin: p.origin || '',
      storage_method: p.storage_method || '',
    });
  };

  const handleToggleAvailable = async (p: ProductRow) => {
    const next = !p.available;
    const { error } = await supabase
      .from('products')
      .update({ available: next })
      .eq('id', p.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(next ? `تم تفعيل توفر «${p.name}»` : `تم إيقاف توفر «${p.name}»`);
    await onReload();
  };

  const handleDuplicate = async (p: ProductRow) => {
    const { error } = await supabase.from('products').insert({
      store_id: p.store_id,
      category_id: p.category_id,
      name: `${p.name} (نسخة)`,
      name_en: p.name_en,
      price: p.price,
      unit: p.unit,
      quantity: p.quantity,
      available: p.available,
      position: (p.position || 0) + 1,
      image_key: p.image_key,
      image_url: p.image_url,
      source: p.source,
      extra_units: p.extra_units || [],
    });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('تم استنساخ المادة بنجاح');
    await onReload();
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete') {
      if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} مادة نهائياً؟`)) return;
      const { error } = await supabase.from('products').delete().in('id', selectedIds);
      if (error) {
        notify(error.message, 'error');
        return;
      }
      notify(`تم حذف ${selectedIds.length} مادة`);
    } else {
      const { error } = await supabase
        .from('products')
        .update({ available: action === 'enable' })
        .in('id', selectedIds);
      if (error) {
        notify(error.message, 'error');
        return;
      }
      notify(`تم تحديث توفر ${selectedIds.length} مادة`);
    }
    setSelectedIds([]);
    await onReload();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.store_id || !editing.name.trim()) {
      notify('يرجى تحديد المتجر واسم المادة', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: editing.store_id,
        category_id: editing.category_id || null,
        name: editing.name.trim(),
        name_en: editing.name_en.trim() || null,
        price: Math.max(0, Number(editing.price || 0)),
        unit: editing.unit.trim() || 'كيلو',
        quantity: Number(editing.quantity || 0),
        available: editing.available,
        position: Number(editing.position || 0),
        source: editing.source.trim() || null,
        image_url: editing.image_url.trim() || null,
        image_key: editing.image_key.trim() || null,
        extra_units: editing.extra_units.filter((u) => u.unit.trim() !== ''),
        classification: editing.classification?.trim() || null,
        nutrition_per_100g: editing.nutrition_per_100g?.trim() || null,
        calories_per_100g: editing.calories_per_100g?.trim() || null,
        fiber_per_100g: editing.fiber_per_100g?.trim() || null,
        vitamins_minerals: editing.vitamins_minerals?.trim() || null,
        health_benefits: editing.health_benefits?.trim() || null,
        warnings: editing.warnings?.trim() || null,
        uses: editing.uses?.trim() || null,
        origin: editing.origin?.trim() || null,
        storage_method: editing.storage_method?.trim() || null,
      };

      if (editing.id) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }

      // حفظ تلقائي أو تحديث في موسوعة المواد لتعميم المعلومات
      if (editing.name.trim()) {
        try {
          await supabase.from('product_knowledge').upsert({
            name: editing.name.trim(),
            name_en: editing.name_en.trim() || null,
            classification: editing.classification?.trim() || null,
            nutrition_per_100g: editing.nutrition_per_100g?.trim() || null,
            calories_per_100g: editing.calories_per_100g?.trim() || null,
            fiber_per_100g: editing.fiber_per_100g?.trim() || null,
            vitamins_minerals: editing.vitamins_minerals?.trim() || null,
            health_benefits: editing.health_benefits?.trim() || null,
            warnings: editing.warnings?.trim() || null,
            uses: editing.uses?.trim() || null,
            origin: editing.origin?.trim() || null,
            storage_method: editing.storage_method?.trim() || null,
            image_url: editing.image_url.trim() || null,
          }, { onConflict: 'name' });
        } catch (_) {}
      }

      notify(editing.id ? 'تم حفظ تعديلات المادة بنجاح' : 'تمت إضافة المادة بنجاح');
      setEditing(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ المادة', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleNameBlurOrChange = async (nameVal: string) => {
    const clean = nameVal.trim();
    if (!clean) return;
    try {
      const { data } = await supabase
        .from('product_knowledge')
        .select('*')
        .ilike('name', clean)
        .limit(1);

      if (data && data.length > 0) {
        const item = data[0];
        setEditing((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            name_en: prev.name_en || item.name_en || '',
            classification: item.classification || prev.classification || '',
            nutrition_per_100g: item.nutrition_per_100g || prev.nutrition_per_100g || '',
            calories_per_100g: item.calories_per_100g || prev.calories_per_100g || '',
            fiber_per_100g: item.fiber_per_100g || prev.fiber_per_100g || '',
            vitamins_minerals: item.vitamins_minerals || prev.vitamins_minerals || '',
            health_benefits: item.health_benefits || prev.health_benefits || '',
            warnings: item.warnings || prev.warnings || '',
            uses: item.uses || prev.uses || '',
            origin: item.origin || prev.origin || '',
            storage_method: item.storage_method || prev.storage_method || '',
            image_url: prev.image_url || item.image_url || '',
          };
        });
        notify(`تم جلب معلومات «${item.name}» تلقائياً من بنك معلومات المواد!`);
      }
    } catch (_) {}
  };

  const handleSaveToKnowledge = async () => {
    if (!editing || !editing.name.trim()) {
      notify('يرجى كتابة اسم المادة أولاً لحفظها في الموسوعة', 'error');
      return;
    }
    try {
      const { error } = await supabase.from('product_knowledge').upsert({
        name: editing.name.trim(),
        name_en: editing.name_en.trim() || null,
        classification: editing.classification?.trim() || null,
        nutrition_per_100g: editing.nutrition_per_100g?.trim() || null,
        calories_per_100g: editing.calories_per_100g?.trim() || null,
        fiber_per_100g: editing.fiber_per_100g?.trim() || null,
        vitamins_minerals: editing.vitamins_minerals?.trim() || null,
        health_benefits: editing.health_benefits?.trim() || null,
        warnings: editing.warnings?.trim() || null,
        uses: editing.uses?.trim() || null,
        origin: editing.origin?.trim() || null,
        storage_method: editing.storage_method?.trim() || null,
        image_url: editing.image_url.trim() || null,
      }, { onConflict: 'name' });
      if (error) throw error;
      notify(`تم حفظ مادة «${editing.name}» في بنك معلومات وموسوعة المواد بنجاح`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الحفظ في بنك المعلومات', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      notify(`تم حذف المادة «${deleteTarget.name}»`);
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حذف المادة', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const modalCategories = useMemo(
    () =>
      editing
        ? categories.filter((c) => c.store_id === editing.store_id)
        : [],
    [categories, editing]
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
              placeholder="بحث باسم المادة، الاسم الأجنبي، المصدر، المتجر..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {!selectedStoreId && (
            <select
              className="select"
              value={storeFilter}
              onChange={(e) => {
                setStoreFilter(e.target.value);
                setCategoryFilter('all');
              }}
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
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">كل الأقسام</option>
            {storeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={availFilter}
            onChange={(e) =>
              setAvailFilter(e.target.value as 'all' | 'available' | 'unavailable')
            }
          >
            <option value="all">كل الحالات</option>
            <option value="available">متوفر فقط</option>
            <option value="unavailable">غير متوفر (نافد)</option>
          </select>
        </div>

        <div className="toolbar-actions">
          {selectedIds.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleBulkAction('enable')}
              >
                <CheckCircle2 size={14} /> تفعيل ({selectedIds.length})
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleBulkAction('disable')}
              >
                <XCircle size={14} /> إيقاف ({selectedIds.length})
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleBulkAction('delete')}
              >
                <Trash2 size={14} /> حذف ({selectedIds.length})
              </button>
            </>
          )}

          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} />
            إضافة مادة جديدة
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 && selectedIds.length === filtered.length
                  }
                  onChange={(e) =>
                    setSelectedIds(e.target.checked ? filtered.map((x) => x.id) : [])
                  }
                />
              </th>
              <th>الصورة</th>
              <th>المادة والمصدر</th>
              <th>المتجر والقسم</th>
              <th>السعر والوحدة</th>
              <th>الوحدات الإضافية</th>
              <th>الكمية والتوفر</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const st = storeMap.get(p.store_id);
              const cat = p.category_id ? categoryMap.get(p.category_id) : null;
              const extras = Array.isArray(p.extra_units) ? p.extra_units : [];
              const checked = selectedIds.includes(p.id);

              return (
                <tr key={p.id} className={!p.available ? 'row-faded' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked
                            ? [...prev, p.id]
                            : prev.filter((id) => id !== p.id)
                        )
                      }
                    />
                  </td>
                  <td>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="thumb" />
                    ) : (
                      <div className="thumb-placeholder">مادة</div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                    {p.name_en && (
                      <div style={{ fontSize: 11.5, color: '#64748b' }} dir="ltr">
                        {p.name_en}
                      </div>
                    )}
                    {p.source && (
                      <div style={{ fontSize: 11.5, color: '#0369a1' }}>
                        المصدر: {p.source}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{st?.name || '—'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      القسم: {cat?.name || 'بدون قسم'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, color: '#15803d' }}>
                      {formatMoney(p.price, st?.currency)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>لكل {p.unit}</div>
                  </td>
                  <td>
                    {extras.length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {extras.map((u, idx) => (
                          <span key={idx} className="badge badge-slate">
                            {u.unit}: {formatMoney(u.price, st?.currency)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                      المخزون: <strong>{p.quantity}</strong>
                    </div>
                    <button
                      type="button"
                      className={`badge ${p.available ? 'badge-green' : 'badge-red'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => handleToggleAvailable(p)}
                    >
                      {p.available ? '✓ متوفر' : '✕ غير متوفر'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(p)}
                      >
                        <Edit3 size={14} /> تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDuplicate(p)}
                        title="استنساخ المادة"
                      >
                        <Copy size={14} />
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
                <td colSpan={8} className="empty-state">
                  لا توجد مواد مطابقة لمعايير الفلترة
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
              <h3>{editing.id ? `تعديل المادة: ${editing.name}` : 'إضافة مادة جديدة'}</h3>
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
                        const newSt = e.target.value;
                        const firstCat =
                          categories.find((c) => c.store_id === newSt)?.id || '';
                        setEditing({
                          ...editing,
                          store_id: newSt,
                          category_id: firstCat,
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
                    <label>القسم داخل المتجر</label>
                    <select
                      className="select"
                      value={editing.category_id}
                      onChange={(e) =>
                        setEditing({ ...editing, category_id: e.target.value })
                      }
                    >
                      <option value="">— بدون قسم محدد —</option>
                      {modalCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.is_hidden ? '(مخفي)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>اسم المادة (عربي) *</span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 700,
                          padding: 0,
                        }}
                        onClick={() => handleNameBlurOrChange(editing.name)}
                      >
                        🔍 تعبئة من الموسوعة
                      </button>
                    </label>
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="مثال: سلق، بندورة، تفاح..."
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onBlur={(e) => handleNameBlurOrChange(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>الاسم بالإنجليزية / اللاتينية (اختياري)</label>
                    <input
                      type="text"
                      className="input"
                      dir="ltr"
                      value={editing.name_en}
                      onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>
                      السعر الأساسي ({storeMap.get(editing.store_id)?.currency || 'عملة المتجر'}) *
                    </label>
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
                    <label>وحدة البيع الأساسية *</label>
                    <input
                      type="text"
                      list="product-units-list"
                      className="input"
                      required
                      value={editing.unit}
                      onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                    />
                    <datalist id="product-units-list">
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>

                  <div className="field">
                    <label>الكمية المتوفرة</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      dir="ltr"
                      value={editing.quantity}
                      onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>معلومات المصدر / المنشأ (تظهر تحت السعر في صفحة المادة)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="مثلاً: الأردن / إنتاج محلي / مستورد..."
                      value={editing.source}
                      onChange={(e) => setEditing({ ...editing, source: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>ترتيب العرض (Position)</label>
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
                        checked={editing.available}
                        onChange={(e) =>
                          setEditing({ ...editing, available: e.target.checked })
                        }
                      />
                      المادة متوفرة حالياً للبيع
                    </label>
                  </div>

                  <div className="col-span-2">
                    <ImageUploadField
                      label="صورة المادة (تُحفظ في دلو catalog)"
                      value={editing.image_url}
                      onChange={(url) => setEditing({ ...editing, image_url: url })}
                      folderPath={`${editing.store_id || 'admin'}/goods`}
                    />
                    <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowGalleryPicker(true)}
                      >
                        <Images size={14} />
                        اختيار صورة من معرض صور التطبيق
                      </button>
                    </div>
                  </div>

                  {/* Extra Units Editor */}
                  <div
                    className="col-span-2"
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: 13.5 }}>
                        <Layers size={15} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
                        وحدات البيع الإضافية للمادة (مثلاً: صندوق، كرتونة، شوال...)
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            extra_units: [
                              ...editing.extra_units,
                              { unit: 'صندوق', price: 0, quantity: 1 },
                            ],
                          })
                        }
                      >
                        <Plus size={13} /> إضافة وحدة بيع
                      </button>
                    </div>

                    {editing.extra_units.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#64748b' }}>
                        لا توجد وحدات إضافية — تُباع المادة بالوحدة الأساسية فقط.
                      </div>
                    ) : (
                      editing.extra_units.map((eu, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr auto',
                            gap: 8,
                            marginTop: 8,
                          }}
                        >
                          <input
                            type="text"
                            list="product-units-list"
                            className="input"
                            placeholder="اسم الوحدة (مثلاً: صندوق)"
                            value={eu.unit}
                            onChange={(e) => {
                              const next = [...editing.extra_units];
                              next[idx] = { ...next[idx], unit: e.target.value };
                              setEditing({ ...editing, extra_units: next });
                            }}
                          />
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            dir="ltr"
                            placeholder="السعر"
                            value={eu.price}
                            onChange={(e) => {
                              const next = [...editing.extra_units];
                              next[idx] = { ...next[idx], price: Number(e.target.value) };
                              setEditing({ ...editing, extra_units: next });
                            }}
                          />
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            dir="ltr"
                            placeholder="الكمية المتوفرة"
                            value={eu.quantity}
                            onChange={(e) => {
                              const next = [...editing.extra_units];
                              next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                              setEditing({ ...editing, extra_units: next });
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              setEditing({
                                ...editing,
                                extra_units: editing.extra_units.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* قسم موسوعة وبيانات المادة الغذائية والصحية (حسب جداول المنصة) */}
                  <div
                    className="col-span-2"
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 12,
                      padding: 16,
                      marginTop: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        marginBottom: 14,
                        paddingBottom: 10,
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 900, fontSize: 14.5, color: '#0f172a' }}>
                          🥗 موسوعة وبيانات المادة الغذائية والصحية (حسب جداول المنصة)
                        </span>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
                          تُملأ هذه الخانات تلقائياً بمجرد كتابة اسم المادة، ويمكنك حفظ وتعديل بياناتها في قاعدة البيانات.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleNameBlurOrChange(editing.name)}
                          title="استرجاع معلومات المادة من بنك المعلومات"
                        >
                          <Search size={14} /> بحث في الموسوعة
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleSaveToKnowledge}
                          title="حفظ بيانات هذه المادة في الموسوعة للمستقبل"
                        >
                          <CheckCircle2 size={14} /> حفظ في بنك المعلومات
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                      <div className="field">
                        <label>التصنيف (ورقيات، خضار، فواكه، لحوم...)</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="مثال: ورقيات"
                          value={editing.classification || ''}
                          onChange={(e) => setEditing({ ...editing, classification: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>الموطن الأصلي</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="مثال: منطقة البحر الأبيض المتوسط (صقلية)..."
                          value={editing.origin || ''}
                          onChange={(e) => setEditing({ ...editing, origin: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>السعرات الحرارية: "لكل 100 غ"</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="مثال: 19 سعرة حرارية لكل 100 غرام نيء..."
                          value={editing.calories_per_100g || ''}
                          onChange={(e) => setEditing({ ...editing, calories_per_100g: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>يحتوي على: "لكل 100 غ."</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="مثال: ماء 92.6 غرام، بروتين 1.8 غرام..."
                          value={editing.nutrition_per_100g || ''}
                          onChange={(e) => setEditing({ ...editing, nutrition_per_100g: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>الألياف: "لكل 100 غ."</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="مثال: 1.6 غرام لكل 100 غرام نيء..."
                          value={editing.fiber_per_100g || ''}
                          onChange={(e) => setEditing({ ...editing, fiber_per_100g: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>الفيتامينات والمعادن: "لكل 100 غ."</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="مثال: فيتامين K: 830 ميكروغرام، فيتامين A..."
                          value={editing.vitamins_minerals || ''}
                          onChange={(e) => setEditing({ ...editing, vitamins_minerals: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                      <div className="field">
                        <label>الفوائد الصحية: "لكل 100 غ."</label>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="يقوي العظام، ينظم ضغط الدم، مضاد أكسدة، يحسن الهضم..."
                          value={editing.health_benefits || ''}
                          onChange={(e) => setEditing({ ...editing, health_benefits: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>لا ينصح به لـ:</label>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="مرضى حصى الكلى، مرضى سيولة الدم..."
                          value={editing.warnings || ''}
                          onChange={(e) => setEditing({ ...editing, warnings: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>الاستخدامات:</label>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="محاشي، سلطات، معجنات، مقلي مع البصل وزيت الزيتون..."
                          value={editing.uses || ''}
                          onChange={(e) => setEditing({ ...editing, uses: e.target.value })}
                        />
                      </div>

                      <div className="field">
                        <label>طريقة الحفظ:</label>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="يحفظ في الثلاجة 4 إلى 5 أيام داخل كيس..."
                          value={editing.storage_method || ''}
                          onChange={(e) => setEditing({ ...editing, storage_method: e.target.value })}
                        />
                      </div>
                    </div>
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
                  {saving ? 'جاري الحفظ...' : 'حفظ المادة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف المادة"
        message={`هل أنت متأكد من حذف المادة «${deleteTarget?.name}» نهائياً من المتجر؟`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {editing && (
        <GalleryPickerModal
          open={showGalleryPicker}
          onClose={() => setShowGalleryPicker(false)}
          initialCategory={
            categories.find((c) => c.id === editing.category_id)?.name || undefined
          }
          onSelect={(url, title) => {
            setEditing((prev) =>
              prev
                ? {
                    ...prev,
                    image_url: url,
                    name: prev.name.trim() ? prev.name : title,
                  }
                : prev
            );
            notify(`تم اختيار صورة «${title}» من المعرض`);
          }}
        />
      )}
    </div>
  );
}

