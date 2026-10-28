import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getDriverReferrals, createDriverReferral } from '@/services/referral.service';
import { getCurrentUser } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const data = await getDriverReferrals({ driverId, startDate, endDate });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب زيارات السائقين' }, { status: 400 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await req.json();
    const result = await createDriverReferral(body, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل تسجيل زيارة العميل' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/drivers/referrals', handleGET);
export const POST = withApiGuard('POST', '/api/drivers/referrals', handlePOST);
