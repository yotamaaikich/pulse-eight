import {chartAttacks} from '../audio-chart.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {SONGS,makeChart} from '../engine.mjs';
import {AUDIO_ATTACKS,AUDIO_SOURCES} from '../audio-attacks.mjs';
import {MONITORING_ATTACKS,MONITORING_PIANO_PROFILE,MONITORING_VOCAL_ANALYSIS} from '../monitoring-vocal.mjs';
import {pianoTrialChart} from '../piano-trial.mjs';

test('Monitoring uses all keys and varied two-hand accents without returning to sparse chords',()=>{
 const song=SONGS.find(s=>s.id==='monitoring');
 for(const [difficulty,minimum] of [[1,40],[2,60]]){
  const chart=makeChart(song,difficulty),groups=new Map();
  for(const n of chart){if(!groups.has(n.t))groups.set(n.t,[]);groups.get(n.t).push(n.lane);}
  const chords=[...groups.values()].filter(g=>g.length>1);
  assert.ok(chords.length>=minimum);
  assert.ok(new Set(chords.map(g=>g.join(','))).size>=6);
  for(let lane=0;lane<8;lane++)assert.ok(chart.filter(n=>n.lane===lane).length>=10);
 }
});

test('Monitoring sustains remain throughout the full track, including while the other hand taps',()=>{
 for(let d=0;d<3;d++){
  const chart=makeChart(SONGS.find(s=>s.id==='monitoring'),d),holds=chart.filter(n=>n.end);
  assert.ok(holds.length>=20,'sustained accompaniment must not disappear during vocals');
  for(let part=0;part<3;part++)assert.ok(holds.filter(n=>n.t>=part*60&&n.t<(part+1)*60).length>=5);
  assert.ok(new Set(holds.map(n=>n.lane)).size>=4);
  assert.ok(holds.some(n=>n.end-n.t>=1));
  assert.ok(holds.some(h=>chart.some(n=>n.lane!==h.lane&&n.t>h.t+.1&&n.t<h.end-.1)));
  for(const h of holds)assert.ok(!chart.some(n=>n!==h&&n.lane===h.lane&&n.t>=h.t&&n.t<h.end),'hold lane must remain playable');
 }
});

test('bundled Monitoring pitches only decorate their own analyzed attack and preserve source octave',()=>{
 const source=new Map(MONITORING_ATTACKS.map(n=>[n[0],n]));
 for(const [start,end,midi] of MONITORING_PIANO_PROFILE.voices[0]){
  assert.ok(source.has(start));assert.ok(end>start);assert.ok(Number.isInteger(midi)&&midi>=55&&midi<=86);
 }
 const profile={sourceKind:MONITORING_PIANO_PROFILE.sourceKind,offsetMs:0,voices:[[[1000,1600,85,12]]]};
 const notes=pianoTrialChart(SONGS[0],[{t:1,lane:0},{t:1.2,lane:1}],profile);
 assert.equal(notes[0].soundMidi,85);assert.equal(notes[1].soundMidi,undefined);
 assert.equal(MONITORING_VOCAL_ANALYSIS.rawAudioPublished,false);assert.equal(MONITORING_VOCAL_ANALYSIS.lyricTextPublished,false);
 assert.equal(MONITORING_VOCAL_ANALYSIS.pitchedAttacks,MONITORING_PIANO_PROFILE.voices[0].length);
});
test('every shipped note head is anchored to an analyzed attack in its own official source',()=>{
 for(const song of SONGS){
  const source=AUDIO_SOURCES[song.id],attacks=new Set(chartAttacks(song.id).map(n=>n[0]));
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
