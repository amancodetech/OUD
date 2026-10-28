import type { Locale } from './types';
import type { ReportPreset } from '@/domain/report-period';
interface PeriodCopy {
  presets: Record<ReportPreset, string>;
  title: string; description: string; from: string; to: string; apply: string; cancel: string;
  invalid_range: string; before_start: string; basis: string; chartTitle: string; chartDescription: string;
}
export const reportPeriodCopy: Record<Locale, PeriodCopy> = {
  ar: {
    presets: { today: 'اليوم', yesterday: 'أمس', last_7_days: 'آخر 7 أيام', last_30_days: 'آخر 30 يومًا', this_month: 'هذا الشهر', last_month: 'الشهر الماضي', this_quarter: 'هذا الربع', this_year: 'هذه السنة', all_time: 'منذ بداية النظام', custom: 'فترة مخصصة' },
    title: 'الفترة الزمنية', description: 'اختر فترة سريعة أو حدد تاريخ البداية والنهاية.', from: 'من تاريخ', to: 'إلى تاريخ', apply: 'تطبيق الفترة', cancel: 'إلغاء',
    invalid_range: 'حدد تاريخين صالحين، على أن تكون النهاية بعد البداية أو في اليوم نفسه.', before_start: 'لا يمكن اختيار فترة تسبق سنة بداية النظام.',
    basis: 'المبيعات والمصروفات خلال الفترة · المخزون والنقد والديون حتى نهاية الفترة', chartTitle: 'الأداء الشهري للفترة المحددة', chartDescription: 'حركة الأشهر داخل الفترة فقط، مع احتساب الأشهر الجزئية حتى التاريخ المختار.',
  },
  en: {
    presets: { today: 'Today', yesterday: 'Yesterday', last_7_days: 'Last 7 days', last_30_days: 'Last 30 days', this_month: 'This month', last_month: 'Last month', this_quarter: 'This quarter', this_year: 'This year', all_time: 'Since system start', custom: 'Custom range' },
    title: 'Date range', description: 'Choose a preset or enter a start and end date.', from: 'From', to: 'To', apply: 'Apply range', cancel: 'Cancel',
    invalid_range: 'Enter valid dates with the end on or after the start.', before_start: 'The range cannot precede the system start year.',
    basis: 'Sales and expenses within the range · Inventory, cash and debts as of the end date', chartTitle: 'Monthly performance for the selected range', chartDescription: 'Only activity within the selected range, including partial months.',
  },
  id: {
    presets: { today: 'Hari ini', yesterday: 'Kemarin', last_7_days: '7 hari terakhir', last_30_days: '30 hari terakhir', this_month: 'Bulan ini', last_month: 'Bulan lalu', this_quarter: 'Kuartal ini', this_year: 'Tahun ini', all_time: 'Sejak awal sistem', custom: 'Rentang khusus' },
    title: 'Rentang tanggal', description: 'Pilih periode atau masukkan tanggal awal dan akhir.', from: 'Dari', to: 'Sampai', apply: 'Terapkan', cancel: 'Batal',
    invalid_range: 'Masukkan tanggal yang valid dengan tanggal akhir pada atau setelah tanggal awal.', before_start: 'Rentang tidak boleh sebelum tahun awal sistem.',
    basis: 'Penjualan dan biaya dalam rentang · Stok, kas, dan utang pada tanggal akhir', chartTitle: 'Kinerja bulanan untuk rentang terpilih', chartDescription: 'Hanya aktivitas dalam rentang terpilih, termasuk bulan parsial.',
  },
};
