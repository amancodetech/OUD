import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma, withReadSnapshot } from '@/lib/db';
import { validReportRange } from '@/domain/report-period';
import { getSession } from '@/lib/auth';
import { formatDate } from '@/domain/period';
import { toDecimal, zero, Decimal } from '@/domain/decimal';

export interface StatementLine {
  id: string;
  date: string;
  type: string;
  docCode: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

async function handleGET(req: NextRequest, { params }: { params: { id: string } }) {
  return withReadSnapshot(async () => {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);

    const party = await prisma.party.findUnique({
      where: { id },
    });
    if (!party) {
      return NextResponse.json({ error: 'الطرف غير موجود' }, { status: 404 });
    }

    const setting = await prisma.systemSetting.findFirst();
    const startYear = setting?.startYear ?? 2026;

    const startDate = searchParams.get('startDate') || `${startYear}-01-01`;
    const endDate = searchParams.get('endDate') || todayInStore();
    if (validReportRange(startDate, endDate, startYear)) {
      return NextResponse.json({ error: 'فترة كشف الحساب غير صالحة' }, { status: 400 });
    }
    if (!['CLIENT', 'SUPPLIER'].includes(party.type)) {
      return NextResponse.json({ error: 'كشف الحساب متاح للعملاء والموردين' }, { status: 400 });
    }

    // 1. Fetch transactions
    const [saleInvoices, purchaseInvoices, returnLines, cashTxs] = await Promise.all([
      party.type === 'CLIENT'
        ? prisma.saleInvoice.findMany({
            where: { customerId: party.id, status: 'POSTED' },
            include: { lines: { where: { status: 'POSTED' } } },
          })
        : [],
      party.type === 'SUPPLIER'
        ? prisma.purchaseInvoice.findMany({
            where: { supplierId: party.id, status: 'POSTED' },
            include: { lines: { where: { status: 'POSTED' } } },
          })
        : [],
      prisma.returnLine.findMany({
        where: { partyId: party.id, status: 'POSTED' },
        include: { sourceSaleLine: true, sourcePurchaseLine: true },
      }),
      prisma.cashTransaction.findMany({
        where: { partyId: party.id, status: 'POSTED' },
      }),
    ]);

    const rawMovements: Array<{
      id: string;
      date: string;
      type: string;
      docCode: string;
      description: string;
      debit: Decimal;
      credit: Decimal;
    }> = [];

    // 1. Opening Balance
    const opBal = toDecimal(party.openingBalance);
    if (!opBal.isZero()) {
      let debit = zero();
      let credit = zero();
      if (party.type === 'CLIENT') {
        if (opBal.gt(0)) debit = opBal;
        else credit = opBal.abs();
      } else {
        // Supplier
        if (opBal.gt(0)) credit = opBal;
        else debit = opBal.abs();
      }

      rawMovements.push({
        id: `opening-${party.id}`,
        date: `${startYear}-01-01`,
        type: 'رصيد أول المدة',
        docCode: 'افتتاحي',
        description: 'الرصيد المعتمد عند تدشين النظام',
        debit,
        credit,
      });
    }

    // 2. Sales Invoices (for Client: Debit)
    for (const inv of saleInvoices) {
      let netSale = zero();
      for (const l of inv.lines) {
        if (l.lineType === 'SALE') {
          netSale = netSale.plus(toDecimal(l.netSaleAmount));
        }
      }
      if (netSale.gt(0)) {
        rawMovements.push({
          id: `sale-${inv.id}`,
          date: formatDate(inv.invoiceDate),
          type: 'فاتورة بيع',
          docCode: inv.invoiceKey,
          description: inv.notes || `فاتورة بيع رقم ${inv.invoiceKey}`,
          debit: netSale,
          credit: zero(),
        });
      }
    }

    // 3. Purchase Invoices (for Supplier: Credit)
    for (const inv of purchaseInvoices) {
      let netTotal = zero();
      for (const l of inv.lines) {
        netTotal = netTotal.plus(toDecimal(l.lineTotalCost));
      }
      if (netTotal.gt(0)) {
        rawMovements.push({
          id: `purch-${inv.id}`,
          date: formatDate(inv.invoiceDate),
          type: 'فاتورة شراء',
          docCode: inv.invoiceKey,
          description: inv.notes || `فاتورة شراء رقم ${inv.invoiceKey}`,
          debit: zero(),
          credit: netTotal,
        });
      }
    }

    // 4. Returns
    for (const ret of returnLines) {
      const retQty = toDecimal(ret.qty);
      const retDate = formatDate(ret.returnDate);

      if (ret.type === 'SALE_RETURN') {
        // Client Return: Credit to client
        let creditAmount = zero();
        if (ret.sourceSaleLine) {
          const sq = toDecimal(ret.sourceSaleLine.qty);
          const unitP = sq.gt(0) ? toDecimal(ret.sourceSaleLine.netSaleAmount).div(sq) : zero();
          creditAmount = retQty.times(unitP);
        }

        rawMovements.push({
          id: `ret-${ret.id}`,
          date: retDate,
          type: 'إشعار مرتجع بيع',
          docCode: ret.code,
          description: `مرتجع على الفاتورة ${ret.invoiceKey} (${ret.reason})`,
          debit: zero(),
          credit: creditAmount,
        });
      } else {
        // Supplier Return: Debit to supplier
        let retAmount = zero();
        if (ret.supplierCreditNote !== null && ret.supplierCreditNote !== undefined) {
          retAmount = toDecimal(ret.supplierCreditNote);
        } else if (ret.sourcePurchaseLine) {
          const pq = toDecimal(ret.sourcePurchaseLine.qty);
          const unitCost = pq.gt(0)
            ? toDecimal(ret.sourcePurchaseLine.lineTotalCost).div(pq)
            : zero();
          retAmount = retQty.times(unitCost);
        }

        rawMovements.push({
          id: `ret-${ret.id}`,
          date: retDate,
          type: 'إشعار مرتجع شراء',
          docCode: ret.code,
          description: `مرتجع للمورد على الفاتورة ${ret.invoiceKey} (${ret.reason})`,
          debit: retAmount,
          credit: zero(),
        });
      }
    }

    // 5. Cash Transactions
    for (const c of cashTxs) {
      const amt = toDecimal(c.amount);
      const cDate = formatDate(c.txDate);

      if (c.type === 'CUSTOMER_COLLECTION') {
        rawMovements.push({
          id: `cash-${c.id}`,
          date: cDate,
          type: 'سداد نقدي / تحصيل',
          docCode: c.code,
          description: c.description || 'تحصيل دفعة من العميل',
          debit: zero(),
          credit: amt,
        });
      } else if (c.type === 'CUSTOMER_REFUND') {
        rawMovements.push({
          id: `cash-${c.id}`,
          date: cDate,
          type: 'رد مبلغ للعميل',
          docCode: c.code,
          description: c.description || 'رد نقدي للعميل',
          debit: amt,
          credit: zero(),
        });
      } else if (c.type === 'SUPPLIER_PAYMENT') {
        rawMovements.push({
          id: `cash-${c.id}`,
          date: cDate,
          type: 'سداد دفعة للمورد',
          docCode: c.code,
          description: c.description || 'سداد دفعة للمورد',
          debit: amt,
          credit: zero(),
        });
      } else if (c.type === 'SUPPLIER_REFUND') {
        rawMovements.push({
          id: `cash-${c.id}`,
          date: cDate,
          type: 'استرداد نقدي من المورد',
          docCode: c.code,
          description: c.description || 'استرداد نقدي من المورد',
          debit: zero(),
          credit: amt,
        });
      }
    }

    // Sort chronologically
    rawMovements.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    // Compute running signed balance
    let running = zero();
    let openingBalance = zero();
    const statementLines: StatementLine[] = [];

    for (const m of rawMovements) {
      if (m.date > endDate) continue;
      if (party.type === 'CLIENT') {
        running = running.plus(m.debit).minus(m.credit);
      } else {
        // Supplier: Credit increases balance owed, Debit decreases
        running = running.plus(m.credit).minus(m.debit);
      }

      if (m.date < startDate) {
        openingBalance = running;
        continue;
      }

      statementLines.push({
        id: m.id,
        date: m.date,
        type: m.type,
        docCode: m.docCode,
        description: m.description,
        debit: m.debit.toNumber(),
        credit: m.credit.toNumber(),
        runningBalance: running.toNumber(),
      });
    }

    if (!openingBalance.isZero()) {
      const debit = party.type === 'CLIENT' ? openingBalance : openingBalance.negated();
      statementLines.unshift({
        id: `carried-${party.id}`,
        date: startDate,
        type: 'رصيد أول المدة',
        docCode: 'افتتاحي',
        description: 'الرصيد المرحّل قبل بداية فترة الكشف',
        debit: debit.gt(0) ? debit.toNumber() : 0,
        credit: debit.lt(0) ? debit.abs().toNumber() : 0,
        runningBalance: openingBalance.toNumber(),
      });
    }

    const totalDebit = statementLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = statementLines.reduce((sum, l) => sum + l.credit, 0);

    return NextResponse.json({
      party: {
        id: party.id,
        code: party.code,
        name: party.name,
        nameEn: party.nameEn,
        type: party.type,
        phone: party.phone,
        address: party.address,
        country: party.country,
      },
      startDate,
      endDate,
      openingBalance: openingBalance.toNumber(),
      statementLines,
      totalDebit,
      totalCredit,
      finalBalance: running.toNumber(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء إعداد كشف الحساب' },
      { status: 400 }
    );
  }
  });
}

export const GET = withApiGuard('GET', '/api/parties/[id]/statement', handleGET);
