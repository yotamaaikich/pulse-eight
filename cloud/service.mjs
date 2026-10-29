import {SONGS,CHART_VERSION,makeChart,scoreChartReplay} from '../engine.mjs';
export class ApiError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function text(value,max,label){if(typeof value!=='string'||!value.trim()||[...value.trim()].length>max||/[\u0000-\u001f\u007f]/.test(value))throw new ApiError(label+'を1〜'+max+'文字で入力してください。');return value.trim();}
function songById(id){const song=SONGS.find(s=>s.id===id);if(!song)throw new ApiError('曲が見つかりません。');return song;}
function tokenOf(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new ApiError('プレイヤー情報が正しくありません。',401);return value;}
export function createService({db,hash,now=Date.now}){
  return async function route(method,url,data={},actor=null){
    const path=url.pathname.split('/').pop();
    if(method==='GET'){
      if(path!=='leaderboard')throw new ApiError('見つかりません。',404);
      const song=songById(url.searchParams.get('song')),difficulty=Number(url.searchParams.get('difficulty'));
      if(!Number.isInteger(difficulty)||difficulty<0||difficulty>2)throw new ApiError('難易度が正しくありません。');
      return {scores:await db(`pulse_keys_scores?select=name,score,accuracy,max_combo,updated_at&song=eq.${song.id}&difficulty=eq.${difficulty}&chart_version=eq.${CHART_VERSION}&order=score.desc,accuracy.desc,updated_at.asc&limit=10`)};
    }
    if(method!=='POST')throw new ApiError('対応していない操作です。',405);
    if(!['start','submit','profile'].includes(path))throw new ApiError('見つかりません。',404);
    const playerHash=await hash(actor?.id?'account:'+actor.id:tokenOf(data.playerToken));
    if(path==='profile'){
      if(!actor?.id)throw new ApiError('Googleログインが必要です。',401);
      return {scores:await db(`pulse_keys_scores?select=song,difficulty,chart_version,name,score,accuracy,max_combo,updated_at&player_hash=eq.${playerHash}&chart_version=eq.${CHART_VERSION}&limit=105`)};
    }
    if(path==='start'){
      const song=songById(data.song),difficulty=data.difficulty;
      if(!Number.isInteger(difficulty)||difficulty<0||difficulty>2)throw new ApiError('難易度が正しくありません。');
      if(data.version!==CHART_VERSION)throw new ApiError('ページを再読み込みしてください。',409);
      if(data.chartId!==undefined||data.draft!==undefined)throw new ApiError('このプレイ形式は利用できません。',410);
      const cutoff=new Date(now()-120000).toISOString();
      if((await db(`pulse_keys_runs?select=id&player_hash=eq.${playerHash}&created_at=gt.${cutoff}&limit=8`)).length>=8)throw new ApiError('リトライが続いています。少し待ってから再開してください。',429);
      const rows=await db('pulse_keys_runs','POST',{player_hash:playerHash,song:song.id,difficulty,chart_version:CHART_VERSION,duration_seconds:song.duration},'return=representation');
      await db(`pulse_keys_runs?created_at=lt.${new Date(now()-86400000).toISOString()}`,'DELETE');
      return {runId:rows[0].id};
    }
    if(!uuid(data.runId))throw new ApiError('プレイ情報が見つかりません。');
    const runs=await db(`pulse_keys_runs?select=*&id=eq.${data.runId}&player_hash=eq.${playerHash}&limit=1`),run=runs[0];
    if(!run||run.chart_version!==CHART_VERSION)throw new ApiError('このプレイは期限切れです。',409);
    // Never reinterpret a legacy non-stock ticket as a stock leaderboard run.
    if(run.draft_notes||run.chart_id)throw new ApiError('このプレイ形式は利用できません。',410);
    if(run.used)throw new ApiError('このプレイは登録済みです。',409);
    const song=songById(run.song),elapsed=(now()-Date.parse(run.created_at))/1000;
    if(!Number.isFinite(elapsed)||elapsed<song.duration-2||elapsed>1800)throw new ApiError('1曲完走したプレイだけを登録できます。',422);
    const name=text(data.name,16,'名前'),chart=makeChart(song,run.difficulty),count=chart.filter(n=>!n.assist).length;
    if(!Array.isArray(data.events)||data.events.length>count*14)throw new ApiError('プレイデータが正しくありません。');
    let previous=-1;
    for(const event of data.events){if(!Array.isArray(event)||event.length!==3||!event.every(Number.isInteger)||event[0]<previous||event[0]<0||event[0]>song.duration*1000+200||event[1]<0||event[1]>7||(event[2]>=4&&event[1]!==0)||![0,1,2,3,4,5].includes(event[2])||(run.difficulty!==2&&event[2]>1))throw new ApiError('プレイデータが正しくありません。');previous=event[0];}
    const result=scoreChartReplay(chart,song.duration,data.events);
    const claimed=await db(`pulse_keys_runs?id=eq.${run.id}&player_hash=eq.${playerHash}&used=eq.false`,'PATCH',{used:true},'return=representation');
    if(!claimed.length)throw new ApiError('このプレイはすでに登録されています。',409);
    try{
      const improved=await db('rpc/pulse_keys_save_best','POST',{p_player:playerHash,p_song:song.id,p_difficulty:run.difficulty,p_version:CHART_VERSION,p_name:name,p_score:result.score,p_accuracy:result.accuracy,p_combo:result.maxCombo});
      return {improved,score:result.score,accuracy:result.accuracy,maxCombo:result.maxCombo};
    }catch(error){await db(`pulse_keys_runs?id=eq.${run.id}`,'PATCH',{used:false});throw error;}
  };
}
