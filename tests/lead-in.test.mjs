import test from 'node:test';
import assert from 'node:assert/strict';
import {noteTravelSeconds,leadInSeconds,leadInClock} from '../lead-in.mjs';
import {inputClock} from '../playback.mjs';
import {SONGS,makeChart} from '../engine.mjs';

test('all 105 charts start beyond the far edge and approach while content time stays at zero',()=>{
 for(const song of SONGS)for(let d=0;d<3;d++){
  const first=makeChart(song,d)[0].t;
  for(const speed of [.5,1,1.5,2])for(const offset of [-.5,0,.5]){
  const lead=leadInSeconds(speed,first+offset),deadline=lead*1000;
  assert.ok(lead>=3);const visual=leadInClock(0,deadline,0)-offset;
  assert.ok(first-visual>noteTravelSeconds(speed),`${song.id}/${d}/${speed}/${offset}`);
  const entryWall=(lead-(noteTravelSeconds(speed)-first-offset))*1000;
  const entryTime=(entryWall<=deadline?leadInClock(0,deadline,entryWall):(entryWall-deadline)/1000)-offset;
  assert.ok(Math.abs(first-entryTime-noteTravelSeconds(speed))<1e-8);
  assert.equal(leadInClock(0,deadline,deadline),0);
  assert.equal(leadInClock(0,deadline,deadline+50),0);
  }
 }
});

test('fresh key-event timestamps remove frame lag without accepting seeks or buffering progress',()=>{
 assert.equal(inputClock(12,12.023,1),12.023);
 assert.equal(inputClock(12,11.99,1),12);
 for(const state of [0,2,3,5])assert.equal(inputClock(12,12.023,state),12);
 assert.equal(inputClock(12,20,1),12);assert.equal(inputClock(12,10,1),12);
 assert.equal(inputClock(12,NaN,1),12);
 assert.equal(inputClock(12,12.3,1,320),12.3);
 assert.equal(inputClock(12,13,1,320),12);
});
