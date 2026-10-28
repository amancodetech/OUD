import { Decimal, zero, toDecimal } from './decimal';
import { isDateBetween, isDateOnOrBefore, getMonthIndex, getMonthStartAndEnd, getYearMonthFromIndex } from './period';
import {
  ItemDomain,
  PartyDomain,
  FixedAssetDomain,
  PurchaseLineDomain,
  SaleLineDomain,
  ReturnLineDomain,
  StockIssueDomain,
  ProductionBatchDomain,
  CashTransactionDomain,
  SystemSettingDomain,
  IncomeStatementCards,
  MonthlyComparisonRow,
  CategorySalesRow,
  PartnerEquityItem,
  OpeningEquitySummary,
  CostingResult,
} from './types';
import { computeCostingEngine } from './costing-engine';
import { computeBalancesEngine } from './balances-engine';

export interface ReportsEngineInput {
  comparisonScope?: 'year' | 'period';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  items: ItemDomain[];
  parties: PartyDomain[];
  assets: FixedAssetDomain[];
  categories: { id: string; name: string; prefix: string }[];
  purchases: PurchaseLineDomain[];
  sales: SaleLineDomain[];
  returns: ReturnLineDomain[];
  stockIssues: StockIssueDomain[];
  batches: ProductionBatchDomain[];
  cashTransactions: CashTransactionDomain[];
  systemSetting: SystemSettingDomain;
  costingResult?: CostingResult;
  balanceSummary?: {
    cashBalance: Decimal; bankBalance: Decimal; cashAndBankTotal: Decimal;
    partySummaries: { partyType: string; partyDebtAsOf: Decimal; partyCreditAsOf: Decimal }[];
  };
}

const MONTH_NAMES_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function computeReportsEngine(input: ReportsEngineInput) {
  const {
    startDate,
    endDate,
    items,
    parties,
    assets,
    categories,
    purchases,
    sales,
    returns,
    stockIssues,
    batches,
    cashTransactions,
    systemSetting,
  } = input;

  const startYear = systemSetting.startYear;
  const endMonthIndex = getMonthIndex(endDate, startYear);

  // Compute or reuse Costing Engine
  const costing =
    input.costingResult ??
    computeCostingEngine({
      startYear,
      items,
      purchases,
      sales,
      returns,
      stockIssues,
      batches,
      targetMaxMonthIndex: Math.max(endMonthIndex, 12),
    });

  // Compute Balances Engine as of endDate
  const balances = input.balanceSummary ?? computeBalancesEngine({
    asOfDate: endDate,
    parties,
    purchases,
    sales,
    returns,
    cashTransactions,
    systemSetting,
  });

  const postedPurchases = purchases.filter((p) => p.status === 'POSTED');
  const postedSales = sales.filter((s) => s.status === 'POSTED');
  const postedReturns = returns.filter((r) => r.status === 'POSTED');
  const postedStockIssues = stockIssues.filter((i) => i.status === 'POSTED');
  const postedCash = cashTransactions.filter((c) => c.status === 'POSTED');

  // Lookup map for sale line
  const saleLineMap = new Map<string, SaleLineDomain>();
  for (const s of postedSales) {
    saleLineMap.set(s.id, s);
  }

  // -------------------------------------------------------------
  // Helper: Compute Income Statement Flows for any period [pStart, pEnd]
  // -------------------------------------------------------------
  function computeFlowsForPeriod(pStart: string, pEnd: string) {
    let grossSales = zero();
    let salesCredit = zero();
    let grossCOGS = zero();
    let returnSalesCost = zero();
    let cashOperatingExpenses = zero();
    let stockIssuesCost = zero();
    let damagedReturnExpense = zero();
    let purchaseVariance = zero();
    let externalSalesProfit = zero();

    // Sales in period
    for (const s of postedSales) {
      if (isDateBetween(s.invoiceDate, pStart, pEnd)) {
        if (s.lineType === 'SALE') {
          grossSales = grossSales.plus(s.netSaleAmount);
        }
        // Both SALE and DRIVER_GIFT carry COGS
        const cogs = costing.getSaleLineCOGS(s.id);
        grossCOGS = grossCOGS.plus(cogs);
      }
    }

    // Returns in period
    for (const r of postedReturns) {
      if (isDateBetween(r.returnDate, pStart, pEnd)) {
        if (r.type === 'SALE_RETURN') {
          const srcSale = r.sourceSaleLineId ? saleLineMap.get(r.sourceSaleLineId) : undefined;
          const unitPrice =
            srcSale && !srcSale.qty.isZero() ? srcSale.netSaleAmount.div(srcSale.qty) : zero();
          salesCredit = salesCredit.plus(r.qty.mul(unitPrice));

          const retCost = costing.getReturnSalesCost(r.id);
          returnSalesCost = returnSalesCost.plus(retCost);

          if (r.saleReturnCondition === 'DAMAGED') {
            damagedReturnExpense = damagedReturnExpense.plus(retCost);
          }
        } else if (r.type === 'PURCHASE_RETURN') {
          const variance = costing.getPurchaseVariance(r.id);
          purchaseVariance = purchaseVariance.plus(variance);
        }
      }
    }

    // Cash operating expenses & external sales profit in period
    for (const c of postedCash) {
      if (isDateBetween(c.txDate, pStart, pEnd)) {
        if (
          c.type === 'CASH_EXPENSE' ||
          c.type === 'DRIVER_AMOUNT' ||
          c.type === 'DRIVER_CASH_GIFT'
        ) {
          cashOperatingExpenses = cashOperatingExpenses.plus(c.amount);
        } else if (c.type === 'EXTERNAL_SALES_PROFIT') {
          externalSalesProfit = externalSalesProfit.plus(c.amount);
        }
      }
    }

    // Stock issues in period
    for (const iss of postedStockIssues) {
      if (isDateBetween(iss.issueDate, pStart, pEnd)) {
        const cost = costing.getStockIssueCost(iss.id);
        stockIssuesCost = stockIssuesCost.plus(cost);
      }
    }

    const netSales = grossSales.minus(salesCredit);
    const netCOGS = grossCOGS.minus(returnSalesCost);
    const grossProfit = netSales.minus(netCOGS);
    const inventoryLossesAndIssues = stockIssuesCost.plus(damagedReturnExpense);
    const otherOperatingAdditions = purchaseVariance.plus(externalSalesProfit);
    const operatingProfit = grossProfit
      .minus(cashOperatingExpenses)
      .minus(inventoryLossesAndIssues)
      .plus(otherOperatingAdditions);

    return {
      netSales,
      netCOGS,
      grossProfit,
      cashOperatingExpenses,
      inventoryLossesAndIssues,
      otherOperatingAdditions,
      operatingProfit,
    };
  }

  // Flows for the chosen report period [startDate, endDate]
  const currentPeriodFlows = computeFlowsForPeriod(startDate, endDate);

  // Cumulative operating profit from startYear-01-01 to endDate (cell B35)
  const startOfRecords = `${startYear}-01-01`;
  const cumulativeFlows = computeFlowsForPeriod(startOfRecords, endDate);
  const cumulativeOperatingProfitSinceStart = cumulativeFlows.operatingProfit;

  // -------------------------------------------------------------
  // Inventory Value at endMonthIndex
  // -------------------------------------------------------------
  function inventoryValueAt(targetDate: string): Decimal {
    let inventoryValue = zero();
    const quantities = new Map(items.map(item => [item.id, item.openingQty]));
    const changeQty = (id: string, qty: Decimal) => quantities.set(id, (quantities.get(id) ?? zero()).plus(qty));
    const saleSources = new Map(postedSales.map(sale => [sale.id, sale]));
    const purchaseSources = new Map(postedPurchases.map(purchase => [purchase.id, purchase]));
    for (const purchase of postedPurchases) if (isDateOnOrBefore(purchase.invoiceDate, targetDate)) changeQty(purchase.itemId, purchase.qty);
    for (const sale of postedSales) if (isDateOnOrBefore(sale.invoiceDate, targetDate)) changeQty(sale.itemId, sale.qty.neg());
    for (const issue of postedStockIssues) if (isDateOnOrBefore(issue.issueDate, targetDate)) changeQty(issue.itemId, issue.qty.neg());
    for (const batch of batches) if (batch.status === 'POSTED' && isDateOnOrBefore(batch.completionDate, targetDate)) {
      changeQty(batch.finishedItemId, batch.producedQty);
      for (const material of batch.materials) changeQty(material.rawItemId, material.consumedQty.neg());
    }
    for (const ret of postedReturns) if (isDateOnOrBefore(ret.returnDate, targetDate)) {
      const sale = ret.sourceSaleLineId ? saleSources.get(ret.sourceSaleLineId) : undefined;
      const purchase = ret.sourcePurchaseLineId ? purchaseSources.get(ret.sourcePurchaseLineId) : undefined;
      if (ret.type === 'SALE_RETURN' && ret.saleReturnCondition === 'GOOD' && sale) changeQty(sale.itemId, ret.qty);
      if (ret.type === 'PURCHASE_RETURN' && purchase) changeQty(purchase.itemId, ret.qty.neg());
    }
    for (const it of items) {
      const endState = costing.getItemEndingState(it.id, getMonthIndex(targetDate, startYear));
      inventoryValue = inventoryValue.plus((quantities.get(it.id) ?? zero()).times(endState.AVG));
    }

    return inventoryValue;
  }
  const inventoryValue = inventoryValueAt(endDate);

  // -------------------------------------------------------------
  // Client and Supplier Debt / Credit Totals
  // -------------------------------------------------------------
  let clientDebtTotal = zero();
  let clientCreditTotal = zero();
  let supplierDebtTotal = zero();
  let supplierCreditTotal = zero();

  for (const ps of balances.partySummaries) {
    if (ps.partyType === 'CLIENT') {
      clientDebtTotal = clientDebtTotal.plus(ps.partyDebtAsOf);
      clientCreditTotal = clientCreditTotal.plus(ps.partyCreditAsOf);
    } else if (ps.partyType === 'SUPPLIER') {
      supplierDebtTotal = supplierDebtTotal.plus(ps.partyDebtAsOf);
      supplierCreditTotal = supplierCreditTotal.plus(ps.partyCreditAsOf);
    }
  }

  // -------------------------------------------------------------
  // Opening Equity Equation (Cells K10:L12)
  // -------------------------------------------------------------
  let openingInventoryValue = zero();
  for (const it of items) {
    openingInventoryValue = openingInventoryValue.plus(it.openingValue);
  }

  let openingClientDebt = zero();
  let openingSupplierDebt = zero();
  let openingFunderDebt = zero();
  let allocatedPartnerCapital = zero();

  for (const p of parties) {
    if (p.type === 'CLIENT') {
      openingClientDebt = openingClientDebt.plus(p.openingBalance);
    } else if (p.type === 'SUPPLIER') {
      openingSupplierDebt = openingSupplierDebt.plus(p.openingBalance);
    } else if (p.type === 'FUNDER') {
      openingFunderDebt = openingFunderDebt.plus(p.openingBalance);
    } else if (p.type === 'PARTNER') {
      allocatedPartnerCapital = allocatedPartnerCapital.plus(p.openingCapital ?? zero());
    }
  }

  let approvedOpeningAssets = zero();
  if (systemSetting.approveOpeningAssets) {
    for (const a of assets) {
      approvedOpeningAssets = approvedOpeningAssets.plus(a.submittedValue);
    }
  }

  const openingCashAndBank = systemSetting.openingCash.plus(systemSetting.openingBank);

  const openingEquity = openingCashAndBank
    .plus(openingInventoryValue)
    .plus(openingClientDebt)
    .plus(approvedOpeningAssets)
    .minus(openingSupplierDebt)
    .minus(systemSetting.openingLoans)
    .minus(openingFunderDebt);

  const allocatedPartnerEquity = allocatedPartnerCapital.plus(systemSetting.openingRetainedEarnings);
  const openingEquityDiff = openingEquity.minus(allocatedPartnerEquity);

  const openingEquitySummary: OpeningEquitySummary = {
    openingCash: systemSetting.openingCash,
    openingBank: systemSetting.openingBank,
    openingInventoryValue,
    openingClientDebt,
    approvedOpeningAssets,
    openingSupplierDebt,
    openingLoans: systemSetting.openingLoans,
    openingFunderDebt,
    openingEquity,
    allocatedPartnerCapital,
    openingRetainedEarnings: systemSetting.openingRetainedEarnings,
    allocatedPartnerEquity,
    openingEquityDiff,
  };

  // -------------------------------------------------------------
  // Complete 14 Cards
  // -------------------------------------------------------------
  const cards: IncomeStatementCards = {
    netSales: currentPeriodFlows.netSales,
    netCOGS: currentPeriodFlows.netCOGS,
    grossProfit: currentPeriodFlows.grossProfit,
    cashOperatingExpenses: currentPeriodFlows.cashOperatingExpenses,
    inventoryLossesAndIssues: currentPeriodFlows.inventoryLossesAndIssues,
    otherOperatingAdditions: currentPeriodFlows.otherOperatingAdditions,
    operatingProfit: currentPeriodFlows.operatingProfit,
    inventoryValue,
    cashAndBankTotal: balances.cashAndBankTotal,
    cashBalance: balances.cashBalance,
    bankBalance: balances.bankBalance,
    clientDebtTotal,
    supplierDebtTotal,
    clientCreditTotal,
    supplierCreditTotal,
    openingEquityDiff,
    cumulativeOperatingProfitSinceStart,
  };

  // -------------------------------------------------------------
  // Monthly Comparison Table (12 Months of the report year)
  // -------------------------------------------------------------
  const reportYear = parseInt(endDate.slice(0, 4), 10);
  const monthlyComparison: MonthlyComparisonRow[] = [];

  const firstMonth = input.comparisonScope === 'period' ? getMonthIndex(startDate, startYear) : getMonthIndex(`${reportYear}-01-01`, startYear);
  const lastMonth = input.comparisonScope === 'period' ? endMonthIndex : firstMonth + 11;
  for (let mIndex = firstMonth; mIndex <= lastMonth; mIndex++) {
    const { year, month: m } = getYearMonthFromIndex(mIndex, startYear);
    const { start: mStart, end: mEnd } = getMonthStartAndEnd(year, m);
    const rangeStart = input.comparisonScope === 'period' && startDate > mStart ? startDate : mStart;
    const rangeEnd = input.comparisonScope === 'period' && endDate < mEnd ? endDate : mEnd;
    const flows = computeFlowsForPeriod(rangeStart, rangeEnd);
    let mInventoryVal = zero();
    if (input.comparisonScope === 'period') mInventoryVal = inventoryValueAt(rangeEnd);
    else for (const it of items) mInventoryVal = mInventoryVal.plus(costing.getItemEndingState(it.id, mIndex).EV);

    monthlyComparison.push({
      monthIndex: mIndex,
      year,
      month: m,
      monthName: MONTH_NAMES_AR[m - 1],
      netSales: flows.netSales,
      cogs: flows.netCOGS,
      grossProfit: flows.grossProfit,
      cashExpenses: flows.cashOperatingExpenses,
      operatingProfit: flows.operatingProfit,
      endingInventoryValue: mInventoryVal,
    });
  }

  // -------------------------------------------------------------
  // Category Net Sales
  // -------------------------------------------------------------
  const itemCategoryMap = new Map<string, string>();
  for (const it of items) {
    if (it.categoryId) {
      itemCategoryMap.set(it.id, it.categoryId);
    }
  }

  const categorySalesMap = new Map<string, Decimal>();
  for (const cat of categories) {
    categorySalesMap.set(cat.id, zero());
  }

  for (const s of postedSales) {
    if (s.lineType === 'SALE' && isDateBetween(s.invoiceDate, startDate, endDate)) {
      const catId = itemCategoryMap.get(s.itemId);
      if (catId) {
        const cur = categorySalesMap.get(catId) ?? zero();
        categorySalesMap.set(catId, cur.plus(s.netSaleAmount));
      }
    }
  }

  for (const r of postedReturns) {
    if (r.type === 'SALE_RETURN' && isDateBetween(r.returnDate, startDate, endDate)) {
      const srcSale = r.sourceSaleLineId ? saleLineMap.get(r.sourceSaleLineId) : undefined;
      if (srcSale) {
        const catId = itemCategoryMap.get(srcSale.itemId);
        if (catId) {
          const unitPrice = !srcSale.qty.isZero() ? srcSale.netSaleAmount.div(srcSale.qty) : zero();
          const cur = categorySalesMap.get(catId) ?? zero();
          categorySalesMap.set(catId, cur.minus(r.qty.mul(unitPrice)));
        }
      }
    }
  }

  const categorySales: CategorySalesRow[] = categories.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    categoryPrefix: cat.prefix,
    netSales: categorySalesMap.get(cat.id) ?? zero(),
  }));

  // -------------------------------------------------------------
  // Partners Equity & Capital Accounts
  // -------------------------------------------------------------
  const partnersSummary: PartnerEquityItem[] = [];

  for (const p of parties) {
    if (p.type !== 'PARTNER') continue;

    const openingCapital = p.openingCapital ?? zero();
    let contributions = zero();
    let drawings = zero();
    let profitsReceived = zero();

    for (const c of postedCash) {
      if (c.partyId === p.id && isDateOnOrBefore(c.txDate, endDate)) {
        if (c.type === 'PARTNER_CONTRIBUTION') contributions = contributions.plus(c.amount);
        if (c.type === 'PARTNER_DRAWING') drawings = drawings.plus(c.amount);
        if (c.type === 'PROFIT_DISTRIBUTION') profitsReceived = profitsReceived.plus(c.amount);
      }
    }

    const profitShareRatio = p.profitShareRatio ?? zero();
    const cumulativeProfitShare = cumulativeOperatingProfitSinceStart.mul(profitShareRatio);
    const currentCapital = openingCapital.plus(contributions).minus(drawings);
    const undistributedProfit = cumulativeProfitShare.minus(profitsReceived);

    partnersSummary.push({
      partnerId: p.id,
      partnerCode: p.code,
      partnerName: p.name,
      partnerNameEn: p.nameEn ?? null,
      openingCapital,
      contributions,
      drawings,
      profitsReceived,
      profitShareRatio,
      cumulativeProfitShare,
      currentCapital,
      undistributedProfit,
    });
  }

  return {
    cards,
    monthlyComparison,
    categorySales,
    partnersSummary,
    openingEquitySummary,
    costing,
    balances,
  };
}
