import { computeComponentCosting } from './component-costing';
import { memoReadSnapshot } from '@/lib/snapshot-cache';
import { reportBalanceSummary } from './report-balance-summary';
import { costingPurchases, costingSales } from './costing-lines';
import type { PurchaseLine, SaleLine } from '@prisma/client';
import { prisma, withReadSnapshot, isReadSnapshot } from '@/lib/db';
import { Decimal, zero, toDecimal } from '@/domain/decimal';
import {
  ItemDomain,
  PartyDomain,
  FixedAssetDomain,
  GiftPolicyDomain,
  PurchaseLineDomain,
  SaleLineDomain,
  ReturnLineDomain,
  StockIssueDomain,
  ProductionBatchDomain,
  CashTransactionDomain,
  DriverReferralDomain,
  SystemSettingDomain,
} from '@/domain/types';
import { computeCostingEngine } from '@/domain/costing-engine';
import { computeBalancesEngine } from '@/domain/balances-engine';
import { computeDriverGiftsEngine } from '@/domain/driver-gifts';
import { computeReportsEngine } from '@/domain/reports-engine';

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export async function loadAllLedgerData(partyIds?: string[], invoiceKeys?: string[], costingOnly = false) {
  return withReadSnapshot(async () => {
  const [
    dbSetting,
    dbItems,
    dbParties,
    dbAssets,
    dbPolicies,
    dbPurchases,
    dbSales,
    dbReturns,
    dbStockIssues,
    dbBatches,
    dbCash,
    dbReferrals,
    dbCategories,
  ] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { id: 1 } }),
    prisma.item.findMany({ include: { category: true, unit: true } }),
    prisma.party.findMany({ where: partyIds ? { id: { in: partyIds } } : undefined }),
    prisma.fixedAsset.findMany(),
    prisma.giftPolicy.findMany({ orderBy: { effectiveDate: 'asc' } }),
    // Join in PostgreSQL instead of emitting an IN parameter for every invoice.
    costingOnly ? costingPurchases() : prisma.$queryRaw<(PurchaseLine & { invoiceKey: string; invoiceNo: string; invoiceDate: Date; dueDate: Date | null; supplierId: string })[]>`
      SELECT l.*, i."invoiceKey", i."invoiceNo", i."invoiceDate", i."dueDate", i."supplierId"
      FROM "PurchaseLine" l JOIN "PurchaseInvoice" i ON i.id = l."invoiceId"
      WHERE l.status = 'POSTED' AND i.status = 'POSTED'
        AND (${partyIds === undefined} OR i."supplierId" = ANY(${partyIds ?? []}::text[]))
        AND (${invoiceKeys === undefined} OR i."invoiceKey" = ANY(${invoiceKeys ?? []}::text[]))`,
    costingOnly ? costingSales() : prisma.$queryRaw<(SaleLine & { invoiceKey: string; invoiceNo: string; invoiceDate: Date; dueDate: Date | null; customerId: string | null })[]>`
      SELECT l.*, i."invoiceKey", i."invoiceNo", i."invoiceDate", i."dueDate", i."customerId"
      FROM "SaleLine" l JOIN "SaleInvoice" i ON i.id = l."invoiceId"
      WHERE l.status = 'POSTED' AND i.status = 'POSTED'
        AND (${partyIds === undefined} OR i."customerId" = ANY(${partyIds ?? []}::text[]))
        AND (${invoiceKeys === undefined} OR i."invoiceKey" = ANY(${invoiceKeys ?? []}::text[]))`,
    prisma.returnLine.findMany({ where: { status: 'POSTED', ...(partyIds ? { partyId: { in: partyIds } } : {}), ...(invoiceKeys ? { invoiceKey: { in: invoiceKeys } } : {}) } }),
    prisma.stockIssue.findMany({ where: { status: 'POSTED' } }),
    prisma.productionBatch.findMany({
      where: { status: 'POSTED' },
      include: { materials: true },
    }),
    prisma.cashTransaction.findMany({ where: { status: 'POSTED', ...(partyIds ? { partyId: { in: partyIds } } : {}), ...(invoiceKeys ? { invoiceKey: { in: invoiceKeys } } : {}) } }),
    prisma.driverReferral.findMany({ where: { status: 'POSTED' } }),
    prisma.itemCategory.findMany(),
  ]);

  const systemSetting: SystemSettingDomain = {
    startYear: dbSetting?.startYear ?? 2026,
    openingCash: toDecimal(dbSetting?.openingCash),
    openingBank: toDecimal(dbSetting?.openingBank),
    openingReviewed: dbSetting?.openingReviewed ?? false,
    approveOpeningAssets: dbSetting?.approveOpeningAssets ?? false,
    openingLoans: toDecimal(dbSetting?.openingLoans),
    openingRetainedEarnings: toDecimal(dbSetting?.openingRetainedEarnings),
    allowNegativeStock: dbSetting?.allowNegativeStock ?? false,
    lockedThroughDate: dbSetting?.lockedThroughDate ? formatDate(dbSetting.lockedThroughDate) : null,
  };

  const items: ItemDomain[] = dbItems.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    role: i.role,
    categoryId: i.categoryId,
    unitId: i.unitId,
    reorderLevel: toDecimal(i.reorderLevel),
    openingQty: toDecimal(i.openingQty),
    openingValue: toDecimal(i.openingValue),
    isActive: i.isActive,
  }));

  const parties: PartyDomain[] = dbParties.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    nameEn: p.nameEn,
    supplierCategory: p.supplierCategory,
    supplierCategoryEn: p.supplierCategoryEn,
    type: p.type,
    openingInvoice: toDecimal(p.openingInvoice ?? 0),
    openingPaid: toDecimal(p.openingPaid ?? 0),
    openingBalance: toDecimal(p.openingBalance),
    profitShareRatio: toDecimal(p.profitShareRatio),
    openingCapital: toDecimal(p.openingCapital),
    carryoverReferrals: p.carryoverReferrals,
    isDriverGiftEnabled: p.isDriverGiftEnabled,
    isActive: p.isActive,
  }));

  const assets: FixedAssetDomain[] = dbAssets.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    acquiredDate: a.acquiredDate ? formatDate(a.acquiredDate) : null,
    submittedValue: toDecimal(a.submittedValue),
    isActive: a.isActive,
  }));

  const policies: GiftPolicyDomain[] = dbPolicies.map((pol) => ({
    id: pol.id,
    effectiveDate: formatDate(pol.effectiveDate),
    customersPerGift: pol.customersPerGift,
    giftValue: toDecimal(pol.giftValue),
  }));

  const purchases: PurchaseLineDomain[] = [];
  for (const l of dbPurchases) {
    const inv = l;
    const invDateStr = formatDate(inv.invoiceDate);
    const dueDateStr = inv.dueDate ? formatDate(inv.dueDate) : null;
      purchases.push({
        id: l.id,
        code: l.code,
        invoiceId: l.invoiceId,
        invoiceKey: inv.invoiceKey,
        invoiceNo: inv.invoiceNo,
        invoiceDate: invDateStr,
        dueDate: dueDateStr,
        supplierId: inv.supplierId,
        itemId: l.itemId,
        qty: toDecimal(l.qty),
        unitCost: toDecimal(l.unitCost),
        landedCost: toDecimal(l.landedCost),
        discount: toDecimal(l.discount),
        lineTotalCost: toDecimal(l.lineTotalCost),
        status: l.status,
      });
  }

  const sales: SaleLineDomain[] = [];
  for (const l of dbSales) {
    const inv = l;
    const invDateStr = formatDate(inv.invoiceDate);
    const dueDateStr = inv.dueDate ? formatDate(inv.dueDate) : null;
      sales.push({
        id: l.id,
        code: l.code,
        invoiceId: l.invoiceId,
        invoiceKey: inv.invoiceKey,
        invoiceNo: inv.invoiceNo,
        invoiceDate: invDateStr,
        dueDate: dueDateStr,
        customerId: inv.customerId,
        lineType: l.lineType,
        itemId: l.itemId,
        qty: toDecimal(l.qty),
        unitPrice: toDecimal(l.unitPrice),
        discount: toDecimal(l.discount),
        netSaleAmount: toDecimal(l.netSaleAmount),
        driverId: l.driverId,
        driverGiftSettlementValue: toDecimal(l.driverGiftSettlementValue),
        status: l.status,
      });
  }

  const returns: ReturnLineDomain[] = dbReturns.map((r) => ({
    id: r.id,
    code: r.code,
    returnDocNo: r.returnDocNo,
    returnDate: formatDate(r.returnDate),
    type: r.type,
    partyId: r.partyId,
    invoiceKey: r.invoiceKey,
    sourceSaleLineId: r.sourceSaleLineId,
    sourcePurchaseLineId: r.sourcePurchaseLineId,
    qty: toDecimal(r.qty),
    saleReturnCondition: r.saleReturnCondition,
    supplierCreditNote: r.supplierCreditNote ? toDecimal(r.supplierCreditNote) : null,
    reason: r.reason,
    status: r.status,
  }));

  const stockIssues: StockIssueDomain[] = dbStockIssues.map((iss) => ({
    id: iss.id,
    code: iss.code,
    issueDate: formatDate(iss.issueDate),
    type: iss.type,
    itemId: iss.itemId,
    qty: toDecimal(iss.qty),
    reason: iss.reason,
    testerRef: iss.testerRef,
    status: iss.status,
  }));

  const batches: ProductionBatchDomain[] = dbBatches.map((b) => ({
    id: b.id,
    code: b.code,
    completionDate: formatDate(b.completionDate),
    finishedItemId: b.finishedItemId,
    producedQty: toDecimal(b.producedQty),
    materials: b.materials.map((m) => ({
      id: m.id,
      batchId: m.batchId,
      rawItemId: m.rawItemId,
      consumedQty: toDecimal(m.consumedQty),
    })),
    status: b.status,
  }));

  const cashTransactions: CashTransactionDomain[] = dbCash.map((c) => ({
    id: c.id,
    code: c.code,
    txDate: formatDate(c.txDate),
    type: c.type,
    account: c.account,
    transferToAccount: c.transferToAccount,
    amount: toDecimal(c.amount),
    partyId: c.partyId,
    invoiceKey: c.invoiceKey,
    assetId: c.assetId,
    description: c.description,
    status: c.status,
  }));

  const referrals: DriverReferralDomain[] = dbReferrals.map((ref) => ({
    id: ref.id,
    code: ref.code,
    visitDate: formatDate(ref.visitDate),
    visitorUniqueKey: ref.visitorUniqueKey,
    visitorName: ref.visitorName,
    driverId: ref.driverId,
    status: ref.status,
  }));

  const categories = dbCategories.map((c) => ({
    id: c.id,
    name: c.name,
    prefix: c.prefix,
  }));

  return {
    systemSetting,
    items,
    parties,
    assets,
    policies,
    purchases,
    sales,
    returns,
    stockIssues,
    batches,
    cashTransactions,
    referrals,
    categories,
  };
  });
}

export type LedgerData = Awaited<ReturnType<typeof loadAllLedgerData>>;

// Internal projections are read-only and never exposed as caller-supplied data.
const ledgerWeight = (data: LedgerData) => Object.values(data).reduce((n,value) => n + (Array.isArray(value) ? value.length : 0), 0) + data.batches.reduce((n,batch) => n + batch.materials.length, 0);
const readCostingData = () => memoReadSnapshot('costing-data', () => loadAllLedgerData(undefined, undefined, true), data => ledgerWeight(data) < 25000);
export async function loadCostingEngine(targetMaxMonthIndex?: number, preloadedData?: LedgerData) {
  const effectiveMonth = preloadedData ? targetMaxMonthIndex : Math.max(12, targetMaxMonthIndex ?? 12);
  const compute = (data: LedgerData) => (isReadSnapshot() && !preloadedData ? computeComponentCosting : computeCostingEngine)({
    startYear: data.systemSetting.startYear, items: data.items, purchases: data.purchases,
    sales: data.sales, returns: data.returns, stockIssues: data.stockIssues,
    batches: data.batches, targetMaxMonthIndex: effectiveMonth,
  });
  if (preloadedData) return compute(preloadedData);
  const frame = await memoReadSnapshot(`costing-frame:${effectiveMonth}`, async () => { const data=await readCostingData();return {result:compute(data),weight:ledgerWeight(data)}; }, value => value.weight + value.result.itemStates.size * value.result.maxMonthIndex <= 50000);
  return frame.result;
}

export async function loadBalancesEngine(asOfDate: string, preloadedData?: LedgerData) {
  const data = preloadedData ?? (await loadAllLedgerData());
  return computeBalancesEngine({
    asOfDate,
    parties: data.parties,
    purchases: data.purchases,
    sales: data.sales,
    returns: data.returns,
    cashTransactions: data.cashTransactions,
    systemSetting: data.systemSetting,
  });
}

export async function loadDriverGiftsEngine(asOfDate: string, preloadedData?: LedgerData) {
  const data = preloadedData ?? (await loadAllLedgerData());
  return computeDriverGiftsEngine({
    asOfDate,
    drivers: data.parties,
    policies: data.policies,
    referrals: data.referrals,
    cashTransactions: data.cashTransactions,
    sales: data.sales,
  });
}

export async function loadReportsEngine(startDate: string, endDate: string, preloadedData?: LedgerData, comparisonScope: 'year' | 'period' = 'year') {
  const data = preloadedData ?? (await loadAllLedgerData());
  return computeReportsEngine({
    startDate,
    endDate,
    comparisonScope,
    items: data.items,
    parties: data.parties,
    assets: data.assets,
    categories: data.categories,
    purchases: data.purchases,
    sales: data.sales,
    returns: data.returns,
    stockIssues: data.stockIssues,
    batches: data.batches,
    cashTransactions: data.cashTransactions,
    systemSetting: data.systemSetting,
  });
}

// Dashboard projections need totals, not an invoice-sized balance response.
// Both projections share one read snapshot; no cross-request financial cache.
export async function loadDashboardReportsEngine(startDate: string, endDate: string) {
  return memoReadSnapshot(`dashboard:${startDate}:${endDate}`, async () => {
    const data = await readCostingData();
    const balanceSummary = await reportBalanceSummary(data, endDate);
    const costingResult = await loadCostingEngine();
    const reports = computeReportsEngine({ ...data, startDate, endDate, comparisonScope: 'period', balanceSummary, costingResult });
    return { cards: reports.cards, monthlyComparison: reports.monthlyComparison, categorySales: reports.categorySales };
  });
}
