import React, { createContext, useCallback, useContext, useState } from 'react';
import { Upload, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { uploadCatalogMedia } from '../lib/supabase';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error';
}

interface ToastContextValue {
  notify: (text: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue>({
  notify: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item ${t.type}`}>
              <span style={{ flex: 1 }}>{t.text}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'تأكيد الحذف النهائي',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-panel"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, lineHeight: 1.7, color: '#334155', fontSize: 14.5 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={onCancel}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={onConfirm}
          >
            <Trash2 size={15} />
            {busy ? 'جاري التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageUploadField({
  label,
  value,
  onChange,
  folderPath,
  placeholder = 'https://...',
}: {
  label: string;
  value: string;
  onChange: (newUrl: string) => void;
  folderPath: string;
  placeholder?: string;
}) {
  const { notify } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { publicUrl } = await uploadCatalogMedia(file, folderPath);
      onChange(publicUrl);
      notify('تم رفع الصورة بنجاح إلى دلو التخزين');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الصورة', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {value ? (
          <img
            src={value}
            alt=""
            className="thumb"
            style={{ width: 52, height: 52 }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="thumb-placeholder" style={{ width: 52, height: 52 }}>
            <ImageIcon size={20} />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            className="input"
            dir="ltr"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={14} />
              {uploading ? 'جاري الرفع...' : 'رفع صورة من الجهاز'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={handleFile}
              />
            </label>
            {value && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => onChange('')}
              >
                مسح الرابط
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

