import { readFile, mkdir, writeFile, utimes, readdir, stat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
const [file,container]=process.argv.slice(2);if(!file||!/^oud-tests-\d+$/.test(container||''))throw new Error('Test environment required');
const values=parseEnv(await readFile(file,'utf8'));const source=new URL(values.TEST_DATABASE_URL);if(!/^oud_test_\d+$/.test(source.pathname.slice(1))||source.hostname!=='127.0.0.1')throw new Error('Refusing non-test target');
const dir=`/tmp/oud-backup-verify-${Date.now()}`, restored=source.pathname.slice(1)+'_restore';
function run(command,args,env=process.env,input){return new Promise((resolve,reject)=>{const c=spawn(command,args,{env,stdio:[input?'pipe':'ignore','pipe','pipe']});let out='';c.stdout.on('data',s=>out+=s);c.stderr.on('data',s=>out+=s);if(input)createReadStream(input).pipe(c.stdin);c.on('error',reject);c.on('close',code=>code===0?resolve(out.trim()):reject(new Error(out)));});}
await mkdir(dir,{mode:0o700});const old=dir+'/oud_backup_2000-01-01T00-00-00-000Z.dump',unrelated=dir+'/keep-unrelated.txt';for(const name of [old,unrelated]){await writeFile(name,'fixture');await utimes(name,new Date('2000-01-01'),new Date('2000-01-01'));}
await run(process.execPath,['scripts/backup.mjs'],{...process.env,BACKUP_DATABASE_URL:source.toString(),BACKUP_DIR:dir,BACKUP_RETENTION_DAYS:'30'});
const files=await readdir(dir);if(files.includes(old.split('/').at(-1))||!files.includes('keep-unrelated.txt'))throw new Error('Unsafe retention');
const dump=dir+'/'+files.find(f=>f.endsWith('.dump'));if((await stat(dump)).mode%512!==384)throw new Error('Backup permissions not private');
await run('docker',['exec',container,'psql','-U','postgres','-d','postgres','-c',`CREATE DATABASE "${restored}"`]);
try{
 await run('docker',['exec','-i',container,'pg_restore','--single-transaction','--no-owner','--no-acl','-U','postgres','-d',restored],process.env,dump);
 const query=`SELECT (SELECT count(*) FROM "User"),(SELECT count(*) FROM "Item"),(SELECT count(*) FROM "Party"),(SELECT count(*) FROM "CashTransaction"),(SELECT count(*) FROM "AuditLog");`;
 const before=await run('docker',['exec',container,'psql','-U','postgres','-d',source.pathname.slice(1),'-tAc',query]);const after=await run('docker',['exec',container,'psql','-U','postgres','-d',restored,'-tAc',query]);
 if(before!==after)throw new Error('Restored counts differ');
 console.log('PASS: pg_dump backup restored with pg_restore, counts match '+after+'; private permissions and scoped retention verified');
}finally{await run('docker',['exec',container,'psql','-U','postgres','-d','postgres','-c',`DROP DATABASE "${restored}" WITH (FORCE)`]);}
