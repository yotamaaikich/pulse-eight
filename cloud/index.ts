import {SONGS,CHART_VERSION,makeChart,scoreReplay} from './engine.mjs';

const URL=Deno.env.get('SUPABASE_URL')!;
const legacyService=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const serverKey=secretKeys.default||legacyService;
const clientKey='sb_publishable_PmWdgB9fyBl7L9IkyOzxRA_lcYBJdvP';
const headers={apikey:serverKey,...(serverKey.startsWith('eyJ')?{Authorization:`Bearer ${serverKey}`}:{})};
const allowedOrigin='https://yotamaaikich.github.io';
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
class ApiError extends Error{constructor(message:string,public status=400){super(message);}}
async function db(path:string,method='GET',body?:unknown,prefer?:string){const r=await fetch(URL+'/rest/v1/'+path,{method,headers:{...headers,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!r.ok){console.error('Database request failed:',r.status,path.split('?')[0]);throw new ApiError('保存先に接続できませんでした。',503);}return r.status===204?null:await r.json();}
function selection(songId:unknown,difficulty:unknown){const song=SONGS.find(s=>s.id===songId);if(!song||!Number.isInteger(difficulty)||Number(difficulty)<0||Number(difficulty)>2)throw new ApiError('曲または難易度が正しくありません。');return song;}
function checkToken(token:unknown){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new ApiError('プレイヤー情報が正しくありません。',401);return token;}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('Origin')||'';
  const local=/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const cors={'Access-Control-Allow-Origin':origin===allowedOrigin||local?origin:allowedOrigin,'Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
    if(origin&&origin!==allowedOrigin&&!local)throw new ApiError('このサイトからは利用できません。',403);
    // This public application key identifies the client. A private per-device token
    // proves run ownership; no database credential or raw player token is returned.
    if(req.headers.get('apikey')!==clientKey)throw new ApiError('アプリ情報を確認できませんでした。',401);
    const url=new globalThis.URL(req.url),path=url.pathname.split('/').pop();
    if(req.method==='GET'&&path==='leaderboard'){
      const difficulty=Number(url.searchParams.get('difficulty'));const song=selection(url.searchParams.get('song'),difficulty);
      const scores=await db(`pulse_keys_scores?select=name,score,accuracy,max_combo,updated_at&song=eq.${song.id}&difficulty=eq.${difficulty}&chart_version=eq.${CHART_VERSION}&order=score.desc,accuracy.desc,updated_at.asc&limit=10`);
      return reply({scores});
    }
    if(req.method!=='POST')throw new ApiError('対応していない操作です。',405);
    const text=await req.text();if(text.length>120000)throw new ApiError('プレイデータが大きすぎます。',413);
    let data;try{data=JSON.parse(text);}catch{throw new ApiError('データを読み取れませんでした。');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('データが正しくありません。');
    const playerHash=await hash(checkToken(data.playerToken));
    if(path==='start'){
      const song=selection(data.song,data.difficulty);
      if(data.version!==CHART_VERSION)throw new ApiError('ページを再読み込みしてください。',409);
      const cutoff=new Date(Date.now()-120000).toISOString();
      const recent=await db(`pulse_keys_runs?select=id&player_hash=eq.${playerHash}&created_at=gt.${cutoff}&limit=8`);
      if(recent.length>=8)throw new ApiError('リトライが続いています。少し待ってから再開してください。',429);
      const run=await db('pulse_keys_runs','POST',{player_hash:playerHash,song:song.id,difficulty:data.difficulty,chart_version:CHART_VERSION},'return=representation');
      // Expired run tickets contain no scores and are removed on the next start.
      await db(`pulse_keys_runs?created_at=lt.${new Date(Date.now()-86400000).toISOString()}`,'DELETE');
      return reply({runId:run[0].id});
    }
    if(path==='submit'){
      if(typeof data.runId!=='string'||!/^[a-f0-9-]{36}$/.test(data.runId))throw new ApiError('プレイ情報が見つかりません。');
      const runs=await db(`pulse_keys_runs?select=*&id=eq.${data.runId}&player_hash=eq.${playerHash}&used=eq.false&limit=1`);
      const run=runs[0];if(!run||run.chart_version!==CHART_VERSION)throw new ApiError('このプレイは登録済み、または期限切れです。',409);
      const song=selection(run.song,run.difficulty);
      const elapsed=(Date.now()-Date.parse(run.created_at))/1000;
      if(elapsed<song.duration-2||elapsed>1800)throw new ApiError('1曲完走したプレイだけを登録できます。',422);
      if(typeof data.name!=='string'||!data.name.trim()||[...data.name].length>16||/[\u0000-\u001f\u007f]/.test(data.name))throw new ApiError('名前を1〜16文字で入力してください。');
      const chart=makeChart(song,run.difficulty).filter(n=>!n.assist);
      if(!Array.isArray(data.events)||data.events.length>chart.length*10)throw new ApiError('プレイデータが正しくありません。');
      let prev=-1;
      for(const e of data.events){if(!Array.isArray(e)||e.length!==3||!Number.isInteger(e[0])||!Number.isInteger(e[1])||!Number.isInteger(e[2])||![0,1].includes(e[2])||e[0]<prev||e[0]<0||e[0]>song.duration*1000+200||e[1]<0||e[1]>7)throw new ApiError('プレイデータが正しくありません。');prev=e[0];}
      const result=scoreReplay(song,run.difficulty,data.events);
      // Claim once atomically. Concurrent retries cannot submit the same ticket twice.
      const claimed=await db(`pulse_keys_runs?id=eq.${run.id}&player_hash=eq.${playerHash}&used=eq.false`,'PATCH',{used:true},'return=representation');
      if(!claimed.length)throw new ApiError('このプレイはすでに登録されています。',409);
      try{
        const improved=await db('rpc/pulse_keys_save_best','POST',{p_player:playerHash,p_song:song.id,p_difficulty:run.difficulty,p_version:CHART_VERSION,p_name:data.name.trim(),p_score:result.score,p_accuracy:result.accuracy,p_combo:result.maxCombo});
        return reply({improved,score:result.score,accuracy:result.accuracy,maxCombo:result.maxCombo});
      }catch(error){await db(`pulse_keys_runs?id=eq.${run.id}`,'PATCH',{used:false});throw error;}
    }
    throw new ApiError('見つかりません。',404);
  }catch(error){if(error instanceof ApiError)return reply({error:error.message},error.status);console.error('Score API error',error instanceof Error?error.name:'unknown');return reply({error:'通信に失敗しました。時間を置いてお試しください。'},500);}
});
