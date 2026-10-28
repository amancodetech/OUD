import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { db, fixture, login, request, save, base } from './common.mjs';
let proxy;
try {
  await fixture();const cookie=await login();
  const make=i=>({txDate:'2026-10-21',type:'CASH_EXPENSE',account:'CASH',amount:1,description:'AC-CONCURRENT-'+i});
  const results=await Promise.all(Array.from({length:20},(_,i)=>request('/api/cash',{method:'POST',cookie,body:make(i),headers:{'Idempotency-Key':'accept-concurrent-'+i},status:201})));
  const codes=results.map(r=>r.data.code);assert.equal(new Set(codes).size,20);
  const stored=await db.cashTransaction.findMany({where:{description:{startsWith:'AC-CONCURRENT-'}}});assert.equal(stored.length,20);
  assert.deepEqual(stored.map(r=>r.code).sort(),codes.sort());
  const body={txDate:'2026-10-21',type:'CASH_EXPENSE',account:'CASH',amount:1,description:'AC-LOST-AFTER-COMMIT'};
  const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json','Idempotency-Key':'accept-lost-after-commit'};
  let committedResolve,committedReject,release;
  const committed=new Promise((resolve,reject)=>{committedResolve=resolve;committedReject=reject;});const gate=new Promise(resolve=>release=resolve);
  let downstream;
  proxy=createServer(async(req,res)=>{
    downstream=res;
    try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const upstream=await fetch(base+'/api/cash',{method:'POST',headers,body:Buffer.concat(chunks)});
      const payload=await upstream.text();assert.equal(upstream.status,201);
      // The upstream operation and transaction have finished. Withhold every
      // response byte from the client until the test deliberately disconnects it.
      committedResolve(JSON.parse(payload));await gate;
      if(!res.destroyed){res.writeHead(upstream.status,{'Content-Type':'application/json'});res.end(payload);}
    }catch(e){committedReject(e);if(!res.destroyed)res.destroy();}
  });
  await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(3110,'127.0.0.1',resolve);});
  const abort=new AbortController();const client=fetch('http://127.0.0.1:3110/api/cash',{method:'POST',headers,body:JSON.stringify(body),signal:abort.signal}).then(r=>({status:r.status}),e=>({error:e.name}));
  const saved=await Promise.race([committed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Commit was not observed')),15000))]);
  assert.equal(downstream.headersSent,false);assert.equal((await db.cashTransaction.findUniqueOrThrow({where:{id:saved.id}})).description,body.description);
  abort.abort();const lost=await client;assert.equal(lost.error,'AbortError');release();
  const retry=await request('/api/cash',{method:'POST',cookie,body,headers:{'Idempotency-Key':headers['Idempotency-Key']},status:201});assert.equal(retry.data.id,saved.id);
  assert.equal(await db.cashTransaction.count({where:{description:body.description}}),1);
  await save('concurrency-http',{pass:true,parallelCreates:20,storedDocuments:stored.length,uniqueCodes:new Set(codes).size,lostAfterCommit:{committedRowObserved:true,responseHeadersWithheld:true,clientError:lost.error,retryReturnsOriginalId:true,documentCount:1}});
  console.log('PASS twenty concurrent HTTP creates and disconnect after commit before response, followed by one-document replay');
}finally{if(proxy){proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}await db.$disconnect();}
