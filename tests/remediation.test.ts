import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import * as xlsx from 'xlsx';
import { NextRequest } from 'next/server';
const jar = vi.hoisted(() => new Map<string,string>());
vi.mock('next/headers',()=>({cookies:()=>({get:(key:string)=>jar.has(key)?{value:jar.get(key)}:undefined,set:(key:string,value:string)=>jar.set(key,value),delete:(key:string)=>jar.delete(key)})}));
import { prisma, withLedgerTransaction } from '../src/lib/db';
import { assertTestDatabase } from '../src/lib/test-database';
import { createSession, getSession } from '../src/lib/auth';
import { createSaleInvoice, createDriverGiftDelivery, getAvailableStockAtDate } from '../src/services/sale.service';
import { createPurchaseInvoice, voidPurchaseInvoice } from '../src/services/purchase.service';
import { createProductionBatch } from '../src/services/batch.service';
import { createReturnLine, voidReturnLine } from '../src/services/return.service';
import { updateSystemSetting } from '../src/services/settings.service';
import { nextCashCode } from '../src/services/code-generator';
import { logAudit } from '../src/services/audit.service';
import { exportDatabase, restoreDatabase } from '../src/services/backup.service';
import { importExcelWorkbook } from '../src/services/excel-import.service';
import { GET as salesGET, POST as salesPOST } from '../src/app/api/sales/route';
import { POST as partiesPOST } from '../src/app/api/parties/route';
import { GET as inventoryGET } from '../src/app/api/inventory/route';
import { GET as itemsGET } from '../src/app/api/items/route';
import { consumeLoginAttempt } from '../src/lib/login-limit';
import { PATCH as updateUser } from '../src/app/api/users/[id]/route';
let categoryId:string,unitId:string,customer:any,supplier:any,driver:any,admin:any,counter=0;
const prefix='REG-'+Date.now();
const req=(path:string,body?:unknown)=>new NextRequest('http://localhost'+path,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function item(role:'MERCHANDISE'|'RAW'|'FINISHED'='MERCHANDISE',qty=10){const key=prefix+(++counter);return prisma.item.create({data:{code:key,name:key,categoryId,unitId,role,openingQty:qty,openingValue:qty*10}});}
async function sale(qty=1,paidNow=0,stock?:any,date='2026-10-20') {stock??=await item();const invoice=await createSaleInvoice({invoiceDate:date,invoiceNo:prefix+(++counter),customerId:customer.id,lines:[{itemId:stock.id,qty,unitPrice:100}],paidNow,collectionAccount:'CASH'});const line=await prisma.saleLine.findFirstOrThrow({where:{invoiceId:invoice.id}});return {invoice,line,stock};}
async function returned(invoice:any,line:any,refundCashNow=false){return createReturnLine({type:'SALE_RETURN',returnDate:'2026-10-21',returnDocNo:prefix+(++counter),partyId:customer.id,invoiceKey:invoice.invoiceKey,sourceSaleLineId:line.id,qty:1,saleReturnCondition:'GOOD',reason:'Regression return',refundCashNow,refundAccount:'CASH'});}
async function user(permissions:string[],role:'ADMIN'|'CASHIER'|'ACCOUNTANT'='CASHIER'){return prisma.user.create({data:{username:prefix+(++counter),displayName:'Regression',passwordHash:admin.passwordHash,role,permissions}});}

describe('remediation acceptance on disposable PostgreSQL',()=>{
 beforeAll(async()=>{await assertTestDatabase(prisma);categoryId=(await prisma.itemCategory.findFirstOrThrow()).id;unitId=(await prisma.unitOption.findFirstOrThrow()).id;admin=await prisma.user.findUniqueOrThrow({where:{username:'admin'}});
 customer=await prisma.party.create({data:{code:prefix+'C',name:prefix+'C',type:'CLIENT'}});supplier=await prisma.party.create({data:{code:prefix+'S',name:prefix+'S',type:'SUPPLIER'}});driver=await prisma.party.create({data:{code:prefix+'D',name:prefix+'D',type:'DRIVER',isDriverGiftEnabled:true}});});
 beforeEach(async()=>{jar.clear();await prisma.systemSetting.update({where:{id:1},data:{lockedThroughDate:null,allowNegativeStock:false}});});
 afterAll(()=>prisma.$disconnect());
 it('denies anonymous data reads and writes before database mutation',async()=>{
  const before=await prisma.party.count();expect((await salesGET(req('/api/sales'), {params:Promise.resolve({})})).status).toBe(401);
  expect((await partiesPOST(req('/api/parties',{name:prefix+'anonymous',type:'CLIENT',openingBalance:12345}), {params:Promise.resolve({})})).status).toBe(401);expect(await prisma.party.count()).toBe(before);
 });
 it('preserves the last active administrator',async()=>{
  await createSession({...admin});
  const response=await updateUser(req('/api/users/'+admin.id,{role:'CASHIER'}),{params:Promise.resolve({id:admin.id})});
  expect(response.status).toBe(400);expect((await prisma.user.findUniqueOrThrow({where:{id:admin.id}})).role).toBe('ADMIN');
 });
 it('enforces custom permissions and allows permitted sales',async()=>{
  const staff=await user(['drivers_manage']);await createSession({...staff,permissions:['drivers_manage']});const stock=await item();const body={invoiceDate:'2026-10-20',invoiceNo:prefix+(++counter),customerId:customer.id,lines:[{itemId:stock.id,qty:1,unitPrice:100}]};
  expect((await salesPOST(req('/api/sales',body), {params:Promise.resolve({})})).status).toBe(403);
  await prisma.user.update({where:{id:staff.id},data:{permissions:['sales_manage']}});
  expect((await salesPOST(req('/api/sales',body), {params:Promise.resolve({})})).status).toBe(201);
 });
 it('removes costs from the sales item lookup',async()=>{const staff=await user(['sales_manage']);await createSession({...staff,permissions:['sales_manage']});const response=await itemsGET(req('/api/items'), {params:Promise.resolve({})});expect(response.status).toBe(200);const body=await response.json();expect(body.data.length).toBeGreaterThan(0);for(const row of body.data){expect(row.openingValue).toBeUndefined();expect(row.monthlyAvgCost).toBeUndefined();expect(row.availableValue).toBeUndefined();}});
 it('rejects disabled users and revoked session versions',async()=>{
  const staff=await user([], 'ADMIN');await createSession({id:staff.id,username:staff.username,displayName:staff.displayName,role:staff.role,permissions:[]});await prisma.user.update({where:{id:staff.id},data:{isActive:false}});expect(await getSession()).toBeNull();
  await prisma.user.update({where:{id:staff.id},data:{isActive:true}});await createSession({id:staff.id,username:staff.username,displayName:staff.displayName,role:staff.role,permissions:[]});await prisma.user.update({where:{id:staff.id},data:{sessionVersion:{increment:1}}});expect(await getSession()).toBeNull();
 });
 it('rejects the former fallback signing key',async()=>{const b=Buffer.from(JSON.stringify({id:admin.id,role:'ADMIN',version:admin.sessionVersion,exp:Date.now()+60000})).toString('base64url');jar.set('auth_session',b+'.'+crypto.createHmac('sha256','oud-erp-super-secure-production-ready-secret-2026').update(b).digest('base64url'));expect(await getSession()).toBeNull();});
 it('limits concurrent login attempts using a shared database counter',async()=>{const attempts=await Promise.all(Array.from({length:12},()=>consumeLoginAttempt(prefix+'limit')));expect(attempts.filter(Boolean)).toHaveLength(10);});
 it('preserves period lock for unrelated updates and requires an unlock reason',async()=>{await prisma.systemSetting.update({where:{id:1},data:{lockedThroughDate:new Date('2026-10-25')}});await updateSystemSetting({storeName:'Regression store'});expect((await prisma.systemSetting.findUniqueOrThrow({where:{id:1}})).lockedThroughDate?.toISOString().slice(0,10)).toBe('2026-10-25');await expect(updateSystemSetting({lockedThroughDate:null})).rejects.toThrow();});
 it('rejects driver gifts in a locked period',async()=>{const stock=await item();await prisma.systemSetting.update({where:{id:1},data:{lockedThroughDate:new Date('2026-10-25')}});await expect(createDriverGiftDelivery({invoiceDate:'2026-10-20',driverId:driver.id,itemId:stock.id,qty:1,driverGiftSettlementValue:100})).rejects.toThrow();});
 it('rejects mismatched return party/invoice and void sources',async()=>{const {invoice,line}=await sale();await expect(createReturnLine({type:'SALE_RETURN',returnDate:'2026-10-21',returnDocNo:prefix+(++counter),partyId:customer.id,invoiceKey:'2026 | wrong',sourceSaleLineId:line.id,qty:1,saleReturnCondition:'GOOD',reason:'Mismatch'})).rejects.toThrow();await prisma.saleInvoice.update({where:{id:invoice.id},data:{status:'VOID'}});await expect(returned(invoice,line)).rejects.toThrow();});
 it('rejects unpaid cash refunds atomically, while permitting a credit-only return',async()=>{const {invoice,line}=await sale();const before=await prisma.returnLine.count();await expect(returned(invoice,line,true)).rejects.toThrow();expect(await prisma.returnLine.count()).toBe(before);expect(await prisma.cashTransaction.count({where:{invoiceKey:invoice.invoiceKey}})).toBe(0);expect((await returned(invoice,line)).status).toBe('POSTED');});
 it('posts eligible paid refunds and reverses both documents on void',async()=>{const {invoice,line}=await sale(1,100);const ret=await returned(invoice,line,true);expect((await prisma.cashTransaction.findUniqueOrThrow({where:{sourceReturnId:ret.id}})).status).toBe('POSTED');await voidReturnLine(ret.id,'Regression cancellation');expect((await prisma.cashTransaction.findUniqueOrThrow({where:{sourceReturnId:ret.id}})).status).toBe('VOID');});
 it('requires review of an unlinked legacy refund before voiding its return',async()=>{
  const {invoice,line}=await sale(1,100);const ret=await returned(invoice,line);
  await prisma.cashTransaction.create({data:{code:prefix+(++counter),txDate:new Date('2026-10-21'),type:'CUSTOMER_REFUND',account:'CASH',amount:100,partyId:customer.id,invoiceKey:invoice.invoiceKey,description:'رد نقدي فوري لمرتجع البيع '+ret.code}});
  await expect(voidReturnLine(ret.id,'Legacy refund review')).rejects.toThrow();expect((await prisma.returnLine.findUniqueOrThrow({where:{id:ret.id}})).status).toBe('POSTED');
 });
 it('checks total duplicate material demand',async()=>{const raw=await item('RAW'),finished=await item('FINISHED',0);await expect(createProductionBatch({completionDate:'2026-10-22',finishedItemId:finished.id,producedQty:1,materials:[{rawItemId:raw.id,consumedQty:6},{rawItemId:raw.id,consumedQty:6}]})).rejects.toThrow();expect((await getAvailableStockAtDate(raw.id,'2026-10-22')).toNumber()).toBe(10);});
 it('rejects a backdated sale that invalidates later stock',async()=>{const stock=await item();await sale(8,0,stock);await expect(sale(4,0,stock,'2026-10-10')).rejects.toThrow();expect((await getAvailableStockAtDate(stock.id,'2026-10-20')).toNumber()).toBe(2);});
 it('rejects concurrent overselling and atomically rolls back the losing operation',async()=>{const stock=await item();const outcomes=await Promise.allSettled([sale(7,0,stock),sale(7,0,stock)]);expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await getAvailableStockAtDate(stock.id,'2026-10-20')).toNumber()).toBe(3);});
 it('rejects voiding a consumed purchase or returning unavailable stock',async()=>{const stock=await item('MERCHANDISE',0);const invoice=await createPurchaseInvoice({invoiceDate:'2026-10-01',invoiceNo:prefix+(++counter),supplierId:supplier.id,lines:[{itemId:stock.id,qty:10,unitCost:10}]});const line=await prisma.purchaseLine.findFirstOrThrow({where:{invoiceId:invoice.id}});await sale(10,0,stock);await expect(voidPurchaseInvoice(invoice.id,'Regression cancel purchase')).rejects.toThrow();await expect(createReturnLine({type:'PURCHASE_RETURN',returnDate:'2026-10-21',returnDocNo:prefix+(++counter),partyId:supplier.id,invoiceKey:invoice.invoiceKey,sourcePurchaseLineId:line.id,qty:1,reason:'Regression supplier return'})).rejects.toThrow();});
 it('inventory as-of a day excludes later-month movements',async()=>{const {stock}=await sale();await createSession({...admin});const response=await inventoryGET(req('/api/inventory?asOfDate=2026-10-01'), {params:Promise.resolve({})});expect(response.status).toBe(200);const body=await response.json();expect(body.items.find((row:any)=>row.id===stock.id).availableQty).toBe(10);});
 it('reserves unique concurrent codes and audit shares rollback',async()=>{const codes=await Promise.all(Array.from({length:6},()=>nextCashCode()));expect(new Set(codes).size).toBe(6);const key=prefix+'rollback';await expect(withLedgerTransaction(async()=>{await logAudit({action:'CREATE',entityType:'Regression',entityCode:key});throw new Error('rollback');})).rejects.toThrow('rollback');expect(await prisma.auditLog.count({where:{entityCode:key}})).toBe(0);});
 it('rejects unrelated Excel without modifying settings',async()=>{const before=await prisma.systemSetting.findUnique({where:{id:1}});const w=xlsx.utils.book_new();xlsx.utils.book_append_sheet(w,xlsx.utils.aoa_to_sheet([['unrelated']]),'unrelated');await expect(importExcelWorkbook(xlsx.write(w,{type:'buffer',bookType:'xlsx'}))).rejects.toThrow();expect(await prisma.systemSetting.findUnique({where:{id:1}})).toEqual(before);});
 it('replays an idempotent save without a duplicate invoice and rejects changed payloads',async()=>{
  await createSession({...admin});const stock=await item();const body={invoiceDate:'2026-10-20',invoiceNo:prefix+(++counter),customerId:customer.id,lines:[{itemId:stock.id,qty:1,unitPrice:100}]};
  const send=(value:unknown)=>{const request=req('/api/sales',value);request.headers.set('Idempotency-Key','regression-stable-key');return salesPOST(request,{params:Promise.resolve({})});};
  const first=await send(body),again=await send(body);expect(first.status).toBe(201);expect(again.status).toBe(201);expect((await first.json()).id).toBe((await again.json()).id);
  expect((await send({...body,invoiceNo:prefix+(++counter)})).status).toBe(409);
 });
 it('full backup restores users, audits, relations and deletes later records atomically',async()=>{
  const backup=await exportDatabase();const audits=backup.data.auditLog.length;expect(backup.data.user.length).toBeGreaterThan(0);
  const extra=await prisma.party.create({data:{code:prefix+'extra',name:prefix+'extra',type:'CLIENT'}});
  await restoreDatabase(backup,'Regression restore approved');expect(await prisma.party.findUnique({where:{id:extra.id}})).toBeNull();expect(await prisma.auditLog.count()).toBe(audits+1);expect(await prisma.user.count()).toBe(backup.data.user.length);
  const invalid=structuredClone(backup);invalid.data.cashTransaction.push({id:prefix+'invalid',code:prefix+'invalid',txDate:'2026-10-20T00:00:00Z',type:'CUSTOMER_COLLECTION',account:'CASH',amount:'1',partyId:'missing-party',status:'POSTED'});
  const count=await prisma.party.count();await expect(restoreDatabase(invalid,'Regression invalid restore')).rejects.toThrow();expect(await prisma.party.count()).toBe(count);
 });
});
