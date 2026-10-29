import test from 'node:test';import assert from 'node:assert/strict';
import {createAccount,DESKTOP_REDIRECT,WEB_REDIRECT} from '../auth.mjs';
import {verifiedActor} from '../cloud/identity.mjs';
test('Google requires verified Auth user; malformed or forged authorization fails closed',async()=>{
  const id='12345678-1234-1234-1234-123456789abc';let calls=0;
  const env={baseUrl:'https://auth.invalid',clientKey:'public',fetcher:async(url,options)=>{calls++;assert.equal(url,'https://auth.invalid/auth/v1/user');assert.ok(options.headers.Authorization);return {ok:true,json:async()=>({id,user_metadata:{id:'someone-else'}})};}};
  assert.equal(await verifiedActor(null,env),null);assert.equal(calls,0);
  await assert.rejects(verifiedActor('not bearer',env),e=>e.status===401);
  assert.deepEqual(await verifiedActor('Bearer '+'a'.repeat(32),env),{id});
  await assert.rejects(verifiedActor('Bearer '+'a'.repeat(32),{...env,fetcher:async()=>({ok:false})}),e=>e.status===401);
});
function fixture(desktop,available=true){let user=null,listener,callback,config,oauth,logout,opened;const client={auth:{onAuthStateChange(fn){listener=fn;},async getSession(){return {data:{session:user?{user,access_token:'test-token'}:null}};},async signInWithOAuth(value){oauth=value;return {data:{url:'https://auth.invalid/authorize'}};},async exchangeCodeForSession(code){assert.equal(code,'test-code');user={id:'verified'};listener('SIGNED_IN',{user,access_token:'test-token'});return {};},async signOut(value){logout=value;user=null;listener('SIGNED_OUT',null);return {};}}};const bridge=desktop?{desktop:true,onAuthCallback(fn){callback=fn;},async beginGoogleSignIn(url){opened=url;}}:null;
  const changes=[],account=createAccount({bridge,fetcher:async()=>({ok:true,json:async()=>({external:{google:available}})}),load:async()=>({createClient(_u,_k,c){config=c;return client;}}),navigate:url=>{opened=url;},onChange:user=>changes.push(user)});
  return {account,changes,get config(){return config},get oauth(){return oauth},get opened(){return opened},get logout(){return logout},async callback(){await callback({code:'test-code'});}};}
test('browser and desktop use PKCE, external browser on desktop, and guest needs no token',async()=>{
  for(const desktop of [false,true]){const f=fixture(desktop);assert.deepEqual(await f.account.headers(null),{});await f.account.ready;assert.equal(f.config.auth.flowType,'pkce');assert.equal(f.config.auth.detectSessionInUrl,!desktop);await f.account.signIn();assert.equal(f.oauth.options.redirectTo,desktop?DESKTOP_REDIRECT:WEB_REDIRECT);assert.equal(f.oauth.options.skipBrowserRedirect,true);assert.equal(f.opened,'https://auth.invalid/authorize');if(desktop){await f.callback();assert.equal(f.changes.at(-1).id,'verified');assert.equal((await f.account.headers('verified')).Authorization,'Bearer test-token');await assert.rejects(f.account.headers('other'));await f.account.signOut();assert.equal(f.logout.scope,'local');assert.equal(f.changes.at(-1),null);}}
});

test('unconfigured Google provider keeps the game in place instead of redirecting to an error page',async()=>{const f=fixture(false,false);await f.account.ready;await assert.rejects(f.account.signIn(),/設定中/);assert.equal(f.opened,undefined);assert.equal(f.oauth,undefined);});
