import {readSnapshotKey,withReadSnapshot} from './db';
import {workerRuntime} from './request-runtime.mjs';
// Bounded, snapshot-addressed values; never reuse a writer's uncommitted data.
const entries=new Map<string,Promise<unknown>>();
export function memoReadSnapshot<T>(label:string,load:()=>Promise<T>,cacheable:(value:T)=>boolean=()=>true):Promise<T>{
 return withReadSnapshot(async()=>{
  const scopedEntries=workerRuntime()?.memo??entries;
  const snapshot=await readSnapshotKey();if(!snapshot)return load();
  const key=snapshot+':'+label,cached=scopedEntries.get(key);if(cached)return cached as Promise<T>;
  const pending=load();scopedEntries.set(key,pending);
  while(scopedEntries.size>8)scopedEntries.delete(scopedEntries.keys().next().value!);
  void pending.then(value=>{if(!cacheable(value)&&scopedEntries.get(key)===pending)scopedEntries.delete(key)}).catch(()=>{if(scopedEntries.get(key)===pending)scopedEntries.delete(key)});
  return pending;
 });
}
