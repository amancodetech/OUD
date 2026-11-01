import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import {Prisma} from '@prisma/client';
import { PrismaClient } from '../../src/lib/prisma-client.mjs';
import bcrypt from 'bcryptjs';

const target = new URL(process.env.TEST_DATABASE_URL || 'invalid');
assert.match(target.pathname.slice(1), /^oud_test_[a-z0-9_]+$/);
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
export const db = new PrismaClient({ datasources: { db: { url: target.href } } });
export const base = process.env.APP_URL || 'http://127.0.0.1:3107';
assert.ok(['3107', '3108'].includes(new URL(base).port));
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
export const report = process.env.OUD_ACCEPTANCE_REPORT;
assert.ok(report && report.includes('/reports/acceptance-'));
export const checks = [];
export async function identity() {
  const rows = await db.$queryRaw`SELECT current_database()::text AS name`;
  assert.equal(rows[0].name, target.pathname.slice(1));
  return rows[0].name;
}
await identity();
export async function save(name, value) {
  await mkdir(report, { recursive: true });
  await writeFile(`${report}/${name}.json`, JSON.stringify(value, null, 2));
}
export function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks.push({ name, actual, expected, pass: true });
}
export async function request(path, { method = 'GET', body, cookie, headers = {}, status = 200 } = {}) {
  const response = await fetch(base + path, { method, headers: {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(cookie ? { Cookie: cookie } : {}), Origin: base, ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 300)}`);
  return { data, response };
}
export async function login(username = 'accept_admin', password = 'Acceptance!2026_private') {
  const { response } = await request('/api/auth/login', { method: 'POST', body: { username, password } });
  return response.headers.get('set-cookie').split(';')[0];
}
export async function fixture() {
  await identity();
  const tables = Prisma.dmmf.datamodel.models.map(model => `"${model.dbName || model.name}"`);
  await db.$executeRawUnsafe(`TRUNCATE ${tables.join(',')} CASCADE`);
  await db.dataRevision.create({ data: { id: 1 } });
  const user = await db.user.create({ data: { username: 'accept_admin', displayName: 'Acceptance administrator', role: 'ADMIN', passwordHash: await bcrypt.hash('Acceptance!2026_private', 10) } });
  await db.systemSetting.create({ data: { id: 1, storeName: 'Acceptance OUD', currencyCode: 'IDR', currencyLabel: 'IDR', startYear: 2026, openingCash: 1000, openingBank: 2000, openingReviewed: true, approveOpeningAssets: false, allowNegativeStock: false } });
  const category = await db.itemCategory.create({ data: { name: 'Acceptance category', prefix: 'AC' } });
  const unit = await db.unitOption.create({ data: { name: 'unit' } });
  const item = await db.item.create({ data: { code: 'AC001', name: 'Acceptance item', nameEn: 'Acceptance item', nameId: 'Barang uji', categoryId: category.id, unitId: unit.id, openingQty: 10, openingValue: 100 } });
  const customer = await db.party.create({ data: { code: 'AC-C', name: 'Acceptance customer', type: 'CLIENT' } });
  const supplier = await db.party.create({ data: { code: 'AC-S', name: 'Acceptance supplier', type: 'SUPPLIER' } });
  const partner = await db.party.create({ data: { code: 'AC-P', name: 'Acceptance partner', type: 'PARTNER', openingCapital: 3100, profitShareRatio: 1 } });
  return { user, category, unit, item, customer, supplier, partner };
}
export async function content() {
  const result = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    const key = model.name[0].toLowerCase() + model.name.slice(1);
    const rows = JSON.parse(JSON.stringify(await db[key].findMany(), (_key, value) => typeof value === 'bigint' ? value.toString() : value));
    result[key] = rows.sort((a, b) => String(a.id ?? a.name ?? a.key).localeCompare(String(b.id ?? b.name ?? b.key)));
  }
  return result;
}
