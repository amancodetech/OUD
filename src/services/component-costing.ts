import {createHash} from 'node:crypto';
import {computeCostingEngine,CostingEngineInput} from '@/domain/costing-engine';
import {CostingResult} from '@/domain/types';
import {Decimal,zero} from '@/domain/decimal';
import {getMonthIndex} from '@/domain/period';
const cache=new Map<string,{result:CostingResult;weight:number}>();let totalWeight=0;
// Independent stock components can reuse an identical pure-engine input even
// across snapshots. Manufacturing dependencies are always kept in one component.
export function computeComponentCosting(input:CostingEngineInput):CostingResult{
 const parent=new Map(input.items.map(i=>[i.id,i.id]));let invalid=false;
 const root=(id:string):string=>{let current=id;const path:string[]=[];for(;;){const next=parent.get(current);if(!next){invalid=true;return id}if(next===current)break;path.push(current);current=next}for(const node of path)parent.set(node,current);return current};
 for(const b of input.batches)if(b.status==='POSTED')for(const m of b.materials){const a=root(b.finishedItemId),c=root(m.rawItemId);if(!invalid)parent.set(c,a)}
 if(invalid)return computeCostingEngine(input);
 let maxMonth=input.targetMaxMonthIndex??12;
 const date=(day:string)=>{maxMonth=Math.max(maxMonth,getMonthIndex(day,input.startYear))};
 for(const r of input.purchases)if(r.status==='POSTED')date(r.invoiceDate);
 for(const r of input.sales)if(r.status==='POSTED')date(r.invoiceDate);
 for(const r of input.returns)if(r.status==='POSTED')date(r.returnDate);
 for(const r of input.stockIssues)if(r.status==='POSTED')date(r.issueDate);
 for(const r of input.batches)if(r.status==='POSTED')date(r.completionDate);
 const groups=new Map<string,CostingEngineInput>();
 for(const item of input.items){const id=root(item.id);let group=groups.get(id);if(!group){group={startYear:input.startYear,targetMaxMonthIndex:maxMonth,items:[],purchases:[],sales:[],returns:[],stockIssues:[],batches:[]};groups.set(id,group)}group.items.push(item)}
 const forItem=(id:string)=>groups.get(root(id));
 const saleItems=new Map(input.sales.map(s=>[s.id,s.itemId])),purchaseItems=new Map(input.purchases.map(p=>[p.id,p.itemId]));
 for(const row of input.purchases){const g=forItem(row.itemId);if(!g){invalid=true;break}g.purchases.push(row)}
 for(const row of input.sales){const g=forItem(row.itemId);if(!g){invalid=true;break}g.sales.push(row)}
 const returnItems=new Map<string,string>();
 for(const row of input.returns){if(row.status!=='POSTED')continue;const item=row.type==='SALE_RETURN'?saleItems.get(row.sourceSaleLineId??''):purchaseItems.get(row.sourcePurchaseLineId??'');const g=item?forItem(item):undefined;if(!g){invalid=true;break}g.returns.push(row);returnItems.set(row.id,item!)}
 for(const row of input.stockIssues){const g=forItem(row.itemId);if(!g){invalid=true;break}g.stockIssues.push(row)}
 for(const row of input.batches){if(row.status!=='POSTED')continue;const g=forItem(row.finishedItemId);if(!g){invalid=true;break}g.batches.push(row)}
 if(invalid)return computeCostingEngine(input);
 const byItem=new Map<string,CostingResult>();
 for(const group of groups.values()){
  const serialized=JSON.stringify({precision:Decimal.precision,rounding:Decimal.rounding,input:group});
  const key=createHash('sha256').update(serialized).digest('hex');
  let entry=cache.get(key);
  if(entry){cache.delete(key);cache.set(key,entry)}else{
   const result=computeCostingEngine(group);entry={result,weight:result.itemStates.size*result.maxMonthIndex+Math.ceil(serialized.length/64)};
   if(entry.weight<=50000){cache.set(key,entry);totalWeight+=entry.weight;while(totalWeight>50000||cache.size>2000){const oldest=cache.keys().next().value!;totalWeight-=cache.get(oldest)!.weight;cache.delete(oldest)}}
  }
  for(const item of group.items)byItem.set(item.id,entry.result);
 }
 const itemStates=new Map(input.items.map(item=>[item.id,byItem.get(item.id)!.itemStates.get(item.id)!]));
 const issueItems=new Map(input.stockIssues.filter(i=>i.status==='POSTED').map(i=>[i.id,i.itemId]));
 const engine=(item:string|undefined)=>item?byItem.get(item):undefined;
 return{startYear:input.startYear,maxMonthIndex:maxMonth,itemStates,
  getItemMonthlyAvgCost:(id,m)=>engine(id)?.getItemMonthlyAvgCost(id,m)??zero(),
  getItemEndingState:(id,m)=>{const result=engine(id);if(!result)throw Error(`Item ${id} not found in costing engine states`);return result.getItemEndingState(id,m)},
  getSaleLineCOGS:id=>engine(saleItems.get(id))?.getSaleLineCOGS(id)??zero(),
  getReturnSalesCost:id=>engine(returnItems.get(id))?.getReturnSalesCost(id)??zero(),
  getDamagedReturnExpense:id=>engine(returnItems.get(id))?.getDamagedReturnExpense(id)??zero(),
  getInventoryOutCost:id=>engine(returnItems.get(id))?.getInventoryOutCost(id)??zero(),
  getPurchaseVariance:id=>engine(returnItems.get(id))?.getPurchaseVariance(id)??zero(),
  getStockIssueCost:id=>engine(issueItems.get(id))?.getStockIssueCost(id)??zero(),
 };
}
