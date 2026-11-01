import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {createAccount,cleanAuthUrl,WEB_REDIRECT,DESKTOP_REDIRECT} from '../auth.mjs';

function harness({desktop=false,url=WEB_REDIRECT,timeoutMs=1000,initialize,getSession,exchange,fetcher,loader}={}){
  const changes=[],errors=[],opened=[],exchanges=[];let callback,listener;
  const auth={initialize:initialize??(async()=>({})),onAuthStateChange(fn){listener=fn;},getSession:getSession??(async()=>({data:{session:null}})),
    async signInWithOAuth(){return {data:{url:'https://auth.invalid/authorize'}};},async signOut(){listener('SIGNED_OUT',null);return {};},
    async exchangeCodeForSession(code,options){exchanges.push({code,options});if(exchange)return exchange(code,options,listener);listener('SIGNED_IN',{user:{id:code},access_token:'test'});return {};}};
  const account=createAccount({bridge:desktop?{desktop:true,onAuthCallback(fn){callback=fn;},async beginGoogleSignIn(url){opened.push(url);}}:null,
    getUrl:()=>url,timeoutMs,load:loader??(async()=>({createClient:()=>({auth})})),fetcher:fetcher??(async()=>({ok:true,json:async()=>({external:{google:true}})})),navigate:url=>opened.push(url),onChange:(user,event)=>changes.push({user,event}),onError:message=>errors.push(message)});
  return {account,auth,changes,errors,opened,exchanges,callback:value=>callback(value),setUrl:value=>{url=value;}};
}

test('OAuth cancellation is visible without exposing provider details or signing out an existing user',async()=>{
  for(const suffix of ['?error=access_denied&error_description=private-debug-secret','#error=access_denied&error_description=private-debug-secret']){
    const f=harness({url:WEB_REDIRECT+suffix,getSession:async()=>({data:{session:{user:{id:'existing'},access_token:'test'}}})});
    await f.account.ready;assert.equal(f.changes.at(-1).user.id,'existing');assert.match(f.errors.at(-1),/キャンセル/);assert.ok(!f.errors.join('').includes('private-debug-secret'));
    assert.equal(cleanAuthUrl(WEB_REDIRECT+suffix),WEB_REDIRECT);await f.account.signIn();assert.equal(f.opened.length,1);
  }
  assert.equal(cleanAuthUrl(WEB_REDIRECT+'?login-check=1&code=secret&sb_flow_id=abcdefgh#access_token=secret&refresh_token=secret&section=play'),WEB_REDIRECT+'?login-check=1#section=play');
  assert.equal(cleanAuthUrl(WEB_REDIRECT+'#guide'),WEB_REDIRECT+'#guide');
});

test('expired session restoration does not permanently poison sign-in or sign-out',async()=>{
  let attempts=0;const f=harness({getSession:async()=>++attempts===1?{data:{session:null},error:{code:'refresh_token_not_found'}}:{data:{session:{user:{id:'restored'},access_token:'test-token'}}}});
  await f.account.ready;assert.match(f.errors.at(-1),/有効期限/);assert.deepEqual(await f.account.headers(null),{});
  await f.account.signIn();assert.equal(f.opened.length,1);assert.equal((await f.account.headers('restored')).Authorization,'Bearer test-token');
  await assert.rejects(f.account.headers('different'));await f.account.signOut();assert.equal(f.changes.at(-1).user,null);
});

test('unclaimed browser codes and SDK callback failures are reported, while successful callbacks stay signed in',async()=>{
  const missing=harness({url:WEB_REDIRECT+'?code=test-code'});await missing.account.ready;assert.match(missing.errors.at(-1),/確認情報/);
  const failed=harness({url:WEB_REDIRECT+'?code=test-code',initialize:async()=>({error:{code:'bad_code_verifier'}})});await failed.account.ready;assert.match(failed.errors.at(-1),/やり直して/);await failed.account.signIn();
  let success;success=harness({url:WEB_REDIRECT+'?code=test-code',initialize:async()=>{success.setUrl(WEB_REDIRECT);return {};},getSession:async()=>({data:{session:{user:{id:'signed-in'},access_token:'test'}}})});
  await success.account.ready;assert.deepEqual(success.errors,[]);assert.equal(success.changes.at(-1).user.id,'signed-in');
});

test('a failed SDK import can be retried and guest headers remain available',async()=>{
  let loads=0;const f=harness({loader:async()=>{if(++loads===1)throw new TypeError('offline');return {createClient:()=>({auth:f.auth})};}});
  await f.account.ready;assert.equal(f.errors.length,1);assert.deepEqual(await f.account.headers(null),{});await f.account.signIn();assert.equal(loads,2);assert.equal(f.opened.length,1);
});

test('stalled Auth restoration releases guest startup and still allows a fresh sign-in',async()=>{
  const f=harness({timeoutMs:25,getSession:()=>new Promise(()=>{})});await f.account.ready;
  assert.match(f.errors.at(-1),/接続/);assert.deepEqual(await f.account.headers(null),{});await f.account.signIn();assert.equal(f.opened.length,1);
});

test('desktop queues distinct callbacks, preserves flow identity, and never exchanges a duplicate code twice',async()=>{
  let finishFirst;const f=harness({desktop:true,exchange:async(code,options,notify)=>{if(code==='first')await new Promise(resolve=>{finishFirst=resolve;});notify('SIGNED_IN',{user:{id:code}});return {};}});
  await f.account.ready;const first=f.callback({code:'first',flowId:'flow_1234'}),second=f.callback({code:'second',flowId:'flow_5678'});
  for(let i=0;i<5;i++)await Promise.resolve();assert.equal(f.exchanges.length,1);finishFirst();await Promise.all([first,second]);
  assert.deepEqual(f.exchanges.map(x=>x.code),['first','second']);assert.deepEqual(f.exchanges.map(x=>x.options.flowId),['flow_1234','flow_5678']);assert.equal(f.changes.at(-1).user.id,'second');
  await f.callback({code:'second',flowId:'flow_5678'});assert.equal(f.exchanges.length,2);
  await f.callback({error:'access_denied'});assert.match(f.errors.at(-1),/キャンセル/);await f.callback({});assert.match(f.errors.at(-1),/やり直して/);
});

test('concurrent clicks share one OAuth start and a network failure allows another attempt',async()=>{
  let settings=0,release;const f=harness({fetcher:async()=>{if(++settings===1)throw new TypeError('offline');await new Promise(resolve=>{release=resolve;});return {ok:true,json:async()=>({external:{google:true}})};}});
  await f.account.ready;await assert.rejects(f.account.signIn(),/接続/);const first=f.account.signIn(),second=f.account.signIn();assert.equal(first,second);
  for(let i=0;i<6;i++)await Promise.resolve();release();await Promise.all([first,second]);assert.equal(settings,2);assert.equal(f.opened.length,1);
});

test('the pinned Supabase SDK generates a matching PKCE challenge, exchanges it, restores headers and logs out',async()=>{
  const memory=new Map(),requests=[],changes=[],errors=[];let callback,opened,client;
  const user={id:'12345678-1234-1234-1234-123456789abc',aud:'authenticated',role:'authenticated',app_metadata:{provider:'google'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');const access=part({alg:'HS256',typ:'JWT'})+'.'+part({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})+'.test';
  const account=createAccount({bridge:{desktop:true,onAuthCallback(fn){callback=fn;},async beginGoogleSignIn(url){opened=url;}},onChange:user=>changes.push(user),onError:error=>errors.push(error),
    fetcher:async()=>({ok:true,json:async()=>({external:{google:true}})}),load:async()=>({createClient(url,key,config){client=createClient(url,key,{...config,auth:{...config.auth,autoRefreshToken:false,storage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)}},global:{fetch:async(url,options)=>{requests.push({url,options});if(String(url).includes('/logout'))return new Response(null,{status:204});return Response.json({access_token:access,refresh_token:'fake-refresh-token',expires_in:3600,token_type:'bearer',user});}}});return client;}})});
  try{
    await account.ready;await account.signIn();const target=new URL(opened);assert.equal(target.searchParams.get('redirect_to'),DESKTOP_REDIRECT);assert.equal(target.searchParams.get('provider'),'google');
    await callback({code:'fake-auth-code'});const exchange=requests.find(x=>String(x.url).includes('grant_type=pkce')),body=JSON.parse(exchange.options.body);
    assert.equal(body.auth_code,'fake-auth-code');assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),target.searchParams.get('code_challenge'));
    assert.equal(changes.at(-1).id,user.id);assert.equal((await account.headers(user.id)).Authorization,'Bearer '+access);assert.deepEqual(errors,[]);
    await account.signOut();assert.equal(changes.at(-1),null);assert.equal(memory.get('piano-pulse-auth'),undefined);
  }finally{await client?.auth.stopAutoRefresh();}
});
