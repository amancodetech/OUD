import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getReturnLines, createReturnLine } from '@/services/return.service';
import { getCurrentUser } from '@/lib/auth';
import { ReturnType } from '@prisma/client';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') as ReturnType) || undefined;
    const partyId = searchParams.get('partyId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const data = await getReturnLines({ type, partyId, startDate, endDate });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب المرتجعات' }, { status: 400 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await req.json();

    const ret = await createReturnLine(body, user.id);
    return NextResponse.json(ret, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل حفظ المرتجع' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/returns', handleGET);
export const POST = withApiGuard('POST', '/api/returns', handlePOST);
