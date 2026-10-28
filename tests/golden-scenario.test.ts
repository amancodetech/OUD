import { computeComponentCosting } from '../src/services/component-costing';
import { describe, it, expect } from 'vitest';
import { Decimal, zero, toDecimal } from '../src/domain/decimal';
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
  DriverReferralDomain,
  CashTransactionDomain,
  SystemSettingDomain,
} from '../src/domain/types';
import { computeReportsEngine } from '../src/domain/reports-engine';
import { computeBalancesEngine } from '../src/domain/balances-engine';
import { computeDriverGiftsEngine } from '../src/domain/driver-gifts';
import { computeCostingEngine as originalCostingEngine, CostingEngineInput } from '../src/domain/costing-engine';
const computeCostingEngine = (input: CostingEngineInput) => {
  const reference=originalCostingEngine(input), partitioned=computeComponentCosting(input);
  for(const item of input.items)for(let month=1;month<=reference.maxMonthIndex;month++)expect(JSON.parse(JSON.stringify(partitioned.getItemEndingState(item.id,month)))).toEqual(JSON.parse(JSON.stringify(reference.getItemEndingState(item.id,month))));
  for(const line of input.sales)expect(partitioned.getSaleLineCOGS(line.id).toString()).toBe(reference.getSaleLineCOGS(line.id).toString());
  for(const line of input.returns)for(const method of ['getReturnSalesCost','getDamagedReturnExpense','getInventoryOutCost','getPurchaseVariance'] as const)expect(partitioned[method](line.id).toString()).toBe(reference[method](line.id).toString());
  for(const issue of input.stockIssues)expect(partitioned.getStockIssueCost(issue.id).toString()).toBe(reference.getStockIssueCost(issue.id).toString());
  return reference;
};

describe('Golden Scenario - October 2026 Comprehensive Test (specs/16-testing-golden-scenario.md)', () => {
  // -------------------------------------------------------------
  // Setup Master Data & Initial State (2026-01-01)
  // -------------------------------------------------------------
  const systemSetting: SystemSettingDomain = {
    startYear: 2026,
    openingCash: new Decimal('5000000'),
    openingBank: new Decimal('20000000'),
    openingReviewed: true,
    approveOpeningAssets: false,
    openingLoans: zero(),
    openingRetainedEarnings: zero(),
    allowNegativeStock: false,
  };

  const categories = [
    { id: 'cat-na', name: 'عود طبيعي', prefix: 'NA' },
    { id: 'cat-rm', name: 'مواد خام وتغليف', prefix: 'RM' },
    { id: 'cat-pf', name: 'عطور بارفان', prefix: 'PF' },
  ];

  const parties: PartyDomain[] = [
    {
      id: 'C001',
      code: 'C001',
      name: 'أحمد السعيدي',
      type: 'CLIENT',
      openingBalance: zero(),
    },
    {
      id: 'C002',
      code: 'C002',
      name: 'سالم باحسن',
      type: 'CLIENT',
      openingBalance: zero(),
    },
    {
      id: 'SUP001',
      code: 'SUP001',
      name: 'مورد نوسانتارا',
      type: 'SUPPLIER',
      openingBalance: zero(),
    },
    {
      id: 'D001',
      code: 'D001',
      name: 'السائق يوسف',
      type: 'DRIVER',
      openingBalance: zero(),
      carryoverReferrals: 0,
      isDriverGiftEnabled: true,
    },
    {
      id: 'PR001',
      code: 'PR001',
      name: 'عمر',
      type: 'PARTNER',
      openingBalance: zero(),
      profitShareRatio: new Decimal('0.60'),
      openingCapital: new Decimal('15900000'),
    },
    {
      id: 'PR002',
      code: 'PR002',
      name: 'خالد',
      type: 'PARTNER',
      openingBalance: zero(),
      profitShareRatio: new Decimal('0.40'),
      openingCapital: new Decimal('10600000'),
    },
    {
      id: 'F001',
      code: 'F001',
      name: 'أخ المالك',
      type: 'FUNDER',
      openingBalance: zero(),
    },
  ];

  const items: ItemDomain[] = [
    {
      id: 'P001',
      code: 'P001',
      name: 'عود طبيعي إندونيسي',
      role: 'MERCHANDISE',
      categoryId: 'cat-na',
      openingQty: new Decimal('100'),
      openingValue: new Decimal('1000000'),
    },
    {
      id: 'P002',
      code: 'P002',
      name: 'مسك خام',
      role: 'RAW',
      categoryId: 'cat-rm',
      openingQty: new Decimal('100'),
      openingValue: new Decimal('500000'),
    },
    {
      id: 'P003',
      code: 'P003',
      name: 'عطر شرقي مركب',
      role: 'FINISHED',
      categoryId: 'cat-pf',
      openingQty: zero(),
      openingValue: zero(),
    },
  ];

  const policies: GiftPolicyDomain[] = [
    {
      id: 'POL001',
      effectiveDate: '2026-10-01',
      customersPerGift: 10,
      giftValue: new Decimal('100000'),
    },
  ];

  const assets: FixedAssetDomain[] = [
    { code: 'FA001', id: 'FA001', name: 'ديكور المحل', submittedValue: new Decimal('87680000') },
    { code: 'FA002', id: 'FA002', name: 'مكيف', submittedValue: new Decimal('5247000') },
    { code: 'FA003', id: 'FA003', name: 'عداد كهرباء المحل', submittedValue: new Decimal('4502000') },
    { code: 'FA004', id: 'FA004', name: 'لوحة الإعلان الخارجية', submittedValue: new Decimal('21000000') },
    { code: 'FA005', id: 'FA005', name: 'الباب الزجاجي', submittedValue: new Decimal('22200000') },
    { code: 'FA006', id: 'FA006', name: 'صوفا 1 وكراسي 2 وطاولة 1', submittedValue: new Decimal('13500000') },
    { code: 'FA007', id: 'FA007', name: 'عداد كهرباء الغرفة', submittedValue: new Decimal('3000000') },
    { code: 'FA008', id: 'FA008', name: 'شبكة إنترنت', submittedValue: new Decimal('280000') },
    { code: 'FA009', id: 'FA009', name: 'لاب توب', submittedValue: new Decimal('6300000') },
    { code: 'FA010', id: 'FA010', name: 'كاميرات', submittedValue: new Decimal('1400000') },
    { code: 'FA011', id: 'FA011', name: 'ميزانا بخور كبيران وميزان صغير', submittedValue: new Decimal('1969000') },
    { code: 'FA012', id: 'FA012', name: 'براد شاي', submittedValue: new Decimal('139000') },
    { code: 'FA013', id: 'FA013', name: 'سريران', submittedValue: new Decimal('3169000') },
    { code: 'FA014', id: 'FA014', name: 'طابعة فواتير', submittedValue: zero() },
  ];

  // -------------------------------------------------------------
  // Transactions in October 2026
  // -------------------------------------------------------------
  const purchases: PurchaseLineDomain[] = [
    // 2026-10-03: P-1001
    {
      id: 'P000001',
      code: 'P000001',
      invoiceId: 'INV-P-1001',
      invoiceKey: '2026 | P-1001',
      invoiceNo: 'P-1001',
      invoiceDate: '2026-10-03',
      dueDate: '2026-10-15',
      supplierId: 'SUP001',
      itemId: 'P001',
      qty: new Decimal('200'),
      unitCost: new Decimal('10000'),
      landedCost: zero(),
      discount: zero(),
      lineTotalCost: new Decimal('2000000'),
      status: 'POSTED',
    },
  ];

  const sales: SaleLineDomain[] = [
    // 2026-10-05: S-1001 (Ahmed)
    {
      id: 'S000001',
      code: 'S000001',
      invoiceId: 'INV-S-1001',
      invoiceKey: '2026 | S-1001',
      invoiceNo: 'S-1001',
      invoiceDate: '2026-10-05',
      dueDate: '2026-10-15',
      customerId: 'C001',
      lineType: 'SALE',
      itemId: 'P001',
      qty: new Decimal('40'),
      unitPrice: new Decimal('25000'),
      discount: zero(),
      netSaleAmount: new Decimal('1000000'),
      driverGiftSettlementValue: zero(),
      status: 'POSTED',
    },
    // 2026-10-09: S-1002 (Salem)
    {
      id: 'S000002',
      code: 'S000002',
      invoiceId: 'INV-S-1002',
      invoiceKey: '2026 | S-1002',
      invoiceNo: 'S-1002',
      invoiceDate: '2026-10-09',
      dueDate: '2026-10-09',
      customerId: 'C002',
      lineType: 'SALE',
      itemId: 'P001',
      qty: new Decimal('20'),
      unitPrice: new Decimal('25000'),
      discount: zero(),
      netSaleAmount: new Decimal('500000'),
      driverGiftSettlementValue: zero(),
      status: 'POSTED',
    },
    // 2026-10-14: S-1003 (Salem - Perfume)
    {
      id: 'S000003',
      code: 'S000003',
      invoiceId: 'INV-S-1003',
      invoiceKey: '2026 | S-1003',
      invoiceNo: 'S-1003',
      invoiceDate: '2026-10-14',
      dueDate: '2026-10-14',
      customerId: 'C002',
      lineType: 'SALE',
      itemId: 'P003',
      qty: new Decimal('2'),
      unitPrice: new Decimal('30000'),
      discount: zero(),
      netSaleAmount: new Decimal('60000'),
      driverGiftSettlementValue: zero(),
      status: 'POSTED',
    },
  ];

  const returns: ReturnLineDomain[] = [
    // 2026-10-07: RT-001 (Sale Return Good - Ahmed)
    {
      id: 'R000001',
      code: 'R000001',
      returnDocNo: 'RT-001',
      returnDate: '2026-10-07',
      type: 'SALE_RETURN',
      partyId: 'C001',
      invoiceKey: '2026 | S-1001',
      sourceSaleLineId: 'S000001',
      qty: new Decimal('10'),
      saleReturnCondition: 'GOOD',
      reason: 'إرجاع فائض',
      status: 'POSTED',
    },
    // 2026-10-10: RT-002 (Sale Return Good - Salem)
    {
      id: 'R000002',
      code: 'R000002',
      returnDocNo: 'RT-002',
      returnDate: '2026-10-10',
      type: 'SALE_RETURN',
      partyId: 'C002',
      invoiceKey: '2026 | S-1002',
      sourceSaleLineId: 'S000002',
      qty: new Decimal('4'),
      saleReturnCondition: 'GOOD',
      reason: 'إرجاع',
      status: 'POSTED',
    },
    // 2026-10-11: RT-003 (Sale Return Damaged - Ahmed)
    {
      id: 'R000003',
      code: 'R000003',
      returnDocNo: 'RT-003',
      returnDate: '2026-10-11',
      type: 'SALE_RETURN',
      partyId: 'C001',
      invoiceKey: '2026 | S-1001',
      sourceSaleLineId: 'S000001',
      qty: new Decimal('2'),
      saleReturnCondition: 'DAMAGED',
      reason: 'تالف',
      status: 'POSTED',
    },
    // 2026-10-16: RT-004 (Purchase Return - Nusantara)
    {
      id: 'R000004',
      code: 'R000004',
      returnDocNo: 'RT-004',
      returnDate: '2026-10-16',
      type: 'PURCHASE_RETURN',
      partyId: 'SUP001',
      invoiceKey: '2026 | P-1001',
      sourcePurchaseLineId: 'P000001',
      qty: new Decimal('20'),
      supplierCreditNote: null,
      reason: 'فائض للمورد',
      status: 'POSTED',
    },
  ];

  const stockIssues: StockIssueDomain[] = [
    // 2026-10-12: Oud issues
    {
      id: 'IS000001',
      code: 'IS000001',
      issueDate: '2026-10-12',
      type: 'TESTER',
      itemId: 'P001',
      qty: new Decimal('3'),
      reason: 'تستر مستهلك',
      status: 'POSTED',
    },
    {
      id: 'IS000002',
      code: 'IS000002',
      issueDate: '2026-10-12',
      type: 'SAMPLE',
      itemId: 'P001',
      qty: new Decimal('2'),
      reason: 'عينة عميل',
      status: 'POSTED',
    },
    {
      id: 'IS000003',
      code: 'IS000003',
      issueDate: '2026-10-12',
      type: 'DAMAGED',
      itemId: 'P001',
      qty: new Decimal('1'),
      reason: 'تالف في المحل',
      status: 'POSTED',
    },
    // 2026-10-14: Perfume tester
    {
      id: 'IS000004',
      code: 'IS000004',
      issueDate: '2026-10-14',
      type: 'TESTER',
      itemId: 'P003',
      qty: new Decimal('1'),
      reason: 'تستر عطر',
      status: 'POSTED',
    },
  ];

  const batches: ProductionBatchDomain[] = [
    // 2026-10-13: B-001 (Produces 10 P003, consumes 20ml P002)
    {
      id: 'B-001',
      code: 'B-001',
      completionDate: '2026-10-13',
      finishedItemId: 'P003',
      producedQty: new Decimal('10'),
      materials: [
        {
          id: 'BM-001',
          batchId: 'B-001',
          rawItemId: 'P002',
          consumedQty: new Decimal('20'),
        },
      ],
      status: 'POSTED',
    },
  ];

  const referrals: DriverReferralDomain[] = [
    // 2026-10-18: 10 referrals for D001
    { id: 'V01', code: 'VIS000001', visitDate: '2026-10-18', visitorUniqueKey: '081001', visitorName: 'زبون 1', driverId: 'D001', status: 'POSTED' },
    { id: 'V02', code: 'VIS000002', visitDate: '2026-10-18', visitorUniqueKey: '081002', visitorName: 'زبون 2', driverId: 'D001', status: 'POSTED' },
    { id: 'V03', code: 'VIS000003', visitDate: '2026-10-18', visitorUniqueKey: '081003', visitorName: 'زبون 3', driverId: 'D001', status: 'POSTED' },
    { id: 'V04', code: 'VIS000004', visitDate: '2026-10-18', visitorUniqueKey: '081004', visitorName: 'زبون 4', driverId: 'D001', status: 'POSTED' },
    { id: 'V05', code: 'VIS000005', visitDate: '2026-10-18', visitorUniqueKey: '081005', visitorName: 'زبون 5', driverId: 'D001', status: 'POSTED' },
    { id: 'V06', code: 'VIS000006', visitDate: '2026-10-18', visitorUniqueKey: '081006', visitorName: 'زبون 6', driverId: 'D001', status: 'POSTED' },
    { id: 'V07', code: 'VIS000007', visitDate: '2026-10-18', visitorUniqueKey: '081007', visitorName: 'زبون 7', driverId: 'D001', status: 'POSTED' },
    { id: 'V08', code: 'VIS000008', visitDate: '2026-10-18', visitorUniqueKey: '081008', visitorName: 'زبون 8', driverId: 'D001', status: 'POSTED' },
    { id: 'V09', code: 'VIS000009', visitDate: '2026-10-18', visitorUniqueKey: '081009', visitorName: 'زبون 9', driverId: 'D001', status: 'POSTED' },
    { id: 'V10', code: 'VIS000010', visitDate: '2026-10-18', visitorUniqueKey: '081010', visitorName: 'زبون 10', driverId: 'D001', status: 'POSTED' },
  ];

  const cashTransactions: CashTransactionDomain[] = [
    // 2026-10-04: C000001 (Bank Payment to Nusantara 1,200,000)
    {
      id: 'C000001',
      code: 'C000001',
      txDate: '2026-10-04',
      type: 'SUPPLIER_PAYMENT',
      account: 'BANK',
      amount: new Decimal('1200000'),
      partyId: 'SUP001',
      invoiceKey: '2026 | P-1001',
      status: 'POSTED',
    },
    // 2026-10-06: C000002 (Cash Collection from Ahmed 600,000)
    {
      id: 'C000002',
      code: 'C000002',
      txDate: '2026-10-06',
      type: 'CUSTOMER_COLLECTION',
      account: 'CASH',
      amount: new Decimal('600000'),
      partyId: 'C001',
      invoiceKey: '2026 | S-1001',
      status: 'POSTED',
    },
    // 2026-10-08: C000003 (Cash Collection from Ahmed 150,000)
    {
      id: 'C000003',
      code: 'C000003',
      txDate: '2026-10-08',
      type: 'CUSTOMER_COLLECTION',
      account: 'CASH',
      amount: new Decimal('150000'),
      partyId: 'C001',
      invoiceKey: '2026 | S-1001',
      status: 'POSTED',
    },
    // 2026-10-09: C000004 (Cash Collection from Salem 500,000)
    {
      id: 'C000004',
      code: 'C000004',
      txDate: '2026-10-09',
      type: 'CUSTOMER_COLLECTION',
      account: 'CASH',
      amount: new Decimal('500000'),
      partyId: 'C002',
      invoiceKey: '2026 | S-1002',
      status: 'POSTED',
    },
    // 2026-10-10: C000005 (Cash Refund to Salem 100,000)
    {
      id: 'C000005',
      code: 'C000005',
      txDate: '2026-10-10',
      type: 'CUSTOMER_REFUND',
      account: 'CASH',
      amount: new Decimal('100000'),
      partyId: 'C002',
      invoiceKey: '2026 | S-1002',
      status: 'POSTED',
    },
    // 2026-10-11: C000006 (Cash Refund to Ahmed 50,000)
    {
      id: 'C000006',
      code: 'C000006',
      txDate: '2026-10-11',
      type: 'CUSTOMER_REFUND',
      account: 'CASH',
      amount: new Decimal('50000'),
      partyId: 'C001',
      invoiceKey: '2026 | S-1001',
      status: 'POSTED',
    },
    // 2026-10-14: C000007 (Cash Collection from Salem 60,000)
    {
      id: 'C000007',
      code: 'C000007',
      txDate: '2026-10-14',
      type: 'CUSTOMER_COLLECTION',
      account: 'CASH',
      amount: new Decimal('60000'),
      partyId: 'C002',
      invoiceKey: '2026 | S-1003',
      status: 'POSTED',
    },
    // 2026-10-19: C000008 (Cash Expense 100,000)
    {
      id: 'C000008',
      code: 'C000008',
      txDate: '2026-10-19',
      type: 'CASH_EXPENSE',
      account: 'CASH',
      amount: new Decimal('100000'),
      status: 'POSTED',
    },
    // 2026-10-19: C000011 (Bank Brother Financing 2,000,000)
    {
      id: 'C000011',
      code: 'C000011',
      txDate: '2026-10-19',
      type: 'OWNER_BROTHER_FINANCING',
      account: 'BANK',
      amount: new Decimal('2000000'),
      partyId: 'F001',
      status: 'POSTED',
    },
    // 2026-10-20: C000009 (Cash Driver Gift 100,000)
    {
      id: 'C000009',
      code: 'C000009',
      txDate: '2026-10-20',
      type: 'DRIVER_CASH_GIFT',
      account: 'CASH',
      amount: new Decimal('100000'),
      partyId: 'D001',
      status: 'POSTED',
    },
    // 2026-10-22: C000010 (Bank Asset Purchase FA014 1,000,000)
    {
      id: 'C000010',
      code: 'C000010',
      txDate: '2026-10-22',
      type: 'ASSET_PURCHASE',
      account: 'BANK',
      amount: new Decimal('1000000'),
      assetId: 'FA014',
      status: 'POSTED',
    },
  ];

  it('Verifies Opening Equity and Balance check (Slide 11-12)', () => {
    const report = computeReportsEngine({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
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
    });

    const eq = report.openingEquitySummary;
    expect(eq.openingCash.toString()).toBe('5000000');
    expect(eq.openingBank.toString()).toBe('20000000');
    expect(eq.openingInventoryValue.toString()).toBe('1500000'); // 1,000,000 (P001) + 500,000 (P002)
    expect(eq.openingEquity.toString()).toBe('26500000');
    expect(eq.allocatedPartnerCapital.toString()).toBe('26500000'); // 15,900,000 + 10,600,000
    expect(eq.openingEquityDiff.toString()).toBe('0');
  });

  it('Verifies Ending Inventory at October 31, 2026 (Slide 44)', () => {
    const costing = computeCostingEngine({
      startYear: 2026,
      items,
      purchases,
      sales,
      returns,
      stockIssues,
      batches,
      targetMaxMonthIndex: 12,
    });

    const octMonthIndex = 10;

    // P001: Natural Oud
    const p001 = costing.getItemEndingState('P001', octMonthIndex);
    expect(p001.EQ.toNumber()).toBe(228);
    expect(p001.AVG.toNumber()).toBe(10000);
    expect(p001.EV.toNumber()).toBe(2280000);
    expect(p001.COST_CHECK).toBe('');

    // P002: Raw Musk
    const p002 = costing.getItemEndingState('P002', octMonthIndex);
    expect(p002.EQ.toNumber()).toBe(80);
    expect(p002.AVG.toNumber()).toBe(5000);
    expect(p002.EV.toNumber()).toBe(400000);
    expect(p002.COST_CHECK).toBe('');

    // P003: Finished Perfume
    const p003 = costing.getItemEndingState('P003', octMonthIndex);
    expect(p003.EQ.toNumber()).toBe(7);
    expect(p003.AVG.toNumber()).toBe(10000);
    expect(p003.EV.toNumber()).toBe(70000);
    expect(p003.COST_CHECK).toBe('');

    // Total Inventory Value
    const totalEV = p001.EV.plus(p002.EV).plus(p003.EV);
    expect(totalEV.toNumber()).toBe(2750000);
  });

  it('Verifies Receivables, Payables, and Aging at October 31, 2026 (Slide 42)', () => {
    const balances = computeBalancesEngine({
      asOfDate: '2026-10-31',
      parties,
      purchases,
      sales,
      returns,
      cashTransactions,
      systemSetting,
    });

    // Ahmed C001
    const ahmedSummary = balances.partySummaries.find((p) => p.partyId === 'C001')!;
    expect(ahmedSummary.partyDebtAsOf.toNumber()).toBe(0);
    expect(ahmedSummary.partyCreditAsOf.toNumber()).toBe(0);
    expect(ahmedSummary.coverageAsOf).toBe('متوازن');

    // Salem C002
    const salemSummary = balances.partySummaries.find((p) => p.partyId === 'C002')!;
    expect(salemSummary.partyDebtAsOf.toNumber()).toBe(0);
    expect(salemSummary.partyCreditAsOf.toNumber()).toBe(0);
    expect(salemSummary.coverageAsOf).toBe('متوازن');

    // Supplier Nusantara SUP001
    const supSummary = balances.partySummaries.find((p) => p.partyId === 'SUP001')!;
    expect(supSummary.partyDebtAsOf.toNumber()).toBe(600000);
    expect(supSummary.partyCreditAsOf.toNumber()).toBe(0);
    expect(supSummary.coverageAsOf).toBe('مستحق');
  });

  it('Verifies CreditBefore and RefundLimitValid on October 10 and 11 (Slide 22-24)', () => {
    const balances = computeBalancesEngine({
      asOfDate: '2026-10-31',
      parties,
      purchases,
      sales,
      returns,
      cashTransactions,
      systemSetting,
    });

    // On 2026-10-10, Salem returned 4g (value 100,000) after paying 500,000 on 500,000 sale
    // Credit available for refund was 100,000
    const salemCreditCheck = balances.checkCreditBefore(
      'C002',
      '2026 | S-1002',
      '2026-10-10',
      new Decimal('100000'),
      'C000005'
    );
    expect(salemCreditCheck.creditBefore.toNumber()).toBe(100000);
    expect(salemCreditCheck.refundLimitValid).toBe(true);

    // On 2026-10-11, Ahmed had paid 750,000, had returns of 250,000 + 50,000 on 1,000,000 sale
    // Credit available for refund was 50,000
    const ahmedCreditCheck = balances.checkCreditBefore(
      'C001',
      '2026 | S-1001',
      '2026-10-11',
      new Decimal('50000'),
      'C000006'
    );
    expect(ahmedCreditCheck.creditBefore.toNumber()).toBe(50000);
    expect(ahmedCreditCheck.refundLimitValid).toBe(true);

    // Testing excess refund attempt should be invalid
    const excessCheck = balances.checkCreditBefore(
      'C001',
      '2026 | S-1001',
      '2026-10-11',
      new Decimal('50001'),
      'C000006'
    );
    expect(excessCheck.refundLimitValid).toBe(false);
  });

  it('Verifies Driver Yusuf Referrals & Gifts calculation (Slide 33-36)', () => {
    const driverResult = computeDriverGiftsEngine({
      asOfDate: '2026-10-31',
      drivers: parties,
      policies,
      referrals,
      cashTransactions,
      sales,
    });

    const yusuf = driverResult.driverSummaries.find((d) => d.driverId === 'D001')!;
    expect(yusuf.registeredClients).toBe(10);
    expect(yusuf.totalGiftsEarned).toBe(1);
    expect(yusuf.totalAccruedAmount.toNumber()).toBe(100000);
    expect(yusuf.totalReceivedAmount.toNumber()).toBe(100000);
    expect(yusuf.remainingBalance.toNumber()).toBe(0);
    expect(yusuf.lastRemainder).toBe(0);
    expect(yusuf.clientsNeededForNextGift).toBe(10);
  });

  it('Verifies Complete Income Statement & Operating Profit for October 2026 (Slide 46)', () => {
    const report = computeReportsEngine({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
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
    });

    const cards = report.cards;

    // 1. Net Sales (B10): 1,560,000 - 400,000 = 1,160,000
    expect(cards.netSales.toNumber()).toBe(1160000);

    // 2. Net COGS (B11): 620,000 - 160,000 = 460,000
    expect(cards.netCOGS.toNumber()).toBe(460000);

    // 3. Gross Profit (B12): 1,160,000 - 460,000 = 700,000
    expect(cards.grossProfit.toNumber()).toBe(700000);

    // 4. Cash Operating Expenses (B13): 100,000 (expense) + 100,000 (driver gift) = 200,000
    expect(cards.cashOperatingExpenses.toNumber()).toBe(200000);

    // 5. Inventory Losses & Issues: 70,000 (issues) + 20,000 (damaged return) = 90,000
    expect(cards.inventoryLossesAndIssues.toNumber()).toBe(90000);

    // 6. Other Operating Additions: 0
    expect(cards.otherOperatingAdditions.toNumber()).toBe(0);

    // 7. Operating Profit (B14): 700,000 - 200,000 - 90,000 = 410,000
    expect(cards.operatingProfit.toNumber()).toBe(410000);

    // Cumulative profit since start (B35)
    expect(cards.cumulativeOperatingProfitSinceStart.toNumber()).toBe(410000);
  });

  it('Verifies Cash, Bank, Balance Sheet, and Partner Shares at October 31, 2026 (Slide 12, 46, 47)', () => {
    const report = computeReportsEngine({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
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
    });

    // Cash and Bank
    expect(report.cards.cashBalance.toNumber()).toBe(5960000);
    expect(report.cards.bankBalance.toNumber()).toBe(19800000);
    expect(report.cards.cashAndBankTotal.toNumber()).toBe(25760000);

    // Inventory Value
    expect(report.cards.inventoryValue.toNumber()).toBe(2750000);

    // Assets: Total cash addition to FA014 = 1,000,000
    let totalAssetAdditions = zero();
    for (const c of cashTransactions) {
      if (c.type === 'ASSET_PURCHASE') totalAssetAdditions = totalAssetAdditions.plus(c.amount);
    }
    expect(totalAssetAdditions.toNumber()).toBe(1000000);

    // Total Assets = Cash (25,760,000) + Inventory (2,750,000) + New Asset (1,000,000) = 29,510,000
    const totalAssets = report.cards.cashAndBankTotal
      .plus(report.cards.inventoryValue)
      .plus(totalAssetAdditions);
    expect(totalAssets.toNumber()).toBe(29510000);

    // Liabilities = Supplier Nusantara (600,000) + Brother Financing (2,000,000) = 2,600,000
    let brotherFinancing = zero();
    for (const c of cashTransactions) {
      if (c.type === 'OWNER_BROTHER_FINANCING') brotherFinancing = brotherFinancing.plus(c.amount);
      if (c.type === 'OWNER_BROTHER_REPAYMENT') brotherFinancing = brotherFinancing.minus(c.amount);
    }
    expect(brotherFinancing.toNumber()).toBe(2000000);

    const totalLiabilities = report.cards.supplierDebtTotal.plus(brotherFinancing);
    expect(totalLiabilities.toNumber()).toBe(2600000);

    // Net Equity = Total Assets - Total Liabilities = 26,910,000
    const netEquity = totalAssets.minus(totalLiabilities);
    expect(netEquity.toNumber()).toBe(26910000);

    // Opening Equity (26,500,000) + October Operating Profit (410,000) = 26,910,000!
    const expectedEquity = new Decimal('26500000').plus(new Decimal('410000'));
    expect(netEquity.equals(expectedEquity)).toBe(true);

    // Partners' Profit Shares
    const omar = report.partnersSummary.find((p) => p.partnerId === 'PR001')!;
    const khalid = report.partnersSummary.find((p) => p.partnerId === 'PR002')!;

    expect(omar.cumulativeProfitShare.toNumber()).toBe(246000); // 410,000 * 60%
    expect(khalid.cumulativeProfitShare.toNumber()).toBe(164000); // 410,000 * 40%
  });
});
