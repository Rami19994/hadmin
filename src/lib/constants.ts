import type {
  CreditAccountStatus,
  CreditEntryKind,
  DbOrderStatus,
  PaymentStatus,
  PlanTier,
  PromotionKind,
  PromotionStatus,
  StoreStatus,
  SubscriptionStatus,
  UserRole,
  UserTrust,
} from '../types/database';

export interface CountryOption {
  code: string;
  name: string;
  nameEn: string;
  dialCode: string;
  currencyCode: string;
  currencySymbol: string;
  decimals: number;
  provinces: string[];
}

export const COUNTRIES: CountryOption[] = [
  {
    code: 'SY',
    name: 'سوريا',
    nameEn: 'Syria',
    dialCode: '+963',
    currencyCode: 'SYP',
    currencySymbol: 'ل.س',
    decimals: 0,
    provinces: [
      'دمشق',
      'ريف دمشق',
      'حلب',
      'حمص',
      'حماة',
      'اللاذقية',
      'طرطوس',
      'إدلب',
      'دير الزور',
      'الرقة',
      'الحسكة',
      'درعا',
      'السويداء',
      'القنيطرة',
    ],
  },
  {
    code: 'AE',
    name: 'الإمارات العربية المتحدة',
    nameEn: 'United Arab Emirates',
    dialCode: '+971',
    currencyCode: 'AED',
    currencySymbol: 'د.إ',
    decimals: 2,
    provinces: ['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة'],
  },
  {
    code: 'SA',
    name: 'السعودية',
    nameEn: 'Saudi Arabia',
    dialCode: '+966',
    currencyCode: 'SAR',
    currencySymbol: 'ر.س',
    decimals: 2,
    provinces: [
      'الرياض',
      'مكة المكرمة',
      'المدينة المنورة',
      'القصيم',
      'الشرقية',
      'عسير',
      'تبوك',
      'حائل',
      'الحدود الشمالية',
      'جازان',
      'نجران',
      'الباحة',
      'الجوف',
    ],
  },
  {
    code: 'JO',
    name: 'الأردن',
    nameEn: 'Jordan',
    dialCode: '+962',
    currencyCode: 'JOD',
    currencySymbol: 'د.أ',
    decimals: 3,
    provinces: [
      'عمّان',
      'إربد',
      'الزرقاء',
      'البلقاء',
      'المفرق',
      'الكرك',
      'جرش',
      'مادبا',
      'عجلون',
      'العقبة',
      'معان',
      'الطفيلة',
    ],
  },
  {
    code: 'LB',
    name: 'لبنان',
    nameEn: 'Lebanon',
    dialCode: '+961',
    currencyCode: 'LBP',
    currencySymbol: 'ل.ل',
    decimals: 0,
    provinces: [
      'بيروت',
      'جبل لبنان',
      'الشمال',
      'الجنوب',
      'البقاع',
      'بعلبك الهرمل',
      'عكار',
      'النبطية',
    ],
  },
  {
    code: 'IQ',
    name: 'العراق',
    nameEn: 'Iraq',
    dialCode: '+964',
    currencyCode: 'IQD',
    currencySymbol: 'د.ع',
    decimals: 0,
    provinces: [
      'بغداد',
      'البصرة',
      'نينوى',
      'أربيل',
      'السليمانية',
      'دهوك',
      'النجف',
      'كربلاء',
      'بابل',
      'الأنبار',
      'كركوك',
      'ديالى',
    ],
  },
  {
    code: 'PS',
    name: 'فلسطين',
    nameEn: 'Palestine',
    dialCode: '+970',
    currencyCode: 'ILS',
    currencySymbol: '₪',
    decimals: 2,
    provinces: ['القدس', 'رام الله والبيرة', 'نابلس', 'الخليل', 'غزة', 'بيت لحم', 'جنين', 'طولكرم'],
  },
  {
    code: 'KW',
    name: 'الكويت',
    nameEn: 'Kuwait',
    dialCode: '+965',
    currencyCode: 'KWD',
    currencySymbol: 'د.ك',
    decimals: 3,
    provinces: ['العاصمة', 'حولي', 'الفروانية', 'الأحمدي', 'الجهراء', 'مبارك الكبير'],
  },
  {
    code: 'QA',
    name: 'قطر',
    nameEn: 'Qatar',
    dialCode: '+974',
    currencyCode: 'QAR',
    currencySymbol: 'ر.ق',
    decimals: 2,
    provinces: ['الدوحة', 'الريان', 'الوكرة', 'الخور', 'أم صلال', 'الشمال'],
  },
  {
    code: 'BH',
    name: 'البحرين',
    nameEn: 'Bahrain',
    dialCode: '+973',
    currencyCode: 'BHD',
    currencySymbol: 'د.ب',
    decimals: 3,
    provinces: ['العاصمة', 'المحرق', 'الشمالية', 'الجنوبية'],
  },
  {
    code: 'OM',
    name: 'عُمان',
    nameEn: 'Oman',
    dialCode: '+968',
    currencyCode: 'OMR',
    currencySymbol: 'ر.ع',
    decimals: 3,
    provinces: ['مسقط', 'ظفار', 'الباطنة', 'الداخلية', 'الشرقية'],
  },
  {
    code: 'EG',
    name: 'مصر',
    nameEn: 'Egypt',
    dialCode: '+20',
    currencyCode: 'EGP',
    currencySymbol: 'ج.م',
    decimals: 2,
    provinces: ['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'المنوفية', 'أسيوط'],
  },
  {
    code: 'YE',
    name: 'اليمن',
    nameEn: 'Yemen',
    dialCode: '+967',
    currencyCode: 'YER',
    currencySymbol: 'ر.ي',
    decimals: 0,
    provinces: ['صنعاء', 'عدن', 'تعز', 'حضرموت', 'إب'],
  },
  {
    code: 'TR',
    name: 'تركيا',
    nameEn: 'Türkiye',
    dialCode: '+90',
    currencyCode: 'TRY',
    currencySymbol: '₺',
    decimals: 2,
    provinces: ['إسطنبول', 'أنقرة', 'غازي عنتاب', 'مرسين', 'بورصة', 'أضنة', 'هاتاي'],
  },
  {
    code: 'DE',
    name: 'ألمانيا',
    nameEn: 'Germany',
    dialCode: '+49',
    currencyCode: 'EUR',
    currencySymbol: '€',
    decimals: 2,
    provinces: ['برلين', 'هامبورغ', 'بافاريا', 'شمال الراين'],
  },
  {
    code: 'US',
    name: 'الولايات المتحدة',
    nameEn: 'United States',
    dialCode: '+1',
    currencyCode: 'USD',
    currencySymbol: '$',
    decimals: 2,
    provinces: [],
  },
];

export function findCountry(code: string | null | undefined): CountryOption | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

export const STORE_TYPES: { id: string; label: string }[] = [
  { id: 'mini_market', label: 'ميني ماركت (الدكان)' },
  { id: 'dukkan', label: 'دكان' },
  { id: 'samman', label: 'سمّان' },
  { id: 'grocery', label: 'بقالة' },
  { id: 'greengrocer', label: 'خضار وفواكه' },
  { id: 'pharmacy', label: 'صيدلية' },
  { id: 'auto_parts', label: 'قطع غيار سيارات' },
  { id: 'market', label: 'ماركت متوسط' },
  { id: 'super_market', label: 'سوبر ماركت' },
  { id: 'hyper_market', label: 'هايبر ماركت' },
  { id: 'bzoria', label: 'بزورية ومكسرات' },
  { id: 'attar', label: 'عطارة' },
  { id: 'bakery', label: 'مخبز ومعجنات' },
  { id: 'kiosk', label: 'كشك' },
  { id: 'cafeteria', label: 'كفتيريا' },
  { id: 'juice', label: 'عصائر' },
  { id: 'tea', label: 'شاي وقهوة' },
];

export function getStoreTypeLabel(typeId: string | null | undefined): string {
  if (!typeId) return 'ميني ماركت';
  const norm = typeId.toLowerCase().replace(/_/g, '');
  const found = STORE_TYPES.find(
    (t) => t.id === typeId || t.id.toLowerCase().replace(/_/g, '') === norm
  );
  return found ? found.label : typeId;
}

export const LICENCE_TYPES: { id: string; label: string }[] = [
  { id: 'commercial', label: 'رخصة تجارية' },
  { id: 'craft', label: 'رخصة حرفية' },
  { id: 'professional', label: 'رخصة مهنية' },
  { id: 'homeBusiness', label: 'عمل منزلي' },
  { id: 'other', label: 'أخرى' },
];

export const SUBSCRIPTION_PLANS: {
  tier: PlanTier;
  name: string;
  areaLabel: string;
  priceUsd: number;
  maxImages: number;
}[] = [
  {
    tier: 'small',
    name: 'خطة المتاجر الصغيرة (50-200 م²)',
    areaLabel: '50 م² – 200 م²',
    priceUsd: 100,
    maxImages: 2000,
  },
  {
    tier: 'medium',
    name: 'خطة المتاجر المتوسطة (200-500 م²)',
    areaLabel: '200 م² – 500 م²',
    priceUsd: 300,
    maxImages: 4000,
  },
  {
    tier: 'large',
    name: 'خطة المتاجر الكبيرة (500-2500 م²)',
    areaLabel: '500 م² – 2500 م²',
    priceUsd: 800,
    maxImages: 8000,
  },
];

export const STORE_STATUS_META: Record<
  StoreStatus,
  { label: string; badgeClass: string }
> = {
  pending: { label: 'قيد المراجعة', badgeClass: 'badge-amber' },
  approved: { label: 'معتمد ونشط', badgeClass: 'badge-green' },
  rejected: { label: 'مرفوض', badgeClass: 'badge-red' },
  suspended: { label: 'موقوف مؤقتاً', badgeClass: 'badge-slate' },
};

export const SUBSCRIPTION_STATUS_META: Record<
  SubscriptionStatus,
  { label: string; badgeClass: string }
> = {
  unpaid: { label: 'غير مدفوع', badgeClass: 'badge-amber' },
  active: { label: 'اشتراك نشط', badgeClass: 'badge-green' },
  expired: { label: 'منتهي الصلاحية', badgeClass: 'badge-red' },
  trial: { label: 'فترة تجريبية', badgeClass: 'badge-blue' },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; badgeClass: string }
> = {
  pending: { label: 'بانتظار التأكيد', badgeClass: 'badge-amber' },
  paid: { label: 'مدفوع', badgeClass: 'badge-green' },
  failed: { label: 'فشل الدفع', badgeClass: 'badge-red' },
};

export const ORDER_STATUS_META: Record<
  DbOrderStatus,
  { label: string; badgeClass: string }
> = {
  pending: { label: 'طلب جديد (أحمر)', badgeClass: 'badge-red' },
  edited: { label: 'معدّل بانتظار الزبون (أصفر)', badgeClass: 'badge-amber' },
  approved: { label: 'تمت الموافقة (أخضر)', badgeClass: 'badge-green' },
  preparing: { label: 'قيد التحضير', badgeClass: 'badge-green' },
  delivering: { label: 'قيد التوصيل', badgeClass: 'badge-blue' },
  delivered: { label: 'تم التسليم', badgeClass: 'badge-slate' },
  rejected: { label: 'مرفوض', badgeClass: 'badge-red' },
  cancelled: { label: 'ملغي من الزبون', badgeClass: 'badge-slate' },
};

export const PAYMENT_METHODS: { id: string; label: string }[] = [
  { id: 'cashOnDelivery', label: 'نقداً عند التوصيل' },
  { id: 'cardOnDelivery', label: 'بطاقة بنكية عند التوصيل' },
  { id: 'online', label: 'دفع إلكتروني' },
  { id: 'thirdParty', label: 'دفع من طرف آخر' },
  { id: 'account', label: 'على الحساب (دفتر المتجر)' },
];

export function getPaymentMethodLabel(id: string | null | undefined): string {
  if (!id) return 'نقداً عند التوصيل';
  if (id === 'cash_on_delivery') return 'نقداً عند التوصيل';
  if (id === 'card_on_delivery') return 'بطاقة بنكية عند التوصيل';
  if (id === 'third_party') return 'دفع من طرف آخر';
  return PAYMENT_METHODS.find((m) => m.id === id)?.label || id;
}

export const PROMOTION_KIND_META: Record<
  PromotionKind,
  { label: string; badgeClass: string }
> = {
  offer: { label: 'عرض (العروض)', badgeClass: 'badge-amber' },
  discount: { label: 'تخفيض (التخفيضات)', badgeClass: 'badge-green' },
};

export const PROMOTION_STATUS_META: Record<
  PromotionStatus,
  { label: string; badgeClass: string }
> = {
  published: { label: 'منشور', badgeClass: 'badge-green' },
  draft: { label: 'مسودة', badgeClass: 'badge-amber' },
  hidden: { label: 'مخفي', badgeClass: 'badge-slate' },
};

export const CREDIT_ACCOUNT_STATUS_META: Record<
  CreditAccountStatus,
  { label: string; badgeClass: string }
> = {
  pending: { label: 'طلب بانتظار الموافقة', badgeClass: 'badge-amber' },
  approved: { label: 'دفتر مفعّل', badgeClass: 'badge-green' },
  rejected: { label: 'مرفوض', badgeClass: 'badge-red' },
  suspended: { label: 'موقوف', badgeClass: 'badge-slate' },
};

export const CREDIT_ENTRY_KIND_META: Record<
  CreditEntryKind,
  { label: string; isCredit: boolean; badgeClass: string }
> = {
  topUp: { label: 'إيداع رصيد (شحن محفظة)', isCredit: true, badgeClass: 'badge-green' },
  settlement: { label: 'سداد دفعة نقدية للمتجر', isCredit: true, badgeClass: 'badge-green' },
  purchase: { label: 'شراء فاتورة على الحساب', isCredit: false, badgeClass: 'badge-red' },
  transferIn: { label: 'تحويل وارد للزبون', isCredit: true, badgeClass: 'badge-blue' },
  transferOut: { label: 'تحويل صادر من الزبون', isCredit: false, badgeClass: 'badge-amber' },
  creditAdjustment: { label: 'تعديل إداري دائن (+)', isCredit: true, badgeClass: 'badge-green' },
  debitAdjustment: { label: 'تعديل إداري مدين (-)', isCredit: false, badgeClass: 'badge-red' },
};

export const USER_ROLE_META: Record<UserRole, { label: string; badgeClass: string }> = {
  consumer: { label: 'مستهلك', badgeClass: 'badge-blue' },
  merchant: { label: 'تاجر', badgeClass: 'badge-amber' },
  admin: { label: 'مشرف عام (Admin)', badgeClass: 'badge-purple' },
};

export const USER_TRUST_META: Record<UserTrust, { label: string; badgeClass: string }> = {
  basic: { label: 'حساب أساسي (بدون هوية)', badgeClass: 'badge-slate' },
  identified: { label: 'موثّق الهوية ✓', badgeClass: 'badge-green' },
};

export const PRODUCT_UNITS: string[] = [
  'كيلو',
  'نصف كيلو',
  'غرام',
  '١٠٠ غرام',
  'قطعة',
  'حبة',
  'علبة',
  'ربطة',
  'جرزة',
  'كيس',
  'صندوق',
  'كرتونة',
  'ليتر',
  'قنينة',
  'عبوة',
  'شريط',
  'باكيت',
  'طقم',
];

export const DEFAULT_GALLERY_CATEGORIES: string[] = [
  'المشتريات اليومية',
  'خضار وفواكه',
  'لحوم وألبان',
  'مواد غذائية',
  'معلبات وصلصات',
  'مشروبات وعصائر',
  'حلويات وشوكولا',
  'مكسرات وبزورية',
  'منظفات وعناية شخصية',
  'أدوية وصيدلية',
  'قطع غيار سيارات',
  'أدوات منزلية ومستهلكات',
  'مستلزمات أطفال',
  'أخرى',
];

export const CATEGORY_ICON_KEYS: { key: string; label: string }[] = [
  { key: 'vegetables', label: 'خضار' },
  { key: 'fruits', label: 'فواكه' },
  { key: 'milk', label: 'حليب وألبان' },
  { key: 'cheese', label: 'أجبان' },
  { key: 'eggs', label: 'بيض' },
  { key: 'butter', label: 'زبدة وسمنة' },
  { key: 'meat', label: 'لحوم' },
  { key: 'chicken', label: 'دجاج' },
  { key: 'fish', label: 'سمك' },
  { key: 'bread', label: 'خبز' },
  { key: 'rice', label: 'أرز وحبوب' },
  { key: 'pasta', label: 'معكرونة' },
  { key: 'flour', label: 'طحين' },
  { key: 'legumes', label: 'بقوليات' },
  { key: 'oil', label: 'زيوت' },
  { key: 'canned', label: 'معلبات وصلصات' },
  { key: 'spices', label: 'بهارات وتوابل' },
  { key: 'salt', label: 'ملح وسكر' },
  { key: 'honey', label: 'عسل ومربى' },
  { key: 'nuts', label: 'مكسرات وبزورية' },
  { key: 'sweets', label: 'حلويات وبسكويت' },
  { key: 'chips', label: 'شيبس ومقرمشات' },
  { key: 'water', label: 'مياه' },
  { key: 'juice', label: 'عصائر' },
  { key: 'soda', label: 'مشروبات غازية' },
  { key: 'tea', label: 'شاي' },
  { key: 'coffee', label: 'قهوة' },
  { key: 'detergent', label: 'مواد تنظيف' },
  { key: 'cleaning_tools', label: 'أدوات تنظيف' },
  { key: 'soap', label: 'صابون وعناية شخصية' },
  { key: 'tissues', label: 'مناديل ورقية' },
  { key: 'baby', label: 'مستلزمات أطفال' },
  { key: 'household', label: 'أدوات منزلية' },
  { key: 'batteries', label: 'بطاريات' },
  { key: 'stationery', label: 'قرطاسية' },
  { key: 'box', label: 'متنوعات' },
  { key: 'medicine', label: 'أدوية ومسكنات' },
  { key: 'capsule', label: 'كبسولات ومضادات' },
  { key: 'syrup', label: 'شراب طبي وسعال' },
  { key: 'vitamins', label: 'فيتامينات ومكملات' },
  { key: 'ointment', label: 'مراهم وعناية بالبشرة' },
  { key: 'first_aid', label: 'إسعافات أولية' },
  { key: 'bandage', label: 'ضمادات وشاش طبي' },
  { key: 'thermometer', label: 'أجهزة قياس طبية' },
  { key: 'eyedrops', label: 'قطرات عين وأذن' },
  { key: 'mask', label: 'كمامات ووقاية' },
  { key: 'baby_milk', label: 'حليب أطفال' },
  { key: 'motor_oil', label: 'زيوت محرك' },
  { key: 'oil_filter', label: 'فلاتر سيارات' },
  { key: 'brake_pads', label: 'فحمات فرامل' },
  { key: 'spark_plugs', label: 'بواجي' },
  { key: 'car_battery', label: 'بطاريات سيارات' },
  { key: 'shock_absorber', label: 'مساعدات وتعليق' },
  { key: 'tires', label: 'إطارات وجنوط' },
  { key: 'headlight', label: 'أضواء سيارات' },
  { key: 'car_wipers', label: 'مساحات وزجاج' },
  { key: 'car_accessories', label: 'إكسسوارات سيارات' },
];

export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—';
  }
  const num = Number(amount);
  const formatted = num % 1 === 0 ? num.toLocaleString('en-US') : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ar-SY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function toLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function profileDisplayName(p?: {
  first_name_ar?: string | null;
  last_name_ar?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  email?: string | null;
  phone?: string | null;
} | null): string {
  if (!p) return 'مستخدم غير معروف';
  const ar = [p.first_name_ar, p.last_name_ar].filter(Boolean).join(' ').trim();
  if (ar) return ar;
  const en = [p.first_name_en, p.last_name_en].filter(Boolean).join(' ').trim();
  if (en) return en;
  if (p.email) return p.email;
  if (p.phone) return p.phone;
  return 'ضيف / بدون اسم';
}


export interface StandardProductCatalogItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  imageKey: 'product';
}

export const STANDARD_PRODUCT_CATALOG: StandardProductCatalogItem[] = [
  {
    "id": "std_tomato",
    "title": "بندورة طازجة",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_cucumber",
    "title": "خيار بلدي",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_potato",
    "title": "بطاطا نخب أول",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_onion",
    "title": "بصل يابس",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_garlic",
    "title": "ثوم بلدي",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_carrot",
    "title": "جزر طازج",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_eggplant",
    "title": "باذنجان أسود",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_pepper",
    "title": "فليفلة خضراء",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_lettuce",
    "title": "خس روماني",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_apple_red",
    "title": "تفاح أحمر",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_apple_yellow",
    "title": "تفاح أصفر",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_banana",
    "title": "موز إكوادوري",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_orange",
    "title": "برتقال عصير",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_lemon",
    "title": "ليمون حامض",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_grapes",
    "title": "عنب بلدي",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_watermelon",
    "title": "بطيخ أحمر",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_strawberry",
    "title": "فريز (فراولة)",
    "category": "خضار وفواكه",
    "imageUrl": "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_milk",
    "title": "حليب بقري طازج",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_cheese_white",
    "title": "جبنة بلدية بيضاء",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_cheese_yellow",
    "title": "جبنة قشقوان / شيدر",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_laban",
    "title": "لبن رائب (زبادي)",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_butter",
    "title": "زبدة وسمنة حيواني",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_eggs",
    "title": "صحن بيض طازج",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_chicken",
    "title": "دجاج طازج كامل",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_meat_beef",
    "title": "لحم عجل / هبرة",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_meat_lamb",
    "title": "لحم غنم بلدي",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_fish",
    "title": "سمك بحري طازج",
    "category": "لحوم وألبان",
    "imageUrl": "https://images.unsplash.com/photo-1534940562479-798485202619?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_bread_white",
    "title": "خبز أبيض سياحي",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_bread_brown",
    "title": "خبز أسمر / نخالة",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_rice_basmati",
    "title": "أرز بسمتي طويل",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_pasta",
    "title": "معكرونة سباغيتي",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_flour",
    "title": "طحين أبيض ممتاز",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_sugar",
    "title": "سكر ناعم",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_olive_oil",
    "title": "زيت زيتون بكر ممتاز",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_sunflower_oil",
    "title": "زيت نباتي ذرة / دوار الشمس",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_hummus",
    "title": "حمص حب درجة أولى",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_lentils",
    "title": "عدس أحمر مجروش",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_spices",
    "title": "بهارات وتوابل مشكلة",
    "category": "مواد غذائية",
    "imageUrl": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_tuna",
    "title": "تونة معلبة فاخرة",
    "category": "معلبات وصلصات",
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_tomato_paste",
    "title": "صلصة رب البندورة",
    "category": "معلبات وصلصات",
    "imageUrl": "https://images.unsplash.com/photo-1534938665420-4193effeacc4?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_jam",
    "title": "مربى فريز / مشمش",
    "category": "معلبات وصلصات",
    "imageUrl": "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_honey",
    "title": "عسل نحل طبيعي",
    "category": "معلبات وصلصات",
    "imageUrl": "https://images.unsplash.com/photo-1587049352847-4a222e784d38?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_halawa",
    "title": "حلاوة وطحينة",
    "category": "معلبات وصلصات",
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_water_bottle",
    "title": "مياه شرب صحية",
    "category": "مشروبات وعصائر",
    "imageUrl": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_juice_orange",
    "title": "عصير برتقال طبيعي",
    "category": "مشروبات وعصائر",
    "imageUrl": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_soda_cola",
    "title": "مشروبات غازية كولا",
    "category": "مشروبات وعصائر",
    "imageUrl": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_tea",
    "title": "شاي سيلاني أسود",
    "category": "مشروبات وعصائر",
    "imageUrl": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_coffee",
    "title": "قهوة تركية / اسبريسو",
    "category": "مشروبات وعصائر",
    "imageUrl": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_chips",
    "title": "شيبس بطاطا مقرمش",
    "category": "حلويات ومقرمشات",
    "imageUrl": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_biscuits",
    "title": "بسكويت شاي وكوكيز",
    "category": "حلويات ومقرمشات",
    "imageUrl": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_chocolate",
    "title": "شوكولا وحلويات",
    "category": "حلويات ومقرمشات",
    "imageUrl": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_nuts",
    "title": "مكسرات مشكلة فاخرة",
    "category": "حلويات ومقرمشات",
    "imageUrl": "https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_soap",
    "title": "صابون يدين معقم",
    "category": "منظفات وعناية شخصية",
    "imageUrl": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_shampoo",
    "title": "شامبو وشاور جل",
    "category": "منظفات وعناية شخصية",
    "imageUrl": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_detergent",
    "title": "مسحوق غسيل وسوائل جلي",
    "category": "منظفات وعناية شخصية",
    "imageUrl": "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_tissues",
    "title": "مناديل ورقية فاخرة",
    "category": "منظفات وعناية شخصية",
    "imageUrl": "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_batteries",
    "title": "بطاريات جافة",
    "category": "أدوات منزلية ومستهلكات",
    "imageUrl": "https://images.unsplash.com/photo-1619725002198-6a689b72f41d?w=400&q=80",
    "imageKey": "product"
  },
  {
    "id": "std_trash_bags",
    "title": "أكياس قمامة ومستهلكات",
    "category": "أدوات منزلية ومستهلكات",
    "imageUrl": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&q=80",
    "imageKey": "product"
  }
];
