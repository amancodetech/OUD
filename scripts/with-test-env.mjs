import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';
import { readFile } from 'node:fs/promises';
const [file, ...args] = process.argv.slice(2);
if (!file || !args.length) throw new Error('Usage: node scripts/with-test-env.mjs <private-test.env> <node-script> [args]');
Object.assign(process.env, parseEnv(await readFile(file, 'utf8')));
const url = new URL(process.env.TEST_DATABASE_URL || 'invalid');
if (!/^oud_test_[a-z0-9_]+$/.test(url.pathname.slice(1)) || !['localhost','127.0.0.1'].includes(url.hostname) || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Refusing non-test environment');
const { PrismaClient } = await import('../src/lib/prisma-client.mjs');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try { const rows = await db.$queryRaw`SELECT current_database()::text AS name`; if(rows[0].name !== url.pathname.slice(1)) throw new Error('Actual test database mismatch'); }
finally { await db.$disconnect(); }
const exit = await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{env:process.env,stdio:'inherit'});child.on('error',reject);child.on('close',resolve);});
process.exitCode=exit || 0;
