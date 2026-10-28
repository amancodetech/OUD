import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loadBalancesEngine } from '@/services/ledger-loader';
import { toDecimal } from '@/domain/decimal';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get('asOfDate') || todayInStore();
    const partyType = searchParams.get('type') || 'ALL'; // ALL | CLIENT | SUPPLIER
    const statusFilter = searchParams.get('status') || 'ALL'; // ALL | DEBT | CREDIT | SETTLED

    const [balances, dbParties] = await Promise.all([
      loadBalancesEngine(asOfDate),
      prisma.party.findMany({ select: { id: true, nameEn: true, supplierCategoryEn: true } }),
    ]);

    const partyEnMap = new Map(dbParties.map((p) => [p.id, p.nameEn]));
    const supplierCatEnMap = new Map(dbParties.map((p) => [p.id, p.supplierCategoryEn]));

    // 1. Filter Party Summaries
    const partySummaries = balances.partySummaries
      .filter((p) => {
        if (partyType !== 'ALL' && p.partyType !== partyType) return false;
        if (statusFilter === 'DEBT') return p.partyDebtAsOf.gt(0);
        if (statusFilter === 'CREDIT') return p.partyCreditAsOf.gt(0);
        if (statusFilter === 'SETTLED') return p.partyDebtAsOf.isZero() && p.partyCreditAsOf.isZero();
        return true;
      })
      .map((p) => ({
        partyId: p.partyId,
        partyCode: p.partyCode,
        partyName: p.partyName,
        partyNameEn: partyEnMap.get(p.partyId) || p.partyNameEn || null,
        supplierCategory: p.supplierCategory || null,
        supplierCategoryEn: supplierCatEnMap.get(p.partyId) || p.supplierCategoryEn || null,
        partyType: p.partyType,
        totalInvoicedAsOf: p.totalInvoicedAsOf ? p.totalInvoicedAsOf.toNumber() : p.partyDebtAsOf.toNumber(),
        totalSettledAsOf: p.totalSettledAsOf ? p.totalSettledAsOf.toNumber() : 0,
        partyDebtAsOf: p.partyDebtAsOf.toNumber(),
        partyCreditAsOf: p.partyCreditAsOf.toNumber(),
        partySignedAsOf: p.partySignedAsOf.toNumber(),
        uncoveredAsOf: p.uncoveredAsOf.toNumber(),
        coverageAsOf: p.coverageAsOf,
        prepaymentAsOf: p.prepaymentAsOf.toNumber(),
        unallocatedAsOf: p.unallocatedAsOf.toNumber(),
        reconciliationAsOf: p.reconciliationAsOf.toNumber(),
      }));

    // 2. Filter Invoices Aging
    const invoiceItems = balances.invoiceItems
      .filter((inv) => {
        if (partyType !== 'ALL' && inv.partyType !== partyType) return false;
        if (statusFilter === 'DEBT') return inv.invoiceDebt.gt(0);
        if (statusFilter === 'CREDIT') return inv.invoiceCredit.gt(0);
        if (statusFilter === 'SETTLED') return inv.invoiceDebt.isZero() && inv.invoiceCredit.isZero();
        return true;
      })
      .map((inv) => ({
        partyId: inv.partyId,
        partyCode: inv.partyCode,
        partyName: inv.partyName,
        partyNameEn: partyEnMap.get(inv.partyId) || inv.partyNameEn || null,
        supplierCategory: inv.supplierCategory || null,
        supplierCategoryEn: supplierCatEnMap.get(inv.partyId) || inv.supplierCategoryEn || null,
        partyType: inv.partyType,
        invoiceKey: inv.invoiceKey,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        reportClass: inv.reportClass,
        originalAsOf: inv.originalAsOf.toNumber(),
        returnsAsOf: inv.returnsAsOf.toNumber(),
        settlementAsOf: inv.settlementAsOf.toNumber(),
        refundAsOf: inv.refundAsOf.toNumber(),
        signedAsOf: inv.signedAsOf.toNumber(),
        invoiceDebt: inv.invoiceDebt.toNumber(),
        invoiceCredit: inv.invoiceCredit.toNumber(),
        daysOverdue: inv.daysOverdue,
        aging: inv.aging,
      }));

    const totalClientDebt = balances.partySummaries
      .filter((p) => p.partyType === 'CLIENT')
      .reduce((sum, p) => sum + p.partyDebtAsOf.toNumber(), 0);

    const totalSupplierDebt = balances.partySummaries
      .filter((p) => p.partyType === 'SUPPLIER')
      .reduce((sum, p) => sum + p.partyDebtAsOf.toNumber(), 0);

    return NextResponse.json({
      asOfDate,
      partySummaries,
      invoiceItems,
      totalClientDebt,
      totalSupplierDebt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء تحميل تقرير المديونية' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/debts', handleGET);
