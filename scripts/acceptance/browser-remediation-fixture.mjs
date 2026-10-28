import {db,fixture,save} from './common.mjs';
try{
 const f=await fixture();
 const invoices=Array.from({length:105},(_,i)=>({id:'final-ui-'+String(i).padStart(3,'0'),invoiceNo:i===104?'CAP-99999':'CAP-'+i,invoiceKey:'2026 | '+(i===104?'CAP-99999':'CAP-'+i),invoiceYear:2026,invoiceDate:new Date('2026-10-01'),customerId:f.customer.id}));
 await db.saleInvoice.createMany({data:invoices});
 await db.saleLine.createMany({data:invoices.map((row,i)=>({code:'FINAL-UI-'+i,invoiceId:row.id,itemId:f.item.id,qty:'0.0001',unitPrice:10000,netSaleAmount:1}))});
 await save('browser-remediation-fixture',{invoices:105,qtyPerInvoice:'0.0001',openingQty:10,totalSoldQty:'0.0105',synthetic:true});
}finally{await db.$disconnect()}
