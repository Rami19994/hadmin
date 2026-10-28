import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type {
  AdminPageKey,
  AdvertRow,
  AppSettingsRow,
  AuthUserMeta,
  CartRow,
  CreditAccountRow,
  DailyOfferRow,
  FavouriteRow,
  OrderRow,
  ProductRow,
  Profile,
  PromotionRow,
  ShopperLayoutRow,
  StoreCategory,
  StoreRow,
  StoreSubscription,
} from './types/database';
import { AuthGate } from './components/AuthGate';
import { Layout, type NavCounts } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { StoresPage } from './pages/StoresPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductsPage } from './pages/ProductsPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { DailyOffersPage } from './pages/DailyOffersPage';
import { OrdersPage } from './pages/OrdersPage';
import { CreditPage } from './pages/CreditPage';
import { UsersPage } from './pages/UsersPage';
import { CustomerDataPage } from './pages/CustomerDataPage';
import { AdvertsPage } from './pages/AdvertsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activePage, setActivePage] = useState<AdminPageKey>('dashboard');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // Live datasets
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUserMeta[]>([]);
  const [subscriptions, setSubscriptions] = useState<StoreSubscription[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [dailyOffers, setDailyOffers] = useState<DailyOfferRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccountRow[]>([]);
  const [carts, setCarts] = useState<CartRow[]>([]);
  const [favourites, setFavourites] = useState<FavouriteRow[]>([]);
  const [layouts, setLayouts] = useState<ShopperLayoutRow[]>([]);
  const [adverts, setAdverts] = useState<AdvertRow[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettingsRow | null>(null);

  const [advertsTableReady, setAdvertsTableReady] = useState(true);
  const [authRpcReady, setAuthRpcReady] = useState(true);

  const fetchMyProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile) || null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await fetchMyProfile(data.session.user.id);
      }
      if (mounted) setAuthLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        fetchMyProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchMyProfile]);

  const loadAllData = useCallback(async () => {
    if (!session || !profile || profile.role !== 'admin') return;
    setRefreshing(true);
    try {
      const [
        storesRes,
        profilesRes,
        authRpcRes,
        subsRes,
        catsRes,
        prodsRes,
        promosRes,
        dailyRes,
        ordersRes,
        creditsRes,
        cartsRes,
        favsRes,
        layoutsRes,
        advertsRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from('stores').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.rpc('admin_list_auth_users'),
        supabase
          .from('store_subscriptions')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('store_categories').select('*').order('position', { ascending: true }),
        supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3000),
        supabase.from('promotions').select('*').order('created_at', { ascending: false }),
        supabase.from('daily_offers').select('*').order('published_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('credit_accounts')
          .select('*')
          .order('requested_at', { ascending: false }),
        supabase.from('carts').select('*').order('updated_at', { ascending: false }),
        supabase.from('favourites').select('*').order('created_at', { ascending: false }),
        supabase.from('shopper_layouts').select('*').order('updated_at', { ascending: false }),
        supabase.from('adverts').select('*').order('position', { ascending: true }),
        supabase.from('app_settings').select('*').limit(1).maybeSingle(),
      ]);

      if (storesRes.data) setStores(storesRes.data as StoreRow[]);
      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);

      if (!authRpcRes.error && authRpcRes.data) {
        setAuthUsers(authRpcRes.data as AuthUserMeta[]);
        setAuthRpcReady(true);
      } else {
        setAuthRpcReady(false);
      }

      if (subsRes.data) setSubscriptions(subsRes.data as StoreSubscription[]);
      if (catsRes.data) setCategories(catsRes.data as StoreCategory[]);
      if (prodsRes.data) setProducts(prodsRes.data as ProductRow[]);
      if (promosRes.data) setPromotions(promosRes.data as PromotionRow[]);
      if (dailyRes.data) setDailyOffers(dailyRes.data as DailyOfferRow[]);
      if (ordersRes.data) setOrders(ordersRes.data as OrderRow[]);
      if (creditsRes.data) setCreditAccounts(creditsRes.data as CreditAccountRow[]);
      if (cartsRes.data) setCarts(cartsRes.data as CartRow[]);
      if (favsRes.data) setFavourites(favsRes.data as FavouriteRow[]);
      if (layoutsRes.data) setLayouts(layoutsRes.data as ShopperLayoutRow[]);

      if (!advertsRes.error && advertsRes.data) {
        setAdverts(advertsRes.data as AdvertRow[]);
        setAdvertsTableReady(true);
      } else if (
        advertsRes.error &&
        (advertsRes.error.code === '42P01' || advertsRes.error.code === 'PGRST205')
      ) {
        setAdvertsTableReady(false);
      }

      if (settingsRes.data) setAppSettings(settingsRes.data as AppSettingsRow);
    } finally {
      setRefreshing(false);
    }
  }, [session, profile]);

  useEffect(() => {
    if (session && profile?.role === 'admin' && !profile.is_suspended) {
      loadAllData();
    }
  }, [session, profile, loadAllData]);

  const counts: NavCounts = useMemo(
    () => ({
      pendingStores: stores.filter((s) => s.status === 'pending').length,
      pendingOrders: orders.filter((o) => o.status === 'pending' || o.status === 'edited')
        .length,
      pendingCredits: creditAccounts.filter((c) => c.status === 'pending').length,
      totalStores: stores.length,
      totalProducts: products.length,
      totalUsers: profiles.length,
    }),
    [stores, orders, creditAccounts, products, profiles]
  );

  const productCountByStore = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.store_id] = (m[p.store_id] || 0) + 1;
    return m;
  }, [products]);

  const categoryCountByStore = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of categories) m[c.store_id] = (m[c.store_id] || 0) + 1;
    return m;
  }, [categories]);

  const orderCountByStore = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) m[o.store_id] = (m[o.store_id] || 0) + 1;
    return m;
  }, [orders]);

  const productCountByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) {
      if (p.category_id) m[p.category_id] = (m[p.category_id] || 0) + 1;
    }
    return m;
  }, [products]);

  const selectedStoreBanner = useMemo(() => {
    if (!selectedStoreId) return null;
    const st = stores.find((s) => s.id === selectedStoreId);
    return st ? { id: st.id, name: st.name } : null;
  }, [selectedStoreId, stores]);

  const handleJumpStore = (storeId: string, page: AdminPageKey) => {
    setSelectedStoreId(storeId);
    setActivePage(page);
  };

  return (
    <AuthGate
      session={session}
      profile={profile}
      loading={authLoading}
      onRefreshProfile={async () => {
        if (session?.user) await fetchMyProfile(session.user.id);
      }}
    >
      {profile && (
        <Layout
          activePage={activePage}
          onNavigate={(page) => setActivePage(page)}
          profile={profile}
          counts={counts}
          onGlobalRefresh={loadAllData}
          refreshing={refreshing}
          selectedStoreBanner={selectedStoreBanner}
          onClearStoreBanner={() => setSelectedStoreId('')}
        >
          {activePage === 'dashboard' && (
            <DashboardPage
              stores={stores}
              profiles={profiles}
              orders={orders}
              subscriptions={subscriptions}
              categories={categories}
              products={products}
              promotions={promotions}
              dailyOffers={dailyOffers}
              creditAccounts={creditAccounts}
              adverts={adverts}
              onNavigate={setActivePage}
              onJumpStore={handleJumpStore}
              onReload={loadAllData}
            />
          )}

          {activePage === 'stores' && (
            <StoresPage
              stores={stores}
              profiles={profiles}
              productCountByStore={productCountByStore}
              categoryCountByStore={categoryCountByStore}
              orderCountByStore={orderCountByStore}
              onJumpStore={handleJumpStore}
              onReload={loadAllData}
            />
          )}

          {activePage === 'subscriptions' && (
            <SubscriptionsPage
              subscriptions={subscriptions}
              stores={stores}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'categories' && (
            <CategoriesPage
              categories={categories}
              stores={stores}
              productCountByCategory={productCountByCategory}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'products' && (
            <ProductsPage
              products={products}
              categories={categories}
              stores={stores}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'promotions' && (
            <PromotionsPage
              promotions={promotions}
              stores={stores}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'daily_offers' && (
            <DailyOffersPage
              dailyOffers={dailyOffers}
              products={products}
              stores={stores}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'orders' && (
            <OrdersPage
              orders={orders}
              stores={stores}
              profiles={profiles}
              products={products}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'credit' && (
            <CreditPage
              creditAccounts={creditAccounts}
              stores={stores}
              profiles={profiles}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'users' && (
            <UsersPage
              profiles={profiles}
              authUsers={authUsers}
              stores={stores}
              currentAdminId={profile.id}
              onReload={loadAllData}
            />
          )}

          {activePage === 'customer_data' && (
            <CustomerDataPage
              carts={carts}
              favourites={favourites}
              layouts={layouts}
              profiles={profiles}
              stores={stores}
              products={products}
              selectedStoreId={selectedStoreId}
              onReload={loadAllData}
            />
          )}

          {activePage === 'adverts' && (
            <AdvertsPage
              adverts={adverts}
              stores={stores}
              advertsTableReady={advertsTableReady}
              onReload={loadAllData}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPage
              settings={appSettings}
              advertsTableReady={advertsTableReady}
              authRpcReady={authRpcReady}
              onReload={loadAllData}
            />
          )}
        </Layout>
      )}
    </AuthGate>
  );
}
