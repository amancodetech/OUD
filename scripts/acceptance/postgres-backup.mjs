import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile, readdir, stat, utimes, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import assert from 'node:assert/strict';
import { db, content, save, identity, login, request } from './common.mjs';
const container = process.argv[2];
const image=process.env.OUD_ACCEPTANCE_IMAGE || 'oud-erp-remediation:acceptance-20261027';
assert.match(image,/^oud-erp-remediation:[a-z0-9-]+$/);
assert.match(container, /^oud-tests-\d+$/);
function run(command,args,env=process.env,input) {
  return new Promise((resolve,reject)=>{
    const c=spawn(command,args,{env,stdio:[input?'pipe':'ignore','pipe','pipe']}); let out='';
    c.stdout.on('data',s=>out+=s);c.stderr.on('data',s=>out+=s);
    if(input)createReadStream(input).pipe(c.stdin);
    c.on('error',reject);c.on('close',code=>code===0?resolve(out):reject(new Error(out||`${command} failed (${code})`)));
  });
}
const source=new URL(process.env.TEST_DATABASE_URL); const name=await identity();
assert.equal((await run('docker',['exec',container,'psql','-U','postgres','-d',name,'-tAc','SELECT current_database()'])).trim(),name);
const dir=`/tmp/oud-acceptance-backup-${Date.now()}`;
const restored=name+'_restore';const restoredURL=new URL(source);restoredURL.pathname='/'+restored;
const copy=new PrismaClient({datasources:{db:{url:restoredURL.href}}});
let created=false;
let appStarted=false;
const restoredApp='oud-acceptance-restored-'+Date.now();
const started=Date.now();
try {
  await mkdir(dir,{mode:0o700});
  const cookie=await login();
  const expectedReport=(await request('/api/reports/dashboard?startDate=2026-01-01&endDate=2026-10-31',{cookie})).data;
  for(const file of ['oud_backup_2000-01-01T00-00-00-000Z.dump','keep-unrelated.txt']){await writeFile(dir+'/'+file,'fixture');await utimes(dir+'/'+file,new Date('2000-01-01'),new Date('2000-01-01'));}
  const before=await content();
  await run(process.execPath,['scripts/backup.mjs'],{...process.env,BACKUP_DATABASE_URL:source.href,BACKUP_DIR:dir,BACKUP_RETENTION_DAYS:'30'});
  const files=await readdir(dir);
  assert.ok(!files.includes('oud_backup_2000-01-01T00-00-00-000Z.dump')&&files.includes('keep-unrelated.txt'));
  const dump=dir+'/'+files.find(f=>f.endsWith('.dump'));assert.equal((await stat(dump)).mode&0o777,0o600);
  const metadata=JSON.parse(await readFile(dump+'.json','utf8'));
  assert.equal(createHash('sha256').update(await readFile(dump)).digest('hex'),metadata.sha256);
  await run('docker',['exec',container,'psql','-U','postgres','-d','postgres','-c',`CREATE DATABASE "${restored}"`]);created=true;
  await run('docker',['exec','-i',container,'pg_restore','--single-transaction','--no-owner','--no-acl','-U','postgres','-d',restored],process.env,dump);
  assert.equal((await copy.$queryRaw`SELECT current_database() AS name`)[0].name,restored);
  const tableHashes={};
  for(const model of Prisma.dmmf.datamodel.models){const key=model.name[0].toLowerCase()+model.name.slice(1);const rows=JSON.parse(JSON.stringify(await copy[key].findMany())).sort((a,b)=>String(a.id??a.name??a.key).localeCompare(String(b.id??b.name??b.key)));assert.deepEqual(rows,before[key],key);tableHashes[key]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}
  const migrationRows=await db.$queryRawUnsafe('SELECT * FROM "_prisma_migrations" ORDER BY id');
  assert.deepEqual(await copy.$queryRawUnsafe('SELECT * FROM "_prisma_migrations" ORDER BY id'),migrationRows);
  const envFile=dir+'/runtime.env';const restoredBase='http://127.0.0.1:3109';
  await writeFile(envFile,`DATABASE_URL=${restoredURL.href}\nAPP_URL=${restoredBase}\nSESSION_SECRET=${process.env.SESSION_SECRET}\nHOSTNAME=127.0.0.1\nPORT=3109\n`,{mode:0o600});
  await run('docker',['run','--rm','-d','--name',restoredApp,'--network','host','--memory','1g','--cpus','2','--env-file',envFile,image]);appStarted=true;
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(restoredBase+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  assert.equal((await fetch(restoredBase+'/api/sales')).status,401);
  const restoredLogin=await fetch(restoredBase+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:restoredBase},body:JSON.stringify({username:'accept_admin',password:'Acceptance!2026_private'})});assert.equal(restoredLogin.status,200);
  const restoredCookie=restoredLogin.headers.get('set-cookie').split(';')[0];
  const restoredReport=await fetch(restoredBase+'/api/reports/dashboard?startDate=2026-01-01&endDate=2026-10-31',{headers:{Cookie:restoredCookie}});assert.equal(restoredReport.status,200);assert.deepEqual(await restoredReport.json(),expectedReport);
  const badURL=new URL(source);badURL.pathname='/oud_test_nonexistent_acceptance';
  let failed=false;try{await run(process.execPath,['scripts/backup.mjs'],{...process.env,BACKUP_DATABASE_URL:badURL.href,BACKUP_DIR:dir});}catch{failed=true;}assert.ok(failed);
  assert.equal((await readdir(dir)).filter(f=>f.endsWith('.dump')).length,1);
  await save('postgres-backup',{pass:true,fullContentCompared:true,tables:tableHashes,migrationMetadataIdentical:true,restoredRuntimeLogin:true,restoredReportIdentical:true,privatePermissions:true,sha256Verified:true,retentionScoped:true,failureCreatesNoSuccessArtifact:true,recoveryMs:Date.now()-started,restoredDatabase:restored});
  console.log('PASS full PostgreSQL content, relations, hash, private permissions, retention and failure handling');
}finally{if(appStarted)await run('docker',['stop',restoredApp]);await copy.$disconnect();await db.$disconnect();if(created)await run('docker',['exec',container,'psql','-U','postgres','-d','postgres','-c',`DROP DATABASE "${restored}" WITH (FORCE)`]);}
