import {SUPABASE_URL,PUBLIC_KEY} from './config.js';
export const WEB_REDIRECT='https://yotamaaikich.github.io/pulse-eight/';
export const DESKTOP_REDIRECT='pianopulse://auth/callback';
export function createAccount({bridge,load=()=>import('./vendor/supabase.mjs'),fetcher=fetch,navigate=url=>location.assign(url),onChange=()=>{},onError=()=>{}}={}){
  let client,session=null,callbackBusy=false;
  const ready=(async()=>{const {createClient}=await load();client=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:!bridge?.desktop,storageKey:'piano-pulse-auth'}});
    client.auth.onAuthStateChange((_event,value)=>{session=value;onChange(value?.user??null);});
    const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;onChange(session?.user??null);
    return client;
  })();
  ready.catch(()=>onError('Googleログインの準備に失敗しました。ゲストでプレイできます。'));
  bridge?.onAuthCallback(async value=>{if(callbackBusy)return;callbackBusy=true;try{await ready;if(value.error)throw Error(value.error);const {error}=await client.auth.exchangeCodeForSession(value.code);if(error)throw error;}catch{onError('ログインを完了できませんでした。もう一度お試しください。');}finally{callbackBusy=false;}});
  return {
    ready,
    async signIn(){await ready;let configured=false;try{const r=await fetcher(SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:PUBLIC_KEY},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();configured=(await r.json()).external?.google===true;}catch{throw Error('ログイン先に接続できませんでした。ゲストではそのまま遊べます。');}if(!configured)throw Error('Googleログインは設定中です。ゲストではそのまま遊べます。');const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:bridge?.desktop?DESKTOP_REDIRECT:WEB_REDIRECT,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});if(error||!data.url)throw Error('Googleログインを開始できませんでした。');if(bridge?.desktop)await bridge.beginGoogleSignIn(data.url);else navigate(data.url);},
    async signOut(){await ready;const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error('ログアウトできませんでした。');},
    async headers(owner){if(!owner)return {};await ready;const {data,error}=await client.auth.getSession();if(error||data.session?.user?.id!==owner||!data.session.access_token)throw Error('このプレイを始めたGoogleアカウントでログインし直してください。');return {Authorization:'Bearer '+data.session.access_token};}
  };
}
