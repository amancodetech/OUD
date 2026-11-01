import { databaseModels } from '@/lib/model-metadata';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma, withLedgerTransaction } from '@/lib/db';
import { logAudit } from './audit.service';
import { toStorageDecimal } from '@/domain/decimal';

const tables = ['user', 'systemSetting', 'itemCategory', 'unitOption', 'party', 'item', 'fixedAsset', 'giftPolicy',
  'purchaseInvoice', 'purchaseLine', 'saleInvoice', 'saleLine', 'returnLine', 'cashTransaction', 'stockIssue',
  'productionBatch', 'batchMaterial', 'driverReferral', 'documentCounter', 'auditLog'] as const;
const deletionOrder = ['auditLog', 'cashTransaction', 'returnLine', 'batchMaterial', 'productionBatch', 'stockIssue',
  'saleLine', 'saleInvoice', 'purchaseLine', 'purchaseInvoice', 'driverReferral', 'giftPolicy', 'fixedAsset',
  'item', 'party', 'itemCategory', 'unitOption', 'systemSetting', 'documentCounter', 'loginAttempt', 'user'] as const;

export interface DatabaseBackup {
  format: 'oud-database-backup';
  version: 2;
  exportedAt: string;
  data: Record<string, Array<Record<string, unknown>>>;
}

export async function exportDatabase(): Promise<DatabaseBackup> {
  return withLedgerTransaction(async () => {
    const data: DatabaseBackup['data'] = {};
    // Scalar records only. Consistent snapshot shared with the ledger lock.
    for (const table of tables) data[table] = await (prisma[table] as any).findMany();
    return JSON.parse(JSON.stringify({ format: 'oud-database-backup', version: 2, exportedAt: new Date().toISOString(), data }));
  }, false);
}

export function validateBackup(value: unknown): DatabaseBackup {
  const backup = value as DatabaseBackup;
  if (!backup || backup.format !== 'oud-database-backup' || backup.version !== 2 || !backup.data ||
      Object.keys(backup.data).some(key => !tables.includes(key as any))) throw new Error('نسخة غير مدعومة؛ يلزم ملف قاعدة بيانات بإصدار 2');
  for (const table of tables) {
    const rows = backup.data[table];
    if (!Array.isArray(rows) || rows.length > 100000) throw new Error(`جدول ناقص أو غير صالح: ${table}`);
    const model = databaseModels.find(model => model.name.toLowerCase() === table.toLowerCase())!;
    const fields = new Map(model.fields.filter(field => field.kind !== 'object').map(field => [field.name, field]));
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('سجل نسخة غير صالح');
      const primary = table === 'documentCounter' ? 'name' : 'id';
      const id = String(row[primary] ?? '');
      if (!id || ids.has(id)) throw new Error('معرف ناقص أو مكرر في النسخة');
      ids.add(id);
      for (const [key, input] of Object.entries(row)) {
        const field = fields.get(key);
        if (!field || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('حقل غير مسموح في النسخة');
        if (input === null && !field.isRequired) continue;
        if (field.type === 'DateTime' && (typeof input !== 'string' || !Number.isFinite(Date.parse(input)))) throw new Error('تاريخ غير صالح في النسخة');
        if (field.type === 'Decimal') {
          if (!/^[-+]?\d+(\.\d+)?$/.test(String(input))) throw new Error('رقم غير صالح في النسخة');
          toStorageDecimal(String(input));
        }
      }
    }
  }
  if (backup.data.systemSetting.length !== 1 || backup.data.systemSetting[0].id !== 1 ||
      !backup.data.user.some(user => user.role === 'ADMIN' && user.isActive === true)) throw new Error('يلزم إعداد واحد وحساب مدير نشط في النسخة');
  if (backup.data.user.some(user => typeof user.passwordHash !== 'string' || !/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(user.passwordHash))) throw new Error('بيانات مصادقة غير صالحة في النسخة');
  return backup;
}

export async function restoreDatabase(input: unknown, reason: string) {
  if (!reason?.trim() || reason.trim().length < 5) throw new Error('سبب استعادة البيانات مطلوب');
  const backup = validateBackup(input);
  return withLedgerTransaction(async () => {
    await prisma.operationReceipt.deleteMany();
    await prisma.dataRevision.update({ where: { id: 1 }, data: { generation: randomUUID() } });
    for (const table of deletionOrder) await (prisma[table] as any).deleteMany();
    for (const table of tables) {
      const model = databaseModels.find(model => model.name.toLowerCase() === table.toLowerCase())!;
      const dates = new Set(model.fields.filter(field => field.type === 'DateTime').map(field => field.name));
      const rows = backup.data[table].map(row => {
        const converted = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, dates.has(key) && value !== null ? new Date(String(value)) : value]));
        if (table === 'user') {
          // Never reuse a generation from a backup, even when restoring it repeatedly.
          converted.sessionGeneration = randomUUID();
          converted.sessionVersion = 0;
        }
        return converted;
      });
      // Order inside a table is irrelevant: every FK points to an earlier table.
      if (rows.length) await (prisma[table] as any).createMany({ data: rows });
    }
    await logAudit({ action: 'RESTORE', entityType: 'DatabaseBackup', entityCode: backup.exportedAt, reason: reason.trim() });
    return { restored: true, counts: Object.fromEntries(tables.map(table => [table, backup.data[table].length])) };
  }, false);
}
