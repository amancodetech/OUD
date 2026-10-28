// Explicit read-only inventory. Never imports application services or test fixtures.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import assert from 'node:assert/strict';
const [envFile, output, privateOutput] = process.argv.slice(2);
assert.ok(envFile && output && privateOutput);
const env = parseEnv(await readFile(envFile, 'utf8'));
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
try {
  const snapshot = await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const identity = await tx.$queryRaw`SELECT current_database() AS name, current_setting('transaction_read_only') AS readonly`;
    assert.equal(identity[0].readonly, 'on');
    const data = {};
    for (const model of Prisma.dmmf.datamodel.models) {
      const key = model.name[0].toLowerCase() + model.name.slice(1);
      data[key] = JSON.parse(JSON.stringify(await tx[key].findMany()));
    }
    return { identity: identity[0], data };
  }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
  await mkdir(privateOutput, { recursive: true, mode: 0o700 });
  await writeFile(`${privateOutput}/snapshot.json`, JSON.stringify(snapshot), { mode: 0o600 });
  const sum = (rows, field) => rows.reduce((total, row) => total.plus(row[field] || 0), new Decimal(0));
  const d = snapshot.data, s = d.systemSetting[0];
  const components = {
    cash: new Decimal(s.openingCash), bank: new Decimal(s.openingBank), inventory: sum(d.item, 'openingValue'),
    customers: sum(d.party.filter(p => p.type === 'CLIENT'), 'openingBalance'),
    suppliers: sum(d.party.filter(p => p.type === 'SUPPLIER'), 'openingBalance'),
    funders: sum(d.party.filter(p => p.type === 'FUNDER'), 'openingBalance'),
    approvedAssets: s.approveOpeningAssets ? sum(d.fixedAsset, 'submittedValue') : new Decimal(0),
    submittedAssets: sum(d.fixedAsset, 'submittedValue'), loans: new Decimal(s.openingLoans),
    capital: sum(d.party.filter(p => p.type === 'PARTNER'), 'openingCapital'), retainedEarnings: new Decimal(s.openingRetainedEarnings),
  };
  const difference = components.cash.plus(components.bank).plus(components.inventory).plus(components.customers).plus(components.approvedAssets)
    .minus(components.suppliers).minus(components.funders).minus(components.loans).minus(components.capital).minus(components.retainedEarnings);
  const tables = Object.fromEntries(Object.entries(d).map(([name, rows]) => [name, {
    count: rows.length,
    sha256: createHash('sha256').update(JSON.stringify(rows.sort((a,b) => String(a.id ?? a.name ?? a.key).localeCompare(String(b.id ?? b.name ?? b.key))))).digest('hex'),
  }]));
  await writeFile(output, JSON.stringify({ readOnly: true, identity: snapshot.identity, capturedAt: new Date().toISOString(), tables,
    opening: Object.fromEntries(Object.entries(components).map(([k,v]) => [k,v.toString()])),
    independentOpeningDifference: difference.toString(), approveOpeningAssets: s.approveOpeningAssets, openingReviewed: s.openingReviewed,
    sourceApproval: 'Requires owner/accountant documents; training example and empty template do not establish real balances',
  }, null, 2));
  console.log('Read-only snapshot captured; private records excluded from public evidence');
} finally { await db.$disconnect(); }
