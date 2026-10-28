import { Prisma, PartyType } from '@prisma/client';
import { prisma, withLedgerTransaction } from '@/lib/db';

const tables = {
  party: 'Party', item: 'Item', asset: 'FixedAsset', purchase: 'PurchaseLine',
  sale: 'SaleLine', cash: 'CashTransaction', returns: 'ReturnLine',
  issue: 'StockIssue', batch: 'ProductionBatch', referral: 'DriverReferral',
} as const;

async function reserve(kind: keyof typeof tables, prefix: string, width: number): Promise<string> {
  return withLedgerTransaction(async () => {
    const table = Prisma.raw(`"${tables[kind]}"`);
    const regex = `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[0-9]+$`;
    const rows = await prisma.$queryRaw<Array<{ value: number }>>(Prisma.sql`
      INSERT INTO "DocumentCounter" ("name", "value")
      SELECT ${`${kind}:${prefix}`}, COALESCE(MAX(CASE WHEN "code" ~ ${regex}
        THEN substring("code" from ${prefix.length + 1}::integer)::integer ELSE 0 END), 0) + 1 FROM ${table}
      ON CONFLICT ("name") DO UPDATE SET "value" = GREATEST("DocumentCounter"."value" + 1, EXCLUDED."value")
      RETURNING "value"`);
    return `${prefix}${String(rows[0].value).padStart(width, '0')}`;
  }, false);
}
export const nextPartyCode = (type: PartyType) => reserve('party', ({ CLIENT: 'C', SUPPLIER: 'SUP', DRIVER: 'D', PARTNER: 'PR', FUNDER: 'F' })[type], 3);
export const nextItemCode = () => reserve('item', 'P', 3);
export const nextAssetCode = () => reserve('asset', 'FA', 3);
export const nextPurchaseLineCode = (_offset = 0) => reserve('purchase', 'P', 6);
export const nextSaleLineCode = (_offset = 0) => reserve('sale', 'S', 6);
export const nextCashCode = () => reserve('cash', 'C', 6);
export const nextReturnCode = () => reserve('returns', 'R', 6);
export const nextStockIssueCode = () => reserve('issue', 'IS', 6);
export const nextBatchCode = () => reserve('batch', 'B-', 3);
export const nextReferralCode = () => reserve('referral', 'VIS', 6);
