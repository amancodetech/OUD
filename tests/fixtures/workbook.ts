import * as xlsx from 'xlsx';
// Invented fixtures only. No production workbook is needed in source control or CI.
export function fixtureWorkbook(): Buffer {
  const wb = xlsx.utils.book_new();
  const headers: Record<string, string[]> = {
    'الأصناف': ['المعرف الثابت', 'اسم الصنف', 'الفئة', 'الوحدة'],
    'الأسماء وبيانات الاتصال': ['الكود الثابت', 'الاسم', 'نوع التعامل'],
    'المبيعات': ['التاريخ', 'رقم الفاتورة', 'العميل (اختر الاسم)', 'الصنف (اختر الاسم)'],
    'المشتريات': ['التاريخ', 'رقم الفاتورة', 'المورد (اختر الاسم)', 'الصنف (اختر الاسم)'],
    'المرتجعات': ['تاريخ المرتجع', 'معرف سطر المرتجع', 'رقم مستند المرتجع', 'نوع المرتجع'],
    'الحسابات والمدفوعات': ['تاريخ الحركة', 'رقم حركة فريد', 'نوع الحركة'],
    'الأصول والشركاء': ['معرف ثابت', 'اسم الأصل', 'تاريخ الاقتناء', 'قيمة مقدمة'],
    'صرف المخزون': ['تاريخ الصرف', 'معرف صرف ثابت', 'النوع', 'الصنف'],
  };
  for (const name of ['الرئيسية والتقارير', 'الإعدادات والتهيئة', 'سياسة الهدايا', 'الشركاء', ...Object.keys(headers)]) {
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([[], [], [], [], headers[name] || []]), name);
  }
  const settings = wb.Sheets['الإعدادات والتهيئة'];
  xlsx.utils.sheet_add_aoa(settings, [['روبية (IDR)']], { origin: 'B6' });
  xlsx.utils.sheet_add_aoa(settings, [[0], [0], [false]], { origin: 'B8' });
  xlsx.utils.sheet_add_aoa(settings, [[2026]], { origin: 'B12' });
  const categories = ['عود طبيعي', ...Array.from({ length: 11 }, (_, i) => `تصنيف اختبار ${i + 1}`)];
  xlsx.utils.sheet_add_aoa(settings, categories.map((name, i) => [name, `FX${i}`]), { origin: 'D8' });
  xlsx.utils.sheet_add_aoa(settings, [['جرام']], { origin: 'G8' });
  xlsx.utils.sheet_add_aoa(wb.Sheets['الأسماء وبيانات الاتصال'], [['FX-CUSTOMER', 'عميل افتراضي للاختبار', 'عميل']], { origin: 'A6' });
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
