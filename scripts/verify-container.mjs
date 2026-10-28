import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
const [file, dbContainer, image='oud-erp-remediation:20261027'] = process.argv.slice(2);
if (!file || !/^oud-tests-\d+$/.test(dbContainer||'') || !/^oud-erp-remediation:/.test(image)) throw new Error('Disposable test environment and remediation image required');
const config=parseEnv(await readFile(file,'utf8'));const db=new URL(config.TEST_DATABASE_URL);
if(!/^oud_test_\d+$/.test(db.pathname.slice(1))||db.hostname!=='127.0.0.1')throw new Error('Refusing non-test database');
db.port='5432';const app=`oud-runtime-${Date.now()}`;
function run(command,args,capture=true){return new Promise((resolve,reject)=>{const c=spawn(command,args,{stdio:capture?['ignore','pipe','pipe']:'inherit'});let out='';if(capture){c.stdout.on('data',s=>out+=s);c.stderr.on('data',s=>out+=s);}c.on('error',reject);c.on('close',code=>code===0?resolve(out.trim()):reject(new Error(out)));});}
const actual=await run('docker',['exec',dbContainer,'psql','-U','postgres','-d',db.pathname.slice(1),'-tAc','SELECT current_database()']);if(actual!==db.pathname.slice(1))throw new Error('Actual database mismatch');
let started=false;
try{
 await run('docker',['run','--rm','-d','--name',app,'--network',`container:${dbContainer}`,'-e',`DATABASE_URL=${db}`,'-e',`SESSION_SECRET=${config.SESSION_SECRET}`,'-e','APP_URL=http://localhost:3000','-e','HOSTNAME=0.0.0.0',image]);started=true;
 for(let i=0;;i++){try{await run('docker',['exec',app,'node','-e',`fetch('http://localhost:3000/login').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))`]);break;}catch{if(i>50)throw new Error('Container did not start');await new Promise(r=>setTimeout(r,250));}}
 const result=await run('docker',['exec',app,'node','-e',`(async()=>{const anonymous=await fetch('http://localhost:3000/api/sales');if(anonymous.status!==401)throw Error('Anonymous access');const login=await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000'},body:JSON.stringify({username:'admin',password:'admin123'})});if(login.status!==200)throw Error('Login failed '+login.status);const cookie=login.headers.get('set-cookie').split(';')[0];const sales=await fetch('http://localhost:3000/api/sales',{headers:{Cookie:cookie}});if(sales.status!==200)throw Error('Authenticated data failed');console.log(JSON.stringify({anonymous:anonymous.status,login:login.status,authenticated:sales.status}));})().catch(e=>{console.error(e.message);process.exit(1)})`]);
 await run('docker',['exec',app,'node','node_modules/prisma/build/index.js','migrate','status']);
 console.log('PASS: non-root standalone container starts, login works, anonymous access denied, Prisma migration CLI works. '+result);
}finally{if(started)await run('docker',['stop',app]).catch(()=>{});}
