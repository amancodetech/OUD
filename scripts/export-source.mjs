import { mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseEnv } from 'node:util';
const target = path.resolve('release', 'oud-source-' + new Date().toISOString().replaceAll(':', '-'));
const roots = ['src', 'public', 'prisma', 'scripts', 'tests', '.github', 'cloudflare'];
const rootFiles = ['package.json','package-lock.json','next.config.mjs','next-env.d.ts','tsconfig.json','eslint.config.mjs','postcss.config.js','tailwind.config.ts','vitest.config.mts','open-next.config.ts','wrangler.jsonc','Dockerfile','docker-compose.yml','docker-compose.supabase.yml','.gitignore','.dockerignore','.env.example','README.md'];
const docs = ['CLOUDFLARE-DEPLOYMENT.md','CLOUDFLARE-DATA-ARCHITECTURE-PLAN.md','BROWSER-SESSION-CACHE.md','CLOUDFLARE-IMPLEMENTATION-REPORT.md'];
const secrets = [];
for (const file of ['.env','.env.local','.env.production','.env.supabase']) {
  try { for (const [key,value] of Object.entries(parseEnv(await readFile(file,'utf8')))) if (/SECRET|PASSWORD|DATABASE_URL|TOKEN/.test(key) && value.length > 12) secrets.push(value); } catch (e) { if(e.code!=='ENOENT')throw e; }
}
const copied=[];
async function copy(relative) {
  if (relative.includes('seed-november-real-data') || /(?:^|\/)\.env(?:\.|$)/.test(relative) && relative !== '.env.example') return;
  const bytes=await readFile(relative);
  if(secrets.some(secret=>bytes.includes(Buffer.from(secret))))throw new Error('Private configuration found in '+relative);
  if(/sb_secret_[A-Za-z0-9_-]{10,}/.test(bytes.toString()))throw new Error('Supabase secret found in '+relative);
  const destination=path.join(target,relative);await mkdir(path.dirname(destination),{recursive:true});await copyFile(relative,destination);copied.push({file:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const relative=path.join(dir,entry.name);if(entry.isSymbolicLink())throw new Error('Unexpected source symlink: '+relative);if(entry.isDirectory())await walk(relative);else await copy(relative);}}
for(const root of roots)await walk(root);
for(const file of rootFiles){try{await copy(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
for(const file of docs){try{await copy(path.join('docs',file));}catch(e){if(e.code!=='ENOENT')throw e;}}
await writeFile(path.join(target,'SOURCE-MANIFEST.json'),JSON.stringify(copied,null,2)+'\n');
console.log('Clean source export: '+target+' ('+copied.length+' files). No Git history or local data included.');
