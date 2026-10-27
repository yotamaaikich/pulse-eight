import test from 'node:test';
import assert from 'node:assert/strict';
import {createPianoSound} from '../piano-sound.mjs';
import {pianoTrialChart} from '../piano-trial.mjs';
import {SONGS,makeChart,scoreChartReplay} from '../engine.mjs';
function fixture(){
 const oscillators=[],gains=[];let resumes=0;
 const parameter=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push(['set',v,t]);},setTargetAtTime(v,t,c){this.events.push(['target',v,t,c]);},linearRampToValueAtTime(v,t){this.events.push(['linear',v,t]);},exponentialRampToValueAtTime(v,t){this.events.push(['exp',v,t]);},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){}});
 const context={state:'suspended',currentTime:12,destination:{},resume(){resumes++;this.state='running';return Promise.resolve();},createGain(){const n={...node(),gain:parameter()};gains.push(n);return n;},createDynamicsCompressor(){return {...node(),...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,parameter()]))};},createOscillator(){const n={...node(),frequency:parameter(),starts:[],stops:[],start(t){this.starts.push(t);},stop(t){this.stops.push(t);}};oscillators.push(n);return n;}};
 const piano=createPianoSound({contextFactory:()=>context});return {piano,context,oscillators,gains,get resumes(){return resumes;}};
}
test('piano starts at key-down time, decays naturally, and FLOAT uses a separate short spectrum',()=>{
 const f=fixture();f.piano.configure({enabled:true,volume:18});assert.ok(f.piano.warm());assert.equal(f.resumes,1);
 f.piano.play({midi:69,hold:2});assert.equal(f.oscillators.length,4);assert.ok(f.oscillators.every(o=>o.starts[0]===12));assert.equal(f.oscillators[0].frequency.events[0][1],440);assert.equal(f.oscillators[0].stops[0],14.015);
 f.piano.play({midi:69,float:true});assert.equal(f.oscillators.length,7);assert.equal(f.oscillators[4].frequency.events[0][1],880);assert.ok(f.oscillators.slice(4).every(o=>o.stops[0]<12.4));
 assert.ok(f.gains.slice(1).every(n=>n.gain.events.some(e=>e[0]==='exp'&&e[1]===.00001)));
});
test('chords attenuate the combined bus and OFF/zero volume prevent new voices',()=>{
 const f=fixture();for(const midi of [62,65,69])f.piano.play({midi});const master=f.gains[0].gain.events;
 assert.ok(master.at(-1)[1]<master.find(e=>e[0]==='target'&&e[1]>0)[1]);f.piano.configure({enabled:false,volume:18});const count=f.oscillators.length;assert.equal(f.piano.play({midi:62}),false);assert.equal(f.oscillators.length,count);
 f.piano.configure({enabled:true,volume:0});assert.equal(f.piano.play({midi:62}),false);assert.equal(f.gains[0].gain.events.at(-1)[1],0);
});
test('trial pitches vary with harmony and do not alter chart timing, lanes or score',()=>{
 const song=SONGS[0],raw=makeChart(song,1),chart=pianoTrialChart(song,raw);assert.ok(raw.every(n=>n.soundMidi===undefined));
 for(let i=0;i<chart.length;i++){const {soundMidi,...note}=chart[i];assert.deepEqual(note,raw[i]);if(!note.assist)assert.ok(soundMidi>=48&&soundMidi<=79);}
 assert.ok(new Set(chart.filter(n=>n.lane===0).map(n=>n.soundMidi)).size>1);
 const events=raw.filter(n=>!n.assist).flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.02)*1000),n.lane,0]]).sort((a,b)=>a[0]-b[0]);
 assert.deepEqual(scoreChartReplay(chart,song.duration,events),scoreChartReplay(raw,song.duration,events));assert.equal(pianoTrialChart(SONGS[1],raw),raw);
 for(const t of new Set(chart.filter(n=>n.chord).map(n=>n.t))){const notes=chart.filter(n=>!n.assist&&n.t===t);assert.equal(new Set(notes.map(n=>n.soundMidi)).size,notes.length);}
});
