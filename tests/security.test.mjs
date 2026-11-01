import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {desktopAuthStorage} from '../desktop-auth-storage.mjs';import {readJson,consumeBudget,requestAddress} from '../cloud/http.mjs';
const require=createRequire(import.meta.url),{createAuthVault}=require('../desktop/auth-vault.cjs');
test('desktop vault encrypts sessions, rotates ciphertext, survives restart and limits IPC keys',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'pulse-vault-')),file=path.join(directory,'auth.json');let rotate=false;
  const safeStorage={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async text=>Buffer.from('encrypted:'+Buffer.from(text).toString('base64')),decryptStringAsync:async bytes=>({result:Buffer.from(bytes.toString().slice(10),'base64').toString(),shouldReEncrypt:rotate})};
  const vault=createAuthVault({file,safeStorage}),key='piano-pulse-auth';await vault.setItem(key,'private-test-session');assert.ok(!(await fs.readFile(file,'utf8')).includes('private-test-session'));
  assert.equal(await createAuthVault({file,safeStorage}).getItem(key),'private-test-session');rotate=true;assert.equal(await vault.getItem(key),'private-test-session');rotate=false;
  assert.throws(()=>vault.getItem('../settings'));assert.throws(()=>vault.setItem(key,'x'.repeat(128001)));
  for(let i=0;i<31;i++)await vault.setItem('piano-pulse-auth-flow-'+String(i).padStart(8,'0')+'-code-verifier','v');await assert.rejects(vault.setItem('piano-pulse-auth-flow-overflow1-code-verifier','v'),/上限/);
  await vault.removeItem(key);assert.equal(await createAuthVault({file,safeStorage}).getItem(key),null);
  // This removes only the task-created empty test files, never an app profile.
  for(const item of await fs.readdir(directory))await fs.unlink(path.join(directory,item));await fs.rmdir(directory);
});
test('unavailable encryption never writes plaintext and legacy migration deletes only after a successful save',async()=>{
  let writes=0;const memory=new Map([['piano-pulse-auth','old-session']]),legacy={getItem:key=>memory.get(key)??null,removeItem:key=>memory.delete(key)};
  const failed=desktopAuthStorage({getItem:async()=>null,setItem:async()=>{throw Error('disk failed');}},legacy);await assert.rejects(failed.getItem('piano-pulse-auth'));assert.equal(memory.get('piano-pulse-auth'),'old-session');
  const saved=new Map(),storage=desktopAuthStorage({getItem:async key=>saved.get(key)??null,setItem:async(key,value)=>{writes++;saved.set(key,value);},removeItem:async key=>saved.delete(key)},legacy);
  assert.equal(await storage.getItem('piano-pulse-auth'),'old-session');assert.equal(memory.size,0);assert.equal(writes,1);await storage.removeItem('piano-pulse-auth');assert.equal(saved.size,0);
  const absent=path.join(os.tmpdir(),'pulse-never-write-'+crypto.randomUUID(),'vault.json'),vault=createAuthVault({file:absent,safeStorage:{isAsyncEncryptionAvailable:async()=>false}});await vault.setItem('piano-pulse-auth','memory-only');assert.equal(await vault.getItem('piano-pulse-auth'),'memory-only');await assert.rejects(fs.access(absent));
});
test('request bodies are bounded in bytes while streaming, including dishonest lengths and stalled bodies',async()=>{
  const request=body=>new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json'},body});assert.deepEqual(await readJson(request('{"ok":true}')),{ok:true});
  await assert.rejects(readJson(request('[1]')),e=>e.status===400);await assert.rejects(readJson(request('{bad')),e=>e.status===400);
  await assert.rejects(readJson(request('{"x":"'+ 'あ'.repeat(10)+'"}'),{limit:20}),e=>e.status===413);
  await assert.rejects(readJson(new Request('https://test.invalid',{method:'POST',body:'{}'})),e=>e.status===415);
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(50));}});
  await assert.rejects(readJson(new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json','content-length':'1'},body:stream,duplex:'half'}),{limit:20}),e=>e.status===413);
  await assert.rejects(readJson(new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json'},body:new ReadableStream({}),duplex:'half'}),{timeoutMs:20}),e=>e.status===408);
});
test('request budgets reject exhausted quotas and use address hints independently of guest tokens',async()=>{
  const calls=[],db=async(...args)=>{calls.push(args);return calls.length===1;};await consumeBudget(db,'read','a'.repeat(64));await assert.rejects(consumeBudget(db,'read','a'.repeat(64)),e=>e.status===429);
  assert.deepEqual(calls[0],['rpc/pulse_keys_consume_budget','POST',{p_category:'read',p_key:'a'.repeat(64)}]);
  assert.equal(requestAddress(new Headers({'x-forwarded-for':'forged, 192.0.2.1'})),'192.0.2.1');assert.equal(requestAddress(new Headers({'x-forwarded-for':'not-an-address'})),'unknown');
});
