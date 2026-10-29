const path=require('node:path');
const APP_URL='https://yotamaaikich.github.io/pulse-eight/';
const AUTH_ORIGIN='https://yowhxryuxsqvjddizrts.supabase.co';
const trustedGame=url=>{try{const u=new URL(url);return u.origin==='https://yotamaaikich.github.io'&&u.pathname==='/pulse-eight/';}catch{return false;}};
function bundledPath(raw,root){
  const u=new URL(raw);if(u.origin!=='https://yotamaaikich.github.io'||!u.pathname.startsWith('/pulse-eight/'))return null;
  let relative;try{relative=decodeURIComponent(u.pathname.slice('/pulse-eight/'.length))||'index.html';}catch{return false;}
  if(relative.includes('\\')||relative.includes('\0')||relative.split('/').some(p=>p==='..')||relative.startsWith('.'))return false;
  if(!(relative==='index.html'||relative==='privacy.html'||relative==='icon.svg'||/^[\w-]+\.(m?js|css)$/.test(relative)||/^audio\/piano\/[\w.-]+\.(mp3|txt)$/.test(relative)||/^vendor\/[\w.-]+\.mjs$/.test(relative)||/^desktop\/(settings\.(html|css|js)|assets\/icon\.(png|ico))$/.test(relative)))return false;
  const file=path.resolve(root,relative),inside=path.relative(root,file);return inside&&!inside.startsWith('..')&&!path.isAbsolute(inside)?file:false;
}
function externalURL(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&['github.com','yotamaaikich.github.io','www.youtube.com','youtube.com','discord.com','www.hanshin.co.jp','osu.ppy.sh','www.ymm.co.jp','store.piascore.com','www.gcmstyle.com','pjsekai.sega.jp','www.billboard-japan.com','www.deco27.com','musicalnexus.net'].includes(u.hostname)?u.href:null;}catch{return null;}}
function oauthURL(raw){try{const u=new URL(raw);return u.origin===AUTH_ORIGIN&&u.pathname==='/auth/v1/authorize'&&u.searchParams.get('provider')==='google'&&u.searchParams.get('redirect_to')==='pianopulse://auth/callback'?u.href:null;}catch{return null;}}
function authCallback(raw){try{const u=new URL(raw);if(u.protocol!=='pianopulse:'||u.hostname!=='auth'||u.pathname!=='/callback')return null;const code=u.searchParams.get('code'),error=u.searchParams.get('error');if(code&&code.length<=2048)return {code};if(error)return {error:'Googleログインがキャンセルされたか、完了しませんでした。'};return null;}catch{return null;}}
module.exports={APP_URL,AUTH_ORIGIN,trustedGame,bundledPath,externalURL,oauthURL,authCallback};
