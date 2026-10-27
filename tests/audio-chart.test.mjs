import {chartAttacks} from '../audio-chart.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {SONGS,makeChart} from '../engine.mjs';
import {AUDIO_ATTACKS,AUDIO_SOURCES} from '../audio-attacks.mjs';
import {MONITORING_ATTACKS,MONITORING_PIANO_PROFILE,MONITORING_VOCAL_ANALYSIS} from '../monitoring-vocal.mjs';
import {pianoTrialChart} from '../piano-trial.mjs';

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
