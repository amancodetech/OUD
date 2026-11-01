import type { UserRole } from '@prisma/client';
import type { PermissionKey } from './permissions';
import type { ReportPeriod } from '@/domain/report-period';

// Pages and idle prefetches share the entire URL, including empty/default filters.
export const queryKeys = {
  sales: ({ page = 1, search = '', customerId = '' }: { page?: number; search?: string; customerId?: string } = {}) => '/api/sales?' + new URLSearchParams({ page: String(page), pageSize: '100', search, customerId }),
  cash: '/api/cash',
  cashSummary: '/api/cash?summary=true',
  purchases: '/api/purchases',
  drivers: '/api/drivers/summary',
  driverReferrals: '/api/drivers/referrals',
  parties: '/api/parties',
  partiesLookup: (type?: string) => '/api/parties?' + new URLSearchParams(type ? { type, lookup: 'true' } : { lookup: 'true' }),
  items: '/api/items',
  fixedAssets: '/api/fixed-assets',
  dashboard: (startDate: string, endDate: string) => '/api/reports/dashboard?' + new URLSearchParams({ startDate, endDate }),
  inventory: (asOfDate: string, categoryId = 'ALL', status = 'ALL') => {
    const params = new URLSearchParams({ asOfDate });
    if (categoryId !== 'ALL') params.set('categoryId', categoryId);
    if (status !== 'ALL') params.set('status', status);
    return '/api/inventory?' + params;
  },
  debts: (asOfDate: string, type = 'ALL', status = 'ALL') => {
    const params = new URLSearchParams({ asOfDate });
    if (type !== 'ALL') params.set('type', type);
    if (status !== 'ALL') params.set('status', status);
    return '/api/debts?' + params;
  },
};

export function prefetchQueryKeys({ role, permissions, today, period }: { role: UserRole; permissions: readonly PermissionKey[]; today: string; period: ReportPeriod }) {
  const has = (permission: PermissionKey) => role === 'ADMIN' || permissions.includes(permission);
  const keys: string[] = [];
  if (has('inventory_view')) keys.push(queryKeys.inventory(today));
  if (has('debts_view')) keys.push(queryKeys.debts(today));
  if (has('dashboard_view') && !period.error) keys.push(queryKeys.dashboard(period.startDate, period.endDate));
  if (has('sales_manage')) keys.push(queryKeys.sales(), queryKeys.partiesLookup('CLIENT'));
  if (has('cash_customer') || has('cash_full')) keys.push(queryKeys.cash, queryKeys.partiesLookup());
  if (has('cash_full')) keys.push(queryKeys.cashSummary, queryKeys.fixedAssets);
  if (has('purchases_manage')) keys.push(queryKeys.purchases, queryKeys.partiesLookup('SUPPLIER'));
  if (has('drivers_manage')) keys.push(queryKeys.drivers, queryKeys.driverReferrals, queryKeys.partiesLookup('DRIVER'));
  if (has('parties_manage')) keys.push(queryKeys.parties);
  if (has('items_manage')) keys.push(queryKeys.items);
  return [...new Set(keys)];
}
