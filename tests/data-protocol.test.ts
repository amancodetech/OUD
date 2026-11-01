import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({ cookies: () => ({ get: (k: string) => jar.has(k) ? { value: jar.get(k) } : undefined, set: (k: string, v: string) => jar.set(k, v), delete: (k: string) => jar.delete(k) }) }));
import { prisma, withLedgerTransaction } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { assertTestDatabase } from '@/lib/test-database';
import { exportDatabase, restoreDatabase } from '@/services/backup.service';
import { withApiGuard } from '@/lib/api-guard';
import { PUT } from '@/app/api/parties/[id]/route';
import { workerRuntime, requestRuntime } from '@/lib/request-runtime.mjs';
import { submitJob, executeJob, readJob } from '@/services/background-jobs.service';
let backup: Awaited<ReturnType<typeof exportDatabase>>;
let user: any;
const context = (id = '') => ({ params: Promise.resolve({ id }) });
const request = (path: string, body: unknown, key: string, version?: number) => new NextRequest('http://localhost' + path, { method: 'PUT', headers: { 'content-type': 'application/json', 'idempotency-key': key, ...(version === undefined ? {} : { 'if-match': JSON.stringify(String(version)) }) }, body: JSON.stringify(body) });
const revision = () => prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
describe('durable data protocol on PostgreSQL', () => {
  beforeAll(async () => {
    await assertTestDatabase(prisma); backup = await exportDatabase();
    user = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } });
    await createSession(user);
    await prisma.systemSetting.update({ where: { id: 1 }, data: { lockedThroughDate: null } });
  });
  afterAll(async () => { await restoreDatabase(backup, 'Restore isolated protocol test fixture'); await prisma.$disconnect(); });
  it('commits one revision for several writes and rolls versions/revision back on failure', async () => {
    const before = await revision();
    const party = await withLedgerTransaction(async () => {
      const p = await prisma.party.create({ data: { code: 'PROTO-REV', name: 'Protocol revision', type: 'CLIENT' } });
      return prisma.party.update({ where: { id: p.id }, data: { phone: '1' } });
    }, false);
    const after = await revision();
    expect(after.revision).toBe(before.revision + 1n); expect(party.version).toBe(1);
    await expect(withLedgerTransaction(async () => {
      await prisma.party.update({ where: { id: party.id }, data: { phone: '2' } });
      throw new Error('rollback');
    }, false)).rejects.toThrow('rollback');
    expect((await revision()).revision).toBe(after.revision);
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).version).toBe(1);
  });
  it('replays a bodyless delete once and rejects changing its target using the same key', async () => {
    let calls = 0;
    const endpoint = withApiGuard('DELETE', '/api/protocol-test', async () => { calls++; return Response.json({ calls }); });
    const req = (id: string) => new NextRequest(`http://localhost/api/protocol-test/${id}`, { method: 'DELETE', headers: { 'idempotency-key': 'protocol-delete-key' } });
    const results = await Promise.all([endpoint(req('a'), context()), endpoint(req('a'), context())]);
    expect(results.map(r => r.status)).toEqual([200, 200]); expect(calls).toBe(1);
    expect((await endpoint(req('b'), context())).status).toBe(409);
    expect(results[0].headers.get('cache-control')).toContain('no-store');
    expect(results[0].headers.get('server-timing')).toContain('app;dur=');
  });
  it('requires the version actually edited, rejects the losing editor, and replays a committed command', async () => {
    const party = await prisma.party.create({ data: { code: 'PROTO-EDIT', name: 'Protocol editing', type: 'CLIENT' } });
    const path = `/api/parties/${party.id}`;
    expect((await PUT(request(path, { name: 'Missing version' }, 'proto-edit-missing'), context(party.id))).status).toBe(428);
    const first = await PUT(request(path, { name: 'First editor' }, 'proto-edit-first', 0), context(party.id));
    expect(first.status).toBe(200);
    const replay = await PUT(request(path, { name: 'First editor' }, 'proto-edit-first', 0), context(party.id));
    expect(await replay.json()).toEqual(await first.json());
    const stale = await PUT(request(path, { name: 'Second editor' }, 'proto-edit-second', 0), context(party.id));
    expect(stale.status).toBe(409); expect((await stale.json()).code).toBe('VERSION_CONFLICT');
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).name).toBe('First editor');
  });
  it('never shares request connection scope or memo state between concurrent requests', async () => {
    const scopes = [0, 1].map(i => ({ connectionString: process.env.TEST_DATABASE_URL!, memo: new Map([[String(i), Promise.resolve(i)]]) }));
    await Promise.all(scopes.map((scope, i) => requestRuntime.run(scope, async () => {
      await new Promise(resolve => setTimeout(resolve, 10 - i));
      expect(workerRuntime()).toBe(scope); expect(workerRuntime()?.memo.size).toBe(1);
    })));
    expect(workerRuntime()).toBeUndefined();
  });
  it('executes duplicate queue deliveries once, isolates downloads and revokes pending jobs', async () => {
    const files = new Map<string, { bytes: ArrayBuffer; httpMetadata: any }>();
    const env = { JOBS: { send: vi.fn() }, JOB_FILES: {
      put: async (key: string, bytes: any, options: any = {}) => files.set(key, { bytes: await new Response(bytes).arrayBuffer(), httpMetadata: options.httpMetadata }),
      get: async (key: string) => { const file = files.get(key); return file ? { ...file, arrayBuffer: async () => file.bytes, body: file.bytes } : null; },
    } };
    const scope: any = { connectionString: process.env.TEST_DATABASE_URL!, bindings: env, memo: new Map() };
    try { await requestRuntime.run(scope, async () => {
      const req = new Request('http://localhost/api/backup', { headers: { 'idempotency-key': 'proto-backup-job' } });
      const submitted = await submitJob(req, user.id, 'EXPORT', { format: 'json' });
      const { jobId } = await submitted.json();
      await executeJob(jobId);
      const finished = await prisma.backgroundJob.findUniqueOrThrow({ where: { id: jobId } });
      await executeJob(jobId);
      expect((await prisma.backgroundJob.findUniqueOrThrow({ where: { id: jobId } })).completedAt).toEqual(finished.completedAt);
      expect((await readJob(jobId, 'another-user', true)).status).toBe(404);
      expect((await readJob(jobId, user.id, true)).status).toBe(200);
      expect((await (await submitJob(req, user.id, 'EXPORT', { format: 'excel' })).json()).error).toBeDefined();
      const pending = await submitJob(new Request('http://localhost/api/backup', { headers: { 'idempotency-key': 'proto-revoked-job' } }), user.id, 'EXPORT', { format: 'json' });
      const pendingId = (await pending.json()).jobId;
      await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
      await executeJob(pendingId);
      expect((await prisma.backgroundJob.findUniqueOrThrow({ where: { id: pendingId } })).status).toBe('FAILED');
    }); } finally { await scope.client?.$disconnect(); }
  });
  it('restoring the same backup always generates a distinct database epoch', async () => {
    const before = (await revision()).generation;
    await restoreDatabase(backup, 'Protocol test first restore'); const first = (await revision()).generation;
    await restoreDatabase(backup, 'Protocol test repeated restore'); const second = (await revision()).generation;
    expect(new Set([before, first, second]).size).toBe(3);
    expect(await prisma.operationReceipt.count()).toBe(0);
  });
});
