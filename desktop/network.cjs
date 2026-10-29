const {APP_URL}=require('./security.cjs');
const appOrigin=new URL(APP_URL).origin;

function forwardingOptions(request){
  const options={bypassCustomProtocolHandlers:true};
  const destination=new URL(request.url);
  // Electron's protocol Request carries referrer separately, but ses.fetch
  // forwards headers only. Restore our app identity for its YouTube embeds.
  // Never send page paths, query strings, or an invented third-party identity.
  if(destination.origin!=='https://www.youtube.com')return options;
  let referrerOrigin;try{referrerOrigin=new URL(request.referrer).origin;}catch{}
  if(request.initiatorOrigin!==appOrigin&&referrerOrigin!==appOrigin)return options;
  const headers=new Headers(request.headers);
  if(!headers.has('referer'))headers.set('Referer',appOrigin+'/');
  return {...options,headers};
}

module.exports={forwardingOptions};
