import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getSystemNotifications } from '@/services/notification.service';
import { getSession } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get('asOfDate') || undefined;

    const data = await getSystemNotifications(asOfDate);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'فشل جلب التنبيهات' },
      { status: 500 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/notifications', handleGET);
