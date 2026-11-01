import crypto from 'node:crypto';
import { prisma, withLedgerTransaction } from '@/lib/db';
import { workerRuntime } from '@/lib/request-runtime.mjs';
import { backupResponse } from './backup-export.service';
import { restoreDatabase } from './backup.service';
import { importExcelWorkbook } from './excel-import.service';
import { previewExcelWorkbook } from './excel-validation';

export type JobKind = 'EXPORT' | 'RESTORE' | 'IMPORT_PREVIEW' | 'IMPORT_APPLY';
function bindings() {
  const env = workerRuntime()?.bindings;
  if (!env?.JOB_FILES || !env?.JOBS) throw new Error('Background services are not configured');
  return env;
}
export async function submitJob(request: Request, userId: string, kind: JobKind, metadata: Record<string, string>, input?: Uint8Array) {
  const env = bindings();
  const key = request.headers.get('idempotency-key');
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return Response.json({ error: 'مفتاح العملية مطلوب' }, { status: 400 });
  const id = crypto.createHash('sha256').update(`${userId}:${kind}:${key}`).digest('hex');
  const hash = crypto.createHash('sha256').update(JSON.stringify(metadata)).update(input ?? '').digest('hex');
  const job = await withLedgerTransaction(async () => {
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    if (session?.id !== userId || session.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
    const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!current.isActive || current.role !== 'ADMIN') throw new Error('FORBIDDEN');
    const existing = await prisma.backgroundJob.findUnique({ where: { id } });
    if (existing) return existing;
    // Admission control avoids unbounded private file storage and CPU jobs.
    if (await prisma.backgroundJob.count({ where: { status: 'QUEUED' } }) >= 10) throw new Error('توجد مهام قيد التنفيذ؛ انتظر اكتمالها');
    const inputKey = input ? `jobs/${id}/input` : null;
    if (inputKey) await env.JOB_FILES.put(inputKey, input);
    return prisma.backgroundJob.create({ data: { id, userId, kind, hash, metadata, inputKey, sessionGeneration: current.sessionGeneration, sessionVersion: current.sessionVersion } });
  }, false);
  if (job.hash !== hash) return Response.json({ error: 'مفتاح مستخدم لمحتوى مختلف' }, { status: 409 });
  // Only send after commit. A retry after a send failure re-enqueues the same ID.
  // Queue redelivery is safe: completion and accounting changes commit together.
  if (job.status === 'QUEUED') await env.JOBS.send({ id });
  return Response.json({ jobId: id, status: job.status }, { status: 202 });
}
export async function executeJob(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid job ID');
  const env = bindings();
  await withLedgerTransaction(async () => {
    const job = await prisma.backgroundJob.findUnique({ where: { id } });
    if (!job || job.status !== 'QUEUED') return;
    const user = await prisma.user.findUnique({ where: { id: job.userId } });
    if (!user?.isActive || user.role !== 'ADMIN' || user.sessionGeneration !== job.sessionGeneration || user.sessionVersion !== job.sessionVersion) {
      await prisma.backgroundJob.update({ where: { id }, data: { status: 'FAILED', completedAt: new Date() } });
      return;
    }
    if (Date.now() - job.createdAt.getTime() > 86400000) {
      await prisma.backgroundJob.update({ where: { id }, data: { status: 'EXPIRED', completedAt: new Date() } });
      return;
    }
    const metadata = job.metadata as Record<string, string>;
    const object = job.inputKey ? await env.JOB_FILES.get(job.inputKey) : undefined;
    const input = object ? Buffer.from(await object.arrayBuffer()) : undefined;
    let result: Response;
    if (job.kind === 'EXPORT') result = await backupResponse(metadata.format);
    else if (job.kind === 'RESTORE') {
      if (!input) throw new Error('Missing backup');
      const restored = await restoreDatabase(JSON.parse(input.toString()), metadata.reason);
      result = Response.json({ success: true, data: restored, message: 'تمت الاستعادة؛ سجل الدخول مجددًا' });
    } else {
      if (!input) throw new Error('Missing workbook');
      const state = await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
      const revision = `${state.generation}:${state.revision}`;
      const preview = { ...await previewExcelWorkbook(input), databaseRevision: revision };
      if (job.kind === 'IMPORT_APPLY') {
        if (metadata.databaseRevision !== revision) throw new Error('Database changed since preview');
        if (metadata.fileHash !== preview.fileHash) throw new Error('Workbook changed');
        result = Response.json(await importExcelWorkbook(input, user.id));
      } else if (job.kind === 'IMPORT_PREVIEW') result = Response.json(preview);
      else throw new Error('Invalid job kind');
    }
    const bytes = await result.arrayBuffer();
    if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('Export exceeds 32 MB; use the external PostgreSQL backup runner');
    const resultKey = `jobs/${id}/result`;
    await env.JOB_FILES.put(resultKey, bytes, { httpMetadata: { contentType: result.headers.get('content-type') || 'application/json', contentDisposition: result.headers.get('content-disposition') || '' } });
    await prisma.backgroundJob.update({ where: { id }, data: { status: 'SUCCEEDED', resultKey, completedAt: new Date() } });
  }, false);
}
export async function failJob(id: string) {
  // Called only after transaction rollback and exhausted queue retries.
  await prisma.backgroundJob.updateMany({ where: { id, status: 'QUEUED' }, data: { status: 'FAILED', completedAt: new Date() } });
}
export async function cleanupJobs() {
  const env = bindings();
  const jobs = await prisma.backgroundJob.findMany({ where: { createdAt: { lt: new Date(Date.now() - 86400000) }, OR: [{ inputKey: { not: null } }, { resultKey: { not: null } }] }, take: 100 });
  for (const job of jobs) {
    await env.JOB_FILES.delete([job.inputKey, job.resultKey].filter(Boolean));
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { inputKey: null, resultKey: null, metadata: {}, status: 'EXPIRED' } });
  }
}
export async function readJob(id: string, userId: string, download: boolean) {
  const job = await prisma.backgroundJob.findFirst({ where: { id, userId } });
  if (!job) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (Date.now() - job.createdAt.getTime() > 86400000) return Response.json({ error: 'انتهت مدة الاحتفاظ بالملف' }, { status: 410 });
  if (!download) return Response.json({ jobId: id, status: job.status, kind: job.kind });
  if (job.status !== 'SUCCEEDED' || !job.resultKey) return Response.json({ error: 'النتيجة غير متاحة' }, { status: 409 });
  const file = await bindings().JOB_FILES.get(job.resultKey);
  if (!file) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  return new Response(file.body, { headers: { 'Content-Type': file.httpMetadata?.contentType || 'application/json', 'Content-Disposition': file.httpMetadata?.contentDisposition || 'inline' } });
}
