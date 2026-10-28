import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fixture, login, request, db, save, content, base, identity } from './common.mjs';
import assert from 'node:assert/strict';
export const app='oud-acceptance-app-20261027',image=process.env.OUD_ACCEPTANCE_IMAGE || 'oud-erp-remediation:acceptance-20261027';
assert.match(image,/^oud-erp-remediation:[a-z0-9-]+$/);
export function docker(args){return new Promise((resolve,reject)=>{const c=spawn('docker',args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';c.stdout.on('data',s=>stdout+=s);c.stderr.on('data',s=>stderr+=s);c.on('error',reject);c.on('close',code=>code===0?resolve(stdout.trim()):reject(new Error(stderr)));});}
export async function start(){
  const path='/tmp/oud-acceptance-runtime.env';
  await writeFile(path,`DATABASE_URL=${process.env.TEST_DATABASE_URL}\nAPP_URL=${base}\nSESSION_SECRET=${process.env.SESSION_SECRET}\nHOSTNAME=127.0.0.1\nPORT=3107\n`,{mode:0o600});
  await docker(['run','--rm','-d','--name',app,'--network','host','--memory','1g','--cpus','2','--env-file',path,image]);
  for(let n=0;n<100;n++){try{if((await fetch(base+'/login')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
  throw Error('Test image did not become ready');
}
try{
  await identity();
  await docker(['stop',app]);await start();
  const details=JSON.parse(await docker(['inspect',app]))[0];
  assert.equal(details.Config.Image,image);assert.equal(details.HostConfig.Memory,1073741824);
  const security=JSON.parse(await docker(['exec',app,'node','-e',`const fs=require('fs');console.log(JSON.stringify({uid:process.getuid(),environmentFilePresent:fs.existsSync('/app/.env')}));`]));
  assert.ok(security.uid>0);assert.equal(security.environmentFilePresent,false);
  await docker(['exec',app,'node','node_modules/prisma/build/index.js','migrate','status']);
  const loginPage=await(await fetch(base+'/login')).text();const cssPath=loginPage.match(/href="([^" ]+\.css[^" ]*)"/)?.[1];assert.ok(cssPath);
  const css=await(await fetch(base+cssPath)).text();assert.ok(css.includes('.flex{display:flex}')&&css.includes('.p-4{'));
  assert.equal((await fetch(base+'/fonts/350b852752f8489d-s.p.woff2')).status,200);
  await save('runtime',{pass:true,imageId:details.Image,imageTag:image,user:details.Config.User,...security,migrationCLI:true,tailwindCSS:true,localFont:true,memoryLimit:details.HostConfig.Memory,cpuLimit:details.HostConfig.NanoCpus});
  // Fault test only after full PostgreSQL restore has succeeded in this run.
  const f=await fixture(),cookie=await login();const before=await content();
  await db.$executeRawUnsafe(`CREATE FUNCTION acceptance_pause_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(15); RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER acceptance_pause_save BEFORE INSERT ON "SaleLine" FOR EACH ROW EXECUTE FUNCTION acceptance_pause_save()`);
  const body={invoiceDate:'2026-10-20',invoiceNo:'AC-CRASH',customerId:f.customer.id,lines:[{itemId:f.item.id,qty:1,unitPrice:30}]};
  const inFlight=fetch(base+'/api/sales',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','Idempotency-Key':'acceptance-crash-retry'},body:JSON.stringify(body)}).then(r=>({status:r.status}),e=>({error:e.name}));
  let paused=false;
  for(let n=0;n<100;n++){const rows=await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event='PgSleep'`;if(rows.length){paused=true;break;}await new Promise(r=>setTimeout(r,100));}
  assert.ok(paused,'Save reached the injected pause inside the transaction');
  await docker(['kill','--signal=KILL',app]);
  const lost=await inFlight;
  await db.$executeRawUnsafe(`DROP TRIGGER acceptance_pause_save ON "SaleLine"`);
  await db.$executeRawUnsafe(`DROP FUNCTION acceptance_pause_save()`);
  assert.deepEqual(await content(),before);
  await start();const fresh=await login();
  const first=await request('/api/sales',{method:'POST',cookie:fresh,body,headers:{'Idempotency-Key':'acceptance-crash-retry'},status:201});
  const again=await request('/api/sales',{method:'POST',cookie:fresh,body,headers:{'Idempotency-Key':'acceptance-crash-retry'},status:201});
  assert.equal(first.data.id,again.data.id);assert.equal(await db.saleInvoice.count(),1);
  await save('server-crash',{pass:true,reachedUncommittedSave:paused,lostResponse:lost,fullContentUnchangedAfterCrash:true,retryCreatesOneDocument:true,counterAuditCashRollback:true});
  console.log('PASS final image, non-root, CSS/fonts, migrations, crash rollback and retry');
}finally{await db.$disconnect();}
