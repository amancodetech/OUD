async page=>{
  const base='http://127.0.0.1:3107';await page.goto(base+'/');await page.getByRole('button',{name:/العربية/}).click();await page.waitForFunction(()=>document.documentElement.lang==='ar'&&document.cookie.includes('oud_locale=ar'));
  await page.goto(base+'/sales/new');await page.getByRole('button',{name:'اختر العميل...',exact:true}).click();await page.getByRole('button',{name:'AC-C | Acceptance customer',exact:false}).last().click();await page.getByPlaceholder('مثال: S-1001').fill('AC-ROUND-UI');await page.locator('input[type=date]').first().fill('2026-10-23');
  for(let i=0;i<2;i++){
    if(i)await page.getByRole('button',{name:'إضافة سطر صنف',exact:true}).click();
    await page.getByRole('button',{name:'اختر الصنف المباع...',exact:true}).click();await page.getByRole('button',{name:'AC001 | Acceptance item',exact:false}).last().click();
    const row=page.locator('tbody tr').nth(i);await row.locator('input').nth(1).fill('2.5');await row.locator('input').nth(2).fill('0.3333');
  }
  await page.getByRole('button',{name:'نقدي كامل (خزينة)',exact:true}).click();
  if(!(await page.locator('main').innerText()).includes('1.6666'))throw Error('Editor does not show the sum of rounded lines');
  const pending=page.waitForResponse(r=>r.url()===base+'/api/sales'&&r.request().method()==='POST');await page.getByRole('button',{name:'حفظ الفاتورة',exact:true}).click();const saved=await pending;if(saved.status()!==201)throw Error(await saved.text());const result=await saved.json();await page.waitForURL(base+'/sales');
  const data=await page.evaluate(async id=>await(await fetch('/api/sales/'+id)).json(),result.id);
  const actual=[data.invoiceTotal,data.settlementAsOf,data.signedAsOf,...data.lines.map(l=>l.netSaleAmount)],expected=[1.6666,1.6666,0,'0.8333','0.8333'];
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(JSON.stringify({actual,expected}));
  return{pass:true,actual,expected,source:'Two lines entered through the sales form with full cash collection'};
}
