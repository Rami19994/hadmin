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
  ShoppingCart,
  Package,
  Store,
  BookOpen,
  Filter,
  Maximize2,
  ExternalLink,
  RefreshCw,
  Tag,
  Info,
  Wand2,
} from 'lucide-react';
import type {
  AppGalleryItem,
  StoreCategory,
  ProductRow,
  StoreRow,
  ProductKnowledgeRow,
} from '../types/database';
import { DEFAULT_GALLERY_CATEGORIES, formatDateTime } from '../lib/constants';
import { supabase, uploadCatalogMedia } from '../lib/supabase';
import { ConfirmModal, useToast } from '../components/ToastContext';

export type ImageSourceFilter = 'all' | 'gallery' | 'categories' | 'products' | 'knowledge';

export interface CategoryVisual {
  emoji: string;
  bg: string;
  color: string;
  defaultImg: string;
}

/**
 * خريطة ذكية تعيد أيقونة وصورة افتراضية عالية الدقة حسب اسم المادة أو القسم
 */
export function getCategoryVisual(name: string = '', category: string = ''): CategoryVisual {
  const text = (name + ' ' + category).toLowerCase();

  if (text.includes('جبن') || text.includes('أجبان') || text.includes('اجبان')) {
    return {
      emoji: '🧀',
      bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      color: '#b45309',
      defaultImg: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&q=80',
    };
  }
  if (text.includes('لبن') || text.includes('ألبان') || text.includes('حليب')) {
    return {
      emoji: '🥛',
      bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
      color: '#0369a1',
      defaultImg: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=80',
    };
  }
  if (text.includes('أرز') || text.includes('ارز') || text.includes('حبوب')) {
    return {
      emoji: '🌾',
      bg: 'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)',
      color: '#854d0e',
      defaultImg: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    };
  }
  if (text.includes('خبز') || text.includes('مخبوزات') || text.includes('معجنات')) {
    return {
      emoji: '🥖',
      bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
      color: '#9a3412',
      defaultImg: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
    };
  }
  if (text.includes('دجاج') || text.includes('فروج') || text.includes('دواجن')) {
    return {
      emoji: '🍗',
      bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      color: '#991b1b',
      defaultImg: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&q=80',
    };
  }
  if (text.includes('لحم') || text.includes('لحوم') || text.includes('شاورما') || text.includes('كباب')) {
    return {
      emoji: '🥩',
      bg: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)',
      color: '#9f1239',
      defaultImg: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80',
    };
  }
  if (text.includes('سمك') || text.includes('أسماك') || text.includes('بحري') || text.includes('تونة')) {
    return {
      emoji: '🐟',
      bg: 'linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 100%)',
      color: '#0369a1',
      defaultImg: 'https://images.unsplash.com/photo-1534940562479-798485202619?w=400&q=80',
    };
  }
  if (text.includes('بيض')) {
    return {
      emoji: '🥚',
      bg: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
      color: '#92400e',
      defaultImg: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80',
    };
  }
  if (text.includes('فاكه') || text.includes('فواكه') || text.includes('تفاح') || text.includes('برتقال') || text.includes('موز')) {
    return {
      emoji: '🍎',
      bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
      color: '#9d174d',
      defaultImg: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80',
    };
  }
  if (text.includes('خضار') || text.includes('حضار') || text.includes('خضروات') || text.includes('بندورة') || text.includes('خيار') || text.includes('بطاطا')) {
    return {
      emoji: '🥦',
      bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
      color: '#166534',
      defaultImg: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80',
    };
  }
  if (text.includes('مياه') || text.includes('ماء') || text.includes('عين') || text.includes('مسافي')) {
    return {
      emoji: '💧',
      bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
      color: '#0284c7',
      defaultImg: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&q=80',
    };
  }
  if (text.includes('عصير') || text.includes('عصائر')) {
    return {
      emoji: '🧃',
      bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
      color: '#c2410c',
      defaultImg: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=80',
    };
  }
  if (text.includes('شاي') || text.includes('قهوة')) {
    return {
      emoji: '☕',
      bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      color: '#78350f',
      defaultImg: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80',
    };
  }
  if (text.includes('زيت') || text.includes('سمن') || text.includes('زبدة')) {
    return {
      emoji: '🫒',
      bg: 'linear-gradient(135deg, #ecfccb 0%, #d9f99d 100%)',
      color: '#3f6212',
      defaultImg: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80',
    };
  }
  if (text.includes('بهار') || text.includes('توابل')) {
    return {
      emoji: '🌶️',
      bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      color: '#991b1b',
      defaultImg: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&q=80',
    };
  }
  if (text.includes('معلب') || text.includes('صلص') || text.includes('رب البندورة')) {
    return {
      emoji: '🥫',
      bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      color: '#334155',
      defaultImg: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80',
    };
  }
  if (text.includes('بسكويت') || text.includes('شيبس') || text.includes('مقرمشات') || text.includes('حلويات') || text.includes('شوكولا')) {
    return {
      emoji: '🍪',
      bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      color: '#92400e',
      defaultImg: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
    };
  }
  if (text.includes('تنظيف') || text.includes('صابون') || text.includes('عناية') || text.includes('شامبو')) {
    return {
      emoji: '🧼',
      bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      color: '#15803d',
      defaultImg: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&q=80',
    };
  }
  if (text.includes('محارم') || text.includes('ورق')) {
    return {
      emoji: '🧻',
      bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      color: '#475569',
      defaultImg: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=400&q=80',
    };
  }
  if (text.includes('مستلزمات') || text.includes('منزل') || text.includes('أدوات')) {
    return {
      emoji: '🏠',
      bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      color: '#1e293b',
      defaultImg: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&q=80',
    };
  }
  if (text.includes('يومي') || text.includes('المشتريات')) {
    return {
      emoji: '🛒',
      bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      color: '#b45309',
      defaultImg: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
    };
  }

  // الافتراضي العام
  return {
    emoji: '📦',
    bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    color: '#475569',
    defaultImg: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
  };
}

export interface UnifiedImageItem {
  id: string; // Unique key in list
  source: 'gallery' | 'category' | 'product' | 'knowledge';
  sourceLabel: string;
  rawId: string;
  title: string;
  nameEn?: string | null;
  category: string;
  imageUrl: string;
  imageKey?: string | null;
  isActive: boolean; // Allowed/displayed in app & admin
  storeId?: string | null;
  storeName?: string | null;
  price?: number | null;
  unit?: string | null;
  classification?: string | null;
  origin?: string | null;
  calories?: string | null;
  healthBenefits?: string | null;
  createdAt: string;
  rawItem: AppGalleryItem | StoreCategory | ProductRow | ProductKnowledgeRow;
}

interface PendingUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  category: string;
}

/**
 * مكوّن عرض الصورة الذكي:
 * يمنع ظهور خطأ Image Error نهائياً، ويستبدل الروابط التالفة بصور عالية الجودة وبطاقات أنيقة
 */
function UnifiedCardImage({
  item,
  onQuickUpload,
}: {
  item: UnifiedImageItem;
  onQuickUpload: (file: File) => void;
}) {
  const visual = useMemo(() => getCategoryVisual(item.title, item.category), [item.title, item.category]);
  const [errorLevel, setErrorLevel] = useState<number>(0);

  const activeSrc = useMemo(() => {
    if (errorLevel === 0 && item.imageUrl && item.imageUrl.trim()) {
      return item.imageUrl;
    }
    return '';
  }, [errorLevel, item.imageUrl]);

  if (errorLevel >= 2 || !activeSrc) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: visual.bg,
          color: visual.color,
          padding: 8,
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: 44, lineHeight: 1, marginBottom: 6 }}>{visual.emoji}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </span>

        <label
          style={{
            marginTop: 6,
            background: 'rgba(255,255,255,0.92)',
            color: visual.color,
            border: `1px solid ${visual.color}`,
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 10.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Upload size={11} />
          رفع صورة
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onQuickUpload(file);
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={item.title}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        padding: 4,
        background: '#fff',
      }}
      loading="lazy"
      onError={() => {
        // Fallback gracefully without ever showing "Image Error"
        setErrorLevel((prev) => prev + 1);
      }}
    />
  );
}

export function GalleryPage({
  galleryItems = [],
  categories = [],
  products = [],
  stores = [],
  knowledgeItems = [],
  onReload,
}: {
  galleryItems: AppGalleryItem[];
  categories?: StoreCategory[];
  products?: ProductRow[];
  stores?: StoreRow[];
  knowledgeItems?: ProductKnowledgeRow[];
  onReload: () => Promise<void>;
}) {
  const { notify } = useToast();

  // Search & Filter state
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ImageSourceFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Stores lookup map
  const storesMap = useMemo(() => {
    const map = new Map<string, StoreRow>();
    for (const s of stores) {
      map.set(s.id, s);
    }
    return map;
  }, [stores]);

  // Categories lookup map for products
  const categoriesMap = useMemo(() => {
    const map = new Map<string, StoreCategory>();
    for (const c of categories) {
      map.set(c.id, c);
    }
    return map;
  }, [categories]);

  // Unify all images across the whole system
  const allUnifiedItems: UnifiedImageItem[] = useMemo(() => {
    const list: UnifiedImageItem[] = [];

    // 1. App Gallery Items (Split cleanly into Product images vs Category images)
    for (const item of galleryItems) {
      if (item.image_url && item.image_url.trim()) {
        const isProduct = item.image_key === 'product';
        const isDaily =
          item.image_key === 'daily' ||
          item.title === 'المشتريات اليومية' ||
          item.category === 'المشتريات اليومية';
        list.push({
          id: `gallery-${item.id}`,
          source: isProduct ? 'product' : 'category',
          sourceLabel: isProduct
            ? 'صور المواد والمنتجات'
            : isDaily
            ? 'المشتريات اليومية'
            : 'صور الأقسام',
          rawId: item.id,
          title: item.title,
          category: item.category?.trim() || (isProduct ? 'مواد غذائية' : 'عام'),
          imageUrl: item.image_url,
          imageKey: item.image_key,
          isActive: Boolean(item.is_active),
          storeId: null,
          storeName: 'معرض عام لجميع المتاجر',
          createdAt: item.created_at,
          rawItem: item,
        });
      }
    }

    // 2. Store Categories with images
    for (const cat of categories) {
      if (!cat.image_url || !cat.image_url.trim()) continue;
      const store = cat.store_id ? storesMap.get(cat.store_id) : null;
      const isHidden = Boolean(cat.is_hidden) || (cat.position >= 10000);
      list.push({
        id: `cat-${cat.id}`,
        source: 'category',
        sourceLabel: 'صور الأقسام',
        rawId: cat.id,
        title: cat.name,
        category: cat.name, // Category itself
        imageUrl: cat.image_url || '',
        imageKey: cat.image_key,
        isActive: !isHidden,
        storeId: cat.store_id,
        storeName: store ? store.name : 'متجر',
        createdAt: cat.created_at,
        rawItem: cat,
      });
    }

    // 3. Products with images
    for (const prod of products) {
      if (prod.image_url && prod.image_url.trim()) {
        const store = prod.store_id ? storesMap.get(prod.store_id) : null;
        const cat = prod.category_id ? categoriesMap.get(prod.category_id) : null;
        const categoryName = prod.classification?.trim() || cat?.name || 'مواد متنوعة';
        list.push({
          id: `prod-${prod.id}`,
          source: 'product',
          sourceLabel: 'صور المواد والمنتجات',
          rawId: prod.id,
          title: prod.name,
          nameEn: prod.name_en,
          category: categoryName,
          imageUrl: prod.image_url,
          imageKey: prod.image_key,
          isActive: Boolean(prod.available),
          storeId: prod.store_id,
          storeName: store ? store.name : 'متجر',
          price: prod.price,
          unit: prod.unit,
          classification: prod.classification,
          origin: prod.origin,
          calories: prod.calories_per_100g,
          healthBenefits: prod.health_benefits,
          createdAt: prod.created_at,
          rawItem: prod,
        });
      }
    }

    // 4. Product Knowledge (Encyclopedia) with images
    for (const kn of knowledgeItems) {
      if (kn.image_url && kn.image_url.trim()) {
        list.push({
          id: `know-${kn.id}`,
          source: 'knowledge',
          sourceLabel: 'موسوعة المواد',
          rawId: kn.id,
          title: kn.name,
          nameEn: kn.name_en,
          category: kn.classification?.trim() || 'موسوعة المواد',
          imageUrl: kn.image_url,
          isActive: true,
          storeId: null,
          storeName: 'الموسوعة المركزية',
          classification: kn.classification,
          origin: kn.origin,
          calories: kn.calories_per_100g,
          healthBenefits: kn.health_benefits,
          createdAt: kn.created_at,
          rawItem: kn,
        });
      }
    }

    return list;
  }, [galleryItems, categories, products, knowledgeItems, storesMap, categoriesMap]);

  // Unique list of all categories across all unified items + standard presets
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const def of DEFAULT_GALLERY_CATEGORIES) {
      set.add(def);
    }
    for (const item of allUnifiedItems) {
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'gallery' && item.source !== 'gallery') continue;
        if (sourceFilter === 'categories' && item.source !== 'category') continue;
        if (sourceFilter === 'products' && item.source !== 'product') continue;
        if (sourceFilter === 'knowledge' && item.source !== 'knowledge') continue;
      }
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    }
    return Array.from(set);
  }, [allUnifiedItems, sourceFilter]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of allUnifiedItems) {
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'gallery' && item.source !== 'gallery') continue;
        if (sourceFilter === 'categories' && item.source !== 'category') continue;
        if (sourceFilter === 'products' && item.source !== 'product') continue;
        if (sourceFilter === 'knowledge' && item.source !== 'knowledge') continue;
      }
      const cat = item.category || 'عام';
      map[cat] = (map[cat] || 0) + 1;
    }
    return map;
  }, [allUnifiedItems, sourceFilter]);

  // Source item counts
  const sourceCounts = useMemo(() => {
    const counts = {
      all: allUnifiedItems.length,
      gallery: 0,
      categories: 0,
      products: 0,
      knowledge: 0,
    };
    for (const item of allUnifiedItems) {
      if (item.source === 'gallery') counts.gallery++;
      else if (item.source === 'category') counts.categories++;
      else if (item.source === 'product') counts.products++;
      else if (item.source === 'knowledge') counts.knowledge++;
    }
    return counts;
  }, [allUnifiedItems]);

  // Filtered Unified Items
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUnifiedItems
      .filter((item) => {
        if (sourceFilter === 'gallery' && item.source !== 'gallery') return false;
        if (sourceFilter === 'categories' && item.source !== 'category') return false;
        if (sourceFilter === 'products' && item.source !== 'product') return false;
        if (sourceFilter === 'knowledge' && item.source !== 'knowledge') return false;

        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (selectedStoreId !== 'all' && item.storeId && item.storeId !== selectedStoreId) return false;

        if (statusFilter === 'active' && !item.isActive) return false;
        if (statusFilter === 'inactive' && item.isActive) return false;

        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q) ||
          (item.storeName && item.storeName.toLowerCase().includes(q)) ||
          (item.classification && item.classification.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const isDailyA = a.category === 'المشتريات اليومية' || a.imageKey === 'daily';
        const isDailyB = b.category === 'المشتريات اليومية' || b.imageKey === 'daily';
        if (isDailyA && !isDailyB) return -1;
        if (!isDailyA && isDailyB) return 1;

        if (a.category !== b.category) return a.category.localeCompare(b.category, 'ar');
        return a.title.localeCompare(b.title, 'ar');
      });
  }, [allUnifiedItems, sourceFilter, selectedCategory, selectedStoreId, statusFilter, query]);

  // Lightbox preview state
  const [previewItem, setPreviewItem] = useState<UnifiedImageItem | null>(null);

  // Upload modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProductUploadMode, setIsProductUploadMode] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingUploadItem[]>([]);
  const [defaultUploadCategory, setDefaultUploadCategory] = useState<string>('خضار وفواكه');
  const [customUploadCategory, setCustomUploadCategory] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Edit item state
  const [editingItem, setEditingItem] = useState<UnifiedImageItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editUnit, setEditUnit] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImageFilePreview, setEditImageFilePreview] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<UnifiedImageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Promoting/publishing state
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Refreshing indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onReload();
      notify('تم تحديث بيانات المعرض بنجاح');
    } catch (err) {
      notify('تعذر التحديث', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Quick single image upload from device directly on any card
  const handleQuickUpload = async (item: UnifiedImageItem, file: File) => {
    try {
      notify(`جاري رفع صورة «${item.title}» من جهازك...`);
      const folder =
        item.source === 'category'
          ? 'categories'
          : item.source === 'product'
          ? 'products'
          : 'app_gallery';

      const { publicUrl } = await uploadCatalogMedia(file, folder);

      if (item.source === 'category') {
        const { error } = await supabase
          .from('store_categories')
          .update({ image_url: publicUrl })
          .eq('id', item.rawId);
        if (error) throw error;
      } else if (item.source === 'product') {
        const { error } = await supabase
          .from('products')
          .update({ image_url: publicUrl })
          .eq('id', item.rawId);
        if (error) throw error;
      } else if (item.source === 'gallery') {
        const { error } = await supabase
          .from('app_gallery')
          .update({ image_url: publicUrl })
          .eq('id', item.rawId);
        if (error) throw error;
      } else if (item.source === 'knowledge') {
        const { error } = await supabase
          .from('product_knowledge')
          .update({ image_url: publicUrl })
          .eq('id', item.rawId);
        if (error) throw error;
      }

      notify(`تم تحديث وحفظ صورة «${item.title}» بنجاح!`);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الصورة', 'error');
    }
  };

  // Toggle Visibility in App & Admin ("اسمح بعرضها بالادمن والتطبيق")
  const handleToggleActive = async (item: UnifiedImageItem) => {
    const nextState = !item.isActive;
    try {
      if (item.source === 'gallery') {
        const { error } = await supabase
          .from('app_gallery')
          .update({ is_active: nextState })
          .eq('id', item.rawId);
        if (error) throw error;
      } else if (item.source === 'category') {
        const { error } = await supabase
          .from('store_categories')
          .update({ is_hidden: !nextState })
          .eq('id', item.rawId);
        if (error) throw error;
      } else if (item.source === 'product') {
        const { error } = await supabase
          .from('products')
          .update({ available: nextState })
          .eq('id', item.rawId);
        if (error) throw error;
      } else if (item.source === 'knowledge') {
        notify('عناصر موسوعة المواد نشطة بشكل افتراضي');
        return;
      }

      notify(
        nextState
          ? `تم السماح بعرض «${item.title}» بنجاح`
          : `تم إخفاء «${item.title}» من العرض`
      );
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تغيير حالة العرض', 'error');
    }
  };

  // Publish / Promote item image to General App Gallery
  const handlePublishToAppGallery = async (item: UnifiedImageItem) => {
    if (item.source === 'gallery') {
      notify('هذه الصورة موجودة بالفعل في المعرض العام');
      return;
    }
    setPromotingId(item.id);
    try {
      const visual = getCategoryVisual(item.title, item.category);
      const isDaily =
        item.category === 'المشتريات اليومية' || item.title.trim() === 'المشتريات اليومية';

      const finalUrl = item.imageUrl || visual.defaultImg;

      const { error } = await supabase.from('app_gallery').insert({
        title: item.title,
        category: item.category || 'عام',
        image_url: finalUrl,
        image_key: isDaily ? 'daily' : null,
        position: isDaily ? -1 : 0,
        is_active: true,
      });

      if (error) throw error;
      notify(`تم نشر صورة «${item.title}» وإتاحتها في معرض التطبيق العام بنجاح!`);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل النشر إلى المعرض العام', 'error');
    } finally {
      setPromotingId(null);
    }
  };

  // Start Edit
  const startEdit = (item: UnifiedImageItem) => {
    const visual = getCategoryVisual(item.title, item.category);
    setEditingItem(item);
    setEditTitle(item.title);
    setEditNameEn(item.nameEn || '');
    setEditImageUrl(item.imageUrl || visual.defaultImg);
    setEditPrice(item.price ?? '');
    setEditUnit(item.unit || '');
    setEditOrigin(item.origin || '');
    setEditCalories(item.calories || '');
    setEditIsActive(item.isActive);
    setEditImageFile(null);
    setEditImageFilePreview('');

    if (DEFAULT_GALLERY_CATEGORIES.includes(item.category)) {
      setEditCategory(item.category);
      setEditCustomCategory('');
    } else {
      setEditCategory('__custom__');
      setEditCustomCategory(item.category);
    }
  };

  // Handle saving edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const finalCategory =
      editCategory === '__custom__'
        ? editCustomCategory.trim() || 'عام'
        : editCategory.trim() || 'عام';

    setIsSavingEdit(true);
    try {
      let finalImageUrl = editImageUrl;

      if (editImageFile) {
        const folder =
          editingItem.source === 'category'
            ? 'categories'
            : editingItem.source === 'product'
            ? 'products'
            : 'app_gallery';
        const { publicUrl } = await uploadCatalogMedia(editImageFile, folder);
        finalImageUrl = publicUrl;
      }

      if (editingItem.source === 'gallery') {
        const isDaily =
          finalCategory === 'المشتريات اليومية' || editTitle.trim() === 'المشتريات اليومية';

        const { error } = await supabase
          .from('app_gallery')
          .update({
            title: editTitle.trim() || editingItem.title,
            category: finalCategory,
            image_url: finalImageUrl,
            image_key: isDaily ? 'daily' : null,
            is_active: editIsActive,
          })
          .eq('id', editingItem.rawId);

        if (error) throw error;
      } else if (editingItem.source === 'category') {
        const { error } = await supabase
          .from('store_categories')
          .update({
            name: editTitle.trim() || editingItem.title,
            image_url: finalImageUrl,
            is_hidden: !editIsActive,
          })
          .eq('id', editingItem.rawId);

        if (error) throw error;
      } else if (editingItem.source === 'product') {
        const { error } = await supabase
          .from('products')
          .update({
            name: editTitle.trim() || editingItem.title,
            name_en: editNameEn.trim() || null,
            image_url: finalImageUrl,
            classification: finalCategory,
            price: typeof editPrice === 'number' ? editPrice : Number(editPrice) || 0,
            unit: editUnit.trim() || 'قطعة',
            origin: editOrigin.trim() || null,
            calories_per_100g: editCalories.trim() || null,
            available: editIsActive,
          })
          .eq('id', editingItem.rawId);

        if (error) throw error;
      } else if (editingItem.source === 'knowledge') {
        const { error } = await supabase
          .from('product_knowledge')
          .update({
            name: editTitle.trim() || editingItem.title,
            name_en: editNameEn.trim() || null,
            image_url: finalImageUrl,
            classification: finalCategory,
            origin: editOrigin.trim() || null,
            calories_per_100g: editCalories.trim() || null,
          })
          .eq('id', editingItem.rawId);

        if (error) throw error;
      }

      notify(`تم حفظ تعديلات «${editTitle}» بنجاح`);
      setEditingItem(null);
      if (previewItem && previewItem.id === editingItem.id) {
        setPreviewItem(null);
      }
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ التعديلات', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Delete or Clear Image
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.id.startsWith('gallery-')) {
        const { error } = await supabase
          .from('app_gallery')
          .delete()
          .eq('id', deleteTarget.rawId);
        if (error) throw error;
        notify(`تم حذف صورة «${deleteTarget.title}» نهائياً من المعرض`);
      } else if (deleteTarget.id.startsWith('cat-')) {
        const { error } = await supabase
          .from('store_categories')
          .update({ image_url: null, image_key: null })
          .eq('id', deleteTarget.rawId);
        if (error) throw error;
        notify(`تم مسح وحذف صورة القسم «${deleteTarget.title}»`);
      } else if (deleteTarget.id.startsWith('prod-')) {
        const { error } = await supabase
          .from('products')
          .update({ image_url: null, image_key: null })
          .eq('id', deleteTarget.rawId);
        if (error) throw error;
        notify(`تم مسح وحذف صورة المادة «${deleteTarget.title}»`);
      } else if (deleteTarget.id.startsWith('know-')) {
        const { error } = await supabase
          .from('product_knowledge')
          .update({ image_url: null })
          .eq('id', deleteTarget.rawId);
        if (error) throw error;
        notify(`تم مسح صورة الموسوعة للمادة «${deleteTarget.title}»`);
      }

      if (previewItem && previewItem.id === deleteTarget.id) {
        setPreviewItem(null);
      }
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر إتمام عملية الحذف', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Upload Batch Handler (Files from Device)
  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const chosenCat = customUploadCategory.trim() || defaultUploadCategory;
    const newItems: PendingUploadItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const cleanTitle = rawName.replace(/[-_]+/g, ' ').trim();
      const finalTitle =
        chosenCat === 'المشتريات اليومية' ? 'المشتريات اليومية' : cleanTitle;

      newItems.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        title: finalTitle,
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
        const folder = isProductUploadMode ? 'app_gallery/products' : 'app_gallery/categories';
        const { publicUrl } = await uploadCatalogMedia(it.file, folder);
        const isDaily =
          it.category.trim() === 'المشتريات اليومية' ||
          it.title.trim() === 'المشتريات اليومية';

        const imageKey = isDaily ? 'daily' : isProductUploadMode ? 'product' : 'category';

        const { error } = await supabase.from('app_gallery').insert({
          title:
            it.title.trim() ||
            (isDaily
              ? 'المشتريات اليومية'
              : isProductUploadMode
              ? 'صورة مادة'
              : 'صورة قسم'),
          category: it.category.trim() || (isProductUploadMode ? 'مواد غذائية' : 'عام'),
          image_url: publicUrl,
          image_key: imageKey,
          position: isDaily ? -1 : isProductUploadMode ? 20 : 10,
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
      notify(`تم رفع وإضافة ${successCount} صورة بنجاح إلى المعرض`);
      setPendingItems([]);
      setIsUploadModalOpen(false);
      await onReload();
    }
    if (errors.length > 0) {
      notify(`تعذر رفع بعض الصور (${errors.length}): ${errors.join(', ')}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner / Stats Header */}
      <div
        className="panel"
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          borderRadius: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <ImageIcon size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>
              معرض الصور الشامل والتحكم بالبيانات
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
            استعراض وتحكم كامل بكافة صور التطبيق والأقسام والمواد والموسوعة، مع إمكانية الفرز حسب الفئة والسماح بالعرض وتعديل البيانات مباشرة.
          </p>
        </div>

        {/* Global Stats Counter */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.07)',
              padding: '6px 14px',
              borderRadius: 10,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8' }}>إجمالي المعروض</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8' }}>
              {allUnifiedItems.length}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.07)',
              padding: '6px 14px',
              borderRadius: 10,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8' }}>صور الأقسام</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>
              {sourceCounts.categories}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.07)',
              padding: '6px 14px',
              borderRadius: 10,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8' }}>صور المواد</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>
              {sourceCounts.products}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.07)',
              padding: '6px 14px',
              borderRadius: 10,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8' }}>المعرض العام</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#c084fc' }}>
              {sourceCounts.gallery}
            </div>
          </div>
        </div>
      </div>

      {/* Main Control Toolbar */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="toolbar-filters" style={{ flexWrap: 'wrap', gap: 10, flex: 1 }}>
          {/* Search Box */}
          <div className="search-box" style={{ minWidth: 240, flex: 1 }}>
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث باسم الصورة، القسم، المادة، أو المتجر..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: '#94a3b8',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Source Filter Select */}
          <select
            className="select"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as ImageSourceFilter);
              setSelectedCategory('all');
            }}
            style={{ minWidth: 160 }}
          >
            <option value="all">كل الصور ({sourceCounts.all})</option>
            <option value="products">صور المواد والمنتجات ({sourceCounts.products})</option>
            <option value="categories">صور الأقسام ({sourceCounts.categories})</option>
          </select>

          {/* Category Dropdown */}
          <select
            className="select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="all">كل الفئات والتصنيفات ({filteredItems.length})</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({categoryCounts[cat] || 0})
              </option>
            ))}
          </select>

          {/* Stores Filter */}
          {stores.length > 0 && (
            <select
              className="select"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="all">جميع المتاجر</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Status / Display Permission Filter */}
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            style={{ minWidth: 140 }}
          >
            <option value="all">كل حالات العرض</option>
            <option value="active">مسموح بالعرض (ظاهر)</option>
            <option value="inactive">مخفي / غير معروض</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="toolbar-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            title="تحديث البيانات"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            تحديث
          </button>

          <button
            type="button"
            className="btn btn-yellow"
            onClick={() => {
              setDefaultUploadCategory('المشتريات اليومية');
              setCustomUploadCategory('');
              setPendingItems([]);
              setIsProductUploadMode(false);
              setIsUploadModalOpen(true);
            }}
          >
            <ShoppingCart size={15} />
            صورة المشتريات اليومية
          </button>

          <button
            type="button"
            className="btn btn-outline"
            style={{
              borderColor: '#0284c7',
              color: '#0284c7',
              fontWeight: 700,
              background: '#f0f9ff',
            }}
            onClick={() => {
              setDefaultUploadCategory('مواد غذائية');
              setCustomUploadCategory('');
              setPendingItems([]);
              setIsProductUploadMode(true);
              setIsUploadModalOpen(true);
            }}
          >
            <Package size={15} />
            إضافة صور للمواد من الجهاز
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setDefaultUploadCategory('خضار وفواكه');
              setCustomUploadCategory('');
              setPendingItems([]);
              setIsProductUploadMode(false);
              setIsUploadModalOpen(true);
            }}
          >
            <Upload size={15} />
            إضافة صور للأقسام من الجهاز
          </button>
        </div>
      </div>

      {/* Source Segmented Switcher */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 10,
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'products', label: 'صور المواد والمنتجات', count: sourceCounts.products, icon: Package },
          { key: 'categories', label: 'صور الأقسام', count: sourceCounts.categories, icon: FolderPlus },
          { key: 'all', label: 'الكل', count: sourceCounts.all, icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = sourceFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setSourceFilter(tab.key as ImageSourceFilter);
                setSelectedCategory('all');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: isActive ? 800 : 600,
                fontSize: 13,
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? '#0f172a' : '#64748b',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} color={isActive ? '#0284c7' : '#64748b'} />
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? '#e0f2fe' : '#e2e8f0',
                  color: isActive ? '#0284c7' : '#64748b',
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category Pills Bar ("حسب الفئة تبعها") */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 6,
          scrollbarWidth: 'thin',
        }}
      >
        <button
          type="button"
          className={`tab-pill ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          كل الفئات ({filteredItems.length})
        </button>

        {availableCategories.map((cat) => {
          const count = categoryCounts[cat] || 0;
          const isDaily = cat === 'المشتريات اليومية';
          const isSelected = selectedCategory === cat;

          return (
            <button
              key={cat}
              type="button"
              className={`tab-pill ${isSelected ? 'active' : ''}`}
              style={
                isDaily
                  ? {
                      borderColor: '#f59e0b',
                      color: isSelected ? '#fff' : '#b45309',
                      fontWeight: 800,
                      background: isSelected ? '#f59e0b' : '#fef3c7',
                    }
                  : undefined
              }
              onClick={() => setSelectedCategory(cat)}
            >
              {isDaily && (
                <ShoppingCart size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
              )}
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Images Grid */}
      {filteredItems.length === 0 ? (
        <div
          className="panel"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#64748b',
            borderRadius: 14,
          }}
        >
          <ImageIcon size={52} style={{ margin: '0 auto 14px', opacity: 0.35 }} />
          <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>
            {allUnifiedItems.length === 0
              ? 'لا توجد صور في النظام حالياً'
              : 'لا توجد صور مطابقة لمعايير البحث والتصفية'}
          </h3>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, maxWidth: 500, marginInline: 'auto' }}>
            {allUnifiedItems.length === 0
              ? 'يمكنك إضافة ورفع صور جديدة من جهازك للأقسام والمواد لتظهر في التطبيق فوراً.'
              : 'جرّب إعادة تعيين الفلاتر أو البحث باسم مادة أو قسم آخر.'}
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {(selectedCategory !== 'all' || sourceFilter !== 'all' || query) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setQuery('');
                  setSelectedCategory('all');
                  setSourceFilter('all');
                  setStatusFilter('all');
                  setSelectedStoreId('all');
                }}
              >
                إعادة ضبط الفلاتر
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Upload size={16} />
              رفع صور من الجهاز
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {filteredItems.map((item) => {
            const isDaily =
              item.category === 'المشتريات اليومية' || item.imageKey === 'daily';

            return (
              <div
                key={item.id}
                className="panel"
                style={{
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 14,
                  opacity: item.isActive ? 1 : 0.65,
                  border: isDaily
                    ? '2px solid #f59e0b'
                    : item.isActive
                    ? '1px solid #e2e8f0'
                    : '1px dashed #cbd5e1',
                  background: item.isActive ? '#fff' : '#f8fafc',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {/* Image Container with Badges */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPreviewItem(item)}
                >
                  {/* Smart Card Image with Auto-Fallback (Never Shows Image Error) */}
                  <UnifiedCardImage
                    item={item}
                    onQuickUpload={(file) => handleQuickUpload(item, file)}
                  />

                  {/* Source Badge (Top Right) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      padding: '2px 7px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 700,
                      background:
                        item.source === 'category'
                          ? 'rgba(2, 132, 199, 0.95)'
                          : item.source === 'product'
                          ? 'rgba(16, 185, 129, 0.95)'
                          : item.source === 'knowledge'
                          ? 'rgba(217, 119, 6, 0.95)'
                          : 'rgba(99, 102, 241, 0.95)',
                      color: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    {item.source === 'category' && 'قسم'}
                    {item.source === 'product' && 'مادة'}
                    {item.source === 'knowledge' && 'موسوعة'}
                    {item.source === 'gallery' && 'معرض'}
                  </div>

                  {/* Display Status Switch Pill (Top Left - "اسمح بعرضها بالادمن") */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(item);
                    }}
                    title={item.isActive ? 'مسموح بالعرض (اضغط للإخفاء)' : 'مخفي (اضغط للسماح بالعرض)'}
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 10.5,
                      fontWeight: 700,
                      background: item.isActive ? '#16a34a' : '#64748b',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    {item.isActive ? <Eye size={11} /> : <EyeOff size={11} />}
                    {item.isActive ? 'مسموح بالعرض' : 'مخفي'}
                  </button>

                  {/* Daily Purchases Badge */}
                  {isDaily && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 6,
                        left: 6,
                        padding: '3px 6px',
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 800,
                        background: 'rgba(245, 158, 11, 0.95)',
                        color: '#000',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <ShoppingCart size={12} />
                      صورة المشتريات اليومية
                    </div>
                  )}

                  {/* Expand Preview Hover Icon */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      borderRadius: 4,
                      padding: 3,
                      display: isDaily ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="تكبير ومعاينة التفاصيل"
                  >
                    <Maximize2 size={12} />
                  </div>
                </div>

                {/* Card Title & Info */}
                <div style={{ marginTop: 8, flex: 1, minHeight: 60 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 13.5,
                      color: '#0f172a',
                      marginBottom: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.title}
                  >
                    {item.title}
                  </div>

                  {item.nameEn && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#64748b',
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.nameEn}
                    </div>
                  )}

                  {/* Category Pill */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '2px 7px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <Tag size={10} />
                      {item.category}
                    </span>

                    {/* Price if available */}
                    {typeof item.price === 'number' && (
                      <span
                        style={{
                          background: '#ecfdf5',
                          color: '#047857',
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {item.price} ل.س
                      </span>
                    )}

                    {/* Store Name if applicable */}
                    {item.storeName && item.source !== 'gallery' && item.source !== 'knowledge' && (
                      <span
                        style={{
                          background: '#f8fafc',
                          color: '#64748b',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 10.5,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {item.storeName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {/* Toggle Visibility */}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 6px' }}
                    title={item.isActive ? 'إخفاء من التطبيق' : 'السماح بالعرض في التطبيق'}
                    onClick={() => handleToggleActive(item)}
                  >
                    {item.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>

                  {/* Promote to App Gallery (if not already in gallery) */}
                  {item.source !== 'gallery' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 6px', color: '#7c3aed', borderColor: '#ddd6fe' }}
                      title="نشر وإتاحة بالمعرض العام لجميع المتاجر"
                      disabled={promotingId === item.id}
                      onClick={() => handlePublishToAppGallery(item)}
                    >
                      <Sparkles size={13} />
                    </button>
                  )}

                  {/* Quick Device Upload for this Card */}
                  <label
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 6px', cursor: 'pointer' }}
                    title="رفع صورة جديدة من جهازك مباشرة"
                  >
                    <Upload size={13} />
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQuickUpload(item, file);
                      }}
                    />
                  </label>

                  {/* Copy Image URL */}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 6px' }}
                    title="نسخ رابط الصورة"
                    onClick={() => {
                      const visual = getCategoryVisual(item.title, item.category);
                      navigator.clipboard.writeText(item.imageUrl || visual.defaultImg);
                      notify('تم نسخ رابط الصورة إلى الحافظة');
                    }}
                  >
                    <Copy size={13} />
                  </button>

                  {/* Edit Item Data & Image */}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 6px' }}
                    title="تعديل البيانات والصورة"
                    onClick={() => startEdit(item)}
                  >
                    <Edit3 size={13} />
                  </button>

                  {/* Delete / Clear */}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 6px' }}
                    title={item.source === 'gallery' ? 'حذف من المعرض' : 'إزالة الصورة'}
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox / Fullscreen Preview Modal */}
      {previewItem && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewItem(null)}
          style={{ zIndex: 1200 }}
        >
          <div
            className="modal-panel"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={18} color="#0284c7" />
                <h3 style={{ margin: 0 }}>تفاصيل ومعاينة الصورة</h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPreviewItem(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Full Image Preview */}
              <div
                style={{
                  width: '100%',
                  maxHeight: 340,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <UnifiedCardImage
                  item={previewItem}
                  onQuickUpload={(file) => handleQuickUpload(previewItem, file)}
                />
              </div>

              {/* Data Table */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: 10,
                  padding: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>الاسم:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{previewItem.title}</span>
                </div>

                {previewItem.nameEn && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>الاسم بالإنجليزية:</span>
                    <span style={{ fontWeight: 600 }}>{previewItem.nameEn}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>المصدر:</span>
                  <span style={{ fontWeight: 700, color: '#0284c7' }}>
                    {previewItem.sourceLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>الفئة / القسم:</span>
                  <span style={{ fontWeight: 700 }}>{previewItem.category}</span>
                </div>

                {previewItem.storeName && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>المتجر:</span>
                    <span>{previewItem.storeName}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>حالة العرض:</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: previewItem.isActive ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {previewItem.isActive ? 'مسموح بالعرض (ظاهر في التطبيق)' : 'مخفي / غير معروض'}
                  </span>
                </div>

                {typeof previewItem.price === 'number' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>السعر:</span>
                    <span style={{ fontWeight: 700 }}>
                      {previewItem.price} ل.س ({previewItem.unit || 'قطعة'})
                    </span>
                  </div>
                )}

                {previewItem.origin && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>بلد المنشأ:</span>
                    <span>{previewItem.origin}</span>
                  </div>
                )}

                {previewItem.calories && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>السعرات الحرارية:</span>
                    <span>{previewItem.calories}</span>
                  </div>
                )}

                {previewItem.healthBenefits && (
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>
                      الفوائد الصحية:
                    </span>
                    <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                      {previewItem.healthBenefits}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const visual = getCategoryVisual(previewItem.title, previewItem.category);
                    navigator.clipboard.writeText(previewItem.imageUrl || visual.defaultImg);
                    notify('تم نسخ رابط الصورة');
                  }}
                >
                  <Copy size={14} />
                  نسخ الرابط
                </button>
                <a
                  href={previewItem.imageUrl || getCategoryVisual(previewItem.title, previewItem.category).defaultImg}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <ExternalLink size={14} />
                  فتح بحجم كامل
                </a>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const item = previewItem;
                    setPreviewItem(null);
                    startEdit(item);
                  }}
                >
                  <Edit3 size={14} />
                  تعديل البيانات
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    handleToggleActive(previewItem);
                    setPreviewItem(null);
                  }}
                >
                  {previewItem.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  {previewItem.isActive ? 'إخفاء الصورة' : 'السماح بالعرض'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (مع إمكانية تعديل البيانات وتغيير الصورة من الجهاز) */}
      {editingItem && (
        <div
          className="modal-backdrop"
          onClick={() => !isSavingEdit && setEditingItem(null)}
          style={{ zIndex: 1200 }}
        >
          <div
            className="modal-panel"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#0284c7" />
                <h3 style={{ margin: 0 }}>تعديل بيانات وصورة ({editingItem.sourceLabel})</h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isSavingEdit}
                onClick={() => setEditingItem(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                {/* Current vs New Image Preview */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#f8fafc',
                      border: '2px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={
                        editImageFilePreview ||
                        editImageUrl ||
                        getCategoryVisual(editTitle, editCategory).defaultImg
                      }
                      alt="preview"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: 4,
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          getCategoryVisual(editTitle, editCategory).defaultImg;
                      }}
                    />
                  </div>

                  {/* Change Image Button */}
                  <label
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 8, cursor: 'pointer' }}
                  >
                    <Upload size={14} />
                    اختيار صورة بديلة من الجهاز
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={isSavingEdit}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditImageFile(file);
                          setEditImageFilePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  {editImageFile && (
                    <span style={{ fontSize: 11, color: '#16a34a', marginTop: 4, fontWeight: 700 }}>
                      ✓ تم اختيار ملف جديد: {editImageFile.name}
                    </span>
                  )}
                </div>

                <div className="form-grid">
                  {/* Title / Name */}
                  <div className="col-span-2 field">
                    <label>الاسم / العنوان *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>

                  {/* English Name (for products / knowledge) */}
                  {(editingItem.source === 'product' || editingItem.source === 'knowledge') && (
                    <div className="col-span-2 field">
                      <label>الاسم بالإنجليزية (اختياري)</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Tomato"
                        value={editNameEn}
                        onChange={(e) => setEditNameEn(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Category Selection */}
                  <div className="col-span-2 field">
                    <label>القسم / الفئة / التصنيف *</label>
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
                      <option value="__custom__">+ تصنيف مخصص آخر...</option>
                    </select>
                  </div>

                  {editCategory === '__custom__' && (
                    <div className="col-span-2 field">
                      <label>اسم التصنيف المخصص</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="مثال: لحوم مجمدة"
                        value={editCustomCategory}
                        onChange={(e) => setEditCustomCategory(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Product-specific fields */}
                  {editingItem.source === 'product' && (
                    <>
                      <div className="field">
                        <label>السعر (ل.س)</label>
                        <input
                          type="number"
                          className="input"
                          value={editPrice}
                          onChange={(e) =>
                            setEditPrice(e.target.value === '' ? '' : Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>الوحدة (كغ، قطعة، عبوة...)</label>
                        <input
                          type="text"
                          className="input"
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Knowledge/Product fields */}
                  {(editingItem.source === 'product' || editingItem.source === 'knowledge') && (
                    <>
                      <div className="field">
                        <label>بلد المنشأ</label>
                        <input
                          type="text"
                          className="input"
                          value={editOrigin}
                          onChange={(e) => setEditOrigin(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>السعرات الحرارية لكل 100غ</label>
                        <input
                          type="text"
                          className="input"
                          value={editCalories}
                          onChange={(e) => setEditCalories(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Display Permission Toggle */}
                  <div className="col-span-2 field" style={{ marginTop: 8 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                      <span>السماح بالعرض في لوحة الأدمن وتطبيق الهاتف (نشط / ظاهر)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={isSavingEdit}
                  onClick={() => setEditingItem(null)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingEdit}>
                  {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Batch Modal (من الجهاز) */}
      {isUploadModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !isUploading && setIsUploadModalOpen(false)}
          style={{ zIndex: 1200 }}
        >
          <div
            className="modal-panel"
            style={{ maxWidth: 740 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isProductUploadMode ? (
                  <Package size={18} color="#0284c7" />
                ) : (
                  <Upload size={18} color="#16a34a" />
                )}
                <h3 style={{ margin: 0 }}>
                  {isProductUploadMode
                    ? 'إضافة ورفع صور للمواد والمنتجات من الجهاز'
                    : defaultUploadCategory === 'المشتريات اليومية'
                    ? 'رفع وتعيين صورة «المشتريات اليومية»'
                    : 'إضافة صور إلى معرض صور التطبيق من الجهاز'}
                </h3>
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
              {isProductUploadMode && (
                <div
                  style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 14,
                    color: '#0369a1',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                  }}
                >
                  <Package size={18} />
                  <div>
                    <strong>وضع رفع صور المواد:</strong> اختر صور المواد والسلع من جهازك، وسيتم حفظ أسمائها وأقسامها في المعرض لتظهر للتاجر والمستهلك عند استعراض المواد واختيار صورها.
                  </div>
                </div>
              )}

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

                {defaultUploadCategory === 'المشتريات اليومية' && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: '#fef3c7',
                      border: '1px solid #f59e0b',
                      color: '#92400e',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                    }}
                  >
                    <ShoppingCart size={18} />
                    <div>
                      <strong>تنبيه خاص بالمشتريات اليومية:</strong> الصورة المرفوعة هنا ستصبح الأيقونة/الصورة المعتمدة لخانة <strong>«المشتريات اليومية»</strong> المثبتة في أعلى شبكة أقسام المتجر في تطبيق الهاتف!
                    </div>
                  </div>
                )}
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
                      const cleanTitle = rawName.replace(/[-_]+/g, ' ').trim();
                      const finalTitle =
                        chosenCat === 'المشتريات اليومية' ? 'المشتريات اليومية' : cleanTitle;
                      newItems.push({
                        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                        file,
                        previewUrl: URL.createObjectURL(file),
                        title: finalTitle,
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
                      maxHeight: 300,
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
                            objectFit: 'contain',
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
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

      {/* Delete / Clear Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.id.startsWith('gallery-')
            ? 'حذف صورة من المعرض نهائياً'
            : 'إزالة الصورة من السجل'
        }
        message={
          deleteTarget?.id.startsWith('gallery-')
            ? `هل أنت متأكد من حذف صورة «${deleteTarget?.title}» من المعرض نهائياً؟`
            : `هل أنت متأكد من مسح وإزالة الصورة عن «${deleteTarget?.title}»؟`
        }
        busy={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
