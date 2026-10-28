import {readSnapshotKey,withReadSnapshot} from './db';
// Bounded, snapshot-addressed values; never reuse a writer's uncommitted data.
const entries=new Map<string,Promise<unknown>>();
export function memoReadSnapshot<T>(label:string,load:()=>Promise<T>,cacheable:(value:T)=>boolean=()=>true):Promise<T>{
 return withReadSnapshot(async()=>{
  const snapshot=await readSnapshotKey();if(!snapshot)return load();
  const key=snapshot+':'+label,cached=entries.get(key);if(cached)return cached as Promise<T>;
  const pending=load();entries.set(key,pending);
  while(entries.size>8)entries.delete(entries.keys().next().value!);
  void pending.then(value=>{if(!cacheable(value)&&entries.get(key)===pending)entries.delete(key)}).catch(()=>{if(entries.get(key)===pending)entries.delete(key)});
  return pending;
 });
}
