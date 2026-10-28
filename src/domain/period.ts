/**
 * Period and Date Utilities for Pure Accounting Domain
 * Strict calendar date handling (YYYY-MM-DD) avoiding timezone shifts.
 */

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseDateParts(dateStr: string): DateParts {
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date numbers in: ${dateStr}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.slice(0, 10)) || month < 1 || month > 12 || day < 1 ||
      day > getDaysInMonth(year, month)) throw new Error('Invalid calendar date');
  return { year, month, day };
}

export function formatDateString(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Calculates the 1-based sequential month index starting from startYear.
 * January of startYear is month 1.
 * monthIndex = (year - startYear) * 12 + month
 */
export function getMonthIndex(dateStr: string, startYear: number): number {
  const { year, month } = parseDateParts(dateStr);
  return (year - startYear) * 12 + month;
}

/**
 * Converts month index back to year and month.
 */
export function getYearMonthFromIndex(monthIndex: number, startYear: number): { year: number; month: number } {
  const year = startYear + Math.floor((monthIndex - 1) / 12);
  const month = ((monthIndex - 1) % 12) + 1;
  return { year, month };
}

export function isDateOnOrBefore(a: string, b: string): boolean {
  return a.slice(0, 10) <= b.slice(0, 10);
}

export function isDateBefore(a: string, b: string): boolean {
  return a.slice(0, 10) < b.slice(0, 10);
}

export function isDateOnOrAfter(a: string, b: string): boolean {
  return a.slice(0, 10) >= b.slice(0, 10);
}

export function isDateAfter(a: string, b: string): boolean {
  return a.slice(0, 10) > b.slice(0, 10);
}

export function isDateBetween(d: string, start: string, end: string): boolean {
  const dateOnly = d.slice(0, 10);
  return dateOnly >= start.slice(0, 10) && dateOnly <= end.slice(0, 10);
}

/**
 * Calculates diff in whole calendar days: dateA - dateB.
 * Returns positive if dateA > dateB, 0 if equal, negative if dateA < dateB.
 */
export function diffInDays(dateA: string, dateB: string): number {
  const pA = parseDateParts(dateA);
  const pB = parseDateParts(dateB);
  const utcA = Date.UTC(pA.year, pA.month - 1, pA.day);
  const utcB = Date.UTC(pB.year, pB.month - 1, pB.day);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utcA - utcB) / msPerDay);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getMonthStartAndEnd(year: number, month: number): { start: string; end: string } {
  const lastDay = getDaysInMonth(year, month);
  return {
    start: formatDateString(year, month, 1),
    end: formatDateString(year, month, lastDay),
  };
}

export function getYearStartAndEnd(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

export function formatDate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().split('T')[0];
}

export function todayInStore(now = new Date(), timeZone = 'Asia/Makassar'): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (name: string) => parts.find(part => part.type === name)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

