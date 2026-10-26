import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createService} from '../cloud/service.mjs';
import {CHART_VERSION,SONGS,makeChart} from '../engine.mjs';
const token='a'.repeat(64),other='b'.repeat(64),hash=async value=>createHash('sha256').update(value).digest('hex');
function fixture(){
  let now=Date.parse('2026-10-25T00:00:00Z');const tables={pulse_keys_runs:[],pulse_keys_charts:[],pulse_keys_scores:[],pulse_keys_chart_scores:[]},calls=[];
  async function db(path,method='GET',body){
    calls.push({path,method,body:structuredClone(body)});
    if(path==='rpc/pulse_keys_publish_chart'){
      const run=tables.pulse_keys_runs.find(r=>r.id===body.p_run&&r.player_hash===body.p_player);assert.ok(run);if(run.used)return run.chart_id;
      const chart={id:randomUUID(),song:run.song,difficulty:run.difficulty,title:run.draft_title,notes:structuredClone(run.draft_notes),creator_name:body.p_name,creator_hash:body.p_player,note_count:run.draft_notes.length,duration_seconds:run.duration_seconds,chart_version:run.chart_version,published_at:new Date(now).toISOString()};tables.pulse_keys_charts.push(chart);run.used=true;run.chart_id=chart.id;return chart.id;
    }
    if(path.startsWith('rpc/'))return true;
    const url=new URL('https://test.invalid/'+path),name=url.pathname.slice(1),rows=tables[name];assert.ok(rows,'unexpected table '+name);
    const matches=row=>[...url.searchParams].every(([key,value])=>{if(['select','limit','order'].includes(key))return true;const dot=value.indexOf('.'),op=value.slice(0,dot),expected=value.slice(dot+1),actual=String(row[key]);return op==='eq'?actual===expected:op==='gt'?actual>expected:op==='lt'?actual<expected:false;});
    if(method==='POST'){const row={id:randomUUID(),created_at:new Date(now).toISOString(),used:false,...structuredClone(body)};rows.push(row);return [structuredClone(row)];}
    if(method==='PATCH'){const found=rows.filter(matches);for(const row of found)Object.assign(row,body);return structuredClone(found);}
    if(method==='DELETE'){tables[name]=rows.filter(row=>!matches(row));return null;}
    const selected=url.searchParams.get('select'),found=rows.filter(matches).slice(0,Number(url.searchParams.get('limit'))||Infinity);
    return found.map(row=>structuredClone(!selected||selected==='*'?row:Object.fromEntries(selected.split(',').map(key=>[key,row[key]]))));
  }
  const service=createService({db,hash,now:()=>now}),call=(path,data)=>service(data?'POST':'GET',new URL('https://test.invalid/'+path),data);
  const start=(extra={})=>call('start',{playerToken:token,song:SONGS[0].id,difficulty:2,version:CHART_VERSION,...extra});
  return {tables,calls,call,start,advance(seconds){now+=seconds*1000;}};
}
const raw=[[2000,0,0],[2500,4,500],[3500,7,0,1]],events=[[2000,0,1],[2025,0,0],[2500,4,1],[3000,4,0],[3500,7,1],[3500,0,4],[3525,7,0],[3580,7,2],[3600,7,3],[3600,0,5]];
test('publication requires a full track and a server-rescored full combo of the immutable draft',async()=>{
  const f=fixture(),draft={title:'MY CHART',notes:structuredClone(raw)},run=await f.start({draft});draft.notes.length=0;
  await assert.rejects(f.call('publish',{playerToken:token,runId:run.runId,name:'PLAYER',events}),/1曲完走/);
  f.advance(SONGS[0].duration);
  await assert.rejects(f.call('publish',{playerToken:token,runId:run.runId,name:'PLAYER',events:events.slice(2)}),/フルコンボ/);
  assert.equal(f.tables.pulse_keys_runs[0].used,false);assert.equal(f.tables.pulse_keys_charts.length,0);
  const result=await f.call('publish',{playerToken:token,runId:run.runId,name:'PLAYER',events,draft:{title:'changed',notes:[]},score:1000000});
  assert.ok(result.chartId);assert.deepEqual(f.tables.pulse_keys_charts[0].notes,raw);assert.equal(f.tables.pulse_keys_charts[0].title,'MY CHART');
  const rpc=f.calls.find(c=>c.path==='rpc/pulse_keys_publish_chart');assert.equal(rpc.body.p_combo,3);assert.equal(rpc.body.p_score,1000000);
  assert.deepEqual(await f.call('publish',{playerToken:token,runId:run.runId,name:'PLAYER',events}),result);assert.equal(f.tables.pulse_keys_charts.length,1);
});
test('BAD heads and broken holds cannot publish, while GOOD can',async()=>{
  const f=fixture(),run=await f.start({draft:{title:'Tap',notes:[[2000,0,0]]}});f.advance(181);
  await assert.rejects(f.call('publish',{playerToken:token,runId:run.runId,name:'P',events:[[2160,0,1],[2180,0,0]]}),/フルコンボ/);
  assert.ok((await f.call('publish',{playerToken:token,runId:run.runId,name:'P',events:[[2120,0,1],[2140,0,0]]})).chartId);
  const hold=await f.start({draft:{title:'Hold',notes:[[2000,0,1000]]}});f.advance(181);await assert.rejects(f.call('publish',{playerToken:token,runId:hold.runId,name:'P',events:[[2000,0,1],[2300,0,0]]}),/フルコンボ/);
});
test('run ownership, version, and replay validation reject forged submissions',async()=>{
  const f=fixture(),run=await f.start({draft:{title:'Tap',notes:[[2000,0,0]]}});f.advance(181);
  await assert.rejects(f.call('publish',{playerToken:other,runId:run.runId,name:'P',events}),/期限切れ/);
  for(const bad of [[[2000,0,7]],[[2000,8,1]],[[2000.5,0,1]],[[2000,0,1],[1000,0,0]],[[182000,0,1]]])await assert.rejects(f.call('publish',{playerToken:token,runId:run.runId,name:'P',events:bad}),/プレイデータ/);
  await assert.rejects(f.start({version:'old'}),/再読み込み/);assert.equal(f.tables.pulse_keys_charts.length,0);
});
test('HARD-only custom flicks and chart difficulty are enforced at the server boundary',async()=>{
  const f=fixture();await assert.rejects(f.start({difficulty:1,draft:{title:'Wrong',notes:raw}}),/HARD/);
  const run=await f.start({draft:{title:'Hard',notes:raw}});f.advance(181);const result=await f.call('publish',{playerToken:token,runId:run.runId,name:'P',events});
  await assert.rejects(f.start({difficulty:1,chartId:result.chartId}),/難易度/);
  const started=await f.start({chartId:result.chartId});assert.ok(started.runId);
  const loaded=await f.call('chart?id='+result.chartId);assert.equal(loaded.chart.difficulty,2);assert.equal(loaded.chart.creator_hash,undefined);assert.deepEqual(loaded.chart.notes,raw);
});
test('published chart rankings use a separate score table and a claimed ticket only once',async()=>{
  const f=fixture(),run=await f.start({draft:{title:'Chart',notes:raw}});f.advance(181);const pub=await f.call('publish',{playerToken:token,runId:run.runId,name:'P',events});
  const play=await f.start({chartId:pub.chartId});f.advance(181);const saved=await f.call('submit',{playerToken:token,runId:play.runId,name:'P',events});assert.equal(saved.score,1000000);
  assert.ok(f.calls.some(c=>c.path==='rpc/pulse_keys_save_chart_best'));assert.ok(!f.calls.some(c=>c.path==='rpc/pulse_keys_save_best'));
  await assert.rejects(f.call('submit',{playerToken:token,runId:play.runId,name:'P',events}),/登録済み/);
  await f.call('leaderboard?chart='+pub.chartId);assert.ok(f.calls.some(c=>c.path.startsWith('pulse_keys_chart_scores?')));
});
test('stock rankings retain the full-song replay path and draft submission cannot bypass publication',async()=>{
  const f=fixture(),run=await f.start({difficulty:1});f.advance(181);const chart=makeChart(SONGS[0],1).filter(n=>!n.assist),replay=chart.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0]]).sort((a,b)=>a[0]-b[0]);
  assert.equal((await f.call('submit',{playerToken:token,runId:run.runId,name:'P',events:replay})).score,1000000);assert.ok(f.calls.some(c=>c.path==='rpc/pulse_keys_save_best'));
  const draft=await f.start({draft:{title:'Chart',notes:raw}});f.advance(181);await assert.rejects(f.call('submit',{playerToken:token,runId:draft.runId,name:'P',events}),/フルコンボしてから公開/);
});
test('expanded songs accept their complete HARD replay including flicks and more than 2000 notes',async()=>{
  const f=fixture(),song=SONGS.find(s=>s.id==='ghost'),run=await f.start({song:song.id,difficulty:2});f.advance(song.duration);
  const chart=makeChart(song,2).filter(n=>!n.assist),events=chart.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0],...(n.flick?[[Math.round(n.t*1000),0,4],[Math.round((n.t+.08)*1000),n.lane,2],[Math.round((n.t+.1)*1000),n.lane,3],[Math.round((n.t+.12)*1000),0,5]]:[])]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
  assert.ok(chart.length>2000);const result=await f.call('submit',{playerToken:token,runId:run.runId,name:'P',events});assert.equal(result.score,1000000);assert.equal(result.maxCombo,chart.length+chart.filter(n=>n.end).reduce((sum,n)=>sum+Math.max(0,Math.ceil((n.end-n.t)/.25-1e-8)-1),0));
});
