import { describe, expect, it } from 'vitest';
import { presetReportPeriod, resolveReportPeriod, reportPeriodQuery, validReportRange } from '../../src/domain/report-period';
import { computeReportsEngine, type ReportsEngineInput } from '../../src/domain/reports-engine';
import { Decimal, zero } from '../../src/domain/decimal';
import type { SaleLineDomain } from '../../src/domain/types';
const today = '2026-10-27';
const resolve = (query = '') => resolveReportPeriod(new URLSearchParams(query), today, 2026);

describe('report date range contract', () => {
  it('defaults the selector and report to this month through the store day', () => {
    expect(resolve()).toEqual({ preset: 'this_month', startDate: '2026-10-01', endDate: today, error: undefined });
  });
  it.each([
    ['today', today, today], ['yesterday', '2026-10-26', '2026-10-26'],
    ['last_7_days', '2026-10-21', today], ['last_30_days', '2026-09-28', today],
    ['last_month', '2026-09-01', '2026-09-30'], ['this_quarter', '2026-10-01', today],
    ['this_year', '2026-01-01', today], ['all_time', '2026-01-01', today],
  ])('resolves %s inclusively', (preset, startDate, endDate) => {
    expect(resolve('range=' + preset)).toMatchObject({ startDate, endDate, error: undefined });
  });
  it('handles leap years and crossing a calendar year', () => {
    expect(presetReportPeriod('last_month', '2028-03-15', 2026)).toMatchObject({ startDate: '2028-02-01', endDate: '2028-02-29' });
    expect(presetReportPeriod('last_month', '2027-01-03', 2026)).toMatchObject({ startDate: '2026-12-01', endDate: '2026-12-31' });
  });
  it('uses the installation start year and clips rolling presets to it', () => {
    expect(presetReportPeriod('all_time', today, 2024).startDate).toBe('2024-01-01');
    expect(presetReportPeriod('last_7_days', '2027-01-03', 2027).startDate).toBe('2027-01-01');
    expect(presetReportPeriod('last_month', '2027-01-03', 2027).error).toBeTruthy();
  });
  it.each([
    ['2026-02-30', today, 'invalid_range'], [today, '2026-10-01', 'invalid_range'],
    ['', today, 'invalid_range'], ['2025-12-31', today, 'before_start'],
  ])('rejects invalid or out-of-installation ranges (%s, %s)', (start, end, error) => {
    expect(validReportRange(start, end, 2026)).toBe(error);
  });
  it('allows a single day and custom ranges spanning years', () => {
    expect(validReportRange(today, today, 2026)).toBeUndefined();
    expect(resolve('range=custom&startDate=2026-12-20&endDate=2027-01-10')).toMatchObject({ preset: 'custom', startDate: '2026-12-20', endDate: '2027-01-10', error: undefined });
  });
  it('retains the meaning of bookmarked legacy month/year URLs', () => {
    expect(resolve('year=2028&period=2')).toMatchObject({ preset: 'custom', startDate: '2028-02-01', endDate: '2028-02-29' });
    expect(resolve('year=2027&period=FULL_YEAR')).toMatchObject({ startDate: '2027-01-01', endDate: '2027-12-31' });
  });
  it('replaces legacy parameters while retaining unrelated filters and supports URL round trips', () => {
    const range = resolve('range=custom&startDate=2026-10-03&endDate=2026-10-21');
    const query = reportPeriodQuery(new URLSearchParams('year=2028&period=2&search=keep'), range);
    expect(new URLSearchParams(query).get('search')).toBe('keep');
    expect(new URLSearchParams(query).has('year')).toBe(false);
    expect(resolve(query)).toEqual(range);
    expect(reportPeriodQuery(new URLSearchParams(query), resolve('range=today'))).not.toContain('startDate');
  });
});

function sale(id: string, invoiceDate: string, qty: number): SaleLineDomain {
  return { id, code: id, invoiceId: id, invoiceKey: id, invoiceNo: id, invoiceDate, customerId: 'client', lineType: 'SALE', itemId: 'stock', qty: new Decimal(qty), unitPrice: new Decimal(100), discount: zero(), netSaleAmount: new Decimal(qty * 100), driverGiftSettlementValue: zero(), status: 'POSTED' };
}
const base: ReportsEngineInput = {
  comparisonScope: 'period', startDate: '2026-10-05', endDate: '2026-10-20',
  items: [{ id: 'stock', code: 'P001', name: 'Stock', role: 'MERCHANDISE', categoryId: 'cat', openingQty: new Decimal(100), openingValue: new Decimal(1000) }],
  parties: [{ id: 'client', code: 'C001', name: 'Customer', type: 'CLIENT', openingBalance: zero() }],
  assets: [], categories: [{ id: 'cat', name: 'Category', prefix: 'CAT' }], purchases: [],
  sales: [sale('early', '2026-10-01', 1), sale('inside', '2026-10-10', 2), sale('later', '2026-10-30', 3)],
  returns: [], stockIssues: [], batches: [], cashTransactions: [],
  systemSetting: { startYear: 2026, openingCash: zero(), openingBank: zero(), openingReviewed: true, approveOpeningAssets: true, openingLoans: zero(), openingRetainedEarnings: zero(), allowNegativeStock: false },
};
describe('dashboard charts share the applied financial period', () => {
  it('clips partial-month flows, preserves as-of balances, and excludes later inventory movements', () => {
    const report = computeReportsEngine(base);
    expect(report.monthlyComparison).toHaveLength(1);
    expect(report.monthlyComparison[0].netSales.toNumber()).toBe(200);
    expect(report.monthlyComparison[0].netSales.eq(report.cards.netSales)).toBe(true);
    expect(report.monthlyComparison[0].endingInventoryValue.toNumber()).toBe(970);
    expect(report.cards.inventoryValue.toNumber()).toBe(970);
    expect(report.cards.clientDebtTotal.toNumber()).toBe(300);
    expect(report.categorySales[0].netSales.toNumber()).toBe(200);
  });
  it('includes both years and keeps the sum of displayed months equal to period cards', () => {
    const report = computeReportsEngine({ ...base, startDate: '2026-12-15', endDate: '2027-01-15', sales: [sale('before', '2026-12-01', 1), sale('dec', '2026-12-20', 2), sale('jan', '2027-01-10', 3), sale('after', '2027-01-20', 4)] });
    expect(report.monthlyComparison.map(row => [row.year, row.month])).toEqual([[2026, 12], [2027, 1]]);
    expect(report.monthlyComparison.reduce((total, row) => total.plus(row.netSales), zero()).eq(report.cards.netSales)).toBe(true);
    expect(report.cards.netSales.toNumber()).toBe(500);
    expect(report.monthlyComparison[1].endingInventoryValue.eq(report.cards.inventoryValue)).toBe(true);
  });
});
