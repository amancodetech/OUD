import assert from 'node:assert/strict';
import { db, save, identity } from './common.mjs';
try {
  const name=await identity();assert.ok(name.endsWith('_perf'));
  const rows=await db.$queryRaw`
    SELECT (SELECT COUNT(*) FROM "SaleInvoice")::int AS invoices,
      (SELECT COUNT(*) FROM "SaleLine")::int AS lines,
      (SELECT COUNT(*) FROM "SaleInvoice" i WHERE NOT EXISTS (SELECT 1 FROM "SaleLine" l WHERE l."invoiceId"=i.id))::int AS empty_invoices,
      (SELECT COUNT(*) FROM "SaleLine" WHERE qty<=0 OR "netSaleAmount"<>qty*"unitPrice"-discount)::int AS invalid_lines,
      (SELECT SUM("netSaleAmount") FROM "SaleLine")::text AS sales,
      (SELECT SUM(qty) FROM "SaleLine")::text AS cost_at_one,
      (SELECT COUNT(*) FROM "Item" i WHERE i."openingQty" < COALESCE((SELECT SUM(l.qty) FROM "SaleLine" l WHERE l."itemId"=i.id),0))::int AS oversold_items`;
  const r=rows[0];assert.equal(r.empty_invoices,0);assert.equal(r.invalid_lines,0);assert.equal(r.oversold_items,0);
  const receipts=await db.$queryRaw`SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "entityType"='RequestReceipt'`;
  const saved=await db.$queryRaw`SELECT COUNT(*)::int AS count FROM "SaleInvoice" WHERE "invoiceNo" LIKE 'PERF-WRITE-%'`;
  assert.equal(receipts[0].count,saved[0].count);
  await save('growth-persistence',{pass:true,database:name,...r,successfulRetriedWrites:saved[0].count,matchingReceipts:receipts[0].count,scope:'Committed rows and arithmetic only; application reports failed at this data volume. Full growth acceptance is failed.'});
  console.log('PASS committed data remains complete after aborted load; growth reporting remains failed');
}finally{await db.$disconnect();}
