import {beforeAll,afterAll,it,expect} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {prisma,withLedgerTransaction,withReadSnapshot} from '@/lib/db';
import {assertTestDatabase} from '@/lib/test-database';
import {loadAllLedgerData,loadCostingEngine} from '@/services/ledger-loader';
import {toDecimal} from '@/domain/decimal';
const prefix='SNAP-'+Date.now();let item:any;const other=new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
beforeAll(async()=>{await assertTestDatabase(prisma);await assertTestDatabase(other);item=await prisma.item.create({data:{code:prefix,name:prefix,categoryId:(await prisma.itemCategory.findFirstOrThrow()).id,unitId:(await prisma.unitOption.findFirstOrThrow()).id,openingQty:100,openingValue:1000}})});
afterAll(async()=>{await prisma.item.delete({where:{id:item.id}});await other.$disconnect()});
it('coalesces duplicate calculations inside the same read snapshot',async()=>{
 await withReadSnapshot(async()=>{const [a,b]=await Promise.all([loadCostingEngine(10),loadCostingEngine(10)]);expect(a).toBe(b);expect(a.getItemEndingState(item.id,10).AVG.toString()).toBe('10')});
});
it('never shares a cached result with the current writer or its successive uncommitted changes',async()=>{
 await withLedgerTransaction(async()=>{await prisma.item.update({where:{id:item.id},data:{openingValue:2000}});const first=await loadCostingEngine(10);expect(first.getItemEndingState(item.id,10).AVG.toString()).toBe('20');await prisma.item.update({where:{id:item.id},data:{openingValue:3000}});const second=await loadCostingEngine(10);expect(second.getItemEndingState(item.id,10).AVG.toString()).toBe('30')});
 expect((await loadCostingEngine(10)).getItemEndingState(item.id,10).AVG.toString()).toBe('30');
});
it('retains the older read view during an external commit, and sees the commit in the next snapshot',async()=>{
 await withReadSnapshot(async()=>{const before=await loadCostingEngine(10);await other.item.update({where:{id:item.id},data:{openingValue:4000}});const sameView=await loadCostingEngine(10);expect(sameView).toBe(before);expect(sameView.getItemEndingState(item.id,10).AVG.toString()).toBe('30')});
 expect((await loadCostingEngine(10)).getItemEndingState(item.id,10).AVG.toString()).toBe('40');
});
it('does not cache caller-supplied projections',async()=>{
 const data=await loadAllLedgerData();data.items.find(i=>i.id===item.id)!.openingValue=toDecimal(5000);
 expect((await loadCostingEngine(10,data)).getItemEndingState(item.id,10).AVG.toString()).toBe('50');
 expect((await loadCostingEngine(10)).getItemEndingState(item.id,10).AVG.toString()).toBe('40');
});
it('stock sharing follows the same visibility rules as costing',async()=>{
 const {stockQuantitiesAt}=await import('@/services/stock-integrity');
 await withLedgerTransaction(async()=>{await prisma.item.update({where:{id:item.id},data:{openingQty:200}});expect((await stockQuantitiesAt('2026-10-31',[item.id])).get(item.id)?.toString()).toBe('200');await prisma.item.update({where:{id:item.id},data:{openingQty:300}});expect((await stockQuantitiesAt('2026-10-31',[item.id])).get(item.id)?.toString()).toBe('300')});
 await withReadSnapshot(async()=>{expect((await stockQuantitiesAt('2026-10-31',[item.id])).get(item.id)?.toString()).toBe('300');await other.item.update({where:{id:item.id},data:{openingQty:400}});expect((await stockQuantitiesAt('2026-10-31',[item.id])).get(item.id)?.toString()).toBe('300')});
 expect((await stockQuantitiesAt('2026-10-31',[item.id])).get(item.id)?.toString()).toBe('400');
});
