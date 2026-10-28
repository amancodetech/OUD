import { beforeAll, afterAll, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { assertTestDatabase } from '@/lib/test-database';
import { getSaleInvoices } from '@/services/sale.service';
import { stockQuantitiesAt, assertStockIntegrity } from '@/services/stock-integrity';
import { loadAllLedgerData, loadBalancesEngine } from '@/services/ledger-loader';
const prefix = 'CAP-' + Date.now();
let party: any, item: any;
beforeAll(async () => {
  await assertTestDatabase(prisma);
  party=await prisma.party.create({data:{code:prefix,name:prefix,type:'CLIENT'}});
  item=await prisma.item.create({data:{code:prefix,name:prefix,categoryId:(await prisma.itemCategory.findFirstOrThrow()).id,unitId:(await prisma.unitOption.findFirstOrThrow()).id,openingQty:1000,openingValue:1000}});
  await prisma.saleInvoice.createMany({data:Array.from({length:105},(_,i)=>({id:prefix+'-'+i,invoiceNo:prefix+'-'+i,invoiceKey:'2026 | '+prefix+'-'+i,invoiceYear:2026,invoiceDate:new Date('2026-10-01'),customerId:party.id}))});
  await prisma.saleLine.createMany({data:Array.from({length:105},(_,i)=>({code:prefix+'-'+i,invoiceId:prefix+'-'+i,itemId:item.id,qty:'0.1',unitPrice:2,netSaleAmount:'0.2'}))});
});
afterAll(async () => {
  await prisma.saleLine.deleteMany({where:{invoice:{customerId:party.id}}});
  await prisma.saleInvoice.deleteMany({where:{customerId:party.id}});
  await prisma.party.delete({where:{id:party.id}});await prisma.item.delete({where:{id:item.id}});
});
it('pages cover all matching documents without duplicates and search finds later pages', async () => {
  const first=await getSaleInvoices({customerId:party.id,page:1,pageSize:100});
  const second=await getSaleInvoices({customerId:party.id,page:2,pageSize:100});
  expect(first).toHaveLength(100);expect(second).toHaveLength(5);
  expect(new Set([...first,...second].map(r=>r.id)).size).toBe(105);
  expect(await getSaleInvoices({customerId:party.id,page:3,pageSize:100})).toEqual([]);
  const target=second[0];expect((await getSaleInvoices({customerId:party.id,search:target.invoiceNo})).some(r=>r.id===target.id)).toBe(true);
});
it('SQL daily aggregation preserves fractional and historical stock and rejects a later deficit', async () => {
  expect((await stockQuantitiesAt('2026-09-30')).get(item.id)?.toString()).toBe('1000');
  expect((await stockQuantitiesAt('2026-10-01')).get(item.id)?.toString()).toBe('989.5');
  const setting=await prisma.systemSetting.findUniqueOrThrow({where:{id:1}});
  await prisma.systemSetting.update({where:{id:1},data:{allowNegativeStock:false}});
  const issue=await prisma.stockIssue.create({data:{code:prefix,issueDate:new Date('2026-10-02'),type:'TESTER',itemId:item.id,qty:990,reason:'capacity regression'}});
  try{await expect(assertStockIntegrity()).rejects.toThrow(prefix);}finally{await prisma.stockIssue.delete({where:{id:issue.id}});await prisma.systemSetting.update({where:{id:1},data:{allowNegativeStock:setting.allowNegativeStock}});}
});
it('party-scoped join and balance calculations retain exact historical amounts', async () => {
  const data=await loadAllLedgerData([party.id]);expect(data.sales).toHaveLength(105);
  const balances=await loadBalancesEngine('2026-10-01',data);
  expect(balances.partySummaries[0].partyDebtAsOf.toString()).toBe('21');
  const prior=await loadBalancesEngine('2026-09-30',data);expect(prior.partySummaries[0].partyDebtAsOf.toString()).toBe('0');
});
