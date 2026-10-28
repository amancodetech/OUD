import {it,expect} from 'vitest';
import {computeComponentCosting} from '@/services/component-costing';
import {computeCostingEngine} from '@/domain/costing-engine';
import {toDecimal as d} from '@/domain/decimal';
import {ItemDomain} from '@/domain/types';
it('reuses unchanged components while recomputing a changed item exactly',()=>{
 const items:ItemDomain[]=['A','B'].map(id=>({id,code:id,name:id,role:'MERCHANDISE',openingQty:d(3),openingValue:d(2)}));
 const input={startYear:2026,items,purchases:[],sales:[],returns:[],stockIssues:[],batches:[]};const a=computeComponentCosting(input);
 const changed={...input,items:items.map(i=>i.id==='A'?{...i,openingValue:d(3)}:i)};const b=computeComponentCosting(changed),reference=computeCostingEngine(changed);
 expect(a.itemStates.get('B')).toBe(b.itemStates.get('B'));expect(a.itemStates.get('A')).not.toBe(b.itemStates.get('A'));
 for(const item of items)expect(JSON.parse(JSON.stringify(b.itemStates.get(item.id)))).toEqual(JSON.parse(JSON.stringify(reference.itemStates.get(item.id))));
});
