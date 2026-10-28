import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getProductionBatches, createProductionBatch } from '@/services/batch.service';
import { getCurrentUser } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const finishedItemId = searchParams.get('finishedItemId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const data = await getProductionBatches({ finishedItemId, startDate, endDate });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب دفعات التصنيع' }, { status: 400 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }


    const body = await req.json();
    const batch = await createProductionBatch(body, user.id);
    return NextResponse.json(batch, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل حفظ دفعة التصنيع' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/manufacturing', handleGET);
export const POST = withApiGuard('POST', '/api/manufacturing', handlePOST);
