import { Prisma } from '@prisma/client';
import { prisma, withReadSnapshot } from '@/lib/db';
import { computeBalancesEngine } from '@/domain/balances-engine';
import { toDecimal, MONEY_EPSILON, zero } from '@/domain/decimal';
import type { LedgerData } from './ledger-loader';
// Aggregate per invoice BEFORE splitting debts and credits. Netting the party
// directly would incorrectly hide a credit invoice behind another invoice's debt.
export async function reportBalanceSummary(data: LedgerData, asOfDate: string) {
  return withReadSnapshot(async () => {
  const rows=await prisma.$queryRaw<{partyType:'CLIENT'|'SUPPLIER';partyId:string;partyCode:string;partyName:string;debt:unknown;credit:unknown;candidates:{partyId:string;invoiceKey:string;balance:string}[]}[]>`
    ${invoiceBalancesQuery(asOfDate)}
    SELECT p.id AS "partyId",p.code AS "partyCode",p.name AS "partyName",p.type::text AS "partyType",SUM(CASE WHEN i.balance>0.01 THEN i.balance ELSE 0 END) AS debt,
      SUM(CASE WHEN i.balance < -0.01 THEN -i.balance ELSE 0 END) AS credit,
      COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('partyId',p.id,'invoiceKey',i.key,'balance',i.balance::text))
        FILTER(WHERE ABS(ABS(i.balance)-0.01)<=0.00000001),'[]'::jsonb) AS candidates
    FROM invoices i JOIN "Party" p ON p.id=i.party WHERE p.type IN ('CLIENT','SUPPLIER') GROUP BY p.id,p.code,p.name,p.type`;
  const cash=computeBalancesEngine({asOfDate,parties:[],sales:[],purchases:[],returns:[],cashTransactions:data.cashTransactions,systemSetting:data.systemSetting});
  const partySummaries=rows.map(r=>({partyId:r.partyId,partyCode:r.partyCode,partyName:r.partyName,partyType:r.partyType,partyDebtAsOf:toDecimal(String(r.debt)),partyCreditAsOf:toDecimal(String(r.credit))}));
  // Re-evaluate only threshold candidates with the original Decimal engine.
  // This margin selects an execution path; it never changes the 0.01 policy.
  // SQL and Decimal division have different precision, so testing the raw SQL
  // residual alone can turn a full return into an extra 0.01 credit.
  const candidates=rows.flatMap(row=>row.candidates);
  const thresholdCorrections:{partyId:string;invoiceKey:string;debt:string}[]=[];
  if(candidates.length){
    const {loadAllLedgerData}=await import('./ledger-loader');
    const summaries=new Map(partySummaries.map(row=>[row.partyId,row]));
    for(let offset=0;offset<candidates.length;offset+=200){
      const batch=candidates.slice(offset,offset+200);
      const scoped=await loadAllLedgerData([...new Set(batch.map(row=>row.partyId))],[...new Set(batch.map(row=>row.invoiceKey))]);
      const exact=computeBalancesEngine({...scoped,asOfDate});
      const byInvoice=new Map(exact.invoiceItems.map(row=>[`${row.partyId}:::${row.invoiceKey}`,row]));
      for(const row of batch){
        const summary=summaries.get(row.partyId),reference=byInvoice.get(`${row.partyId}:::${row.invoiceKey}`);
        if(!summary||!reference)continue;
        const balance=toDecimal(String(row.balance));
        const sqlDebt=balance.gt(MONEY_EPSILON)?balance:zero(),sqlCredit=balance.lt(MONEY_EPSILON.neg())?balance.neg():zero();
        thresholdCorrections.push({partyId:row.partyId,invoiceKey:row.invoiceKey,debt:reference.invoiceDebt.toString()});
        summary.partyDebtAsOf=summary.partyDebtAsOf.plus(reference.invoiceDebt.minus(sqlDebt));
        summary.partyCreditAsOf=summary.partyCreditAsOf.plus(reference.invoiceCredit.minus(sqlCredit));
      }
    }
  }
  for(const row of partySummaries){row.partyDebtAsOf=row.partyDebtAsOf.toSignificantDigits(28);row.partyCreditAsOf=row.partyCreditAsOf.toSignificantDigits(28);}
  return {cashBalance:cash.cashBalance,bankBalance:cash.bankBalance,cashAndBankTotal:cash.cashAndBankTotal,partySummaries,thresholdCorrections};
  });
}

export function invoiceBalancesQuery(asOfDate: string) {
  return Prisma.sql`
    WITH events AS (
      SELECT i."customerId" AS party, i."invoiceKey" AS key,
        SUM(CASE WHEN i."invoiceDate" <= ${asOfDate}::date THEN l."netSaleAmount" ELSE 0 END) AS amount
      FROM "SaleLine" l JOIN "SaleInvoice" i ON i.id=l."invoiceId"
      WHERE l.status='POSTED' AND i.status='POSTED' AND l."lineType"='SALE' AND i."customerId" IS NOT NULL GROUP BY i."customerId",i."invoiceKey"
      UNION ALL
      SELECT i."supplierId",i."invoiceKey",SUM(CASE WHEN i."invoiceDate" <= ${asOfDate}::date THEN l."lineTotalCost" ELSE 0 END)
      FROM "PurchaseLine" l JOIN "PurchaseInvoice" i ON i.id=l."invoiceId"
      WHERE l.status='POSTED' AND i.status='POSTED' GROUP BY i."supplierId",i."invoiceKey"
      UNION ALL
      SELECT r."partyId",r."invoiceKey",-CASE
        WHEN p.type='CLIENT' AND r.type='SALE_RETURN' THEN r.qty*COALESCE(s."netSaleAmount"::numeric(70,40)/NULLIF(s.qty,0),0)
        WHEN p.type='SUPPLIER' AND r.type='PURCHASE_RETURN' THEN COALESCE(r."supplierCreditNote",r.qty*COALESCE(b."lineTotalCost"::numeric(70,40)/NULLIF(b.qty,0),0)) ELSE 0 END
      FROM "ReturnLine" r JOIN "Party" p ON p.id=r."partyId"
      LEFT JOIN ("SaleLine" s JOIN "SaleInvoice" si ON si.id=s."invoiceId" AND si.status='POSTED') ON s.id=r."sourceSaleLineId" AND s.status='POSTED'
      LEFT JOIN ("PurchaseLine" b JOIN "PurchaseInvoice" bi ON bi.id=b."invoiceId" AND bi.status='POSTED') ON b.id=r."sourcePurchaseLineId" AND b.status='POSTED'
      WHERE r.status='POSTED' AND r."returnDate" <= ${asOfDate}::date AND r."invoiceKey" <> 'افتتاحي'
      UNION ALL
      SELECT c."partyId",c."invoiceKey",CASE
        WHEN (p.type='CLIENT' AND c.type='CUSTOMER_COLLECTION') OR (p.type='SUPPLIER' AND c.type='SUPPLIER_PAYMENT') THEN -c.amount
        WHEN (p.type='CLIENT' AND c.type='CUSTOMER_REFUND') OR (p.type='SUPPLIER' AND c.type='SUPPLIER_REFUND') THEN c.amount ELSE 0 END
      FROM "CashTransaction" c JOIN "Party" p ON p.id=c."partyId"
      WHERE c.status='POSTED' AND c."txDate" <= ${asOfDate}::date AND c."invoiceKey" IS NOT NULL AND c."invoiceKey" <> ''
      UNION ALL
      SELECT p.id,'افتتاحي',CASE WHEN p."openingInvoice"<>0 THEN p."openingInvoice" ELSE p."openingBalance" END-p."openingPaid"
      FROM "Party" p WHERE p.type IN ('CLIENT','SUPPLIER') AND (p."openingBalance"<>0 OR p."openingInvoice"<>0 OR EXISTS(
        SELECT 1 FROM "CashTransaction" c WHERE c."partyId"=p.id AND c."invoiceKey"='افتتاحي' AND c.status='POSTED' AND c."txDate"<=${asOfDate}::date))
    ), invoices AS (SELECT party,key,SUM(amount) AS balance FROM events GROUP BY party,key)
`;
}
