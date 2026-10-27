import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceChart} from '../reference-chart.mjs';
import {keyboardStrikeY} from '../keyboard.mjs';
import {scoreChartReplay} from '../engine.mjs';
const song={id:'monitoring',duration:20};
const profile={offsetMs:130,voices:[[[333,800,89,12],[1127,1300,67,12],[1759,2000,65,12],[10000,10200,69,12],[11000,11500,71,12]],[[333,800,60,12],[600,900,62,12]]]};
test('reference rhythm and pitch share the exact score attack, including sharps and original octave',()=>{
 const chart=referenceChart(song,1,profile);
 assert.deepEqual([...new Set(chart.map(n=>Math.round(n.t*1000)))],[463,1257,1889,10130,11130]);
 for(const note of chart){const source=profile.voices[note.soundVoice].find(n=>n[0]===note.soundSourceStart);assert.equal(note.soundMidi,source[2]);assert.equal(note.soundMidi,note.soundOriginalMidi);assert.equal(Math.round(note.t*1000),source[0]+130);}
 assert.equal(chart.find(n=>n.soundVoice===0).soundMidi,89);
 assert.ok(chart.some(n=>n.chord));assert.equal(chart.some(n=>n.soundSourceStart===600),false,'no borrowed sustained accompaniment');
});
test('reference charts keep holds playable, isolated HARD FLOATs and source-derived timing across difficulties',()=>{
 for(let diff=0;diff<3;diff++){
 const chart=referenceChart(song,diff,profile);assert.ok(chart.some(n=>n.end));assert.equal(chart.some(n=>n.flick),diff===2);
 const events=chart.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0],...(n.flick?[[Math.round(n.t*1000),0,4],[Math.round((n.t+.08)*1000),n.lane,2],[Math.round((n.t+.1)*1000),n.lane,3],[Math.round((n.t+.12)*1000),0,5]]:[])]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
 assert.equal(scoreChartReplay(chart,20,events).stats.miss,0);
 }
 assert.equal(referenceChart({id:'other'},1,profile),null);
});
test('keyboard uses at most 15 percent of the chart height',()=>{
 for(const [w,h] of [[360,535],[600,535],[1920,1200]]){const height=h-keyboardStrikeY(w,h);assert.ok(height<=h*.15+.001);assert.ok(height>=50);}
});
