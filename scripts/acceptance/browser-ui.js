async page => {
  const base='http://127.0.0.1:3107',out='/home/omar/Desktop/OUD/reports/acceptance-2026-10-27';const checks=[];const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const get=async path=>page.evaluate(async path=>{const r=await fetch(path);if(!r.ok)throw Error(path+' '+r.status);return r.json();},path);
  const assert=(name,actual,expected)=>{checks.push({name,actual,expected,pass:JSON.stringify(actual)===JSON.stringify(expected)});};
  await page.goto(base+'/');await page.getByRole('button',{name:/العربية/}).click();await page.waitForFunction(()=>document.documentElement.lang==='ar'&&document.cookie.includes('oud_locale=ar'));
  const items=(await get('/api/items')).data;const raw=items.find(i=>i.code==='AC-RAW'),fin=items.find(i=>i.code==='AC-FIN');
  const existing=await get('/api/inventory?asOfDate=2026-10-31');
  if(existing.items.find(i=>i.code==='AC-FIN').availableQty===0){
  if(existing.items.find(i=>i.code==='AC-RAW').availableQty===0){
    await page.goto(base+'/purchases/new');await page.getByRole('button',{name:'اختر المورد...',exact:true}).click();await page.getByRole('button',{name:'AC-S | Acceptance supplier',exact:true}).click();await page.getByPlaceholder('مثال: P-1001').fill('AC-RAW-BUY');await page.locator('input[type=date]').first().fill('2026-10-10');await page.getByRole('button',{name:'اختر الصنف...',exact:true}).click();await page.getByRole('button',{name:'AC-RAW | Acceptance raw',exact:false}).last().click();const row=page.locator('tbody tr').first();await row.locator('input').nth(1).fill('10');await row.locator('input').nth(2).fill('10');const savedRaw=page.waitForResponse(r=>r.url()===base+'/api/purchases'&&r.request().method()==='POST');await page.getByRole('button',{name:'حفظ الفاتورة',exact:true}).click();assert('raw purchase after independent cycle',(await savedRaw).status(),201);await page.waitForURL(base+'/purchases');
  }
  await page.goto(base+'/manufacturing/new');await page.locator('input[type=date]').fill('2026-10-10');await page.locator('select').first().selectOption(fin.id);await page.locator('input[inputmode=decimal]').first().fill('2');await page.locator('tbody select').first().selectOption(raw.id);await page.locator('tbody input[inputmode=decimal]').first().fill('2');
  const saved=page.waitForResponse(r=>r.url()===base+'/api/manufacturing'&&r.request().method()==='POST');await page.getByRole('button',{name:'حفظ وترحيل الدفعة',exact:true}).click();const save=await saved;assert('manufacturing saved',save.status(),201);await page.waitForURL(base+'/manufacturing');
  }else{assert('retained manufacturing batch from previous UI run',existing.items.find(i=>i.code==='AC-FIN').availableQty,2);}
  const inventory=await get('/api/inventory?asOfDate=2026-10-31');assert('raw consumption',[inventory.items.find(i=>i.code==='AC-RAW').availableQty,inventory.items.find(i=>i.code==='AC-RAW').availableValue],[8,80]);assert('finished output',[inventory.items.find(i=>i.code==='AC-FIN').availableQty,inventory.items.find(i=>i.code==='AC-FIN').availableValue],[2,20]);assert('manufacturing conserves inventory value',inventory.totalInventoryValue,340);
  const saleId=await page.evaluate(()=>localStorage.getItem('acceptance-sale-id'));
  await page.goto(base+'/sales/'+saleId+'/print');await page.getByRole('button',{name:/A4/}).click();await page.getByText('Acceptance OUD',{exact:true}).last().waitFor();
  assert('print includes configured branding',(await page.locator('body').innerText()).includes('Acceptance OUD'),true);
  assert('print currency IDR',(await page.locator('body').innerText()).includes('IDR'),true);
  assert('print includes return credit row',await page.getByText('إشعارات المرتجع',{exact:true}).count(),1);
  const financial=await page.evaluate(()=>JSON.parse(localStorage.getItem('acceptance-browser-financial')||'[]'));
  const invoice=await get('/api/sales/'+saleId);assert('printed invoice arithmetic',[invoice.invoiceTotal,invoice.returnsAsOf,invoice.settlementAsOf,invoice.refundAsOf,invoice.signedAsOf],[150,30,120,0,0]);
  await page.emulateMedia({media:'print'});await page.pdf({path:out+'/invoice-a4.pdf',format:'A4',printBackground:true});await page.screenshot({path:out+'/invoice-print.png',fullPage:true});await page.emulateMedia({media:'screen'});
  await page.emulateMedia({media:'print'});assert('application header hidden in print',await page.locator('header').isVisible(),false);assert('sidebar hidden in print',await page.locator('aside').isVisible(),false);await page.emulateMedia({media:'screen'});
  const pages=['/','/sales/new','/purchases/new','/returns/new','/manufacturing/new','/cash','/inventory'];
  for(const lang of [{name:/العربية/,dir:'rtl',key:'ar'},{name:/English/,dir:'ltr',key:'en'},{name:/Indonesia/,dir:'ltr',key:'id'}]){
    await page.goto(base+'/');await page.getByRole('button',{name:lang.name}).click();
    assert('language direction '+lang.key,await page.locator('html').getAttribute('dir'),lang.dir);
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:1000});
      for(const path of pages){await page.goto(base+path);await page.locator('main').waitFor();await page.waitForTimeout(200);const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert('viewport '+lang.key+' '+width+' '+path,layout.scroll<=width+1,true);}
    }
    await page.goto(base+'/');await page.locator('button[aria-haspopup=dialog]').click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert('Escape closes dialog '+lang.key,await page.getByRole('dialog').count(),0);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile-'+lang.key+'.png',fullPage:true});
  }
  await page.getByRole('button',{name:/English/}).click();await page.setViewportSize({width:320,height:844});await page.locator('button[aria-haspopup=dialog]').click();const dialog=page.getByRole('dialog');const box=await dialog.boundingBox();assert('320px period dialog fits',box.x>=0&&box.x+box.width<=320,true);await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/');await page.screenshot({path:out+'/desktop.png',fullPage:true});
  assert('financial browser steps recorded',financial.length,10);assert('uncaught browser errors',errors,[]);
  const result={checks,errors,financial,pass:checks.every(c=>c.pass)};
  await page.evaluate(r=>localStorage.setItem('acceptance-browser-ui',JSON.stringify(r)),result);
  return result;
}
