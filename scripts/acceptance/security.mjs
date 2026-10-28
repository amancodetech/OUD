import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { db, fixture, login, request, check, checks, save, base } from './common.mjs';
const inventory=[];
async function scan(dir='src/app/api'){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=dir+'/'+entry.name;
    if(entry.isDirectory())await scan(path);
    else if(entry.name==='route.ts'){
      const source=await readFile(path,'utf8');const route=path.replace('src/app','').replace('/route.ts','');
      for(const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g))inventory.push({route,method:match[1]});
    }
  }
}
try{
  const f=await fixture();await scan();
  for(const endpoint of inventory){
    if(endpoint.route==='/api/auth/login')continue;
    const path=endpoint.route.replace(/\[[^\]]+\]/g,'acceptance-missing-id');
    await request(path,{method:endpoint.method,...(endpoint.method==='GET'||endpoint.method==='DELETE'?{}:{body:{}}),status:401});
    checks.push({name:`anonymous ${endpoint.method} ${endpoint.route}`,pass:true});
  }
  const admin=await login();
  const staff=await db.user.create({data:{username:'accept_empty',displayName:'Empty permissions',role:'CASHIER',permissions:[],passwordHash:f.user.passwordHash}});
  const cookie=await login('accept_empty');
  for(const endpoint of inventory){
    if(['/api/auth/login','/api/auth/logout','/api/settings/branding','/api/notifications'].includes(endpoint.route))continue;
    const path=endpoint.route.replace(/\[[^\]]+\]/g,'acceptance-missing-id');
    await request(path,{cookie,method:endpoint.method,...(endpoint.method==='GET'||endpoint.method==='DELETE'?{}:{body:{}}),status:403});
    checks.push({name:`empty permissions ${endpoint.method} ${endpoint.route}`,pass:true});
  }
  // Independent expectations from the feature permissions and operating plan.
  const matrix={dashboard_view:['/api/reports/dashboard'],inventory_view:['/api/inventory'],debts_view:['/api/debts'],sales_manage:['/api/sales'],cash_customer:['/api/cash'],cash_full:['/api/cash','/api/reports/dashboard'],purchases_manage:['/api/purchases'],returns_manage:['/api/returns'],stock_issues_manage:['/api/stock-issues'],manufacturing_manage:['/api/manufacturing'],drivers_manage:['/api/drivers/referrals'],items_manage:['/api/items'],parties_manage:['/api/parties'],partners_view:['/api/partners-summary'],gift_policies_manage:['/api/drivers/policies'],void_documents:[],settings_manage:[]};
  const core=[...new Set(Object.values(matrix).flat())];
  // Shared lookup reads intentionally support multiple operational permissions.
  const lookups=['sales_manage','purchases_manage','returns_manage','stock_issues_manage','manufacturing_manage','drivers_manage','inventory_view'];
  for(const [permission, allowed] of Object.entries(matrix)){
    await db.user.update({where:{id:staff.id},data:{permissions:[permission]}});
    for(const path of core){
      const shared=(path==='/api/items'&&lookups.includes(permission))||(path==='/api/parties'&&[...lookups,'items_manage','cash_customer','cash_full','debts_view','partners_view'].includes(permission))||(path==='/api/drivers/policies'&&permission==='drivers_manage');
      await request(path,{cookie,status:allowed.includes(path)||shared?200:403});
      checks.push({name:`${permission} ${path}`,pass:true});
    }
  }
  for(const [contentType,status]of [['text/plain',415],['application/octet-stream',415],['application/json',403]]){
    await db.user.update({where:{id:staff.id},data:{permissions:['cash_customer']}});
    await request('/api/cash',{cookie,method:'POST',body:{txDate:'2026-10-20',type:'CASH_EXPENSE',amount:1,account:'CASH'},headers:{'Content-Type':contentType},status});
    checks.push({name:`spoofed content type ${contentType}`,pass:true});
  }
  const invoice={invoiceDate:'2026-10-20',invoiceNo:'SEC-SALE',customerId:f.customer.id,lines:[{itemId:f.item.id,qty:1,unitPrice:10}]};
  await request('/api/sales',{method:'POST',cookie:admin,body:invoice,headers:{Origin:'https://untrusted.invalid'},status:403});
  await request('/api/sales',{method:'POST',cookie:admin,body:{...invoice,invoiceDate:'2026-02-30'},status:400});
  await request('/api/sales',{method:'POST',cookie:admin,body:{...invoice,lines:[{itemId:f.item.id,qty:-1,unitPrice:1}]},status:400});
  await request('/api/sales',{method:'POST',cookie:admin,body:{...invoice,notes:'X'.repeat(2*1024*1024)},status:413});
  checks.push({name:'origin, invalid dates, negative quantity and size limits',pass:true});
  const key='acceptance-response-lost';
  const first=await request('/api/sales',{method:'POST',cookie:admin,body:invoice,headers:{'Idempotency-Key':key},status:201});
  const replay=await request('/api/sales',{method:'POST',cookie:admin,body:invoice,headers:{'Idempotency-Key':key},status:201});
  check('replayed saved result',first.data.id,replay.data.id);
  check('single saved document',await db.saleInvoice.count({where:{invoiceNo:'SEC-SALE'}}),1);
  await request('/api/sales',{method:'POST',cookie:admin,body:{...invoice,invoiceNo:'SEC-CHANGED'},headers:{'Idempotency-Key':key},status:409});
  const before=await db.saleInvoice.count();
  const results=await Promise.all(Array.from({length:5},()=>request('/api/sales',{method:'POST',cookie:admin,body:{...invoice,invoiceNo:'SEC-PARALLEL'},headers:{'Idempotency-Key':'acceptance-parallel-retry'},status:201})));
  check('concurrent same-key requests return same ID',new Set(results.map(r=>r.data.id)).size,1);
  check('concurrent same-key adds one invoice',await db.saleInvoice.count(),before+1);
  for(let attempt=0;attempt<10;attempt++)await request('/api/auth/login',{method:'POST',body:{username:'accept_lockout',password:'incorrect'},status:401});
  await request('/api/auth/login',{method:'POST',body:{username:'accept_lockout',password:'incorrect'},status:429});
  checks.push({name:'login shared rate limit',pass:true});
  await save('security',{inventory,checks,pass:true,policyBasis:['specs/04-auth-users-settings.md','specs/07-sales.md','specs/08-cash-transactions.md','specs/09-returns.md','docs/SYSTEM-ACCEPTANCE-PLAN.md'],ownerPolicySignoff:'pending'});
  console.log(`PASS ${checks.length} security and retry checks across ${inventory.length} route methods`);
}catch(e){await save('security',{inventory,checks,failure:e.message});throw e;}finally{await db.$disconnect();}
