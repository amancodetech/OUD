import { performance } from 'node:perf_hooks';
import { db, fixture, login, request, save, base, identity } from './common.mjs';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const results = [];
const duration = Number(process.env.OUD_PERF_MEASURE_MS || 900000);
const warmup = Number(process.env.OUD_PERF_WARMUP_MS || 300000);
assert.ok(duration >= 900000 && warmup >= 300000, 'Acceptance durations must match the planned minimums');
try {
  // Load tests must be constrained by the runtime, even on a shared host.
  const container = process.env.OUD_PERF_CONTAINER;
  assert.match(container || '', /^oud-acceptance-perf-[a-z0-9-]+$/);
  const { stdout } = await promisify(execFile)('docker', ['inspect', container]);
  const runtime = JSON.parse(stdout)[0];
  assert.ok(runtime.HostConfig.Memory >= 256*1024*1024 && runtime.HostConfig.Memory <= 2*1024*1024*1024, 'A 256MB–2GB container memory limit is required');
  assert.ok(runtime.HostConfig.NanoCpus > 0 && runtime.HostConfig.NanoCpus <= 2e9, 'A runtime CPU limit of at most 2 is required');
  const runtimeEnv=Object.fromEntries(runtime.Config.Env.map(value=>{const i=value.indexOf('=');return[value.slice(0,i),value.slice(i+1)];}));
  assert.equal(runtimeEnv.DATABASE_URL,process.env.TEST_DATABASE_URL);
  assert.equal(runtimeEnv.APP_URL,base);
  const f = await fixture();
  await db.saleInvoice.deleteMany();
  await db.item.update({ where: { id: f.item.id }, data: { openingQty: 100000, openingValue: 100000 } });
  await db.$executeRaw`INSERT INTO "Item" (id,code,name,"categoryId","unitId",role,"openingQty","openingValue","updatedAt") SELECT 'perf-i-'||g,'PERF-I-'||g,'Performance item '||g,${f.category.id},${f.unit.id},'MERCHANDISE'::"ItemRole",100000,100000,NOW() FROM generate_series(1,999) g`;
  await db.$executeRaw`INSERT INTO "Party" (id,code,name,type,"updatedAt") SELECT 'perf-p-'||g,'PERF-P-'||g,'Performance customer '||g,'CLIENT'::"PartyType",NOW() FROM generate_series(1,497) g`;
  const cookie = await login();
  async function populate(first, last) {
    await identity();
    await db.$executeRaw`INSERT INTO "SaleInvoice" (id,"invoiceNo","invoiceYear","invoiceKey","invoiceDate","customerId","updatedAt") SELECT 'perf-s-'||g,'PERF-S-'||g,2026,'2026 | PERF-S-'||g,'2026-10-01'::date,'perf-p-'||(1+(g%497)),NOW() FROM generate_series(${first}::int,${last}::int) g`;
    await db.$executeRaw`INSERT INTO "SaleLine" (id,code,"invoiceId","itemId",qty,"unitPrice","netSaleAmount") SELECT 'perf-l-'||g||'-'||j,'PERF-L-'||g||'-'||j,'perf-s-'||g,'perf-i-'||(1+((g+j)%999)),1,2,2 FROM generate_series(${first}::int,${last}::int) g CROSS JOIN generate_series(1,3) j`;
  }
  await populate(1,10000);
  // Include returns, purchases, cash and manufacturing without invalidating the
  // independently known sale totals. Keep their oracle components explicit.
  const raw = await db.item.create({data:{code:'PERF-RAW',name:'Performance raw',role:'RAW',categoryId:f.category.id,unitId:f.unit.id,openingQty:100,openingValue:100}});
  const finished = await db.item.create({data:{code:'PERF-FIN',name:'Performance finished',role:'FINISHED',categoryId:f.category.id,unitId:f.unit.id}});
  await db.productionBatch.create({data:{id:'perf-batch',code:'PERF-BATCH',completionDate:new Date('2026-10-01'),finishedItemId:finished.id,producedQty:10,materials:{create:{rawItemId:raw.id,consumedQty:10}}}});
  await db.cashTransaction.create({data:{code:'PERF-EXPENSE',txDate:new Date('2026-10-01'),type:'CASH_EXPENSE',account:'CASH',amount:15}});
  await db.purchaseInvoice.create({data:{id:'perf-purchase',invoiceNo:'PERF-BUY',invoiceYear:2026,invoiceKey:'2026 | PERF-BUY',invoiceDate:new Date('2026-10-01'),supplierId:f.supplier.id,lines:{create:{code:'PERF-BUY-LINE',itemId:f.item.id,qty:10,unitCost:1,lineTotalCost:10}}}});
  await db.returnLine.create({data:{code:'PERF-RETURN',returnDocNo:'PERF-RETURN',returnDate:new Date('2026-10-02'),type:'PURCHASE_RETURN',partyId:f.supplier.id,invoiceKey:'2026 | PERF-BUY',sourcePurchaseLineId:(await db.purchaseLine.findFirstOrThrow({where:{invoiceId:'perf-purchase'}})).id,qty:1,reason:'Performance supplier return'}});
  const mix = ['/api/items?search=Performance','/api/sales?startDate=2026-10-01&endDate=2026-10-01','/api/inventory?asOfDate=2026-10-10','/api/reports/dashboard?startDate=2026-10-01&endDate=2026-10-10','WRITE'];
  let serial=0;
  async function measure(label, users, ms, collect=true) {
    const samples=[], errors=[]; const began=performance.now(),stop=began+ms; let writes=0, failed=false;
    const tasks=Array.from({length:users},async(_,user)=>{
      let iteration=user;
      while(performance.now()<stop&&!failed){
        const route=mix[(iteration++)%mix.length]; const start=performance.now();
        try {
          const write=route==='WRITE';
          const response=await fetch(base+(write?'/api/sales':route),{method:write?'POST':'GET',headers:{Cookie:cookie,Origin:base,...(write?{'Content-Type':'application/json','Idempotency-Key':`perf-save-${++serial}`}:{})},...(write?{body:JSON.stringify({invoiceDate:'2026-10-10',invoiceNo:`PERF-WRITE-${serial}`,customerId:f.customer.id,lines:[{itemId:f.item.id,qty:1,unitPrice:2}]})}:{}),signal:AbortSignal.timeout(90000)});
          await response.arrayBuffer();
          if(!response.ok){errors.push({route,status:response.status});failed=true;} else if(write)writes++;
          samples.push({route,ms:performance.now()-start,status:response.status});
        }catch(e){errors.push({route,error:e.name});samples.push({route,ms:performance.now()-start,status:0});failed=true;}
        await new Promise(r=>setTimeout(r,1000));
      }
    });
    await Promise.all(tasks);
    const groups=Object.fromEntries(mix.map(route=>{const values=samples.filter(s=>s.route===route).map(s=>s.ms).sort((a,b)=>a-b);return[route,{count:values.length,p50:values[Math.min(values.length-1,Math.floor(values.length*.5))]??null,p95:values[Math.min(values.length-1,Math.floor(values.length*.95))]??null}];}));
    const result={label,users,plannedDurationMs:ms,elapsedMs:performance.now()-began,requests:samples.length,writes,errors,groups};
    if(collect)results.push(result);
    await save('performance-progress',{imageId:runtime.Image,identity:await identity(),startedAt:new Date().toISOString(),duration,warmup,results,last:result});
    console.log(label,JSON.stringify(result));
    if(failed)throw new Error('Load stopped after an unexpected response or timeout; inspect recorded results before escalating');
    return result;
  }
  await save('performance-spec',{imageId:runtime.Image,hardware:await db.$queryRaw`SELECT version()`,items:1002,parties:500,invoices:10001,lines:30001,warmupMs:warmup,measureMs:duration,users:5,thinkTimeMs:1000,readP95Ms:2000,writeP95Ms:3000,dashboardP95Ms:5000,growthUsers:[5,10,20],growthStageMs:60000});
  await measure('baseline-warmup',5,warmup,false);
  await measure('baseline-measured',5,duration);
  await populate(10001,100000);
  for(const users of [5,10,20])await measure(`growth-${users}`,users,60000);
  const count=await db.saleInvoice.count({where:{status:'POSTED'}});
  const sums=await db.saleLine.aggregate({_sum:{netSaleAmount:true,qty:true}});
  const cards=(await request('/api/reports/dashboard?startDate=2026-10-01&endDate=2026-10-10',{cookie})).data.cards;
  assert.equal(cards.netSales,Number(sums._sum.netSaleAmount));
  assert.equal(cards.operatingProfit,Number(sums._sum.netSaleAmount)-Number(sums._sum.qty)-15);
  const limits = { [mix[0]]: 2000, [mix[1]]: 2000, [mix[2]]: 2000, [mix[3]]: 5000, WRITE: 3000 };
  const capacityTargetExceedances = results.filter(stage=>stage.label.startsWith('growth')).flatMap(stage => Object.entries(stage.groups).filter(([route,g]) => g.count === 0 || g.p95 > limits[route]).map(([route,g]) => ({stage:stage.label,route,p95:g.p95,initialLoadTarget:limits[route]})));
  const targetFailures = results.filter(stage=>stage.label==='baseline-measured').flatMap(stage => Object.entries(stage.groups).filter(([route,g]) => g.count === 0 || g.p95 > limits[route]).map(([route,g]) => ({stage:stage.label,route,p95:g.p95,target:limits[route]})));
  await save('performance',{imageId:runtime.Image,pass:targetFailures.length===0,targetFailures,capacityTargetExceedances,growthScope:'Capacity characterization; initial-load goals apply only to baseline-measured (plan section8).',results,final:{invoiceCount:count,netSales:cards.netSales,operatingProfit:cards.operatingProfit,independentSales:Number(sums._sum.netSaleAmount),independentProfit:Number(sums._sum.netSaleAmount)-Number(sums._sum.qty)-15},integrityPass:true});
  assert.equal(targetFailures.length,0,'Performance targets exceeded; inspect measurements');
}catch(e){await save('performance-failure',{results,pass:false,failure:e.message});throw e;}finally{await db.$disconnect();}
