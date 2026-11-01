import { expect, it } from 'vitest';
import { queryKeys, prefetchQueryKeys } from '@/lib/query-keys';
import { resolveReportPeriod } from '@/domain/report-period';
const today = '2026-10-30';
const period = resolveReportPeriod(new URLSearchParams(), today, 2026);
it('warms exact default page URLs including empty sales filters and current-month reports', () => {
  const keys = prefetchQueryKeys({ role: 'ADMIN', permissions: [], today, period });
  expect(keys).toEqual(expect.arrayContaining([
    '/api/sales?page=1&pageSize=100&search=&customerId=',
    '/api/cash', '/api/cash?summary=true', '/api/purchases', '/api/drivers/summary',
    '/api/parties', '/api/parties?lookup=true',
    '/api/parties?type=CLIENT&lookup=true', '/api/parties?type=SUPPLIER&lookup=true', '/api/parties?type=DRIVER&lookup=true',
    '/api/reports/dashboard?startDate=2026-10-01&endDate=2026-10-30',
    '/api/inventory?asOfDate=2026-10-30', '/api/debts?asOfDate=2026-10-30',
  ]));
  expect(keys.some(key => key.includes('pageSize=50') || key === '/api/cash?page=1' || key === '/api/purchases?page=1' || key.startsWith('/api/drivers/summary?'))).toBe(false);
  expect(new Set(keys).size).toBe(keys.length);
});
it('warms only the permitted page and lookups for a limited cashier', () => {
  expect(prefetchQueryKeys({ role: 'CASHIER', permissions: ['cash_customer'], today, period })).toEqual(['/api/cash', '/api/parties?lookup=true']);
  expect(prefetchQueryKeys({ role: 'ACCOUNTANT', permissions: [], today, period })).toEqual([]);
  expect(prefetchQueryKeys({ role: 'CASHIER', permissions: ['sales_manage'], today, period })).toEqual(['/api/sales?page=1&pageSize=100&search=&customerId=', '/api/parties?type=CLIENT&lookup=true']);
});
it('uses the selected report range and excludes invalid ranges', () => {
  const selected = resolveReportPeriod(new URLSearchParams('range=custom&startDate=2026-03-02&endDate=2026-04-04'), today, 2026);
  expect(prefetchQueryKeys({ role: 'CASHIER', permissions: ['dashboard_view'], today, period: selected })).toEqual(['/api/reports/dashboard?startDate=2026-03-02&endDate=2026-04-04']);
  expect(prefetchQueryKeys({ role: 'ADMIN', permissions: [], today, period: { ...selected, error: 'invalid_range' } }).some(key => key.startsWith('/api/reports/dashboard'))).toBe(false);
});
it('keeps full filter identity, selected pages, and special characters distinct', () => {
  expect(queryKeys.sales({ page: 2, search: 'oud & amber', customerId: 'client+1' })).toBe('/api/sales?page=2&pageSize=100&search=oud+%26+amber&customerId=client%2B1');
  expect(queryKeys.inventory(today, 'category&1', 'LOW')).toBe('/api/inventory?asOfDate=2026-10-30&categoryId=category%261&status=LOW');
  expect(queryKeys.debts(today, 'CLIENT', 'DEBT')).toBe('/api/debts?asOfDate=2026-10-30&type=CLIENT&status=DEBT');
  expect(queryKeys.parties).not.toBe(queryKeys.partiesLookup());
});
