import { it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, chmod, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
let dir: string, env: NodeJS.ProcessEnv;
const execute = (script: string) => new Promise<{code:number;output:string}>(done => execFile(process.execPath,[resolve(script)],{env},(error,stdout,stderr)=>done({code:error?Number(error.code)||1:0,output:stdout+stderr})));
beforeEach(async () => {
  dir=await mkdtemp(join(tmpdir(),'oud-backup-unit-'));await mkdir(join(dir,'bin'));
  await writeFile(join(dir,'password'),'private',{mode:0o600});
  await writeFile(join(dir,'bin','pg_dump'),'#!/usr/bin/env node\n'+String.raw`require('fs').writeFileSync(process.argv[process.argv.indexOf('--file')+1],'test dump');`+'\n',{mode:0o700});
  await writeFile(join(dir,'bin','restic'),'#!/usr/bin/env node\n'+String.raw`const fs=require('fs');fs.appendFileSync(process.env.CALLS,JSON.stringify(process.argv.slice(2))+'\n');if(process.env.FAIL_STEP===process.argv[2]){console.error('secret-do-not-expose');process.exit(1)}if(process.argv[2]==='backup')console.log(JSON.stringify({message_type:'summary',snapshot_id:'abcdef1234567890'}));`+'\n',{mode:0o700});
  env={...process.env,PATH:join(dir,'bin')+':'+process.env.PATH,BACKUP_DATABASE_URL:'postgresql://private:private@127.0.0.1/not-a-real-target',BACKUP_DIR:join(dir,'dumps'),BACKUP_STATUS_FILE:join(dir,'status.json'),RESTIC_REPOSITORY:'sftp:fake-unit-test',RESTIC_PASSWORD_FILE:join(dir,'password'),CALLS:join(dir,'calls'),FAIL_STEP:''};
});
afterEach(async()=>rm(dir,{recursive:true,force:true}));
it('publishes success only after snapshot, scoped retention and repository check',async()=>{
  const execution=await execute('scripts/backup-scheduled.mjs');
  expect(execution.code, execution.output + await readFile(env.BACKUP_STATUS_FILE!, 'utf8') + await readFile(env.CALLS!, 'utf8').catch(()=>'NO_RESTIC_CALL')).toBe(0);
  const state=JSON.parse(await readFile(env.BACKUP_STATUS_FILE!,'utf8'));expect(state.state).toBe('success');expect(state.snapshotId).toBe('abcdef1234567890');
  const calls=(await readFile(env.CALLS!,'utf8')).trim().split('\n').map(s=>JSON.parse(s));expect(calls.map(a=>a[0])).toEqual(['backup','forget','check']);
  expect(calls[1]).toContain('host,tags');expect(calls[1]).toContain('oud-erp');
  expect((await execute('scripts/backup-health.mjs')).code).toBe(0);
});
it.each(['backup','forget','check'])('does not mark a failed %s as a successful backup or disclose tool output',async step=>{
  const prior='2026-01-01T00:00:00Z';await writeFile(env.BACKUP_STATUS_FILE!,JSON.stringify({lastSuccessAt:prior}));env.FAIL_STEP=step;
  const result=await execute('scripts/backup-scheduled.mjs');expect(result.code).not.toBe(0);expect(result.output).not.toContain('secret-do-not-expose');
  const state=JSON.parse(await readFile(env.BACKUP_STATUS_FILE!,'utf8'));expect(state.state).toBe('failed');expect(state.lastSuccessAt).toBe(prior);
  expect((await execute('scripts/backup-health.mjs')).code).not.toBe(0);
});
it('refuses unset destination or a readable repository password',async()=>{
  env.RESTIC_REPOSITORY='';expect((await execute('scripts/backup-scheduled.mjs')).code).not.toBe(0);
  env.RESTIC_REPOSITORY='sftp:fake-unit-test';await chmod(env.RESTIC_PASSWORD_FILE!,0o644);expect((await execute('scripts/backup-scheduled.mjs')).code).not.toBe(0);
  await expect(access(env.CALLS!)).rejects.toThrow();
});
it('refuses overlapping jobs and reports missing or overdue backup status',async()=>{
  await mkdir(env.BACKUP_STATUS_FILE!+'.lock');expect((await execute('scripts/backup-scheduled.mjs')).code).not.toBe(0);
  expect((await execute('scripts/backup-health.mjs')).code).not.toBe(0);
  await writeFile(env.BACKUP_STATUS_FILE!,JSON.stringify({state:'success',lastSuccessAt:'2020-01-01T00:00:00Z'}));expect((await execute('scripts/backup-health.mjs')).code).not.toBe(0);
});
