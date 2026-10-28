import { Locale } from './types';

const CATEGORY_MAP: Record<string, { ar: string; id: string; en: string }> = {
  'عود': { ar: 'عود', id: 'Gaharu (Oud)', en: 'Oud' },
  'عود معطر': { ar: 'عود معطر', id: 'Gaharu Beraroma (Scented Oud)', en: 'Scented Oud' },
  'مسبحة': { ar: 'مسبحة', id: 'Tasbih (Rosary)', en: 'Rosary / Misbaha' },
  'اكسسوارات': { ar: 'اكسسوارات', id: 'Aksesoris (Accessories)', en: 'Accessories' },
  'قهوة': { ar: 'قهوة', id: 'Kopi (Coffee)', en: 'Coffee' },
  'دهون': { ar: 'دهون', id: 'Minyak Atsiri & Gaharu (Oils)', en: 'Oils & Attar' },
  'عطور': { ar: 'عطور', id: 'Parfum (Perfumes)', en: 'Perfumes' },
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
  'غرام': { ar: 'غرام', id: 'Gram (g)', en: 'Gram (g)' },
  'علبة': { ar: 'علبة', id: 'Kotak / Kaleng', en: 'Box / Can' },
  'حبة': { ar: 'حبة', id: 'Pcs (Butir)', en: 'Pcs' },
  'قطعة': { ar: 'قطعة', id: 'Pcs', en: 'Piece (Pcs)' },
  'جرام': { ar: 'جرام', id: 'Gram (g)', en: 'Gram (g)' },
  'قرام': { ar: 'قرام', id: 'Gram (g)', en: 'Gram (g)' },
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
  FUNDER: { ar: 'ممول', id: 'Penyandang Dana', en: 'Funder' },
};

const CASH_TYPE_MAP: Record<string, { ar: string; id: string; en: string }> = {
  CUSTOMER_COLLECTION: { ar: 'تحصيل عميل', id: 'Pelunasan Pelanggan', en: 'Customer Collection' },
  CUSTOMER_REFUND: { ar: 'رد مبلغ لعميل', id: 'Pengembalian Dana Pelanggan', en: 'Customer Refund' },
  SUPPLIER_PAYMENT: { ar: 'سداد مورد', id: 'Pembayaran Supplier', en: 'Supplier Payment' },
  SUPPLIER_REFUND: { ar: 'استرداد من مورد', id: 'Pengembalian Dana Supplier', en: 'Supplier Refund' },
  OPERATING_EXPENSE: { ar: 'مصروف تشغيلي', id: 'Biaya Operasional Toko', en: 'Operating Expense' },
  CASH_EXPENSE: { ar: 'مصروف نقدي', id: 'Pengeluaran Kas', en: 'Cash Expense' },
  RENT_EXPENSE: { ar: 'إيجار المحل', id: 'Biaya Sewa Toko', en: 'Store Rent Expense' },
  SALARIES_EXPENSE: { ar: 'رواتب وأجور', id: 'Gaji & Upah Karyawan', en: 'Salaries & Wages' },
  UTILITIES_EXPENSE: { ar: 'كهرباء ومياه وإنترنت', id: 'Listrik, Air & Internet', en: 'Utilities & Internet' },
  MARKETING_EXPENSE: { ar: 'تسويق وإعلانات وضيافة', id: 'Pemasaran, Iklan & Jamuan', en: 'Marketing & Hospitality' },
  DRIVER_COMMISSION: { ar: 'عمولة سائق / مرشد', id: 'Komisi Supir / Tour Guide', en: 'Driver / Guide Commission' },
  DRIVER_AMOUNT: { ar: 'مبلغ سائق', id: 'Dana Supir', en: 'Driver Amount' },
  DRIVER_CASH_GIFT: { ar: 'هدية نقدية لسائق', id: 'Hadiah Kas Supir', en: 'Driver Cash Gift' },
  EXTERNAL_SALES_PROFIT: { ar: 'ربح مبيعات خارجية', id: 'Keuntungan Penjualan Luar', en: 'External Sales Profit' },
  PARTNER_CONTRIBUTION: { ar: 'مساهمة شريك', id: 'Setoran Modal Mitra', en: 'Partner Contribution' },
  PARTNER_WITHDRAWAL: { ar: 'مسحوبات شريك', id: 'Penarikan Pribadi Mitra', en: 'Partner Withdrawal' },
  PARTNER_DRAWING: { ar: 'مسحوبات شريك', id: 'Penarikan Pribadi Mitra', en: 'Partner Drawing' },
  PROFIT_DISTRIBUTION: { ar: 'توزيع أرباح', id: 'Distribusi Laba', en: 'Profit Distribution' },
  LOAN_RECEIVED: { ar: 'قرض مستلم', id: 'Penerimaan Pinjaman', en: 'Loan Received' },
  LOAN_REPAYMENT: { ar: 'سداد أصل قرض', id: 'Pelunasan Pinjaman', en: 'Loan Repayment' },
  OWNER_BROTHER_FINANCING: { ar: 'تمويل أخ المالك', id: 'Pendanaan Saudara Pemilik', en: "Owner's Brother Financing" },
  OWNER_BROTHER_REPAYMENT: { ar: 'رد تمويل أخ المالك', id: 'Pelunasan Saudara Pemilik', en: "Owner's Brother Repayment" },
  INTERNAL_TRANSFER: { ar: 'تحويل بين الخزينة والبنك', id: 'Transfer Kas & Bank', en: 'Cash & Bank Transfer' },
  FIXED_ASSET_PURCHASE: { ar: 'شراء أصل ثابت', id: 'Pembelian Aset Tetap', en: 'Fixed Asset Purchase' },
  ASSET_PURCHASE: { ar: 'شراء أصل ثابت', id: 'Pembelian Aset Tetap', en: 'Fixed Asset Purchase' },
  OTHER_INCOME: { ar: 'إيرادات أخرى', id: 'Pendapatan Lain-lain', en: 'Other Income' },
  OTHER_EXPENSE: { ar: 'مصاريف نثرية أخرى', id: 'Biaya Lain-lain', en: 'Miscellaneous Expense' },
};

const AGING_MAP: Record<string, { ar: string; id: string; en: string }> = {
  'مسدد': { ar: 'مسدد بالكامل', id: 'Lunas', en: 'Settled' },
  'رصيد دائن': { ar: 'رصيد دائن', id: 'Saldo Kredit', en: 'Credit Balance' },
  'استحقاق غير محدد': { ar: 'استحقاق غير محدد', id: 'Jatuh Tempo Belum Ditentukan', en: 'Due Date Not Set' },
  'غير مستحق': { ar: 'غير مستحق (جاري)', id: 'Belum Jatuh Tempo (Lancar)', en: 'Not Yet Due (Current)' },
  'جاري': { ar: 'جاري', id: 'Lancar', en: 'Current' },
  '1–30': { ar: '1–30 يوم', id: '1–30 Hari', en: '1–30 Days' },
  '31–60': { ar: '31–60 يوم', id: '31–60 Hari', en: '31–60 Days' },
  '61–90': { ar: '61–90 يوم', id: '61–90 Hari', en: '61–90 Days' },
  'أكثر من90': { ar: '+90 يوم', id: '+90 Hari', en: '90+ Days' },
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
    if (locale === 'en') return 'Opening Balance';
    if (locale === 'id') return 'Saldo Awal';
    return 'افتتاحي';
  }
  return key;
}

export function tLocalizedName(
  entity: { name: string; nameEn?: string | null; nameId?: string | null } | null | undefined,
  locale: Locale
): string {
  if (!entity) return '';
  if (locale === 'id' && entity.nameId?.trim()) return entity.nameId.trim();
  if ((locale === 'en' || locale === 'id') && entity.nameEn && entity.nameEn.trim() !== '') {
    return entity.nameEn.trim();
  }
  return entity.name;
}
