import { notificationProjections } from './notification-projections';
import { todayInStore } from '@/domain/period';
import { getSetupStatus } from './settings.service';
import { formatMoney } from '@/domain/decimal';
import { getMonthIndex } from '@/domain/period';

export type NotificationCategory = 'INVENTORY' | 'DEBTS' | 'DRIVERS' | 'FINANCIAL' | 'SETUP';
export type NotificationSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface SystemNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  titleAr: string;
  titleId: string;
  titleEn: string;
  description: string;
  descriptionAr: string;
  descriptionId: string;
  descriptionEn: string;
  actionUrl: string;
  actionLabel: string;
  actionLabelAr: string;
  actionLabelId: string;
  actionLabelEn: string;
  createdAt: string;
}

export interface NotificationSummary {
  notifications: SystemNotification[];
  counts: {
    critical: number;
    warning: number;
    info: number;
    total: number;
    byCategory: Record<NotificationCategory, number>;
  };
}

export type SystemNotificationCounts = NotificationSummary['counts'];

export async function getSystemNotifications(asOfDate?: string): Promise<NotificationSummary> {
  const todayStr = asOfDate || todayInStore();
  const [{ data: ledgerData, costing, balances, driverResult, reports, limited }, setupStatus] = await Promise.all([
    notificationProjections(todayStr), getSetupStatus(),
  ]);
  const startYear = ledgerData.systemSetting.startYear;

  const notifications: SystemNotification[] = [];
  const now = new Date().toISOString();

  // 1. SETUP STATUS NOTIFICATION
  if (!setupStatus.isComplete) {
    notifications.push({
      id: 'setup-incomplete',
      category: 'SETUP',
      severity: 'WARNING',
      title: 'التهيئة الأولية للنظام غير مكتملة',
      titleAr: 'التهيئة الأولية للنظام غير مكتملة',
      titleId: 'Pengaturan Awal Sistem Belum Selesai',
      titleEn: 'Initial System Setup Incomplete',
      description: setupStatus.message,
      descriptionAr: setupStatus.message,
      descriptionId: `Pengaturan belum lengkap (${setupStatus.missingItems.join(', ')})`,
      descriptionEn: `Setup incomplete (${setupStatus.missingItems.join(', ')})`,
      actionUrl: '/setup',
      actionLabel: 'إكمال معالج التهيئة',
      actionLabelAr: 'إكمال معالج التهيئة ←',
      actionLabelId: 'Lengkapi Pengaturan ←',
      actionLabelEn: 'Complete Setup ←',
      createdAt: now,
    });
  }

  // 2. FINANCIAL & EQUITY NOTIFICATIONS
  if (!reports.cards.openingEquityDiff.isZero()) {
    const diffFormatted = formatMoney(reports.cards.openingEquityDiff);
    notifications.push({
      id: 'equity-discrepancy',
      category: 'FINANCIAL',
      severity: 'CRITICAL',
      title: 'فارق في مطابقة حقوق الملكية الافتتاحية',
      titleAr: 'فارق في مطابقة حقوق الملكية الافتتاحية',
      titleId: 'Selisih Rekonsiliasi Ekuitas Pembukaan',
      titleEn: 'Opening Equity Allocation Discrepancy',
      description: `يوجد فارق تأسيس غير موزع قدره (${diffFormatted}) بين أصول البداية ورؤوس أموال الشركاء`,
      descriptionAr: `يوجد فارق تأسيس غير موزع قدره (${diffFormatted}) بين أصول البداية ورؤوس أموال الشركاء`,
      descriptionId: `Terdapat selisih modal awal sebesar (${diffFormatted}) antara aset awal dan modal mitra`,
      descriptionEn: `There is an unallocated opening equity difference of (${diffFormatted})`,
      actionUrl: '/partners',
      actionLabel: 'مطابقة حقوق التأسيس',
      actionLabelAr: 'مطابقة حقوق التأسيس ←',
      actionLabelId: 'Buka Rekonsiliasi Ekuitas ←',
      actionLabelEn: 'Reconcile Opening Equity ←',
      createdAt: now,
    });
  }

  if (balances.cashBalance.isNegative()) {
    const amt = formatMoney(balances.cashBalance.abs());
    notifications.push({
      id: 'cash-negative',
      category: 'FINANCIAL',
      severity: 'CRITICAL',
      title: 'عجز نقدي في رصيد الخزينة',
      titleAr: 'عجز نقدي في رصيد الخزينة',
      titleId: 'Saldo Kas Mengalami Defisit',
      titleEn: 'Cash Register Deficit Alert',
      description: `رصيد الخزينة الدفتري بالسالب بمقدار ${amt}`,
      descriptionAr: `رصيد الخزينة الدفتري بالسالب بمقدار ${amt}`,
      descriptionId: `Saldo kas bernilai negatif sebesar ${amt}`,
      descriptionEn: `Book cash balance is negative by ${amt}`,
      actionUrl: '/cash',
      actionLabel: 'معاينة الصندوق',
      actionLabelAr: 'معاينة الصندوق والمدفوعات ←',
      actionLabelId: 'Buka Buku Kas ←',
      actionLabelEn: 'Review Cash Ledger ←',
      createdAt: now,
    });
  }

  if (balances.bankBalance.isNegative()) {
    const amt = formatMoney(balances.bankBalance.abs());
    notifications.push({
      id: 'bank-negative',
      category: 'FINANCIAL',
      severity: 'CRITICAL',
      title: 'عجز في رصيد الحساب البنكي',
      titleAr: 'عجز في رصيد الحساب البنكي',
      titleId: 'Saldo Rekening Bank Defisit',
      titleEn: 'Bank Account Deficit Alert',
      description: `رصيد البنك الدفتري بالسالب بمقدار ${amt}`,
      descriptionAr: `رصيد البنك الدفتري بالسالب بمقدار ${amt}`,
      descriptionId: `Saldo bank bernilai negatif sebesar ${amt}`,
      descriptionEn: `Book bank balance is negative by ${amt}`,
      actionUrl: '/cash',
      actionLabel: 'معاينة البنك',
      actionLabelAr: 'معاينة الصندوق والمدفوعات ←',
      actionLabelId: 'Buka Buku Kas ←',
      actionLabelEn: 'Review Bank Ledger ←',
      createdAt: now,
    });
  }

  // 3. INVENTORY & STOCK NOTIFICATIONS
  const currentMonthIdx = getMonthIndex(todayStr, startYear);
  for (const item of ledgerData.items) {
    if (item.isActive === false) continue;
    let state;
    try {
      state = costing.getItemEndingState(item.id, currentMonthIdx);
    } catch {
      continue;
    }
    const avail = state.EQ;
    const reorder = item.reorderLevel ? item.reorderLevel.toNumber() : 0;
    const availNum = avail.toNumber();

    if (state.COST_CHECK && state.COST_CHECK !== '') {
      notifications.push({
        id: `cost-check-${item.id}`,
        category: 'INVENTORY',
        severity: 'CRITICAL',
        title: `خلل في سلامة التكلفة: ${item.name}`,
        titleAr: `خلل في سلامة التكلفة: ${item.name} (${item.code})`,
        titleId: `Integritas Biaya Terganggu: ${item.name} (${item.code})`,
        titleEn: `Cost Integrity Issue: ${item.name} (${item.code})`,
        description: `تنبيه التكلفة والمخزون: ${state.COST_CHECK}`,
        descriptionAr: `تنبيه التكلفة والمخزون: ${state.COST_CHECK}`,
        descriptionId: `Peringatan HPP & Stok: ${state.COST_CHECK}`,
        descriptionEn: `Cost & Stock Warning: ${state.COST_CHECK}`,
        actionUrl: `/inventory/${item.id}`,
        actionLabel: 'كارت الصنف',
        actionLabelAr: 'فحص كارت الصنف ←',
        actionLabelId: 'Periksa Kartu Stok ←',
        actionLabelEn: 'Inspect Stock Card ←',
        createdAt: now,
      });
    }

    if (availNum <= 0) {
      notifications.push({
        id: `stock-empty-${item.id}`,
        category: 'INVENTORY',
        severity: 'CRITICAL',
        title: `نفاد مخزون: ${item.name}`,
        titleAr: `نفاد مخزون: ${item.name} (${item.code})`,
        titleId: `Stok Habis: ${item.name} (${item.code})`,
        titleEn: `Out of Stock: ${item.name} (${item.code})`,
        description: `الرصيد المتاح حالياً صفر (${availNum}) — يجب إنشاء أمر شراء عاجل`,
        descriptionAr: `الرصيد المتاح حالياً صفر (${availNum}) — يجب إنشاء أمر شراء عاجل`,
        descriptionId: `Stok saat ini habis (${availNum}) — segera buat pesanan pembelian`,
        descriptionEn: `Current stock is exhausted (${availNum}) — create purchase order`,
        actionUrl: '/purchases/new',
        actionLabel: 'طلب شراء عاجل',
        actionLabelAr: 'إنشاء فاتورة شراء ←',
        actionLabelId: 'Buat Faktur Beli ←',
        actionLabelEn: 'Create Purchase ←',
        createdAt: now,
      });
    } else if (reorder > 0 && availNum <= reorder) {
      notifications.push({
        id: `stock-low-${item.id}`,
        category: 'INVENTORY',
        severity: 'WARNING',
        title: `اقتراب نفاد المخزون: ${item.name}`,
        titleAr: `اقتراب نفاد المخزون: ${item.name} (${item.code})`,
        titleId: `Stok Menipis: ${item.name} (${item.code})`,
        titleEn: `Low Stock Alert: ${item.name} (${item.code})`,
        description: `الرصيد المتاح (${availNum}) وصل إلى حد التنبيه للنواقص (${reorder})`,
        descriptionAr: `الرصيد المتاح (${availNum}) وصل إلى حد التنبيه للنواقص (${reorder})`,
        descriptionId: `Stok tersedia (${availNum}) telah mencapai batas minimum (${reorder})`,
        descriptionEn: `Available stock (${availNum}) reached reorder threshold (${reorder})`,
        actionUrl: '/inventory',
        actionLabel: 'معاينة المخزون',
        actionLabelAr: 'معاينة بطاقة المخزون ←',
        actionLabelId: 'Lihat Kartu Stok ←',
        actionLabelEn: 'View Inventory ←',
        createdAt: now,
      });
    }
  }

  // 4. DEBTS & OVERDUE INVOICES
  for (const inv of balances.invoiceItems) {
    if (inv.invoiceDebt.lte(0)) continue;

    const invKeySafe = inv.invoiceKey || 'افتتاحي';
    if (inv.partyType === 'CLIENT' && inv.daysOverdue > 0) {
      const debtFormatted = formatMoney(inv.invoiceDebt);
      const isUrgent = inv.daysOverdue >= 30;
      notifications.push({
        id: `overdue-sale-${inv.partyId}-${invKeySafe}`,
        category: 'DEBTS',
        severity: isUrgent ? 'CRITICAL' : 'WARNING',
        title: `فاتورة مبيعات متأخرة: ${invKeySafe}`,
        titleAr: `فاتورة مبيعات متأخرة: ${invKeySafe} — ${inv.partyName}`,
        titleId: `Faktur Penjualan Jatuh Tempo: ${invKeySafe} — ${inv.partyName}`,
        titleEn: `Overdue Customer Invoice: ${invKeySafe} — ${inv.partyName}`,
        description: `مستحق غير مسدد بقيمة ${debtFormatted} متأخر منذ ${inv.daysOverdue} يوم (استحقاق: ${inv.dueDate || '-'})`,
        descriptionAr: `مستحق غير مسدد بقيمة ${debtFormatted} متأخر منذ ${inv.daysOverdue} يوم (استحقاق: ${inv.dueDate || '-'})`,
        descriptionId: `Tagihan belum lunas ${debtFormatted} lewat jatuh tempo ${inv.daysOverdue} hari`,
        descriptionEn: `Unpaid balance of ${debtFormatted} overdue by ${inv.daysOverdue} days`,
        actionUrl: `/debts`,
        actionLabel: 'متابعة الديون',
        actionLabelAr: 'متابعة الديون والتحصيل ←',
        actionLabelId: 'Pantau Piutang ←',
        actionLabelEn: 'Follow up Debts ←',
        createdAt: now,
      });
    } else if (inv.partyType === 'SUPPLIER' && (inv.daysOverdue >= 0 || inv.dueDate === todayStr)) {
      const debtFormatted = formatMoney(inv.invoiceDebt);
      notifications.push({
        id: `due-purchase-${inv.partyId}-${invKeySafe}`,
        category: 'DEBTS',
        severity: 'WARNING',
        title: `فاتورة مشتريات مستحقة للمورد: ${inv.partyName}`,
        titleAr: `فاتورة مشتريات مستحقة: ${invKeySafe} للمورد ${inv.partyName}`,
        titleId: `Faktur Pembelian Jatuh Tempo: ${invKeySafe} — ${inv.partyName}`,
        titleEn: `Due Supplier Invoice: ${invKeySafe} — ${inv.partyName}`,
        description: `مبلغ مستحق للمورد قدره ${debtFormatted} (تاريخ الاستحقاق: ${inv.dueDate || todayStr})`,
        descriptionAr: `مبلغ مستحق للمورد قدره ${debtFormatted} (تاريخ الاستحقاق: ${inv.dueDate || todayStr})`,
        descriptionId: `Utang supplier ${debtFormatted} jatuh tempo pada ${inv.dueDate || todayStr}`,
        descriptionEn: `Supplier balance of ${debtFormatted} due on ${inv.dueDate || todayStr}`,
        actionUrl: `/debts`,
        actionLabel: 'سداد المورد',
        actionLabelAr: 'سداد المورد في الديون ←',
        actionLabelId: 'Bayar Utang Supplier ←',
        actionLabelEn: 'Pay Supplier Debt ←',
        createdAt: now,
      });
    }
  }

  // Pending credit balances for clients
  for (const client of balances.partySummaries) {
    if (client.partyType === 'CLIENT' && client.partyCreditAsOf.gt(0)) {
      const credFormatted = formatMoney(client.partyCreditAsOf);
      notifications.push({
        id: `client-credit-${client.partyId}`,
        category: 'DEBTS',
        severity: 'INFO',
        title: `رصيد دائن معلق للعميل: ${client.partyName}`,
        titleAr: `رصيد دائن معلق للعميل: ${client.partyName} (${client.partyCode})`,
        titleId: `Saldo Kredit Pelanggan: ${client.partyName} (${client.partyCode})`,
        titleEn: `Unsettled Credit Balance: ${client.partyName} (${client.partyCode})`,
        description: `للعميل رصيد دائن قدره ${credFormatted} ناتج عن دفعة مقدمة أو مرتجع معلق`,
        descriptionAr: `للعميل رصيد دائن قدره ${credFormatted} ناتج عن دفعة مقدمة أو مرتجع معلق`,
        descriptionId: `Pelanggan memiliki saldo kredit ${credFormatted} dari retur atau uang muka`,
        descriptionEn: `Customer has a credit balance of ${credFormatted} from return or advance`,
        actionUrl: `/partners`,
        actionLabel: 'كشف الحساب',
        actionLabelAr: 'عرض كشف الحساب ←',
        actionLabelId: 'Lihat Buku Besar ←',
        actionLabelEn: 'View Statement ←',
        createdAt: now,
      });
    }
  }

  // 5. DRIVER GIFTS NOTIFICATIONS
  for (const driver of driverResult.driverSummaries) {
    if (driver.remainingBalance.gt(0)) {
      const giftFormatted = formatMoney(driver.remainingBalance);
      notifications.push({
        id: `driver-gift-unpaid-${driver.driverId}`,
        category: 'DRIVERS',
        severity: 'WARNING',
        title: `مكافأة هدية مستحقة: ${driver.driverName}`,
        titleAr: `مكافأة هدية مستحقة للسائق: ${driver.driverName} (${driver.driverCode})`,
        titleId: `Hadiah Pengemudi Siap Diserahkan: ${driver.driverName}`,
        titleEn: `Earned Driver Gift: ${driver.driverName} (${driver.driverCode})`,
        description: `أكمل السائق نصاب الزيارات ولديه هدية مستحقة بقيمة ${giftFormatted} لم تُسلّم بعد`,
        descriptionAr: `أكمل السائق نصاب الزيارات ولديه هدية مستحقة بقيمة ${giftFormatted} لم تُسلّم بعد`,
        descriptionId: `Pengemudi telah mencapai kuota dan memiliki saldo hadiah ${giftFormatted}`,
        descriptionEn: `Driver reached client quota with ${giftFormatted} gift pending release`,
        actionUrl: `/sales/driver-gift?driverId=${driver.driverId}`,
        actionLabel: 'تسليم الهدية',
        actionLabelAr: 'صرف الهدية للسائق ←',
        actionLabelId: 'Serahkan Hadiah ←',
        actionLabelEn: 'Deliver Gift ←',
        createdAt: now,
      });
    } else if (driver.clientsNeededForNextGift > 0 && driver.clientsNeededForNextGift <= 2) {
      notifications.push({
        id: `driver-gift-near-${driver.driverId}`,
        category: 'DRIVERS',
        severity: 'INFO',
        title: `اقتراب استحقاق هدية: ${driver.driverName}`,
        titleAr: `اقتراب استحقاق هدية للسائق: ${driver.driverName}`,
        titleId: `Mendekati Hadiah Pengemudi: ${driver.driverName}`,
        titleEn: `Near Gift Milestone: ${driver.driverName}`,
        description: `متبقٍ ${driver.clientsNeededForNextGift} عميل زائر فقط للسائق لإكمال الهدية القادمة`,
        descriptionAr: `متبقٍ ${driver.clientsNeededForNextGift} عميل زائر فقط للسائق لإكمال الهدية القادمة`,
        descriptionId: `Tersisa ${driver.clientsNeededForNextGift} pelanggan lagi untuk hadiah berikutnya`,
        descriptionEn: `Only ${driver.clientsNeededForNextGift} more visitors needed for next gift`,
        actionUrl: '/drivers',
        actionLabel: 'كشف السائقين',
        actionLabelAr: 'سجل السائقين والزيارات ←',
        actionLabelId: 'Daftar Pengemudi ←',
        actionLabelEn: 'Driver Referrals ←',
        createdAt: now,
      });
    }
  }

  if (limited) notifications.push({
    id:'debt-alert-limit',category:'DEBTS',severity:'INFO',
    title:'تنبيهات الديون محدودة',titleAr:'تنبيهات الديون محدودة',titleEn:'Debt alerts limited',titleId:'Peringatan utang dibatasi',
    description:'تعرض التنبيهات أول200فاتورة مستحقة بحسب تاريخ الاستحقاق؛ افتح تقرير الديون للقائمة الكاملة.',
    descriptionAr:'تعرض التنبيهات أول200فاتورة مستحقة بحسب تاريخ الاستحقاق؛ افتح تقرير الديون للقائمة الكاملة.',
    descriptionEn:'Alerts include the first 200 outstanding invoices by due date. Open debts for the full list.',
    descriptionId:'Peringatan mencakup 200 faktur yang belum lunas berdasarkan jatuh tempo. Buka laporan utang untuk daftar lengkap.',
    actionUrl:'/debts',actionLabel:'عرض الديون',actionLabelAr:'عرض الديون',actionLabelEn:'View debts',actionLabelId:'Lihat utang',createdAt:now,
  });

  // Sort by severity: CRITICAL first, then WARNING, then INFO
  const severityRank: Record<NotificationSeverity, number> = {
    CRITICAL: 1,
    WARNING: 2,
    INFO: 3,
  };
  notifications.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // Compute counts
  const counts = {
    critical: notifications.filter((n) => n.severity === 'CRITICAL').length,
    warning: notifications.filter((n) => n.severity === 'WARNING').length,
    info: notifications.filter((n) => n.severity === 'INFO').length,
    total: notifications.length,
    byCategory: {
      INVENTORY: notifications.filter((n) => n.category === 'INVENTORY').length,
      DEBTS: notifications.filter((n) => n.category === 'DEBTS').length,
      DRIVERS: notifications.filter((n) => n.category === 'DRIVERS').length,
      FINANCIAL: notifications.filter((n) => n.category === 'FINANCIAL').length,
      SETUP: notifications.filter((n) => n.category === 'SETUP').length,
    },
  };

  return { notifications, counts };
}
