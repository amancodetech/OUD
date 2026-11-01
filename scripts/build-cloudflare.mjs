import { spawnSync } from 'node:child_process';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
// Next traces .env into standalone output. Build with placeholders, then remove
// every traced environment file before Wrangler or an artifact uploader runs.
const originals = {};
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  try { Object.assign(originals, parseEnv(await readFile(file, 'utf8'))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const env = { ...process.env, DATABASE_URL: 'postgresql://build:unused@127.0.0.1:59999/oud_build_placeholder', SESSION_SECRET: 'build-placeholder-not-for-running-an-application', APP_URL: 'https://build.invalid' };
const cli = 'node_modules/@opennextjs/cloudflare/dist/cli/index.js';
const result = spawnSync(process.execPath, [cli, 'build'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const sensitive = Object.entries(originals).filter(([key, value]) => /SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|TOKEN/.test(key) && value.length > 12);
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/^\.env(?:\.|$)/.test(entry.name)) await unlink(path);
    else files.push(path);
  }
}
await walk('.open-next');
for (const file of files) {
  const content = await readFile(file);
  for (const [key, value] of sensitive) if (content.includes(Buffer.from(value))) throw new Error(`Private ${key} found in build output; refusing publication`);
}
console.log('Cloudflare build complete; traced environment files removed and configured secrets absent.');
