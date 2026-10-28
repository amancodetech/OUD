import { formatDateString, getDaysInMonth, getMonthStartAndEnd, parseDateParts } from './period';

export const REPORT_PRESETS = ['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'this_quarter', 'this_year', 'all_time', 'custom'] as const;
export type ReportPreset = typeof REPORT_PRESETS[number];
export interface ReportPeriod {
  preset: ReportPreset;
  startDate: string;
  endDate: string;
  error?: 'invalid_range' | 'before_start';
}
type Query = { get(key: string): string | null };
function shiftDay(date: string, amount: number) {
  const { year, month, day } = parseDateParts(date);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}
export function validReportRange(start: string, end: string, startYear: number): ReportPeriod['error'] {
  try {
    if (!/^20\d\d-\d{2}-\d{2}$/.test(start) || !/^20\d\d-\d{2}-\d{2}$/.test(end)) return 'invalid_range';
    parseDateParts(start); parseDateParts(end);
    if (start > end) return 'invalid_range';
    if (start < `${startYear}-01-01`) return 'before_start';
  } catch { return 'invalid_range'; }
}
export function presetReportPeriod(preset: ReportPreset, today: string, startYear: number): ReportPeriod {
  const { year, month } = parseDateParts(today);
  let startDate = today, endDate = today;
  if (preset === 'yesterday') startDate = endDate = shiftDay(today, -1);
  if (preset === 'last_7_days') startDate = shiftDay(today, -6);
  if (preset === 'last_30_days') startDate = shiftDay(today, -29);
  if (preset === 'this_month' || preset === 'custom') startDate = formatDateString(year, month, 1);
  if (preset === 'last_month') {
    const lastMonth = parseDateParts(shiftDay(formatDateString(year, month, 1), -1));
    ({ start: startDate, end: endDate } = getMonthStartAndEnd(lastMonth.year, lastMonth.month));
  }
  if (preset === 'this_quarter') startDate = formatDateString(year, Math.floor((month - 1) / 3) * 3 + 1, 1);
  if (preset === 'this_year') startDate = `${year}-01-01`;
  if (preset === 'all_time') startDate = `${startYear}-01-01`;
  // Rolling presets never include dates before this installation began.
  if (startDate < `${startYear}-01-01`) startDate = `${startYear}-01-01`;
  return { preset, startDate, endDate, error: validReportRange(startDate, endDate, startYear) };
}
export function resolveReportPeriod(query: Query, today: string, startYear: number): ReportPeriod {
  const range = query.get('range');
  if (REPORT_PRESETS.includes(range as ReportPreset)) {
    if (range !== 'custom') return presetReportPeriod(range as ReportPreset, today, startYear);
    const startDate = query.get('startDate') || '', endDate = query.get('endDate') || '';
    return { preset: 'custom', startDate, endDate, error: validReportRange(startDate, endDate, startYear) };
  }
  // Keep bookmarked links from the former year/month selector functional.
  const legacy = query.get('period'), year = query.get('year');
  if (legacy && year && /^20\d\d$/.test(year)) {
    let startDate = `${year}-01-01`, endDate = `${year}-12-31`;
    if (/^(?:[1-9]|1[0-2])$/.test(legacy)) {
      const month = Number(legacy);
      startDate = formatDateString(Number(year), month, 1);
      endDate = formatDateString(Number(year), month, getDaysInMonth(Number(year), month));
    } else if (legacy === 'ALL_TIME' || legacy === 'ALL_INPUT_PERIOD') startDate = `${startYear}-01-01`;
    else if (legacy !== 'FULL_YEAR') return presetReportPeriod('this_month', today, startYear);
    return { preset: 'custom', startDate, endDate, error: validReportRange(startDate, endDate, startYear) };
  }
  return presetReportPeriod('this_month', today, startYear);
}
export function reportPeriodQuery(query: { toString(): string }, period: ReportPeriod): string {
  const next = new URLSearchParams(query.toString());
  for (const key of ['year', 'period', 'range', 'startDate', 'endDate']) next.delete(key);
  next.set('range', period.preset);
  if (period.preset === 'custom') { next.set('startDate', period.startDate); next.set('endDate', period.endDate); }
  return next.toString();
}
