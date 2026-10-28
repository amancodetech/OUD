import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/db';
import { createPurchaseInvoice } from '../src/services/purchase.service';
import { createSaleInvoice, getAvailableStockAtDate } from '../src/services/sale.service';
import {
  createReturnLine,
  getSourceLineOptions,
  getReturnLines,
  voidReturnLine,
} from '../src/services/return.service';
import {
  createStockIssue,
  getStockIssues,
  voidStockIssue,
} from '../src/services/stock-issue.service';
import {
  createProductionBatch,
  getProductionBatches,
  voidProductionBatch,
} from '../src/services/batch.service';
import { Decimal, toDecimal } from '../src/domain/decimal';

describe('Phase 4: Returns, Stock Issues, and Integrated Manufacturing', () => {
  let clientId: string;
  let supplierId: string;
  let merchandiseItemId: string;
  let rawItemId: string;
  let finishedItemId: string;

  beforeAll(async () => {
    // 1. Get or create test client
    let client = await prisma.party.findFirst({ where: { type: 'CLIENT' } });
    if (!client) {
      client = await prisma.party.create({
        data: {
          code: 'C_PH4_01',
          name: 'عميل اختبار فاز 4',
          type: 'CLIENT',
        },
      });
    }
    clientId = client.id;

    // 2. Get or create test supplier
    let supplier = await prisma.party.findFirst({ where: { type: 'SUPPLIER' } });
    if (!supplier) {
      supplier = await prisma.party.create({
        data: {
          code: 'SUP_PH4_01',
          name: 'مورد اختبار فاز 4',
          type: 'SUPPLIER',
        },
      });
    }
    supplierId = supplier.id;

    // 3. Ensure unit and category
    let unit = await prisma.unitOption.findFirst();
    if (!unit) {
      unit = await prisma.unitOption.create({
        data: { name: 'قطعة' },
      });
    }

    let category = await prisma.itemCategory.findFirst();
    if (!category) {
      category = await prisma.itemCategory.create({
        data: { name: 'عطور', prefix: 'PRF' },
      });
    }

    // 4. Create unique items for Phase 4 to guarantee clean, unexhausted stock
    const timestamp = Date.now();
    const merch = await prisma.item.create({
      data: {
        code: `P_M_${timestamp}`,
        name: `بضاعة عطر فاز 4 ${timestamp}`,
        categoryId: category.id,
        unitId: unit.id,
        role: 'MERCHANDISE',
        openingQty: '0',
        openingValue: '0',
      },
    });
    merchandiseItemId = merch.id;

    // 5. Create raw item
    const raw = await prisma.item.create({
      data: {
        code: `P_R_${timestamp}`,
        name: `زيت مسك خام فاز 4 ${timestamp}`,
        categoryId: category.id,
        unitId: unit.id,
        role: 'RAW',
        openingQty: '0',
        openingValue: '0',
      },
    });
    rawItemId = raw.id;

    // 6. Create finished item
    const finished = await prisma.item.create({
      data: {
        code: `P_F_${timestamp}`,
        name: `عطر مركب خاص فاز 4 ${timestamp}`,
        categoryId: category.id,
        unitId: unit.id,
        role: 'FINISHED',
        openingQty: '0',
        openingValue: '0',
      },
    });
    finishedItemId = finished.id;

    // 7. Seed initial purchases to provide stock for test operations
    await createPurchaseInvoice({
      invoiceDate: '2026-06-01',
      invoiceNo: `PINV-INIT-${timestamp}`,
      supplierId: supplierId,
      lines: [
        {
          itemId: merchandiseItemId,
          qty: 100,
          unitCost: 100,
        },
        {
          itemId: rawItemId,
          qty: 100,
          unitCost: 50,
        },
      ],
    });
  });

  // =========================================================================
  // 1. RETURNS TESTS (مرتجعات البيع والشراء والتحقق من السقف التراكمي)
  // =========================================================================
  describe('Returns Module', () => {
    let testSaleLineId: string;
    let testSaleInvoiceKey: string;
    let testPurchaseLineId: string;
    let testPurchaseInvoiceKey: string;

    it('creates a base sale invoice to test returns against', async () => {
      const sale = await createSaleInvoice({
        invoiceDate: '2026-06-10',
        invoiceNo: `SINV-RET-${Date.now()}`,
        customerId: clientId,
        paidNow: 2000,
        collectionAccount: 'CASH',
        lines: [
          {
            itemId: merchandiseItemId,
            qty: 10,
            unitPrice: 200,
            discount: 0,
          },
        ],
      });

      expect(sale).toBeDefined();
      const saleLines = await prisma.saleLine.findMany({ where: { invoiceId: sale.id } });
      expect(saleLines.length).toBe(1);
      testSaleLineId = saleLines[0].id;
      testSaleInvoiceKey = sale.invoiceKey;

      const opts = await getSourceLineOptions(testSaleInvoiceKey, 'SALE_RETURN', clientId);
      expect(opts.length).toBe(1);
      expect(opts[0].originalQty).toBe(10);
      expect(opts[0].remainingReturnableQty).toBe(10);
    });

    it('records a GOOD sales return, restoring available stock', async () => {
      const stockBefore = await getAvailableStockAtDate(merchandiseItemId, '2026-06-16');

      const ret = await createReturnLine({
        type: 'SALE_RETURN',
        returnDate: '2026-06-15',
        returnDocNo: 'RT-SAL-GOOD-01',
        partyId: clientId,
        invoiceKey: testSaleInvoiceKey,
        sourceSaleLineId: testSaleLineId,
        qty: 3,
        saleReturnCondition: 'GOOD',
        reason: 'طلب العميل تبديل الصنف وهو بحالة ممتازة',
      });

      expect(ret).toBeDefined();
      expect(Number(ret.qty)).toBe(3);
      expect(ret.saleReturnCondition).toBe('GOOD');

      const stockAfter = await getAvailableStockAtDate(merchandiseItemId, '2026-06-16');
      expect(stockAfter.minus(stockBefore).toNumber()).toBe(3);

      // Verify remaining returnable qty is now 7
      const opts = await getSourceLineOptions(testSaleInvoiceKey, 'SALE_RETURN', clientId);
      expect(opts[0].alreadyReturnedQty).toBe(3);
      expect(opts[0].remainingReturnableQty).toBe(7);
    });

    it('records a DAMAGED sales return, which does NOT restore available stock', async () => {
      const stockBefore = await getAvailableStockAtDate(merchandiseItemId, '2026-06-18');

      const ret = await createReturnLine({
        type: 'SALE_RETURN',
        returnDate: '2026-06-17',
        returnDocNo: 'RT-SAL-DAM-01',
        partyId: clientId,
        invoiceKey: testSaleInvoiceKey,
        sourceSaleLineId: testSaleLineId,
        qty: 2,
        saleReturnCondition: 'DAMAGED',
        reason: 'العبوة بها كسر وتسريب عند استلام العميل',
      });

      expect(ret).toBeDefined();
      expect(ret.saleReturnCondition).toBe('DAMAGED');

      // Stock should NOT increase because condition is DAMAGED
      const stockAfter = await getAvailableStockAtDate(merchandiseItemId, '2026-06-18');
      expect(stockAfter.minus(stockBefore).toNumber()).toBe(0);

      // Remaining returnable qty is now 10 - (3 + 2) = 5
      const opts = await getSourceLineOptions(testSaleInvoiceKey, 'SALE_RETURN', clientId);
      expect(opts[0].alreadyReturnedQty).toBe(5);
      expect(opts[0].remainingReturnableQty).toBe(5);
    });

    it('strictly enforces cumulative return ceiling (CumulativeCandidateQty <= OriginalQty)', async () => {
      // Remaining is 5. Attempting to return 6 must fail!
      await expect(
        createReturnLine({
          type: 'SALE_RETURN',
          returnDate: '2026-06-20',
          returnDocNo: 'RT-SAL-EXCESS',
          partyId: clientId,
          invoiceKey: testSaleInvoiceKey,
          sourceSaleLineId: testSaleLineId,
          qty: 6,
          saleReturnCondition: 'GOOD',
          reason: 'إرجاع كمية زائدة عن أصل الفاتورة',
        })
      ).rejects.toThrow(/يتجاوز الكمية الأصلية في الفاتورة/);
    });

    it('supports instant cash refund (CUSTOMER_REFUND in CashTransaction)', async () => {
      const cashBefore = await prisma.cashTransaction.count({
        where: { type: 'CUSTOMER_REFUND' },
      });

      const ret = await createReturnLine({
        type: 'SALE_RETURN',
        returnDate: '2026-06-22',
        returnDocNo: 'RT-SAL-REFUND-01',
        partyId: clientId,
        invoiceKey: testSaleInvoiceKey,
        sourceSaleLineId: testSaleLineId,
        qty: 1,
        saleReturnCondition: 'GOOD',
        reason: 'رد نقدي فوري للعميل باليد',
        refundCashNow: true,
        refundAccount: 'CASH',
      });

      expect(ret).toBeDefined();
      const cashAfter = await prisma.cashTransaction.count({
        where: { type: 'CUSTOMER_REFUND' },
      });
      expect(cashAfter).toBe(cashBefore + 1);

      const refundTx = await prisma.cashTransaction.findFirst({
        where: { invoiceKey: testSaleInvoiceKey, type: 'CUSTOMER_REFUND' },
        orderBy: { createdAt: 'desc' },
      });
      expect(refundTx).toBeDefined();
      expect(refundTx?.account).toBe('CASH');
      expect(Number(refundTx?.amount)).toBe(200); // 1 * 200 unit price
    });

    it('records a purchase return with supplier credit note and deducts stock', async () => {
      const purch = await createPurchaseInvoice({
        invoiceDate: '2026-07-01',
        invoiceNo: `PINV-RET-${Date.now()}`,
        supplierId: supplierId,
        lines: [
          {
            itemId: merchandiseItemId,
            qty: 10,
            unitCost: 100,
            landedCost: 0,
            discount: 0,
          },
        ],
      });

      const purchLines = await prisma.purchaseLine.findMany({ where: { invoiceId: purch.id } });
      expect(purchLines.length).toBe(1);
      testPurchaseLineId = purchLines[0].id;
      testPurchaseInvoiceKey = purch.invoiceKey;

      const stockBefore = await getAvailableStockAtDate(merchandiseItemId, '2026-07-06');

      const ret = await createReturnLine({
        type: 'PURCHASE_RETURN',
        returnDate: '2026-07-05',
        returnDocNo: 'RT-PUR-01',
        partyId: supplierId,
        invoiceKey: testPurchaseInvoiceKey,
        sourcePurchaseLineId: testPurchaseLineId,
        qty: 4,
        supplierCreditNote: 420, // custom credit note
        reason: 'صنف به عيب مصنعي وتم الاتفاق مع المورد على إشعار دائن بـ 420 ر.س',
      });

      expect(ret).toBeDefined();
      expect(Number(ret.supplierCreditNote)).toBe(420);

      // Stock must be reduced by 4
      const stockAfter = await getAvailableStockAtDate(merchandiseItemId, '2026-07-06');
      expect(stockBefore.minus(stockAfter).toNumber()).toBe(4);
    });

    it('allows voiding a return line with mandatory reason', async () => {
      const returns = await getReturnLines({ partyId: clientId });
      const target = returns.find((r) => r.status === 'POSTED' && r.returnDocNo.startsWith('RT-SAL-'));
      expect(target).toBeDefined();

      const voided = await voidReturnLine(target!.id, 'إلغاء المرتجع بناءً على طلب الإدارة');
      expect(voided.status).toBe('VOID');
      expect(voided.voidReason).toBe('إلغاء المرتجع بناءً على طلب الإدارة');
    });
  });

  // =========================================================================
  // 2. STOCK ISSUES TESTS (صرف المخزون: تستر، عينات، تالف)
  // =========================================================================
  describe('Stock Issues Module', () => {
    it('creates a TESTER stock issue with testerRef and reduces stock', async () => {
      const stockBefore = await getAvailableStockAtDate(merchandiseItemId, '2026-08-02');

      const issue = await createStockIssue({
        issueDate: '2026-08-01',
        type: 'TESTER',
        itemId: merchandiseItemId,
        qty: 2,
        testerRef: 'تستر واجهة المحل الرئيسية',
        reason: 'فتح عبوتين لتجربة الزبائن في المعرض',
      });

      expect(issue).toBeDefined();
      expect(issue.code).toMatch(/^IS\d{6}$/);
      expect(issue.type).toBe('TESTER');
      expect(issue.testerRef).toBe('تستر واجهة المحل الرئيسية');

      const stockAfter = await getAvailableStockAtDate(merchandiseItemId, '2026-08-02');
      expect(stockBefore.minus(stockAfter).toNumber()).toBe(2);
    });

    it('creates a DAMAGED stock issue and requires reason', async () => {
      // Missing reason should fail
      await expect(
        createStockIssue({
          issueDate: '2026-08-05',
          type: 'DAMAGED',
          itemId: merchandiseItemId,
          qty: 1,
          reason: '   ',
        })
      ).rejects.toThrow(/أدخل السبب أو المناسبة لصرف المخزون/);

      // Valid reason succeeds
      const issue = await createStockIssue({
        issueDate: '2026-08-05',
        type: 'DAMAGED',
        itemId: merchandiseItemId,
        qty: 1,
        reason: 'سقوط زجاجة العطر وانكسارها أثناء تنظيف الرف',
      });

      expect(issue).toBeDefined();
      expect(issue.type).toBe('DAMAGED');
    });

    it('enriches stock issues with unitCost and issueCost from costing engine', async () => {
      const list = await getStockIssues({ itemId: merchandiseItemId });
      expect(list.length).toBeGreaterThan(0);
      const first = list[0];
      expect(first.unitCost).toBeDefined();
      expect(first.issueCost).toBeDefined();
      expect(first.issueCost).toBeCloseTo(Number(first.qty) * first.unitCost, 2);
    });

    it('allows voiding a stock issue and restores stock', async () => {
      const issue = await createStockIssue({
        issueDate: '2026-08-10',
        type: 'SAMPLE',
        itemId: merchandiseItemId,
        qty: 3,
        reason: 'عينة للوفد الزائر',
      });

      const stockBeforeVoid = await getAvailableStockAtDate(merchandiseItemId, '2026-08-12');
      const voided = await voidStockIssue(issue.id, 'تم إلغاء الزيارة ولم تُسلَم العينات');
      expect(voided.status).toBe('VOID');

      const stockAfterVoid = await getAvailableStockAtDate(merchandiseItemId, '2026-08-12');
      expect(stockAfterVoid.minus(stockBeforeVoid).toNumber()).toBe(3);
    });
  });

  // =========================================================================
  // 3. INTEGRATED MANUFACTURING BATCH TESTS (دفعات التصنيع والتركيب المدمجة)
  // =========================================================================
  describe('Manufacturing Batches Module', () => {
    it('enforces HeaderValid: finished item MUST have role FINISHED', async () => {
      await expect(
        createProductionBatch({
          completionDate: '2026-09-01',
          finishedItemId: merchandiseItemId, // Role is MERCHANDISE, not FINISHED!
          producedQty: 5,
          materials: [{ rawItemId: rawItemId, consumedQty: 10 }],
        })
      ).rejects.toThrow(/المنتج الناتج في دفعة التصنيع يجب أن يكون بدَور منتج تام/);
    });

    it('enforces LineValid: raw materials MUST have role RAW', async () => {
      await expect(
        createProductionBatch({
          completionDate: '2026-09-01',
          finishedItemId: finishedItemId,
          producedQty: 5,
          materials: [{ rawItemId: merchandiseItemId, consumedQty: 2 }], // Role is MERCHANDISE, not RAW!
        })
      ).rejects.toThrow(/ليس مادة خام/);
    });

    it('enforces BatchPostedValid: requires at least 1 raw material', async () => {
      await expect(
        createProductionBatch({
          completionDate: '2026-09-01',
          finishedItemId: finishedItemId,
          producedQty: 5,
          materials: [],
        })
      ).rejects.toThrow(/يجب إضافة مادة خام واحدة على الأقل/);
    });

    it('creates a complete production batch, updating raw and finished stocks and computing finishedUnitCost', async () => {
      const rawStockBefore = await getAvailableStockAtDate(rawItemId, '2026-09-06');
      const finStockBefore = await getAvailableStockAtDate(finishedItemId, '2026-09-06');

      const batch = await createProductionBatch({
        completionDate: '2026-09-05',
        finishedItemId: finishedItemId,
        producedQty: 10,
        notes: 'دفعة تصنيع مسك وعنبر خاصة بفصل الخريف',
        materials: [
          {
            rawItemId: rawItemId,
            consumedQty: 20,
          },
        ],
      });

      expect(batch).toBeDefined();
      expect(batch.code).toMatch(/^B-\d+/);
      expect(batch.status).toBe('POSTED');

      // Verify stock movement:
      // Raw item stock decreases by 20
      const rawStockAfter = await getAvailableStockAtDate(rawItemId, '2026-09-06');
      expect(rawStockBefore.minus(rawStockAfter).toNumber()).toBe(20);

      // Finished item stock increases by 10
      const finStockAfter = await getAvailableStockAtDate(finishedItemId, '2026-09-06');
      expect(finStockAfter.minus(finStockBefore).toNumber()).toBe(10);

      // Verify batch enrichment in getProductionBatches
      const batchList = await getProductionBatches({ finishedItemId });
      const found = batchList.find((b) => b.id === batch.id);
      expect(found).toBeDefined();
      expect(found?.materials.length).toBe(1);
      expect(found?.totalMaterialsCost).toBeGreaterThan(0);
      expect(found?.finishedUnitCost).toBeGreaterThan(0);
      expect(found?.finishedUnitCost).toBeCloseTo(
        (found?.totalMaterialsCost || 0) / 10,
        2
      );
    });

    it('allows voiding a production batch and rolls back stock impacts', async () => {
      const rawStockBefore = await getAvailableStockAtDate(rawItemId, '2026-09-12');
      const finStockBefore = await getAvailableStockAtDate(finishedItemId, '2026-09-12');

      const batch = await createProductionBatch({
        completionDate: '2026-09-10',
        finishedItemId: finishedItemId,
        producedQty: 4,
        materials: [
          {
            rawItemId: rawItemId,
            consumedQty: 8,
          },
        ],
      });

      const voided = await voidProductionBatch(batch.id, 'خطأ في معايير التركيب وتم إلغاء الدفعة');
      expect(voided.status).toBe('VOID');

      // Stock after voiding should match initial state before this batch
      const rawStockAfter = await getAvailableStockAtDate(rawItemId, '2026-09-12');
      const finStockAfter = await getAvailableStockAtDate(finishedItemId, '2026-09-12');

      expect(rawStockAfter.toString()).toBe(rawStockBefore.toString());
      expect(finStockAfter.toString()).toBe(finStockBefore.toString());
    });
  });
});
