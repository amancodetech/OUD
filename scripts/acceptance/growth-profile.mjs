import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {performance} from 'node:perf_hooks';
import {db,login,request,save,base} from './common.mjs';
const results=[],runId=Date.now().toString(36),mix=['/api/items?search=Performance','/api/sales?startDate=2026-10-01&endDate=2026-10-01','/api/inventory?asOfDate=2026-10-10','/api/reports/dashboard?startDate=2026-10-01&endDate=2026-10-10','WRITE'];
const limits=[2000,2000,2000,5000,3000];let serial=0;
try{
 const name=process.env.OUD_PERF_CONTAINER;assert.match(name||'',/^oud-acceptance-perf-[a-z0-9-]+$/);
 const runtime=JSON.parse((await promisify(execFile)('docker',['inspect',name])).stdout)[0];
 assert.ok(runtime.HostConfig.Memory>0&&runtime.HostConfig.Memory<=2*1024**3&&runtime.HostConfig.NanoCpus>0&&runtime.HostConfig.NanoCpus<=2e9);
 const env=Object.fromEntries(runtime.Config.Env.map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)]}));assert.equal(env.DATABASE_URL,process.env.TEST_DATABASE_URL);assert.equal(env.APP_URL,base);
 assert.ok(await db.saleInvoice.count({where:{invoiceNo:{startsWith:'PERF-'}}})>=100000,'Existing isolated growth fixture required');
 const customer=await db.party.findUniqueOrThrow({where:{code:'AC-C'}}),item=await db.item.findUniqueOrThrow({where:{code:'AC001'}}),cookie=await login();
 for(const users of [5,10,20]){
  const samples=[],errors=[];let failed=false,writes=0;const begin=performance.now(),end=begin+60000;
  await Promise.all(Array.from({length:users},async(_,user)=>{let i=user;while(performance.now()<end&&!failed){const route=mix[(i++)%mix.length],write=route==='WRITE',start=performance.now();try{
   const number=++serial;const r=await fetch(base+(write?'/api/sales':route),{method:write?'POST':'GET',headers:{Cookie:cookie,Origin:base,...(write?{'Content-Type':'application/json','Idempotency-Key':`profile-${runId}-${number}`}:{})},...(write?{body:JSON.stringify({invoiceDate:'2026-10-10',invoiceNo:`PROFILE-${runId}-${number}`,customerId:customer.id,lines:[{itemId:item.id,qty:1,unitPrice:2}]})}:{}),signal:AbortSignal.timeout(30000)});const body=await r.text();samples.push({route,ms:performance.now()-start,status:r.status});if(!r.ok){errors.push({route,status:r.status,error:body.slice(0,500)});failed=true}else if(write)writes++;
  }catch(e){errors.push({route,error:e.name});failed=true}await new Promise(r=>setTimeout(r,1000));}}));
  const groups=Object.fromEntries(mix.map((route,i)=>{const values=samples.filter(s=>s.route===route).map(s=>s.ms).sort((a,b)=>a-b);const p95=values[Math.floor(values.length*.95)]??null;return[route,{count:values.length,p95,targetMs:limits[i],pass:p95!==null&&p95<=limits[i]}]}));
  const stage={users,elapsedMs:performance.now()-begin,requests:samples.length,writes,errors,groups};results.push(stage);await save('growth-profile',{imageId:runtime.Image,results,complete:false});console.log(JSON.stringify(stage));if(failed)throw Error('Growth stopped on failed request');
 }
 const sums=await db.saleLine.aggregate({_sum:{netSaleAmount:true,qty:true}});const {data}=await request(mix[3],{cookie});assert.equal(data.cards.netSales,Number(sums._sum.netSaleAmount));assert.equal(data.cards.operatingProfit,Number(sums._sum.netSaleAmount)-Number(sums._sum.qty)-15);
 const pass=results.every(r=>!r.errors.length&&r.elapsedMs>=60000);const meetsInitialTargets=results.every(r=>Object.values(r.groups).every(g=>g.pass));await save('growth-profile',{imageId:runtime.Image,pass,complete:true,results,meetsInitialTargets,financialIntegrity:true,scope:'Capacity characterization per acceptance plan section8; initial-load latency goals are not growth acceptance requirements.'});assert.ok(pass,'Growth stage incomplete or request failed');
}catch(e){await save('growth-profile-failure',{pass:false,results,error:e.message});throw e}finally{await db.$disconnect()}
