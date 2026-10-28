import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { toDecimal, toStorageDecimal } from '@/domain/decimal';
import { logAudit } from './audit.service';

export interface SetupStatus {
  isComplete: boolean;
  message: string;
  currencyOk: boolean;
  reviewedOk: boolean;
  assetsOk: boolean;
  giftPolicyOk: boolean;
  missingItems: string[];
}

export async function getSystemSetting() {
  const setting = await prisma.systemSetting.findUnique({
    where: { id: 1 },
  });
  if (!setting) {
    throw new Error('تهيئة النظام غير مكتملة؛ شغّل الترحيل والتهيئة المعتمدين');
  }
  return setting;
}

export async function updateSystemSetting(
  data: {
    storeName?: string;
    currencyCode?: string;
    currencyLabel?: string;
    startYear?: number;
    openingCash?: number | string;
    openingBank?: number | string;
    openingLoans?: number | string;
    openingRetainedEarnings?: number | string;
    approveOpeningAssets?: boolean;
    openingReviewed?: boolean;
    allowNegativeStock?: boolean;
    lockedThroughDate?: string | null;
    unlockReason?: string;
  },
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const current = await getSystemSetting();
  const unlocking = current.lockedThroughDate && data.lockedThroughDate !== undefined &&
    (!data.lockedThroughDate || data.lockedThroughDate < current.lockedThroughDate.toISOString().slice(0, 10));
  if (unlocking && (!data.unlockReason || data.unlockReason.trim().length < 5)) throw new Error('سبب فك قفل الفترة إلزامي (5 أحرف على الأقل)');

  // If startYear is being changed, check if any movement exists
  if (data.startYear !== undefined && data.startYear !== current.startYear) {
    const hasPurchases = await prisma.purchaseInvoice.count();
    const hasSales = await prisma.saleInvoice.count();
    const hasCash = await prisma.cashTransaction.count();
    if (hasPurchases > 0 || hasSales > 0 || hasCash > 0) {
      throw new Error('لا يمكن تغيير سنة البداية بعد تسجيل حركات في النظام');
    }
  }

  const updated = await prisma.systemSetting.update({
    where: { id: 1 },
    data: {
      storeName: data.storeName,
      currencyCode: data.currencyCode,
      currencyLabel: data.currencyLabel,
      startYear: data.startYear,
      openingCash: data.openingCash !== undefined ? toStorageDecimal(data.openingCash).toString() : undefined,
      openingBank: data.openingBank !== undefined ? toStorageDecimal(data.openingBank).toString() : undefined,
      openingLoans: data.openingLoans !== undefined ? toStorageDecimal(data.openingLoans).toString() : undefined,
      openingRetainedEarnings:
        data.openingRetainedEarnings !== undefined
          ? toStorageDecimal(data.openingRetainedEarnings).toString()
          : undefined,
      approveOpeningAssets: data.approveOpeningAssets,
      openingReviewed: data.openingReviewed,
      allowNegativeStock: data.allowNegativeStock,
      lockedThroughDate: data.lockedThroughDate === undefined ? undefined : data.lockedThroughDate ? new Date(data.lockedThroughDate) : null,
    },
  });

  await logAudit({
    userId,
    action: 'UPDATE',
    entityType: 'SystemSetting',
    entityCode: 'SETTINGS-1',
    reason: unlocking ? `فك قفل الفترة: ${data.unlockReason}` : 'تحديث إعدادات النظام',
    beforeJson: current,
    afterJson: updated,
  });

  return updated;

  });
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const setting = await getSystemSetting();
  const [assetCountWithVal, giftPolicyCount] = await Promise.all([
    prisma.fixedAsset.count({
      where: { submittedValue: { gt: 0 } },
    }),
    prisma.giftPolicy.count(),
  ]);

  const currencyOk = Boolean(setting.currencyCode && setting.currencyCode.trim() !== '');
  const reviewedOk = setting.openingReviewed === true;
  const assetsOk = setting.approveOpeningAssets === true || assetCountWithVal === 0;
  const giftPolicyOk = giftPolicyCount >= 1;

  const missingItems: string[] = [];
  if (!currencyOk) missingItems.push('تحديد عملة النظام');
  if (!reviewedOk) missingItems.push('تأكيد مراجعة أرصدة البداية');
  if (!assetsOk) missingItems.push('حسم اعتماد الأصول الافتتاحية');
  if (!giftPolicyOk) missingItems.push('إضافة سياسة هدايا سائقين واحدة على الأقل');

  const isComplete = missingItems.length === 0;
  const message = isComplete
    ? 'تم تأكيد أرصدة البداية والتهيئة بالكامل'
    : `التهيئة غير مكتملة (${missingItems.join('، ')})`;

  return {
    isComplete,
    message,
    currencyOk,
    reviewedOk,
    assetsOk,
    giftPolicyOk,
    missingItems,
  };
}
