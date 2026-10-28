import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/db';
import {
  createDriverReferral,
  getDriverReferrals,
  getDriverGiftsSummary,
  voidDriverReferral,
} from '../src/services/referral.service';
import { createCashTransaction } from '../src/services/cash.service';
import { CashTransactionType } from '@prisma/client';
import {
  loadBalancesEngine,
  loadCostingEngine,
  loadReportsEngine,
} from '../src/services/ledger-loader';
import { Decimal, toDecimal } from '../src/domain/decimal';

describe('Phase 5 & 6: Driver Referrals, Dashboard Reports, Inventory, and Debts', () => {
  let testDriverId: string;
  let testClientId: string;
  let testSupplierId: string;
  let testItemId: string;

  beforeAll(async () => {
    // Ensure gift policy exists
    const policy = await prisma.giftPolicy.findFirst();
    if (!policy) {
      await prisma.giftPolicy.create({
        data: {
          effectiveDate: new Date('2026-01-01'),
          customersPerGift: 10,
          giftValue: 100000,
          notes: 'سياسة الهدايا الافتراضية',
        },
      });
    }

    // 1. Get or create test driver with gifts enabled
    let driver = await prisma.party.findFirst({ where: { type: 'DRIVER', isDriverGiftEnabled: true } });
    if (!driver) {
      driver = await prisma.party.create({
        data: {
          code: 'D_TEST_99',
          name: 'سائق اختبار 99',
          type: 'DRIVER',
          carNumber: 'أ ب ج 9999',
          isDriverGiftEnabled: true,
        },
      });
    }
    testDriverId = driver.id;

    // 2. Client
    let client = await prisma.party.findFirst({ where: { type: 'CLIENT' } });
    if (!client) {
      client = await prisma.party.create({
        data: {
          code: 'C_TEST_99',
          name: 'عميل اختبار 99',
          type: 'CLIENT',
        },
      });
    }
    testClientId = client.id;

    // 3. Supplier
    let supplier = await prisma.party.findFirst({ where: { type: 'SUPPLIER' } });
    if (!supplier) {
      supplier = await prisma.party.create({
        data: {
          code: 'SUP_TEST_99',
          name: 'مورد اختبار 99',
          type: 'SUPPLIER',
        },
      });
    }
    testSupplierId = supplier.id;

    // 4. Item
    let item = await prisma.item.findFirst({ where: { role: 'MERCHANDISE' } });
    if (!item) {
      let category = await prisma.itemCategory.findFirst();
      if (!category) {
        category = await prisma.itemCategory.create({
          data: {
            name: 'عود طبيعي',
            prefix: 'NA',
          },
        });
      }
      let unit = await prisma.unitOption.findFirst();
      if (!unit) {
        unit = await prisma.unitOption.create({
          data: {
            name: 'تولة',
          },
        });
      }
      item = await prisma.item.create({
        data: {
          code: 'P999',
          name: 'صنف اختبار تقارير 999',
          role: 'MERCHANDISE',
          categoryId: category.id,
          unitId: unit.id,
        },
      });
    }
    testItemId = item.id;
  });

  describe('1. Driver Referrals & Gifts Management', () => {
    it('should register a valid driver referral and return live gift status', async () => {
      const uniquePhone = `059${Date.now().toString().slice(-7)}`;
      const result = await createDriverReferral({
        driverId: testDriverId,
        visitDate: '2026-03-01',
        visitorName: 'عميل زائر أولي',
        visitorUniqueKey: uniquePhone,
        notes: 'زيارة اختبار أولي',
      });

      expect(result).toBeDefined();
      expect(result.referral.id).toBeDefined();
      expect(result.referral.visitorUniqueKey).toBe(uniquePhone);
      expect(result.threshold).toBeGreaterThanOrEqual(1);
    });

    it('should enforce strict system-wide uniqueness on visitorUniqueKey (COUNTIF == 1)', async () => {
      const duplicateKey = `058${Date.now().toString().slice(-7)}`;
      // Register first time
      await createDriverReferral({
        driverId: testDriverId,
        visitDate: '2026-03-02',
        visitorName: 'عميل فريد أول مرة',
        visitorUniqueKey: duplicateKey,
      });

      // Second time with same key MUST fail
      await expect(
        createDriverReferral({
          driverId: testDriverId,
          visitDate: '2026-03-03',
          visitorName: 'نفس العميل مرة أخرى',
          visitorUniqueKey: duplicateKey,
        })
      ).rejects.toThrow(/مسجل مسبقاً/);
    });

    it('should track cumulative visits and allow cash gift settlement for driver', async () => {
      // Create a fresh dedicated driver
      const freshDriver = await prisma.party.create({
        data: {
          code: `D_THR_${Date.now().toString().slice(-4)}`,
          name: `سائق حافز ${Date.now()}`,
          type: 'DRIVER',
          isDriverGiftEnabled: true,
        },
      });

      // Visit 1
      const res1 = await createDriverReferral({
        driverId: freshDriver.id,
        visitDate: '2026-03-05',
        visitorName: 'زائر 1',
        visitorUniqueKey: `V1_${Date.now()}_${Math.random()}`,
      });
      expect(res1.currentCount).toBe(1);

      // Settle a cash gift
      const cashTx = await createCashTransaction({
        type: CashTransactionType.DRIVER_CASH_GIFT,
        partyId: freshDriver.id,
        amount: 100,
        txDate: '2026-03-08',
        account: 'CASH',
        description: 'صرف مكافأة الهدية نقداً للسائق',
      });
      expect(cashTx.id).toBeDefined();
      expect(cashTx.type).toBe('DRIVER_CASH_GIFT');
      expect(toDecimal(cashTx.amount).toNumber()).toBe(100);

      // Summary reflects payments
      const summaryAfter = await getDriverGiftsSummary();
      const driverSummary = summaryAfter.find((s) => s.driverId === freshDriver.id);
      expect(driverSummary).toBeDefined();
      expect(driverSummary?.totalReceivedAmount).toBeGreaterThanOrEqual(100);
    });

    it('should allow voiding a referral with audit trail', async () => {
      const key = `VOID_TEST_${Date.now()}`;
      const ref = await createDriverReferral({
        driverId: testDriverId,
        visitDate: '2026-03-10',
        visitorName: 'زائر للإلغاء',
        visitorUniqueKey: key,
      });

      const voided = await voidDriverReferral(ref.referral.id, 'إلغاء لخطأ في الإدخال');
      expect(voided.status).toBe('VOID');

      // The visit is now marked VOID in the list
      const list = await getDriverReferrals({ driverId: testDriverId });
      const found = list.find((r) => r.id === ref.referral.id);
      expect(found?.status).toBe('VOID');
    });
  });

  describe('2. Dashboard Reports & Financial Metrics Engine', () => {
    it('should compute the 14 income statement and financial metrics correctly', async () => {
      const reports = await loadReportsEngine('2026-01-01', '2026-12-31');

      expect(reports).toBeDefined();
      expect(reports.cards).toBeDefined();

      const { cards } = reports;
      // grossProfit = netSales - netCOGS
      const expectedGP = cards.netSales.minus(cards.netCOGS);
      expect(cards.grossProfit.toNumber()).toBeCloseTo(expectedGP.toNumber(), 2);

      // operatingProfit = grossProfit - cashOperatingExpenses - inventoryLossesAndIssues + otherOperatingAdditions
      const expectedOP = cards.grossProfit
        .minus(cards.cashOperatingExpenses)
        .minus(cards.inventoryLossesAndIssues)
        .plus(cards.otherOperatingAdditions);
      expect(cards.operatingProfit.toNumber()).toBeCloseTo(expectedOP.toNumber(), 2);

      // Verify financial metrics are Decimals
      expect(cards.netSales).toBeInstanceOf(Decimal);
      expect(cards.netCOGS).toBeInstanceOf(Decimal);
      expect(cards.grossProfit).toBeInstanceOf(Decimal);
      expect(cards.cashOperatingExpenses).toBeInstanceOf(Decimal);
      expect(cards.inventoryLossesAndIssues).toBeInstanceOf(Decimal);
      expect(cards.otherOperatingAdditions).toBeInstanceOf(Decimal);
      expect(cards.operatingProfit).toBeInstanceOf(Decimal);
      expect(cards.inventoryValue).toBeInstanceOf(Decimal);
      expect(cards.cashAndBankTotal).toBeInstanceOf(Decimal);
      expect(cards.cashBalance).toBeInstanceOf(Decimal);
      expect(cards.bankBalance).toBeInstanceOf(Decimal);
      expect(cards.clientDebtTotal).toBeInstanceOf(Decimal);
      expect(cards.supplierDebtTotal).toBeInstanceOf(Decimal);
      expect(cards.clientCreditTotal).toBeInstanceOf(Decimal);
      expect(cards.supplierCreditTotal).toBeInstanceOf(Decimal);

      // Monthly comparison array for 12 months
      expect(reports.monthlyComparison.length).toBe(12);
      expect(reports.monthlyComparison[0].monthName).toBe('يناير');
      expect(reports.monthlyComparison[11].monthName).toBe('ديسمبر');

      // Category breakdown
      expect(Array.isArray(reports.categorySales)).toBe(true);
    });

    it('should load balances engine and accurately compute customer debts and supplier payables', async () => {
      const balances = await loadBalancesEngine('2026-12-31');

      expect(balances).toBeDefined();
      expect(Array.isArray(balances.partySummaries)).toBe(true);
      expect(Array.isArray(balances.invoiceItems)).toBe(true);

      // Verify signed balances and invoice integrity
      for (const summary of balances.partySummaries) {
        expect(summary.partySignedAsOf).toBeInstanceOf(Decimal);
        expect(summary.partyDebtAsOf.gte(0)).toBe(true);
        expect(summary.partyCreditAsOf.gte(0)).toBe(true);
      }
    });
  });

  describe('3. Inventory Report & Stock Card Chronological Movements', () => {
    it('should maintain inventory ledger integrity and never have null average costs', async () => {
      const costing = await loadCostingEngine(12);
      expect(costing.itemStates.size).toBeGreaterThan(0);

      const state = costing.getItemEndingState(testItemId, 12);
      expect(state).toBeDefined();
      expect(state.AVG.gte(0)).toBe(true);
      expect(state.EV.gte(0)).toBe(true);
    });
  });
});
