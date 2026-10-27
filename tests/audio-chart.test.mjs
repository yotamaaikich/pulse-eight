import test from 'node:test';
import assert from 'node:assert/strict';
import {SONGS,makeChart} from '../engine.mjs';
import {AUDIO_ATTACKS,AUDIO_SOURCES} from '../audio-attacks.mjs';
test('every shipped note head is anchored to an analyzed attack in its own official source',()=>{
 for(const song of SONGS){
  const source=AUDIO_SOURCES[song.id],attacks=new Set(AUDIO_ATTACKS[song.id].map(n=>n[0]));
  assert.equal(source.video,song.video);assert.ok(Math.abs(source.duration-song.duration)<2,song.id);assert.match(source.sha256,/^[a-f0-9]{64}$/);
  for(let d=0;d<3;d++)for(const n of makeChart(song,d)){
   assert.ok(attacks.has(Math.round(n.t*1000)),song.id+' inserted a note not present in the analyzed attacks');
   assert.equal(n.sourceMs,Math.round(n.t*1000));
  }
 }
});
test('vocal boundaries are carried into the chart, with caption provenance kept explicit',()=>{
 const monitoring=makeChart(SONGS[0],1);assert.equal(AUDIO_SOURCES.monitoring.captionLanguage,'ja');assert.equal(AUDIO_SOURCES.monitoring.captionType,'manual');
 assert.ok(monitoring.some(n=>n.phraseStart));assert.ok(monitoring.some(n=>n.phraseEnd));assert.ok(monitoring.some(n=>n.vocalPhrase));
 assert.equal(AUDIO_SOURCES.override.captionType,'automatic');assert.equal(AUDIO_SOURCES.ghost.phrases,0);
});
test('tracks do not share a copied opening rhythm, and old loop phrases are not used by the new engine',()=>{
 const fingerprints=SONGS.map(song=>{const times=[...new Set(makeChart(song,1).map(n=>n.t))];return times.slice(1,65).map((t,i)=>Math.round((t-times[i])*1000)).join(',');});
 assert.equal(new Set(fingerprints).size,SONGS.length);
});
