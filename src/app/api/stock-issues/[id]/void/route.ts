import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { voidStockIssue } from '@/services/stock-issue.service';
import { getCurrentUser } from '@/lib/auth';

async function handlePOST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }


    const { reason } = await req.json();
    const updated = await voidStockIssue(params.id, reason, user.id);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل إلغاء إذن الصرف' }, { status: 400 });
  }
}

export const POST = withApiGuard('POST', '/api/stock-issues/[id]/void', handlePOST);
