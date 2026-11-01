import { presetReportPeriod, validReportRange } from '@/domain/report-period';
import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { loadDashboardReportsEngine } from '@/services/ledger-loader';
import { prisma } from '@/lib/db';
import { toDecimal } from '@/domain/decimal';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const setting = await prisma.systemSetting.findFirst();
    const startYear = setting?.startYear ?? 2026;

    const todayStr = todayInStore();
    const defaults = presetReportPeriod('this_month', todayStr, startYear);
    const startDate = searchParams.get('startDate') || defaults.startDate;
    const endDate = searchParams.get('endDate') || defaults.endDate;

    if (validReportRange(startDate, endDate, startYear)) return NextResponse.json({ error: 'فترة التقرير غير صالحة' }, { status: 400 });
    const reports = await loadDashboardReportsEngine(startDate, endDate);

    // Convert Decimals to numbers for JSON serialization
    const serializedCards = {
      netSales: reports.cards.netSales.toNumber(),
      netCOGS: reports.cards.netCOGS.toNumber(),
      grossProfit: reports.cards.grossProfit.toNumber(),
      cashOperatingExpenses: reports.cards.cashOperatingExpenses.toNumber(),
      inventoryLossesAndIssues: reports.cards.inventoryLossesAndIssues.toNumber(),
      otherOperatingAdditions: reports.cards.otherOperatingAdditions.toNumber(),
      operatingProfit: reports.cards.operatingProfit.toNumber(),
      inventoryValue: reports.cards.inventoryValue.toNumber(),
      cashAndBankTotal: reports.cards.cashAndBankTotal.toNumber(),
      cashBalance: reports.cards.cashBalance.toNumber(),
      bankBalance: reports.cards.bankBalance.toNumber(),
      clientDebtTotal: reports.cards.clientDebtTotal.toNumber(),
      supplierDebtTotal: reports.cards.supplierDebtTotal.toNumber(),
      clientCreditTotal: reports.cards.clientCreditTotal.toNumber(),
      supplierCreditTotal: reports.cards.supplierCreditTotal.toNumber(),
      openingEquityDiff: reports.cards.openingEquityDiff.toNumber(),
      cumulativeOperatingProfitSinceStart: reports.cards.cumulativeOperatingProfitSinceStart.toNumber(),
    };

    const serializedMonthlyComparison = reports.monthlyComparison.map((m) => ({
      monthIndex: m.monthIndex,
      year: m.year,
      month: m.month,
      monthName: m.monthName,
      netSales: m.netSales.toNumber(),
      cogs: m.cogs.toNumber(),
      grossProfit: m.grossProfit.toNumber(),
      cashExpenses: m.cashExpenses.toNumber(),
      operatingProfit: m.operatingProfit.toNumber(),
      endingInventoryValue: m.endingInventoryValue.toNumber(),
    }));

    const serializedCategorySales = reports.categorySales.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      categoryPrefix: c.categoryPrefix,
      netSales: c.netSales.toNumber(),
    }));

    return NextResponse.json({
      startDate,
      endDate,
      startYear,
      cards: serializedCards,
      monthlyComparison: serializedMonthlyComparison,
      categorySales: serializedCategorySales,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء تحميل بيانات لوحة المؤشرات والتقارير' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/reports/dashboard', handleGET);
