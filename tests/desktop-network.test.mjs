import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {APP_URL}=require('../desktop/security.cjs');
const {forwardingOptions}=require('../desktop/network.cjs');

test('YouTube embed forwarding restores the real app origin without leaking query parameters',()=>{
  const request=new Request('https://www.youtube.com/embed/kbNdx0yqbZE',{referrer:APP_URL+'?code=private',headers:{Accept:'text/html'}});
  assert.equal(request.headers.has('referer'),false);
  const options=forwardingOptions(request);
  assert.equal(options.bypassCustomProtocolHandlers,true);
  assert.equal(options.headers.get('referer'),'https://yotamaaikich.github.io/');
  assert.equal(options.headers.get('accept'),'text/html');
  assert.equal(request.headers.has('referer'),false);
});

test('native initiator identifies an app embed, existing Referer is preserved, other origins are untouched',()=>{
  const request=new Request('https://www.youtube.com/embed/kbNdx0yqbZE');
  request.initiatorOrigin=new URL(APP_URL).origin;
  assert.equal(forwardingOptions(request).headers.get('referer'),new URL(APP_URL).origin+'/');
  const existing=new Request(request,{headers:{Referer:'https://www.youtube.com/'}});
  existing.initiatorOrigin=request.initiatorOrigin;
  assert.equal(forwardingOptions(existing).headers.get('referer'),'https://www.youtube.com/');
  for(const destination of ['https://www.youtube.com.evil.invalid/embed/x','https://yowhxryuxsqvjddizrts.supabase.co/auth/v1/settings']){
    assert.deepEqual(forwardingOptions(new Request(destination,{referrer:APP_URL})),{bypassCustomProtocolHandlers:true});
  }
  assert.deepEqual(forwardingOptions(new Request(request.url,{referrer:'https://other.invalid/'})),{bypassCustomProtocolHandlers:true});
});
