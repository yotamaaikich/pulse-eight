import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createChartPreparation} from '../chart-preparation.mjs';
import {SONGS,RhythmSession} from '../engine.mjs?v=desktop-31';
import {chartForSong} from '../catalog.mjs?v=startup-34';
import {pianoTrialChart} from '../piano-trial.mjs?v=hands-19';
import {MONITORING_PIANO_PROFILE} from '../monitoring-vocal.mjs';

test('the real worker produces the same rhythm, holds, FLOAT and source piano as the existing chart path',async()=>{
  let thread;
  const preparer=createChartPreparation({timeoutMs:10000,workerFactory:()=>{
    thread=new Worker(new URL('./fixtures/chart-worker-node.mjs',import.meta.url));
    const bridge={postMessage:data=>thread.postMessage(data),terminate:()=>thread.terminate()};
    thread.on('message',data=>bridge.onmessage?.({data}));thread.on('error',error=>bridge.onerror?.(error));return bridge;
  }});
  try{
    for(const song of [SONGS[0],SONGS.find(s=>s.id==='disappearance'),SONGS.at(-1)]){
      const profile=song.id==='monitoring'?MONITORING_PIANO_PROFILE:null;
      const entry=preparer.prepare(song,2,profile);assert.equal(entry.chart,null,'building must return control before a chart exists');
      const chart=await entry.promise;assert.deepEqual(chart,pianoTrialChart(song,chartForSong(song,2),profile));
      assert.equal(preparer.prepare(song,2,profile),entry);
      const session=new RhythmSession(chart,song.duration);session.notes[0].done=true;assert.equal(chart[0].done,undefined);
    }
  }finally{await thread?.terminate();}
});

test('selection cache distinguishes difficulty and imported score; late worker replies cannot replace another chart',async()=>{
  const sent=[],worker={postMessage:data=>sent.push(data),terminate(){}},preparer=createChartPreparation({workerFactory:()=>worker,timeoutMs:10000});
  const profile={voices:[]},first=preparer.prepare(SONGS[0],1),hard=preparer.prepare(SONGS[0],2),custom=preparer.prepare(SONGS[0],1,profile);
  assert.equal(preparer.prepare(SONGS[0],1),first);assert.notEqual(first,custom);assert.equal(sent.length,3);
  worker.onmessage({data:{id:sent[1].id,chart:[{t:2,lane:7}]}});
  worker.onmessage({data:{id:sent[0].id,chart:[{t:1,lane:0}]}});
  worker.onmessage({data:{id:sent[2].id,chart:[{t:3,lane:2}]}});
  assert.equal((await first.promise)[0].lane,0);assert.equal((await hard.promise)[0].lane,7);assert.equal((await custom.promise)[0].lane,2);
  worker.onmessage({data:{id:sent[0].id,chart:[{t:99,lane:6}]}});assert.equal(first.chart[0].t,1);
});

test('unsupported or failed workers fall back to the same chart and cache the result without repeated work',async()=>{
  for(const factory of [null,()=>{throw Error('blocked');}]){
    let builds=0;const chart=[{t:1,lane:0}],preparer=createChartPreparation({workerFactory:factory,build:()=>{builds++;return chart;}});
    const entry=preparer.prepare(SONGS[0],1);assert.equal(entry.chart,chart);assert.equal(await entry.promise,chart);assert.equal(preparer.prepare(SONGS[0],1),entry);assert.equal(builds,1);
  }
});

test('a stalled worker times out once, releases all waiting starts and uses the fallback for future selections',async()=>{
  let builds=0,stopped=0;const worker={postMessage(){},terminate(){stopped++;}},preparer=createChartPreparation({workerFactory:()=>worker,timeoutMs:5,build:(_song,d)=>{builds++;return [{t:1,lane:d}];}});
  const first=preparer.prepare(SONGS[0],1),second=preparer.prepare(SONGS[0],2);
  await Promise.all([first.promise,second.promise]);assert.equal(stopped,1);assert.equal(builds,2);assert.equal(second.chart[0].lane,2);
  const third=preparer.prepare(SONGS[1],0);assert.equal(third.chart[0].lane,0);assert.equal(builds,3);
});
