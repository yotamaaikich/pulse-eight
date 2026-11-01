import {SUPABASE_URL,PUBLIC_KEY} from './config.js';
export const WEB_REDIRECT='https://yotamaaikich.github.io/pulse-eight/';
export const DESKTOP_REDIRECT='pianopulse://auth/callback';
const AUTH_PARAMS=['code','sb_flow_id','state','session_state','error','error_code','error_description','access_token','refresh_token','provider_token','provider_refresh_token','token_type','expires_in','expires_at'];
export function cleanAuthUrl(raw){
  const url=new URL(raw);for(const key of AUTH_PARAMS)url.searchParams.delete(key);
  const hash=new URLSearchParams(url.hash.slice(1));
  if(AUTH_PARAMS.some(key=>hash.has(key))){for(const key of AUTH_PARAMS)hash.delete(key);url.hash=hash.toString();}
  return url.href;
}
function callbackParams(raw){
  try{const url=new URL(raw),hash=new URLSearchParams(url.hash.slice(1));return {code:url.searchParams.get('code'),error:url.searchParams.get('error')||hash.get('error'),errorCode:url.searchParams.get('error_code')||hash.get('error_code')};}catch{return {};}
}
function loginError(error){
  const code=error?.code??error?.errorCode??'',name=error?.name??'';
  if(code==='access_denied'||error?.error==='access_denied')return 'Googleログインをキャンセルしました。もう一度ログインするか、ゲストで遊べます。';
  if(/pkce|flow_state|bad_code_verifier|otp_expired/.test(code)||/PKCE/.test(name))return 'ログインの確認情報が見つからないか、有効期限が切れています。この画面の「Googleでログイン」からやり直してください。';
  if(/refresh_token|session_not_found/.test(code))return 'ログインの有効期限が切れています。「Googleでログイン」からログインし直してください。';
  if(name==='TimeoutError'||name==='AbortError'||name==='AuthRetryableFetchError'||error instanceof TypeError)return 'ログイン先に接続できませんでした。通信を確認して再度お試しください。ゲストではそのまま遊べます。';
  return 'Googleログインを完了できませんでした。「Googleでログイン」からやり直してください。ゲストでも遊べます。';
}
export function createAccount({bridge,load=()=>import('./vendor/supabase.mjs'),fetcher=fetch,navigate=url=>location.assign(url),getUrl=()=>globalThis.location?.href??WEB_REDIRECT,onChange=()=>{},onError=()=>{},timeoutMs=12000}={}){
  let connection,signInTask,callbacks=Promise.resolve();const seenCodes=new Set();
  const initial=bridge?.desktop?{}:callbackParams(getUrl());
  function within(task){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const error=new Error('認証処理がタイムアウトしました。通信を確認してもう一度お試しください。');error.name='TimeoutError';reject(error);},timeoutMs);Promise.resolve(task).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
  function connect(){
    if(!connection){connection=(async()=>{const {createClient}=await load();const client=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:!bridge?.desktop,storageKey:'piano-pulse-auth'}});
      // Keep this callback synchronous: SDK Auth methods acquire the same lock.
      client.auth.onAuthStateChange((event,value)=>onChange(value?.user??null,event));return client;
    })();connection.catch(()=>{connection=null;});}return connection;
  }
  const ready=within((async()=>{
    const client=await connect();const initialized=await client.auth.initialize?.();
    const {data,error}=await client.auth.getSession();onChange(data?.session?.user??null,'INITIAL_SESSION');
    if(error)onError(loginError(error));
    else if(initial.error)onError(loginError(initial));
    else if(initialized?.error)onError(loginError(initialized.error));
    else if(initial.code&&callbackParams(getUrl()).code)onError(loginError({code:'pkce_verifier_missing'}));
    return client;
  })()).catch(error=>{onError(loginError(error));return null;});
  bridge?.onAuthCallback(value=>{
    // A second callback must not be discarded while an earlier exchange is in flight.
    callbacks=callbacks.then(async()=>{
      await ready;
      if(value?.error){onError(loginError({error:value.error,code:value.errorCode}));return;}
      if(typeof value?.code!=='string'||!value.code||value.code.length>2048){onError(loginError({}));return;}
      const key=(value.flowId??'')+':'+value.code;if(seenCodes.has(key))return;
      seenCodes.add(key);if(seenCodes.size>16)seenCodes.delete(seenCodes.values().next().value);
      const client=await within(connect());
      const {error}=await within(value.flowId?client.auth.exchangeCodeForSession(value.code,{flowId:value.flowId}):client.auth.exchangeCodeForSession(value.code));
      if(error)onError(loginError(error));
    }).catch(error=>onError(loginError(error)));return callbacks;
  });
  async function beginSignIn(){
    await ready;let client;try{client=await within(connect());}catch(error){throw Error(loginError(error));}let configured=false;
    try{const r=await within(fetcher(SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:PUBLIC_KEY},signal:AbortSignal.timeout(8000)}));if(!r.ok)throw Error();configured=(await r.json()).external?.google===true;}catch{throw Error('ログイン先に接続できませんでした。ゲストではそのまま遊べます。');}
    if(!configured)throw Error('Googleログインは設定中です。ゲストではそのまま遊べます。');
    let result;try{result=await within(client.auth.signInWithOAuth({provider:'google',options:{redirectTo:bridge?.desktop?DESKTOP_REDIRECT:WEB_REDIRECT,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}}));}catch(error){throw Error(loginError(error));}
    const {data,error}=result;if(error||!data?.url)throw Error(loginError(error));
    if(bridge?.desktop){try{await within(bridge.beginGoogleSignIn(data.url));}catch{throw Error('ログイン用のブラウザを開けませんでした。もう一度お試しください。');}}else navigate(data.url);
  }
  return {
    ready,
    signIn(){if(!signInTask)signInTask=beginSignIn().finally(()=>{signInTask=null;});return signInTask;},
    async signOut(){try{await ready;const client=await within(connect());const {error}=await within(client.auth.signOut({scope:'local'}));if(error)throw error;}catch{throw Error('ログアウトできませんでした。通信を確認してもう一度お試しください。');}},
    async headers(owner){if(!owner)return {};await ready;const client=await within(connect());const {data,error}=await within(client.auth.getSession());if(error||data?.session?.user?.id!==owner||!data.session.access_token)throw Error('このプレイを始めたGoogleアカウントでログインし直してください。');return {Authorization:'Bearer '+data.session.access_token};}
  };
}
