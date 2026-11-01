import { assertWorkbookExpansion } from '@/lib/xlsx-limits';
import * as xlsx from 'xlsx';
import crypto from 'node:crypto';

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

export function readValidatedWorkbook(buffer: Buffer) {
  if (buffer.length > 10 * 1024 * 1024 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('يلزم ملف XLSX صالح لا يتجاوز 10MB');
  assertWorkbookExpansion(buffer);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  for (const name of ['الرئيسية والتقارير', 'الإعدادات والتهيئة', 'سياسة الهدايا', 'الشركاء', ...Object.keys(headers)]) {
    if (!workbook.Sheets[name]) throw new Error(`ورقة مطلوبة مفقودة: ${name}`);
  }
  for (const [name, expected] of Object.entries(headers)) {
    const rows = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets[name], { header: 1, defval: '' });
    if (rows.length > 20000 || expected.some((value, index) => String(rows[4]?.[index]).trim() !== value)) throw new Error(`بنية أو عناوين غير مطابقة: ${name}`);
  }
  const year = Number(workbook.Sheets['الإعدادات والتهيئة'].B12?.v);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('سنة بداية غير صالحة');
  return workbook;
}

export async function previewExcelWorkbook(buffer: Buffer) {
  const { prisma } = await import('@/lib/db');
  const workbook = readValidatedWorkbook(buffer);
  const current = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  const settings = workbook.Sheets['الإعدادات والتهيئة'];
  const changes = [
    { field: 'openingCash', before: String(current?.openingCash ?? 0), after: String(settings.B8?.v ?? 0) },
    { field: 'openingBank', before: String(current?.openingBank ?? 0), after: String(settings.B9?.v ?? 0) },
    { field: 'startYear', before: String(current?.startYear ?? ''), after: String(settings.B12?.v) },
  ].filter(change => change.before !== change.after);
  const sheets = Object.keys(headers).map(name => ({ name, records: xlsx.utils.sheet_to_json<any[]>(workbook.Sheets[name], { header: 1, defval: '' }).slice(5).filter(row => row[0] !== '' && row[0] != null).length }));
  return { preview: true, fileHash: crypto.createHash('sha256').update(buffer).digest('hex'), changes, sheets };
}
