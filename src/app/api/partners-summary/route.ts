import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { loadReportsEngine } from '@/services/ledger-loader';
import { getFixedAssetsWithAdditions } from '@/services/master.service';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get('asOfDate') || todayInStore();
    const startDate = `${asOfDate.slice(0, 4)}-01-01`;

    const [reports, assetsData] = await Promise.all([
      loadReportsEngine(startDate, asOfDate),
      getFixedAssetsWithAdditions(asOfDate),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        partnersSummary: reports.partnersSummary,
        openingEquitySummary: reports.openingEquitySummary,
        assetsData,
        asOfDate,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'خطأ في جلب بيانات الشركاء والأصول' },
      { status: 500 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/partners-summary', handleGET);
