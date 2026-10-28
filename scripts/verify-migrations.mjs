import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
const [first, second] = process.argv.slice(2);
const container = second || first;
const values = second ? parseEnv(await readFile(first, 'utf8')) : process.env;
if (!/^oud-tests-\d+$/.test(container || '')) throw new Error('Disposable test container required');
const source = new URL(values.TEST_DATABASE_URL || 'invalid');
if (!/^oud_test_\d+$/.test(source.pathname.slice(1)) || source.hostname !== '127.0.0.1') throw new Error('Refusing non-test target');
function run(command, args, env = process.env, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let output = '', diagnostics = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => diagnostics += chunk);
    if (input) child.stdin.end(input);
    child.on('error', reject);
    // Prisma prints update notices on stderr; they must never become SQL input.
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(output + diagnostics)));
  });
}
const sql = (name, query) => run('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', name, '-v', 'ON_ERROR_STOP=1'], process.env, query);
const historical = await readFile('prisma/migrations/202610260001_baseline/migration.sql', 'utf8');
const integrity = await readFile('prisma/migrations/202610260002_integrity/migration.sql', 'utf8');
for (const state of ['committed', 'pre_remediation', 'pre_generation', 'fresh']) {
  const name = source.pathname.slice(1) + '_' + state;
  const target = new URL(source); target.pathname = '/' + name;
  const env = { ...process.env, ...values, DATABASE_URL: target.toString(), TEST_DATABASE_URL: target.toString(), NODE_ENV: 'test' };
  const prisma = (...args) => run(process.execPath, ['node_modules/prisma/build/index.js', ...args], env);
  await sql('postgres', `CREATE DATABASE "${name}";`);
  const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  try {
    if (state === 'committed') {
      // Fixture is the actual committed schema, never the new historical baseline.
      const original = await prisma('migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/baseline/schema.prisma', '--script');
      await sql(name, original);
    } else if (state !== 'fresh') {
      await sql(name, historical);
      if (state === 'pre_generation') await sql(name, integrity);
    } else {
      await prisma('migrate', 'deploy');
    }
    await sql(name, `
      INSERT INTO "Party" (id,code,name,type,"openingBalance","updatedAt") VALUES ('preserve-legacy','LEGACY','Preserve original data','SUPPLIER',33560000,NOW());
      INSERT INTO "User" (id,username,"displayName","passwordHash",role,"updatedAt") VALUES ('legacy-user','legacy','Legacy admin','unused-test-hash','ADMIN',NOW());
      INSERT INTO "ItemCategory" (id,name,prefix) VALUES ('legacy-category','Legacy category','LC');
      INSERT INTO "UnitOption" (id,name) VALUES ('legacy-unit','Legacy unit');
      INSERT INTO "Item" (id,code,name,"categoryId","unitId",role,"openingQty","openingValue","updatedAt") VALUES ('legacy-item','LEGACY-ITEM','Legacy item','legacy-category','legacy-unit','MERCHANDISE',10,250,NOW());
      INSERT INTO "FixedAsset" (id,code,name,"submittedValue","updatedAt") VALUES ('legacy-asset','LEGACY-ASSET','Legacy asset',500,NOW());
    `);
    if (state !== 'committed') await sql(name, `UPDATE "Party" SET "openingInvoice"=40000000,"openingPaid"=6440000,"nameId"='Nama pemasok' WHERE id='preserve-legacy'; UPDATE "Item" SET "nameEn"='Localized item' WHERE id='legacy-item'; UPDATE "User" SET permissions='["debts_view"]'::jsonb WHERE id='legacy-user';`);
    if (state !== 'fresh') {
      // Resolve the immutable historical baseline only after recognizing the source.
      // The additive compatibility migration supplies every absent legacy column.
      await prisma('migrate', 'resolve', '--applied', '202610260001_baseline');
      if (state === 'pre_generation') await prisma('migrate', 'resolve', '--applied', '202610260002_integrity');
    }
    await prisma('migrate', 'deploy');
    await prisma('migrate', 'deploy');
    await prisma('migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code');
    // Exercise the generated client against all upgraded scalar models.
    for (const model of ['user', 'party', 'item', 'fixedAsset', 'saleInvoice', 'returnLine', 'cashTransaction', 'documentCounter', 'loginAttempt']) await db[model].findMany();
    const party = await db.party.findUniqueOrThrow({ where: { id: 'preserve-legacy' } });
    if (party.openingBalance.toString() !== '33560000') throw new Error('Original debt changed');
    if (party.openingInvoice.toString() !== (state === 'committed' ? '0' : '40000000')) throw new Error('Opening invoice overwritten');
    if (party.openingPaid.toString() !== (state === 'committed' ? '0' : '6440000')) throw new Error('Opening payment overwritten');
    const user = await db.user.findUniqueOrThrow({ where: { id: 'legacy-user' } });
    if (!user.sessionGeneration || (state !== 'committed' && JSON.stringify(user.permissions) !== '["debts_view"]')) throw new Error('Authentication upgrade failed');
    const item = await db.item.findUniqueOrThrow({ where: { id: 'legacy-item' } });
    if (item.openingValue.toString() !== '250' || (state !== 'committed' && item.nameEn !== 'Localized item')) throw new Error('Item data changed');
    console.log(`PASS: ${state} -> current schema; Prisma reads, existing debt/opening amounts/localization/permissions preserved; second deploy has no pending migration`);
  } finally {
    await db.$disconnect();
    await sql('postgres', `DROP DATABASE "${name}" WITH (FORCE);`);
  }
}
