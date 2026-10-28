import test from 'node:test';
import assert from 'node:assert/strict';
import {SONGS,makeChart} from '../engine.mjs';
import {chartMetrics,difficultyMetrics,orderedSongs} from '../catalog.mjs';
test('difficulty levels use manual total notes; chords count per key and holds count once',()=>{
  assert.deepEqual(chartMetrics([{t:1,lane:0,end:9},{t:1,lane:1},{t:2,lane:2,flick:true},{t:1.2,assist:true}]),{count:3,level:2});
  for(const [count,level]of [[0,2],[1,2],[100,2],[101,4],[200,4],[2001,42]])assert.equal(chartMetrics(Array.from({length:count},()=>({}))).level,level);
  for(const song of SONGS)for(let diff=0;diff<3;diff++)assert.equal(difficultyMetrics(song,diff).count,makeChart(song,diff).filter(n=>!n.assist).length);
});
test('song sorting follows the selected difficulty, filters genres and preserves stable library order',()=>{
  const original=SONGS.map(s=>s.id);
  for(let diff=0;diff<3;diff++)for(const pack of ['all','vocaloid','madoka','osu','taiko']){
    const asc=orderedSongs(SONGS,pack,diff,'level-asc'),desc=orderedSongs(SONGS,pack,diff,'level-desc');
    assert.equal(asc.length,SONGS.filter(s=>pack==='all'||s.pack===pack).length);
    for(let i=1;i<asc.length;i++)assert.ok(difficultyMetrics(asc[i-1].s,diff).count<=difficultyMetrics(asc[i].s,diff).count);
    for(let i=1;i<desc.length;i++)assert.ok(difficultyMetrics(desc[i-1].s,diff).count>=difficultyMetrics(desc[i].s,diff).count);
  }
  assert.deepEqual(SONGS.map(s=>s.id),original);assert.deepEqual(orderedSongs(SONGS,'all',2,'library').map(x=>x.i),SONGS.map((_,i)=>i));
});
