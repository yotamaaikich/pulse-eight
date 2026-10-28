import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SONGS} from '../engine.mjs';
import {chartAttacks} from '../audio-chart.mjs';
import {SECTION_CONTROLS,SUSTAIN_CANDIDATES} from '../arrangement-data.mjs';
import {sectionAt,measuredSustain,attackGap} from '../arrangement.mjs';
import {makeChart,RhythmSession} from '../engine.mjs';
import {applyTrills} from '../trills.mjs';

test('all 35 songs keep each melody phrase in one hand and alternate the lead between phrases',()=>{
 for(const song of SONGS)for(const difficulty of [0,1,2]){
  const chart=makeChart(song,difficulty),phrases=[...Map.groupBy(chart,n=>n.handPhrase).values()];
  assert.ok(phrases.length>=2,song.id);
  const hands=new Set();
  for(const [i,notes]of phrases.entries()){
   const hand=notes[0].melodyHand;hands.add(hand);
   if(i)assert.notEqual(hand,phrases[i-1][0].melodyHand,'lead must alternate at the phrase hand-off');
   for(const n of notes){
    assert.equal(n.melodyHand,hand);
    assert.equal(Math.floor(n.lane/4),n.part==='melody'?hand:1-hand,song.id+'/'+difficulty+' split the lead between hands');
   }
  }
  assert.equal(hands.size,2);
  assert.ok(chart.some(n=>n.part==='support'&&n.end),'opposite hand retains held accompaniment');
  for(let lane=0;lane<8;lane++)assert.ok(chart.some(n=>n.lane===lane),song.id+'/'+difficulty+' unused input lane');
 }
});

test('every HARD song has a recognizable trill with eight uninterrupted alternating hits in one hand',()=>{
 for(const song of SONGS){
  const chart=makeChart(song,2),phrases=[...Map.groupBy(chart.filter(n=>n.trill),n=>n.trill).values()];
  assert.ok(phrases.length,song.id+' lacks an actual trill');
  for(const notes of phrases){
   assert.ok(notes.length>=8);
   assert.equal(new Set(notes.map(n=>n.melodyHand)).size,1);
   assert.equal(new Set(notes.slice(0,8).map(n=>n.lane)).size,2);
   for(let i=2;i<8;i++)assert.equal(notes[i].lane,notes[i-2].lane);
   const start=notes[0].t,end=notes.at(-1).t;
   const lead=chart.filter(n=>n.part==='melody'&&n.t>=start&&n.t<=end);
   assert.deepEqual(lead,notes,'an unrelated melody head interrupts the visible trill');
   for(let i=1;i<notes.length;i++)assert.notEqual(notes[i].lane,notes[i-1].lane);
   const blocks=[...Map.groupBy(notes,n=>n.trillStep).values()];
   for(const block of blocks){assert.equal(new Set(block.map(n=>n.lane)).size,2);for(let i=2;i<block.length;i++)assert.equal(block[i].lane,block[i-2].lane);}
   for(let i=1;i<blocks.length;i++){
    const a=[...new Set(blocks[i-1].map(n=>n.lane))].sort(),b=[...new Set(blocks[i].map(n=>n.lane))].sort();
    assert.ok(Math.abs(b[0]-a[0])<=1);assert.equal(b[0]-a[0],b[1]-a[1]);
   }
   const session=new RhythmSession(notes,song.duration);for(const n of notes){session.press(n.t,n.lane);session.release(n.t+.025,n.lane);}session.finish();assert.equal(session.stats.miss,0);
  }
 }
});

test('Disappearance has extended alternating and moving phrases with the other hand playing a simpler line',()=>{
 const chart=makeChart(SONGS.find(s=>s.id==='disappearance'),2);
 const phrases=[...Map.groupBy(chart.filter(n=>n.trill),n=>n.trill).values()];
 assert.ok(phrases.some(notes=>notes.length>=16&&notes[0].trillKind==='trill'));
 const moving=phrases.find(notes=>notes.length>=12&&notes[0].trillKind==='moving');assert.ok(moving);
 assert.ok(new Set(moving.map(n=>n.lane)).size>=3);
 assert.ok(phrases.some(notes=>chart.some(n=>n.part==='support'&&n.t>=notes[0].t&&n.t<=notes.at(-1).t)));
});

test('trill placement avoids a held key, retains the accompaniment and never changes source attack times',()=>{
 const song={id:'fixture',bpm:120,duration:10};
 const taps=Array.from({length:16},(_,i)=>({t:1+i*.125,sourceMs:1000+i*125,lane:7,degree:7,part:'melody',melodyHand:1,handPhrase:0}));
 const chart=[{t:.8,end:3,lane:4,part:'support'},{t:.8,end:3,lane:0,part:'support'},...taps],before=structuredClone(chart);
 const arranged=applyTrills(song,chart,2);assert.deepEqual(chart,before);
 const trills=arranged.filter(n=>n.trill);assert.equal(trills.length,16);assert.ok(trills.every(n=>n.lane>=5&&n.lane<=7));
 assert.deepEqual(arranged.map(n=>[n.t,n.sourceMs,n.end]),chart.map(n=>[n.t,n.sourceMs,n.end]));
 assert.deepEqual(arranged.filter(n=>n.end),chart.filter(n=>n.end).toSorted((a,b)=>a.t-b.t||a.lane-b.lane));
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
