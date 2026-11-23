# تأكيد موافقة المستهلك على دفتر على الحساب

طبّق `20261123200820_verified_credit_consent.sql` بعد ترحيل إرسال الطلبات، ثم انشر
دالة `credit-invitations` مع `verify_jwt = false` كما في `config.toml`. طلب التاجر
يتحقق من JWT داخل الدالة، والتأكيد العام يحتاج رمز SMS قصير الصلاحية بحد خمس محاولات.

اضبط الأسرار في إعدادات Edge Functions، ولا تضعها في التطبيق أو GitHub:

- `CREDIT_SMS_PROVIDER`: القيمة `twilio` أو `vonage`.
- `CREDIT_OTP_SECRET`: قيمة عشوائية سرية لا تقل عن 32 محرفاً.
- `CREDIT_CONSENT_URL`: رابط لوحة الأدمن المنشورة متبوعاً بـ `/credit-consent` عبر HTTPS.
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.
- Vonage: `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_FROM`.

مفاتيح `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` توفرها بيئة Supabase.
إذا لم يوجد مزوّد مفعّل، تُرفض عملية الإرسال بوضوح ولا يُفتح أي دفتر.
لا يعيد الخادم الرمز للتاجر؛ يتلقى المستهلك رابطاً ويدخل الرمز بنفسه مع موافقة صريحة.
الدفاتر القديمة تحتفظ بأرصدتها وقيودها، وتحتاج موافقة الهاتف قبل إعادة التفعيل.
