import { todayInStore } from '@/domain/period';
import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, zero, toStorageDecimal } from '@/domain/decimal';
import { formatDate } from '@/domain/period';
import { nextCashCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadBalancesEngine } from './ledger-loader';
import {
  CashTransactionType,
  CashAccountType,
  RecordStatus,
  Prisma,
} from '@prisma/client';

export interface CreateCashTransactionInput {
  txDate: string; // YYYY-MM-DD
  type: CashTransactionType;
  account: CashAccountType;
  transferToAccount?: CashAccountType | null;
  amount: number | string | Decimal;
  partyId?: string | null;
  invoiceKey?: string | null;
  assetId?: string | null;
  description?: string | null;
}

export async function createCashTransaction(
  input: CreateCashTransactionInput,
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const {
    txDate,
    type,
    account,
    transferToAccount,
    amount,
    partyId,
    invoiceKey,
    assetId,
    description,
  } = input;

  const decAmount = toStorageDecimal(amount);
  if (decAmount.lte(0)) {
    throw new Error('مبلغ الحركة النقدية يجب أن يكون أكبر من الصفر');
  }

  // 1. Check system settings & lock date
  const setting = await prisma.systemSetting.findFirst();
  if (setting) {
    const minDate = `${setting.startYear}-01-01`;
    if (txDate < minDate) {
      throw new Error(`تاريخ الحركة (${txDate}) يسبق سنة بداية النظام (${setting.startYear})`);
    }
    if (setting.lockedThroughDate) {
      const lockStr = formatDate(setting.lockedThroughDate);
      if (txDate <= lockStr) {
        throw new Error(`الفترة المحاسبية مغلقة حتى تاريخ ${lockStr}. لا يمكن تسجيل حركات نقدية في فترة مغلقة.`);
      }
    }
  }

  // 2. Type-specific validations (Spec 08 Section 1)
  if (type === CashTransactionType.INTERNAL_TRANSFER) {
    if (!transferToAccount) {
      throw new Error('يرجى تحديد الحساب المحول إليه في التحويل الداخلي');
    }
    if (account === transferToAccount) {
      throw new Error('لا يمكن التحويل الداخلي إلى نفس الحساب');
    }
  }

  if (
    type === CashTransactionType.CUSTOMER_COLLECTION ||
    type === CashTransactionType.CUSTOMER_REFUND
  ) {
    if (!partyId) throw new Error('العميل إلزامي في هذه الحركة');
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party?.isActive || party.type !== 'CLIENT') {
      throw new Error('الطرف المحدد ليس عميلاً مسجلاً');
    }
    if (!invoiceKey) throw new Error('رقم الفاتورة إلزامي في تحصيل أو رد مبالغ العملاء');
  }

  if (
    type === CashTransactionType.SUPPLIER_PAYMENT ||
    type === CashTransactionType.SUPPLIER_REFUND
  ) {
    if (!partyId) throw new Error('المورد إلزامي في هذه الحركة');
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party?.isActive || party.type !== 'SUPPLIER') {
      throw new Error('الطرف المحدد ليس مورداً مسجلاً');
    }
    if (!invoiceKey) throw new Error('رقم الفاتورة إلزامي في سداد أو استرداد مبالغ الموردين');
  }

  if (
    type === CashTransactionType.DRIVER_AMOUNT ||
    type === CashTransactionType.DRIVER_CASH_GIFT
  ) {
    if (!partyId) throw new Error('السائق إلزامي في هذه الحركة');
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party?.isActive || party.type !== 'DRIVER') {
      throw new Error('الطرف المحدد ليس سائقاً مسجلاً');
    }
  }

  if (
    type === CashTransactionType.PARTNER_CONTRIBUTION ||
    type === CashTransactionType.PARTNER_DRAWING ||
    type === CashTransactionType.PROFIT_DISTRIBUTION
  ) {
    if (!partyId) throw new Error('الشريك إلزامي في هذه الحركة');
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party?.isActive || party.type !== 'PARTNER') {
      throw new Error('الطرف المحدد ليس شريكاً مسجلاً');
    }
  }

  if (
    type === CashTransactionType.OWNER_BROTHER_FINANCING ||
    type === CashTransactionType.OWNER_BROTHER_REPAYMENT
  ) {
    if (!partyId) {
      // Find default funder F001 if partyId not specified
      const defaultFunder = await prisma.party.findFirst({ where: { type: 'FUNDER', isActive: true } });
      if (!defaultFunder) throw new Error('لم يتم العثور على ممول مسجل في النظام');
      input.partyId = defaultFunder.id;
    } else {
      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party?.isActive || party.type !== 'FUNDER') {
        throw new Error('الطرف المحدد ليس ممولاً مسجلاً');
      }
    }
  }

  if (type === CashTransactionType.ASSET_PURCHASE) {
    if (!assetId) throw new Error('الأصل الثابت إلزامي في حركة شراء أصل');
    const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
    if (!asset?.isActive) throw new Error('الأصل الثابت المحدد غير موجود أو غير نشط');
  }

  // 3. Strict CreditBefore check for CUSTOMER_REFUND and SUPPLIER_REFUND (Spec 08 Section 2)
  if (
    type === CashTransactionType.CUSTOMER_REFUND ||
    type === CashTransactionType.SUPPLIER_REFUND
  ) {
    const balances = await loadBalancesEngine(txDate);
    const check = balances.checkCreditBefore(partyId!, invoiceKey!, txDate, decAmount);

    if (!check.refundLimitValid) {
      throw new Error(
        `لا يمكن رد مبلغ (${decAmount.toString()}) لأن الرصيد الدائن المتاح على هذه الفاتورة حتى هذا التاريخ هو (${check.creditBefore.toString()}) فقط. تأكد من تسجيل المرتجع أو التحصيل أولاً.`
      );
    }
  }

  // 4. Generate code and execute
  const code = await nextCashCode();

  return prisma.$transaction(async (tx) => {
    const cashTx = await tx.cashTransaction.create({
      data: {
        code,
        txDate: new Date(txDate),
        type,
        account,
        transferToAccount: type === CashTransactionType.INTERNAL_TRANSFER ? transferToAccount : null,
        amount: decAmount.toString(),
        partyId: input.partyId ?? null,
        invoiceKey: invoiceKey ?? null,
        assetId: assetId ?? null,
        description: description ?? null,
        status: RecordStatus.POSTED,
      },
    });

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'CashTransaction',
      entityCode: code,
      reason: `تسجيل حركة نقدية (${type}) بمبلغ ${decAmount.toString()}`,
      afterJson: {
        id: cashTx.id,
        type,
        account,
        amount: decAmount.toString(),
        partyId: input.partyId,
        invoiceKey,
      },
    });

    return cashTx;
  });

  });
}

export async function getCashTransactions(options?: {
  customerOnly?: boolean;
  account?: CashAccountType;
  type?: CashTransactionType;
  partyId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.CashTransactionWhereInput = {};
  if (options?.customerOnly) where.type = { in: ['CUSTOMER_COLLECTION', 'CUSTOMER_REFUND'] };
  if (options?.account) {
    where.OR = [
      { account: options.account },
      { transferToAccount: options.account },
    ];
  }
  if (options?.type) {
    if (options.customerOnly && !['CUSTOMER_COLLECTION', 'CUSTOMER_REFUND'].includes(options.type)) return [];
    where.type = options.type;
  }
  if (options?.partyId) where.partyId = options.partyId;
  if (options?.startDate || options?.endDate) {
    where.txDate = {};
    if (options.startDate) where.txDate.gte = new Date(options.startDate);
    if (options.endDate) where.txDate.lte = new Date(options.endDate);
  }

  const transactions = await prisma.cashTransaction.findMany({
    where,
    orderBy: [{ txDate: 'asc' }, { code: 'asc' }],
    include: {
      party: { select: { id: true, code: true, name: true, type: true } },
      asset: { select: { id: true, code: true, name: true } },
    },
  });

  const setting = await prisma.systemSetting.findFirst();
  let cashRunning = setting ? toDecimal(setting.openingCash) : zero();
  let bankRunning = setting ? toDecimal(setting.openingBank) : zero();

  // We compute running balances for all transactions sequentially
  const allTxs = await prisma.cashTransaction.findMany({
    where: { status: 'POSTED' },
    orderBy: [{ txDate: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      account: true,
      transferToAccount: true,
      type: true,
      amount: true,
    },
  });

  const runningMap = new Map<string, { cash: number; bank: number; total: number }>();

  for (const tx of allTxs) {
    const amt = toDecimal(tx.amount);
    if (tx.type === CashTransactionType.INTERNAL_TRANSFER) {
      if (tx.account === CashAccountType.CASH) {
        cashRunning = cashRunning.minus(amt);
        bankRunning = bankRunning.plus(amt);
      } else {
        bankRunning = bankRunning.minus(amt);
        cashRunning = cashRunning.plus(amt);
      }
    } else {
      const isPositive = (
        [
          CashTransactionType.CUSTOMER_COLLECTION,
          CashTransactionType.PARTNER_CONTRIBUTION,
          CashTransactionType.LOAN_RECEIVED,
          CashTransactionType.OWNER_BROTHER_FINANCING,
          CashTransactionType.EXTERNAL_SALES_PROFIT,
          CashTransactionType.SUPPLIER_REFUND,
        ] as CashTransactionType[]
      ).includes(tx.type);

      const signedAmt = isPositive ? amt : amt.negated();
      if (tx.account === CashAccountType.CASH) {
        cashRunning = cashRunning.plus(signedAmt);
      } else {
        bankRunning = bankRunning.plus(signedAmt);
      }
    }

    runningMap.set(tx.id, {
      cash: cashRunning.toNumber(),
      bank: bankRunning.toNumber(),
      total: cashRunning.plus(bankRunning).toNumber(),
    });
  }

  // Reverse list to show newest first, but with calculated running balance
  const result = transactions.map((t) => {
    const running = runningMap.get(t.id) || { cash: 0, bank: 0, total: 0 };
    return {
      ...t,
      runningCash: running.cash,
      runningBank: running.bank,
      runningTotal: running.total,
    };
  });

  return result.reverse();
}

export async function getCashSummary(asOfDate?: string) {
  const targetDate = asOfDate || todayInStore();
  const balances = await loadBalancesEngine(targetDate);

  return {
    asOfDate: targetDate,
    cashBalance: Number(balances.cashBalance),
    bankBalance: Number(balances.bankBalance),
    cashAndBankTotal: Number(balances.cashAndBankTotal),
  };
}

/**
 * Returns available pending invoices for a party with remaining balances (Spec 08 Section 4.3)
 */
export async function getPartyPendingInvoices(partyId: string, asOfDate?: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return [];

  const targetDate = asOfDate || todayInStore();
  const balances = await loadBalancesEngine(targetDate);

  const list: Array<{
    invoiceKey: string;
    invoiceNo: string;
    invoiceDate?: string;
    remainingAmount: number;
    statusLabel: string;
  }> = [];

  // Opening balance row
  const openingBal = toDecimal(party.openingBalance);
  if (!openingBal.isZero()) {
    list.push({
      invoiceKey: 'افتتاحي',
      invoiceNo: 'رصيد أول المدة',
      remainingAmount: openingBal.toNumber(),
      statusLabel: 'رصيد افتتاحي',
    });
  }

  // Invoices for this party (including opening balance row already inside invoiceItems)
  const partyInvoices = balances.invoiceItems.filter((i) => i.partyId === partyId);
  for (const inv of partyInvoices) {
    if (inv.invoiceKey === 'افتتاحي' && list.some((x) => x.invoiceKey === 'افتتاحي')) {
      continue;
    }

    list.push({
      invoiceKey: inv.invoiceKey,
      invoiceNo: inv.invoiceKey.split('|')[1]?.trim() ?? inv.invoiceKey,
      invoiceDate: inv.invoiceDate ?? undefined,
      remainingAmount: inv.signedAsOf.toNumber(),
      statusLabel: inv.aging,
    });
  }

  return list;
}

export async function voidCashTransaction(id: string, reason: string, userId?: string) {
  return withLedgerTransaction(async () => {
  const source = await prisma.cashTransaction.findUnique({ where: { id }, include: { sourceReturn: true } });
  if (source?.sourceReturn?.status === 'POSTED') throw new Error('ألغِ المرتجع المرتبط لعكس السند التلقائي معه');

  if (!reason || reason.trim().length < 3) {
    throw new Error('سبب الإلغاء إلزامي ويجب ألا يقل عن 3 أحرف');
  }

  const tx = await prisma.cashTransaction.findUnique({ where: { id } });
  if (!tx) throw new Error('الحركة النقدية غير موجودة');
  if (tx.status === RecordStatus.VOID) throw new Error('الحركة ملغاة مسبقاً');

  const setting = await prisma.systemSetting.findFirst();
  if (setting?.lockedThroughDate) {
    const lockStr = formatDate(setting.lockedThroughDate);
    const txDateStr = formatDate(tx.txDate);
    if (txDateStr <= lockStr) {
      throw new Error(`الفترة حتى ${lockStr} مقفلة محاسبياً؛ لا يمكن إلغاء حركات فيها`);
    }
  }

  return prisma.$transaction(async (prismaTx) => {
    const updated = await prismaTx.cashTransaction.update({
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
      entityType: 'CashTransaction',
      entityCode: tx.code,
      reason: reason.trim(),
      beforeState: { status: tx.status },
      afterState: { status: RecordStatus.VOID, voidReason: reason.trim() },
    });

    return updated;
  });

  });
}
