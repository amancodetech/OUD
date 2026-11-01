import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { loadAllLedgerData, loadBalancesEngine, loadCostingEngine } from '@/services/ledger-loader';
import { toDecimal, zero } from '@/domain/decimal';
import { formatDate } from '@/domain/period';

async function handleGET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const todayStr = searchParams.get('date') || todayInStore();
    const dateObj = new Date(todayStr);

    const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);

    // 1. Single ledger load for both engines (prevents duplicate queries of 13 tables)
    const ledgerData = await loadAllLedgerData();

    // 2. Sales & Purchases Today
    const [salesToday, purchasesToday] = await Promise.all([
      prisma.saleInvoice.findMany({
        where: {
          invoiceDate: { gte: startOfDay, lte: endOfDay },
          status: 'POSTED',
        },
        include: { lines: { where: { status: 'POSTED' } } },
      }),
      prisma.purchaseInvoice.findMany({
        where: {
          invoiceDate: { gte: startOfDay, lte: endOfDay },
          status: 'POSTED',
        },
        include: { lines: { where: { status: 'POSTED' } } },
      }),
    ]);

    let salesTotal = zero();
    for (const inv of salesToday) {
      for (const line of inv.lines) {
        if (line.lineType === 'SALE') {
          salesTotal = salesTotal.plus(toDecimal(line.netSaleAmount));
        }
      }
    }

    let purchasesTotal = zero();
    for (const inv of purchasesToday) {
      for (const line of inv.lines) {
        purchasesTotal = purchasesTotal.plus(toDecimal(line.lineTotalCost));
      }
    }

    // 3. Balances Engine as of Today (Cash & Bank Book Balances)
    const balances = await loadBalancesEngine(todayStr, ledgerData);

    // 4. Returns Today
    const returnsToday = await prisma.returnLine.findMany({
      where: {
        returnDate: { gte: startOfDay, lte: endOfDay },
        status: 'POSTED',
      },
    });

    let returnGoodCount = 0;
    let returnDamagedCount = 0;
    for (const ret of returnsToday) {
      if (ret.saleReturnCondition === 'GOOD') returnGoodCount++;
      if (ret.saleReturnCondition === 'DAMAGED') returnDamagedCount++;
    }

    // 5. Stock Issues & Manufacturing Today
    const [issuesToday, batchesToday] = await Promise.all([
      prisma.stockIssue.findMany({
        where: {
          issueDate: { gte: startOfDay, lte: endOfDay },
          status: 'POSTED',
        },
      }),
      prisma.productionBatch.findMany({
        where: {
          completionDate: { gte: startOfDay, lte: endOfDay },
          status: 'POSTED',
        },
      }),
    ]);

    // 6. Due & Overdue Invoices
    const overdueInvoices = balances.invoiceItems.filter(
      (inv) => inv.invoiceDebt.gt(0) && inv.daysOverdue > 0
    );
    const dueTodayInvoices = balances.invoiceItems.filter(
      (inv) => inv.invoiceDebt.gt(0) && inv.dueDate === todayStr
    );

    // 7. Cost Check & Stock Health
    const costing = await loadCostingEngine(undefined, ledgerData);
    let costAlertCount = 0;
    let negativeStockCount = 0;

    for (const it of ledgerData.items) {
      const state = costing.getItemEndingState(it.id, costing.maxMonthIndex);
      if (state.COST_CHECK && state.COST_CHECK.trim() !== '') costAlertCount++;
      if (state.EQ.lt(0)) negativeStockCount++;
    }

    return NextResponse.json({
      date: todayStr,
      sales: {
        count: salesToday.length,
        totalAmount: salesTotal.toNumber(),
      },
      purchases: {
        count: purchasesToday.length,
        totalAmount: purchasesTotal.toNumber(),
      },
      cashAndBank: {
        cashBalance: balances.cashBalance.toNumber(),
        bankBalance: balances.bankBalance.toNumber(),
        totalBalance: balances.cashAndBankTotal.toNumber(),
      },
      returns: {
        count: returnsToday.length,
        goodCount: returnGoodCount,
        damagedCount: returnDamagedCount,
      },
      stockIssues: {
        count: issuesToday.length,
      },
      manufacturing: {
        batchesCount: batchesToday.length,
      },
      debts: {
        dueTodayCount: dueTodayInvoices.length,
        overdueCount: overdueInvoices.length,
      },
      health: {
        costAlertCount,
        negativeStockCount,
        isHealthy: costAlertCount === 0 && negativeStockCount === 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء تحميل بيانات المراجعة اليومية' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/reports/daily-closing', handleGET);
