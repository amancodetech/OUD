import { readFile } from 'node:fs/promises';
const hours = Number(process.env.BACKUP_MAX_AGE_HOURS || 26);
try {
  if (!Number.isFinite(hours) || hours <= 0) throw new Error();
  const state = JSON.parse(await readFile(process.env.BACKUP_STATUS_FILE || './backups/backup-status.json', 'utf8'));
  const age = Date.now() - Date.parse(state.lastSuccessAt);
  if (state.state !== 'success' || !Number.isFinite(age) || age < 0 || age > hours * 3600000) throw new Error();
  console.log('Backup health OK');
} catch { console.error('Backup missing, failed, running or overdue. Check the backup service.'); process.exitCode = 1; }
