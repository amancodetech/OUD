import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { db, fixture, login, request, save } from './common.mjs';
// Diagnostic, not a replacement for the timed acceptance load test.
try {
  const f=await fixture();
  await db.item.update({where:{id:f.item.id},data:{openingQty:1000000,openingValue:1000000}});
  await db.$executeRaw`INSERT INTO "SaleInvoice" (id,"invoiceNo","invoiceYear","invoiceKey","invoiceDate","customerId","updatedAt") SELECT 'cap-s-'||g,'CAP-'||g,2026,'2026 | CAP-'||g,'2026-10-01'::date,${f.customer.id},NOW() FROM generate_series(1,100000) g`;
  await db.$executeRaw`INSERT INTO "SaleLine" (id,code,"invoiceId","itemId",qty,"unitPrice","netSaleAmount") SELECT 'cap-l-'||g||'-'||j,'CAP-L-'||g||'-'||j,'cap-s-'||g,${f.item.id},1,2,2 FROM generate_series(1,100000) g CROSS JOIN generate_series(1,3) j`;
  const cookie=await login(),samples=[];
  for(const [path,validate] of [
    ['/api/sales?page=1',d=>assert.equal(d.length,100)],
    ['/api/sales?page=1000',d=>assert.equal(d.length,100)],
    ['/api/sales?search=CAP-99999',d=>assert.ok(d.some(r=>r.invoiceNo==='CAP-99999'))],
    ['/api/parties?type=CLIENT',d=>assert.equal(Number(d.data.find(p=>p.id===f.customer.id).debtAsOf),600000)],
    ['/api/notifications',d=>assert.equal(typeof d.data.counts.total,'number')],
    ['/api/items',d=>assert.equal(Number(d.data.find(i=>i.id===f.item.id).availableQty),700000)],
    ['/api/inventory?asOfDate=2026-10-10',d=>assert.equal(d.totalInventoryValue,700000)],
    ['/api/reports/dashboard?startDate=2026-10-01&endDate=2026-10-10',d=>{assert.equal(d.cards.netSales,600000);assert.equal(d.cards.operatingProfit,300000);assert.equal(d.cards.inventoryValue,700000)}],
  ]) { const began=performance.now();const {data}=await request(path,{cookie});validate(data);samples.push({path,ms:performance.now()-began}); }
  await Promise.all(['/api/items','/api/notifications','/api/parties?type=CLIENT','/api/reports/dashboard?startDate=2026-10-01&endDate=2026-10-10'].map(path=>request(path,{cookie})));
  const began=performance.now();await request('/api/sales',{cookie,method:'POST',body:{invoiceDate:'2026-10-10',invoiceNo:'CAP-WRITE',customerId:f.customer.id,lines:[{itemId:f.item.id,qty:1,unitPrice:2}]},status:201});samples.push({path:'WRITE',ms:performance.now()-began});
  await save('capacity-smoke',{pass:true,invoices:100000,lines:300000,independentNetSales:600000,independentProfit:300000,independentInventory:700000,parallelBackgroundReads:true,samples,note:'Single-client diagnostics; not timed load acceptance.'});console.log('PASS 100k invoices / 300k lines, independent balances and bounded page lookup');
} catch(e) {await save('capacity-smoke',{pass:false,failure:e.message});throw e;}finally{await db.$disconnect()}
