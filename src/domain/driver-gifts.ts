import { Decimal, zero, toDecimal } from './decimal';
import { isDateOnOrBefore } from './period';
import {
  PartyDomain,
  GiftPolicyDomain,
  DriverReferralDomain,
  CashTransactionDomain,
  SaleLineDomain,
  DriverVisitCalculation,
  DriverGiftSummaryItem,
} from './types';

export interface DriverGiftsEngineInput {
  asOfDate: string; // YYYY-MM-DD
  drivers: PartyDomain[];
  policies: GiftPolicyDomain[];
  referrals: DriverReferralDomain[];
  cashTransactions: CashTransactionDomain[];
  sales: SaleLineDomain[];
}

export function computeDriverGiftsEngine(input: DriverGiftsEngineInput) {
  const { asOfDate, drivers, policies, referrals, cashTransactions, sales } = input;

  const postedReferrals = referrals.filter((r) => r.status === 'POSTED');
  const postedCash = cashTransactions.filter((c) => c.status === 'POSTED');
  const postedSales = sales.filter((s) => s.status === 'POSTED');

  // Sort policies by effectiveDate ascending
  const sortedPolicies = [...policies].sort((a, b) =>
    a.effectiveDate.slice(0, 10).localeCompare(b.effectiveDate.slice(0, 10))
  );

  function getActivePolicyAtDate(dateStr: string): GiftPolicyDomain {
    if (sortedPolicies.length === 0) {
      throw new Error(`No gift policies configured`);
    }
    // Find latest policy with effectiveDate <= dateStr
    let active: GiftPolicyDomain = sortedPolicies[0];
    for (const pol of sortedPolicies) {
      if (isDateOnOrBefore(pol.effectiveDate, dateStr)) {
        active = pol;
      } else {
        break;
      }
    }
    return active;
  }

  // -------------------------------------------------------------
  // Step 1 & 2: Calculate visit calculations per driver
  // -------------------------------------------------------------
  const visitCalculationsByDriver = new Map<string, DriverVisitCalculation[]>();

  for (const driver of drivers) {
    if (driver.type !== 'DRIVER') continue;

    // Filter and sort referrals for this driver: visitDate ASC, code ASC
    const driverVisits = postedReferrals
      .filter((r) => r.driverId === driver.id)
      .sort((a, b) => {
        const dateCmp = a.visitDate.slice(0, 10).localeCompare(b.visitDate.slice(0, 10));
        if (dateCmp !== 0) return dateCmp;
        return a.code.localeCompare(b.code);
      });

    const calcs: DriverVisitCalculation[] = [];
    let remainderBefore = driver.carryoverReferrals ?? 0;

    for (const visit of driverVisits) {
      const activePolicy = getActivePolicyAtDate(visit.visitDate);
      const threshold = Math.max(1, activePolicy.customersPerGift);
      const giftVal = toDecimal(activePolicy.giftValue);

      const calcBefore = remainderBefore;
      const countPlusOne = calcBefore + 1;
      const calcGifts = Math.floor(countPlusOne / threshold);
      const calcConsumed = calcGifts * threshold;
      const calcAfter = countPlusOne - calcConsumed;
      const calcAmount = giftVal.mul(calcGifts);

      calcs.push({
        visitId: visit.id,
        visitCode: visit.code,
        visitDate: visit.visitDate,
        visitorUniqueKey: visit.visitorUniqueKey,
        visitorName: visit.visitorName,
        driverId: driver.id,
        activePolicy,
        calcBefore,
        calcGifts,
        calcConsumed,
        calcAfter,
        calcAmount,
      });

      remainderBefore = calcAfter;
    }

    visitCalculationsByDriver.set(driver.id, calcs);
  }

  // -------------------------------------------------------------
  // Step 3: Driver summary up to asOfDate
  // -------------------------------------------------------------
  const driverSummaries: DriverGiftSummaryItem[] = [];

  for (const driver of drivers) {
    if (driver.type !== 'DRIVER') continue;

    const allCalcs = visitCalculationsByDriver.get(driver.id) ?? [];
    const validCalcs = allCalcs.filter((c) => isDateOnOrBefore(c.visitDate, asOfDate));

    const carryoverReferrals = driver.carryoverReferrals ?? 0;
    const registeredClients = validCalcs.length;

    let totalGiftsEarned = 0;
    let totalAccruedAmount = zero();

    for (const c of validCalcs) {
      totalGiftsEarned += c.calcGifts;
      totalAccruedAmount = totalAccruedAmount.plus(c.calcAmount);
    }

    // totalReceivedAmount: sum of DRIVER_CASH_GIFT cash + DRIVER_GIFT sales
    let totalReceivedAmount = zero();

    for (const cash of postedCash) {
      if (
        cash.partyId === driver.id &&
        cash.type === 'DRIVER_CASH_GIFT' &&
        isDateOnOrBefore(cash.txDate, asOfDate)
      ) {
        totalReceivedAmount = totalReceivedAmount.plus(cash.amount);
      }
    }

    for (const sale of postedSales) {
      if (
        sale.driverId === driver.id &&
        sale.lineType === 'DRIVER_GIFT' &&
        isDateOnOrBefore(sale.invoiceDate, asOfDate)
      ) {
        totalReceivedAmount = totalReceivedAmount.plus(sale.driverGiftSettlementValue);
      }
    }

    const remainingBalance = totalAccruedAmount.minus(totalReceivedAmount);

    let lastRemainder: number;
    if (registeredClients === 0) {
      lastRemainder = carryoverReferrals;
    } else {
      lastRemainder = validCalcs[validCalcs.length - 1].calcAfter;
    }

    const currentPolicy = getActivePolicyAtDate(asOfDate);
    const currentThreshold = Math.max(1, currentPolicy.customersPerGift);
    const clientsNeededForNextGift = Math.max(0, currentThreshold - lastRemainder);

    driverSummaries.push({
      driverId: driver.id,
      driverCode: driver.code,
      driverName: driver.name,
      driverNameEn: driver.nameEn,
      carryoverReferrals,
      registeredClients,
      totalGiftsEarned,
      totalAccruedAmount,
      totalReceivedAmount,
      remainingBalance,
      lastRemainder,
      clientsNeededForNextGift,
    });
  }

  return {
    asOfDate,
    visitCalculationsByDriver,
    driverSummaries,
    getActivePolicyAtDate,
  };
}
