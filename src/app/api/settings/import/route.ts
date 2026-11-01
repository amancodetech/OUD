import { prisma } from '@/lib/db';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { importExcelWorkbook } from '@/services/excel-import.service';
import { previewExcelWorkbook } from '@/services/excel-validation';

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'غير مصرح لك باستيراد البيانات (متاح للمدير ADMIN فقط)' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'الرجاء اختيار ملف Excel صالح (.xlsx)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { workerRuntime } = await import('@/lib/request-runtime.mjs');
    if (workerRuntime()) {
      const { submitJob } = await import('@/services/background-jobs.service');
      return submitJob(req, session.id, formData.get('mode') === 'apply' ? 'IMPORT_APPLY' : 'IMPORT_PREVIEW', { fileHash: String(formData.get('fileHash') || ''), databaseRevision: String(formData.get('databaseRevision') || '') }, buffer);
    }
    const state = await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } });
    const revision = `${state.generation}:${state.revision}`;
    const preview = { ...await previewExcelWorkbook(buffer), databaseRevision: revision };
    if (formData.get('mode') !== 'apply') return NextResponse.json(preview);
    if (formData.get('databaseRevision') !== revision) return NextResponse.json({ error: 'تغيرت البيانات؛ أعد المعاينة قبل الاستيراد', code: 'VERSION_CONFLICT' }, { status: 409 });
    if (formData.get('fileHash') !== preview.fileHash) return NextResponse.json({ error: 'تغير الملف؛ أعد المعاينة' }, { status: 409 });

    const result = await importExcelWorkbook(buffer, session.id);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Import failed', err instanceof Error ? err.name : 'Error');
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء استيراد ملف Excel' },
      { status: 503 }
    );
  }
}

export const POST = withApiGuard('POST', '/api/settings/import', handlePOST);
