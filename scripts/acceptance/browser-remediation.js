async page => {
  const base='http://127.0.0.1:3107',checks=[];
  await page.context().clearCookies();await page.goto(base+'/login');
  await page.locator('input').first().fill('accept_admin');await page.locator('input[type=password]').fill('Acceptance!2026_private');await page.locator('button[type=submit]').click();await page.waitForURL(base+'/');
  await page.goto(base+'/sales');await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===100);
  const first=await page.locator('tbody tr').first().innerText();
  await page.getByRole('button',{name:/التالي|Next|Berikutnya/,exact:true}).click();await page.waitForFunction(()=>document.querySelector('nav[aria-label]')?.textContent?.includes('2'));
  await page.waitForFunction(previous=>document.querySelector('tbody tr')?.innerText!==previous,first);
  checks.push('bounded next page and changed rows');
  await page.locator('input[type=text]').first().fill('CAP-99999');await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===1&&document.querySelector('tbody')?.innerText?.includes('CAP-99999'));
  checks.push('server search locates a document across all pages');
  await page.locator('input[type=text]').first().fill('');
  const fixtures=await page.evaluate(async()=>{
    const read=async path=>{const r=await fetch(path);return r.json()};
    const parties=await read('/api/parties?type=CLIENT&lookup=true'),items=await read('/api/items');const customer=(Array.isArray(parties)?parties:parties.data).find(p=>p.code==='AC-C'),item=items.data.find(i=>i.code==='AC001');
    const saved=[];
    for(const [suffix,paidNow] of [['UNPAID',0],['PARTIAL',0.5],['PAID',1]]){
      const response=await fetch('/api/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoiceDate:'2026-10-22',invoiceNo:'UI-STATUS-'+suffix+'-'+Date.now(),customerId:customer.id,lines:[{itemId:item.id,qty:'0.0001',unitPrice:10000}],paidNow,collectionAccount:'CASH'})});
      if(!response.ok)throw Error(await response.text());saved.push({id:(await response.json()).id,paidNow});
    }return saved;
  });
  for(const [language,label,expected] of [['ar',/العربية/,['آجل بالكامل','مدفوع جزئياً','خالص (نقدي)']],['en',/English/,['Unpaid (On Credit)','Partially Paid','Paid in Full']],['id',/Indonesia/,['Belum Lunas (Kredit)','Dibayar Sebagian','Lunas']]]){
    await page.getByRole('button',{name:label}).first().click();await page.waitForFunction(lang=>document.documentElement.lang===lang,language);
    for(let i=0;i<fixtures.length;i++){
      await page.goto(base+'/sales/'+fixtures[i].id+'/print');await page.getByRole('button',{name:/A4/}).click();await page.getByText(expected[i],{exact:true}).waitFor();checks.push(language+': '+expected[i]);
    }
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/sales');await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length>0);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Page overflows mobile viewport');checks.push('mobile pagination stays within viewport');
  await page.screenshot({path:'/home/omar/Desktop/OUD/reports/acceptance-remediation-2026-10-28/sales-mobile.png',fullPage:false});
  return{pass:true,checks};
}
