import { beforeAll, afterAll, it, expect } from 'vitest';
import { prisma, withReadSnapshot } from '@/lib/db';
import { assertTestDatabase } from '@/lib/test-database';
import { loadAllLedgerData, loadCostingEngine, loadDashboardReportsEngine, loadReportsEngine } from '@/services/ledger-loader';
import { computeCostingEngine } from '@/domain/costing-engine';
import { reportBalanceSummary } from '@/services/report-balance-summary';
import { computeBalancesEngine } from '@/domain/balances-engine';
import { zero } from '@/domain/decimal';
const prefix='PROJ-'+Date.now();let customer:any,supplier:any,item:any;
beforeAll(async()=>{
 await assertTestDatabase(prisma);
 customer=await prisma.party.create({data:{code:prefix+'C',name:prefix+'C',type:'CLIENT',openingInvoice:100,openingPaid:25,openingBalance:75}});
 supplier=await prisma.party.create({data:{code:prefix+'P',name:prefix+'P',type:'SUPPLIER',openingBalance:-10}});
 item=await prisma.item.create({data:{code:prefix,name:prefix,categoryId:(await prisma.itemCategory.findFirstOrThrow()).id,unitId:(await prisma.unitOption.findFirstOrThrow()).id,openingQty:100,openingValue:1000}});
 const sale=async(no:string,date:string,amount:number,qty:number,status:'POSTED'|'VOID'='POSTED')=>prisma.saleInvoice.create({data:{invoiceNo:prefix+no,invoiceKey:'2026 | '+prefix+no,invoiceYear:2026,invoiceDate:new Date(date),customerId:customer.id,status,lines:{create:{code:prefix+no,itemId:item.id,qty,unitPrice:10,netSaleAmount:amount,status}}},include:{lines:true}});
 const original=await sale('A','2026-10-01',29,3);await sale('B','2026-10-02',10,1);await sale('F','2026-11-01',20,2);await sale('VOID','2026-10-01',500,50,'VOID');
 const buy=await prisma.purchaseInvoice.create({data:{invoiceNo:prefix,invoiceKey:'2026 | '+prefix,invoiceYear:2026,invoiceDate:new Date('2026-10-01'),supplierId:supplier.id,lines:{create:{code:prefix,itemId:item.id,qty:10,unitCost:10,lineTotalCost:100}}},include:{lines:true}});
 for(const [suffix,date,condition] of [['1','2026-10-03','GOOD'],['2','2026-11-02','DAMAGED']] as const)await prisma.returnLine.create({data:{code:prefix+suffix,returnDocNo:prefix+suffix,returnDate:new Date(date),type:'SALE_RETURN',partyId:customer.id,invoiceKey:original.invoiceKey,sourceSaleLineId:original.lines[0].id,qty:'0.5',saleReturnCondition:condition,reason:'projection regression'}});
 await prisma.returnLine.create({data:{code:prefix+'P',returnDocNo:prefix+'P',returnDate:new Date('2026-11-03'),type:'PURCHASE_RETURN',partyId:supplier.id,invoiceKey:buy.invoiceKey,sourcePurchaseLineId:buy.lines[0].id,qty:1,supplierCreditNote:5,reason:'projection regression'}});
 for(const [suffix,key,amount] of [['O','افتتاحي',5],['B','2026 | '+prefix+'B',30],['F','2026 | '+prefix+'F',5]] as const)await prisma.cashTransaction.create({data:{code:prefix+suffix,txDate:new Date('2026-10-02'),type:'CUSTOMER_COLLECTION',account:'CASH',amount,partyId:customer.id,invoiceKey:key}});
});
afterAll(async()=>{
 await prisma.returnLine.deleteMany({where:{partyId:{in:[customer.id,supplier.id]}}});await prisma.cashTransaction.deleteMany({where:{partyId:customer.id}});
 await prisma.saleInvoice.deleteMany({where:{customerId:customer.id}});await prisma.purchaseInvoice.deleteMany({where:{supplierId:supplier.id}});
 await prisma.item.delete({where:{id:item.id}});await prisma.party.deleteMany({where:{id:{in:[customer.id,supplier.id]}}});
});
it('batched costing reads preserve exact decimals and UTC dates in a non-UTC process',async()=>{
 const record=await prisma.item.create({data:{code:prefix+'JSON',name:prefix+'JSON',categoryId:item.categoryId,unitId:item.unitId,openingQty:'0.0001',openingValue:'900719925474.0993'}});
 const previousTimezone=process.env.TZ;process.env.TZ='Asia/Makassar';
 try {
  await withReadSnapshot(async()=>{
   const full=await loadAllLedgerData(),compact=await loadAllLedgerData(undefined,undefined,true);
   expect(compact.items.find(i=>i.id===record.id)?.openingValue.toString()).toBe('900719925474.0993');
   expect(compact.items.find(i=>i.id===record.id)?.openingQty.toString()).toBe('0.0001');
   const normalize=(values:any[])=>values.map(row=>JSON.parse(JSON.stringify(row))).sort((a,b)=>String(a.id??a.name).localeCompare(String(b.id??b.name)));
   for(const key of ['items','parties','assets','policies','returns','stockIssues','batches','cashTransactions','referrals','categories'] as const)expect(normalize(compact[key]),key).toEqual(normalize(full[key]));
   expect(compact.systemSetting).toEqual(full.systemSetting);
   for(const row of compact.sales)expect(row.invoiceDate).toMatch(/^2026-\d{2}-\d{2}$/);
  });
 }finally{if(previousTimezone===undefined)delete process.env.TZ;else process.env.TZ=previousTimezone;await prisma.item.delete({where:{id:record.id}});}
});
it.each(['2026-09-30','2026-10-02','2026-10-31','2026-11-30'])('summary projection matches the uncompressed reference at %s without netting debt and credit invoices',async end=>{
 const data=await loadAllLedgerData();const reference=computeBalancesEngine({...data,asOfDate:end});const summary=await reportBalanceSummary(data,end);
 for(const type of ['CLIENT','SUPPLIER'])for(const field of ['partyDebtAsOf','partyCreditAsOf'] as const){
  const expected=reference.partySummaries.filter(p=>p.partyType===type).reduce((sum,p)=>sum.plus(p[field]),zero());
  const actual=summary.partySummaries.filter(p=>p.partyType===type).reduce((sum,p)=>sum.plus(p[field]),zero());expect(actual.minus(expected).abs().lt('0.00000001')).toBe(true);
 }
 const full=await loadReportsEngine('2026-01-01',end,data,'period');const compact=await loadDashboardReportsEngine('2026-01-01',end);
 for(const [key,value] of Object.entries(full.cards))expect((compact.cards as any)[key].minus(value).abs().lt('0.00000001'),key).toBe(true);
 expect(JSON.parse(JSON.stringify(compact.monthlyComparison))).toEqual(JSON.parse(JSON.stringify(full.monthlyComparison)));
 const original=computeCostingEngine({...data,startYear:data.systemSetting.startYear});const aggregated=await loadCostingEngine();
 for(const row of data.items)for(let month=1;month<=12;month++)expect(JSON.parse(JSON.stringify(aggregated.getItemEndingState(row.id,month)))).toEqual(JSON.parse(JSON.stringify(original.getItemEndingState(row.id,month))));
});
it('bounded notifications skip paid invoices and announce that the due list is limited',async()=>{
 const {getSystemNotifications}=await import('@/services/notification.service');
 const docs=Array.from({length:402},(_,i)=>({id:prefix+'-due-'+i,invoiceNo:prefix+'-due-'+i,invoiceKey:'2026 | '+prefix+'-due-'+i,invoiceYear:2026,invoiceDate:new Date('2026-10-01'),dueDate:new Date(i<201?'2026-10-01':'2026-10-02'),customerId:customer.id}));
 await prisma.saleInvoice.createMany({data:docs});
 await prisma.saleLine.createMany({data:docs.map((d,i)=>({code:prefix+'-due-'+i,invoiceId:d.id,itemId:item.id,qty:'0.01',unitPrice:100,netSaleAmount:1}))});
 await prisma.cashTransaction.createMany({data:docs.slice(0,201).map((d,i)=>({code:prefix+'-paid-'+i,txDate:new Date('2026-10-01'),type:'CUSTOMER_COLLECTION',account:'CASH',amount:1,partyId:customer.id,invoiceKey:d.invoiceKey}))});
 const result=await getSystemNotifications('2026-11-30');
 const due=result.notifications.filter(n=>n.id.startsWith('overdue-sale-')||n.id.startsWith('due-purchase-'));
 expect(due.length).toBeLessThanOrEqual(200);expect(result.notifications.some(n=>n.id==='debt-alert-limit')).toBe(true);
 expect(due.some(n=>n.id.includes(prefix+'-due-201'))).toBe(true);
 for(const doc of docs.slice(0,201))expect(due.some(n=>n.id.endsWith(doc.invoiceKey))).toBe(false);
});
it('costing projection preserves individual driver gifts and their settlement value',async()=>{
 const driver=await prisma.party.create({data:{code:prefix+'D',name:prefix+'D',type:'DRIVER',isDriverGiftEnabled:true}});
 const gift=await prisma.saleInvoice.create({data:{invoiceNo:prefix+'G',invoiceKey:'2026 | '+prefix+'G',invoiceYear:2026,invoiceDate:new Date('2026-10-01'),lines:{create:{code:prefix+'G',itemId:item.id,lineType:'DRIVER_GIFT',driverId:driver.id,qty:'0.1',driverGiftSettlementValue:5}}},include:{lines:true}});
 try {
  const compact=await loadAllLedgerData(undefined,undefined,true);const row=compact.sales.find(s=>s.id===gift.lines[0].id);
  expect(row?.driverId).toBe(driver.id);expect(row?.driverGiftSettlementValue.toString()).toBe('5');
 }finally{await prisma.saleInvoice.delete({where:{id:gift.id}});await prisma.party.delete({where:{id:driver.id}});}
});
it('re-evaluates repeating-division residuals with the original engine at the exact 0.01 boundary',async()=>{
 const doc=await prisma.saleInvoice.create({data:{invoiceNo:prefix+'EPS',invoiceKey:'2026 | '+prefix+'EPS',invoiceYear:2026,invoiceDate:new Date('2026-10-01'),customerId:customer.id,lines:{create:{code:prefix+'EPS',itemId:item.id,qty:3,unitPrice:'0.6667',discount:'0.0001',netSaleAmount:2}}},include:{lines:true}});
 await prisma.returnLine.create({data:{code:prefix+'EPS',returnDocNo:prefix+'EPS',returnDate:new Date('2026-10-02'),type:'SALE_RETURN',partyId:customer.id,invoiceKey:doc.invoiceKey,sourceSaleLineId:doc.lines[0].id,qty:3,saleReturnCondition:'GOOD',reason:'epsilon boundary'}});
 const cash=await prisma.cashTransaction.create({data:{code:prefix+'EPS',txDate:new Date('2026-10-03'),type:'CUSTOMER_COLLECTION',account:'CASH',amount:'0.01',partyId:customer.id,invoiceKey:doc.invoiceKey}});
 for(const [amount,expected] of [['0.01','0'],['0.0101','0.0101']]){
  await prisma.cashTransaction.update({where:{id:cash.id},data:{amount}});
  const data=await loadAllLedgerData();const reference=computeBalancesEngine({...data,asOfDate:'2026-10-31'});const target=reference.invoiceItems.find(i=>i.invoiceKey===doc.invoiceKey)!;
  expect(target.invoiceCredit.toString()).toBe(expected);
  const summary=await reportBalanceSummary(data,'2026-10-31');
  expect(summary.partySummaries.find(p=>p.partyId===customer.id)!.partyCreditAsOf.toString()).toBe(reference.partySummaries.find(p=>p.partyId===customer.id)!.partyCreditAsOf.toString());
 }
});

it('preserves a real debt of0.01004 instead of rounding it into the tolerance',async()=>{
 const doc=await prisma.saleInvoice.create({data:{invoiceNo:prefix+'REAL',invoiceKey:'2026 | '+prefix+'REAL',invoiceYear:2026,invoiceDate:new Date('2026-10-01'),customerId:customer.id,lines:{create:{code:prefix+'REAL',itemId:item.id,qty:25,unitPrice:'0.04',netSaleAmount:1}}},include:{lines:true}});
 await prisma.returnLine.create({data:{code:prefix+'REAL',returnDocNo:prefix+'REAL',returnDate:new Date('2026-10-02'),type:'SALE_RETURN',partyId:customer.id,invoiceKey:doc.invoiceKey,sourceSaleLineId:doc.lines[0].id,qty:'24.749',saleReturnCondition:'GOOD',reason:'retain real debt'}});
 const data=await loadAllLedgerData();const reference=computeBalancesEngine({...data,asOfDate:'2026-10-31'});expect(reference.invoiceItems.find(i=>i.invoiceKey===doc.invoiceKey)!.invoiceDebt.toString()).toBe('0.01004');
 const summary=await reportBalanceSummary(data,'2026-10-31');expect(summary.partySummaries.find(p=>p.partyId===customer.id)!.partyDebtAsOf.toString()).toBe(reference.partySummaries.find(p=>p.partyId===customer.id)!.partyDebtAsOf.toString());
});
