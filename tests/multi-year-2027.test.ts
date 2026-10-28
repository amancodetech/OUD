import { computeComponentCosting } from '../src/services/component-costing';
import { describe, it, expect } from 'vitest';
import { Decimal, zero } from '../src/domain/decimal';
import {
  ItemDomain,
  PartyDomain,
  PurchaseLineDomain,
  SaleLineDomain,
  CashTransactionDomain,
  SystemSettingDomain,
} from '../src/domain/types';
import { computeReportsEngine } from '../src/domain/reports-engine';
import { computeBalancesEngine } from '../src/domain/balances-engine';
import { computeCostingEngine as originalCostingEngine, CostingEngineInput } from '../src/domain/costing-engine';
const computeCostingEngine = (input: CostingEngineInput) => {
  const reference=originalCostingEngine(input), partitioned=computeComponentCosting(input);
  for(const item of input.items)for(let month=1;month<=reference.maxMonthIndex;month++)expect(JSON.parse(JSON.stringify(partitioned.getItemEndingState(item.id,month)))).toEqual(JSON.parse(JSON.stringify(reference.getItemEndingState(item.id,month))));
  for(const line of input.sales)expect(partitioned.getSaleLineCOGS(line.id).toString()).toBe(reference.getSaleLineCOGS(line.id).toString());
  for(const line of input.returns)for(const method of ['getReturnSalesCost','getDamagedReturnExpense','getInventoryOutCost','getPurchaseVariance'] as const)expect(partitioned[method](line.id).toString()).toBe(reference[method](line.id).toString());
  for(const issue of input.stockIssues)expect(partitioned.getStockIssueCost(issue.id).toString()).toBe(reference.getStockIssueCost(issue.id).toString());
  return reference;
};

describe('Multi-Year 2027 & Duplicate Invoice Key Test (specs/16-testing-golden-scenario.md)', () => {
  const systemSetting: SystemSettingDomain = {
    startYear: 2026,
    openingCash: new Decimal('1100'),
    openingBank: zero(),
    openingReviewed: true,
    approveOpeningAssets: false,
    openingLoans: zero(),
    openingRetainedEarnings: zero(),
    allowNegativeStock: false,
  };

  const items: ItemDomain[] = [
    {
      id: 'ITEM-OUD',
      code: 'P001',
      name: 'عود طبيعي',
      role: 'MERCHANDISE',
      openingQty: zero(),
      openingValue: zero(),
    },
  ];

  const parties: PartyDomain[] = [
    {
      id: 'CLIENT-01',
      code: 'C001',
      name: 'عميل سنة جديدة',
      type: 'CLIENT',
      openingBalance: zero(),
    },
    {
      id: 'SUPPLIER-01',
      code: 'SUP001',
      name: 'مورد سنة جديدة',
      type: 'SUPPLIER',
      openingBalance: zero(),
    },
  ];

  // 1. December 2026 Transactions
  const purchases: PurchaseLineDomain[] = [
    // 2026-12-10: P-1 from SUP001 (20g * 10 = 200)
    {
      id: 'PL-2026-01',
      code: 'P000001',
      invoiceId: 'INV-P-2026-1',
      invoiceKey: '2026 | P-1',
      invoiceNo: 'P-1',
      invoiceDate: '2026-12-10',
      supplierId: 'SUPPLIER-01',
      itemId: 'ITEM-OUD',
      qty: new Decimal('20'),
      unitCost: new Decimal('10'),
      landedCost: zero(),
      discount: zero(),
      lineTotalCost: new Decimal('200'),
      status: 'POSTED',
    },
  ];

  const sales: SaleLineDomain[] = [
    // 2026-12-15: S-1 to C001 (4g * 20 = 80)
    {
      id: 'SL-2026-01',
      code: 'S000001',
      invoiceId: 'INV-S-2026-1',
      invoiceKey: '2026 | S-1',
      invoiceNo: 'S-1',
      invoiceDate: '2026-12-15',
      customerId: 'CLIENT-01',
      lineType: 'SALE',
      itemId: 'ITEM-OUD',
      qty: new Decimal('4'),
      unitPrice: new Decimal('20'),
      discount: zero(),
      netSaleAmount: new Decimal('80'),
      driverGiftSettlementValue: zero(),
      status: 'POSTED',
    },
  ];

  const cashTransactions: CashTransactionDomain[] = [
    // 2026-12-12: Supplier Payment 120
    {
      id: 'TX-2026-01',
      code: 'C000001',
      txDate: '2026-12-12',
      type: 'SUPPLIER_PAYMENT',
      account: 'CASH',
      amount: new Decimal('120'),
      partyId: 'SUPPLIER-01',
      invoiceKey: '2026 | P-1',
      status: 'POSTED',
    },
    // 2026-12-16: Customer Collection 30 on 2026 | S-1
    {
      id: 'TX-2026-02',
      code: 'C000002',
      txDate: '2026-12-16',
      type: 'CUSTOMER_COLLECTION',
      account: 'CASH',
      amount: new Decimal('30'),
      partyId: 'CLIENT-01',
      invoiceKey: '2026 | S-1',
      status: 'POSTED',
    },
  ];

  it('Verifies seamless carryover to January 2027 before new transactions (Slide 56)', () => {
    // Check balances as of 2027-01-04
    const balances = computeBalancesEngine({
      asOfDate: '2027-01-04',
      parties,
      purchases,
      sales,
      returns: [],
      cashTransactions,
      systemSetting,
    });

    // Cash is 1,100 - 120 + 30 = 1,010
    expect(balances.cashBalance.toNumber()).toBe(1010);

    // Customer Debt is 80 - 30 = 50
    const clientSummary = balances.partySummaries.find((p) => p.partyId === 'CLIENT-01')!;
    expect(clientSummary.partyDebtAsOf.toNumber()).toBe(50);

    // Supplier Debt is 200 - 120 = 80
    const supplierSummary = balances.partySummaries.find((p) => p.partyId === 'SUPPLIER-01')!;
    expect(supplierSummary.partyDebtAsOf.toNumber()).toBe(80);

    // Costing in January 2027 (month index 13)
    const costing = computeCostingEngine({
      startYear: 2026,
      items,
      purchases,
      sales,
      returns: [],
      stockIssues: [],
      batches: [],
      targetMaxMonthIndex: 13,
    });

    const m13 = costing.getItemEndingState('ITEM-OUD', 13);
    // Inventory carried over from Dec 2026: 20 - 4 = 16g, value = 16 * 10 = 160
    expect(m13.EQ.toNumber()).toBe(16);
    expect(m13.AVG.toNumber()).toBe(10);
    expect(m13.EV.toNumber()).toBe(160);

    // Reports for period 2027-01-01 to 2027-01-04
    const reportJan = computeReportsEngine({
      startDate: '2027-01-01',
      endDate: '2027-01-04',
      items,
      parties,
      assets: [],
      categories: [],
      purchases,
      sales,
      returns: [],
      stockIssues: [],
      batches: [],
      cashTransactions,
      systemSetting,
      costingResult: costing,
    });

    expect(reportJan.cards.netSales.toNumber()).toBe(0);
    expect(reportJan.cards.operatingProfit.toNumber()).toBe(0);
    expect(reportJan.cards.inventoryValue.toNumber()).toBe(160);
    expect(reportJan.cards.cashBalance.toNumber()).toBe(1010);
  });

  it('Verifies duplicate invoice number S-1 in 2027 and targeted collection of 2026 | S-1 (Slides 57-58)', () => {
    // Add new 2027 transactions:
    // 1. New sale on 2027-01-05: S-1 (2027 | S-1) for 60
    const allSales: SaleLineDomain[] = [
      ...sales,
      {
        id: 'SL-2027-01',
        code: 'S000002',
        invoiceId: 'INV-S-2027-1',
        invoiceKey: '2027 | S-1',
        invoiceNo: 'S-1',
        invoiceDate: '2027-01-05',
        customerId: 'CLIENT-01',
        lineType: 'SALE',
        itemId: 'ITEM-OUD',
        qty: new Decimal('2'),
        unitPrice: new Decimal('30'),
        discount: zero(),
        netSaleAmount: new Decimal('60'),
        driverGiftSettlementValue: zero(),
        status: 'POSTED',
      },
    ];

    // 2. Collection of 50 on 2027-01-10 tied specifically to old invoice "2026 | S-1"
    const allCash: CashTransactionDomain[] = [
      ...cashTransactions,
      {
        id: 'TX-2027-01',
        code: 'C000003',
        txDate: '2027-01-10',
        type: 'CUSTOMER_COLLECTION',
        account: 'CASH',
        amount: new Decimal('50'),
        partyId: 'CLIENT-01',
        invoiceKey: '2026 | S-1',
        status: 'POSTED',
      },
    ];

    // Compute balances as of 2027-01-15
    const balances = computeBalancesEngine({
      asOfDate: '2027-01-15',
      parties,
      purchases,
      sales: allSales,
      returns: [],
      cashTransactions: allCash,
      systemSetting,
    });

    // Check old invoice 2026 | S-1
    const oldInvoice = balances.invoiceItems.find(
      (it) => it.partyId === 'CLIENT-01' && it.invoiceKey === '2026 | S-1'
    )!;
    expect(oldInvoice).toBeDefined();
    expect(oldInvoice.originalAsOf.toNumber()).toBe(80);
    expect(oldInvoice.settlementAsOf.toNumber()).toBe(80); // 30 (Dec) + 50 (Jan)
    expect(oldInvoice.signedAsOf.toNumber()).toBe(0);
    expect(oldInvoice.invoiceDebt.toNumber()).toBe(0);
    expect(oldInvoice.aging).toBe('مسدد');

    // Check new invoice 2027 | S-1
    const newInvoice = balances.invoiceItems.find(
      (it) => it.partyId === 'CLIENT-01' && it.invoiceKey === '2027 | S-1'
    )!;
    expect(newInvoice).toBeDefined();
    expect(newInvoice.originalAsOf.toNumber()).toBe(60);
    expect(newInvoice.settlementAsOf.toNumber()).toBe(0);
    expect(newInvoice.signedAsOf.toNumber()).toBe(60);
    expect(newInvoice.invoiceDebt.toNumber()).toBe(60);

    // Cash balance is now 1,010 + 50 = 1,060
    expect(balances.cashBalance.toNumber()).toBe(1060);

    // Reports for January 2027 (2027-01-01 to 2027-01-31)
    const reportJan = computeReportsEngine({
      startDate: '2027-01-01',
      endDate: '2027-01-31',
      items,
      parties,
      assets: [],
      categories: [],
      purchases,
      sales: allSales,
      returns: [],
      stockIssues: [],
      batches: [],
      cashTransactions: allCash,
      systemSetting,
    });

    // Net sales in January = 60 (the new sale only, collection of old debt does NOT increase sales)
    expect(reportJan.cards.netSales.toNumber()).toBe(60);
    expect(reportJan.cards.clientDebtTotal.toNumber()).toBe(60);
    expect(reportJan.cards.cashBalance.toNumber()).toBe(1060);
  });
});
