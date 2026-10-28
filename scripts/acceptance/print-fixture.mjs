import { db, login, request, save } from './common.mjs';
try {
  const admin=await db.user.findUniqueOrThrow({where:{username:'accept_admin'}});
  await db.user.create({data:{username:'accept_print_cashier',displayName:'Print cashier',role:'CASHIER',permissions:['sales_manage'],passwordHash:admin.passwordHash}});
  const customer=await db.party.findUniqueOrThrow({where:{code:'AC-C'}}),item=await db.item.findUniqueOrThrow({where:{code:'AC001'}});
  const cookie=await login();
  const {data}=await request('/api/sales',{method:'POST',cookie,body:{invoiceDate:'2026-10-11',invoiceNo:'AC-PRINT-DISCOUNT',customerId:customer.id,paidNow:55,collectionAccount:'CASH',lines:[{itemId:item.id,qty:2,unitPrice:30,discount:5}]},status:201});
  await db.systemSetting.update({where:{id:1},data:{currencyCode:'USD',currencyLabel:'USD'}});
  await save('print-fixture',{invoiceId:data.id,invoiceNo:'AC-PRINT-DISCOUNT',qty:2,unitPrice:30,discount:5,expectedTotal:55,expectedPaid:55,expectedRemaining:0,currency:'USD',cashierPermissions:['sales_manage']});
}finally{await db.$disconnect();}
