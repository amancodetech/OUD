import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getDriverGiftsSummary } from '@/services/referral.service';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get('asOfDate') || undefined;

    const data = await getDriverGiftsSummary(asOfDate);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب ملخص هدايا السائقين' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/drivers/summary', handleGET);
