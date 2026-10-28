import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import * as xlsx from 'xlsx';
import { loadReportsEngine, loadCostingEngine, loadBalancesEngine } from '@/services/ledger-loader';
import { logAudit } from '@/services/audit.service';

async function handleGET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح لك بتنزيل النسخة الاحتياطية' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json'; // json | excel

    const { exportDatabase } = await import('@/services/backup.service');
    const snapshot = await exportDatabase();
    const { systemSetting: systemSettings, itemCategory: categories, unitOption: units,
      item: items, party: parties, fixedAsset: fixedAssets, giftPolicy: giftPolicies,
      purchaseInvoice: purchaseInvoices, purchaseLine: purchaseLines, saleInvoice: saleInvoices,
      saleLine: saleLines, cashTransaction: cashTransactions, returnLine: returnLines,
      stockIssue: stockIssues, productionBatch: productionBatches, batchMaterial: batchMaterials,
      driverReferral: driverReferrals, auditLog: auditLogs } = snapshot.data as Record<string, any[]>;
    const dateStr = todayInStore();

    // 1. Export as Excel (.xlsx)
    if (format === 'excel') {
      const wb = xlsx.utils.book_new();

      // Sheet: الأصناف
      const itemsData = items.map((it) => ({
        'كود الصنف': it.code,
        'اسم الصنف': it.name,
        'الدور': it.role,
        'كمية أول المدة': Number(it.openingQty),
        'قيمة أول المدة': Number(it.openingValue),
        'حد إعادة الطلب': Number(it.reorderLevel),
      }));
      const wsItems = xlsx.utils.json_to_sheet(itemsData);
      xlsx.utils.book_append_sheet(wb, wsItems, 'الأصناف');

      // Sheet: الأسماء وبيانات الاتصال
      const partiesData = parties.map((p) => ({
        'الكود': p.code,
        'الاسم': p.name,
        'النوع': p.type,
        'الهاتف': p.phone || '',
        'العنوان': p.address || '',
        'رصيد أول المدة': Number(p.openingBalance),
      }));
      const wsParties = xlsx.utils.json_to_sheet(partiesData);
      xlsx.utils.book_append_sheet(wb, wsParties, 'الأسماء');

      // Sheet: المشتريات
      const purchasesData = purchaseLines.map((pl) => ({
        'كود السطر': pl.code,
        'رقم الفاتورة': pl.invoiceId,
        'كود الصنف': pl.itemId,
        'الكمية': Number(pl.qty),
        'تكلفة الوحدة': Number(pl.unitCost),
        'إجمالي السطر': Number(pl.lineTotalCost),
        'الحالة': pl.status,
      }));
      const wsPurchases = xlsx.utils.json_to_sheet(purchasesData);
      xlsx.utils.book_append_sheet(wb, wsPurchases, 'المشتريات');

      // Sheet: المبيعات
      const salesData = saleLines.map((sl) => ({
        'كود السطر': sl.code,
        'رقم الفاتورة': sl.invoiceId,
        'النوع': sl.lineType,
        'كود الصنف': sl.itemId,
        'الكمية': Number(sl.qty),
        'سعر الوحدة': Number(sl.unitPrice),
        'الخصم': Number(sl.discount),
        'صافي البيع': Number(sl.netSaleAmount),
        'الحالة': sl.status,
      }));
      const wsSales = xlsx.utils.json_to_sheet(salesData);
      xlsx.utils.book_append_sheet(wb, wsSales, 'المبيعات');

      // Sheet: الحسابات والمدفوعات
      const cashData = cashTransactions.map((c) => ({
        'رقم الحركة': c.code,
        'التاريخ': String(c.txDate).slice(0, 10),
        'نوع الحركة': c.type,
        'الحساب': c.account,
        'المبلغ': Number(c.amount),
        'الطرف': parties.find(p => p.id === c.partyId)?.name || '',
        'رقم الفاتورة': c.invoiceKey || '',
        'البيان': c.description || '',
      }));
      const wsCash = xlsx.utils.json_to_sheet(cashData);
      xlsx.utils.book_append_sheet(wb, wsCash, 'الحسابات والمدفوعات');

      // Sheet: المرتجعات
      const returnsData = returnLines.map((r) => ({
        'كود المرتجع': r.code,
        'رقم المستند': r.returnDocNo,
        'التاريخ': String(r.returnDate).slice(0, 10),
        'النوع': r.type,
        'الطرف': parties.find(p => p.id === r.partyId)?.name || '',
        'الفاتورة الأصلية': r.invoiceKey,
        'الكمية': Number(r.qty),
        'الحالة': r.saleReturnCondition || '',
        'السبب': r.reason,
      }));
      const wsReturns = xlsx.utils.json_to_sheet(returnsData);
      xlsx.utils.book_append_sheet(wb, wsReturns, 'المرتجعات');

      // Sheet: عملاء السائقين
      const referralsData = driverReferrals.map((rf) => ({
        'كود الزيارة': rf.code,
        'التاريخ': String(rf.visitDate).slice(0, 10),
        'السائق': parties.find(p => p.id === rf.driverId)?.name || '',
        'هاتف/كود الزائر': rf.visitorUniqueKey,
        'اسم الزائر': rf.visitorName,
        'الحالة': rf.status,
      }));
      const wsReferrals = xlsx.utils.json_to_sheet(referralsData);
      xlsx.utils.book_append_sheet(wb, wsReferrals, 'عملاء السائقين');

      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `oud_erp_export_${dateStr}.xlsx`;

      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // 2. Default: Export as full JSON
    const backupData = snapshot;

    const filename = `oud_erp_backup_${dateStr}.json`;

    return new Response(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء إعداد النسخة الاحتياطية' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  const { restoreDatabase } = await import('@/services/backup.service');
  const { destroySession } = await import('@/lib/auth');
  const input = await req.json();
  if (input.confirmReplace !== true) return NextResponse.json({ error: 'تأكيد استبدال البيانات مطلوب' }, { status: 400 });
  const result = await restoreDatabase(input.backup, input.reason);
  await destroySession();
  return NextResponse.json({ success: true, data: result, message: 'تمت الاستعادة. سجّل الدخول مجددًا.' });
}

export const GET = withApiGuard('GET', '/api/backup', handleGET);
export const POST = withApiGuard('POST', '/api/backup', handlePOST);
