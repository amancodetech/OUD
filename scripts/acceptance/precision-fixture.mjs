import { db, login, request, save } from './common.mjs';
try {
  const cookie=await login(),customer=await db.party.findUniqueOrThrow({where:{code:'AC-C'}}),item=await db.item.findUniqueOrThrow({where:{code:'AC001'}});
  const {data}=await request('/api/sales',{method:'POST',cookie,body:{invoiceDate:'2026-10-22',invoiceNo:'AC-PRECISION',customerId:customer.id,lines:[{itemId:item.id,qty:'0.0001',unitPrice:10000}]},status:201});
  const line=await db.saleLine.findFirstOrThrow({where:{invoiceId:data.id}});
  if(line.qty.toString()!=='0.0001'||line.netSaleAmount.toString()!=='1')throw Error('Precision fixture storage mismatch');
  await save('precision-fixture',{invoiceId:data.id,qty:line.qty.toString(),unitPrice:line.unitPrice.toString(),amount:line.netSaleAmount.toString(),currency:'USD'});
}finally{await db.$disconnect();}
