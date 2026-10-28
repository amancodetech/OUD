import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { voidProductionBatch } from '@/services/batch.service';
import { getCurrentUser } from '@/lib/auth';

async function handlePOST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }


    const { reason } = await req.json();
    const updated = await voidProductionBatch(params.id, reason, user.id);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل إلغاء دفعة التصنيع' }, { status: 400 });
  }
}

export const POST = withApiGuard('POST', '/api/manufacturing/[id]/void', handlePOST);
