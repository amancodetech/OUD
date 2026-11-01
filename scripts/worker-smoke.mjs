import { parseEnv } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/lib/prisma-client.mjs';
// This harness never reads .env. It accepts only the explicit disposable database.
const file = process.argv[2];
const values = file ? parseEnv(await readFile(file, 'utf8')) : process.env;
const url = new URL(values.TEST_DATABASE_URL || 'invalid');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^oud_test_[a-z0-9_]+$/.test(url.pathname.slice(1))) throw new Error('Disposable local TEST_DATABASE_URL required');
const db = new PrismaClient({ datasourceUrl: url.href });
const rows = await db.$queryRaw`SELECT current_database()::text AS name`;
assert.equal(rows[0].name, url.pathname.slice(1));
const dir = await mkdtemp(join(tmpdir(), 'oud-workers-'));
const password = crypto.randomBytes(18).toString('hex');
const username = 'worker_smoke_' + Date.now();
const user = await db.user.create({ data: { username, displayName: 'Workers smoke test', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) } });
const port = Number(process.env.WORKER_TEST_PORT || 8797);
const base = `http://127.0.0.1:${port}`;
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
config.main = resolve(config.main); config.assets.directory = resolve(config.assets.directory);
config.vars = { APP_URL: base, SESSION_SECRET: crypto.randomBytes(32).toString('hex') };
config.hyperdrive[0].localConnectionString = url.href;
config.observability = { enabled: false };
config.triggers = {};
await writeFile(join(dir, 'wrangler.json'), JSON.stringify(config), { mode: 0o600 });
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--config', join(dir, 'wrangler.json'), '--port', String(port), '--ip', '127.0.0.1', '--persist-to', join(dir, 'state')], { env: { ...process.env, WRANGLER_SEND_METRICS: 'false', BROWSER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'] });
let diagnostics = '';
child.stdout.on('data', b => { diagnostics = (diagnostics + b).slice(-20000); });
child.stderr.on('data', b => { diagnostics = (diagnostics + b).slice(-20000); });
let cookie = '';
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { cookie, origin: base, ...options.headers } });
  return response;
}
try {
  for (let attempt = 0; ; attempt++) {
    try { const r = await request('/login'); if (r.status === 200) break; } catch {}
    if (attempt >= 180 || child.exitCode !== null) throw new Error('Worker startup failed');
    await new Promise(done => setTimeout(done, 500));
  }
  const login = await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (login.status !== 200) { const text = await login.text(); console.error('Worker login response:', text.replaceAll(url.href, '[TEST_DATABASE_URL]').replaceAll(url.password, '[TEST_PASSWORD]')); }
  assert.equal(login.status, 200, 'Worker login'); cookie = login.headers.get('set-cookie')?.split(';')[0] || ''; assert.ok(cookie);
  const [state, dashboard, page] = await Promise.all([request('/api/auth/state'), request('/api/reports/dashboard?startDate=2026-01-01&endDate=2026-10-29'), request('/')]);
  assert.equal(state.status, 200); assert.equal(dashboard.status, 200); assert.equal(page.status, 200);
  assert.match(page.headers.get('cache-control'), /no-store/);
  await Promise.all([state.json(), dashboard.json(), page.text()]);
  const name = 'Worker idempotent ' + crypto.randomUUID();
  const key = crypto.randomUUID();
  const options = { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify({ name, type: 'CLIENT' }) };
  const [first, replay] = await Promise.all([request('/api/parties', options), request('/api/parties', options)]);
  assert.equal(first.status, 201); assert.equal(replay.status, 201);
  assert.deepEqual(await first.json(), await replay.json()); assert.equal(await db.party.count({ where: { name } }), 1);
  const party = await db.party.findFirstOrThrow({ where: { name } });
  const edit = { method: 'PUT', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), 'if-match': '"0"' }, body: JSON.stringify({ name: name + ' edited' }) };
  assert.equal((await request(`/api/parties/${party.id}`, edit)).status, 200);
  edit.headers['idempotency-key'] = crypto.randomUUID();
  assert.equal((await request(`/api/parties/${party.id}`, edit)).status, 409);
  assert.equal((await db.party.findUniqueOrThrow({ where: { id: party.id } })).version, 1);
  const queued = await request('/api/backup?format=json', { headers: { 'idempotency-key': crypto.randomUUID() } });
  assert.equal(queued.status, 202); const jobId = (await queued.json()).jobId;
  for (let i = 0; ; i++) {
    const status = await request(`/api/jobs/${jobId}`); assert.equal(status.status, 200);
    const job = await status.json();
    if (job.status === 'SUCCEEDED') break;
    if (job.status === 'FAILED' || i > 60) throw new Error('Worker background export failed');
    await new Promise(done => setTimeout(done, 1000));
  }
  const download = await request(`/api/jobs/${jobId}?download=true`); assert.equal(download.status, 200); assert.equal((await download.json()).format, 'oud-database-backup');
  await request('/api/auth/logout', { method: 'POST' }); cookie = '';
  assert.equal((await request('/api/auth/state')).status, 401);
  console.log('PASS Workers runtime: login, concurrent SSR/reports/state, atomic idempotency, version conflict rollback, queue/R2 export, private download, logout.');
  if (process.env.OUD_KEEP_WORKER === '1') {
    const credentialFile = join(dir, 'browser.json'); await writeFile(credentialFile, JSON.stringify({ base, username, password }), { mode: 0o600 });
    console.log(`Browser test environment: ${credentialFile}`);
    await new Promise(done => { process.on('SIGTERM', done); process.on('SIGINT', done); });
  }
} catch (error) {
  // Filter test credentials and URLs even though this is an isolated database.
  const safe = diagnostics.replaceAll(url.href, '[TEST_DATABASE_URL]').replaceAll(url.password, '[TEST_PASSWORD]').replaceAll(config.vars.SESSION_SECRET, '[SESSION_SECRET]').replaceAll(config.vars.SESSION_SECRET.slice(0, 34), '[SESSION_SECRET_PREFIX]');
  console.error(safe); throw error;
} finally {
  child.kill('SIGTERM'); await new Promise(done => child.exitCode !== null ? done() : child.once('exit', done));
  await db.user.delete({ where: { id: user.id } }).catch(() => {}); await db.$disconnect();
  await rm(dir, { recursive: true, force: true });
}
