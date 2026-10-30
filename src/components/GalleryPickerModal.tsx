import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Image as ImageIcon, Check } from 'lucide-react';
import type { AppGalleryItem } from '../types/database';
import { DEFAULT_GALLERY_CATEGORIES } from '../lib/constants';
import { supabase } from '../lib/supabase';

export function GalleryPickerModal({
  open,
  onClose,
  onSelect,
  initialCategory,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string, title: string, category: string) => void;
  initialCategory?: string;
}) {
  const [items, setItems] = useState<AppGalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(initialCategory || 'all');

  useEffect(() => {
    if (open) {
      setLoading(true);
      supabase
        .from('app_gallery')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            setItems(data as AppGalleryItem[]);
          }
          setLoading(false);
        });
    }
  }, [open]);

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_GALLERY_CATEGORIES);
    for (const it of items) {
      if (it.category) set.add(it.category.trim());
    }
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (selectedCat !== 'all' && it.category !== selectedCat) return false;
      if (!q) return true;
      return it.title.toLowerCase().includes(q) || it.category.toLowerCase().includes(q);
    });
  }, [items, selectedCat, query]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={18} color="#0284c7" />
            <h3 style={{ margin: 0 }}>اختيار صورة من معرض صور التطبيق</h3>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '12px 16px 0', borderBottom: '1px solid #e2e8f0' }}>
          <div className="search-box" style={{ marginBottom: 10 }}>
            <Search size={15} className="search-box-icon" />
            <input
              type="text"
              className="input"
              placeholder="بحث في صور المعرض..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 10,
              scrollbarWidth: 'thin',
            }}
          >
            <button
              type="button"
              className={`tab-pill ${selectedCat === 'all' ? 'active' : ''}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setSelectedCat('all')}
            >
              الكل ({items.length})
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`tab-pill ${selectedCat === c ? 'active' : ''}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setSelectedCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              جاري تحميل صور المعرض...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              لا توجد صور في هذا القسم. يمكنك رفع صور جديدة من صفحة «معرض صور التطبيق».
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 12,
              }}
            >
              {filtered.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 6,
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: '#fff',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => {
                    onSelect(item.image_url, item.title, item.category);
                    onClose();
                  }}
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: 6,
                      background: '#f8fafc',
                    }}
                    loading="lazy"
                  />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.title}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.category}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

