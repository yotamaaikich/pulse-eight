import test from 'node:test';import assert from 'node:assert/strict';import net from 'node:net';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{APP_URL,bundledPath,trustedGame,externalURL,oauthURL,authCallback}=require('../desktop/security.cjs'),{DiscordPresence,packet,createActivity}=require('../desktop/discord.cjs');
const catalog=[{id:'monitoring',title:'モニタリング',duration:181}];
test('bundled content and IPC origin cannot escape into local files or arbitrary external destinations',()=>{
  const root=path.resolve('app');assert.equal(bundledPath(APP_URL,root),path.join(root,'index.html'));assert.equal(bundledPath(APP_URL+'audio/piano/C4.mp3',root),path.join(root,'audio/piano/C4.mp3'));
  for(const suffix of ['cloud/index.ts','.env','package.json','desktop/main.cjs','audio/%5csecret.mp3'])assert.equal(bundledPath(APP_URL+suffix,root),false);
  assert.equal(bundledPath('https://www.youtube.com/embed/test',root),null);assert.ok(trustedGame(APP_URL));assert.ok(!trustedGame(APP_URL+'desktop/settings.html'));assert.ok(!trustedGame('https://attacker.invalid/pulse-eight/'));
  assert.equal(externalURL('javascript:alert(1)'),null);assert.equal(externalURL('file:///C:/private.txt'),null);assert.equal(externalURL('https://github.com.evil.invalid/'),null);
  const oauth='https://yowhxryuxsqvjddizrts.supabase.co/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent('pianopulse://auth/callback');assert.equal(oauthURL(oauth),oauth);assert.equal(oauthURL(oauth.replace('provider=google','provider=github')),null);assert.equal(oauthURL(oauth.replace('yowhxryuxsqvjddizrts','wrong')),null);
  assert.deepEqual(authCallback('pianopulse://auth/callback?code=one-time'),{code:'one-time'});assert.equal(authCallback('https://auth/callback?code=steal'),null);assert.equal(authCallback('pianopulse://auth/callback#access_token=secret'),null);
});
test('Discord local RPC handles split frames, handshake, PING, valid presence and clearing on exit',async()=>{
  const pipe=process.platform==='win32'?'\\\\?\\pipe\\piano-pulse-test-'+randomUUID():path.join(os.tmpdir(),'pulse-'+randomUUID()),messages=[];let readyResolve;const sent=new Promise(resolve=>{readyResolve=resolve;});
  const server=net.createServer(socket=>{let data=Buffer.alloc(0);socket.on('data',chunk=>{data=Buffer.concat([data,chunk]);while(data.length>=8){const op=data.readUInt32LE(0),length=data.readUInt32LE(4);if(data.length<8+length)return;const value=JSON.parse(data.subarray(8,8+length));data=data.subarray(8+length);messages.push({op,value});if(op===0){const frame=packet(1,{evt:'READY'});socket.write(frame.subarray(0,5));socket.write(Buffer.concat([frame.subarray(5),packet(3,{hello:'ping'})]));}if(messages.some(m=>m.op===4)&&messages.some(m=>m.value.cmd==='SET_ACTIVITY'&&m.value.args.activity))readyResolve();}});});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(pipe,resolve);});
  const presence=new DiscordPresence({applicationId:'1565410602476769310',catalog,paths:[pipe],interval:20});
  try{presence.update({songId:'monitoring',difficulty:2,phase:'running',position:4});presence.start();await Promise.race([sent,new Promise((_,reject)=>setTimeout(()=>reject(Error('RPC timeout')),2000).unref())]);assert.equal(messages[0].value.client_id,'1565410602476769310');assert.ok(messages.some(m=>m.op===4));const activity=messages.find(m=>m.value.cmd==='SET_ACTIVITY').value.args.activity;assert.equal(activity.details,'モニタリング');assert.equal(activity.state,'HARD · プレイ中');assert.equal(activity.timestamps.end-activity.timestamps.start,181);assert.equal(presence.status().connected,true);
  }finally{presence.stop();await new Promise(resolve=>server.close(resolve));}
  assert.ok(messages.some(m=>m.value.cmd==='SET_ACTIVITY'&&m.value.args.activity===null));
});
test('Discord activity is derived from the bundled catalog and pauses do not keep elapsed timers',()=>{
  const activity=createActivity({songId:'monitoring',difficulty:1,phase:'paused',position:10},catalog);assert.equal(activity.timestamps,undefined);assert.equal(activity.state,'NORMAL · 一時停止');assert.equal(createActivity({songId:'unknown',difficulty:2,phase:'running'},catalog).details,'曲を選んでいます');
});
