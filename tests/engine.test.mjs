import {AUDIO_ATTACKS} from '../audio-attacks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SONGS,makeChart,scoreReplay,judgment,newStats,addResult,summary,RhythmSession,airWindows,HOLD_TICK,isFullCombo,scoreChartReplay} from '../engine.mjs';
function spaceFlick(session,t,lane){session.pressSpace(t);return session.pressFlick(t,lane);}
function holdTicks(notes){return notes.filter(n=>n.end).reduce((sum,n)=>sum+Math.max(0,Math.ceil((n.end-n.t)/HOLD_TICK-1e-8)-1),0);}
function perfectEvents(notes){return notes.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0],...(n.flick?[[Math.round(n.t*1000),0,4],[Math.round((n.t+.08)*1000),n.lane,2],[Math.round((n.t+.1)*1000),n.lane,3],[Math.round((n.t+.12)*1000),0,5]]:[])]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);}
test('all tracks and difficulties support perfect and empty replays',()=>{
  assert.equal(SONGS.length,35);
  for(const song of SONGS)for(let diff=0;diff<3;diff++){
    const chart=makeChart(song,diff),manual=chart.filter(n=>!n.assist);
    assert.ok(manual.length+holdTicks(manual)<=4096,`${song.id}/${diff}: standard leaderboard limit`);
    assert.ok(manual.length>=30,`${song.id}/${diff}: chart too sparse`);
    for(let i=0;i<chart.length;i++){assert.ok(chart[i].t>0&&chart[i].t<song.duration);if(i)assert.ok(chart[i].t>=chart[i-1].t);}
    for(const n of manual)assert.ok(n.lane>=0&&n.lane<8);assert.ok(manual.some(n=>n.t>song.duration*.85),song.id+' reaches final audible attacks without filling silent outro');
    const result=scoreReplay(song,diff,perfectEvents(manual));
    assert.equal(result.score,1000000,`${song.id}/${diff}`);assert.equal(result.stats.miss,0);assert.equal(result.maxCombo,manual.length+holdTicks(manual));
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
  const s=new RhythmSession([{t:1,end:2,lane:0},{t:1,lane:4}]);s.press(1,0);s.press(1,4);s.release(1.025,4);assert.equal(s.stats.perfect,1);s.advance(2);assert.equal(s.stats.perfect,2);assert.equal(s.stats.maxCombo,5);
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
  for(const [ms,lane,action]of events){while(clock<ms/1000){live.advance(clock);clock+=.007;}if(action===1)live.press(ms/1000,lane);else if(action===2)live.pressFlick(ms/1000,lane);else if(action===3)live.releaseFlick(ms/1000,lane);else if(action===4)live.pressSpace(ms/1000);else if(action===5)live.releaseSpace(ms/1000);else live.release(ms/1000,lane);}
  live.finish();const remote=scoreReplay(song,2,events);assert.deepEqual(live.stats,remote.stats);
});
test('flicks exist only on HARD and require the base key followed by a fresh upper key',()=>{
  for(const song of SONGS){assert.ok(makeChart(song,2).some(n=>n.flick),song.id);for(const diff of [0,1])assert.ok(!makeChart(song,diff).some(n=>n.flick));}
  const chart=[{t:1,lane:0,flick:true}],good=new RhythmSession(chart);good.press(1,0);assert.equal(good.stats.perfect,0);good.release(1.025,0);spaceFlick(good,1.15,0);assert.equal(good.stats.perfect,1);
  const early=new RhythmSession(chart);spaceFlick(early,.8,0);early.press(1,0);spaceFlick(early,1.1,0);early.advance(1.4);assert.equal(early.stats.miss,1);
  const late=new RhythmSession(chart);late.press(1,0);spaceFlick(late,1.221,0);assert.equal(late.stats.miss,1);
  const fresh=new RhythmSession(chart);spaceFlick(fresh,.8,0);fresh.press(1,0);fresh.releaseFlick(1.05,0);spaceFlick(fresh,1.1,0);assert.equal(fresh.stats.perfect,1);
});
test('full combo accepts every successful note and rejects BAD, missed tails, or an empty chart',()=>{
  const s=newStats();for(const r of ['perfect','great','good'])addResult(s,r);assert.equal(isFullCombo(s,3),true);addResult(s,'bad');assert.equal(isFullCombo(s,4),false);assert.equal(isFullCombo(newStats(),0),false);
  const chart=[{t:2,lane:0,end:3}],result=scoreChartReplay(chart,SONGS[0].duration,[[2000,0,1],[2200,0,0]]);assert.equal(isFullCombo(result.stats,1),false);
});


test('holds add combo every 250ms without inflating accuracy, stop on release and never repeat ticks',()=>{
  const s=new RhythmSession([{t:1,end:2,lane:0}]);s.press(1,0);s.advance(1.24);assert.equal(s.stats.combo,0);s.advance(1.25);assert.equal(s.stats.combo,1);s.advance(1.25);assert.equal(s.stats.combo,1);s.advance(1.75);assert.equal(s.stats.combo,3);s.advance(2);assert.equal(s.stats.combo,4);assert.equal(s.stats.perfect,1);assert.equal(summary(s.stats,1).accuracy,100);assert.ok(isFullCombo(s.stats,1));
  const early=new RhythmSession([{t:1,end:3,lane:0}]);early.press(1,0);early.advance(1.5);assert.equal(early.stats.combo,2);early.release(1.6,0);assert.equal(early.stats.combo,0);early.advance(5);assert.equal(early.stats.holdTicks,2);
});
test('Space held outside AIR breaks combo and must be released before AIR can score',()=>{
  const chart=[{t:1,lane:0},{t:3,lane:1,flick:true},{t:6,lane:2,flick:true}];
  const s=new RhythmSession(chart);s.press(1,0);s.release(1.05,0);s.pressSpace(1.5);assert.equal(s.stats.combo,0);assert.equal(s.stats.airBreaks,1);s.press(3,1);s.pressFlick(3.05,1);s.advance(3.5);assert.equal(s.stats.miss,1);s.releaseSpace(3.6);s.pressSpace(5.9);s.press(6,2);s.pressFlick(6.05,2);s.releaseSpace(6.1);assert.equal(s.stats.combo,1);assert.equal(s.stats.perfect,2);
  const tail=new RhythmSession([{t:1,lane:0,flick:true}]);tail.pressSpace(.9);tail.press(1,0);tail.pressFlick(1.05,0);tail.advance(1.4);assert.equal(tail.stats.combo,0);assert.equal(tail.stats.airBreaks,1);
});
test('AIR ribbons permit continuous Space only within the same short chain; frame and replay agree across gaps',()=>{
  const chart=[{t:1,lane:0,flick:true},{t:1.7,lane:1,flick:true},{t:4,lane:2},{t:5,lane:3,flick:true}];
  const events=[[900,0,4],[1000,0,1],[1050,0,2],[1100,0,0],[1100,0,3],[1700,1,1],[1750,1,2],[1800,1,0],[1800,1,3],[4000,2,1],[4100,2,0],[5000,3,1],[5050,3,2],[5100,0,5]];
  const remote=scoreChartReplay(chart,6,events),live=new RhythmSession(chart,6);let at=0;
  const methods=['release','press','pressFlick','releaseFlick','pressSpace','releaseSpace'];
  for(const [ms,lane,action]of events){while(at<ms/1000){live.advance(at);at+=.007;}live[methods[action]](ms/1000,lane);}live.finish();assert.deepEqual(live.stats,remote.stats);assert.equal(remote.stats.airBreaks,1);assert.equal(remote.stats.miss,1);assert.equal(remote.maxCombo,2);assert.equal(remote.stats.combo,0);
});

test('an AIR action without an actual Space-down event cannot score on replay',()=>{
 const result=scoreChartReplay([{t:1,lane:0,flick:true}],2,[[1000,0,1],[1050,0,2]]);assert.equal(result.stats.miss,1);assert.equal(result.score,0);
});

test('every stock HARD chart has short AIR phrases with six-second release gaps and quiet intro/outro',()=>{
  for(const song of SONGS){
    const chart=makeChart(song,2),windows=airWindows(chart),air=chart.filter(n=>n.flick);assert.ok(windows.length>0,song.id);
    assert.ok(air.some((n,i)=>i&&n.t-air[i-1].t<=1.2),song.id+' has an actual lane-move phrase');
    for(const w of windows){assert.ok(w.start>=7.78-1e-9,song.id+' intro');assert.ok(w.end<=song.duration-3.5,song.id+' outro');assert.ok(w.end-w.start<=2.42,song.id+' bounded AIR length');}
    for(let i=1;i<windows.length;i++)assert.ok(windows[i].start-windows[i-1].end>=5.38-1e-9,song.id+' release gap');
    assert.ok(windows.reduce((sum,w)=>sum+w.end-w.start,0)/song.duration<.3,song.id+' AIR coverage');
    for(const diff of [0,1])assert.ok(makeChart(song,diff).every(n=>!n.flick));
  }
});
