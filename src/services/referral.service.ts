import { todayInStore } from '@/domain/period';
import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, zero } from '@/domain/decimal';
import { formatDate } from '@/domain/period';
import { nextReferralCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadDriverGiftsEngine } from './ledger-loader';
import { RecordStatus, Prisma } from '@prisma/client';

export interface CreateDriverReferralInput {
  visitDate: string; // YYYY-MM-DD
  driverId: string;
  visitorUniqueKey: string; // Phone or unique code
  visitorName: string;
  notes?: string | null;
}

export interface CreateDriverReferralResult {
  referral: any;
  notificationMessage: string;
  isGiftEarned: boolean;
  giftsEarnedInThisVisit: number;
  currentCount: number;
  threshold: number;
  clientsNeededForNextGift: number;
}

/**
 * Creates a driver referral visit with strict system-wide visitorUniqueKey check.
 * Specs 13 (COUNTIF(visitorUniqueKey) == 1).
 */
export async function createDriverReferral(
  input: CreateDriverReferralInput,
  userId?: string
): Promise<CreateDriverReferralResult> {
  return withLedgerTransaction(async () => {

  const { visitDate, driverId, visitorUniqueKey, visitorName, notes } = input;

  const cleanKey = visitorUniqueKey.trim();
  const cleanName = visitorName.trim();

  if (!cleanKey) {
    throw new Error('رقم هاتف أو كود العميل الفريد إلزامي');
  }
  if (!cleanName) {
    throw new Error('اسم العميل الزائر إلزامي');
  }

  // 1. Setting and lock date check
  const setting = await prisma.systemSetting.findFirst();
  if (setting) {
    const minDate = `${setting.startYear}-01-01`;
    if (visitDate < minDate) {
      throw new Error(`تاريخ الزيارة (${visitDate}) يسبق سنة بداية النظام (${setting.startYear})`);
    }
    if (setting.lockedThroughDate) {
      const lockStr = formatDate(setting.lockedThroughDate);
      if (visitDate <= lockStr) {
        throw new Error(`الفترة المحاسبية مغلقة حتى تاريخ ${lockStr}. لا يمكن تسجيل زيارة في فترة مغلقة.`);
      }
    }
  }

  // 2. Driver check
  const driver = await prisma.party.findUnique({
    where: { id: driverId },
  });
  if (!driver?.isActive) throw new Error('السائق المحدد غير موجود أو غير نشط');
  if (driver.type !== 'DRIVER') {
    throw new Error('الطرف المحدد ليس سائقاً');
  }
  if (driver.isDriverGiftEnabled === false) {
    throw new Error(`السائق (${driver.name}) معطل من برنامج الهدايا`);
  }

  // 3. Strict Uniqueness Check on visitorUniqueKey (across the ENTIRE system)
  const existingVisit = await prisma.driverReferral.findFirst({
    where: {
      visitorUniqueKey: cleanKey,
      status: RecordStatus.POSTED,
    },
    include: { driver: true },
  });

  if (existingVisit) {
    const dateStr = formatDate(existingVisit.visitDate);
    throw new Error(
      `العميل الزائر صاحب الرقم/الكود (${cleanKey}) مسجل مسبقاً في النظام بتاريخ ${dateStr} مع السائق (${existingVisit.driver.name}). يُحتسب الزائر مرة واحدة فقط.`
    );
  }

  const code = await nextReferralCode();

  const referral = await prisma.$transaction(async (tx) => {
    const created = await tx.driverReferral.create({
      data: {
        code,
        visitDate: new Date(visitDate),
        driverId,
        visitorUniqueKey: cleanKey,
        visitorName: cleanName,
        notes: notes ? notes.trim() : null,
        status: RecordStatus.POSTED,
      },
    });

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'DriverReferral',
      entityCode: code,
      reason: `تسجيل زيارة عميل سائق: ${cleanName}`,
      afterJson: {
        id: created.id,
        code,
        driverId,
        visitorUniqueKey: cleanKey,
        visitorName: cleanName,
      },
    });

    return created;
  });

  // 4. Compute updated driver gift engine up to visitDate
  const engine = await loadDriverGiftsEngine(visitDate);
  const driverCalcs = engine.visitCalculationsByDriver.get(driverId) ?? [];
  const thisVisitCalc = driverCalcs.find((c) => c.visitId === referral.id);

  const activePolicy = engine.getActivePolicyAtDate(visitDate);
  const threshold = activePolicy.customersPerGift;
  const giftValue = toDecimal(activePolicy.giftValue);

  const giftsEarnedInThisVisit = thisVisitCalc?.calcGifts ?? 0;
  const currentCount = thisVisitCalc?.calcAfter ?? 0;
  const clientsNeededForNextGift = Math.max(0, threshold - currentCount);

  let notificationMessage = '';
  const isGiftEarned = giftsEarnedInThisVisit > 0;

  if (isGiftEarned) {
    notificationMessage = `🎉 تهانينا! اكتملت مجموعة الـ ${threshold} للسائق ${driver.name}! استحق هدية بقيمة ${giftValue.toNumber().toLocaleString('en-US')} ر.س`;
  } else {
    notificationMessage = `تم تسجيل العميل بنجاح (${currentCount} / ${threshold} — بقي ${clientsNeededForNextGift} عملاء لاستحقاق الهدية التالية)`;
  }

  return {
    referral,
    notificationMessage,
    isGiftEarned,
    giftsEarnedInThisVisit,
    currentCount,
    threshold,
    clientsNeededForNextGift,
  };

  });
}

/**
 * Gets all driver referrals with sequential calculation details
 */
export async function getDriverReferrals(options?: {
  driverId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.DriverReferralWhereInput = {};
  if (options?.driverId) where.driverId = options.driverId;
  if (options?.startDate || options?.endDate) {
    where.visitDate = {};
    if (options.startDate) where.visitDate.gte = new Date(options.startDate);
    if (options.endDate) where.visitDate.lte = new Date(options.endDate);
  }

  const asOf = options?.endDate || todayInStore();
  const engine = await loadDriverGiftsEngine(asOf);

  const rawReferrals = await prisma.driverReferral.findMany({
    where,
    orderBy: [{ visitDate: 'desc' }, { code: 'desc' }],
    include: {
      driver: {
        select: { id: true, code: true, name: true, phone: true, carNumber: true },
      },
    },
  });

  // Enrich with calculation results from domain engine
  return rawReferrals.map((r) => {
    const driverCalcs = engine.visitCalculationsByDriver.get(r.driverId) ?? [];
    const calc = driverCalcs.find((c) => c.visitId === r.id);

    return {
      ...r,
      calcBefore: calc?.calcBefore ?? 0,
      calcGifts: calc?.calcGifts ?? 0,
      calcConsumed: calc?.calcConsumed ?? 0,
      calcAfter: calc?.calcAfter ?? 0,
      calcAmount: calc ? toDecimal(calc.calcAmount).toNumber() : 0,
      policyThreshold: calc?.activePolicy.customersPerGift ?? 10,
      policyGiftValue: calc ? toDecimal(calc.activePolicy.giftValue).toNumber() : 0,
    };
  });
}

/**
 * Gets summary of driver gifts as of a given date (Spec 13 Section 3)
 */
export async function getDriverGiftsSummary(asOfDate?: string) {
  const asOf = asOfDate ?? todayInStore();
  const engine = await loadDriverGiftsEngine(asOf);

  // Return formatted driver summaries
  return engine.driverSummaries.map((s) => ({
    driverId: s.driverId,
    driverCode: s.driverCode,
    driverName: s.driverName,
    driverNameEn: s.driverNameEn,
    carryoverReferrals: s.carryoverReferrals,
    registeredClients: s.registeredClients,
    totalGiftsEarned: s.totalGiftsEarned,
    totalAccruedAmount: s.totalAccruedAmount.toNumber(),
    totalReceivedAmount: s.totalReceivedAmount.toNumber(),
    remainingBalance: s.remainingBalance.toNumber(),
    lastRemainder: s.lastRemainder,
    clientsNeededForNextGift: s.clientsNeededForNextGift,
  }));
}

/**
 * Voids a driver referral visit
 */
export async function voidDriverReferral(id: string, reason: string, userId?: string) {
  return withLedgerTransaction(async () => {

  if (!reason || reason.trim().length < 3) {
    throw new Error('سبب الإلغاء إلزامي ويجب ألا يقل عن 3 أحرف');
  }

  const visit = await prisma.driverReferral.findUnique({ where: { id } });
  if (!visit) throw new Error('سجل الزيارة غير موجود');
  if (visit.status === RecordStatus.VOID) throw new Error('الزيارة ملغاة مسبقاً');

  const setting = await prisma.systemSetting.findFirst();
  if (setting?.lockedThroughDate) {
    const lockStr = formatDate(setting.lockedThroughDate);
    const visitDateStr = formatDate(visit.visitDate);
    if (visitDateStr <= lockStr) {
      throw new Error(`الفترة حتى ${lockStr} مقفلة محاسبياً؛ لا يمكن إلغاء حركات فيها`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.driverReferral.update({
      where: { id },
      data: {
        status: RecordStatus.VOID,
        voidReason: reason.trim(),
        voidedAt: new Date(),
      },
    });

    await logAudit({
      userId,
      action: 'VOID',
      entityType: 'DriverReferral',
      entityCode: visit.code,
      reason: reason.trim(),
      beforeState: { status: visit.status },
      afterState: { status: RecordStatus.VOID, voidReason: reason.trim() },
    });

    return updated;
  });

  });
}
