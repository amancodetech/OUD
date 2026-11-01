
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';




async function handleGET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح لك بتنزيل النسخة الاحتياطية' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json'; // json | excel

    const { workerRuntime } = await import('@/lib/request-runtime.mjs');
    if (workerRuntime()) {
      const { submitJob } = await import('@/services/background-jobs.service');
      return submitJob(req, session.id, 'EXPORT', { format });
    }
    const { backupResponse } = await import('@/services/backup-export.service');
    return backupResponse(format);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء إعداد النسخة الاحتياطية' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  const { restoreDatabase } = await import('@/services/backup.service');
  const { destroySession } = await import('@/lib/auth');
  const input = await req.json();
  if (input.confirmReplace !== true) return NextResponse.json({ error: 'تأكيد استبدال البيانات مطلوب' }, { status: 400 });
  const { workerRuntime } = await import('@/lib/request-runtime.mjs');
  if (workerRuntime()) {
    const session = await getSession();
    const { validateBackup } = await import('@/services/backup.service');
    validateBackup(input.backup);
    const { submitJob } = await import('@/services/background-jobs.service');
    return submitJob(req, session!.id, 'RESTORE', { reason: input.reason }, Buffer.from(JSON.stringify(input.backup)));
  }
  const result = await restoreDatabase(input.backup, input.reason);
  await destroySession();
  return NextResponse.json({ success: true, data: result, message: 'تمت الاستعادة. سجّل الدخول مجددًا.' });
}

export const GET = withApiGuard('GET', '/api/backup', handleGET);
export const POST = withApiGuard('POST', '/api/backup', handlePOST);
