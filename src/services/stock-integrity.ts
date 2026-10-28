import { memoReadSnapshot } from '@/lib/snapshot-cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, zero } from '@/domain/decimal';
import { formatDate } from '@/domain/period';

export async function stockTimeline(itemIds?: string[]) {
  return memoReadSnapshot('stock:'+JSON.stringify(itemIds ? [...itemIds].sort() : null), async () => {
  // Aggregate exact numeric quantities in PostgreSQL. Memory grows with item/day
  // pairs rather than invoice line count; no relation-IN parameter explosion.
  const [items, rows] = await Promise.all([
    prisma.item.findMany({ where: itemIds ? { id: { in: itemIds } } : undefined, select: { id: true, name: true, openingQty: true } }),
    prisma.$queryRaw<{ itemId: string; day: Date; qty: Decimal }[]>`
      SELECT "itemId", day, SUM(qty) AS qty FROM (
        SELECT l."itemId", i."invoiceDate" AS day, l.qty
        FROM "PurchaseLine" l JOIN "PurchaseInvoice" i ON i.id = l."invoiceId"
        WHERE l.status = 'POSTED' AND i.status = 'POSTED'
        UNION ALL
        SELECT l."itemId", i."invoiceDate", -l.qty
        FROM "SaleLine" l JOIN "SaleInvoice" i ON i.id = l."invoiceId"
        WHERE l.status = 'POSTED' AND i.status = 'POSTED'
        UNION ALL
        SELECT l."itemId", r."returnDate", r.qty
        FROM "ReturnLine" r JOIN "SaleLine" l ON l.id = r."sourceSaleLineId"
        WHERE r.status = 'POSTED' AND r.type = 'SALE_RETURN' AND r."saleReturnCondition" = 'GOOD'
        UNION ALL
        SELECT l."itemId", r."returnDate", -r.qty
        FROM "ReturnLine" r JOIN "PurchaseLine" l ON l.id = r."sourcePurchaseLineId"
        WHERE r.status = 'POSTED' AND r.type = 'PURCHASE_RETURN'
        UNION ALL
        SELECT "itemId", "issueDate", -qty FROM "StockIssue" WHERE status = 'POSTED'
        UNION ALL
        SELECT "finishedItemId", "completionDate", "producedQty" FROM "ProductionBatch" WHERE status = 'POSTED'
        UNION ALL
        SELECT m."rawItemId", b."completionDate", -m."consumedQty"
        FROM "BatchMaterial" m JOIN "ProductionBatch" b ON b.id = m."batchId" WHERE b.status = 'POSTED'
      ) movements ${itemIds ? Prisma.sql`WHERE "itemId" = ANY(${itemIds}::text[])` : Prisma.empty}
      GROUP BY "itemId", day`,
  ]);
  const movements = new Map<string, Map<string, Decimal>>();
  for (const row of rows) {
    const days = movements.get(row.itemId) ?? new Map<string, Decimal>();
    days.set(formatDate(row.day), toDecimal(row.qty));
    movements.set(row.itemId, days);
  }
  return { items, movements };
  }, value => value.items.length + [...value.movements.values()].reduce((n,days)=>n+days.size,0) < 25000);
}

export async function stockQuantitiesAt(date: string, itemIds?: string[]): Promise<Map<string, Decimal>> {
  const { items, movements } = await stockTimeline(itemIds);
  return new Map(items.map(item => {
    let qty = toDecimal(item.openingQty);
    for (const [day, change] of movements.get(item.id) ?? []) if (day <= date) qty = qty.plus(change);
    return [item.id, qty];
  }));
}

export async function assertStockIntegrity() {
  const setting = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  if (setting?.allowNegativeStock) return;
  const { items, movements } = await stockTimeline();
  for (const item of items) {
    let qty = toDecimal(item.openingQty);
    if (qty.lt('-0.000000001')) throw new Error(`رصيد افتتاحي سالب للصنف ${item.name}`);
    for (const [day, change] of [...(movements.get(item.id) ?? [])].sort(([a], [b]) => a.localeCompare(b))) {
      qty = qty.plus(change);
      if (qty.lt('-0.000000001')) throw new Error(`العملية تسبب مخزونًا سالبًا للصنف ${item.name} بتاريخ ${day}`);
    }
  }
}
