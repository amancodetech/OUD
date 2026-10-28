# 22 — القاموس المحاسبي والتجاري الشامل (العربية 🇸🇦 | الإندونيسية 🇮🇩 | الإنجليزية 🇬🇧) وأكواد `src/i18n/`

> **الغرض من هذا المستند:** توفير القاموس الكامل والدقيق لمجال تجارة وتصنيع العود ودهن العود والعطور والمحاسبة باللغات الثلاث (**العربية**، **الإندونيسية Bahasa Indonesia**، **الإنجليزية English**)، مع الأكواد الكاملة الجاهزة لملفات `src/i18n/` لكي يقوم **Gemini Flash** بنسخها وتطبيقها مباشرة بدون أي اجتهاد خاطئ أو نقص في المفاتيح.

---

## 1. جدول المصطلحات التخصصية في قطاع العود والعطور والمحاسبة (Reference Glossary)

| المصطلح بالعربية (`ar`) | المصطلح بالإندونيسية (`id` - Bahasa Indonesia) | المصطلح بالإنجليزية (`en` - English) |
| :--- | :--- | :--- |
| **مؤسسة سدرة العود** | **Sidrat Al-Oud** | **Sidrat Al-Oud** |
| **عود طبيعي** | **Gaharu Alami (Natural Oud)** | **Natural Oud** |
| **عود محسن** | **Gaharu Olahan (Enhanced Oud)** | **Enhanced Oud** |
| **دهن عود** | **Minyak Gaharu (Oud Oil)** | **Oud Oil (Dehn Al-Oud)** |
| **مخلطات ملكية** | **Campuran Royal (Royal Blends)** | **Royal Blends** |
| **عطور زيتية** | **Parfum Oil (Bibit Parfum)** | **Oil Perfumes** |
| **عطور بخاخ** | **Parfum Spray** | **Spray Perfumes** |
| **تولة / ربع تولة / نانو تولة** | **Tola / Seperempat Tola / Nano Tola** | **Tola / Quarter Tola / Nano Tola** |
| **أوقية** | **Ounce (Uqiyah)** | **Ounce (Uqiyah)** |
| **بضاعة جاهزة للبيع (`MERCHANDISE`)** | **Barang Dagangan Siap Jual** | **Merchandise Ready for Sale** |
| **مادة خام (`RAW`)** | **Bahan Baku & Kemasan** | **Raw Material & Packaging** |
| **منتج نهائي مصنع (`FINISHED`)** | **Produk Jadi (Hasil Produksi)** | **Manufactured Finished Product** |
| **صرف عينات وتجربة وضيافة** | **Pemakaian Stok (Sampel / Tester / Rusak)** | **Stock Issues (Samples / Tester / Damaged)** |
| **التصنيع والتركيب** | **Produksi & Racikan Parfum** | **Manufacturing & Blending** |
| **ترشيحات وهدايا السائقين** | **Rekomendasi & Hadiah Supir / Pemandu** | **Driver Referrals & Gifts** |
| **ذمم العملاء (لنا عندهم)** | **Piutang Pelanggan** | **Accounts Receivable (Customer Debts)** |
| **ذمم الموردين (لهم عندنا)** | **Utang Supplier** | **Accounts Payable (Supplier Payables)** |
| **متوسط التكلفة المرجح** | **Rata-rata Tertimbang (WAC)** | **Weighted Average Cost (WAC)** |
| **رصيد افتتاحي (`افتتاحي`)** | **Saldo Awal** | **Opening Balance** |

---

## 2. الملف الأول: `src/i18n/types.ts`

يجب إنشاء هذا الملف لتعريف نوع `Locale` ونوع القاموس `Dictionary`:

```typescript
// src/i18n/types.ts
export type Locale = 'ar' | 'id' | 'en';

export interface Dictionary {
  meta: {
    localeName: string;
    dir: 'rtl' | 'ltr';
    brandTitle: string;
    brandSubtitle: string;
  };
  common: {
    save: string;
    saving: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    all: string;
    loading: string;
    noData: string;
    actions: string;
    notes: string;
    date: string;
    amount: string;
    total: string;
    quantity: string;
    unitPrice: string;
    unitCost: string;
    discount: string;
    tax: string;
    netTotal: string;
    paidAmount: string;
    remainingAmount: string;
    status: string;
    active: string;
    inactive: string;
    yes: string;
    no: string;
    print: string;
    exportExcel: string;
    importExcel: string;
    close: string;
    confirmDelete: string;
    successSaved: string;
    errorOccurred: string;
    requiredField: string;
    selectOption: string;
    openingBalanceKey: string;
    back: string;
    refresh: string;
    viewDetails: string;
  };
  header: {
    periodLabel: string;
    fullYear: string;
    allTime: string;
    monthsGroup: string;
    months: string[];
    setupComplete: string;
    setupWarningTitle: string;
    setupWizardBtn: string;
    dailyClosingBtn: string;
    languageLabel: string;
  };
  sidebar: {
    groupAnalytics: string;
    groupDailyOps: string;
    groupWarehouse: string;
    groupMasterData: string;
    dashboard: string;
    inventory: string;
    debts: string;
    sales: string;
    purchases: string;
    cash: string;
    returns: string;
    stockIssues: string;
    manufacturing: string;
    drivers: string;
    parties: string;
    items: string;
    partners: string;
    setup: string;
    settings: string;
    expandSidebar: string;
    collapseSidebar: string;
    logout: string;
    logoutConfirm: string;
  };
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    username: string;
    password: string;
    loginBtn: string;
    loggingIn: string;
    invalidCredentials: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    kpiNetSales: string;
    kpiGrossProfit: string;
    kpiNetProfit: string;
    kpiCashBalance: string;
    kpiInventoryValue: string;
    kpiCustomerDebts: string;
    kpiSupplierDebts: string;
    kpiExpenses: string;
    chartMonthlySalesProfit: string;
    chartTopItems: string;
    chartExpenseBreakdown: string;
    quickActions: string;
    newSale: string;
    newPurchase: string;
    newCashEntry: string;
    lowStockAlerts: string;
    overdueDebtsAlerts: string;
  };
  sales: {
    title: string;
    subtitle: string;
    newInvoice: string;
    invoiceNo: string;
    customer: string;
    selectCustomer: string;
    invoiceDate: string;
    item: string;
    selectItem: string;
    availableStock: string;
    avgCost: string;
    qty: string;
    sellingPrice: string;
    lineDiscount: string;
    lineTotal: string;
    lineProfit: string;
    addItemLine: string;
    subtotal: string;
    invoiceDiscount: string;
    otherCharges: string;
    grandTotal: string;
    amountPaidNow: string;
    remainingOnCustomer: string;
    driverReferral: string;
    noDriver: string;
    saveInvoice: string;
    printInvoice: string;
    invoiceHistory: string;
    fullyPaid: string;
    partiallyPaid: string;
    unpaidCredit: string;
    insufficientStockError: string;
    belowCostWarning: string;
  };
  purchases: {
    title: string;
    subtitle: string;
    newPurchase: string;
    invoiceNo: string;
    supplier: string;
    selectSupplier: string;
    purchaseDate: string;
    item: string;
    qty: string;
    purchaseUnitPrice: string;
    lineShipping: string;
    lineOtherCost: string;
    landedUnitCost: string;
    lineTotalCost: string;
    amountPaidToSupplier: string;
    remainingToSupplier: string;
    savePurchase: string;
    purchaseHistory: string;
  };
  cash: {
    title: string;
    subtitle: string;
    newTransaction: string;
    txNo: string;
    txDate: string;
    txType: string;
    directionIn: string;
    directionOut: string;
    party: string;
    linkedInvoice: string;
    expenseCategory: string;
    description: string;
    cashIn: string;
    cashOut: string;
    runningBalance: string;
    currentCashBalance: string;
    saveTransaction: string;
  };
  returns: {
    title: string;
    subtitle: string;
    newReturn: string;
    returnNo: string;
    returnType: string;
    salesReturn: string;
    purchaseReturn: string;
    originalInvoice: string;
    settlementMethod: string;
    cashRefund: string;
    deductFromDebt: string;
    returnQty: string;
    unitValue: string;
    totalReturnAmount: string;
    reason: string;
    saveReturn: string;
  };
  stockIssues: {
    title: string;
    subtitle: string;
    newIssue: string;
    issueNo: string;
    issueDate: string;
    issueType: string;
    sampleTester: string;
    hospitalityGift: string;
    damagedLoss: string;
    driverGift: string;
    otherIssue: string;
    costAtIssue: string;
    totalCostIssued: string;
    recipientOrDriver: string;
    saveIssue: string;
  };
  manufacturing: {
    title: string;
    subtitle: string;
    newBatch: string;
    batchNo: string;
    batchDate: string;
    finishedItem: string;
    producedQty: string;
    rawMaterialsUsed: string;
    rawMaterial: string;
    consumedQty: string;
    rawUnitCost: string;
    rawTotalCost: string;
    additionalPackagingCost: string;
    totalBatchCost: string;
    unitProductionCost: string;
    addRawLine: string;
    saveBatch: string;
    batchBalanceWarning: string;
  };
  drivers: {
    title: string;
    subtitle: string;
    newDriverLog: string;
    driverName: string;
    driverPhone: string;
    visitDate: string;
    touristsCount: string;
    linkedSalesInvoice: string;
    salesAmountGenerated: string;
    commissionRate: string;
    commissionAmount: string;
    commissionPaid: string;
    giftItemGiven: string;
    giftQty: string;
    giftCost: string;
    totalDriversSales: string;
    totalCommissionsAndGifts: string;
    saveDriverLog: string;
  };
  inventory: {
    title: string;
    subtitle: string;
    stockSummaryTab: string;
    stockCardTab: string;
    itemCode: string;
    itemName: string;
    category: string;
    role: string;
    unit: string;
    openingQty: string;
    purchasedQty: string;
    manufacturedInQty: string;
    salesReturnQty: string;
    soldQty: string;
    purchaseReturnQty: string;
    manufacturedOutQty: string;
    issuedSampleDamagedQty: string;
    currentStock: string;
    weightedAvgCost: string;
    totalInventoryValue: string;
    reorderLevel: string;
    stockStatusOk: string;
    stockStatusLow: string;
    stockStatusOut: string;
    selectItemForCard: string;
    movementType: string;
    qtyIn: string;
    qtyOut: string;
    balanceAfter: string;
  };
  debts: {
    title: string;
    subtitle: string;
    customerDebtsTab: string;
    supplierDebtsTab: string;
    invoiceFollowupTab: string;
    partyCode: string;
    partyName: string;
    openingBalance: string;
    totalInvoices: string;
    totalReturns: string;
    totalPayments: string;
    netBalance: string;
    lastTxDate: string;
    daysSinceLastTx: string;
    agingBucket: string;
    viewStatement: string;
    collectPayment: string;
    paySupplier: string;
  };
  parties: {
    title: string;
    subtitle: string;
    addParty: string;
    code: string;
    name: string;
    type: string;
    phone: string;
    cityOrCountry: string;
    openingBalance: string;
    openingBalanceDate: string;
    creditLimit: string;
  };
  items: {
    title: string;
    subtitle: string;
    addItem: string;
    code: string;
    name: string;
    category: string;
    unit: string;
    role: string;
    defaultSalePrice: string;
    openingQty: string;
    openingUnitCost: string;
    reorderPoint: string;
  };
  partners: {
    title: string;
    subtitle: string;
    partnersTab: string;
    fixedAssetsTab: string;
    partnerName: string;
    capitalSharePercent: string;
    capitalContributed: string;
    withdrawals: string;
    profitShare: string;
    netPartnerBalance: string;
    assetName: string;
    purchaseDate: string;
    purchaseCost: string;
    usefulLifeYears: string;
    currentBookValue: string;
  };
  setup: {
    title: string;
    subtitle: string;
    stepStoreInfo: string;
    stepCategoriesUnits: string;
    stepOpeningCash: string;
    stepOpeningInventory: string;
    stepOpeningDebts: string;
    completeSetupBtn: string;
  };
  settings: {
    title: string;
    subtitle: string;
    companyName: string;
    companySubtitle: string;
    currencySymbol: string;
    fiscalYearStart: string;
    openingCashBalance: string;
    defaultCommissionRate: string;
    backupAndRestore: string;
    downloadExcelBackup: string;
  };
  closingModal: {
    title: string;
    subtitle: string;
    checkSalesEntered: string;
    checkPurchasesEntered: string;
    checkCashCounted: string;
    checkSamplesRecorded: string;
    checkDriverLogsUpdated: string;
    systemCashBalance: string;
    actualCashCounted: string;
    cashDifference: string;
    cashMatched: string;
    cashShortage: string;
    cashSurplus: string;
    confirmDailyClose: string;
  };
  print: {
    taxInvoiceTitle: string;
    statementOfAccountTitle: string;
    invoiceNumber: string;
    date: string;
    customerName: string;
    phone: string;
    itemDescription: string;
    unit: string;
    qty: string;
    unitPrice: string;
    total: string;
    subtotal: string;
    discount: string;
    netAmount: string;
    paid: string;
    remainingBalance: string;
    thankYouMessage: string;
    signatureSeller: string;
    signatureReceiver: string;
    printNow: string;
    switchPrintLang: string;
  };
}
```

---

## 3. الملف الثاني: `src/i18n/dictionaries/ar.ts` (القاموس العربي)

```typescript
// src/i18n/dictionaries/ar.ts
import { Dictionary } from '../types';

export const ar: Dictionary = {
  meta: {
    localeName: 'العربية',
    dir: 'rtl',
    brandTitle: 'مؤسسة سدرة العود',
    brandSubtitle: 'النظام المالي والمخزني المتكامل',
  },
  common: {
    save: 'حفظ',
    saving: 'جاري الحفظ...',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    search: 'بحث...',
    filter: 'تصفية',
    all: 'الكل',
    loading: 'جاري التحميل...',
    noData: 'لا توجد بيانات مسجلة حالياً',
    actions: 'إجراءات',
    notes: 'ملاحظات',
    date: 'التاريخ',
    amount: 'المبلغ',
    total: 'الإجمالي',
    quantity: 'الكمية',
    unitPrice: 'سعر الوحدة',
    unitCost: 'تكلفة الوحدة',
    discount: 'الخصم',
    tax: 'الضريبة',
    netTotal: 'الصافي',
    paidAmount: 'المدفوع',
    remainingAmount: 'المتبقي (آجل)',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    yes: 'نعم',
    no: 'لا',
    print: 'طباعة',
    exportExcel: 'تصدير إكسل',
    importExcel: 'استيراد إكسل',
    close: 'إغلاق',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    successSaved: 'تم الحفظ بنجاح',
    errorOccurred: 'حدث خطأ أثناء العملية',
    requiredField: 'هذا الحقل مطلوب',
    selectOption: 'اختر...',
    openingBalanceKey: 'افتتاحي',
    back: 'رجوع',
    refresh: 'تحديث',
    viewDetails: 'التفاصيل',
  },
  header: {
    periodLabel: 'الفترة:',
    fullYear: 'السنة كاملة',
    allTime: 'طوال فترة الإدخال (تراكمي)',
    monthsGroup: 'أشهر السنة',
    months: [
      'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)',
      'مايو (5)', 'يونيو (6)', 'يوليو (7)', 'أغسطس (8)',
      'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)',
    ],
    setupComplete: 'حالة التأسيس: مكتمل وجاهز للعمل',
    setupWarningTitle: 'تنبيه التأسيس (C7):',
    setupWizardBtn: 'معالج التهيئة',
    dailyClosingBtn: 'الإقفال اليومي',
    languageLabel: 'اللغة',
  },
  sidebar: {
    groupAnalytics: 'التحليلات والتقارير',
    groupDailyOps: 'العمليات اليومية',
    groupWarehouse: 'المستودع والتشغيل',
    groupMasterData: 'البيانات الأساسية',
    dashboard: 'لوحة التحكم',
    inventory: 'المخزون وبطاقة الصنف',
    debts: 'الديون وكشف الحساب',
    sales: 'المبيعات',
    purchases: 'المشتريات',
    cash: 'الصندوق والمدفوعات',
    returns: 'المرتجعات',
    stockIssues: 'صرف المخزون والعينات',
    manufacturing: 'التصنيع والتركيب',
    drivers: 'ترشيحات وهدايا السائقين',
    parties: 'العملاء والموردين',
    items: 'دليل الأصناف',
    partners: 'الشركاء والأصول',
    setup: 'معالج التأسيس',
    settings: 'الإعدادات والنسخ الاحتياطي',
    expandSidebar: 'توسيع القائمة',
    collapseSidebar: 'طي القائمة',
    logout: 'تسجيل الخروج',
    logoutConfirm: 'هل تريد تسجيل الخروج من النظام؟',
  },
  auth: {
    loginTitle: 'تسجيل الدخول إلى النظام',
    loginSubtitle: 'مؤسسة سدرة العود — الإدارة المالية والمخزنية',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    loginBtn: 'دخول للنظام',
    loggingIn: 'جاري التحقق...',
    invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة',
  },
  dashboard: {
    title: 'لوحة التحكم والمؤشرات المالية',
    subtitle: 'ملخص الأداء المالي والمخزني والديون للفترة المحددة',
    kpiNetSales: 'صافي المبيعات',
    kpiGrossProfit: 'إجمالي الربح التشغيلي',
    kpiNetProfit: 'صافي الربح النهائي',
    kpiCashBalance: 'رصيد الصندوق النقدي',
    kpiInventoryValue: 'قيمة المخزون الحالي',
    kpiCustomerDebts: 'ديون لنا عند العملاء',
    kpiSupplierDebts: 'ديون للموردين علينا',
    kpiExpenses: 'المصاريف التشغيلية',
    chartMonthlySalesProfit: 'المبيعات والأرباح الشهرية',
    chartTopItems: 'الأصناف الأكثر مبيعاً وربحية',
    chartExpenseBreakdown: 'تحليل المصاريف التشغيلية',
    quickActions: 'إجراءات سريعة',
    newSale: 'فاتورة بيع جديدة',
    newPurchase: 'فاتورة شراء جديدة',
    newCashEntry: 'سند قبض / صرف',
    lowStockAlerts: 'تنبيهات نواقص المخزون',
    overdueDebtsAlerts: 'الديون المتأخرة',
  },
  sales: {
    title: 'إدارة المبيعات والفواتير',
    subtitle: 'تسجيل فواتير البيع النقدي والآجل وحساب تكلفة البضاعة المباعة والربح تلقائياً',
    newInvoice: 'فاتورة مبيعات جديدة',
    invoiceNo: 'رقم الفاتورة',
    customer: 'العميل',
    selectCustomer: 'اختر العميل...',
    invoiceDate: 'تاريخ الفاتورة',
    item: 'الصنف',
    selectItem: 'اختر الصنف...',
    availableStock: 'المتاح بالمخزون',
    avgCost: 'متوسط التكلفة',
    qty: 'الكمية',
    sellingPrice: 'سعر البيع',
    lineDiscount: 'خصم السطر',
    lineTotal: 'إجمالي السطر',
    lineProfit: 'ربح السطر',
    addItemLine: 'إضافة صنف آخر',
    subtotal: 'إجمالي الأصناف',
    invoiceDiscount: 'خصم إضافي على الفاتورة',
    otherCharges: 'رسوم توصيل / إضافية',
    grandTotal: 'صافي الفاتورة النهائي',
    amountPaidNow: 'المبلغ المقبوض نقداً الآن',
    remainingOnCustomer: 'المتبقي في ذمة العميل (آجل)',
    driverReferral: 'السائق / المرشد السياحي',
    noDriver: 'بدون سائق / مباشر',
    saveInvoice: 'حفظ واعتماد الفاتورة',
    printInvoice: 'طباعة الفاتورة',
    invoiceHistory: 'سجل فواتير المبيعات',
    fullyPaid: 'خالص (نقدي)',
    partiallyPaid: 'مدفوع جزئياً',
    unpaidCredit: 'آجل بالكامل',
    insufficientStockError: 'الكمية المطلوبة أكبر من الرصيد المتاح في المخزون!',
    belowCostWarning: 'تنبيه: سعر البيع أقل من متوسط التكلفة!',
  },
  purchases: {
    title: 'إدارة المشتريات والتوريد',
    subtitle: 'تسجيل فواتير الشراء وتحديث متوسط التكلفة المرجح (WAC) للمخزون تلقائياً',
    newPurchase: 'فاتورة مشتريات جديدة',
    invoiceNo: 'رقم فاتورة الشراء',
    supplier: 'المورد',
    selectSupplier: 'اختر المورد...',
    purchaseDate: 'تاريخ الشراء',
    item: 'الصنف المشترى',
    qty: 'الكمية الواردة',
    purchaseUnitPrice: 'سعر شراء الوحدة',
    lineShipping: 'نصيب السطر من الشحن',
    lineOtherCost: 'مصاريف جمركية/إضافية',
    landedUnitCost: 'التكلفة الفعلية للوحدة',
    lineTotalCost: 'إجمالي تكلفة السطر',
    amountPaidToSupplier: 'المدفوع للمورد الآن',
    remainingToSupplier: 'المتبقي للمورد (آجل)',
    savePurchase: 'حفظ فاتورة الشراء',
    purchaseHistory: 'سجل فواتير المشتريات',
  },
  cash: {
    title: 'الصندوق والمدفوعات النقدية',
    subtitle: 'سجل سندات القبض والصرف والمصاريف التشغيلية وتحصيل الديون وسداد الموردين',
    newTransaction: 'تسجيل حركة صندوق جديدة',
    txNo: 'رقم السند',
    txDate: 'تاريخ الحركة',
    txType: 'نوع الحركة النقدية',
    directionIn: 'قبض (وارد للصندوق +)',
    directionOut: 'صرف (صادر من الصندوق -)',
    party: 'العميل / المورد / الشريك',
    linkedInvoice: 'الفاتورة المرتبطة (اختياري)',
    expenseCategory: 'بند المصروف',
    description: 'البيان / التفاصيل',
    cashIn: 'وارد (قبض)',
    cashOut: 'صادر (صرف)',
    runningBalance: 'الرصيد التراكمي',
    currentCashBalance: 'الرصيد النقدي الفعلي بالصندوق',
    saveTransaction: 'حفظ سند الصندوق',
  },
  returns: {
    title: 'مرتجعات المبيعات والمشتريات',
    subtitle: 'معالجة استرجاع البضائع من العملاء أو إرجاعها للموردين مع التسوية المخزنية والمالية',
    newReturn: 'تسجيل مرتجع جديد',
    returnNo: 'رقم المرتجع',
    returnType: 'نوع المرتجع',
    salesReturn: 'مرتجع مبيعات (من عميل)',
    purchaseReturn: 'مرتجع مشتريات (إلى مورد)',
    originalInvoice: 'الفاتورة الأصلية',
    settlementMethod: 'طريقة التسوية المالية',
    cashRefund: 'رد نقدي فوري من/إلى الصندوق',
    deductFromDebt: 'خصم من رصيد الدين الآجل',
    returnQty: 'الكمية المرتجعة',
    unitValue: 'قيمة الوحدة',
    totalReturnAmount: 'إجمالي قيمة المرتجع',
    reason: 'سبب الإرجاع',
    saveReturn: 'حفظ واعتماد المرتجع',
  },
  stockIssues: {
    title: 'صرف المخزون والعينات والتالف',
    subtitle: 'تسجيل المنصرف غير البيعي (عينات تجربة، ضيافة، هدايا سائقين، أو تالف/فاقد) بتكلفته الفعلية',
    newIssue: 'إذن صرف مخزني جديد',
    issueNo: 'رقم إذن الصرف',
    issueDate: 'تاريخ الصرف',
    issueType: 'غرض الصرف',
    sampleTester: 'عينات وتجربة (Tester)',
    hospitalityGift: 'ضيافة وإكراميات عملاء',
    damagedLoss: 'تالف / فاقد / كسر',
    driverGift: 'هدية سائق / مرشد',
    otherIssue: 'صرف تشغيلي آخر',
    costAtIssue: 'تكلفة الوحدة عند الصرف',
    totalCostIssued: 'إجمالي تكلفة المنصرف',
    recipientOrDriver: 'المستلم / السائق',
    saveIssue: 'حفظ إذن الصرف',
  },
  manufacturing: {
    title: 'التصنيع والتركيب والتعبئة',
    subtitle: 'تحويل المواد الخام (دهن، عود، زجاجات، علب) إلى منتجات نهائية جاهزة للبيع وحساب تكلفتها',
    newBatch: 'تشغيلة تصنيع جديدة',
    batchNo: 'رقم التشغيلة',
    batchDate: 'تاريخ التصنيع',
    finishedItem: 'المنتج النهائي المصنع',
    producedQty: 'الكمية المنتجة (وارد للمخزون)',
    rawMaterialsUsed: 'المواد الخام والعبوات المستهلكة',
    rawMaterial: 'المادة الخام / العبوة',
    consumedQty: 'الكمية المسحوبة',
    rawUnitCost: 'تكلفة الوحدة الخام',
    rawTotalCost: 'إجمالي تكلفة الخام',
    additionalPackagingCost: 'تكاليف تشغيل/تغليف إضافية',
    totalBatchCost: 'إجمالي تكلفة التشغيلة',
    unitProductionCost: 'تكلفة إنتاج الوحدة الواحدة',
    addRawLine: 'إضافة مادة خام للخلطة',
    saveBatch: 'اعتماد تشغيلة التصنيع',
    batchBalanceWarning: 'تأكد من إدخال جميع المواد الخام لحساب تكلفة المنتج النهائي بدقة',
  },
  drivers: {
    title: 'ترشيحات وهدايا السائقين والمرشدين',
    subtitle: 'متابعة السائقين والمرشدين السياحيين، ومبيعاتهم، وعمولاتهم النقدية والهدايا العينية',
    newDriverLog: 'تسجيل زيارة / عمولة سائق',
    driverName: 'اسم السائق / المرشد',
    driverPhone: 'رقم الجوال',
    visitDate: 'تاريخ الزيارة',
    touristsCount: 'عدد الزوار/السياح',
    linkedSalesInvoice: 'فاتورة البيع المرتبطة',
    salesAmountGenerated: 'قيمة المبيعات المحققة',
    commissionRate: 'نسبة العمولة (%)',
    commissionAmount: 'قيمة العمولة المستحقة',
    commissionPaid: 'المسدد من العمولة',
    giftItemGiven: 'صنف الهدية العينية',
    giftQty: 'كمية الهدية',
    giftCost: 'تكلفة الهدية',
    totalDriversSales: 'إجمالي مبيعات السائقين',
    totalCommissionsAndGifts: 'إجمالي العمولات والهدايا',
    saveDriverLog: 'حفظ سجل السائق',
  },
  inventory: {
    title: 'المخزون وبطاقة حركة الصنف',
    subtitle: 'مراقبة الأرصدة الفعلية، ومتوسط التكلفة المرجح (WAC)، وكشف حركة كل صنف بالتفصيل',
    stockSummaryTab: 'ملخص أرصدة المخزون',
    stockCardTab: 'بطاقة الصنف التفصيلية (Stock Card)',
    itemCode: 'كود الصنف',
    itemName: 'اسم الصنف',
    category: 'التصنيف',
    role: 'طبيعة الصنف',
    unit: 'الوحدة',
    openingQty: 'رصيد أول المدة',
    purchasedQty: 'وارد مشتريات (+)',
    manufacturedInQty: 'وارد تصنيع (+)',
    salesReturnQty: 'مرتجع مبيعات (+)',
    soldQty: 'صادر مبيعات (-)',
    purchaseReturnQty: 'مرتجع مشتريات (-)',
    manufacturedOutQty: 'مسحوب للتصنيع (-)',
    issuedSampleDamagedQty: 'صرف عينات/تالف (-)',
    currentStock: 'الرصيد الفعلي الحالي',
    weightedAvgCost: 'متوسط التكلفة (WAC)',
    totalInventoryValue: 'القيمة الإجمالية للمخزون',
    reorderLevel: 'حد إعادة الطلب',
    stockStatusOk: 'متوفر',
    stockStatusLow: 'منخفض (قارب النفاد)',
    stockStatusOut: 'نافد (0)',
    selectItemForCard: 'اختر الصنف لعرض بطاقة حركته التاريخية:',
    movementType: 'نوع الحركة',
    qtyIn: 'وارد (+)',
    qtyOut: 'صادر (-)',
    balanceAfter: 'الرصيد بعد الحركة',
  },
  debts: {
    title: 'الديون وأعمار الذمم وكشوف الحساب',
    subtitle: 'متابعة مديونيات العملاء ومستحقات الموردين وتعمير الديون (30/60/90 يوم) ومتابعة الفواتير',
    customerDebtsTab: 'ديون العملاء (لنا عندهم)',
    supplierDebtsTab: 'مستحقات الموردين (لهم عندنا)',
    invoiceFollowupTab: 'متابعة السداد على مستوى الفاتورة',
    partyCode: 'الكود',
    partyName: 'اسم العميل / المورد',
    openingBalance: 'الرصيد الافتتاحي',
    totalInvoices: 'إجمالي الفواتير الآجلة',
    totalReturns: 'المرتجعات (-)',
    totalPayments: 'المسدد / المحصل (-)',
    netBalance: 'صافي الرصيد المتبقي',
    lastTxDate: 'آخر حركة',
    daysSinceLastTx: 'أيام التأخير',
    agingBucket: 'فئة التعمير',
    viewStatement: 'كشف حساب',
    collectPayment: 'تحصيل دفعة',
    paySupplier: 'سداد دفعة',
  },
  parties: {
    title: 'دليل العملاء والموردين والسائقين',
    subtitle: 'إدارة بيانات المتعاملين والأرصدة الافتتاحية وأرقام التواصل',
    addParty: 'إضافة جهة تعامل جديدة',
    code: 'كود الجهة',
    name: 'الاسم الكامل',
    type: 'النوع (عميل / مورد / سائق)',
    phone: 'رقم الهاتف / واتساب',
    cityOrCountry: 'المدينة / الدولة',
    openingBalance: 'الرصيد الافتتاحي',
    openingBalanceDate: 'تاريخ الرصيد الافتتاحي',
    creditLimit: 'الحد الائتماني',
  },
  items: {
    title: 'دليل الأصناف والمنتجات',
    subtitle: 'تعريف أصناف العود ودهن العود والعطور والمواد الخام والعبوات وأرصدة أول المدة',
    addItem: 'إضافة صنف جديد',
    code: 'كود الصنف',
    name: 'اسم الصنف',
    category: 'التصنيف',
    unit: 'وحدة القياس',
    role: 'دور الصنف في النظام',
    defaultSalePrice: 'سعر البيع الافتراضي',
    openingQty: 'كمية أول المدة',
    openingUnitCost: 'تكلفة وحدة أول المدة',
    reorderPoint: 'حد التنبيه للنواقص',
  },
  partners: {
    title: 'حسابات الشركاء والأصول الثابتة',
    subtitle: 'إدارة رؤوس أموال الشركاء، المسحوبات الشخصية، توزيع الأرباح، وسجل الأصول الثابتة للمحل',
    partnersTab: 'الشركاء وتوزيع الأرباح',
    fixedAssetsTab: 'سجل الأصول الثابتة',
    partnerName: 'اسم الشريك',
    capitalSharePercent: 'نسبة الشراكة (%)',
    capitalContributed: 'رأس المال المدفوع',
    withdrawals: 'المسحوبات الشخصية',
    profitShare: 'نصيب الشريك من صافي الربح',
    netPartnerBalance: 'صافي حساب الشريك الجاري',
    assetName: 'اسم الأصل الثابت',
    purchaseDate: 'تاريخ الشراء',
    purchaseCost: 'تكلفة الشراء',
    usefulLifeYears: 'العمر الافتراضي (سنوات)',
    currentBookValue: 'القيمة الدفترية الحالية',
  },
  setup: {
    title: 'معالج التأسيس والتهيئة الأولية',
    subtitle: 'خطوات متسلسلة لضبط إعدادات المحل، وأرصدة أول المدة للصندوق والمخزون والديون',
    stepStoreInfo: '1. بيانات المؤسسة والعملة',
    stepCategoriesUnits: '2. التصنيفات والوحدات',
    stepOpeningCash: '3. رصيد الصندوق الافتتاحي',
    stepOpeningInventory: '4. أرصدة المخزون الافتتاحية',
    stepOpeningDebts: '5. أرصدة العملاء والموردين الافتتاحية',
    completeSetupBtn: 'اعتماد التأسيس والبدء بالعمل',
  },
  settings: {
    title: 'إعدادات النظام والنسخ الاحتياطي',
    subtitle: 'تخصيص بيانات المؤسسة، العملة، السنة المالية، وتصدير/استيراد قاعدة البيانات',
    companyName: 'اسم المؤسسة / المحل',
    companySubtitle: 'الوصف الفرعي على الفواتير',
    currencySymbol: 'رمز العملة (ر.س / Rp / $)',
    fiscalYearStart: 'بداية السنة المالية',
    openingCashBalance: 'رصيد الصندوق الافتتاحي',
    defaultCommissionRate: 'نسبة عمولة السائقين الافتراضية (%)',
    backupAndRestore: 'النسخ الاحتياطي وتصدير البيانات',
    downloadExcelBackup: 'تحميل نسخة إكسل شاملة',
  },
  closingModal: {
    title: 'قائمة التحقق من الإقفال اليومي ومطابقة الصندوق',
    subtitle: 'راجع خطوات نهاية اليوم وطابق النقد الفعلي في الدرج مع رصيد النظام المحاسبي',
    checkSalesEntered: 'تم إدخال جميع فواتير المبيعات النقدية والآجلة لليوم',
    checkPurchasesEntered: 'تم تسجيل جميع فواتير المشتريات والتوريدات المستلمة',
    checkCashCounted: 'تم تسجيل كافة سندات المصاريف والتحصيلات النقدية',
    checkSamplesRecorded: 'تم تسجيل المنصرف من العينات والضيافة والتالف',
    checkDriverLogsUpdated: 'تم تسجيل عمولات وهدايا السائقين والمرشدين لليوم',
    systemCashBalance: 'رصيد الصندوق الدفتري في النظام',
    actualCashCounted: 'النقد الفعلي المعدود في الدرج الآن',
    cashDifference: 'الفرق (الفعلي - النظام)',
    cashMatched: 'الصندوق مطابق تماماً (0 فرق)',
    cashShortage: 'عجز في الصندوق!',
    cashSurplus: 'زيادة في الصندوق!',
    confirmDailyClose: 'تأكيد المراجعة والإقفال اليومي',
  },
  print: {
    taxInvoiceTitle: 'فاتورة مبيعات / Sales Invoice',
    statementOfAccountTitle: 'كشف حساب تفصيلي / Statement of Account',
    invoiceNumber: 'رقم الفاتورة:',
    date: 'التاريخ:',
    customerName: 'السيد / العميل:',
    phone: 'الهاتف:',
    itemDescription: 'الصنف / البيان',
    unit: 'الوحدة',
    qty: 'الكمية',
    unitPrice: 'سعر الوحدة',
    total: 'الإجمالي',
    subtotal: 'المجموع الفرعي:',
    discount: 'الخصم:',
    netAmount: 'الصافي المطلوب:',
    paid: 'المبلغ المدفوع:',
    remainingBalance: 'المتبقي (آجل):',
    thankYouMessage: 'شكراً لتعاملكم مع مؤسسة سدرة العود — نسعد بخدمتكم دائماً',
    signatureSeller: 'توقيع البائع / المحاسب',
    signatureReceiver: 'توقيع المستلم / العميل',
    printNow: 'طباعة الآن (Print)',
    switchPrintLang: 'لغة الفاتورة المطبوعة:',
  },
};
```

---

## 4. الملف الثالث: `src/i18n/dictionaries/id.ts` (القاموس الإندونيسي الكامل — Bahasa Indonesia)

```typescript
// src/i18n/dictionaries/id.ts
import { Dictionary } from '../types';

export const id: Dictionary = {
  meta: {
    localeName: 'Bahasa Indonesia',
    dir: 'ltr',
    brandTitle: 'Sidrat Al-Oud',
    brandSubtitle: 'Sistem ERP Keuangan & Inventaris Gaharu & Parfum',
  },
  common: {
    save: 'Simpan',
    saving: 'Menyimpan...',
    cancel: 'Batal',
    delete: 'Hapus',
    edit: 'Ubah',
    add: 'Tambah',
    search: 'Cari...',
    filter: 'Filter',
    all: 'Semua',
    loading: 'Memuat data...',
    noData: 'Belum ada data tercatat',
    actions: 'Aksi',
    notes: 'Catatan',
    date: 'Tanggal',
    amount: 'Jumlah',
    total: 'Total',
    quantity: 'Kuantitas (Qty)',
    unitPrice: 'Harga Satuan',
    unitCost: 'HPP Satuan',
    discount: 'Diskon',
    tax: 'Pajak',
    netTotal: 'Total Bersih',
    paidAmount: 'Dibayar',
    remainingAmount: 'Sisa (Kredit/Tempo)',
    status: 'Status',
    active: 'Aktif',
    inactive: 'Nonaktif',
    yes: 'Ya',
    no: 'Tidak',
    print: 'Cetak',
    exportExcel: 'Ekspor Excel',
    importExcel: 'Impor Excel',
    close: 'Tutup',
    confirmDelete: 'Apakah Anda yakin ingin menghapus data ini?',
    successSaved: 'Data berhasil disimpan',
    errorOccurred: 'Terjadi kesalahan saat memproses',
    requiredField: 'Kolom ini wajib diisi',
    selectOption: 'Pilih...',
    openingBalanceKey: 'Saldo Awal',
    back: 'Kembali',
    refresh: 'Muat Ulang',
    viewDetails: 'Detail',
  },
  header: {
    periodLabel: 'Periode:',
    fullYear: 'Setahun Penuh',
    allTime: 'Sepanjang Waktu (Kumulatif)',
    monthsGroup: 'Bulan',
    months: [
      'Januari (1)', 'Februari (2)', 'Maret (3)', 'April (4)',
      'Mei (5)', 'Juni (6)', 'Juli (7)', 'Agustus (8)',
      'September (9)', 'Oktober (10)', 'November (11)', 'Desember (12)',
    ],
    setupComplete: 'Status Sistem: Siap Digunakan',
    setupWarningTitle: 'Peringatan Pengaturan Awal (C7):',
    setupWizardBtn: 'Panduan Setup',
    dailyClosingBtn: 'Tutup Kasir Harian',
    languageLabel: 'Bahasa',
  },
  sidebar: {
    groupAnalytics: 'Analitik & Laporan',
    groupDailyOps: 'Operasional Harian',
    groupWarehouse: 'Gudang & Produksi',
    groupMasterData: 'Data Master',
    dashboard: 'Dashboard Utama',
    inventory: 'Stok & Kartu Barang',
    debts: 'Piutang, Utang & Rekening',
    sales: 'Penjualan (Kasir)',
    purchases: 'Pembelian Barang',
    cash: 'Kas & Pembayaran',
    returns: 'Retur Jual & Beli',
    stockIssues: 'Pemakaian Stok & Sampel',
    manufacturing: 'Produksi & Racikan',
    drivers: 'Komisi & Hadiah Supir',
    parties: 'Pelanggan & Supplier',
    items: 'Katalog Produk (Item)',
    partners: 'Mitra & Aset Tetap',
    setup: 'Setup Awal Sistem',
    settings: 'Pengaturan & Backup',
    expandSidebar: 'Perluas Menu',
    collapseSidebar: 'Ciutkan Menu',
    logout: 'Keluar (Logout)',
    logoutConfirm: 'Apakah Anda yakin ingin keluar dari sistem?',
  },
  auth: {
    loginTitle: 'Masuk ke Sistem ERP',
    loginSubtitle: 'Sidrat Al-Oud — Manajemen Keuangan & Stok Gaharu',
    username: 'Nama Pengguna (Username)',
    password: 'Kata Sandi (Password)',
    loginBtn: 'Masuk Sekarang',
    loggingIn: 'Memverifikasi...',
    invalidCredentials: 'Nama pengguna atau kata sandi salah',
  },
  dashboard: {
    title: 'Dashboard Keuangan & Kinerja Toko',
    subtitle: 'Ringkasan penjualan, laba bersih, arus kas, stok, dan piutang pada periode terpilih',
    kpiNetSales: 'Penjualan Bersih',
    kpiGrossProfit: 'Laba Kotor Operasional',
    kpiNetProfit: 'Laba Bersih Akhir',
    kpiCashBalance: 'Saldo Kas Tunai',
    kpiInventoryValue: 'Nilai Total Persediaan',
    kpiCustomerDebts: 'Piutang Pelanggan',
    kpiSupplierDebts: 'Utang ke Supplier',
    kpiExpenses: 'Biaya Operasional',
    chartMonthlySalesProfit: 'Tren Penjualan & Laba Bulanan',
    chartTopItems: 'Produk Terlaris & Paling Menguntungkan',
    chartExpenseBreakdown: 'Rincian Biaya Operasional',
    quickActions: 'Aksi Cepat',
    newSale: 'Buat Faktur Penjualan',
    newPurchase: 'Catat Pembelian Baru',
    newCashEntry: 'Kas Masuk / Kas Keluar',
    lowStockAlerts: 'Peringatan Stok Menipis',
    overdueDebtsAlerts: 'Piutang Jatuh Tempo',
  },
  sales: {
    title: 'Manajemen Penjualan & Faktur',
    subtitle: 'Catat penjualan tunai maupun kredit/tempo dengan perhitungan HPP dan laba otomatis',
    newInvoice: 'Faktur Penjualan Baru',
    invoiceNo: 'No. Faktur',
    customer: 'Pelanggan',
    selectCustomer: 'Pilih Pelanggan...',
    invoiceDate: 'Tanggal Faktur',
    item: 'Produk / Barang',
    selectItem: 'Pilih Produk...',
    availableStock: 'Stok Tersedia',
    avgCost: 'HPP Rata-rata',
    qty: 'Qty',
    sellingPrice: 'Harga Jual',
    lineDiscount: 'Diskon Item',
    lineTotal: 'Subtotal Item',
    lineProfit: 'Estimasi Laba',
    addItemLine: 'Tambah Baris Produk',
    subtotal: 'Subtotal Barang',
    invoiceDiscount: 'Diskon Tambahan Faktur',
    otherCharges: 'Biaya Kirim / Lainnya',
    grandTotal: 'Total Akhir Faktur',
    amountPaidNow: 'Dibayar Tunai Sekarang',
    remainingOnCustomer: 'Sisa Piutang Pelanggan (Tempo)',
    driverReferral: 'Supir / Pemandu Wisata (Referral)',
    noDriver: 'Tanpa Supir (Pelanggan Langsung)',
    saveInvoice: 'Simpan & Sahkan Faktur',
    printInvoice: 'Cetak Struk / Faktur',
    invoiceHistory: 'Riwayat Faktur Penjualan',
    fullyPaid: 'Lunas (Tunai)',
    partiallyPaid: 'Dibayar Sebagian',
    unpaidCredit: 'Belum Dibayar (Tempo)',
    insufficientStockError: 'Kuantitas melebihi stok yang tersedia di gudang!',
    belowCostWarning: 'Perhatian: Harga jual di bawah harga pokok (HPP)!',
  },
  purchases: {
    title: 'Manajemen Pembelian & Stok Masuk',
    subtitle: 'Catat pembelian barang dari supplier dan perbarui HPP Rata-rata Tertimbang (WAC) otomatis',
    newPurchase: 'Faktur Pembelian Baru',
    invoiceNo: 'No. Faktur Beli',
    supplier: 'Supplier / Pemasok',
    selectSupplier: 'Pilih Supplier...',
    purchaseDate: 'Tanggal Pembelian',
    item: 'Barang yang Dibeli',
    qty: 'Qty Masuk',
    purchaseUnitPrice: 'Harga Beli Satuan',
    lineShipping: 'Biaya Ongkir per Baris',
    lineOtherCost: 'Biaya Bea / Lainnya',
    landedUnitCost: 'HPP Satuan Aktual',
    lineTotalCost: 'Total Biaya Baris',
    amountPaidToSupplier: 'Dibayar ke Supplier Sekarang',
    remainingToSupplier: 'Sisa Utang ke Supplier',
    savePurchase: 'Simpan Faktur Pembelian',
    purchaseHistory: 'Riwayat Pembelian Barang',
  },
  cash: {
    title: 'Buku Kas & Pembayaran',
    subtitle: 'Catat kas masuk, kas keluar, biaya operasional toko, pelunasan piutang pelanggan & pembayaran supplier',
    newTransaction: 'Transaksi Kas Baru',
    txNo: 'No. Bukti Kas',
    txDate: 'Tanggal Transaksi',
    txType: 'Jenis Transaksi Kas',
    directionIn: 'Kas Masuk (Penerimaan +)',
    directionOut: 'Kas Keluar (Pengeluaran -)',
    party: 'Pelanggan / Supplier / Mitra',
    linkedInvoice: 'Faktur Terkait (Opsional)',
    expenseCategory: 'Kategori Biaya',
    description: 'Keterangan / Deskripsi',
    cashIn: 'Kas Masuk (+)',
    cashOut: 'Kas Keluar (-)',
    runningBalance: 'Saldo Berjalan',
    currentCashBalance: 'Saldo Kas Tunai Saat Ini',
    saveTransaction: 'Simpan Bukti Kas',
  },
  returns: {
    title: 'Retur Penjualan & Pembelian',
    subtitle: 'Kelola pengembalian barang dari pelanggan atau retur ke supplier beserta penyesuaian stok & kas/piutang',
    newReturn: 'Catat Retur Baru',
    returnNo: 'No. Retur',
    returnType: 'Jenis Retur',
    salesReturn: 'Retur Penjualan (Dari Pelanggan)',
    purchaseReturn: 'Retur Pembelian (Ke Supplier)',
    originalInvoice: 'Faktur Asal',
    settlementMethod: 'Metode Penyelesaian Keuangan',
    cashRefund: 'Pengembalian Tunai (Kas)',
    deductFromDebt: 'Potong Saldo Piutang / Utang',
    returnQty: 'Qty Retur',
    unitValue: 'Nilai Satuan',
    totalReturnAmount: 'Total Nilai Retur',
    reason: 'Alasan Retur',
    saveReturn: 'Simpan & Sahkan Retur',
  },
  stockIssues: {
    title: 'Pemakaian Stok, Sampel & Barang Rusak',
    subtitle: 'Catat pengeluaran stok non-penjualan (tester parfum/gaharu, jamuan tamu, hadiah supir, atau rusak)',
    newIssue: 'Pengeluaran Stok Baru',
    issueNo: 'No. Pengeluaran',
    issueDate: 'Tanggal Keluar',
    issueType: 'Tujuan Pengeluaran',
    sampleTester: 'Sampel & Tester Toko',
    hospitalityGift: 'Jamuan & Hadiah Tamu VIP',
    damagedLoss: 'Barang Rusak / Susut / Hilang',
    driverGift: 'Hadiah untuk Supir / Pemandu',
    otherIssue: 'Pemakaian Operasional Lainnya',
    costAtIssue: 'HPP Satuan Saat Keluar',
    totalCostIssued: 'Total Nilai HPP Keluar',
    recipientOrDriver: 'Penerima / Nama Supir',
    saveIssue: 'Simpan Pengeluaran Stok',
  },
  manufacturing: {
    title: 'Produksi, Racikan Parfum & Pengemasan',
    subtitle: 'Konversi bahan baku (minyak gaharu, bibit, botol, kotak) menjadi produk jadi siap jual beserta perhitungan HPP',
    newBatch: 'Batch Produksi Baru',
    batchNo: 'No. Batch Produksi',
    batchDate: 'Tanggal Produksi',
    finishedItem: 'Produk Jadi yang Dihasilkan',
    producedQty: 'Kuantitas Hasil Produksi (Masuk Stok)',
    rawMaterialsUsed: 'Bahan Baku & Kemasan yang Dipakai',
    rawMaterial: 'Bahan Baku / Botol / Kemasan',
    consumedQty: 'Qty Terpakai',
    rawUnitCost: 'HPP Satuan Bahan',
    rawTotalCost: 'Total Biaya Bahan',
    additionalPackagingCost: 'Biaya Tenaga Kerja / Kemasan Tambahan',
    totalBatchCost: 'Total Biaya Produksi Batch',
    unitProductionCost: 'HPP Produksi per Unit Jadi',
    addRawLine: 'Tambah Bahan Baku',
    saveBatch: 'Simpan & Sahkan Produksi',
    batchBalanceWarning: 'Pastikan seluruh bahan baku dan botol tercatat agar HPP produk jadi akurat',
  },
  drivers: {
    title: 'Rekomendasi, Komisi & Hadiah Supir / Pemandu',
    subtitle: 'Pantau kunjungan supir & tour guide, omzet penjualan tamu mereka, komisi tunai, dan hadiah barang',
    newDriverLog: 'Catat Kunjungan / Komisi Supir',
    driverName: 'Nama Supir / Tour Guide',
    driverPhone: 'No. HP / WhatsApp',
    visitDate: 'Tanggal Kunjungan',
    touristsCount: 'Jumlah Tamu / Wisatawan',
    linkedSalesInvoice: 'Faktur Penjualan Terkait',
    salesAmountGenerated: 'Total Belanja Tamu',
    commissionRate: 'Persentase Komisi (%)',
    commissionAmount: 'Nilai Komisi',
    commissionPaid: 'Komisi yang Sudah Dibayar',
    giftItemGiven: 'Hadiah Barang (Opsional)',
    giftQty: 'Qty Hadiah',
    giftCost: 'Nilai HPP Hadiah',
    totalDriversSales: 'Total Penjualan dari Supir',
    totalCommissionsAndGifts: 'Total Komisi & Hadiah Supir',
    saveDriverLog: 'Simpan Data Supir',
  },
  inventory: {
    title: 'Stok Gudang & Kartu Stok Barang',
    subtitle: 'Pantau saldo stok aktual, Harga Pokok Rata-rata Tertimbang (WAC), dan riwayat keluar-masuk per item',
    stockSummaryTab: 'Ringkasan Stok Gudang',
    stockCardTab: 'Kartu Stok Detail (Stock Card)',
    itemCode: 'Kode Item',
    itemName: 'Nama Produk / Barang',
    category: 'Kategori',
    role: 'Tipe Barang',
    unit: 'Satuan',
    openingQty: 'Stok Awal',
    purchasedQty: 'Masuk Pembelian (+)',
    manufacturedInQty: 'Hasil Produksi (+)',
    salesReturnQty: 'Retur Jual (+)',
    soldQty: 'Terjual (-)',
    purchaseReturnQty: 'Retur Beli (-)',
    manufacturedOutQty: 'Dipakai Produksi (-)',
    issuedSampleDamagedQty: 'Sampel/Rusak (-)',
    currentStock: 'Stok Akhir Aktual',
    weightedAvgCost: 'HPP Rata-rata (WAC)',
    totalInventoryValue: 'Nilai Total Persediaan',
    reorderLevel: 'Batas Minimum Stok',
    stockStatusOk: 'Tersedia',
    stockStatusLow: 'Stok Menipis',
    stockStatusOut: 'Habis (0)',
    selectItemForCard: 'Pilih produk untuk melihat riwayat Kartu Stok:',
    movementType: 'Jenis Mutasi',
    qtyIn: 'Masuk (+)',
    qtyOut: 'Keluar (-)',
    balanceAfter: 'Saldo Setelah Mutasi',
  },
  debts: {
    title: 'Piutang Pelanggan, Utang Supplier & Umur Piutang',
    subtitle: 'Pantau tagihan pelanggan, kewajiban ke supplier, analisis umur piutang (30/60/90 hari), dan rekening koran',
    customerDebtsTab: 'Piutang Pelanggan (Tagihan Kita)',
    supplierDebtsTab: 'Utang Supplier (Kewajiban Kita)',
    invoiceFollowupTab: 'Pelacakan Pelunasan per Faktur',
    partyCode: 'Kode',
    partyName: 'Nama Pelanggan / Supplier',
    openingBalance: 'Saldo Awal',
    totalInvoices: 'Total Faktur Kredit',
    totalReturns: 'Total Retur (-)',
    totalPayments: 'Total Pembayaran (-)',
    netBalance: 'Sisa Saldo Bersih',
    lastTxDate: 'Transaksi Terakhir',
    daysSinceLastTx: 'Hari Menunggak',
    agingBucket: 'Kategori Umur',
    viewStatement: 'Rekening Koran',
    collectPayment: 'Terima Pembayaran',
    paySupplier: 'Bayar Supplier',
  },
  parties: {
    title: 'Database Pelanggan, Supplier & Supir',
    subtitle: 'Kelola data kontak pelanggan, pemasok, pemandu wisata, beserta saldo awal mereka',
    addParty: 'Tambah Kontak Baru',
    code: 'Kode Kontak',
    name: 'Nama Lengkap',
    type: 'Tipe (Pelanggan / Supplier / Supir)',
    phone: 'No. Telepon / WhatsApp',
    cityOrCountry: 'Kota / Negara',
    openingBalance: 'Saldo Awal Piutang/Utang',
    openingBalanceDate: 'Tanggal Saldo Awal',
    creditLimit: 'Batas Kredit Maksimal',
  },
  items: {
    title: 'Katalog Produk & Bahan Baku',
    subtitle: 'Kelola master produk gaharu, minyak oud, parfum, botol kemasan, harga jual, dan stok awal',
    addItem: 'Tambah Produk Baru',
    code: 'Kode Produk',
    name: 'Nama Produk',
    category: 'Kategori',
    unit: 'Satuan Ukur',
    role: 'Peran Barang dalam Sistem',
    defaultSalePrice: 'Harga Jual Standar',
    openingQty: 'Kuantitas Stok Awal',
    openingUnitCost: 'HPP Satuan Stok Awal',
    reorderPoint: 'Batas Peringatan Stok Minimum',
  },
  partners: {
    title: 'Rekening Mitra (Partner) & Aset Tetap',
    subtitle: 'Kelola modal mitra, penarikan pribadi (prive), pembagian laba bersih, dan daftar aset tetap toko',
    partnersTab: 'Mitra & Bagi Hasil',
    fixedAssetsTab: 'Daftar Aset Tetap',
    partnerName: 'Nama Mitra',
    capitalSharePercent: 'Porsi Kepemilikan (%)',
    capitalContributed: 'Modal Disetor',
    withdrawals: 'Penarikan Pribadi (Prive)',
    profitShare: 'Bagian Laba Bersih',
    netPartnerBalance: 'Saldo Akhir Rekening Mitra',
    assetName: 'Nama Aset Tetap',
    purchaseDate: 'Tanggal Perolehan',
    purchaseCost: 'Harga Perolehan',
    usefulLifeYears: 'Masa Manfaat (Tahun)',
    currentBookValue: 'Nilai Buku Saat Ini',
  },
  setup: {
    title: 'Panduan Pengaturan Awal Sistem (Setup Wizard)',
    subtitle: 'Langkah mudah untuk mengatur profil toko, saldo kas awal, stok awal gudang, dan saldo piutang/utang',
    stepStoreInfo: '1. Profil Toko & Mata Uang',
    stepCategoriesUnits: '2. Kategori & Satuan Ukur',
    stepOpeningCash: '3. Saldo Kas Awal',
    stepOpeningInventory: '4. Saldo Stok Awal Barang',
    stepOpeningDebts: '5. Saldo Awal Piutang & Utang',
    completeSetupBtn: 'Selesaikan Setup & Mulai Operasional',
  },
  settings: {
    title: 'Pengaturan Sistem & Cadangan Data (Backup)',
    subtitle: 'Sesuaikan identitas toko, mata uang, tahun buku, serta ekspor/impor database Excel',
    companyName: 'Nama Perusahaan / Toko',
    companySubtitle: 'Subjudul pada Faktur Cetak',
    currencySymbol: 'Simbol Mata Uang (Rp / ر.س / $)',
    fiscalYearStart: 'Awal Tahun Buku',
    openingCashBalance: 'Saldo Kas Awal',
    defaultCommissionRate: 'Komisi Standar Supir (%)',
    backupAndRestore: 'Cadangan & Ekspor Database',
    downloadExcelBackup: 'Unduh Backup Excel Lengkap',
  },
  closingModal: {
    title: 'Daftar Periksa Tutup Kasir Harian (Daily Closing)',
    subtitle: 'Periksa kelengkapan transaksi hari ini dan cocokkan uang tunai fisik di laci kasir dengan saldo sistem',
    checkSalesEntered: 'Semua faktur penjualan tunai & kredit hari ini sudah diinput',
    checkPurchasesEntered: 'Semua faktur pembelian barang masuk hari ini sudah dicatat',
    checkCashCounted: 'Semua bukti pengeluaran biaya & pelunasan piutang sudah diinput',
    checkSamplesRecorded: 'Pemakaian tester, sampel, jamuan, atau barang rusak sudah dicatat',
    checkDriverLogsUpdated: 'Komisi dan hadiah supir/tour guide hari ini sudah dicatat',
    systemCashBalance: 'Saldo Kas Menurut Sistem',
    actualCashCounted: 'Uang Tunai Fisik di Laci Kasir',
    cashDifference: 'Selisih Kas (Fisik - Sistem)',
    cashMatched: 'Saldo Kas Cocok Sempurna (Selisih 0)',
    cashShortage: 'Kurang Bayar / Selisih Kurang!',
    cashSurplus: 'Selisih Lebih di Kasir!',
    confirmDailyClose: 'Konfirmasi & Tutup Kasir Harian',
  },
  print: {
    taxInvoiceTitle: 'FAKTUR PENJUALAN / SALES INVOICE',
    statementOfAccountTitle: 'REKENING KORAN / STATEMENT OF ACCOUNT',
    invoiceNumber: 'No. Faktur:',
    date: 'Tanggal:',
    customerName: 'Pelanggan:',
    phone: 'Telepon:',
    itemDescription: 'Nama Produk / Deskripsi',
    unit: 'Satuan',
    qty: 'Qty',
    unitPrice: 'Harga Satuan',
    total: 'Total',
    subtotal: 'Subtotal:',
    discount: 'Diskon:',
    netAmount: 'Total Tagihan:',
    paid: 'Jumlah Dibayar:',
    remainingBalance: 'Sisa Tagihan (Tempo):',
    thankYouMessage: 'Terima kasih telah berbelanja di Sidrat Al-Oud — Kepuasan Anda adalah kehormatan kami',
    signatureSeller: 'Tanda Tangan Kasir / Penjual',
    signatureReceiver: 'Tanda Tangan Pelanggan / Penerima',
    printNow: 'Cetak Sekarang (Print)',
    switchPrintLang: 'Bahasa Cetak Faktur:',
  },
};
```

---

## 5. الملف الرابع: `src/i18n/dictionaries/en.ts` (القاموس الإنجليزي الكامل — English)

```typescript
// src/i18n/dictionaries/en.ts
import { Dictionary } from '../types';

export const en: Dictionary = {
  meta: {
    localeName: 'English',
    dir: 'ltr',
    brandTitle: 'Sidrat Al-Oud',
    brandSubtitle: 'Integrated Oud & Perfume Financial & Inventory ERP',
  },
  common: {
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search...',
    filter: 'Filter',
    all: 'All',
    loading: 'Loading...',
    noData: 'No records found',
    actions: 'Actions',
    notes: 'Notes',
    date: 'Date',
    amount: 'Amount',
    total: 'Total',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    unitCost: 'Unit Cost',
    discount: 'Discount',
    tax: 'Tax',
    netTotal: 'Net Total',
    paidAmount: 'Paid',
    remainingAmount: 'Remaining (Credit)',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    yes: 'Yes',
    no: 'No',
    print: 'Print',
    exportExcel: 'Export Excel',
    importExcel: 'Import Excel',
    close: 'Close',
    confirmDelete: 'Are you sure you want to delete this record?',
    successSaved: 'Saved successfully',
    errorOccurred: 'An error occurred while processing',
    requiredField: 'This field is required',
    selectOption: 'Select...',
    openingBalanceKey: 'Opening Balance',
    back: 'Back',
    refresh: 'Refresh',
    viewDetails: 'Details',
  },
  header: {
    periodLabel: 'Period:',
    fullYear: 'Full Year',
    allTime: 'All Time (Cumulative)',
    monthsGroup: 'Months of the Year',
    months: [
      'January (1)', 'February (2)', 'March (3)', 'April (4)',
      'May (5)', 'June (6)', 'July (7)', 'August (8)',
      'September (9)', 'October (10)', 'November (11)', 'December (12)',
    ],
    setupComplete: 'Setup Status: Complete & Ready',
    setupWarningTitle: 'Setup Alert (C7):',
    setupWizardBtn: 'Setup Wizard',
    dailyClosingBtn: 'Daily Closing',
    languageLabel: 'Language',
  },
  sidebar: {
    groupAnalytics: 'Analytics & Reports',
    groupDailyOps: 'Daily Operations',
    groupWarehouse: 'Warehouse & Production',
    groupMasterData: 'Master Data',
    dashboard: 'Dashboard',
    inventory: 'Inventory & Stock Card',
    debts: 'Debts & Statements',
    sales: 'Sales & Billing',
    purchases: 'Purchases',
    cash: 'Cash & Payments',
    returns: 'Returns',
    stockIssues: 'Stock Issues & Samples',
    manufacturing: 'Manufacturing & Blending',
    drivers: 'Driver Referrals & Gifts',
    parties: 'Customers & Suppliers',
    items: 'Items Catalog',
    partners: 'Partners & Fixed Assets',
    setup: 'Setup Wizard',
    settings: 'Settings & Backup',
    expandSidebar: 'Expand Sidebar',
    collapseSidebar: 'Collapse Sidebar',
    logout: 'Sign Out',
    logoutConfirm: 'Are you sure you want to sign out?',
  },
  auth: {
    loginTitle: 'Sign In to ERP System',
    loginSubtitle: 'Sidrat Al-Oud — Financial & Inventory Management',
    username: 'Username',
    password: 'Password',
    loginBtn: 'Sign In',
    loggingIn: 'Signing in...',
    invalidCredentials: 'Invalid username or password',
  },
  dashboard: {
    title: 'Executive Financial & Inventory Dashboard',
    subtitle: 'Overview of sales, profitability, cash flow, inventory valuation, and receivables',
    kpiNetSales: 'Net Sales',
    kpiGrossProfit: 'Gross Operating Profit',
    kpiNetProfit: 'Net Profit',
    kpiCashBalance: 'Cash on Hand',
    kpiInventoryValue: 'Total Inventory Value',
    kpiCustomerDebts: 'Accounts Receivable (Customers)',
    kpiSupplierDebts: 'Accounts Payable (Suppliers)',
    kpiExpenses: 'Operating Expenses',
    chartMonthlySalesProfit: 'Monthly Sales & Profit Trend',
    chartTopItems: 'Top Selling & Most Profitable Items',
    chartExpenseBreakdown: 'Operating Expenses Breakdown',
    quickActions: 'Quick Actions',
    newSale: 'New Sales Invoice',
    newPurchase: 'New Purchase Invoice',
    newCashEntry: 'Cash Receipt / Voucher',
    lowStockAlerts: 'Low Stock Alerts',
    overdueDebtsAlerts: 'Overdue Receivables',
  },
  sales: {
    title: 'Sales & Invoicing Management',
    subtitle: 'Record cash and credit sales with automatic COGS and profit calculation',
    newInvoice: 'New Sales Invoice',
    invoiceNo: 'Invoice No.',
    customer: 'Customer',
    selectCustomer: 'Select Customer...',
    invoiceDate: 'Invoice Date',
    item: 'Item / Product',
    selectItem: 'Select Item...',
    availableStock: 'Available Stock',
    avgCost: 'Avg Cost (WAC)',
    qty: 'Qty',
    sellingPrice: 'Selling Price',
    lineDiscount: 'Line Discount',
    lineTotal: 'Line Total',
    lineProfit: 'Line Profit',
    addItemLine: 'Add Another Item',
    subtotal: 'Items Subtotal',
    invoiceDiscount: 'Additional Invoice Discount',
    otherCharges: 'Delivery / Additional Charges',
    grandTotal: 'Net Invoice Total',
    amountPaidNow: 'Amount Paid in Cash Now',
    remainingOnCustomer: 'Remaining Balance (On Credit)',
    driverReferral: 'Driver / Tour Guide Referral',
    noDriver: 'Direct Walk-in (No Driver)',
    saveInvoice: 'Save & Confirm Invoice',
    printInvoice: 'Print Invoice',
    invoiceHistory: 'Sales Invoices History',
    fullyPaid: 'Paid in Full',
    partiallyPaid: 'Partially Paid',
    unpaidCredit: 'Unpaid (On Credit)',
    insufficientStockError: 'Requested quantity exceeds available warehouse stock!',
    belowCostWarning: 'Warning: Selling price is below weighted average cost!',
  },
  purchases: {
    title: 'Purchases & Procurement Management',
    subtitle: 'Record supplier purchase invoices and automatically recalculate Weighted Average Cost (WAC)',
    newPurchase: 'New Purchase Invoice',
    invoiceNo: 'Purchase No.',
    supplier: 'Supplier',
    selectSupplier: 'Select Supplier...',
    purchaseDate: 'Purchase Date',
    item: 'Purchased Item',
    qty: 'Received Qty',
    purchaseUnitPrice: 'Purchase Unit Price',
    lineShipping: 'Allocated Shipping',
    lineOtherCost: 'Customs / Other Costs',
    landedUnitCost: 'Landed Unit Cost',
    lineTotalCost: 'Total Line Cost',
    amountPaidToSupplier: 'Paid to Supplier Now',
    remainingToSupplier: 'Remaining Balance to Supplier',
    savePurchase: 'Save Purchase Invoice',
    purchaseHistory: 'Purchase Invoices History',
  },
  cash: {
    title: 'Cash Box & Financial Vouchers',
    subtitle: 'Record cash receipts, operating expenses, customer debt collections, and supplier payments',
    newTransaction: 'New Cash Transaction',
    txNo: 'Voucher No.',
    txDate: 'Transaction Date',
    txType: 'Transaction Type',
    directionIn: 'Cash In (Receipt +)',
    directionOut: 'Cash Out (Payment -)',
    party: 'Customer / Supplier / Partner',
    linkedInvoice: 'Linked Invoice (Optional)',
    expenseCategory: 'Expense Category',
    description: 'Description / Memo',
    cashIn: 'Cash In (+)',
    cashOut: 'Cash Out (-)',
    runningBalance: 'Running Balance',
    currentCashBalance: 'Current Cash on Hand',
    saveTransaction: 'Save Cash Voucher',
  },
  returns: {
    title: 'Sales & Purchase Returns',
    subtitle: 'Process customer returns and supplier returns with automatic stock and financial adjustments',
    newReturn: 'New Return Entry',
    returnNo: 'Return No.',
    returnType: 'Return Type',
    salesReturn: 'Sales Return (From Customer)',
    purchaseReturn: 'Purchase Return (To Supplier)',
    originalInvoice: 'Original Invoice',
    settlementMethod: 'Financial Settlement Method',
    cashRefund: 'Immediate Cash Refund',
    deductFromDebt: 'Deduct from Account Balance',
    returnQty: 'Returned Qty',
    unitValue: 'Unit Value',
    totalReturnAmount: 'Total Return Value',
    reason: 'Return Reason',
    saveReturn: 'Save & Confirm Return',
  },
  stockIssues: {
    title: 'Stock Issues, Samples & Damaged Goods',
    subtitle: 'Record non-sale inventory withdrawals (testers, VIP hospitality, driver gifts, or damaged stock) at WAC',
    newIssue: 'New Stock Issue',
    issueNo: 'Issue No.',
    issueDate: 'Issue Date',
    issueType: 'Issue Purpose',
    sampleTester: 'Store Samples & Testers',
    hospitalityGift: 'VIP Customer Hospitality',
    damagedLoss: 'Damaged / Shrinkage / Loss',
    driverGift: 'Driver / Tour Guide Gift',
    otherIssue: 'Other Operational Issue',
    costAtIssue: 'Unit Cost at Issue',
    totalCostIssued: 'Total Issued Cost',
    recipientOrDriver: 'Recipient / Driver Name',
    saveIssue: 'Save Stock Issue',
  },
  manufacturing: {
    title: 'Manufacturing, Blending & Bottling',
    subtitle: 'Convert raw materials (oud oil, essential oils, bottles, boxes) into finished products and compute unit cost',
    newBatch: 'New Production Batch',
    batchNo: 'Batch No.',
    batchDate: 'Production Date',
    finishedItem: 'Manufactured Finished Product',
    producedQty: 'Produced Quantity (Stock In)',
    rawMaterialsUsed: 'Consumed Raw Materials & Packaging',
    rawMaterial: 'Raw Material / Bottle / Box',
    consumedQty: 'Consumed Qty',
    rawUnitCost: 'Raw Unit Cost',
    rawTotalCost: 'Total Raw Cost',
    additionalPackagingCost: 'Additional Labor / Packaging Cost',
    totalBatchCost: 'Total Batch Production Cost',
    unitProductionCost: 'Finished Unit Production Cost',
    addRawLine: 'Add Raw Material Component',
    saveBatch: 'Confirm Production Batch',
    batchBalanceWarning: 'Ensure all raw materials and packaging items are listed for accurate unit costing',
  },
  drivers: {
    title: 'Driver & Tour Guide Referrals & Gifts',
    subtitle: 'Track tourist referrals by drivers and guides, generated sales, cash commissions, and in-kind gifts',
    newDriverLog: 'Record Driver Visit / Commission',
    driverName: 'Driver / Tour Guide Name',
    driverPhone: 'Phone / WhatsApp',
    visitDate: 'Visit Date',
    touristsCount: 'Number of Tourists',
    linkedSalesInvoice: 'Linked Sales Invoice',
    salesAmountGenerated: 'Generated Sales Amount',
    commissionRate: 'Commission Rate (%)',
    commissionAmount: 'Commission Amount',
    commissionPaid: 'Commission Paid',
    giftItemGiven: 'In-Kind Gift Item',
    giftQty: 'Gift Qty',
    giftCost: 'Gift Cost',
    totalDriversSales: 'Total Driver-Referred Sales',
    totalCommissionsAndGifts: 'Total Commissions & Gifts',
    saveDriverLog: 'Save Driver Record',
  },
  inventory: {
    title: 'Warehouse Inventory & Stock Card',
    subtitle: 'Monitor real-time stock quantities, Weighted Average Cost (WAC), and detailed item movement history',
    stockSummaryTab: 'Inventory Balances Summary',
    stockCardTab: 'Detailed Item Stock Card',
    itemCode: 'Item Code',
    itemName: 'Item Name',
    category: 'Category',
    role: 'Item Role',
    unit: 'Unit',
    openingQty: 'Opening Qty',
    purchasedQty: 'Purchased (+)',
    manufacturedInQty: 'Manufactured In (+)',
    salesReturnQty: 'Sales Return (+)',
    soldQty: 'Sold (-)',
    purchaseReturnQty: 'Purchase Return (-)',
    manufacturedOutQty: 'Used in Production (-)',
    issuedSampleDamagedQty: 'Samples / Damaged (-)',
    currentStock: 'Current Stock on Hand',
    weightedAvgCost: 'Weighted Avg Cost (WAC)',
    totalInventoryValue: 'Total Inventory Valuation',
    reorderLevel: 'Reorder Point',
    stockStatusOk: 'In Stock',
    stockStatusLow: 'Low Stock',
    stockStatusOut: 'Out of Stock (0)',
    selectItemForCard: 'Select an item to inspect its chronological Stock Card:',
    movementType: 'Movement Type',
    qtyIn: 'In (+)',
    qtyOut: 'Out (-)',
    balanceAfter: 'Balance After',
  },
  debts: {
    title: 'Receivables, Payables, Aging & Statements',
    subtitle: 'Track customer debts, supplier balances, aging buckets (30/60/90 days), and invoice-level settlements',
    customerDebtsTab: 'Customer Receivables (They Owe Us)',
    supplierDebtsTab: 'Supplier Payables (We Owe Them)',
    invoiceFollowupTab: 'Invoice-Level Payment Tracking',
    partyCode: 'Code',
    partyName: 'Customer / Supplier Name',
    openingBalance: 'Opening Balance',
    totalInvoices: 'Total Credit Invoices',
    totalReturns: 'Total Returns (-)',
    totalPayments: 'Total Payments (-)',
    netBalance: 'Net Outstanding Balance',
    lastTxDate: 'Last Activity',
    daysSinceLastTx: 'Days Overdue',
    agingBucket: 'Aging Bucket',
    viewStatement: 'Statement',
    collectPayment: 'Collect Payment',
    paySupplier: 'Pay Supplier',
  },
  parties: {
    title: 'Customers, Suppliers & Drivers Directory',
    subtitle: 'Manage contact details, party roles, and opening balances',
    addParty: 'Add New Party',
    code: 'Party Code',
    name: 'Full Name',
    type: 'Type (Customer / Supplier / Driver)',
    phone: 'Phone / WhatsApp',
    cityOrCountry: 'City / Country',
    openingBalance: 'Opening Balance',
    openingBalanceDate: 'Opening Balance Date',
    creditLimit: 'Credit Limit',
  },
  items: {
    title: 'Items & Products Master Catalog',
    subtitle: 'Define natural oud, oud oil, perfumes, raw materials, packaging, and opening stock balances',
    addItem: 'Add New Item',
    code: 'Item Code',
    name: 'Item Name',
    category: 'Category',
    unit: 'Unit of Measure',
    role: 'Item Role in System',
    defaultSalePrice: 'Default Selling Price',
    openingQty: 'Opening Quantity',
    openingUnitCost: 'Opening Unit Cost',
    reorderPoint: 'Minimum Stock Alert Level',
  },
  partners: {
    title: 'Partners Equity & Fixed Assets',
    subtitle: 'Manage partner capital shares, personal withdrawals, profit distribution, and store fixed assets',
    partnersTab: 'Partners & Profit Sharing',
    fixedAssetsTab: 'Fixed Assets Register',
    partnerName: 'Partner Name',
    capitalSharePercent: 'Equity Share (%)',
    capitalContributed: 'Contributed Capital',
    withdrawals: 'Personal Withdrawals',
    profitShare: 'Net Profit Share',
    netPartnerBalance: 'Net Partner Current Balance',
    assetName: 'Fixed Asset Name',
    purchaseDate: 'Acquisition Date',
    purchaseCost: 'Acquisition Cost',
    usefulLifeYears: 'Useful Life (Years)',
    currentBookValue: 'Current Book Value',
  },
  setup: {
    title: 'Initial System Setup Wizard',
    subtitle: 'Step-by-step configuration for store profile, opening cash, opening inventory, and opening balances',
    stepStoreInfo: '1. Store Profile & Currency',
    stepCategoriesUnits: '2. Categories & Units',
    stepOpeningCash: '3. Opening Cash Balance',
    stepOpeningInventory: '4. Opening Inventory Balances',
    stepOpeningDebts: '5. Opening Receivables & Payables',
    completeSetupBtn: 'Complete Setup & Start Operations',
  },
  settings: {
    title: 'System Settings & Database Backup',
    subtitle: 'Configure store identity, currency symbol, fiscal year, and full Excel export/import',
    companyName: 'Company / Store Name',
    companySubtitle: 'Invoice Header Subtitle',
    currencySymbol: 'Currency Symbol (Rp / SAR / $)',
    fiscalYearStart: 'Fiscal Year Start',
    openingCashBalance: 'Opening Cash Balance',
    defaultCommissionRate: 'Default Driver Commission (%)',
    backupAndRestore: 'Database Backup & Export',
    downloadExcelBackup: 'Download Full Excel Workbook',
  },
  closingModal: {
    title: 'Daily Closing Checklist & Cash Reconciliation',
    subtitle: 'Verify end-of-day operational tasks and reconcile physical cash in drawer against system balance',
    checkSalesEntered: 'All cash and credit sales invoices for today have been entered',
    checkPurchasesEntered: 'All received supplier purchase invoices have been recorded',
    checkCashCounted: 'All expense vouchers and debt collections have been recorded',
    checkSamplesRecorded: 'All testers, hospitality samples, and damaged items have been logged',
    checkDriverLogsUpdated: 'All driver referrals, commissions, and gifts for today are recorded',
    systemCashBalance: 'System Book Cash Balance',
    actualCashCounted: 'Actual Physical Cash Counted',
    cashDifference: 'Cash Variance (Physical - System)',
    cashMatched: 'Cash Drawer Perfectly Balanced (0 Variance)',
    cashShortage: 'Cash Shortage Detected!',
    cashSurplus: 'Cash Surplus Detected!',
    confirmDailyClose: 'Confirm Review & Complete Daily Close',
  },
  print: {
    taxInvoiceTitle: 'SALES INVOICE',
    statementOfAccountTitle: 'STATEMENT OF ACCOUNT',
    invoiceNumber: 'Invoice No:',
    date: 'Date:',
    customerName: 'Customer:',
    phone: 'Phone:',
    itemDescription: 'Item Description',
    unit: 'Unit',
    qty: 'Qty',
    unitPrice: 'Unit Price',
    total: 'Total',
    subtotal: 'Subtotal:',
    discount: 'Discount:',
    netAmount: 'Net Total:',
    paid: 'Amount Paid:',
    remainingBalance: 'Balance Due:',
    thankYouMessage: 'Thank you for shopping at Sidrat Al-Oud — We look forward to serving you again',
    signatureSeller: 'Authorized Seller Signature',
    signatureReceiver: 'Customer Signature',
    printNow: 'Print Now',
    switchPrintLang: 'Print Invoice Language:',
  },
};
```

---

## 6. الملف الخامس: `src/i18n/translate-domain.ts` (ترجمة القيم المخزنة والـ Enums)

هذا الملف يترجم تلقائياً التصنيفات الـ 12، الوحدات الـ 12، أنواع الحركات الـ 17، أدوار الأصناف، أنواع الجهات، فترات التعمير، ومفتاح `"افتتاحي"` إلى اللغة المختارة (`ar` | `id` | `en`) دون المساس بقاعدة البيانات:

```typescript
// src/i18n/translate-domain.ts
import { Locale } from './types';

const CATEGORY_MAP: Record<string, { ar: string; id: string; en: string }> = {
  'عود طبيعي': { ar: 'عود طبيعي', id: 'Gaharu Alami (Natural Oud)', en: 'Natural Oud' },
  'عود محسن': { ar: 'عود محسن', id: 'Gaharu Olahan (Enhanced Oud)', en: 'Enhanced Oud' },
  'دهن عود': { ar: 'دهن عود', id: 'Minyak Gaharu (Oud Oil)', en: 'Oud Oil (Dehn Al-Oud)' },
  'مخلطات ملكية': { ar: 'مخلطات ملكية', id: 'Campuran Royal (Royal Blends)', en: 'Royal Blends' },
  'عطور زيتية': { ar: 'عطور زيتية', id: 'Parfum Oil (Bibit Parfum)', en: 'Oil Perfumes' },
  'عطور بخاخ': { ar: 'عطور بخاخ', id: 'Parfum Spray', en: 'Spray Perfumes' },
  'مسك وعنبر': { ar: 'مسك وعنبر', id: 'Musk & Amber', en: 'Musk & Amber' },
  'بخور ومعمول': { ar: 'بخور ومعمول', id: 'Dupa & Bakhoor', en: 'Incense & Bakhoor' },
  'مباخر وإكسسوارات': { ar: 'مباخر وإكسسوارات', id: 'Mabkhara & Aksesoris', en: 'Censers & Accessories' },
  'عبوات وزجاجات': { ar: 'عبوات وزجاجات', id: 'Botol & Kemasan', en: 'Bottles & Packaging' },
  'علب وتغليف هدايا': { ar: 'علب وتغليف هدايا', id: 'Kotak & Kemasan Hadiah', en: 'Gift Boxes & Wrapping' },
  'مواد خام وزيوت أساسية': { ar: 'مواد خام وزيوت أساسية', id: 'Bahan Baku & Minyak Esensial', en: 'Raw Materials & Essential Oils' },
};

const UNIT_MAP: Record<string, { ar: string; id: string; en: string }> = {
  'قطعة': { ar: 'قطعة', id: 'Pcs', en: 'Piece (Pcs)' },
  'جرام': { ar: 'جرام', id: 'Gram (g)', en: 'Gram (g)' },
  'كيلوجرام': { ar: 'كيلوجرام', id: 'Kilogram (kg)', en: 'Kilogram (kg)' },
  'تولة': { ar: 'تولة', id: 'Tola (12ml)', en: 'Tola (12ml)' },
  'نصف تولة': { ar: 'نصف تولة', id: '1/2 Tola (6ml)', en: 'Half Tola (6ml)' },
  'ربع تولة': { ar: 'ربع تولة', id: '1/4 Tola (3ml)', en: 'Quarter Tola (3ml)' },
  'نانو تولة': { ar: 'نانو تولة', id: 'Nano Tola', en: 'Nano Tola' },
  'أوقية': { ar: 'أوقية', id: 'Ounce / Uqiyah (28g)', en: 'Ounce / Uqiyah (28g)' },
  'ثمن كيلو': { ar: 'ثمن كيلو', id: '1/8 Kg (125g)', en: '1/8 Kg (125g)' },
  'ملليلتر': { ar: 'ملليلتر', id: 'Mililiter (ml)', en: 'Milliliter (ml)' },
  'زجاجة': { ar: 'زجاجة', id: 'Botol', en: 'Bottle' },
  'طقم / علبة': { ar: 'طقم / علبة', id: 'Set / Kotak', en: 'Set / Box' },
};

const ITEM_ROLE_MAP: Record<string, { ar: string; id: string; en: string }> = {
  MERCHANDISE: { ar: 'بضاعة جاهزة للبيع', id: 'Barang Dagangan Siap Jual', en: 'Merchandise Ready for Sale' },
  RAW: { ar: 'مادة خام / تغليف', id: 'Bahan Baku / Kemasan', en: 'Raw Material / Packaging' },
  FINISHED: { ar: 'منتج نهائي مصنع', id: 'Produk Jadi (Hasil Produksi)', en: 'Manufactured Finished Product' },
  'بضاعة جاهزة للبيع': { ar: 'بضاعة جاهزة للبيع', id: 'Barang Dagangan Siap Jual', en: 'Merchandise Ready for Sale' },
  'مادة خام': { ar: 'مادة خام / تغليف', id: 'Bahan Baku / Kemasan', en: 'Raw Material / Packaging' },
  'منتج نهائي مصنع': { ar: 'منتج نهائي مصنع', id: 'Produk Jadi (Hasil Produksi)', en: 'Manufactured Finished Product' },
};

const PARTY_TYPE_MAP: Record<string, { ar: string; id: string; en: string }> = {
  CLIENT: { ar: 'عميل', id: 'Pelanggan', en: 'Customer' },
  SUPPLIER: { ar: 'مورد', id: 'Supplier', en: 'Supplier' },
  BOTH: { ar: 'عميل ومورد', id: 'Pelanggan & Supplier', en: 'Customer & Supplier' },
  DRIVER: { ar: 'سائق / مرشد سياحي', id: 'Supir / Tour Guide', en: 'Driver / Tour Guide' },
  PARTNER: { ar: 'شريك', id: 'Mitra (Partner)', en: 'Partner' },
};

const CASH_TYPE_MAP: Record<string, { ar: string; id: string; en: string }> = {
  CUSTOMER_COLLECTION: { ar: 'تحصيل من عميل', id: 'Pelunasan Piutang Pelanggan', en: 'Customer Debt Collection' },
  SUPPLIER_PAYMENT: { ar: 'سداد لمورد', id: 'Pembayaran Utang Supplier', en: 'Supplier Payment' },
  OPERATING_EXPENSE: { ar: 'مصروف تشغيلي', id: 'Biaya Operasional Toko', en: 'Operating Expense' },
  RENT_EXPENSE: { ar: 'إيجار المحل', id: 'Biaya Sewa Toko', en: 'Store Rent Expense' },
  SALARIES_EXPENSE: { ar: 'رواتب وأجور', id: 'Gaji & Upah Karyawan', en: 'Salaries & Wages' },
  UTILITIES_EXPENSE: { ar: 'كهرباء ومياه وإنترنت', id: 'Listrik, Air & Internet', en: 'Utilities & Internet' },
  MARKETING_EXPENSE: { ar: 'تسويق وإعلانات وضيافة', id: 'Pemasaran, Iklan & Jamuan', en: 'Marketing & Hospitality' },
  DRIVER_COMMISSION: { ar: 'عمولة سائق / مرشد', id: 'Komisi Supir / Tour Guide', en: 'Driver / Guide Commission' },
  PARTNER_CONTRIBUTION: { ar: 'إيداع رأس مال شريك', id: 'Setoran Modal Mitra', en: 'Partner Capital Contribution' },
  PARTNER_WITHDRAWAL: { ar: 'مسحوبات شريك شخصية', id: 'Penarikan Pribadi Mitra (Prive)', en: 'Partner Withdrawal' },
  FIXED_ASSET_PURCHASE: { ar: 'شراء أصل ثابت', id: 'Pembelian Aset Tetap', en: 'Fixed Asset Purchase' },
  OTHER_INCOME: { ar: 'إيرادات أخرى', id: 'Pendapatan Lain-lain', en: 'Other Income' },
  OTHER_EXPENSE: { ar: 'مصاريف نثرية أخرى', id: 'Biaya Lain-lain', en: 'Miscellaneous Expense' },
};

const AGING_MAP: Record<string, { ar: string; id: string; en: string }> = {
  'مسدد': { ar: 'مسدد بالكامل', id: 'Lunas', en: 'Settled' },
  '0-30 يوم': { ar: 'حالي (0-30 يوم)', id: 'Lancar (0-30 Hari)', en: 'Current (0-30 Days)' },
  '31-60 يوم': { ar: 'متأخر (31-60 يوم)', id: 'Menunggak (31-60 Hari)', en: '31-60 Days Overdue' },
  '61-90 يوم': { ar: 'متأخر جداً (61-90 يوم)', id: 'Tunggakan Lama (61-90 Hari)', en: '61-90 Days Overdue' },
  '+90 يوم': { ar: 'ديون متعثرة (+90 يوم)', id: 'Macet (+90 Hari)', en: '90+ Days Overdue' },
};

export function tCategory(name: string | null | undefined, locale: Locale): string {
  if (!name) return '';
  return CATEGORY_MAP[name]?.[locale] ?? name;
}

export function tUnit(name: string | null | undefined, locale: Locale): string {
  if (!name) return '';
  return UNIT_MAP[name]?.[locale] ?? name;
}

export function tItemRole(role: string | null | undefined, locale: Locale): string {
  if (!role) return '';
  return ITEM_ROLE_MAP[role]?.[locale] ?? role;
}

export function tPartyType(type: string | null | undefined, locale: Locale): string {
  if (!type) return '';
  return PARTY_TYPE_MAP[type]?.[locale] ?? type;
}

export function tCashType(type: string | null | undefined, locale: Locale): string {
  if (!type) return '';
  return CASH_TYPE_MAP[type]?.[locale] ?? type;
}

export function tAging(bucket: string | null | undefined, locale: Locale): string {
  if (!bucket) return '';
  return AGING_MAP[bucket]?.[locale] ?? bucket;
}

export function tInvoiceKey(key: string | null | undefined, locale: Locale): string {
  if (!key) return '';
  if (key === 'افتتاحي') {
    return locale === 'ar' ? 'افتتاحي' : locale === 'id' ? 'Saldo Awal' : 'Opening Balance';
  }
  return key;
}
```

---

## 7. الملف السادس: `src/i18n/LanguageContext.tsx` (مزود اللغة والاتجاه التفاعلي)

```tsx
// src/i18n/LanguageContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Locale, Dictionary } from './types';
import { ar } from './dictionaries/ar';
import { id } from './dictionaries/id';
import { en } from './dictionaries/en';
import {
  tCategory,
  tUnit,
  tItemRole,
  tPartyType,
  tCashType,
  tAging,
  tInvoiceKey,
} from './translate-domain';

const DICTIONARIES: Record<Locale, Dictionary> = { ar, id, en };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  tCategory: (name: string | null | undefined) => string;
  tUnit: (name: string | null | undefined) => string;
  tItemRole: (role: string | null | undefined) => string;
  tPartyType: (type: string | null | undefined) => string;
  tCashType: (type: string | null | undefined) => string;
  tAging: (bucket: string | null | undefined) => string;
  tInvoiceKey: (key: string | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale = 'ar',
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const saved = localStorage.getItem('oud_locale') as Locale | null;
    if (saved && (saved === 'ar' || saved === 'id' || saved === 'en')) {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    localStorage.setItem('oud_locale', locale);
    document.cookie = `oud_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }, [locale]);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[locale] || ar;
    const dir = dict.meta.dir;
    return {
      locale,
      setLocale,
      t: dict,
      dir,
      isRtl: dir === 'rtl',
      tCategory: (name) => tCategory(name, locale),
      tUnit: (name) => tUnit(name, locale),
      tItemRole: (role) => tItemRole(role, locale),
      tPartyType: (type) => tPartyType(type, locale),
      tCashType: (type) => tCashType(type, locale),
      tAging: (bucket) => tAging(bucket, locale),
      tInvoiceKey: (key) => tInvoiceKey(key, locale),
    };
  }, [locale]);

  return (
    <I18nContext.Provider value={value}>
      <div dir={value.dir} className="min-h-screen">
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within a LanguageProvider');
  }
  return ctx;
}
```

---

## 8. الملف السابع: `src/components/layout/LanguageSwitcher.tsx` (مبدل اللغة الأنيق)

```tsx
// src/components/layout/LanguageSwitcher.tsx
'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { Locale } from '@/i18n/types';

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-[#E6DDD3] bg-white p-1 text-xs shadow-2xs"
      role="group"
      aria-label="Language Switcher"
    >
      {!compact && (
        <span className="flex items-center gap-1 px-1.5 text-[#6E1E24]">
          <Globe className="h-3.5 w-3.5" />
        </span>
      )}
      {LANGUAGES.map((lang) => {
        const active = locale === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLocale(lang.code)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-all ${
              active
                ? 'bg-[#6E1E24] text-white shadow-2xs'
                : 'text-[#5C4A42] hover:bg-[#F5EFEA] hover:text-[#241112]'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```
