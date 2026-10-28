export type AdminPageKey =
  | 'dashboard'
  | 'stores'
  | 'subscriptions'
  | 'categories'
  | 'products'
  | 'promotions'
  | 'daily_offers'
  | 'orders'
  | 'credit'
  | 'users'
  | 'customer_data'
  | 'adverts'
  | 'settings';

export type UserRole = 'consumer' | 'merchant' | 'admin';
export type UserTrust = 'basic' | 'identified';

export interface Profile {
  id: string;
  role: UserRole;
  first_name_ar: string | null;
  last_name_ar: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  phone: string | null;
  email: string | null;
  country_code: string | null;
  province: string | null;
  trust: UserTrust;
  favourite_store_id: string | null;
  photo_url?: string | null;
  id_photo_url?: string | null;
  is_suspended?: boolean;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUserMeta {
  id: string;
  email: string | null;
  phone: string | null;
  is_anonymous: boolean;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface ConsumerAddress {
  id: string;
  user_id: string;
  label: string;
  province: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  floor: string | null;
  unit: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
}

export type StoreStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type PlanTier = 'small' | 'medium' | 'large';
export type SubscriptionStatus = 'unpaid' | 'active' | 'expired' | 'trial';

export interface StorePhoneItem {
  label: string;
  number: string;
}

export interface StoreRow {
  id: string;
  owner_id: string | null;
  name: string;
  type: string;
  status: StoreStatus;
  country_code: string | null;
  province: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email?: string | null;
  phones?: StorePhoneItem[];
  logo_url: string | null;
  logo_key: string | null;
  currency: string;
  vat_enabled: boolean;
  vat_percent: number;
  accepted_payments: string[];
  delivers: boolean;
  open_now: boolean;
  subscription_expires_at: string | null;
  plan_tier?: PlanTier | null;
  plan_name?: string | null;
  max_images?: number;
  extra_images?: number;
  subscription_status?: SubscriptionStatus;
  subscription_price?: number | null;
  subscription_started_at?: string | null;
  licence_type?: string | null;
  licence_number?: string | null;
  licence_url?: string | null;
  working_hours?: Record<string, unknown> | null;
  delivery_options?: Record<string, unknown> | null;
  bank_account?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface StoreSubscription {
  id: string;
  store_id: string;
  plan_tier: PlanTier;
  plan_name: string;
  amount: number;
  currency: string;
  duration_months: number;
  payment_method: string;
  payment_reference: string | null;
  payment_status: PaymentStatus;
  max_images: number;
  starts_at: string;
  expires_at: string;
  created_at: string;
}

export interface StoreCategory {
  id: string;
  store_id: string;
  name: string;
  image_key: string | null;
  image_url: string | null;
  position: number;
  is_hidden?: boolean;
  created_at: string;
}

export interface ProductExtraUnit {
  unit: string;
  price: number;
  quantity: number;
}

export interface ProductRow {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  name_en: string | null;
  price: number;
  unit: string;
  quantity: number;
  available: boolean;
  position: number;
  image_key: string | null;
  image_url: string | null;
  source: string | null;
  extra_units: ProductExtraUnit[];
  created_at: string;
  updated_at: string;
}

export interface DailyOfferRow {
  id: string;
  store_id: string;
  product_id: string | null;
  title: string;
  price: number | null;
  old_price: number | null;
  image_key: string | null;
  image_url: string | null;
  note: string | null;
  published_at: string;
  expires_at: string;
  extended_count: number;
}

export type PromotionKind = 'offer' | 'discount';
export type PromotionStatus = 'draft' | 'published' | 'hidden';
export type PromotionExpiryMode = 'date' | 'count';
export type PromotionAfterExpiry = 'delete' | 'keepWatermarked';

export interface PromotionRow {
  id: string;
  store_id: string;
  kind: PromotionKind;
  title: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  currency: string;
  media_key: string | null;
  media_url: string | null;
  media_type: string;
  artwork_has_prices: boolean;
  expiry_mode: PromotionExpiryMode;
  total_count: number | null;
  sold_count: number;
  starts_at: string | null;
  ends_at: string | null;
  show_remaining: boolean;
  exclusive: boolean;
  max_per_person: number | null;
  after_expiry: PromotionAfterExpiry;
  status: PromotionStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DbOrderStatus =
  | 'pending'
  | 'approved'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'rejected'
  | 'cancelled'
  | 'edited';

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  unavailable: boolean;
  substitute_of: string | null;
  position: number;
}

export interface OrderRow {
  id: string;
  store_id: string;
  consumer_id: string;
  status: DbOrderStatus;
  payment_method: string;
  online_mode: string | null;
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  merchant_note: string | null;
  rejection_reason: string | null;
  cash_denomination: number | null;
  currency: string;
  vat_percent: number;
  opened: boolean;
  created_at: string;
  approved_at: string | null;
  delivered_at: string | null;
  order_items?: OrderItemRow[];
}

export type CreditAccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface CreditAccountRow {
  id: string;
  store_id: string;
  consumer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: CreditAccountStatus;
  balance: number;
  credit_limit: number;
  identity_verified: boolean;
  requested_at: string;
}

export type CreditEntryKind =
  | 'purchase'
  | 'topUp'
  | 'settlement'
  | 'transferIn'
  | 'transferOut'
  | 'creditAdjustment'
  | 'debitAdjustment';

export interface CreditEntryRow {
  id: string;
  account_id: string;
  kind: CreditEntryKind;
  amount: number;
  balance_after: number;
  note: string | null;
  note_en: string | null;
  order_id: string | null;
  counterpart_name: string | null;
  at: string;
}

export interface FavouriteRow {
  user_id: string;
  store_id: string;
  created_at: string;
}

export interface CartLineItem {
  productId?: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string | null;
  imageKey?: string | null;
}

export interface CartRow {
  id: string;
  user_id: string;
  store_id: string;
  lines: CartLineItem[];
  updated_at: string;
}

export interface ShopperLayoutRow {
  user_id: string;
  store_id: string;
  categories: string[];
  products: Record<string, string[]>;
  daily: string[];
  updated_at: string;
}

export interface AdvertRow {
  id: string;
  store_id: string | null;
  store_name: string;
  headline: string;
  subline: string;
  image_url: string | null;
  image_key: string | null;
  country_code: string | null;
  provinces: string[];
  accent_color: string;
  price_paid: number;
  currency: string;
  position: number;
  active: boolean;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettingsRow {
  id: boolean;
  auto_approve_stores: boolean;
  app_version_name?: string;
  app_build_number?: number;
  force_update?: boolean;
  update_url?: string | null;
  android_url?: string | null;
  ios_url?: string | null;
  support_phone?: string | null;
  support_whatsapp?: string | null;
  support_email?: string | null;
  website_url?: string | null;
  billing_instructions?: string | null;
  maintenance_mode?: boolean;
  announcement_banner?: string | null;
  updated_at: string;
}
