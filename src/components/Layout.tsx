import React, { useState } from 'react';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  FolderTree,
  Package,
  Sparkles,
  Clock,
  ReceiptText,
  BookOpen,
  Users,
  ShoppingBasket,
  Megaphone,
  Settings,
  LogOut,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import type { AdminPageKey, Profile } from '../types/database';
import { profileDisplayName } from '../lib/constants';
import { supabase } from '../lib/supabase';

export interface NavCounts {
  pendingStores: number;
  pendingOrders: number;
  pendingCredits: number;
  totalStores: number;
  totalProducts: number;
  totalUsers: number;
}

const NAV_GROUPS: {
  label: string;
  items: {
    key: AdminPageKey;
    title: string;
    icon: React.ReactNode;
    badge?: (c: NavCounts) => { value: number; urgent?: boolean } | null;
  }[];
}[] = [
  {
    label: 'نظرة عامة',
    items: [
      {
        key: 'dashboard',
        title: 'لوحة المؤشرات والمراجعة',
        icon: <LayoutDashboard size={17} />,
      },
    ],
  },
  {
    label: 'المتاجر والكتالوج',
    items: [
      {
        key: 'stores',
        title: 'المتاجر والتراخيص',
        icon: <Store size={17} />,
        badge: (c) =>
          c.pendingStores > 0
            ? { value: c.pendingStores, urgent: true }
            : { value: c.totalStores },
      },
      {
        key: 'subscriptions',
        title: 'اشتراكات وخطط المتاجر',
        icon: <CreditCard size={17} />,
      },
      {
        key: 'categories',
        title: 'الأقسام الإلزامية والفرعية',
        icon: <FolderTree size={17} />,
      },
      {
        key: 'products',
        title: 'المواد والبضائع والوحدات',
        icon: <Package size={17} />,
        badge: (c) => (c.totalProducts > 0 ? { value: c.totalProducts } : null),
      },
      {
        key: 'promotions',
        title: 'العروض والتخفيضات',
        icon: <Sparkles size={17} />,
      },
      {
        key: 'daily_offers',
        title: 'العروض اليومية (٢٤ ساعة)',
        icon: <Clock size={17} />,
      },
    ],
  },
  {
    label: 'المبيعات والحسابات المالية',
    items: [
      {
        key: 'orders',
        title: 'الطلبات والفواتير التفاعلية',
        icon: <ReceiptText size={17} />,
        badge: (c) =>
          c.pendingOrders > 0 ? { value: c.pendingOrders, urgent: true } : null,
      },
      {
        key: 'credit',
        title: 'دفتر «على الحساب» والقيود',
        icon: <BookOpen size={17} />,
        badge: (c) =>
          c.pendingCredits > 0 ? { value: c.pendingCredits, urgent: true } : null,
      },
    ],
  },
  {
    label: 'المستخدمون والتسويق والنظام',
    items: [
      {
        key: 'users',
        title: 'المستخدمون والتوثيق والعناوين',
        icon: <Users size={17} />,
        badge: (c) => (c.totalUsers > 0 ? { value: c.totalUsers } : null),
      },
      {
        key: 'customer_data',
        title: 'السلال والمفضلة واليوميات',
        icon: <ShoppingBasket size={17} />,
      },
      {
        key: 'adverts',
        title: 'إعلانات الصفحة الرئيسية',
        icon: <Megaphone size={17} />,
      },
      {
        key: 'settings',
        title: 'إعدادات المنصة وملفات التخزين',
        icon: <Settings size={17} />,
      },
    ],
  },
];

export const PAGE_TITLES: Record<AdminPageKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'لوحة المؤشرات والمراجعة الفورية',
    subtitle: 'ملخص حي لكافة المتاجر، المبيعات، الطلبات المعلّقة، والاشتراكات',
  },
  stores: {
    title: 'إدارة المتاجر والتراخيص والاعتماد',
    subtitle: 'إنشاء وتعديل وحذف المتاجر، ضبط الموقع والعملة والضريبة والترخيص وحصة الصور',
  },
  subscriptions: {
    title: 'إدارة الاشتراكات السنوية وخطط المتاجر',
    subtitle: 'مراقبة المدفوعات وتفعيل الخطط (الصغيرة $100 / المتوسطة $300 / الكبيرة $800) وزيادة حصص الصور',
  },
  categories: {
    title: 'إدارة الأقسام الإلزامية وأقسام المتاجر',
    subtitle: 'تعبئة الأقسام الموحدة، الترتيب، الإخفاء والإظهار، وتخصيص أيقونات وصور الأقسام',
  },
  products: {
    title: 'إدارة المواد والبضائع والوحدات المتعددة',
    subtitle: 'تحكم كامل بأسعار المواد، التوفر، المصدر، الوحدات الإضافية، والصور في جميع المتاجر',
  },
  promotions: {
    title: 'إدارة العروض والتخفيضات',
    subtitle: 'إنشاء وتعديل وإخفاء وحذف العروض الإعلانية والتخفيضات والعدادات والكميات المباعة',
  },
  daily_offers: {
    title: 'إدارة شريط العروض اليومية (٢٤ ساعة)',
    subtitle: 'مراقبة العروض اليومية النشطة والمنتهية وتمديدها ٢٤ ساعة أو تعديلها وحذفها',
  },
  orders: {
    title: 'إدارة الطلبات والفواتير وبنود التفاوض',
    subtitle: 'مراجعة الفواتير، تغيير الحالات، تعديل وإضافة وحذف المواد والبدائل والملاحظات',
  },
  credit: {
    title: 'إدارة دفاتر «على الحساب» والقيود المالية',
    subtitle: 'اعتماد حسابات الائتمان، ضبط السقوف، تسجيل عمليات الشحن والسداد، ومراجعة كشف الحساب',
  },
  users: {
    title: 'إدارة المستخدمين، التجار، المشرفين، والعناوين',
    subtitle: 'توثيق الهويات، ترقية الصلاحيات، تعديل الملفات الشخصية، إدارة عناوين التوصيل، وحذف الحسابات',
  },
  customer_data: {
    title: 'سلال المتسوقين، المفضلة، والمشتريات اليومية',
    subtitle: 'معاينة وتعديل السلال المفتوحة، متاجر المفضلة، وترتيب الأقسام واليوميات الخاصة بالمتسوقين',
  },
  adverts: {
    title: 'إدارة إعلانات الصفحة الرئيسية (حسب المحافظات)',
    subtitle: 'حجز وجدولة وتعديل البنرات الإعلانية الموجهة حسب الدولة والمحافظات وربطها بالمتاجر',
  },
  settings: {
    title: 'إعدادات المنصة، التحديثات، ومتصفح التخزين السحابي',
    subtitle: 'التحكم بالاعتماد التلقائي، إصدار التطبيق، قنوات التواصل، وإدارة صور دلو catalog مباشرة',
  },
};

export function Layout({
  activePage,
  onNavigate,
  profile,
  counts,
  onGlobalRefresh,
  refreshing,
  selectedStoreBanner,
  onClearStoreBanner,
  children,
}: {
  activePage: AdminPageKey;
  onNavigate: (page: AdminPageKey) => void;
  profile: Profile;
  counts: NavCounts;
  onGlobalRefresh: () => void;
  refreshing: boolean;
  selectedStoreBanner?: { id: string; name: string } | null;
  onClearStoreBanner?: () => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = PAGE_TITLES[activePage];

  return (
    <div className="admin-shell">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 25,
          }}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">H</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-title">لوحة تحكم H-store</div>
            <div className="brand-subtitle">الإدارة المركزية الكاملة</div>
          </div>
          {mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <React.Fragment key={group.label}>
              <div className="sidebar-section-label">{group.label}</div>
              {group.items.map((item) => {
                const badgeInfo = item.badge ? item.badge(counts) : null;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`nav-btn ${activePage === item.key ? 'active' : ''}`}
                    onClick={() => {
                      onNavigate(item.key);
                      setMobileOpen(false);
                    }}
                  >
                    <span className="nav-btn-inner">
                      {item.icon}
                      <span>{item.title}</span>
                    </span>
                    {badgeInfo && (
                      <span className={`nav-badge ${badgeInfo.urgent ? 'urgent' : ''}`}>
                        {badgeInfo.value}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>
            {profileDisplayName(profile)}
          </div>
          <div
            dir="ltr"
            style={{
              fontSize: 11.5,
              color: '#94a3b8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 10,
            }}
          >
            {profile.email || profile.id.slice(0, 18)}
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{
              width: '100%',
              background: '#1e293b',
              borderColor: '#334155',
              color: '#f8fafc',
            }}
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={14} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title-group">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 18.5, fontWeight: 800 }}>{meta.title}</h1>
              <div style={{ fontSize: 12.5, color: '#64748b' }}>{meta.subtitle}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedStoreBanner && (
              <div
                className="badge badge-amber"
                style={{ padding: '6px 12px', fontSize: 12.5, gap: 8 }}
              >
                <span>فلتر المتجر: {selectedStoreBanner.name}</span>
                {onClearStoreBanner && (
                  <button
                    type="button"
                    onClick={onClearStoreBanner}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#92400e',
                      display: 'inline-flex',
                      padding: 0,
                    }}
                    title="إلغاء فلتر المتجر"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              className="btn btn-outline"
              onClick={onGlobalRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'يحدّث...' : 'تحديث البيانات'}
            </button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
