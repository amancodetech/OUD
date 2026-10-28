import { describe, it, expect } from 'vitest';
import { prisma } from '../src/lib/db';
import { toDecimal } from '../src/domain/decimal';
import { createPurchaseInvoice, getPurchaseInvoiceById } from '../src/services/purchase.service';
import { createSaleInvoice, createDriverGiftDelivery, getAvailableStockAtDate } from '../src/services/sale.service';
import { createCashTransaction, getCashSummary } from '../src/services/cash.service';
import { CashAccountType, CashTransactionType } from '@prisma/client';

describe('Phase 3: Purchases, Sales, Instant Payments, and Cash Guardrails', () => {
  let supplierId: string;
  let clientId: string;
  let driverId: string;
  let itemId: string;

  it('Setup: fetches test parties and items from database', async () => {
    // 1. Get or create supplier
    let supplier = await prisma.party.findFirst({ where: { type: 'SUPPLIER' } });
    if (!supplier) {
      supplier = await prisma.party.create({
        data: {
          code: 'SUP_TEST_01',
          name: 'مورد اختبار فاز 3',
          type: 'SUPPLIER',
        },
      });
    }
    supplierId = supplier.id;

    // 2. Get or create client
    let client = await prisma.party.findFirst({ where: { type: 'CLIENT' } });
    if (!client) {
      client = await prisma.party.create({
        data: {
          code: 'C_TEST_01',
          name: 'عميل اختبار فاز 3',
          type: 'CLIENT',
        },
      });
    }
    clientId = client.id;

    // 3. Get or create driver with gifts enabled
    let driver = await prisma.party.findFirst({ where: { type: 'DRIVER' } });
    if (!driver) {
      driver = await prisma.party.create({
        data: {
          code: 'D_TEST_01',
          name: 'سائق اختبار فاز 3',
          type: 'DRIVER',
          isDriverGiftEnabled: true,
        },
      });
    } else if (!driver.isDriverGiftEnabled) {
      driver = await prisma.party.update({
        where: { id: driver.id },
        data: { isDriverGiftEnabled: true },
      });
    }
    driverId = driver.id;

    // 4. Get or create item
    let item = await prisma.item.findFirst();
    if (!item) {
      const category = await prisma.itemCategory.findFirst();
      const unit = await prisma.unitOption.findFirst();
      item = await prisma.item.create({
        data: {
          code: 'P_TEST_01',
          name: 'صنف اختبار فاز 3',
          categoryId: category!.id,
          unitId: unit!.id,
          openingQty: 100,
          openingValue: 500000,
        },
      });
    }
    itemId = item.id;

    expect(supplierId).toBeDefined();
    expect(clientId).toBeDefined();
    expect(driverId).toBeDefined();
    expect(itemId).toBeDefined();
  });

  it('Creates a purchase invoice with lines, landedCost, discount and instant payment', async () => {
    const uniqueNo = `P-TEST-${Date.now().toString().slice(-4)}`;
    const invoice = await createPurchaseInvoice({
      invoiceDate: '2026-10-15',
      invoiceNo: uniqueNo,
      supplierId,
      lines: [
        {
          itemId,
          qty: 10,
          unitCost: 20000,
          landedCost: 5000,
          discount: 2000, // lineTotal = 10 * 20000 + 5000 - 2000 = 203,000
        },
      ],
      paidNow: 100000,
      paymentAccount: CashAccountType.CASH,
    });

    expect(invoice).toBeDefined();
    expect(invoice.invoiceKey).toContain(uniqueNo);

    // Verify invoice calculations
    const details = await getPurchaseInvoiceById(invoice.id);
    expect(details).not.toBeNull();
    expect(details?.invoiceTotal).toBe(203000);
    expect(details?.settlementAsOf).toBe(100000);
    expect(details?.signedAsOf).toBe(103000);
    expect(details?.invoiceDebt).toBe(103000);
  });

  it('Creates a sale invoice with instant collection and checks stock availability', async () => {
    const availableBefore = await getAvailableStockAtDate(itemId, '2026-10-20');
    expect(Number(availableBefore)).toBeGreaterThan(0);

    const uniqueNo = `S-TEST-${Date.now().toString().slice(-4)}`;
    const sale = await createSaleInvoice({
      invoiceDate: '2026-10-20',
      invoiceNo: uniqueNo,
      customerId: clientId,
      lines: [
        {
          itemId,
          qty: 5,
          unitPrice: 35000,
          discount: 5000, // netSaleAmount = 5 * 35000 - 5000 = 170,000
        },
      ],
      paidNow: 170000,
      collectionAccount: CashAccountType.BANK,
    });

    expect(sale).toBeDefined();
    expect(sale.invoiceKey).toContain(uniqueNo);

    // Verify stock decreased by 5
    const availableAfter = await getAvailableStockAtDate(itemId, '2026-10-20');
    expect(Number(availableBefore) - Number(availableAfter)).toBe(5);
  });

  it('Creates a driver gift delivery with lineType = DRIVER_GIFT and 0 sale amount', async () => {
    const giftResult = await createDriverGiftDelivery({
      invoiceDate: '2026-10-22',
      driverId,
      itemId,
      qty: 2,
      driverGiftSettlementValue: 100000,
      notes: 'تسليم هدية عينية تجريبية',
    });

    expect(giftResult.invoice).toBeDefined();
    expect(giftResult.line).toBeDefined();
    expect(giftResult.line.lineType).toBe('DRIVER_GIFT');
    expect(Number(giftResult.line.unitPrice)).toBe(0);
    expect(Number(giftResult.line.netSaleAmount)).toBe(0);
    expect(Number(giftResult.line.driverGiftSettlementValue)).toBe(100000);
  });

  it('Rejects CUSTOMER_REFUND when refund exceeds CreditBefore', async () => {
    // Attempting to refund 500,000 without prior credit on invoice must throw CreditBefore error
    await expect(
      createCashTransaction({
        txDate: '2026-10-25',
        type: CashTransactionType.CUSTOMER_REFUND,
        account: CashAccountType.CASH,
        amount: 500000,
        partyId: clientId,
        invoiceKey: '2026 | S-TEST-9999',
      })
    ).rejects.toThrow(/لا يمكن رد مبلغ/);
  });

  it('Rejects SUPPLIER_REFUND when refund exceeds CreditBefore', async () => {
    await expect(
      createCashTransaction({
        txDate: '2026-10-25',
        type: CashTransactionType.SUPPLIER_REFUND,
        account: CashAccountType.BANK,
        amount: 300000,
        partyId: supplierId,
        invoiceKey: '2026 | P-TEST-9999',
      })
    ).rejects.toThrow(/لا يمكن رد مبلغ/);
  });

  it('Executes internal transfer between Cash and Bank successfully', async () => {
    const summaryBefore = await getCashSummary();

    const transfer = await createCashTransaction({
      txDate: '2026-10-25',
      type: CashTransactionType.INTERNAL_TRANSFER,
      account: CashAccountType.CASH,
      transferToAccount: CashAccountType.BANK,
      amount: 50000,
      description: 'تحويل سيولة من الخزينة إلى البنك',
    });

    expect(transfer).toBeDefined();
    expect(transfer.type).toBe('INTERNAL_TRANSFER');

    const summaryAfter = await getCashSummary();
    // Cash decreased by 50,000
    expect(toDecimal(summaryBefore.cashBalance).minus(summaryAfter.cashBalance).toString()).toBe('50000');
    // Bank increased by 50,000
    expect(toDecimal(summaryAfter.bankBalance).minus(summaryBefore.bankBalance).toString()).toBe('50000');
    // Total cash & bank remains the same
    expect(summaryAfter.cashAndBankTotal).toBe(summaryBefore.cashAndBankTotal);
  });
});
