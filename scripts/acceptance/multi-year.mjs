import { db, login, request, save, check, checks } from './common.mjs';
try {
  const cookie=await login(),item=await db.item.findUniqueOrThrow({where:{code:'AC001'}});
  const customer=await db.party.create({data:{code:'AC-YEAR',name:'Acceptance year boundary',type:'CLIENT'}});
  const get=async path=>(await request(path,{cookie})).data;
  const post=async(path,body)=>(await request(path,{method:'POST',cookie,body,status:201})).data;
  const opening=await get('/api/cash?summary=true&asOfDate=2026-11-30');
  const before=(await get('/api/inventory?asOfDate=2026-11-30')).items.find(i=>i.id===item.id).availableQty;
  const old=await post('/api/sales',{invoiceDate:'2026-12-20',invoiceNo:'AC-REPEAT',customerId:customer.id,paidNow:30,collectionAccount:'CASH',lines:[{itemId:item.id,qty:2,unitPrice:40}]});
  const quiet=(await get('/api/reports/dashboard?startDate=2027-01-01&endDate=2027-01-01')).cards;
  check('no January sales or profit before movements',[quiet.netSales,quiet.operatingProfit],[0,0]);
  check('cash carries across year boundary',quiet.cashBalance,opening.cashBalance+30);
  const inventory=await get('/api/inventory?asOfDate=2027-01-01');check('stock carries across year boundary',inventory.items.find(i=>i.id===item.id).availableQty,before-2);
  const newer=await post('/api/sales',{invoiceDate:'2027-01-05',invoiceNo:'AC-REPEAT',customerId:customer.id,lines:[{itemId:item.id,qty:1,unitPrice:60}]});
  check('same number receives year-specific invoice keys',[old.invoiceKey,newer.invoiceKey],['2026 | AC-REPEAT','2027 | AC-REPEAT']);
  await post('/api/cash',{txDate:'2027-01-10',type:'CUSTOMER_COLLECTION',account:'CASH',amount:50,partyId:customer.id,invoiceKey:old.invoiceKey});
  const oldDetail=await get(`/api/sales/${old.id}?asOfDate=2027-01-10`),newDetail=await get(`/api/sales/${newer.id}?asOfDate=2027-01-10`);
  check('January collection settles only old invoice',[oldDetail.signedAsOf,newDetail.signedAsOf],[0,60]);
  const january=(await get('/api/reports/dashboard?startDate=2027-01-01&endDate=2027-01-31')).cards;
  check('old collection is not new-year revenue',[january.netSales,january.netCOGS,january.operatingProfit],[60,10,50]);
  check('old collection increases carried cash',january.cashBalance,opening.cashBalance+80);
  await save('multi-year-http',{pass:true,checks});console.log('PASS real HTTP year carry, repeated invoice number and old-invoice collection');
}catch(e){await save('multi-year-http',{checks,failure:e.message});throw e;}finally{await db.$disconnect();}
