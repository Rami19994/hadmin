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
