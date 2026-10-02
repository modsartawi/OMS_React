/* PROTOTYPE 378 — throwaway. An Arabic STUB for the shell's strings, merged over the
 * `en` bundles when `?ar=1` — the menu, the Deliveries screen's headers/filters and the
 * store chip. Machine-quality MSA for layout judgement, not a translation. */
export const AR: Record<string, Record<string, unknown>> = {
  common: {
    brandName: 'المكتب الخلفي',
    storeSwitcher: { label: 'الفرع الحالي', ariaLabel: 'الفرع الحالي' },
    account: { actingStore: 'الفرع الحالي' },
  },
  deliveries: {
    title: 'مستندات التوصيل',
    emptyPrompt: 'اضبط عوامل التصفية أعلاه ثم اختر «تحميل» للبحث في مستندات التوصيل.',
    menu: { oms: 'إدارة الطلبات', deliveries: 'مستندات التوصيل' },
    actions: { load: 'تحميل', loading: 'جارٍ التحميل…' },
    filters: {
      any: 'الكل', fromDate: 'من تاريخ', toDate: 'إلى تاريخ', documentType: 'نوع المستند',
      documentSource: 'مصدر المستند', deliveryDocumentType: 'نوع مستند التوصيل', documentNo: 'رقم المستند',
      limit: 'الحد', deliveryNo: 'رقم التوصيل', storeCode: 'رمز الفرع', customerPhone: 'جوال العميل',
      orderNo: 'رقم الطلب', deliveryType: 'نوع التوصيل', documentReason: 'السبب', dawaaNow: 'دواء الآن',
    },
    columns: {
      deliveryNo: 'رقم التوصيل', documentNo: 'رقم المستند', orderNo: 'رقم الطلب', failedJobs: 'مهام فاشلة',
      documentType: 'نوع المستند', deliveryType: 'نوع التوصيل', deliveryDocumentType: 'نوع مستند التوصيل',
      dawaaNow: 'دواء الآن', documentSource: 'المصدر', reason: 'السبب', entryTime: 'وقت الإدخال',
      documentDate: 'تاريخ المستند', mobile: 'الجوال', customerName: 'اسم العميل', storeCode: 'رمز الفرع',
      isActiveInStore: 'نشط في الفرع', slot: 'الموعد', slotDay: 'يوم الموعد', netTotal: 'الصافي',
      paidAmount: 'المدفوع', deliveryFees: 'رسوم التوصيل', amountDue: 'المستحق', note: 'ملاحظة',
      cityName: 'المدينة', street: 'الشارع', readyStatus: 'حالة الجاهزية', clearStatus: 'حالة التصفية',
      deliveryStatus: 'حالة التوصيل', closeStatus: 'حالة الإغلاق', rescheduled: 'أعيدت جدولته',
      deliverySlotFrom: 'الموعد من', deliverySlotTo: 'الموعد إلى', outForDeliveryTime: 'وقت الخروج للتوصيل',
      actualDeliveryTime: 'وقت التسليم', expressCourierId: 'معرّف المندوب السريع', courierCode: 'رمز الناقل',
      courierDriverId: 'معرّف السائق', courierDriverName: 'اسم السائق', courierDriverPhone: 'جوال السائق',
      customerOtp: 'رمز التحقق', lastAction: 'آخر إجراء',
    },
  },
  document: {},
  'central-invoice': { menu: { raise: 'إصدار فاتورة مركزية', list: 'الفواتير المركزية' } },
  'ua-admin': { menu: { admin: 'الإدارة', users: 'المستخدمون' } },
  'authz-admin': { menu: { authz: 'الصلاحيات' } },
  'active-sessions': { menu: { sessions: 'الجلسات النشطة' } },
  broadcast: { menu: { sendBroadcast: 'إرسال تعميم' } },
  callcenter: { menu: { callCenter: 'مركز الاتصال', console: 'وحدة الطلبات' } },
  simulation: { menu: { pricing: 'التسعير والعروض', simulation: 'المحاكاة' } },
  'bonus-buy-download': { menu: { bonusBuyDownload: 'تنزيل عروض الشراء' } },
  'bonus-buy-inquiry': { menu: { bbyInquiry: 'استعلام عروض الشراء' } },
  coupons: { menu: { coupons: 'القسائم', couponSupport: 'دعم القسائم' } },
  eligibility: { menu: { nphies: 'نفيس', list: 'الأهلية', newCheck: 'تحقق جديد' } },
  authorizations: { menu: { authorizations: 'الموافقات المسبقة' } },
  loy: { menu: { loyalty: 'الولاء', members: 'الأعضاء' } },
  collection: {
    menu: {
      collections: 'التحصيل', acrs: 'إيصالات التحصيل', assignment: 'التكليف', attempts: 'المحاولات',
      cashCollections: 'التحصيل النقدي', deposits: 'الإيداعات', ready: 'الجاهز',
    },
  },
  settlement: { menu: { settlement: 'التسوية', overview: 'نظرة عامة', open: 'المفتوحة', ledger: 'السجل', upload: 'رفع' } },
  reports: { menu: { reports: 'التقارير', invoices: 'الفواتير', idocInspector: 'فاحص IDoc' } },
}

/** Arabic stub data for the Deliveries grid (fictional). */
export const AR_NAMES = ['نورة الحربي', 'فيصل القحطاني', 'ريم العتيبي', 'عمر الزهراني', 'لمى الشهري', 'سلطان الدوسري']
export const AR_CITIES = ['الرياض', 'جدة', 'الدمام', 'الخبر']
export const AR_DRIVERS = ['خالد ن.', 'سعد م.', 'Khalid N.']
export const AR_NOTE = 'اتصل قبل الوصول'
