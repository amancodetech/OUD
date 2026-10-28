import { readFile, cp, access } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { validateRuntime } from './validate-runtime.mjs';
try { const local=parseEnv(await readFile('.env','utf8'));for(const[key,value]of Object.entries(local))if(process.env[key]===undefined)process.env[key]=value; } catch(error) { if(error.code!=='ENOENT')throw error; }
validateRuntime();
await access('.next/standalone/server.js');
await cp('.next/static','.next/standalone/.next/static',{recursive:true,force:true});
await cp('public','.next/standalone/public',{recursive:true,force:true});
const child=spawn(process.execPath,['.next/standalone/server.js'],{env:{...process.env,HOSTNAME:process.env.APP_BIND_HOST||'127.0.0.1'},stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('close',code=>{process.exitCode=code||0;});
