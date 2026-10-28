async page=>{
  const base='http://127.0.0.1:3107',out='/home/omar/Desktop/OUD/reports/acceptance-2026-10-27';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}}),cashier=await context.newPage(),checks=[];
  const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+' '+JSON.stringify(actual));checks.push({name,actual,expected,pass:true});};
  try{
    await cashier.goto(base+'/login');await cashier.locator('input').first().fill('accept_print_cashier');await cashier.locator('input[type=password]').fill('Acceptance!2026_private');await cashier.locator('button[type=submit]').click();await cashier.waitForURL(base+'/');
    const invoice=await cashier.evaluate(async()=>{const list=await(await fetch('/api/sales')).json();const row=list.find(r=>r.invoiceNo==='AC-PRECISION');return await(await fetch('/api/sales/'+row.id)).json();});
    check('stored quantity and amount',[invoice.lines[0].qty,invoice.invoiceTotal],['0.0001',1]);
    for(const language of [{code:'ar',label:/العربية/,quantity:'0.0001'},{code:'en',label:/English/,quantity:'0.0001'},{code:'id',label:/Indonesia/,quantity:'0,0001'}]){
      await cashier.goto(base+'/sales/'+invoice.id+'/print');await cashier.getByRole('button',{name:language.label}).first().click();await cashier.getByRole('button',{name:/A4/}).click();
      const row=cashier.locator('tbody tr').first();await row.waitFor();check('A4 quantity '+language.code,(await row.locator('td').nth(2).innerText()).trim(),language.quantity);
      const share=await cashier.getByRole('link',{name:'WhatsApp',exact:true}).evaluate(el=>decodeURIComponent(el.href));check('share keeps four decimals '+language.code,share.includes(language.quantity),true);
      await cashier.emulateMedia({media:'print'});await cashier.pdf({path:out+'/precision-'+language.code+'.pdf',format:'A4',printBackground:true});await cashier.screenshot({path:out+'/precision-'+language.code+'.png',fullPage:true});await cashier.emulateMedia({media:'screen'});
      await cashier.getByRole('button',{name:/80mm/}).click();check('thermal quantity '+language.code,(await cashier.locator('body').innerText()).includes(language.quantity),true);
    }
    return{pass:true,checks,invoiceId:invoice.id};
  }finally{await context.close();}
}
