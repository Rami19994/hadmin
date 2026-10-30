import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Copy,
  FolderPlus,
  X,
  Image as ImageIcon,
  Check,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { AppGalleryItem } from '../types/database';
import { DEFAULT_GALLERY_CATEGORIES, formatDateTime } from '../lib/constants';
import { supabase, uploadCatalogMedia } from '../lib/supabase';
import { ConfirmModal, useToast } from '../components/ToastContext';

interface PendingUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  category: string;
}

export function GalleryPage({
  galleryItems,
  onReload,
}: {
  galleryItems: AppGalleryItem[];
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingUploadItem[]>([]);
  const [defaultUploadCategory, setDefaultUploadCategory] = useState<string>('خضار وفواكه');
  const [customUploadCategory, setCustomUploadCategory] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Edit single item state
  const [editingItem, setEditingItem] = useState<AppGalleryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editPosition, setEditPosition] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<AppGalleryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Unique list of all categories present in the items + standard ones
  const allCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_GALLERY_CATEGORIES);
    for (const item of galleryItems) {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    }
    return Array.from(set);
  }, [galleryItems]);

  // Counts by category
  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of galleryItems) {
      const cat = item.category || 'عام';
      map[cat] = (map[cat] || 0) + 1;
    }
    return map;
  }, [galleryItems]);

  // Filtered items
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return galleryItems
      .filter((item) => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (statusFilter === 'active' && !item.is_active) return false;
        if (statusFilter === 'inactive' && item.is_active) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.image_key && item.image_key.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category, 'ar');
        return a.position - b.position;
      });
  }, [galleryItems, selectedCategory, statusFilter, query]);

  // Handle files selected from device
  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const chosenCat = customUploadCategory.trim() || defaultUploadCategory;
    const newItems: PendingUploadItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // strip extension and replace dashes/underscores with spaces
      const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const cleanTitle = rawName.replace(/[-_]+/g, ' ').trim();

      newItems.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        title: cleanTitle,
        category: chosenCat,
      });
    }

    setPendingItems((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const removePendingItem = (id: string) => {
    setPendingItems((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const updatePendingItem = (id: string, updates: Partial<PendingUploadItem>) => {
    setPendingItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
    );
  };

  // Perform upload of pending items to Supabase Storage and Insert to DB
  const handleBatchUpload = async () => {
    if (pendingItems.length === 0) return;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: pendingItems.length });

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < pendingItems.length; i++) {
      const it = pendingItems[i];
      setUploadProgress({ current: i + 1, total: pendingItems.length });

      try {
        // Upload image file to bucket 'catalog/app_gallery'
        const { publicUrl } = await uploadCatalogMedia(it.file, 'app_gallery');

        // Insert row into public.app_gallery
        const { error } = await supabase.from('app_gallery').insert({
          title: it.title.trim() || 'صورة مادة',
          category: it.category.trim() || 'عام',
          image_url: publicUrl,
          position: 0,
          is_active: true,
        });

        if (error) throw error;
        successCount++;
        URL.revokeObjectURL(it.previewUrl);
      } catch (err) {
        errors.push(`${it.title}: ${err instanceof Error ? err.message : 'فشل الرفع'}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(null);

    if (successCount > 0) {
      notify(`تم رفع وإضافة ${successCount} صورة بنجاح إلى معرض التطبيق`);
      setPendingItems([]);
      setIsUploadModalOpen(false);
      await onReload();
    }
    if (errors.length > 0) {
      notify(`تعذر رفع بعض الصور (${errors.length}): ${errors.join(', ')}`, 'error');
    }
  };

  // Toggle active status
  const handleToggleActive = async (item: AppGalleryItem) => {
    const nextState = !item.is_active;
    const { error } = await supabase
      .from('app_gallery')
      .update({ is_active: nextState })
      .eq('id', item.id);

    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(nextState ? `تم تفعيل ظهور صورة «${item.title}» في التطبيق` : `تم إخفاء صورة «${item.title}» من التطبيق`);
    await onReload();
  };

  // Start edit item
  const startEdit = (item: AppGalleryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    if (DEFAULT_GALLERY_CATEGORIES.includes(item.category)) {
      setEditCategory(item.category);
      setEditCustomCategory('');
    } else {
      setEditCategory('__custom__');
      setEditCustomCategory(item.category);
    }
    setEditPosition(item.position || 0);
  };

  // Save edit item
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const finalCategory =
      editCategory === '__custom__'
        ? editCustomCategory.trim() || 'عام'
        : editCategory.trim() || 'عام';

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('app_gallery')
        .update({
          title: editTitle.trim() || editingItem.title,
          category: finalCategory,
          position: editPosition,
        })
        .eq('id', editingItem.id);

      if (error) throw error;
      notify('تم حفظ التعديلات بنجاح');
      setEditingItem(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الحفظ', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete item
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('app_gallery')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      notify(`تم حذف صورة «${deleteTarget.title}» من معرض التطبيق`);
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الحذف', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* Top action toolbar */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="toolbar-filters" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="search-box" style={{ minWidth: 260 }}>
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث باسم الصورة أو القسم..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            className="select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">كل الأقسام ({galleryItems.length})</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({countsByCategory[cat] || 0})
              </option>
            ))}
          </select>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">كل الحالات</option>
            <option value="active">الظاهرة في التطبيق فقط</option>
            <option value="inactive">المخفية فقط</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPendingItems([]);
              setIsUploadModalOpen(true);
            }}
          >
            <Upload size={16} />
            إضافة صور للمعرض من الجهاز
          </button>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 10,
          marginBottom: 16,
          scrollbarWidth: 'thin',
        }}
      >
        <button
          type="button"
          className={`tab-pill ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          الكل ({galleryItems.length})
        </button>
        {allCategories.map((cat) => {
          const count = countsByCategory[cat] || 0;
          return (
            <button
              key={cat}
              type="button"
              className={`tab-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Gallery Items Grid */}
      {filtered.length === 0 ? (
        <div
          className="panel"
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            color: '#64748b',
          }}
        >
          <ImageIcon size={48} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>
            {galleryItems.length === 0
              ? 'معرض صور التطبيق فارغ حالياً'
              : 'لا توجد صور مطابقة لمعايير البحث والتصفية'}
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: 13.5 }}>
            {galleryItems.length === 0
              ? 'يمكنك إضافة ورفع صور جديدة من جهازك لتظهر لجميع المتاجر في أقسام التطبيق.'
              : 'جرّب تغيير عبارة البحث أو اختيار قسم آخر.'}
          </p>
          {galleryItems.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Upload size={16} />
              رفع أول دفعة صور من الجهاز
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((item) => (
            <div
              key={item.id}
              className="panel"
              style={{
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                opacity: item.is_active ? 1 : 0.6,
                border: item.is_active ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
                background: item.is_active ? '#fff' : '#f8fafc',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Image Preview Box */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  border: '1px solid #e2e8f0',
                }}
              >
                <img
                  src={item.image_url}
                  alt={item.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  loading="lazy"
                />

                {/* Status Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: item.is_active ? '#16a34a' : '#64748b',
                    color: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                >
                  {item.is_active ? 'ظاهر' : 'مخفي'}
                </div>
              </div>

              {/* Title & Category Info */}
              <div style={{ marginTop: 10, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#0f172a',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.title}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  <Layers size={11} />
                  {item.category}
                </div>
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 8,
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '4px 6px' }}
                  title={item.is_active ? 'إخفاء من التطبيق' : 'إظهار في التطبيق'}
                  onClick={() => handleToggleActive(item)}
                >
                  {item.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '4px 6px' }}
                  title="نسخ رابط الصورة"
                  onClick={() => {
                    navigator.clipboard.writeText(item.image_url);
                    notify('تم نسخ رابط الصورة إلى الحافظة');
                  }}
                >
                  <Copy size={14} />
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '4px 6px' }}
                  title="تعديل الاسم أو القسم"
                  onClick={() => startEdit(item)}
                >
                  <Edit3 size={14} />
                </button>

                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ padding: '4px 6px' }}
                  title="حذف من المعرض"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal (من الجهاز) */}
      {isUploadModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !isUploading && setIsUploadModalOpen(false)}
        >
          <div
            className="modal-panel"
            style={{ maxWidth: 740 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={18} color="#16a34a" />
                <h3 style={{ margin: 0 }}>إضافة صور إلى معرض صور التطبيق من الجهاز</h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isUploading}
                onClick={() => setIsUploadModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Category Default Selection for new batch */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>
                  القسم أو التصنيف التلقائي للصور المرفوعة:
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <select
                    className="select"
                    style={{ flex: 1, minWidth: 200 }}
                    value={defaultUploadCategory}
                    onChange={(e) => {
                      setDefaultUploadCategory(e.target.value);
                      if (e.target.value !== '__custom__') setCustomUploadCategory('');
                    }}
                  >
                    {DEFAULT_GALLERY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__custom__">+ قسم مخصص آخر...</option>
                  </select>

                  {defaultUploadCategory === '__custom__' && (
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1, minWidth: 200 }}
                      placeholder="اكتب اسم القسم المخصص الجديد..."
                      value={customUploadCategory}
                      onChange={(e) => setCustomUploadCategory(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Upload Dropzone */}
              <label
                style={{
                  border: '2px dashed #94a3b8',
                  borderRadius: 12,
                  padding: '30px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  background: '#f8fafc',
                  transition: 'background 0.2s',
                  marginBottom: 16,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (isUploading) return;
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    const chosenCat = customUploadCategory.trim() || defaultUploadCategory;
                    const newItems: PendingUploadItem[] = [];
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      if (!file.type.startsWith('image/')) continue;
                      const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                      newItems.push({
                        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                        file,
                        previewUrl: URL.createObjectURL(file),
                        title: rawName.replace(/[-_]+/g, ' ').trim(),
                        category: chosenCat,
                      });
                    }
                    setPendingItems((prev) => [...prev, ...newItems]);
                  }
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={isUploading}
                  onChange={handleFilesPicked}
                />
                <Upload size={32} color="#0284c7" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                  اضغط لاختيار صورة أو عدة صور من جهازك (أو اسحبها إلى هنا)
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  يدعم صور JPG, PNG, WEBP — يمكنك رفع عدة صور دفعة واحدة
                </div>
              </label>

              {/* Pending Upload List Preview */}
              {pendingItems.length > 0 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>
                      الصور المختارة للرفع ({pendingItems.length}):
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        for (const it of pendingItems) URL.revokeObjectURL(it.previewUrl);
                        setPendingItems([]);
                      }}
                      disabled={isUploading}
                    >
                      إلغاء الكل
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: 320,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 4,
                    }}
                  >
                    {pendingItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 8,
                        }}
                      >
                        <img
                          src={item.previewUrl}
                          alt="preview"
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 6,
                            objectFit: 'cover',
                            border: '1px solid #cbd5e1',
                          }}
                        />

                        {/* Title input */}
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: 11, color: '#64748b' }}>اسم الصورة:</label>
                          <input
                            type="text"
                            className="input"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                            value={item.title}
                            disabled={isUploading}
                            onChange={(e) => updatePendingItem(item.id, { title: e.target.value })}
                          />
                        </div>

                        {/* Category input */}
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: 11, color: '#64748b' }}>القسم:</label>
                          <input
                            type="text"
                            className="input"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                            value={item.category}
                            disabled={isUploading}
                            onChange={(e) =>
                              updatePendingItem(item.id, { category: e.target.value })
                            }
                          />
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ marginTop: 14 }}
                          disabled={isUploading}
                          onClick={() => removePendingItem(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress Indicator */}
              {uploadProgress && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>جاري رفع الصور إلى Supabase Storage...</span>
                    <span>
                      {uploadProgress.current} من {uploadProgress.total}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: '#e2e8f0',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        background: '#16a34a',
                        width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                        transition: 'width 0.2s',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                disabled={isUploading}
                onClick={() => setIsUploadModalOpen(false)}
              >
                إغلاق
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isUploading || pendingItems.length === 0}
                onClick={handleBatchUpload}
              >
                <Check size={16} />
                {isUploading
                  ? `جاري الرفع (${uploadProgress?.current || 0}/${uploadProgress?.total || 0})...`
                  : `بدء رفع وحفظ (${pendingItems.length}) صورة`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div
          className="modal-backdrop"
          onClick={() => !isSavingEdit && setEditingItem(null)}
        >
          <div
            className="modal-panel"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>تعديل بيانات الصورة</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditingItem(null)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <img
                    src={editingItem.image_url}
                    alt={editingItem.title}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 10,
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>

                <div className="form-grid">
                  <div className="col-span-2 field">
                    <label>اسم المادة / الصورة *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 field">
                    <label>القسم / التصنيف *</label>
                    <select
                      className="select"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                    >
                      {DEFAULT_GALLERY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__custom__">+ كتابة قسم مخصص...</option>
                    </select>
                  </div>

                  {editCategory === '__custom__' && (
                    <div className="col-span-2 field">
                      <label>اسم القسم المخصص</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="مثال: مستلزمات العيد"
                        value={editCustomCategory}
                        onChange={(e) => setEditCustomCategory(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="field">
                    <label>رقم الترتيب (Position)</label>
                    <input
                      type="number"
                      className="input"
                      value={editPosition}
                      onChange={(e) => setEditPosition(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingItem(null)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف صورة من المعرض"
        message={`هل أنت متأكد من حذف صورة «${deleteTarget?.title}» من معرض التطبيق العام؟`}
        busy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

