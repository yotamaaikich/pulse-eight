import test from 'node:test';
import assert from 'node:assert/strict';
import {SONGS,makeChart,scoreReplay,judgment,newStats,addResult,summary,RhythmSession} from '../engine.mjs';
function perfectEvents(notes){return notes.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0]]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);}
test('all tracks and difficulties support perfect and empty replays',()=>{
  assert.equal(SONGS.length,10);
  for(const song of SONGS)for(let diff=0;diff<3;diff++){
    const chart=makeChart(song,diff),manual=chart.filter(n=>!n.assist);
    assert.ok(manual.length>=30,`${song.id}/${diff}: chart too sparse`);
    for(let i=0;i<chart.length;i++){assert.ok(chart[i].t>0&&chart[i].t<song.duration);if(i)assert.ok(chart[i].t>=chart[i-1].t);}
    for(const n of manual)assert.ok(n.lane>=0&&n.lane<8);assert.ok(manual.some(n=>n.t>song.duration-4),song.id+' full length');
    const result=scoreReplay(song,diff,perfectEvents(manual));
    assert.equal(result.score,1000000,`${song.id}/${diff}`);assert.equal(result.stats.miss,0);assert.equal(result.maxCombo,manual.length);
    assert.equal(scoreReplay(song,diff,[]).score,0);
  }
});
test('judgment boundaries and combo resets',()=>{
  assert.equal(judgment(.045),'perfect');assert.equal(judgment(-.09),'great');assert.equal(judgment(.14),'good');assert.equal(judgment(.17),'bad');assert.equal(judgment(.171),null);
  const s=newStats();for(const r of ['perfect','great','bad','perfect','miss'])addResult(s,r);
  assert.equal(s.combo,0);assert.equal(s.maxCombo,2);assert.equal(summary(s,5).score,600000);
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
  for(const [ms,lane,action]of events){while(clock<ms/1000){live.advance(clock);clock+=.007;}if(action)live.press(ms/1000,lane);else live.release(ms/1000,lane);}
  live.finish();const remote=scoreReplay(song,2,events);assert.deepEqual(live.stats,remote.stats);
});
