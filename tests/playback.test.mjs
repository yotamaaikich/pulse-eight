import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackGate} from '../playback.mjs';
import {RhythmSession} from '../engine.mjs';

function playing(gate,from,until,wall=0){let result;for(let t=from;t<=until+.001;t+=.05)result=gate.observe(t,1,wall+(t-from)*1000);return result;}

test('a zero content clock stays waiting through long preroll and ended events',()=>{
  const gate=new PlaybackGate();
  for(let wall=0;wall<=90000;wall+=100)assert.deepEqual(gate.observe(0,wall===30000?0:1,wall),{time:0,waiting:true,seek:false});
});
test('forward progress resumes the content clock after loading',()=>{
  const gate=new PlaybackGate();gate.reset(1000);
  assert.equal(gate.observe(0,1,1000).waiting,true);
  assert.equal(gate.observe(.1,1,1100).waiting,true);
  const ready=playing(gate,.15,.6,1150);assert.equal(ready.waiting,false);assert.ok(ready.time>=.59);
});
test('a stalled clock freezes scoring, then resumes without losing a held note',()=>{
  const gate=new PlaybackGate(),session=new RhythmSession([{t:1,end:3,lane:0}]);
  playing(gate,0,1.5);session.press(1,0);session.advance(gate.time);
  for(let wall=1600;wall<=12000;wall+=100){const state=gate.observe(1.5,1,wall);session.advance(state.time);}
  assert.equal(gate.waiting,true);assert.ok(Math.abs(gate.time-1.5)<1e-6);assert.equal(session.stats.miss,0);assert.equal(session.notes[0].done,false);
  assert.equal(playing(gate,1.55,3.1,12050).waiting,false);session.advance(gate.time);assert.equal(session.stats.perfect,1);
});
test('buffering and an ad clock reset do not rewind the chart',()=>{
  const gate=new PlaybackGate();playing(gate,0,5);
  assert.equal(gate.observe(5,3,5100).waiting,true);
  for(let wall=5200;wall<=20000;wall+=100){const result=gate.observe(0,1,wall);assert.equal(result.waiting,true);assert.ok(result.time>=4.99);}
  const resumed=playing(gate,5,5.6,20100);assert.equal(resumed.waiting,false);assert.ok(resumed.time>=5.59);assert.equal(resumed.seek,false);
});
test('a forward seek is flagged and a paused resume waits for fresh progress',()=>{
  const gate=new PlaybackGate();playing(gate,0,2);
  assert.equal(gate.observe(10,1,2100).seek,true);
  gate.reset(3000,10);assert.equal(gate.observe(10,1,3100).waiting,true);
  assert.equal(playing(gate,10.05,10.5,3150).waiting,false);
});
