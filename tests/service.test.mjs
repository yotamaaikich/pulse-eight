import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createService} from '../cloud/service.mjs';
import {CHART_VERSION,SONGS,makeChart} from '../engine.mjs';
const token='a'.repeat(64),other='b'.repeat(64),hash=async value=>createHash('sha256').update(value).digest('hex');
function fixture(){
  let dbFailure=false;let now=Date.parse('2026-10-25T00:00:00Z');const tables={pulse_keys_runs:[],pulse_keys_scores:[]},calls=[];
  async function db(path,method='GET',body){
    calls.push({path,method,body:structuredClone(body)});
    if(path.startsWith('rpc/')){if(dbFailure)throw Error('storage failure');return true;}
    const url=new URL('https://test.invalid/'+path),name=url.pathname.slice(1),rows=tables[name];assert.ok(rows,'unexpected table '+name);
    const matches=row=>[...url.searchParams].every(([key,value])=>{if(['select','limit','order'].includes(key))return true;const dot=value.indexOf('.'),op=value.slice(0,dot),expected=value.slice(dot+1),actual=String(row[key]);return op==='eq'?actual===expected:op==='gt'?actual>expected:op==='lt'?actual<expected:false;});
    if(method==='POST'){const row={id:randomUUID(),created_at:new Date(now).toISOString(),used:false,...structuredClone(body)};rows.push(row);return [structuredClone(row)];}
    if(method==='PATCH'){const found=rows.filter(matches);for(const row of found)Object.assign(row,body);return structuredClone(found);}
    if(method==='DELETE'){tables[name]=rows.filter(row=>!matches(row));return null;}
    const selected=url.searchParams.get('select'),found=rows.filter(matches).slice(0,Number(url.searchParams.get('limit'))||Infinity);
    return found.map(row=>structuredClone(!selected||selected==='*'?row:Object.fromEntries(selected.split(',').map(key=>[key,row[key]]))));
  }
  const service=createService({db,hash,now:()=>now}),call=(path,data,actor=null)=>service(data?'POST':'GET',new URL('https://test.invalid/'+path),data,actor);
  const start=(extra={})=>call('start',{playerToken:token,song:SONGS[0].id,difficulty:2,version:CHART_VERSION,...extra});
  return {tables,calls,call,start,failRpc(){dbFailure=true;},advance(seconds){now+=seconds*1000;}};
}
function replay(song,difficulty){return makeChart(song,difficulty).filter(n=>!n.assist).flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0],...(n.flick?[[Math.round(n.t*1000),0,4],[Math.round((n.t+.08)*1000),n.lane,2],[Math.round((n.t+.1)*1000),n.lane,3],[Math.round((n.t+.12)*1000),0,5]]:[])]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);}
test('complete stock replay is rescored, saved once, and unfinished runs are rejected',async()=>{
  const f=fixture(),run=await f.start({difficulty:1}),body={runId:run.runId,playerToken:token,name:'P',events:replay(SONGS[0],1)};
  await assert.rejects(f.call('submit',body),/1曲完走/);f.advance(181);
  const result=await f.call('submit',body);assert.equal(result.score,1000000);assert.equal(result.accuracy,100);
  assert.ok(f.calls.some(c=>c.path==='rpc/pulse_keys_save_best'));await assert.rejects(f.call('submit',body),/登録済み/);
});
test('account ownership is verified actor identity, shared across devices and separate from guest',async()=>{
  const f=fixture(),actor={id:randomUUID()},run=await f.call('start',{song:SONGS[0].id,difficulty:1,version:CHART_VERSION,playerToken:token},actor);f.advance(181);
  const body={runId:run.runId,playerToken:other,name:'P',events:replay(SONGS[0],1)};
  await assert.rejects(f.call('submit',body),/期限切れ/);await assert.rejects(f.call('submit',body,{id:randomUUID()}),/期限切れ/);
  assert.equal((await f.call('submit',body,actor)).score,1000000);
  assert.equal(f.tables.pulse_keys_runs[0].player_hash,await hash('account:'+actor.id));
  f.tables.pulse_keys_scores.push({player_hash:await hash('account:'+actor.id),song:'monitoring',difficulty:1,chart_version:CHART_VERSION,name:'P',score:1000000});
  const profile=await f.call('profile',{},actor);assert.equal(profile.scores.length,1);assert.equal(profile.scores[0].player_hash,undefined);
  await assert.rejects(f.call('profile',{playerToken:token}),/Google/);
});
test('retired routes and old custom tickets cannot write stock rankings',async()=>{
  const f=fixture();await assert.rejects(f.start({draft:{}}),e=>e.status===410);await assert.rejects(f.start({chartId:randomUUID()}),e=>e.status===410);
  for(const path of ['publish','chart','community'])await assert.rejects(f.call(path,{playerToken:token}),e=>e.status===404);
  const run=await f.start();f.tables.pulse_keys_runs[0].draft_notes=[[2000,0,0]];f.advance(181);
  await assert.rejects(f.call('submit',{playerToken:token,runId:run.runId,name:'P',events:[]}),e=>e.status===410);
});
test('bad versions, replay actions, owners and repeated starts are rejected',async()=>{
  const f=fixture();await assert.rejects(f.start({version:'old'}),e=>e.status===409);await assert.rejects(f.start({playerToken:'bad'}),e=>e.status===401);
  const run=await f.start({difficulty:1});f.advance(181);
  for(const events of [[[2000,0,7]],[[2000,8,1]],[[2000.5,0,1]],[[2000,0,1],[1000,0,0]],[[182000,0,1]],[[2000,0,4]]])await assert.rejects(f.call('submit',{playerToken:token,runId:run.runId,name:'P',events}),/プレイデータ/);
  await assert.rejects(f.call('submit',{playerToken:other,runId:run.runId,name:'P',events:[]}),/期限切れ/);
  const rate=fixture();for(let i=0;i<8;i++)await rate.start();await assert.rejects(rate.start(),e=>e.status===429);
});
test('failed storage releases claimed ticket and leaderboard exposes only public score fields',async()=>{
  const f=fixture(),run=await f.start();f.advance(181);f.failRpc();await assert.rejects(f.call('submit',{playerToken:token,runId:run.runId,name:'P',events:[]}),/storage/);assert.equal(f.tables.pulse_keys_runs[0].used,false);
  await f.call('leaderboard?song=monitoring&difficulty=2');const query=f.calls.at(-1).path;assert.ok(query.includes('select=name,score,accuracy,max_combo,updated_at'));assert.ok(query.includes('chart_version=eq.'+CHART_VERSION));
});
test('long full-song HARD replay with FLOAT still reaches a million points',async()=>{
  const f=fixture(),song=SONGS.find(s=>s.id==='ghost'),run=await f.start({song:song.id,difficulty:2});f.advance(song.duration);
  const result=await f.call('submit',{playerToken:token,runId:run.runId,name:'P',events:replay(song,2)});assert.equal(result.score,1000000);assert.ok(result.maxCombo>2000);
});
