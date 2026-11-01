import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as xlsx from 'xlsx';
import { db, login, content, save, base } from './common.mjs';
const { fixtureWorkbook } = await import('../../tests/fixtures/workbook.ts');
const checks=[];
let cookie;
function workbook({invalid=false,changed=false,precision=false,sign=''}={}){
  const wb=xlsx.read(fixtureWorkbook(),{type:'buffer'});
  xlsx.utils.sheet_add_aoa(wb.Sheets['الأسماء وبيانات الاتصال'],[['AC-EX-S','Acceptance Excel supplier','مورد','','','','','',0,0]],{origin:'A7'});
  xlsx.utils.sheet_add_aoa(wb.Sheets['الأسماء وبيانات الاتصال'],[['AC-EX-C','Acceptance Excel client','عميل','','','','','',0,0]],{origin:'A8'});
  xlsx.utils.sheet_add_aoa(wb.Sheets['الأصناف'],[['AC-EX-I',changed?'Changed Excel item':'Acceptance Excel item','عود طبيعي','جرام','بضاعة',0,20,200]],{origin:'A6'});
  xlsx.utils.sheet_add_aoa(wb.Sheets['المشتريات'],[['2026-10-01','AC-EX-P','AC-EX-S','AC-EX-I',precision?0.00001:10,precision?100000:10,0,0,'2026-10-15','AC-EX-PL']],{origin:'A6'});
  if(sign.startsWith('purchase')){
    const unit=sign==='purchase-unit'?-1:1,landed=sign==='purchase-landed'?-1:0,discount=sign==='purchase-discount'?-1:sign==='purchase-total'?2:0;
    xlsx.utils.sheet_add_aoa(wb.Sheets['المشتريات'],[['2026-10-01','AC-EX-P','AC-EX-S','AC-EX-I',1,unit,landed,discount,'2026-10-15','AC-EX-PL']],{origin:'A6'});
  }
  if(sign.startsWith('sale'))xlsx.utils.sheet_add_aoa(wb.Sheets['المبيعات'],[['2026-10-01','AC-EX-SALE','AC-EX-C','AC-EX-I',1,sign==='sale-price'?-1:1,sign==='sale-discount'?-1:2,'2026-10-15','بيع','','','AC-EX-SL']],{origin:'A6'});
  if(invalid)xlsx.utils.sheet_add_aoa(wb.Sheets['المشتريات'],[['2026-10-02','AC-EX-BAD','AC-EX-S','MISSING-ITEM',1,10,0,0,'2026-10-15','AC-EX-BAD-L']],{origin:'A7'});
  return xlsx.write(wb,{type:'buffer',bookType:'xlsx'});
}
async function upload(bytes,mode='preview',hash,status=200){
  const form=new FormData();form.append('file',new Blob([bytes]),'acceptance.xlsx');form.append('mode',mode);if(hash)form.append('fileHash',hash);
  const r=await fetch(base+'/api/settings/import',{method:'POST',headers:{Cookie:cookie,Origin:base},body:form});const text=await r.text();assert.equal(r.status,status,text.slice(0,500));return JSON.parse(text);
}
try{
  cookie=await login();
  const buffer=workbook();const preview=await upload(buffer);assert.equal(preview.preview,true);checks.push('valid preview');
  const before=await content();await upload(workbook({changed:true}),'apply',preview.fileHash,409);assert.deepEqual(await content(),before);checks.push('changed file rejected without mutation');
  const sub=workbook({precision:true});const subPreview=await upload(sub);await upload(sub,'apply',subPreview.fileHash,400);assert.deepEqual(await content(),before);checks.push('sub-storage precision rejects entire workbook without mutation');
  for(const sign of ['purchase-unit','purchase-landed','purchase-discount','purchase-total','sale-price','sale-discount','sale-total']){
    const bytes=workbook({sign});const preview=await upload(bytes);await upload(bytes,'apply',preview.fileHash,400);assert.deepEqual(await content(),before);checks.push(sign+' rejects entire workbook without mutation');
  }
  const bad=workbook({invalid:true});const badPreview=await upload(bad);await upload(bad,'apply',badPreview.fileHash,400);assert.deepEqual(await content(),before);checks.push('invalid middle row rolls back all tables/settings/audit/counters');
  const result=await upload(buffer,'apply',preview.fileHash);assert.equal(result.success,true);checks.push('valid apply');
  const item=await db.item.findUniqueOrThrow({where:{code:'AC-EX-I'}});assert.equal(item.name,'Acceptance Excel item');
  const invoice=await db.purchaseInvoice.findFirstOrThrow({where:{invoiceNo:'AC-EX-P'}});const line=await db.purchaseLine.findFirstOrThrow({where:{invoiceId:invoice.id}});assert.equal(line.qty.toString(),'10');assert.equal(line.lineTotalCost.toString(),'100');
  const beforeRepeat={items:await db.item.count(),purchases:await db.purchaseInvoice.count(),lines:await db.purchaseLine.count()};
  const again=await upload(buffer);await upload(buffer,'apply',again.fileHash);
  assert.deepEqual({items:await db.item.count(),purchases:await db.purchaseInvoice.count(),lines:await db.purchaseLine.count()},beforeRepeat);checks.push('reimport creates no duplicate source records');
  await save('import',{pass:true,checks,expectedPurchaseQty:10,actualPurchaseQty:Number(line.qty),expectedPurchaseAmount:100,actualPurchaseAmount:Number(line.lineTotalCost)});
  console.log('PASS Excel preview, changed-file protection, full rollback and repeat import');
}catch(e){await save('import',{checks,failure:e.message});throw e;}finally{await db.$disconnect();}
