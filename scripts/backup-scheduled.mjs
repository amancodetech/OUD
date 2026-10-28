import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function run(command, args, timeout = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let output = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    timer.unref();
    child.stdout.on('data', chunk => { if (output.length < 1024 * 1024) output += chunk; });
    // Tool output may contain repository credentials. Publish only a generic failure.
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error('BACKUP_TOOL_UNAVAILABLE')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error('BACKUP_STEP_FAILED')); });
  });
}
export async function scheduledBackup() {
  const directory = path.resolve(process.env.BACKUP_DIR || './backups/scheduled');
  const statusFile = path.resolve(process.env.BACKUP_STATUS_FILE || './backups/backup-status.json');
  const lock = statusFile + '.lock';
  await mkdir(path.dirname(statusFile), { recursive: true, mode: 0o700 });
  // A stale lock is intentionally not stolen: a still-running dump must not overlap.
  await mkdir(lock, { mode: 0o700 });
  let previous = {};
  try { previous = JSON.parse(await readFile(statusFile, 'utf8')); } catch {}
  const record = async data => {
    const temporary = statusFile + '.' + process.pid + '.tmp';
    previous = { ...previous, ...data };
    await writeFile(temporary, JSON.stringify(previous, null, 2), { mode: 0o600 });
    await rename(temporary, statusFile);
  };
  try {
    await record({ state: 'running', lastAttemptAt: new Date().toISOString() });
    const passwordFile = process.env.RESTIC_PASSWORD_FILE;
    if (!process.env.RESTIC_REPOSITORY || !passwordFile || !path.isAbsolute(passwordFile)) throw new Error('BACKUP_DESTINATION_NOT_CONFIGURED');
    if (((await stat(passwordFile)).mode & 0o077) !== 0) throw new Error('BACKUP_PASSWORD_FILE_NOT_PRIVATE');
    const daily = Number(process.env.BACKUP_REMOTE_KEEP_DAILY || 30);
    const monthly = Number(process.env.BACKUP_REMOTE_KEEP_MONTHLY || 12);
    if (![daily, monthly].every(n => Number.isInteger(n) && n >= 1 && n <= 365)) throw new Error('BACKUP_RETENTION_INVALID');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await run(process.execPath, [fileURLToPath(new URL('./backup.mjs', import.meta.url))]);
    const { readdir } = await import('node:fs/promises');
    const files = (await readdir(directory)).filter(f => /^oud_backup_[0-9TZ-]+\.dump$/.test(f)).sort();
    const dump = path.join(directory, files.at(-1) || '');
    if (!files.length) throw new Error('BACKUP_DUMP_MISSING');
    const output = await run('restic', ['backup', '--json', '--tag', 'oud-erp', '--host', 'oud-erp', dump, dump + '.json']);
    const summary = output.trim().split('\n').map(line => JSON.parse(line)).find(row => row.message_type === 'summary');
    if (!/^[0-9a-f]{8,64}$/.test(summary?.snapshot_id || '')) throw new Error('BACKUP_SNAPSHOT_NOT_CONFIRMED');
    await run('restic', ['forget', '--tag', 'oud-erp', '--host', 'oud-erp', '--group-by', 'host,tags', '--keep-daily', String(daily), '--keep-monthly', String(monthly), '--prune']);
    await run('restic', ['check']);
    await record({ state: 'success', lastSuccessAt: new Date().toISOString(), snapshotId: summary.snapshot_id, error: null });
    console.log('Encrypted backup verified; retention completed.');
  } catch (error) {
    await record({ state: 'failed', error: /^BACKUP_[A-Z_]+$/.test(error.message) ? error.message : 'BACKUP_STEP_FAILED' });
    throw new Error('Scheduled backup failed; inspect private status and systemd journal.');
  } finally { await rm(lock, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  scheduledBackup().catch(error => { console.error(error.message); process.exitCode = 1; });
}
