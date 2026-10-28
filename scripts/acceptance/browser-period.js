async page=>{
  const base='http://127.0.0.1:3107',checks=[];
  const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+' '+JSON.stringify(actual));checks.push({name,actual,expected,pass:true});};
  await page.unroute('**/api/reports/dashboard?**');
  await page.goto(base+'/');await page.getByRole('button',{name:/English/}).click();await page.waitForFunction(()=>document.documentElement.lang==='en');
  const opener=page.locator('button[aria-haspopup=dialog]');const initial=page.url();await opener.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');check('keyboard opens period dialog',await dialog.isVisible(),true);
  await dialog.locator('input[type=date]').first().fill('2026-10-01');await page.keyboard.press('Escape');check('Escape preserves applied URL',page.url(),initial);check('focus returns to opener',await opener.evaluate(el=>el===document.activeElement),true);
  await opener.click();await dialog.locator('input[type=date]').first().fill('2026-10-12');await dialog.locator('input[type=date]').last().fill('2026-10-09');check('invalid range disables Apply',await dialog.locator('button[type=submit]').isDisabled(),true);await page.keyboard.press('Escape');
  async function apply(end){await opener.click();await dialog.locator('input[type=date]').first().fill('2026-10-01');await dialog.locator('input[type=date]').last().fill(end);await dialog.locator('button[type=submit]').click();await page.waitForURL(url=>url.searchParams.get('endDate')===end);}
  await page.route('**/api/reports/dashboard?**',async route=>{const response=await route.fetch();if(route.request().url().includes('endDate=2026-10-09'))await page.waitForTimeout(800);try{await route.fulfill({response});}catch(e){if(!/closed|cancel|abort/i.test(e.message))throw e;}});
  const endDate=()=>page.evaluate(()=>new URL(location.href).searchParams.get('endDate'));
  await apply('2026-10-09');await apply('2026-10-11');await page.waitForTimeout(1200);check('newest applied date survives delayed response',await endDate(),'2026-10-11');check('latest sales amount survives delayed response',(await page.locator('main').innerText()).includes('175.00'),true);
  await page.unroute('**/api/reports/dashboard?**');await page.goBack();check('Back restores previous date',await endDate(),'2026-10-09');await page.reload();check('reload preserves previous date',await endDate(),'2026-10-09');
  await page.route('**/api/reports/dashboard?**',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Acceptance simulated network failure'})}));await page.reload();await page.getByText('Acceptance simulated network failure',{exact:false}).waitFor();checks.push({name:'failed request displays recoverable error',pass:true});await page.unroute('**/api/reports/dashboard?**');await page.reload();await page.locator('main').waitFor();
  return {pass:true,checks};
}
