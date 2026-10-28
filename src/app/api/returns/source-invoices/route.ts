import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { prisma } from '@/lib/db';

// Return operators need source identifiers and totals, not the sales-management response.
export const GET = withApiGuard('GET', '/api/returns/source-invoices', async (req: NextRequest) => {
  const query = new URL(req.url).searchParams;
  const partyId = query.get('partyId');
  const type = query.get('type');
  if (!partyId || !['SALE_RETURN', 'PURCHASE_RETURN'].includes(type || '')) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  if (type === 'PURCHASE_RETURN') {
    const rows = await prisma.purchaseInvoice.findMany({
      where: { supplierId: partyId, status: 'POSTED', lines: { some: { status: 'POSTED' } } },
      orderBy: { invoiceDate: 'desc' },
      select: { id: true, invoiceNo: true, invoiceKey: true, invoiceDate: true,
        lines: { where: { status: 'POSTED' }, select: { lineTotalCost: true } } },
    });
    return NextResponse.json(rows.map(({ lines, ...row }) => ({ ...row, netTotal: lines.reduce((total, line) => total + Number(line.lineTotalCost), 0) })));
  }
  const rows = await prisma.saleInvoice.findMany({
    where: { customerId: partyId, status: 'POSTED', lines: { some: { status: 'POSTED', lineType: 'SALE' } } },
    orderBy: { invoiceDate: 'desc' },
    select: { id: true, invoiceNo: true, invoiceKey: true, invoiceDate: true,
      lines: { where: { status: 'POSTED', lineType: 'SALE' }, select: { netSaleAmount: true } } },
  });
  return NextResponse.json(rows.map(({ lines, ...row }) => ({ ...row, netTotal: lines.reduce((total, line) => total + Number(line.netSaleAmount), 0) })));
});
