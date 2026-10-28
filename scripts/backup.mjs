import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, unlink, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import crypto from 'node:crypto';
const target = process.env.BACKUP_DATABASE_URL;
if (!target) throw new Error('Explicit BACKUP_DATABASE_URL is required');
const url = new URL(target);
if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('PostgreSQL backup URL required');
const directory = path.resolve(process.env.BACKUP_DIR || './backups/scheduled');
const retention = Number(process.env.BACKUP_RETENTION_DAYS || 30);
if (!Number.isInteger(retention) || retention < 1 || retention > 365) throw new Error('Retention must be between 1 and 365 days');
await mkdir(directory, { recursive: true, mode: 0o700 });
const file = path.join(directory, `oud_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
try {
  await new Promise((resolve, reject) => {
    const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--host', url.hostname, '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', url.pathname.slice(1), '--file', file], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, stdio: ['ignore','ignore','pipe'] });
    child.stderr.on('data', () => {});
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error('pg_dump failed; no successful backup recorded')));
  });
  await chmod(file, 0o600);
  const digest = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  const hash = digest.digest('hex');
  await writeFile(file + '.json', JSON.stringify({ createdAt: new Date().toISOString(), sha256: hash, bytes: (await stat(file)).size, encrypted: false }), { mode: 0o600 });
  for (const entry of await readdir(directory)) {
    if (!/^oud_backup_[0-9TZ-]+\.dump(?:\.json)?$/.test(entry)) continue;
    const candidate = path.join(directory, entry);
    if (Date.now() - (await stat(candidate)).mtimeMs > retention * 86400000) await unlink(candidate);
  }
  console.log(`Backup completed: ${path.basename(file)} (${(await stat(file)).size} bytes)`);
} catch (error) {
  await unlink(file).catch(() => {});
  throw error;
}
