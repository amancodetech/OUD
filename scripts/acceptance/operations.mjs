import { db, fixture, login, request, check, checks, save, content } from './common.mjs';
try {
  const f=await fixture(),cookie=await login();
  const post=async(path,body,status=201)=>(await request(path,{method:'POST',body,cookie,status})).data;
  const funder=await db.party.create({data:{code:'AC-F',name:'Acceptance funder',type:'FUNDER'}});
  const asset=await db.fixedAsset.create({data:{code:'AC-ASSET',name:'Acceptance asset',submittedValue:0}});
  const raw=await db.item.create({data:{code:'AC-RAW',name:'Acceptance raw',role:'RAW',categoryId:f.category.id,unitId:f.unit.id,openingQty:10,openingValue:100}});
  const fin=await db.item.create({data:{code:'AC-FIN',name:'Acceptance finished',role:'FINISHED',categoryId:f.category.id,unitId:f.unit.id}});
  const driver=await db.party.create({data:{code:'AC-D',name:'Acceptance driver',type:'DRIVER',isDriverGiftEnabled:true}});
  const tx=async(type,amount,account='BANK',extra={})=>post('/api/cash',{txDate:'2026-10-01',type,amount,account,...extra});
  await tx('PARTNER_CONTRIBUTION',100,'BANK',{partyId:f.partner.id});
  await tx('PARTNER_DRAWING',20,'CASH',{partyId:f.partner.id});
  await tx('PROFIT_DISTRIBUTION',5,'CASH',{partyId:f.partner.id});
  await tx('OWNER_BROTHER_FINANCING',50,'BANK',{partyId:funder.id});
  await tx('OWNER_BROTHER_REPAYMENT',10,'BANK',{partyId:funder.id});
  await tx('ASSET_PURCHASE',15,'BANK',{assetId:asset.id});
  await tx('INTERNAL_TRANSFER',25,'CASH',{transferToAccount:'BANK'});
  await tx('LOAN_RECEIVED',40);await tx('LOAN_REPAYMENT',15);
  const cards=(await request('/api/reports/dashboard?startDate=2026-01-01&endDate=2026-10-31',{cookie})).data.cards;
  check('partner/funder/asset/loan/transfer cash flows',[cards.cashBalance,cards.bankBalance,cards.cashAndBankTotal,cards.operatingProfit],[950,2175,3125,0]);
  const cash=(await request('/api/cash',{cookie})).data;
  check('all nine cash documents stored',cash.length,9);
  check('asset purchase linked',cash.find(t=>t.type==='ASSET_PURCHASE').assetId,asset.id);
  const summary=(await request('/api/partners-summary?asOfDate=2026-10-31',{cookie})).data;
  await save('operations-summary',summary);
  const salesBody={invoiceDate:'2026-10-05',invoiceNo:'AC-LOCK-SALE',customerId:f.customer.id,lines:[{itemId:f.item.id,qty:1,unitPrice:30}]};
  const sale=await post('/api/sales',salesBody);const line=await db.saleLine.findFirstOrThrow({where:{invoiceId:sale.id}});
  const ret={type:'SALE_RETURN',returnDate:'2026-10-06',returnDocNo:'AC-LOCK-RET',partyId:f.customer.id,invoiceKey:sale.invoiceKey,sourceSaleLineId:line.id,qty:1,saleReturnCondition:'GOOD',reason:'Acceptance locked return'};
  await db.systemSetting.update({where:{id:1},data:{lockedThroughDate:new Date('2026-10-10')}});
  const before=await content();
  for(const [path,body] of [
    ['/api/sales',{...salesBody,invoiceNo:'AC-LOCK-DENIED'}],
    ['/api/purchases',{invoiceDate:'2026-10-05',invoiceNo:'AC-LOCK-BUY',supplierId:f.supplier.id,lines:[{itemId:f.item.id,qty:1,unitCost:1}]}],
    ['/api/cash',{txDate:'2026-10-05',type:'CASH_EXPENSE',account:'CASH',amount:1}],
    ['/api/returns',ret],
    ['/api/stock-issues',{issueDate:'2026-10-05',type:'SAMPLE',itemId:f.item.id,qty:1,reason:'Acceptance locked sample'}],
    ['/api/manufacturing',{completionDate:'2026-10-05',finishedItemId:fin.id,producedQty:1,materials:[{rawItemId:raw.id,consumedQty:1}]}],
    ['/api/drivers/referrals',{visitDate:'2026-10-05',driverId:driver.id,visitorUniqueKey:'AC-LOCK-VISIT',visitorName:'Locked visit'}],
    [`/api/sales/${sale.id}/void`,{reason:'Acceptance blocked cancellation'}],
  ]){await post(path,body,400);checks.push({name:'locked period '+path,pass:true});}
  check('locked attempts leave every table unchanged',await content(),before);
  await db.systemSetting.update({where:{id:1},data:{lockedThroughDate:null}});
  const small=await db.item.create({data:{code:'AC-LAST',name:'Acceptance last stock',categoryId:f.category.id,unitId:f.unit.id,openingQty:1,openingValue:10}});
  const attempts=await Promise.all(Array.from({length:5},(_,i)=>fetch(process.env.APP_URL+'/api/sales',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:process.env.APP_URL},body:JSON.stringify({...salesBody,invoiceNo:'AC-LAST-'+i,lines:[{itemId:small.id,qty:1,unitPrice:30}]})})));
  check('five concurrent buyers of the last unit',attempts.map(r=>r.status).sort(),[201,400,400,400,400]);
  check('one sale line consumes the last unit',await db.saleLine.count({where:{itemId:small.id}}),1);
  await save('operations',{pass:true,checks:checks.map(c=>c.name==='locked attempts leave every table unchanged'?{name:c.name,pass:true,tableCount:Object.keys(before).length}:c)});
  console.log('PASS cash classifications, locked periods, full rollback and concurrent last-unit purchase');
}catch(e){await save('operations',{checks:checks.map(c=>({name:c.name,pass:c.pass})),failure:e.message});throw e;}finally{await db.$disconnect();}
