import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SONGS,makeChart,scoreReplay,judgment,newStats,addResult,summary,RhythmSession,customChart,validateCustomNotes,isFullCombo,scoreChartReplay} from '../engine.mjs';
function perfectEvents(notes){return notes.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0],...(n.flick?[[Math.round((n.t+.08)*1000),n.lane,2],[Math.round((n.t+.1)*1000),n.lane,3]]:[])]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);}
test('all tracks and difficulties support perfect and empty replays',()=>{
  assert.equal(SONGS.length,35);
  for(const song of SONGS)for(let diff=0;diff<3;diff++){
    const chart=makeChart(song,diff),manual=chart.filter(n=>!n.assist);
    assert.ok(manual.length<=4096,`${song.id}/${diff}: standard leaderboard limit`);
    assert.ok(manual.length>=30,`${song.id}/${diff}: chart too sparse`);
    for(let i=0;i<chart.length;i++){assert.ok(chart[i].t>0&&chart[i].t<song.duration);if(i)assert.ok(chart[i].t>=chart[i-1].t);}
    for(const n of manual)assert.ok(n.lane>=0&&n.lane<8);assert.ok(manual.some(n=>n.t>song.duration-4),song.id+' full length');
    const result=scoreReplay(song,diff,perfectEvents(manual));
    assert.equal(result.score,1000000,`${song.id}/${diff}`);assert.equal(result.stats.miss,0);assert.equal(result.maxCombo,manual.length);
    assert.equal(scoreReplay(song,diff,[]).score,0);
  }
});
test('the expanded library has five Madoka and five osu selections with varied phrase rhythms',()=>{
  assert.equal(SONGS.filter(s=>s.pack==='vocaloid').length,20);
  for(const pack of ['madoka','osu']){const songs=SONGS.filter(s=>s.pack===pack);assert.equal(songs.length,5);for(const song of songs){
    assert.ok(song.duration>=240&&song.duration<=600);assert.match(song.video,/^[A-Za-z0-9_-]{11}$/);assert.ok(song.source.startsWith('https://'));
    const chart=makeChart(song,1),times=[...new Set(chart.map(n=>n.t))],gaps=new Set(times.slice(1).map((t,i)=>Math.round((t-times[i])*1000)));assert.ok(gaps.size>=3,song.id+' rhythm variation');
  }}
  assert.equal(SONGS.find(s=>s.id==='silvergarden').meter,3);
});
test('judgment boundaries and combo resets',()=>{
  assert.equal(judgment(.045),'perfect');assert.equal(judgment(-.09),'great');assert.equal(judgment(.14),'good');assert.equal(judgment(.17),'bad');assert.equal(judgment(.171),null);
  const s=newStats();for(const r of ['perfect','great','bad','perfect','miss'])addResult(s,r);
  assert.equal(s.combo,0);assert.equal(s.maxCombo,2);assert.equal(summary(s,5).score,600000);
});
test('ten high-difficulty selections are part of Vocaloid and have verified full official sources',()=>{
  const songs=SONGS.filter(s=>s.collection==='proseka'),sources=JSON.parse(fs.readFileSync(new URL('../track-sources.json',import.meta.url),'utf8'));assert.equal(songs.length,10);
  for(const song of songs){assert.equal(song.pack,'vocaloid');const source=sources.find(s=>s.id===song.id);assert.ok(source);assert.equal(source.video,song.video);assert.equal(source.duration,song.duration);assert.equal(source.embeddable,true);assert.equal(source.status,'OK');
    const easy=makeChart(song,0),normal=makeChart(song,1),hard=makeChart(song,2);assert.ok(hard.length>normal.length,song.id+' HARD density');assert.ok(normal.length>easy.length,song.id+' NORMAL density');
  }
});
test('five Taiko songs use verified full soundtrack sources and different rhythm phrases',()=>{
  const songs=SONGS.filter(s=>s.pack==='taiko'),sources=JSON.parse(fs.readFileSync(new URL('../track-sources.json',import.meta.url),'utf8'));assert.equal(songs.length,5);
  for(const song of songs){const source=sources.find(s=>s.id===song.id);assert.ok(source);assert.equal(source.video,song.video);assert.equal(source.duration,song.duration);assert.equal(source.embeddable,true);assert.equal(source.status,'OK');assert.ok(song.duration>=120&&song.duration<180);
    const chart=makeChart(song,1),times=[...new Set(chart.map(n=>n.t))],gaps=new Set(times.slice(1).map((t,i)=>Math.round((t-times[i])*1000)));assert.ok(gaps.size>=3,song.id+' phrase rhythms');
  }
});
test('repeated presses cannot inflate score',()=>{
  const song=SONGS[0],notes=makeChart(song,1).filter(n=>!n.assist),replay=perfectEvents(notes);
  assert.equal(scoreReplay(song,1,replay.flatMap(e=>[e,e,e])).score,1000000);
  assert.ok(scoreReplay(song,1,replay.slice(1)).score<1000000);
});
test('every song has holds and simultaneous presses in normal and hard',()=>{
  for(const song of SONGS)for(const diff of [1,2]){const c=makeChart(song,diff).filter(n=>!n.assist);assert.ok(c.some(n=>n.end),song.id+' holds');assert.ok(c.some(n=>n.chord),song.id+' chords');
    for(const n of c.filter(n=>n.end)){assert.ok(!c.some(other=>other!==n&&other.lane===n.lane&&other.t>=n.t&&other.t<n.end),song.id+' overlapping lane');}}
});
test('a held note and a simultaneous tap can both score',()=>{
  const s=new RhythmSession([{t:1,end:2,lane:0},{t:1,lane:4}]);s.press(1,0);s.press(1,4);s.release(1.025,4);assert.equal(s.stats.perfect,1);s.advance(2);assert.equal(s.stats.perfect,2);assert.equal(s.stats.maxCombo,2);
});
test('releasing a hold early fails it, holding past the tail succeeds',()=>{
  const bad=new RhythmSession([{t:1,end:2,lane:0}]);bad.press(1,0);bad.release(1.4,0);bad.advance(3);assert.equal(bad.stats.miss,1);assert.equal(bad.stats.perfect,0);
  const good=new RhythmSession([{t:1,end:2,lane:0}]);good.press(1,0);good.advance(2.1);assert.equal(good.stats.perfect,1);good.release(2.2,0);assert.equal(good.stats.perfect,1);
});
test('hold release grace is bounded at 120 milliseconds',()=>{
  for(const [release,perfect]of [[1.88,1],[1.879,0]]){const s=new RhythmSession([{t:1,end:2,lane:0}]);s.press(1,0);s.release(release,0);assert.equal(s.stats.perfect,perfect);}
});
test('frame-by-frame live scoring matches event replay on server',()=>{
  const song=SONGS[0],chart=makeChart(song,2),manual=chart.filter(n=>!n.assist),events=perfectEvents(manual),live=new RhythmSession(chart);let clock=0;
  for(const [ms,lane,action]of events){while(clock<ms/1000){live.advance(clock);clock+=.007;}if(action===1)live.press(ms/1000,lane);else if(action===2)live.pressFlick(ms/1000,lane);else if(action===3)live.releaseFlick(ms/1000,lane);else live.release(ms/1000,lane);}
  live.finish();const remote=scoreReplay(song,2,events);assert.deepEqual(live.stats,remote.stats);
});
test('flicks exist only on HARD and require the base key followed by a fresh upper key',()=>{
  for(const song of SONGS){assert.ok(makeChart(song,2).some(n=>n.flick),song.id);for(const diff of [0,1])assert.ok(!makeChart(song,diff).some(n=>n.flick));}
  const chart=[{t:1,lane:0,flick:true}],good=new RhythmSession(chart);good.press(1,0);assert.equal(good.stats.perfect,0);good.release(1.025,0);good.pressFlick(1.15,0);assert.equal(good.stats.perfect,1);
  const early=new RhythmSession(chart);early.pressFlick(.8,0);early.press(1,0);early.pressFlick(1.1,0);early.advance(1.4);assert.equal(early.stats.miss,1);
  const late=new RhythmSession(chart);late.press(1,0);late.pressFlick(1.221,0);assert.equal(late.stats.miss,1);
  const fresh=new RhythmSession(chart);fresh.pressFlick(.8,0);fresh.press(1,0);fresh.releaseFlick(1.05,0);fresh.pressFlick(1.1,0);assert.equal(fresh.stats.perfect,1);
});
test('custom charts validate bounds, overlapping holds, and HARD-only flicks',()=>{
  const song=SONGS[0];assert.throws(()=>validateCustomNotes(song,[]));assert.throws(()=>validateCustomNotes(song,[[999,0,0]]));assert.throws(()=>validateCustomNotes(song,[[2000,8,0]]));assert.throws(()=>validateCustomNotes(song,[[2000,0,50]]));
  assert.throws(()=>validateCustomNotes(song,[[2000,0,1000],[2500,0,0]]));assert.throws(()=>validateCustomNotes(song,[[2000,0,0,1]],1));assert.throws(()=>validateCustomNotes(song,[[2000,0,500,1]],2));assert.throws(()=>validateCustomNotes(song,[[2000,0,0,1],[2300,0,0]],2));
  const raw=[[3000,4,0],[2000,0,500],[3000,0,0],[4000,7,0,1]],copy=structuredClone(raw),chart=customChart(song,raw,2);assert.deepEqual(raw,copy);assert.equal(chart.filter(n=>n.chord).length,2);assert.equal(chart.at(-1).flick,true);
  const result=scoreChartReplay(chart,song.duration,perfectEvents(chart));assert.equal(isFullCombo(result.stats,chart.length),true);
  const fail=scoreChartReplay(chart,song.duration,[]);assert.equal(isFullCombo(fail.stats,chart.length),false);
});
test('full combo accepts every successful note and rejects BAD, missed tails, or an empty chart',()=>{
  const s=newStats();for(const r of ['perfect','great','good'])addResult(s,r);assert.equal(isFullCombo(s,3),true);addResult(s,'bad');assert.equal(isFullCombo(s,4),false);assert.equal(isFullCombo(newStats(),0),false);
  const chart=customChart(SONGS[0],[[2000,0,1000]],1),result=scoreChartReplay(chart,SONGS[0].duration,[[2000,0,1],[2200,0,0]]);assert.equal(isFullCombo(result.stats,1),false);
});
