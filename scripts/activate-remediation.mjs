import { readFile, writeFile, mkdir, chmod, rename } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
const approved = process.argv.includes('--apply');
const keepSessionSecret = process.argv.includes('--keep-session-secret');
const root=process.cwd();const envFile=path.join(root,'.env');const envText=await readFile(envFile,'utf8'), settings=parseEnv(envText);
if(keepSessionSecret&&(!settings.SESSION_SECRET||settings.SESSION_SECRET.length<32||/change.this|replace.with|production.ready|test.only/i.test(settings.SESSION_SECRET)))throw new Error('Cannot preserve a missing or insecure session secret');
const url=new URL(settings.DATABASE_URL);
if(url.pathname!=='/oud_erp'||!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Unexpected activation target');
process.env.DATABASE_URL=settings.DATABASE_URL;
const {PrismaClient}=await import('../src/lib/prisma-client.mjs');const bcrypt=(await import('bcryptjs')).default;
const db=new PrismaClient({datasources:{db:{url:settings.DATABASE_URL}}});
const core=['User','AuditLog','SystemSetting','ItemCategory','UnitOption','Item','Party','FixedAsset','GiftPolicy','PurchaseInvoice','PurchaseLine','SaleInvoice','SaleLine','CashTransaction','ReturnLine','StockIssue','ProductionBatch','BatchMaterial','DriverReferral'];
async function run(command,args,env=process.env,accepted=[0]){return new Promise((resolve,reject)=>{const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>out+=v);child.on('error',reject);child.on('close',code=>accepted.includes(code)?resolve({code,out}):reject(new Error(`${command} failed (${code}); inspect activation log`)));});}
// Canonicalize only fields added by these upgrades; preserve every pre-existing value.
const addedDefaults={User:{permissions:null},Item:{nameId:null,nameEn:null},Party:{nameId:null,nameEn:null,supplierCategoryEn:null,openingInvoice:0,openingPaid:0},FixedAsset:{nameId:null,nameEn:null},CashTransaction:{sourceReturnId:null}};
async function snapshot(){return db.$transaction(async tx=>{
 await tx.$executeRaw`SET TRANSACTION READ ONLY`;
 const result={};
 for(const table of core){
  const rows=await tx.$queryRawUnsafe(`SELECT to_jsonb(t)::text AS value FROM "${table}" t ORDER BY id`);
  result[table]=rows.map(r=>{const row={...addedDefaults[table],...JSON.parse(r.value)};if(table==='User'){delete row.sessionVersion;delete row.sessionGeneration;delete row.passwordHash;delete row.updatedAt;}return JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))));});
 }
 return result;
},{isolationLevel:'RepeatableRead',timeout:60000});}

let folder;
try{
 const actual=await db.$queryRaw`SELECT current_database()::text AS name`;if(actual[0].name!=='oud_erp')throw new Error('Actual database mismatch');
 const before=await snapshot();
 const administrators=await db.$queryRaw`SELECT id, username, "passwordHash", "updatedAt" FROM "User" WHERE role='ADMIN' AND "isActive"=true`;
 const weak=[];for(const u of administrators)if(await bcrypt.compare('admin123',u.passwordHash))weak.push(u);
 const env={...process.env,DATABASE_URL:settings.DATABASE_URL};
 // Recognize both the committed schema and intermediate installations without rewriting migration history.
 const temporarySchemaFolder=await mkdtemp(path.join(os.tmpdir(),'oud-schema-'));
 let schemaState;
 try {
  const previousTarget=path.join(temporarySchemaFolder,'pre-generation.prisma');
  const currentSchema=await readFile('prisma/schema.prisma','utf8');
  const beforeQueryIndexes=currentSchema.replace(/^  @@index\(\[invoiceId\]\)\n/gm,'').replace(/^  @@index\(\[status, invoiceDate, id\]\)\n/gm,'');
  const beforeIndexesTarget=path.join(temporarySchemaFolder,'pre-query-indexes.prisma');
  await writeFile(beforeIndexesTarget,beforeQueryIndexes);
  await writeFile(previousTarget,beforeQueryIndexes.replace(/^.*sessionGeneration.*\n/m,''));
  const candidates=[['committed','prisma/baseline/schema.prisma'],['pre-remediation','prisma/baseline/pre-remediation.prisma'],['pre-generation',previousTarget],['pre-query-indexes',beforeIndexesTarget],['current','prisma/schema.prisma']];
  for(const [state,schema] of candidates){const diff=await run(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-schema-datasource','prisma/schema.prisma','--to-schema-datamodel',schema,'--exit-code'],env,[0,2]);if(diff.code===0){schemaState=state;break;}}
 } finally {await rm(temporarySchemaFolder,{recursive:true,force:true});}
 if(!schemaState)throw new Error('Work schema differs from every verified upgrade source; activation refused');
 if(!approved){console.log(JSON.stringify({plan:true,database:'oud_erp',schemaState,rotateDefaultAdmins:weak.map(u=>u.username),balancesPreserved:true,appUrl:'http://localhost:3000'}));process.exitCode=0;}
 else{
  folder=path.join(root,'backups',`activation-${Date.now()}`);await mkdir(folder,{recursive:true,mode:0o700});await chmod(folder,0o700);
  await writeFile(path.join(folder,'environment-before.env'),envText,{mode:0o600});
  await writeFile(path.join(folder,'data-before.json'),JSON.stringify(before),{mode:0o600});
  await run('pg_dump',['-Fc','--no-owner','--no-acl','-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d','oud_erp','-f',path.join(folder,'database-before.dump')],{...env,PGPASSWORD:decodeURIComponent(url.password)});
  await chmod(path.join(folder,'database-before.dump'),0o600);
  if(JSON.stringify(await snapshot())!==JSON.stringify(before))throw new Error('Concurrent data change detected before activation');
  const migrationTable=await db.$queryRaw`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`;
  const applied=migrationTable[0].present?await db.$queryRaw`SELECT migration_name AS name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`:[];
  for(const name of ['202610260001_baseline',...(['pre-generation','pre-query-indexes','current'].includes(schemaState)?['202610260002_integrity']:[]),...(['pre-query-indexes','current'].includes(schemaState)?['202610270001_legacy_columns','202610270002_session_generation']:[])])if(!applied.some(row=>row.name===name)){
   const step=await run(process.execPath,['node_modules/prisma/build/index.js','migrate','resolve','--applied',name],env);await writeFile(path.join(folder,name+'.log'),step.out,{mode:0o600});
  }
  const deployed=await run(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],env);await writeFile(path.join(folder,'migration-deploy.log'),deployed.out,{mode:0o600});
  const credentialLines=[];
  for(const u of weak){const password=crypto.randomBytes(24).toString('base64url');const hash=await bcrypt.hash(password,12);await db.user.update({where:{id:u.id},data:{passwordHash:hash,sessionVersion:{increment:1}}});credentialLines.push(`Username: ${u.username}\nPassword: ${password}\n`);}
  if(credentialLines.length)await writeFile(path.join(folder,'administrator-credentials.txt'),credentialLines.join('\n'),{mode:0o600});
  const sessionSecret=keepSessionSecret?settings.SESSION_SECRET:crypto.randomBytes(48).toString('hex');
  let updated=envText.replace(/^SESSION_SECRET=.*\r?\n?/gm,'').replace(/^APP_URL=.*\r?\n?/gm,'').trimEnd();
  updated+=`\nSESSION_SECRET=${sessionSecret}\nAPP_URL=http://localhost:3000\n`;
  const temporary=envFile+'.activation-tmp';await writeFile(temporary,updated,{mode:0o600});await rename(temporary,envFile);await chmod(envFile,0o600);
  const after=await snapshot();if(JSON.stringify(after)!==JSON.stringify(before))throw new Error('Core data comparison failed after activation');
  await db.auditLog.create({data:{userId:administrators[0]?.id,action:'ACTIVATE',entityType:'SystemDeployment',entityCode:path.basename(folder),reason:`User-approved remediation activation; schema updated; session secret ${keepSessionSecret?'preserved':'updated'}; ${weak.length} default administrator credentials rotated privately; core data comparison passed.`,afterJson:{coreDataUnchanged:true,rotatedDefaultAdmins:weak.map(u=>u.username)}}});
  const balances=await db.systemSetting.findUnique({where:{id:1},select:{openingCash:true,openingBank:true}});
  const result={activated:true,folder,coreDataUnchanged:true,preservedSessionSecret:keepSessionSecret,rotatedDefaultAdmins:weak.map(u=>u.username),credentialsFile:credentialLines.length?path.join(folder,'administrator-credentials.txt'):null,appUrl:'http://localhost:3000',balances};
  await writeFile(path.join(folder,'activation-result.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result,null,2));
 }
}finally{await db.$disconnect();}
