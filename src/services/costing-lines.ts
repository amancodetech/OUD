import type { PurchaseLine, SaleLine } from '@prisma/client';
import { prisma } from '@/lib/db';
type Purchase = PurchaseLine & { invoiceKey: string; invoiceNo: string; invoiceDate: Date; dueDate: Date | null; supplierId: string };
type Sale = SaleLine & { invoiceKey: string; invoiceNo: string; invoiceDate: Date; dueDate: Date | null; customerId: string | null };
// Costing needs item/day quantities and amounts. Preserve every returned source
// individually so same/prior-month return costing keeps its original semantics.
export function costingPurchases() {
  return prisma.$queryRaw<Purchase[]>`
    WITH posted AS NOT MATERIALIZED (
      SELECT l.*, i."invoiceDate" FROM "PurchaseLine" l JOIN "PurchaseInvoice" i ON i.id=l."invoiceId"
      WHERE l.status='POSTED' AND i.status='POSTED'
    ), referenced AS (SELECT DISTINCT "sourcePurchaseLineId" AS id FROM "ReturnLine" WHERE status='POSTED' AND "sourcePurchaseLineId" IS NOT NULL)
    SELECT MIN(p.id) AS id, '' AS code, '' AS "invoiceId", p."itemId", SUM(p.qty) AS qty,
      0::numeric AS "unitCost", 0::numeric AS "landedCost", 0::numeric AS discount, SUM(p."lineTotalCost") AS "lineTotalCost",
      'POSTED' AS status, '' AS "invoiceKey", '' AS "invoiceNo", p."invoiceDate", NULL::date AS "dueDate", '' AS "supplierId"
    FROM posted p WHERE NOT EXISTS(SELECT 1 FROM referenced r WHERE r.id=p.id) GROUP BY p."itemId", p."invoiceDate"
    UNION ALL
    SELECT p.id,p.code,p."invoiceId",p."itemId",p.qty,p."unitCost",p."landedCost",p.discount,p."lineTotalCost",p.status::text,'','',p."invoiceDate",NULL::date,''
    FROM posted p WHERE EXISTS(SELECT 1 FROM referenced r WHERE r.id=p.id)`;
}
export function costingSales() {
  return prisma.$queryRaw<Sale[]>`
    WITH posted AS NOT MATERIALIZED (
      SELECT l.*, i."invoiceDate" FROM "SaleLine" l JOIN "SaleInvoice" i ON i.id=l."invoiceId"
      WHERE l.status='POSTED' AND i.status='POSTED'
    ), referenced AS (SELECT DISTINCT "sourceSaleLineId" AS id FROM "ReturnLine" WHERE status='POSTED' AND "sourceSaleLineId" IS NOT NULL UNION SELECT id FROM posted WHERE "lineType"='DRIVER_GIFT')
    SELECT MIN(p.id) AS id, '' AS code, '' AS "invoiceId", p."lineType"::text AS "lineType", p."itemId", SUM(p.qty) AS qty,
      0::numeric AS "unitPrice", 0::numeric AS discount, SUM(p."netSaleAmount") AS "netSaleAmount", NULL::text AS "driverId",
      0::numeric AS "driverGiftSettlementValue", 'POSTED' AS status, '' AS "invoiceKey", '' AS "invoiceNo", p."invoiceDate", NULL::date AS "dueDate", NULL::text AS "customerId"
    FROM posted p WHERE NOT EXISTS(SELECT 1 FROM referenced r WHERE r.id=p.id) GROUP BY p."itemId",p."invoiceDate",p."lineType"
    UNION ALL
    SELECT p.id,p.code,p."invoiceId",p."lineType"::text,p."itemId",p.qty,p."unitPrice",p.discount,p."netSaleAmount",p."driverId",p."driverGiftSettlementValue",p.status::text,'','',p."invoiceDate",NULL::date,NULL::text
    FROM posted p WHERE EXISTS(SELECT 1 FROM referenced r WHERE r.id=p.id)`;
}
