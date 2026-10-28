import { withApiGuard } from '@/lib/api-guard';
import { todayInStore } from '@/domain/period';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loadCostingEngine } from '@/services/ledger-loader';
import { formatDate, getMonthIndex } from '@/domain/period';
import { toDecimal, zero, Decimal } from '@/domain/decimal';

export interface StockMovementItem {
  id: string;
  date: string;
  type: string;
  typeBadge: string;
  docCode: string;
  docUrl?: string;
  notes?: string | null;
  inQty: number;
  outQty: number;
  runningBalance: number;
  unitCost?: number;
  totalCost?: number;
}

async function handleGET(req: NextRequest, { params }: { params: { itemId: string } }) {
  try {
    const { itemId } = params;
    const asOfDate = req.nextUrl.searchParams.get('asOfDate') || todayInStore();

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { category: true, unit: true },
    });
    if (!item) {
      return NextResponse.json({ error: 'الصنف غير موجود' }, { status: 404 });
    }

    const setting = await prisma.systemSetting.findFirst();
    const startYear = setting?.startYear ?? 2026;
    const costing = await loadCostingEngine();

    let displayCode = item.customCode;
    if (!displayCode) {
      const numPart = item.code.replace(/^[A-Za-z_-]+/i, '');
      displayCode = numPart ? `${item.category.prefix}-${numPart}` : item.code;
    }

    // 1. Fetch all movements
    const [purchases, sales, saleReturns, purchaseReturns, stockIssues, batchMaterials, batchesProduced] =
      await Promise.all([
        prisma.purchaseLine.findMany({
          where: { itemId, status: 'POSTED', invoice: { status: 'POSTED' } },
          include: { invoice: { select: { invoiceDate: true, invoiceKey: true } } },
        }),
        prisma.saleLine.findMany({
          where: { itemId, status: 'POSTED', invoice: { status: 'POSTED' } },
          include: { invoice: { select: { invoiceDate: true, invoiceKey: true } } },
        }),
        prisma.returnLine.findMany({
          where: {
            type: 'SALE_RETURN',
            saleReturnCondition: 'GOOD',
            status: 'POSTED',
            sourceSaleLine: { itemId },
          },
          include: { sourceSaleLine: { select: { code: true } } },
        }),
        prisma.returnLine.findMany({
          where: {
            type: 'PURCHASE_RETURN',
            status: 'POSTED',
            sourcePurchaseLine: { itemId },
          },
          include: { sourcePurchaseLine: { select: { code: true } } },
        }),
        prisma.stockIssue.findMany({
          where: { itemId, status: 'POSTED' },
        }),
        prisma.batchMaterial.findMany({
          where: { rawItemId: itemId, batch: { status: 'POSTED' } },
          include: { batch: { select: { code: true, completionDate: true } } },
        }),
        prisma.productionBatch.findMany({
          where: { finishedItemId: itemId, status: 'POSTED' },
        }),
      ]);

    const rawMovements: Array<{
      id: string;
      date: string;
      type: string;
      typeBadge: string;
      docCode: string;
      docUrl?: string;
      notes?: string | null;
      inQty: Decimal;
      outQty: Decimal;
    }> = [];

    // 1. Opening Balance (if any)
    const opQty = toDecimal(item.openingQty);
    if (opQty.gt(0)) {
      rawMovements.push({
        id: `opening-${item.id}`,
        date: `${startYear}-01-01`,
        type: 'رصيد أول المدة',
        typeBadge: 'OPENING',
        docCode: 'افتتاحي',
        notes: 'الرصيد المعتمد عند تدشين النظام',
        inQty: opQty,
        outQty: zero(),
      });
    }

    // 2. Purchases
    for (const p of purchases) {
      rawMovements.push({
        id: `p-${p.id}`,
        date: formatDate(p.invoice.invoiceDate),
        type: 'فاتورة شراء',
        typeBadge: 'PURCHASE',
        docCode: p.invoice.invoiceKey,
        docUrl: `/purchases/${p.invoiceId}`,
        notes: `سطر شراء ${p.code}`,
        inQty: toDecimal(p.qty),
        outQty: zero(),
      });
    }

    // 3. Sales
    for (const s of sales) {
      rawMovements.push({
        id: `s-${s.id}`,
        date: formatDate(s.invoice.invoiceDate),
        type: s.lineType === 'DRIVER_GIFT' ? 'تسليم هدية سائق' : 'فاتورة بيع',
        typeBadge: s.lineType === 'DRIVER_GIFT' ? 'DRIVER_GIFT' : 'SALE',
        docCode: s.invoice.invoiceKey,
        docUrl: `/sales/${s.invoiceId}`,
        notes: `سطر بيع ${s.code}`,
        inQty: zero(),
        outQty: toDecimal(s.qty),
      });
    }

    // 4. Good Sale Returns
    for (const sr of saleReturns) {
      rawMovements.push({
        id: `sr-${sr.id}`,
        date: formatDate(sr.returnDate),
        type: 'مرتجع بيع صالح',
        typeBadge: 'SALE_RETURN',
        docCode: sr.code,
        notes: `سبب: ${sr.reason}`,
        inQty: toDecimal(sr.qty),
        outQty: zero(),
      });
    }

    // 5. Purchase Returns
    for (const pr of purchaseReturns) {
      rawMovements.push({
        id: `pr-${pr.id}`,
        date: formatDate(pr.returnDate),
        type: 'مرتجع شراء إلى مورد',
        typeBadge: 'PURCHASE_RETURN',
        docCode: pr.code,
        notes: `سبب: ${pr.reason}`,
        inQty: zero(),
        outQty: toDecimal(pr.qty),
      });
    }

    // 6. Stock Issues
    for (const iss of stockIssues) {
      rawMovements.push({
        id: `iss-${iss.id}`,
        date: formatDate(iss.issueDate),
        type:
          iss.type === 'TESTER'
            ? 'تستر مستهلك'
            : iss.type === 'SAMPLE'
            ? 'عينة عميل'
            : 'تالف بالمحل',
        typeBadge: iss.type,
        docCode: iss.code,
        notes: iss.reason,
        inQty: zero(),
        outQty: toDecimal(iss.qty),
      });
    }

    // 7. Consumed in Batches (for raw items)
    for (const bm of batchMaterials) {
      rawMovements.push({
        id: `bm-${bm.id}`,
        date: formatDate(bm.batch.completionDate),
        type: 'استهلاك خام في تصنيع',
        typeBadge: 'BATCH_MATERIAL',
        docCode: bm.batch.code,
        notes: `مستهلك في دفعة ${bm.batch.code}`,
        inQty: zero(),
        outQty: toDecimal(bm.consumedQty),
      });
    }

    // 8. Produced Finished Batches (for finished items)
    for (const b of batchesProduced) {
      rawMovements.push({
        id: `b-${b.id}`,
        date: formatDate(b.completionDate),
        type: 'إنتاج دفعة منتج تام',
        typeBadge: 'BATCH_FINISHED',
        docCode: b.code,
        notes: b.notes || 'اكتمال دفعة تصنيع',
        inQty: toDecimal(b.producedQty),
        outQty: zero(),
      });
    }

    // Sort chronologically
    rawMovements.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    // Compute running balance
    let runningQty = zero();
    const finalMovements: StockMovementItem[] = [];

    for (const m of rawMovements) {
      runningQty = runningQty.plus(m.inQty).minus(m.outQty);
      finalMovements.push({
        id: m.id,
        date: m.date,
        type: m.type,
        typeBadge: m.typeBadge,
        docCode: m.docCode,
        docUrl: m.docUrl,
        notes: m.notes,
        inQty: m.inQty.toNumber(),
        outQty: m.outQty.toNumber(),
        runningBalance: runningQty.toNumber(),
      });
    }

    const state = costing.getItemEndingState(item.id, getMonthIndex(asOfDate, startYear));
    const visibleMovements = finalMovements.filter(movement => movement.date <= asOfDate);
    const quantity = visibleMovements.at(-1)?.runningBalance ?? 0;

    return NextResponse.json({
      item: {
        id: item.id,
        code: item.code,
        displayCode,
        name: item.name,
        nameEn: item.nameEn,
        role: item.role,
        categoryName: item.category.name,
        unitName: item.unit.name,
        reorderLevel: Number(item.reorderLevel),
        currentAvailable: quantity,
        currentAvgCost: state.AVG.toNumber(),
        currentTotalValue: state.AVG.times(quantity).toNumber(),
      },
      asOfDate,
      movements: visibleMovements,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء تحميل كارت حركة الصنف' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/inventory/[itemId]/card', handleGET);
