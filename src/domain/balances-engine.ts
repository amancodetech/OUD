import { Decimal, zero, isMoneyZero, MONEY_EPSILON } from './decimal';
import { isDateOnOrBefore, diffInDays } from './period';
import {
  PartyDomain,
  PurchaseLineDomain,
  SaleLineDomain,
  ReturnLineDomain,
  CashTransactionDomain,
  SystemSettingDomain,
  InvoiceBalanceItem,
  PartySummaryItem,
  CreditBeforeResult,
  AgingCategory,
  ReportClass,
  CoverageStatus,
  CashAccountType,
} from './types';

export interface BalancesEngineInput {
  asOfDate: string; // YYYY-MM-DD cutoff date
  parties: PartyDomain[];
  purchases: PurchaseLineDomain[];
  sales: SaleLineDomain[];
  returns: ReturnLineDomain[];
  cashTransactions: CashTransactionDomain[];
  systemSetting: SystemSettingDomain;
}

/**
 * Computes Invoice Balances, Party Summaries, Running Cash, and Aging
 * Matches specs/12-balances-engine.md and specs/08-cash-transactions.md
 */
export function computeBalancesEngine(input: BalancesEngineInput) {
  const { asOfDate, parties, purchases, sales, returns, cashTransactions, systemSetting } = input;

  const postedPurchases = purchases.filter((p) => p.status === 'POSTED');
  const postedSales = sales.filter((s) => s.status === 'POSTED');
  const postedReturns = returns.filter((r) => r.status === 'POSTED');
  const postedCash = cashTransactions.filter((c) => c.status === 'POSTED');

  // Index once: each invoice must not rescan the entire returns/cash ledger.
  function group<T>(rows: T[], key: (row: T) => string) {
    const index = new Map<string, T[]>();
    for (const row of rows) { const k = key(row); const bucket = index.get(k) ?? []; bucket.push(row); index.set(k, bucket); }
    return index;
  }
  const cashByInvoice = group(postedCash, c => `${c.partyId}:::${c.invoiceKey}`);
  const returnsByInvoice = group(postedReturns, r => `${r.partyId}:::${r.invoiceKey}`);
  const salesById = new Map(postedSales.map(row => [row.id, row]));
  const purchasesById = new Map(postedPurchases.map(row => [row.id, row]));

  // -------------------------------------------------------------
  // 1. Calculate Invoice Balance Items
  // -------------------------------------------------------------
  const invoiceItems: InvoiceBalanceItem[] = [];

  // Group sales by customerId and invoiceKey
  const salesByCustomerAndKey = new Map<string, SaleLineDomain[]>();
  for (const s of postedSales) {
    if (s.customerId && s.lineType === 'SALE') {
      const mapKey = `${s.customerId}:::${s.invoiceKey}`;
      const list = salesByCustomerAndKey.get(mapKey) ?? [];
      list.push(s);
      salesByCustomerAndKey.set(mapKey, list);
    }
  }

  // Group purchases by supplierId and invoiceKey
  const purchasesBySupplierAndKey = new Map<string, PurchaseLineDomain[]>();
  for (const p of postedPurchases) {
    const mapKey = `${p.supplierId}:::${p.invoiceKey}`;
    const list = purchasesBySupplierAndKey.get(mapKey) ?? [];
    list.push(p);
    purchasesBySupplierAndKey.set(mapKey, list);
  }

  // Collect all known invoice keys per party
  const partyInvoiceKeys = new Map<string, Set<string>>();
  for (const p of parties) {
    partyInvoiceKeys.set(p.id, new Set<string>());
  }

  for (const s of postedSales) {
    if (s.customerId && s.lineType === 'SALE') {
      partyInvoiceKeys.get(s.customerId)?.add(s.invoiceKey);
    }
  }

  for (const p of postedPurchases) {
    partyInvoiceKeys.get(p.supplierId)?.add(p.invoiceKey);
  }

  // Also include invoice keys from returns and cash transactions if any
  for (const r of postedReturns) {
    if (r.invoiceKey) {
      partyInvoiceKeys.get(r.partyId)?.add(r.invoiceKey);
    }
  }
  for (const c of postedCash) {
    if (c.partyId && c.invoiceKey) {
      partyInvoiceKeys.get(c.partyId)?.add(c.invoiceKey);
    }
  }

  // Iterate over each party
  for (const party of parties) {
    if (party.type !== 'CLIENT' && party.type !== 'SUPPLIER') {
      continue;
    }

    // A) Opening Balance Item ("افتتاحي")
    const hasOpeningCash = (cashByInvoice.get(`${party.id}:::افتتاحي`) ?? []).some(
      (c) => c.partyId === party.id && c.invoiceKey === 'افتتاحي' && isDateOnOrBefore(c.txDate, asOfDate)
    );
    const hasOpeningInvoice = !!(party.openingInvoice && !party.openingInvoice.isZero());

    if (!party.openingBalance.isZero() || hasOpeningInvoice || hasOpeningCash) {
      const originalAsOf = hasOpeningInvoice ? party.openingInvoice! : party.openingBalance;
      const returnsAsOf = zero();

      let settlementAsOf = party.openingPaid ?? zero();
      let refundAsOf = zero();

      for (const c of cashByInvoice.get(`${party.id}:::افتتاحي`) ?? []) {
        if (c.partyId === party.id && c.invoiceKey === 'افتتاحي' && isDateOnOrBefore(c.txDate, asOfDate)) {
          if (party.type === 'CLIENT') {
            if (c.type === 'CUSTOMER_COLLECTION') settlementAsOf = settlementAsOf.plus(c.amount);
            if (c.type === 'CUSTOMER_REFUND') refundAsOf = refundAsOf.plus(c.amount);
          } else {
            if (c.type === 'SUPPLIER_PAYMENT') settlementAsOf = settlementAsOf.plus(c.amount);
            if (c.type === 'SUPPLIER_REFUND') refundAsOf = refundAsOf.plus(c.amount);
          }
        }
      }

      const signedAsOf = originalAsOf.minus(returnsAsOf).minus(settlementAsOf).plus(refundAsOf);
      const invoiceDebt = signedAsOf.gt(MONEY_EPSILON) ? signedAsOf : zero();
      const invoiceCredit = signedAsOf.lt(MONEY_EPSILON.neg()) ? signedAsOf.neg() : zero();

      let aging: AgingCategory = 'استحقاق غير محدد';
      if (signedAsOf.lt(MONEY_EPSILON.neg())) {
        aging = 'رصيد دائن';
      } else if (invoiceDebt.lte(MONEY_EPSILON)) {
        aging = 'مسدد';
      }

      invoiceItems.push({
        partyId: party.id,
        partyCode: party.code,
        partyName: party.name,
        partyNameEn: party.nameEn ?? null,
        supplierCategory: party.supplierCategory ?? null,
        supplierCategoryEn: party.supplierCategoryEn ?? null,
        partyType: party.type,
        invoiceKey: 'افتتاحي',
        invoiceDate: null,
        dueDate: null,
        reportClass: 'رصيد افتتاحي',
        originalAsOf,
        returnsAsOf,
        settlementAsOf,
        refundAsOf,
        signedAsOf,
        invoiceDebt,
        invoiceCredit,
        daysOverdue: 0,
        aging,
      });
    }

    // B) Regular Invoices
    const keys = partyInvoiceKeys.get(party.id) ?? new Set<string>();
    for (const key of keys) {
      if (key === 'افتتاحي') continue;

      let invoiceDate: string | null = null;
      let dueDate: string | null = null;
      let originalTotal = zero();

      if (party.type === 'CLIENT') {
        const lines = salesByCustomerAndKey.get(`${party.id}:::${key}`) ?? [];
        if (lines.length > 0) {
          invoiceDate = lines[0].invoiceDate;
          dueDate = lines[0].dueDate ?? null;
          for (const line of lines) {
            originalTotal = originalTotal.plus(line.netSaleAmount);
          }
        }
      } else {
        const lines = purchasesBySupplierAndKey.get(`${party.id}:::${key}`) ?? [];
        if (lines.length > 0) {
          invoiceDate = lines[0].invoiceDate;
          dueDate = lines[0].dueDate ?? null;
          for (const line of lines) {
            originalTotal = originalTotal.plus(line.lineTotalCost);
          }
        }
      }

      // OriginalAsOf is zero if invoiceDate is after cutoff date
      const isFutureInvoice = invoiceDate ? !isDateOnOrBefore(invoiceDate, asOfDate) : false;
      const originalAsOf = isFutureInvoice ? zero() : originalTotal;

      // ReturnsAsOf
      let returnsAsOf = zero();
      for (const r of returnsByInvoice.get(`${party.id}:::${key}`) ?? []) {
        if (r.partyId === party.id && r.invoiceKey === key && isDateOnOrBefore(r.returnDate, asOfDate)) {
          if (party.type === 'CLIENT' && r.type === 'SALE_RETURN') {
            const srcSale = salesById.get(r.sourceSaleLineId ?? '');
            const unitPrice =
              srcSale && !srcSale.qty.isZero() ? srcSale.netSaleAmount.div(srcSale.qty) : zero();
            returnsAsOf = returnsAsOf.plus(r.qty.mul(unitPrice));
          } else if (party.type === 'SUPPLIER' && r.type === 'PURCHASE_RETURN') {
            if (r.supplierCreditNote !== null && r.supplierCreditNote !== undefined) {
              returnsAsOf = returnsAsOf.plus(r.supplierCreditNote);
            } else {
              const srcPurch = purchasesById.get(r.sourcePurchaseLineId ?? '');
              const unitCost =
                srcPurch && !srcPurch.qty.isZero() ? srcPurch.lineTotalCost.div(srcPurch.qty) : zero();
              returnsAsOf = returnsAsOf.plus(r.qty.mul(unitCost));
            }
          }
        }
      }

      // SettlementAsOf and RefundAsOf
      let settlementAsOf = zero();
      let refundAsOf = zero();

      for (const c of cashByInvoice.get(`${party.id}:::${key}`) ?? []) {
        if (c.partyId === party.id && c.invoiceKey === key && isDateOnOrBefore(c.txDate, asOfDate)) {
          if (party.type === 'CLIENT') {
            if (c.type === 'CUSTOMER_COLLECTION') settlementAsOf = settlementAsOf.plus(c.amount);
            if (c.type === 'CUSTOMER_REFUND') refundAsOf = refundAsOf.plus(c.amount);
          } else {
            if (c.type === 'SUPPLIER_PAYMENT') settlementAsOf = settlementAsOf.plus(c.amount);
            if (c.type === 'SUPPLIER_REFUND') refundAsOf = refundAsOf.plus(c.amount);
          }
        }
      }

      const signedAsOf = originalAsOf.minus(returnsAsOf).minus(settlementAsOf).plus(refundAsOf);
      const invoiceDebt = signedAsOf.gt(MONEY_EPSILON) ? signedAsOf : zero();
      const invoiceCredit = signedAsOf.lt(MONEY_EPSILON.neg()) ? signedAsOf.neg() : zero();

      // DaysOverdue and Aging
      let daysOverdue = 0;
      if (invoiceDebt.gt(MONEY_EPSILON) && dueDate) {
        daysOverdue = Math.max(0, diffInDays(asOfDate, dueDate));
      }

      let aging: AgingCategory = 'استحقاق غير محدد';
      if (signedAsOf.lt(MONEY_EPSILON.neg())) {
        aging = 'رصيد دائن';
      } else if (invoiceDebt.lte(MONEY_EPSILON)) {
        aging = 'مسدد';
      } else if (!dueDate) {
        aging = 'استحقاق غير محدد';
      } else if (isDateOnOrBefore(asOfDate, dueDate)) {
        aging = 'غير مستحق';
      } else if (daysOverdue <= 30) {
        aging = '1–30';
      } else if (daysOverdue <= 60) {
        aging = '31–60';
      } else if (daysOverdue <= 90) {
        aging = '61–90';
      } else {
        aging = 'أكثر من90';
      }

      const reportClass: ReportClass = isFutureInvoice ? 'مقدم على فاتورة لاحقة' : 'فاتورة';

      invoiceItems.push({
        partyId: party.id,
        partyCode: party.code,
        partyName: party.name,
        partyNameEn: party.nameEn ?? null,
        supplierCategory: party.supplierCategory ?? null,
        supplierCategoryEn: party.supplierCategoryEn ?? null,
        partyType: party.type,
        invoiceKey: key,
        invoiceDate,
        dueDate,
        reportClass,
        originalAsOf,
        returnsAsOf,
        settlementAsOf,
        refundAsOf,
        signedAsOf,
        invoiceDebt,
        invoiceCredit,
        daysOverdue,
        aging,
      });
    }
  }

  // -------------------------------------------------------------
  // 2. Calculate Party Summaries
  // -------------------------------------------------------------
  const partySummaries: PartySummaryItem[] = [];
  const itemsByParty = group(invoiceItems, it => it.partyId);

  for (const party of parties) {
    if (party.type !== 'CLIENT' && party.type !== 'SUPPLIER') {
      continue;
    }

    const itemsForParty = itemsByParty.get(party.id) ?? [];

    let totalInvoicedAsOf = zero();
    let totalSettledAsOf = zero();
    let partyDebtAsOf = zero();
    let partyCreditAsOf = zero();
    let prepaymentAsOf = zero();

    for (const it of itemsForParty) {
      totalInvoicedAsOf = totalInvoicedAsOf.plus(it.originalAsOf);
      totalSettledAsOf = totalSettledAsOf.plus(it.settlementAsOf);
      partyDebtAsOf = partyDebtAsOf.plus(it.invoiceDebt);
      partyCreditAsOf = partyCreditAsOf.plus(it.invoiceCredit);
      if (it.reportClass === 'مقدم على فاتورة لاحقة') {
        prepaymentAsOf = prepaymentAsOf.plus(it.settlementAsOf.minus(it.refundAsOf));
      }
    }

    const partySignedAsOf = partyDebtAsOf.minus(partyCreditAsOf);
    const uncoveredAsOf = partySignedAsOf.gt(MONEY_EPSILON) ? partySignedAsOf : zero();

    let coverageAsOf: CoverageStatus;
    if (partyDebtAsOf.lte(MONEY_EPSILON) && partyCreditAsOf.lte(MONEY_EPSILON)) {
      coverageAsOf = 'متوازن';
    } else if (partyDebtAsOf.gt(MONEY_EPSILON) && partyCreditAsOf.gt(MONEY_EPSILON)) {
      coverageAsOf = 'مستحق يقابله دائن';
    } else if (partyDebtAsOf.gt(MONEY_EPSILON)) {
      coverageAsOf = 'مستحق';
    } else {
      coverageAsOf = 'رصيد دائن';
    }

    partySummaries.push({
      partyId: party.id,
      partyCode: party.code,
      partyName: party.name,
      partyNameEn: party.nameEn ?? null,
      supplierCategory: party.supplierCategory ?? null,
      supplierCategoryEn: party.supplierCategoryEn ?? null,
      partyType: party.type,
      totalInvoicedAsOf,
      totalSettledAsOf,
      partyDebtAsOf,
      partyCreditAsOf,
      partySignedAsOf,
      uncoveredAsOf,
      coverageAsOf,
      prepaymentAsOf,
      unallocatedAsOf: zero(),
      reconciliationAsOf: zero(),
    });
  }

  // -------------------------------------------------------------
  // 3. Calculate Cash & Bank Balances
  // -------------------------------------------------------------
  let cashBalance = systemSetting.openingCash;
  let bankBalance = systemSetting.openingBank;

  for (const c of postedCash) {
    if (isDateOnOrBefore(c.txDate, asOfDate)) {
      const effect = getSignedCashEffect(c.type, c.amount);

      if (c.type === 'INTERNAL_TRANSFER') {
        if (c.account === 'CASH') cashBalance = cashBalance.minus(c.amount);
        else if (c.account === 'BANK') bankBalance = bankBalance.minus(c.amount);

        if (c.transferToAccount === 'CASH') cashBalance = cashBalance.plus(c.amount);
        else if (c.transferToAccount === 'BANK') bankBalance = bankBalance.plus(c.amount);
      } else {
        if (c.account === 'CASH') {
          cashBalance = cashBalance.plus(effect);
        } else if (c.account === 'BANK') {
          bankBalance = bankBalance.plus(effect);
        }
      }
    }
  }

  const cashAndBankTotal = cashBalance.plus(bankBalance);

  // -------------------------------------------------------------
  // 4. Function: validateRefundLimit (CreditBefore check)
  // -------------------------------------------------------------
  function checkCreditBefore(
    partyId: string,
    invoiceKey: string,
    txDate: string,
    candidateAmount: Decimal,
    excludeTxCode?: string
  ): CreditBeforeResult {
    const party = parties.find((p) => p.id === partyId);
    if (!party) {
      throw new Error(`Party ${partyId} not found`);
    }

    let priorCollectionsOrPayments = zero();
    let priorRefunds = zero();

    for (const c of cashByInvoice.get(`${partyId}:::${invoiceKey}`) ?? []) {
      if (c.partyId === partyId && c.invoiceKey === invoiceKey) {
        if (excludeTxCode && c.code === excludeTxCode) continue;

        const isPrior =
          isDateOnOrBefore(c.txDate, txDate) &&
          (c.txDate < txDate || !excludeTxCode || c.code < excludeTxCode);

        if (isPrior) {
          if (party.type === 'CLIENT') {
            if (c.type === 'CUSTOMER_COLLECTION') {
              priorCollectionsOrPayments = priorCollectionsOrPayments.plus(c.amount);
            } else if (c.type === 'CUSTOMER_REFUND') {
              priorRefunds = priorRefunds.plus(c.amount);
            }
          } else if (party.type === 'SUPPLIER') {
            if (c.type === 'SUPPLIER_PAYMENT') {
              priorCollectionsOrPayments = priorCollectionsOrPayments.plus(c.amount);
            } else if (c.type === 'SUPPLIER_REFUND') {
              priorRefunds = priorRefunds.plus(c.amount);
            }
          }
        }
      }
    }

    let origDebtOrPayable = zero();
    let retCredit = zero();

    if (invoiceKey === 'افتتاحي') {
      origDebtOrPayable = party.openingBalance;
      retCredit = zero();
    } else {
      if (party.type === 'CLIENT') {
        for (const s of salesByCustomerAndKey.get(`${partyId}:::${invoiceKey}`) ?? []) {
          if (s.customerId === partyId && s.invoiceKey === invoiceKey && isDateOnOrBefore(s.invoiceDate, txDate)) {
            origDebtOrPayable = origDebtOrPayable.plus(s.netSaleAmount);
          }
        }
        for (const r of returnsByInvoice.get(`${partyId}:::${invoiceKey}`) ?? []) {
          if (r.partyId === partyId && r.invoiceKey === invoiceKey && isDateOnOrBefore(r.returnDate, txDate)) {
            const src = salesById.get(r.sourceSaleLineId ?? '');
            const unitPrice = src && !src.qty.isZero() ? src.netSaleAmount.div(src.qty) : zero();
            retCredit = retCredit.plus(r.qty.mul(unitPrice));
          }
        }
      } else {
        for (const p of purchasesBySupplierAndKey.get(`${partyId}:::${invoiceKey}`) ?? []) {
          if (p.supplierId === partyId && p.invoiceKey === invoiceKey && isDateOnOrBefore(p.invoiceDate, txDate)) {
            origDebtOrPayable = origDebtOrPayable.plus(p.lineTotalCost);
          }
        }
        for (const r of returnsByInvoice.get(`${partyId}:::${invoiceKey}`) ?? []) {
          if (r.partyId === partyId && r.invoiceKey === invoiceKey && isDateOnOrBefore(r.returnDate, txDate)) {
            if (r.supplierCreditNote !== null && r.supplierCreditNote !== undefined) {
              retCredit = retCredit.plus(r.supplierCreditNote);
            } else {
              const src = purchasesById.get(r.sourcePurchaseLineId ?? '');
              const unitCost = src && !src.qty.isZero() ? src.lineTotalCost.div(src.qty) : zero();
              retCredit = retCredit.plus(r.qty.mul(unitCost));
            }
          }
        }
      }
    }

    // CreditBefore = PriorCollections - PriorRefunds - OrigDebt + RetCredit
    const creditBefore = priorCollectionsOrPayments
      .minus(priorRefunds)
      .minus(origDebtOrPayable)
      .plus(retCredit);

    const maxAllowed = creditBefore.gt(zero()) ? creditBefore.plus(MONEY_EPSILON) : MONEY_EPSILON;
    const refundLimitValid = candidateAmount.lte(maxAllowed);

    return {
      partyId,
      invoiceKey,
      creditBefore,
      refundLimitValid,
      priorCollectionsOrPayments,
      priorRefunds,
      origDebtOrPayable,
      retCredit,
    };
  }

  return {
    asOfDate,
    invoiceItems,
    partySummaries,
    cashBalance,
    bankBalance,
    cashAndBankTotal,
    checkCreditBefore,
  };
}

/**
 * Returns signed cash effect: +amount for inflows, -amount for outflows
 */
export function getSignedCashEffect(type: string, amount: Decimal): Decimal {
  switch (type) {
    case 'CUSTOMER_COLLECTION':
    case 'PARTNER_CONTRIBUTION':
    case 'LOAN_RECEIVED':
    case 'OWNER_BROTHER_FINANCING':
    case 'EXTERNAL_SALES_PROFIT':
    case 'SUPPLIER_REFUND':
      return amount;

    case 'SUPPLIER_PAYMENT':
    case 'CASH_EXPENSE':
    case 'PARTNER_DRAWING':
    case 'PROFIT_DISTRIBUTION':
    case 'ASSET_PURCHASE':
    case 'LOAN_REPAYMENT':
    case 'OWNER_BROTHER_REPAYMENT':
    case 'DRIVER_AMOUNT':
    case 'DRIVER_CASH_GIFT':
    case 'CUSTOMER_REFUND':
      return amount.neg();

    case 'INTERNAL_TRANSFER':
      return zero();

    default:
      return zero();
  }
}
