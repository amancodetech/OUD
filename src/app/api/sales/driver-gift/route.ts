import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createDriverGiftDelivery } from '@/services/sale.service';
import { getCurrentUser } from '@/lib/auth';

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await req.json();
    const result = await createDriverGiftDelivery(body, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل تسجيل تسليم الهدية العينية' }, { status: 400 });
  }
}

export const POST = withApiGuard('POST', '/api/sales/driver-gift', handlePOST);
