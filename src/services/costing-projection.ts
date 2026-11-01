import { databaseModels } from '@/lib/model-metadata';
import {
  Prisma, type SystemSetting, type Item, type Party, type FixedAsset,
  type GiftPolicy, type ReturnLine, type StockIssue, type ProductionBatch,
  type BatchMaterial, type CashTransaction, type DriverReferral, type ItemCategory,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { costingPurchasesQuery, costingSalesQuery, type CostingPurchase, type CostingSale } from './costing-lines';

const models = new Map(databaseModels.map(model => [model.name, model]));
const identifier = (name: string) => Prisma.raw(`"${name.replaceAll('"', '""')}"`);

// Cast Decimal columns before JSON aggregation: JSON numeric decoding would
// otherwise round values through JavaScript's floating point representation.
function rows(model: string, query: Prisma.Sql): Prisma.Sql {
  const decimalFields = models.get(model)!.fields.filter(field => field.type === 'Decimal');
  const decimals = decimalFields.flatMap(field => [
    Prisma.sql`${field.name}::text`,
    Prisma.sql`r.${identifier(field.dbName ?? field.name)}::text`,
  ]);
  const value = decimals.length
    ? Prisma.sql`to_jsonb(r) || jsonb_build_object(${Prisma.join(decimals)})`
    : Prisma.sql`to_jsonb(r)`;
  return Prisma.sql`(SELECT COALESCE(jsonb_agg(${value}), '[]'::jsonb) FROM (${query}) r)`;
}

function decode<T>(model: string, values: Record<string, unknown>[]): T[] {
  const fields = models.get(model)!.fields;
  return values.map(value => {
    const row = { ...value };
    for (const field of fields) {
      if (row[field.name] == null) continue;
      if (field.type === 'Decimal') row[field.name] = new Prisma.Decimal(String(row[field.name]));
    }
    const dates = new Set([
      ...fields.filter(field => field.type === 'DateTime').map(field => field.name),
      ...(model === 'PurchaseLine' || model === 'SaleLine' ? ['invoiceDate', 'dueDate'] : []),
    ]);
    for (const name of dates) {
      if (row[name] == null) continue;
      const date = String(row[name]);
      // Prisma treats timestamp-without-time-zone columns as UTC, independently
      // of the Node process timezone. Match that behavior for JSON projections.
      row[name] = new Date(date.includes('T') && !/(Z|[+-]\d{2}:\d{2})$/.test(date) ? date + 'Z' : date);
    }
    if (model === 'ProductionBatch') row.materials = decode<BatchMaterial>('BatchMaterial', row.materials as Record<string, unknown>[]);
    return row as T;
  });
}

type CostingProjection = [
  SystemSetting | null, Item[], Party[], FixedAsset[], GiftPolicy[],
  CostingPurchase[], CostingSale[], ReturnLine[], StockIssue[],
  (ProductionBatch & { materials: BatchMaterial[] })[],
  CashTransaction[], DriverReferral[], ItemCategory[],
];

// One statement retains the caller's snapshot and avoids a network round trip
// for each table when PostgreSQL runs remotely. No time-based financial cache.
export async function readCostingProjection(): Promise<CostingProjection> {
  const [result] = await prisma.$queryRaw<Record<string, Record<string, unknown>[]>[]>`SELECT
    ${rows('SystemSetting', Prisma.sql`SELECT * FROM "SystemSetting" WHERE id=1`)} AS setting,
    ${rows('Item', Prisma.sql`SELECT * FROM "Item"`)} AS items,
    ${rows('Party', Prisma.sql`SELECT * FROM "Party"`)} AS parties,
    ${rows('FixedAsset', Prisma.sql`SELECT * FROM "FixedAsset"`)} AS assets,
    ${rows('GiftPolicy', Prisma.sql`SELECT * FROM "GiftPolicy" ORDER BY "effectiveDate"`)} AS policies,
    ${rows('PurchaseLine', costingPurchasesQuery())} AS purchases,
    ${rows('SaleLine', costingSalesQuery())} AS sales,
    ${rows('ReturnLine', Prisma.sql`SELECT * FROM "ReturnLine" WHERE status='POSTED'`)} AS returns,
    ${rows('StockIssue', Prisma.sql`SELECT * FROM "StockIssue" WHERE status='POSTED'`)} AS issues,
    ${rows('ProductionBatch', Prisma.sql`SELECT b.*, ${rows('BatchMaterial', Prisma.sql`SELECT * FROM "BatchMaterial" m WHERE m."batchId"=b.id`)} AS materials FROM "ProductionBatch" b WHERE b.status='POSTED'`)} AS batches,
    ${rows('CashTransaction', Prisma.sql`SELECT * FROM "CashTransaction" WHERE status='POSTED'`)} AS cash,
    ${rows('DriverReferral', Prisma.sql`SELECT * FROM "DriverReferral" WHERE status='POSTED'`)} AS referrals,
    ${rows('ItemCategory', Prisma.sql`SELECT * FROM "ItemCategory"`)} AS categories`;
  return [
    decode<SystemSetting>('SystemSetting', result.setting)[0] ?? null,
    decode<Item>('Item', result.items), decode<Party>('Party', result.parties),
    decode<FixedAsset>('FixedAsset', result.assets), decode<GiftPolicy>('GiftPolicy', result.policies),
    decode<CostingPurchase>('PurchaseLine', result.purchases), decode<CostingSale>('SaleLine', result.sales),
    decode<ReturnLine>('ReturnLine', result.returns), decode<StockIssue>('StockIssue', result.issues),
    decode<ProductionBatch & { materials: BatchMaterial[] }>('ProductionBatch', result.batches),
    decode<CashTransaction>('CashTransaction', result.cash), decode<DriverReferral>('DriverReferral', result.referrals),
    decode<ItemCategory>('ItemCategory', result.categories),
  ];
}
