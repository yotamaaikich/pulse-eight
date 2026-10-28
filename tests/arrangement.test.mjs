import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SONGS} from '../engine.mjs';
import {chartAttacks} from '../audio-chart.mjs';
import {SECTION_CONTROLS,SUSTAIN_CANDIDATES} from '../arrangement-data.mjs';
import {sectionAt,measuredSustain,attackGap} from '../arrangement.mjs';
import {makeChart,RhythmSession} from '../engine.mjs';
import {applyTrills} from '../trills.mjs';
import {TRILL_PHRASES,TRILL_CONTOURS} from '../trill-data.mjs';

test('each authored NORMAL and HARD chart uses all eight fixed input lanes for trills',()=>{
 for(const id of Object.keys(TRILL_PHRASES))for(const d of [1,2]){
  const notes=makeChart(SONGS.find(s=>s.id===id),d).filter(n=>n.trill);
  const counts=Array.from({length:8},(_,lane)=>notes.filter(n=>n.lane===lane).length);
  assert.ok(counts.every(count=>count>0),id+'/'+d+': unused trill lane '+counts);
 }
});

test('authored trills alternate two keys within each block and move by one lane with the phrase',()=>{
 for(const id of Object.keys(TRILL_PHRASES))for(const d of [1,2]){
  const song=SONGS.find(s=>s.id===id),chart=makeChart(song,d),phrases=Map.groupBy(chart.filter(n=>n.trill),n=>n.trill);
  assert.ok(phrases.size>=2,id+'/'+d+' missing trill phrases');
  for(const notes of phrases.values()){
   assert.ok(notes.length>=(d===2?8:6));assert.ok(notes.every(n=>!n.end&&!n.flick&&!n.chord));
   const blocks=[...Map.groupBy(notes,n=>n.trillStep).values()];
   for(const block of blocks){assert.equal(new Set(block.map(n=>n.lane)).size,2);for(let i=2;i<block.length;i++)assert.equal(block[i].lane,block[i-2].lane);}
   for(let i=1;i<notes.length;i++)assert.notEqual(notes[i].lane,notes[i-1].lane,'moving boundary introduced a jack');
   for(let i=1;i<blocks.length;i++){const a=[...new Set(blocks[i-1].map(n=>n.lane))].sort(),b=[...new Set(blocks[i].map(n=>n.lane))].sort();assert.ok(Math.abs(b[0]-a[0])<=1);assert.equal(b[0]-a[0],b[1]-a[1]);}
   const session=new RhythmSession(notes,song.duration);for(const n of notes){session.press(n.t,n.lane);session.release(n.t+.025,n.lane);}session.finish();assert.equal(session.stats.miss,0);
  }
 }
});

test('Disappearance includes actual rising moving trills, falling trills, and a stable alternating run',()=>{
 const chart=makeChart(SONGS.find(s=>s.id==='disappearance'),2);
 const rising=chart.filter(n=>n.trill==='disappearance-2-2');assert.ok(rising.length>=8);
 const blocks=[...Map.groupBy(rising,n=>n.trillStep).values()].map(b=>Math.min(...b.map(n=>n.lane)));
 assert.ok(blocks.some((n,i)=>i&&n>blocks[i-1]));assert.ok(blocks.every((n,i)=>!i||n>=blocks[i-1]));
 const falling=chart.filter(n=>n.trill==='disappearance-2-3');assert.ok(falling.length>=8);assert.ok(Math.min(...falling.slice(4).map(n=>n.lane))<Math.min(...falling.slice(0,4).map(n=>n.lane)));
 const stable=chart.filter(n=>n.trill==='disappearance-2-1');assert.ok(stable.length>=12);assert.equal(new Set(stable.map(n=>n.lane)).size,2);
});

test('moving trills avoid held lanes and retain exact source attacks without changing the input chart',()=>{
 const song=SONGS.find(s=>s.id==='disappearance');
 const source=TRILL_CONTOURS.disappearance.filter(r=>r[0]>=43607&&r[0]<=44485).slice(0,8);
 const chart=[{t:43,end:45,lane:4},{t:43,end:45,lane:5},...source.map(r=>({t:r[0]/1000,sourceMs:r[0],lane:0,degree:0}))];
 const before=structuredClone(chart),arranged=applyTrills(song,chart,2);assert.deepEqual(chart,before);
 const trills=arranged.filter(n=>n.trill);assert.ok(trills.length>=8);assert.ok(trills.every(n=>n.lane!==4&&n.lane!==5));assert.ok(new Set(trills.map(n=>n.lane)).size>2);
 assert.deepEqual(arranged.map(n=>[n.t,n.sourceMs,n.end]),chart.map(n=>[n.t,n.sourceMs,n.end]));
});

test('every full song has its own contiguous, bounded arrangement controls',()=>{
 assert.equal(Object.keys(SECTION_CONTROLS).length,35);
 const fingerprints=[];
 for(const song of SONGS){
  const rows=SECTION_CONTROLS[song.id];assert.ok(rows?.length>=10,song.id);
  assert.equal(rows[0][0],0);assert.equal(rows.at(-1)[1],song.duration*1000);
  rows.forEach((r,i)=>{
   if(i)assert.equal(r[0],rows[i-1][1]);assert.ok(r[1]>r[0]);
   assert.ok(r[2]>=.68&&r[2]<=1.2);assert.ok(r[3]>=.65&&r[3]<=1.45);
   assert.ok(r[4]>=1.6&&r[4]<=3);assert.ok([0,1,2].includes(r[5]));
   const t=(r[0]+r[1])/2000;assert.equal(sectionAt(song.id,t).density,r[2]);
   for(let d=0;d<3;d++)assert.ok(attackGap(song.id,t,d)>=[240,125,82][d]);
  });
  fingerprints.push(JSON.stringify(rows));
 }
 assert.equal(new Set(fingerprints).size,35);
});

test('a short reference cut is not stretched over Tetoris full-only middle section',()=>{
 assert.equal(sectionAt('tetoris',20).reference,true);
 assert.equal(sectionAt('tetoris',80).reference,false);
 assert.equal(sectionAt('tetoris',125).reference,true);
 const reports=JSON.parse(readFileSync(new URL('../docs/arrangement-review-v12.json',import.meta.url)));
 assert.equal(reports.length,35);
 for(const r of reports){
  assert.equal(r.auditoryPlaytest,false);
  if(r.referenceSections){
   assert.equal(r.referenceAnalysis.sourceNotesRedistributed,false);
   assert.ok(r.referenceAnalysis.alignedSegments.length);
   assert.ok(r.referenceAnalysis.waveformCorrelationMinimum>=.9);
  }
 }
});

test('additional long notes use measured sustain evidence on the same source attack',()=>{
 for(const song of SONGS){
  const attacks=new Map(chartAttacks(song.id).map(r=>[r[0],r]));
  for(const [ms,duration] of SUSTAIN_CANDIDATES[song.id]){
   assert.ok(attacks.has(ms),song.id);assert.ok(duration>=400&&duration<=1500);
   assert.ok(ms+duration<=song.duration*1000);
   assert.ok(measuredSustain(song.id,attacks.get(ms))>=duration);
  }
 }
 assert.equal(sectionAt('missing',1).density,1);
 assert.equal(sectionAt('tetoris',-1).reference,false);
 assert.equal(sectionAt('tetoris',143).reference,false);
});
