import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const id = `oud_test_${Date.now()}`;
const container = `oud-tests-${Date.now()}`;
const password = crypto.randomBytes(24).toString('hex');
function run(command, args, env = process.env, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let output = '';
    if (capture) { child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk); }
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} failed (${code})${capture ? ': ' + output : ''}`)));
  });
}
let started = false;
try {
  await run('docker', ['run', '--rm', '-d', '--name', container, '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${id}`, '-p', '127.0.0.1::5432', 'postgres:17.11-alpine'], process.env, true);
  started = true;
  for (let attempt = 0; ; attempt++) {
    try {
      const name = await run('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', id, '-tAc', 'SELECT current_database()'], process.env, true);
      if (name !== id) throw new Error('Wrong database identity');
      break;
    }
    catch { if (attempt >= 40) throw new Error('Disposable database did not become ready'); await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  const actual = await run('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', id, '-tAc', 'SELECT current_database()'], process.env, true);
  if (actual !== id) throw new Error('Disposable database identity mismatch');
  const mapping = await run('docker', ['port', container, '5432/tcp'], process.env, true);
  const port = mapping.split(':').at(-1);
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/${id}?schema=public`;
  const env = { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url, NODE_ENV: 'test', OUD_INTEGRATION: '1', SESSION_SECRET: crypto.randomBytes(32).toString('hex') };
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
  await run(process.execPath, ['scripts/verify-migrations.mjs', container], env);
  await run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], env);
  // Explicit environment, never .env discovery; tests also verify actual identity.
  await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], env);
  if (process.env.OUD_KEEP_TEST_DB === '1') {
    const path = `/tmp/${id}.env`;
    await writeFile(path, `DATABASE_URL=${url}\nTEST_DATABASE_URL=${url}\nSESSION_SECRET=${env.SESSION_SECRET}\n`, { mode: 0o600 });
    console.log(`Disposable test database kept: ${container}; private environment: ${path}`);
    started = false;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) await run('docker', ['stop', container], process.env, true).catch(() => {});
}
