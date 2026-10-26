import {SONGS,CHART_VERSION,makeChart,customChart,validateCustomNotes,scoreChartReplay,isFullCombo} from '../engine.mjs';
export class ApiError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const fields='id,title,song,difficulty,creator_name,note_count,duration_seconds,published_at';
function text(value,max,label){if(typeof value!=='string'||!value.trim()||[...value.trim()].length>max||/[\u0000-\u001f\u007f]/.test(value))throw new ApiError(label+'を1〜'+max+'文字で入力してください。');return value.trim();}
function songById(id){const song=SONGS.find(s=>s.id===id);if(!song)throw new ApiError('曲が見つかりません。');return song;}
function tokenOf(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new ApiError('プレイヤー情報が正しくありません。',401);return value;}
function notesOf(song,notes,difficulty){try{return validateCustomNotes(song,notes,difficulty);}catch(error){throw new ApiError(error.message);}}
export function createService({db,hash,now=Date.now}){
  async function published(id,withNotes=false){
    if(!uuid(id))throw new ApiError('譜面が見つかりません。',404);
    const rows=await db(`pulse_keys_charts?select=${fields}${withNotes?',notes':''}&id=eq.${id}&chart_version=eq.${CHART_VERSION}&limit=1`);
    if(!rows[0])throw new ApiError('譜面が見つかりません。',404);return rows[0];
  }
  return async function route(method,url,data={}){
    const path=url.pathname.split('/').pop();
    if(method==='GET'){
      if(path==='charts'){const song=songById(url.searchParams.get('song'));return {charts:await db(`pulse_keys_charts?select=${fields}&song=eq.${song.id}&chart_version=eq.${CHART_VERSION}&order=published_at.desc&limit=50`)};}
      if(path==='chart')return {chart:await published(url.searchParams.get('id'),true)};
      if(path==='leaderboard'){
        const chartId=url.searchParams.get('chart');
        if(chartId){const chart=await published(chartId);return {scores:await db(`pulse_keys_chart_scores?select=name,score,accuracy,max_combo,updated_at&chart_id=eq.${chart.id}&order=score.desc,accuracy.desc,updated_at.asc&limit=10`)};}
        const song=songById(url.searchParams.get('song')),difficulty=Number(url.searchParams.get('difficulty'));
        if(!Number.isInteger(difficulty)||difficulty<0||difficulty>2)throw new ApiError('難易度が正しくありません。');
        return {scores:await db(`pulse_keys_scores?select=name,score,accuracy,max_combo,updated_at&song=eq.${song.id}&difficulty=eq.${difficulty}&chart_version=eq.${CHART_VERSION}&order=score.desc,accuracy.desc,updated_at.asc&limit=10`)};
      }
      throw new ApiError('見つかりません。',404);
    }
    if(method!=='POST')throw new ApiError('対応していない操作です。',405);
    const playerHash=await hash(tokenOf(data.playerToken));
    if(path==='start'){
      const song=songById(data.song),difficulty=data.difficulty;
      if(!Number.isInteger(difficulty)||difficulty<0||difficulty>2)throw new ApiError('難易度が正しくありません。');
      if(data.version!==CHART_VERSION)throw new ApiError('ページを再読み込みしてください。',409);
      if(data.chartId&&data.draft)throw new ApiError('譜面の指定が重複しています。');
      let extra={};
      if(data.chartId){const chart=await published(data.chartId,true);if(chart.song!==song.id||chart.difficulty!==difficulty)throw new ApiError('曲・難易度と譜面が一致しません。');notesOf(song,chart.notes,difficulty);extra={chart_id:chart.id};}
      if(data.draft){const title=text(data.draft.title,32,'譜面名'),notes=notesOf(song,data.draft.notes,difficulty);extra={draft_title:title,draft_notes:notes,draft_hash:await hash(CHART_VERSION+':'+song.id+':'+difficulty+':'+JSON.stringify(notes))};}
      const cutoff=new Date(now()-120000).toISOString();
      if((await db(`pulse_keys_runs?select=id&player_hash=eq.${playerHash}&created_at=gt.${cutoff}&limit=8`)).length>=8)throw new ApiError('リトライが続いています。少し待ってから再開してください。',429);
      const rows=await db('pulse_keys_runs','POST',{player_hash:playerHash,song:song.id,difficulty,chart_version:CHART_VERSION,duration_seconds:song.duration,...extra},'return=representation');
      await db(`pulse_keys_runs?created_at=lt.${new Date(now()-86400000).toISOString()}`,'DELETE');
      return {runId:rows[0].id};
    }
    if(!['submit','publish'].includes(path))throw new ApiError('見つかりません。',404);
    if(!uuid(data.runId))throw new ApiError('プレイ情報が見つかりません。');
    const runs=await db(`pulse_keys_runs?select=*&id=eq.${data.runId}&player_hash=eq.${playerHash}&limit=1`),run=runs[0];
    if(!run||run.chart_version!==CHART_VERSION)throw new ApiError('このプレイは期限切れです。',409);
    if(path==='publish'&&run.used&&run.draft_notes&&run.chart_id)return {chartId:run.chart_id,published:true};
    if(run.used)throw new ApiError('このプレイは登録済みです。',409);
    const song=songById(run.song),elapsed=(now()-Date.parse(run.created_at))/1000;
    if(elapsed<song.duration-2||elapsed>1800)throw new ApiError('1曲完走したプレイだけを登録できます。',422);
    const name=text(data.name,16,'名前');
    let chart;
    if(run.draft_notes)chart=customChart(song,run.draft_notes,run.difficulty);
    else if(run.chart_id){const saved=await published(run.chart_id,true);if(saved.song!==song.id||saved.difficulty!==run.difficulty)throw new ApiError('曲・難易度と譜面が一致しません。');chart=customChart(song,saved.notes,run.difficulty);}
    else chart=makeChart(song,run.difficulty);
    const count=chart.filter(n=>!n.assist).length;
    if(!Array.isArray(data.events)||data.events.length>count*14)throw new ApiError('プレイデータが正しくありません。');
    let previous=-1;
    for(const event of data.events){if(!Array.isArray(event)||event.length!==3||!event.every(Number.isInteger)||event[0]<previous||event[0]<0||event[0]>song.duration*1000+200||event[1]<0||event[1]>7||(event[2]>=4&&event[1]!==0)||![0,1,2,3,4,5].includes(event[2])||(run.difficulty!==2&&event[2]>1))throw new ApiError('プレイデータが正しくありません。');previous=event[0];}
    const result=scoreChartReplay(chart,song.duration,data.events);
    if(path==='publish'){
      if(!run.draft_notes||run.chart_id)throw new ApiError('下書きのテストプレイから公開してください。');
      if(!isFullCombo(result.stats,count))throw new ApiError('公開には全ノーツ成功（フルコンボ）が必要です。',422);
      // The archived publication RPC expects the physical note count, not hold tick combo.
      const chartId=await db('rpc/pulse_keys_publish_chart','POST',{p_run:run.id,p_player:playerHash,p_name:name,p_score:result.score,p_accuracy:result.accuracy,p_combo:count});
      return {chartId,published:true};
    }
    if(run.draft_notes)throw new ApiError('下書きはフルコンボしてから公開してください。');
    const claimed=await db(`pulse_keys_runs?id=eq.${run.id}&player_hash=eq.${playerHash}&used=eq.false`,'PATCH',{used:true},'return=representation');
    if(!claimed.length)throw new ApiError('このプレイはすでに登録されています。',409);
    try{
      const improved=run.chart_id?
        await db('rpc/pulse_keys_save_chart_best','POST',{p_player:playerHash,p_chart:run.chart_id,p_name:name,p_score:result.score,p_accuracy:result.accuracy,p_combo:result.maxCombo}):
        await db('rpc/pulse_keys_save_best','POST',{p_player:playerHash,p_song:song.id,p_difficulty:run.difficulty,p_version:CHART_VERSION,p_name:name,p_score:result.score,p_accuracy:result.accuracy,p_combo:result.maxCombo});
      return {improved,score:result.score,accuracy:result.accuracy,maxCombo:result.maxCombo};
    }catch(error){await db(`pulse_keys_runs?id=eq.${run.id}`,'PATCH',{used:false});throw error;}
  };
}
