import { prisma, withReadSnapshot } from '@/lib/db';
import { computeReportsEngine } from '@/domain/reports-engine';
import { toDecimal } from '@/domain/decimal';
import { diffInDays, formatDate } from '@/domain/period';
import { loadAllLedgerData, loadCostingEngine, loadDriverGiftsEngine } from './ledger-loader';
import { reportBalanceSummary, invoiceBalancesQuery } from './report-balance-summary';
export async function notificationProjections(today: string) {
  return withReadSnapshot(async()=>{
    const data=await loadAllLedgerData(undefined,undefined,true);
    const summary=await reportBalanceSummary(data,today);
    const [dueRows, costing, driverResult]=await Promise.all([
      prisma.$queryRaw<{partyId:string;partyName:string;partyType:'CLIENT'|'SUPPLIER';invoiceKey:string;invoiceDebt:unknown;dueDate:Date}[]>`
        ${invoiceBalancesQuery(today)}
        SELECT p.id AS "partyId",p.name AS "partyName",p.type::text AS "partyType",b.key AS "invoiceKey",COALESCE(correction.debt,b.balance) AS "invoiceDebt",COALESCE(s."dueDate",i."dueDate") AS "dueDate"
        FROM invoices b JOIN "Party" p ON p.id=b.party
        LEFT JOIN JSONB_TO_RECORDSET(${JSON.stringify(summary.thresholdCorrections)}::jsonb) AS correction("partyId" text,"invoiceKey" text,debt numeric) ON correction."partyId"=b.party AND correction."invoiceKey"=b.key
        LEFT JOIN "SaleInvoice" s ON p.type='CLIENT' AND s."customerId"=p.id AND s."invoiceKey"=b.key AND s.status='POSTED'
        LEFT JOIN "PurchaseInvoice" i ON p.type='SUPPLIER' AND i."supplierId"=p.id AND i."invoiceKey"=b.key AND i.status='POSTED'
        WHERE COALESCE(correction.debt,b.balance)>0.01 AND ((p.type='CLIENT' AND s."dueDate"<${today}::date) OR (p.type='SUPPLIER' AND i."dueDate"<=${today}::date))
        ORDER BY COALESCE(s."dueDate",i."dueDate"),p.id,b.key LIMIT 201`,
      loadCostingEngine(),loadDriverGiftsEngine(today,data),
    ]);
    const invoiceItems=dueRows.slice(0,200).map(row=>({...row,invoiceDebt:toDecimal(String(row.invoiceDebt)),dueDate:formatDate(row.dueDate),daysOverdue:Math.max(0,diffInDays(today,formatDate(row.dueDate)))}));
    const reports=computeReportsEngine({...data,startDate:`${data.systemSetting.startYear}-01-01`,endDate:today,costingResult:costing,balanceSummary:summary});
    return {data,costing,driverResult,reports,balances:{...summary,invoiceItems},limited:dueRows.length>200};
  });
}
