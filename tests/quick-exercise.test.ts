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
import { computeCostingEngine } from '../src/domain/costing-engine';

describe('Quick Exercise (Slides 52-53) Test (tests/quick-exercise.test.ts)', () => {
  const systemSetting: SystemSettingDomain = {
    startYear: 2026,
    openingCash: new Decimal('1000000'),
    openingBank: zero(),
    openingReviewed: true,
    approveOpeningAssets: false,
    openingLoans: zero(),
    openingRetainedEarnings: zero(),
    allowNegativeStock: false,
  };

  const items: ItemDomain[] = [
    {
      id: 'ITEM-01',
      code: 'P001',
      name: 'عود طبيعي',
      role: 'MERCHANDISE',
      openingQty: zero(),
      openingValue: zero(),
    },
  ];

  const parties: PartyDomain[] = [
    {
      id: 'PARTY-C01',
      code: 'C001',
      name: 'عميل تجربة',
      type: 'CLIENT',
      openingBalance: zero(),
    },
    {
      id: 'PARTY-S01',
      code: 'SUP001',
      name: 'مورد تجربة',
      type: 'SUPPLIER',
      openingBalance: zero(),
    },
  ];

  const purchases: PurchaseLineDomain[] = [
    // Purchase 50g * 10,000 = 500,000 on credit
    {
      id: 'PL-01',
      code: 'P000001',
      invoiceId: 'INV-P-1',
      invoiceKey: '2026 | P-1',
      invoiceNo: 'P-1',
      invoiceDate: '2026-05-01',
      supplierId: 'PARTY-S01',
      itemId: 'ITEM-01',
      qty: new Decimal('50'),
      unitCost: new Decimal('10000'),
      landedCost: zero(),
      discount: zero(),
      lineTotalCost: new Decimal('500000'),
      status: 'POSTED',
    },
  ];

  const sales: SaleLineDomain[] = [
    // Sale 20g * 25,000 = 500,000 on credit
    {
      id: 'SL-01',
      code: 'S000001',
      invoiceId: 'INV-S-1',
      invoiceKey: '2026 | S-1',
      invoiceNo: 'S-1',
      invoiceDate: '2026-05-02',
      customerId: 'PARTY-C01',
      lineType: 'SALE',
      itemId: 'ITEM-01',
      qty: new Decimal('20'),
      unitPrice: new Decimal('25000'),
      discount: zero(),
      netSaleAmount: new Decimal('500000'),
      driverGiftSettlementValue: zero(),
      status: 'POSTED',
    },
  ];

  const cashTransactions: CashTransactionDomain[] = [
    // Collection of 300,000 into Cash from Customer
    {
      id: 'TX-01',
      code: 'C000001',
      txDate: '2026-05-03',
      type: 'CUSTOMER_COLLECTION',
      account: 'CASH',
      amount: new Decimal('300000'),
      partyId: 'PARTY-C01',
      invoiceKey: '2026 | S-1',
      status: 'POSTED',
    },
    // Payment of 200,000 from Cash to Supplier
    {
      id: 'TX-02',
      code: 'C000002',
      txDate: '2026-05-04',
      type: 'SUPPLIER_PAYMENT',
      account: 'CASH',
      amount: new Decimal('200000'),
      partyId: 'PARTY-S01',
      invoiceKey: '2026 | P-1',
      status: 'POSTED',
    },
  ];

  it('Verifies Quick Exercise final figures', () => {
    // 1. Costing
    const costing = computeCostingEngine({
      startYear: 2026,
      items,
      purchases,
      sales,
      returns: [],
      stockIssues: [],
      batches: [],
      targetMaxMonthIndex: 5,
    });

    const m5State = costing.getItemEndingState('ITEM-01', 5);
    expect(m5State.EQ.toNumber()).toBe(30);
    expect(m5State.AVG.toNumber()).toBe(10000);
    expect(m5State.EV.toNumber()).toBe(300000);

    // 2. Balances
    const balances = computeBalancesEngine({
      asOfDate: '2026-05-31',
      parties,
      purchases,
      sales,
      returns: [],
      cashTransactions,
      systemSetting,
    });

    // Cash = 1,000,000 + 300,000 - 200,000 = 1,100,000
    expect(balances.cashBalance.toNumber()).toBe(1100000);

    // Customer Debt = 500,000 - 300,000 = 200,000
    const clientSummary = balances.partySummaries.find((p) => p.partyId === 'PARTY-C01')!;
    expect(clientSummary.partyDebtAsOf.toNumber()).toBe(200000);
    expect(clientSummary.partyCreditAsOf.toNumber()).toBe(0);

    // Supplier Debt = 500,000 - 200,000 = 300,000
    const supplierSummary = balances.partySummaries.find((p) => p.partyId === 'PARTY-S01')!;
    expect(supplierSummary.partyDebtAsOf.toNumber()).toBe(300000);
    expect(supplierSummary.partyCreditAsOf.toNumber()).toBe(0);

    // 3. Reports / Income Statement
    const report = computeReportsEngine({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
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

    expect(report.cards.netSales.toNumber()).toBe(500000);
    expect(report.cards.netCOGS.toNumber()).toBe(200000); // 20g * 10,000 = 200,000
    expect(report.cards.grossProfit.toNumber()).toBe(300000);
    expect(report.cards.operatingProfit.toNumber()).toBe(300000);
    expect(report.cards.inventoryValue.toNumber()).toBe(300000);
  });
});
