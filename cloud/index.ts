import {createService,ApiError} from './service.mjs';
const baseUrl=Deno.env.get('SUPABASE_URL')!;
const legacyService=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const serverKey=secretKeys.default||legacyService;
const clientKey='sb_publishable_PmWdgB9fyBl7L9IkyOzxRA_lcYBJdvP';
const headers={apikey:serverKey,...(serverKey.startsWith('eyJ')?{Authorization:'Bearer '+serverKey}:{})};
const allowedOrigin='https://yotamaaikich.github.io';
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
async function db(path:string,method='GET',body?:unknown,prefer?:string){
  const response=await fetch(baseUrl+'/rest/v1/'+path,{method,headers:{...headers,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok){console.error('Database request failed:',response.status,path.split('?')[0]);throw new ApiError('保存先に接続できませんでした。',503);}
  return response.status===204?null:await response.json();
}
const route=createService({db,hash});
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('Origin')||'',local=/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const cors={'Access-Control-Allow-Origin':origin===allowedOrigin||local?origin:allowedOrigin,'Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
    if(origin&&origin!==allowedOrigin&&!local)throw new ApiError('このサイトからは利用できません。',403);
    if(req.headers.get('apikey')!==clientKey)throw new ApiError('アプリ情報を確認できませんでした。',401);
    let data={};
    if(req.method==='POST'){const raw=await req.text();if(raw.length>512000)throw new ApiError('プレイデータが大きすぎます。',413);try{data=JSON.parse(raw);}catch{throw new ApiError('データを読み取れませんでした。');}if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('データが正しくありません。');}
    return reply(await route(req.method,new URL(req.url),data));
  }catch(error){if(error instanceof ApiError)return reply({error:error.message},error.status);console.error('Score API error',error instanceof Error?error.name:'unknown');return reply({error:'通信に失敗しました。時間を置いてお試しください。'},500);}
});
