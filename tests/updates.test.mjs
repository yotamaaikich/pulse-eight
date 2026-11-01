import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{newerVersion,latestUpdate,notifyUpdate,RELEASE_API}=require('../desktop/updates.cjs');
const release=(extra={})=>({tag_name:'v1.7.0',html_url:'https://github.com/yotamaaikich/pulse-eight/releases/tag/v1.7.0',draft:false,prerelease:false,...extra});
const fetcher=async()=>Response.json(release());
test('startup versions are compared numerically and malformed versions are ignored',()=>{
  assert.equal(newerVersion('v1.10.0','1.9.9'),true);assert.equal(newerVersion('1.6.1','1.6.0'),true);assert.equal(newerVersion('1.6.1','1.6.1'),false);assert.equal(newerVersion('1.5.9','1.6.1'),false);
  for(const version of ['1.6.1-beta','v01.6.1','javascript:alert(1)','9999999.0.0',null])assert.equal(newerVersion(version,'1.6.1'),false);
});
test('the release check uses only the official feed and ignores drafts, prereleases and untrusted destinations',async()=>{
  const update=await latestUpdate('1.6.1',{fetcher:async(url,options)=>{assert.equal(url,RELEASE_API);assert.equal(options.redirect,'error');assert.ok(options.signal);assert.equal(options.headers['User-Agent'],'PIANO-PULSE/1.6.1');return Response.json(release());}});assert.equal(update.version,'1.7.0');
  for(const extra of [{draft:true},{prerelease:true},{html_url:'https://attacker.invalid/download'},{tag_name:'v1.6.1',html_url:'https://github.com/yotamaaikich/pulse-eight/releases/tag/v1.6.1'}])assert.equal(await latestUpdate('1.6.1',{fetcher:async()=>Response.json(release(extra))}),null);
});
test('offline, rate limits, malformed metadata and stalled bodies never block normal startup',async()=>{
  for(const fetcher of [async()=>{throw new TypeError('offline');},()=>new Promise(()=>{}),async()=>new Response('',{status:403}),async()=>new Response('{bad'),async()=>new Response('x'.repeat(128001)),async()=>new Response(new ReadableStream({}))]){
    const proceed=await notifyUpdate({current:'1.6.1',fetcher,timeoutMs:20,showMessageBox:()=>assert.fail('unexpected update dialog'),openExternal:()=>assert.fail('unexpected browser')});assert.equal(proceed,true);
  }
});
test('newer releases show the notice before startup and offer update, postpone and safe open failure handling',async()=>{
  for(const choice of [0,1]){const opened=[];const proceed=await notifyUpdate({current:'1.6.1',fetcher,showMessageBox:async options=>{assert.equal(options.message,'最新版があります');assert.ok(options.detail.includes('1.6.1'));assert.ok(options.detail.includes('1.7.0'));assert.equal(options.cancelId,1);return {response:choice};},openExternal:async url=>opened.push(url)});assert.equal(proceed,choice!==0);assert.equal(opened.length,choice===0?1:0);if(opened.length)assert.equal(opened[0],release().html_url);}
  assert.equal(await notifyUpdate({current:'1.6.1',fetcher,showMessageBox:async()=>({response:0}),openExternal:async()=>{throw Error('browser unavailable');}}),true);
  assert.equal(await notifyUpdate({current:'1.6.1',fetcher,showMessageBox:async()=>{throw Error('dialog unavailable');},openExternal:()=>assert.fail('unexpected browser')}),true);
  assert.equal(await notifyUpdate({current:'1.6.1',fetcher,canPrompt:()=>false,showMessageBox:()=>assert.fail('auth callback must take priority'),openExternal:()=>assert.fail('unexpected browser')}),true);
});
