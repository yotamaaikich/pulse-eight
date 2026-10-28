import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SONGS} from '../engine.mjs';
import {chartAttacks} from '../audio-chart.mjs';
import {SECTION_CONTROLS,SUSTAIN_CANDIDATES} from '../arrangement-data.mjs';
import {sectionAt,measuredSustain,attackGap} from '../arrangement.mjs';

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
