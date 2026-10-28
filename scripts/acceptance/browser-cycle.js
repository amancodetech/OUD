async page => {
  const base='http://127.0.0.1:3107';const checks=await page.evaluate(()=>JSON.parse(localStorage.getItem('acceptance-browser-financial')||'[]'));const done=step=>checks.some(c=>c.step===step);
  async function get(path){const r=await page.evaluate(async path=>{const r=await fetch(path);return {ok:r.ok,status:r.status,data:await r.json()};},path);if(!r.ok)throw Error(path+' '+r.status);return r.data;}
  async function verify(step,expected){const c=(await get('/api/reports/dashboard?startDate=2026-01-01&endDate=2026-10-31')).cards;const inv=await get('/api/inventory?asOfDate=2026-10-31');const item=inv.items.find(i=>i.code==='AC001');const actual=[item.availableQty,c.cashBalance,c.bankBalance,c.clientDebtTotal,c.supplierDebtTotal,c.operatingProfit];if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(step+JSON.stringify({actual,expected}));const expectedValue=expected[0]*10;if(item.availableValue!==expectedValue||inv.totalInventoryValue!==expectedValue||c.inventoryValue!==expectedValue)throw Error(step+' inventory value mismatch');checks.push({step,actual,expected,inventory:{expected:expectedValue,item:item.availableValue,total:inv.totalInventoryValue,dashboard:c.inventoryValue}});await page.evaluate(data=>localStorage.setItem('acceptance-browser-financial',JSON.stringify(data)),checks);}
  async function choose(placeholder,label){await page.getByRole('button',{name:placeholder,exact:true}).click();await page.getByRole('button',{name:label,exact:false}).last().click();}
  async function save(path,button,status=201){const pending=page.waitForResponse(r=>r.url()===base+path&&r.request().method()==='POST');await button.click();const r=await pending;if(r.status()!==status)throw Error('save '+await r.text());return r.json();}
  async function cash(type,date,amount,account='CASH'){
    await page.goto(base+'/cash');await page.getByRole('button',{name:type==='SUPPLIER_PAYMENT'?'- سداد مورد':type==='CASH_EXPENSE'?'- تسجيل مصروف نقدي':'+ تحصيل عميل',exact:true}).click();
    const form=page.locator('form');await form.locator('input[type=date]').fill(date);
    if(type!=='CASH_EXPENSE'){
      await choose(type==='SUPPLIER_PAYMENT'?'اختر المورد...':'اختر العميل...',type==='SUPPLIER_PAYMENT'?'AC-S | Acceptance supplier':'AC-C | Acceptance customer');
      await form.locator('select').nth(1).selectOption(type==='SUPPLIER_PAYMENT'?'2026 | AC-BUY':'2026 | AC-SALE');
    }
    if(account==='BANK')await form.getByRole('button',{name:'تحويل (البنك)',exact:true}).click();
    await form.getByPlaceholder('0',{exact:true}).fill(String(amount));
    await save('/api/cash',form.locator('button[type=submit]'));
    await form.waitFor({state:'detached'});
  }
  if(done('purchase')&&!done('supplier payment')){
    for(const [step,date,value]of [['opening','2026-09-30',100],['purchase','2026-10-01',300]]){
      const inv=await get('/api/inventory?asOfDate='+date),cards=(await get('/api/reports/dashboard?startDate=2026-01-01&endDate='+date)).cards;
      const actual=inv.items.find(i=>i.code==='AC001').availableValue;if(actual!==value||inv.totalInventoryValue!==value||cards.inventoryValue!==value)throw Error(step+' independent inventory mismatch');
      checks.find(c=>c.step===step).inventory={expected:value,item:actual,total:inv.totalInventoryValue,dashboard:cards.inventoryValue};
    }
  }
  if(!done('supplier payment')){if(!done('purchase'))await verify('purchase',[30,1000,2000,0,200,0]);
  await cash('SUPPLIER_PAYMENT','2026-10-02',120,'BANK');await verify('supplier payment',[30,1000,1880,0,80,0]);}
  let sale;
  if(!done('partial cash sale')){
  await page.goto(base+'/sales/new');await choose('اختر العميل...','AC-C | Acceptance customer');await page.getByPlaceholder('مثال: S-1001').fill('AC-SALE');await page.locator('input[type=date]').first().fill('2026-10-03');await choose('اختر الصنف المباع...','AC001 | Acceptance item');
  const row=page.locator('tbody tr').first();await row.locator('input').nth(1).fill('5');await row.locator('input').nth(2).fill('30');await page.getByRole('button',{name:'دفعة جزئية',exact:true}).click();await page.locator('form input[placeholder="0"]').last().fill('100');
  sale=await save('/api/sales',page.getByRole('button',{name:'حفظ الفاتورة',exact:true}));await page.waitForURL(base+'/sales');await verify('partial cash sale',[25,1100,1880,50,80,100]);
  }else{sale=(await get('/api/sales')).find(s=>s.invoiceNo==='AC-SALE');}
  async function returned(type,date,doc,qty,refund=false){
    await page.goto(base+'/returns/new');if(type==='PURCHASE_RETURN')await page.getByRole('button',{name:/مرتجع شراء/}).click();
    await choose(type==='SALE_RETURN'?'اختر العميل...':'اختر المورد...',type==='SALE_RETURN'?'Acceptance customer':'Acceptance supplier');
    await page.locator('select').first().selectOption(type==='SALE_RETURN'?'2026 | AC-SALE':'2026 | AC-BUY');await page.locator('input[name=sourceLine]').first().check();
    await page.locator('input[type=date]').fill(date);await page.getByPlaceholder('مثال: RT-001').fill(doc);
    await page.locator('input[inputmode=decimal]').first().fill(String(qty));
    await page.getByPlaceholder('مثال: الصنف غير مطابق للمواصفات المطلوبة').fill('Acceptance browser return');
    if(refund)await page.locator('input[type=checkbox]').check();
    const ret=await save('/api/returns',page.getByRole('button',{name:'حفظ وترحيل المرتجع',exact:true}));await page.waitForURL(base+'/returns');return ret;
  }
  if(!done('credit return')){await returned('SALE_RETURN','2026-10-04','AC-RET-1',1);await verify('credit return',[26,1100,1880,20,80,80]);}
  if(!done('remaining collection')){await cash('CUSTOMER_COLLECTION','2026-10-05',20);await verify('remaining collection',[26,1120,1880,0,80,80]);}
  let second;
  if(!done('return with refund')){second=await returned('SALE_RETURN','2026-10-06','AC-RET-2',1,true);await verify('return with refund',[27,1090,1880,0,80,60]);}else{second=(await get('/api/returns')).find(r=>r.returnDocNo==='AC-RET-2');}
  if(!done('void return and linked refund')){
  await page.goto(base+'/returns');
  await page.locator('tr').filter({hasText:second.code}).getByRole('button').last().click();
  await page.locator('textarea').fill('Acceptance browser reversal');
  await save('/api/returns/'+second.id+'/void',page.getByRole('button',{name:/تأكيد الإلغاء/}),200);
  await verify('void return and linked refund',[26,1120,1880,0,80,80]);
  }
  if(!done('supplier credit return')){await returned('PURCHASE_RETURN','2026-10-08','AC-PRET',2);await verify('supplier credit return',[24,1120,1880,0,60,80]);}
  if(!done('expense')){await cash('CASH_EXPENSE','2026-10-09',15);await verify('expense',[24,1105,1880,0,60,65]);}
  await page.evaluate(id=>localStorage.setItem('acceptance-sale-id',id),sale.id);
  return {checks,saleId:sale.id};
}
