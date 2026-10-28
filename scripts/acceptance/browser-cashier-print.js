async page=>{
  const base='http://127.0.0.1:3107',out='/home/omar/Desktop/OUD/reports/acceptance-2026-10-27';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}});const cashier=await context.newPage();const checks=[];
  const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+' '+JSON.stringify(actual));checks.push({name,actual,expected,pass:true});};
  try{
    await cashier.goto(base+'/login');await cashier.locator('input').first().fill('accept_print_cashier');await cashier.locator('input[type=password]').fill('Acceptance!2026_private');await cashier.locator('button[type=submit]').click();await cashier.waitForURL(base+'/');
    const data=await cashier.evaluate(async()=>{const rows=await(await fetch('/api/sales')).json();const found=rows.find(row=>row.invoiceNo==='AC-PRINT-DISCOUNT');const invoice=await(await fetch('/api/sales/'+found.id)).json();return{invoice,settingsStatus:(await fetch('/api/settings')).status,branding:await(await fetch('/api/settings/branding')).json()};});
    check('cashier still denied administrative settings',data.settingsStatus,403);check('safe branding for cashier',data.branding.data.storeName,'Acceptance OUD');check('cost fields absent',[data.invoice.lines[0].item.openingValue,data.invoice.lines[0].lineCOGS],[undefined,undefined]);check('discounted invoice totals',[data.invoice.invoiceTotal,data.invoice.settlementAsOf,data.invoice.signedAsOf],[55,55,0]);
    for(const lang of [{code:'ar',name:/العربية/,discount:'الخصم'},{code:'en',name:/English/,discount:'Discount'},{code:'id',name:/Indonesia/,discount:'Diskon'}]){
      await cashier.goto(base+'/sales/'+data.invoice.id+'/print');await cashier.getByRole('button',{name:lang.name}).first().click();await cashier.getByRole('button',{name:/A4/}).click();await cashier.getByText('Acceptance OUD',{exact:true}).last().waitFor();
      const text=await cashier.locator('body').innerText();check('configured USD currency '+lang.code,text.includes('USD'),true);check('no hardcoded IDR '+lang.code,text.includes('IDR'),false);
      check('discount visible '+lang.code,text.includes('5'),true);check('total visible '+lang.code,text.includes('55'),true);
      await cashier.emulateMedia({media:'print'});await cashier.pdf({path:out+'/cashier-discount-'+lang.code+'.pdf',format:'A4',printBackground:true});await cashier.emulateMedia({media:'screen'});
    }
    return{pass:true,checks,currency:'USD',role:'CASHIER',permissions:['sales_manage']};
  }finally{await context.close();}
}
