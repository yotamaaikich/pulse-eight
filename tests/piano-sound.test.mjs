import test from 'node:test';
import assert from 'node:assert/strict';
import {createPianoSound} from '../piano-sound.mjs';
import {pianoTrialChart,scoreNoteAt} from '../piano-trial.mjs';
const TEST_SCORE={offsetMs:0,voices:[[[1000,1500,69,12],[2000,2500,65,12]],[[1000,1500,50,12],[2000,2500,48,12]]]};
import {SONGS,makeChart,scoreChartReplay} from '../engine.mjs';
function fixture({fail=false}={}){
 const oscillators=[],sources=[],gains=[],requests=[];let resumes=0;
 const parameter=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push(['set',v,t]);},setTargetAtTime(v,t,c){this.events.push(['target',v,t,c]);},linearRampToValueAtTime(v,t){this.events.push(['linear',v,t]);},exponentialRampToValueAtTime(v,t){this.events.push(['exp',v,t]);},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){}});
 const playable=()=>({...node(),starts:[],stops:[],start(...args){this.starts.push(args);},stop(t){this.stops.push(t);}});
 const context={state:'suspended',currentTime:12,destination:{},resume(){resumes++;this.state='running';return Promise.resolve();},createGain(){const n={...node(),gain:parameter()};gains.push(n);return n;},createDynamicsCompressor(){return {...node(),...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,parameter()]))};},createBiquadFilter(){return {...node(),frequency:parameter(),Q:parameter()};},createBufferSource(){const n={...playable(),playbackRate:parameter()};sources.push(n);return n;},createOscillator(){const n={...playable(),frequency:parameter()};oscillators.push(n);return n;}};
 const sampleLoader=async(url)=>{requests.push(String(url));if(fail)throw Error('offline');const data=new Float32Array(800);data.fill(.25,64);return {name:String(url).split('/').at(-1),sampleRate:48000,getChannelData:()=>data};};
 const piano=createPianoSound({contextFactory:()=>context,sampleLoader});return {piano,context,oscillators,sources,gains,requests,get resumes(){return resumes;}};
}
test('recorded piano begins at the exact key-down with leading silence trimmed and a short release',async()=>{
 const f=fixture();f.piano.configure({enabled:true,volume:18});assert.ok(await f.piano.prepare());assert.equal(f.resumes,1);assert.equal(f.requests.length,6);
 f.piano.play({midi:60,hold:2});assert.equal(f.sources.length,1);assert.equal(f.oscillators.length,0);assert.equal(f.sources[0].starts[0][0],12);assert.ok(f.sources[0].starts[0][1]>0);assert.equal(f.sources[0].buffer.name,'C4.mp3');assert.equal(f.sources[0].playbackRate.events[0][1],1);assert.equal(f.sources[0].stops[0],14.01);
 f.piano.play({midi:61});assert.equal(f.sources[1].stops[0],12.51);assert.ok(f.sources[1].playbackRate.events[0][1]>1);
 f.piano.play({midi:69,float:true});assert.equal(f.oscillators.length,3);assert.equal(f.oscillators[0].frequency.events[0][1],880);assert.ok(f.oscillators.every(o=>o.stops[0]<12.4));
});
test('chords attenuate the combined bus and OFF/zero volume prevent new sampled voices',async()=>{
 const f=fixture();await f.piano.prepare();for(const midi of [62,65,69])f.piano.play({midi});const master=f.gains[0].gain.events;
 assert.ok(master.at(-1)[1]<master.find(e=>e[0]==='target'&&e[1]>0)[1]);f.piano.configure({enabled:false,volume:18});const count=f.sources.length;assert.equal(f.piano.play({midi:62}),false);assert.equal(f.sources.length,count);
 f.piano.configure({enabled:true,volume:0});assert.equal(f.piano.play({midi:62}),false);assert.equal(f.gains[0].gain.events.at(-1)[1],0);
});
test('loading or failed samples never queue a late key-down or fall back to the rubber-like oscillator',async()=>{
 const f=fixture();assert.equal(f.piano.play({midi:62}),false);assert.equal(f.sources.length,0);await f.piano.prepare();assert.equal(f.sources.length,0);assert.equal(f.piano.play({midi:62}),true);assert.equal(f.sources[0].starts[0][0],12);
 const broken=fixture({fail:true});assert.equal(await broken.piano.prepare(),false);assert.equal(broken.piano.play({midi:62}),false);assert.equal(broken.sources.length,0);assert.equal(broken.oscillators.length,0);
});
test('score pitches and octaves come from the imported timed notes, independently of key lane',()=>{
 const raw=[{t:1,lane:0},{t:2,lane:0},{t:1,lane:4}],chart=pianoTrialChart(SONGS[0],raw,TEST_SCORE);
 assert.deepEqual(raw,[{t:1,lane:0},{t:2,lane:0},{t:1,lane:4}]);assert.equal(chart[2].soundMidi,69);assert.equal(chart[0].soundMidi,50);assert.equal(chart[1].soundMidi,65);
 assert.equal(pianoTrialChart(SONGS[0],raw),raw);for(const song of SONGS){const mapped=pianoTrialChart(song,raw,TEST_SCORE);assert.equal(mapped[2].soundMidi,69,song.id);assert.equal(mapped[1].soundMidi,65,song.id);assert.equal(pianoTrialChart(song,raw),raw);}
 const events=[[1000,0,1],[1000,4,1],[1020,0,0],[1020,4,0],[2000,0,1],[2020,0,0]];assert.deepEqual(scoreChartReplay(chart,3,events),scoreChartReplay(raw,3,events));
});
test('score matching respects rests instead of looping harmony or borrowing distant notes',()=>{
 const voice=[[100,200,60,12],[400,700,65,12]];assert.equal(scoreNoteAt(voice,150),voice[0]);assert.equal(scoreNoteAt(voice,240),voice[0]);assert.equal(scoreNoteAt(voice,300),null);assert.equal(scoreNoteAt(voice,350),voice[1]);assert.equal(scoreNoteAt(voice,800),null);
 assert.equal(pianoTrialChart(SONGS[0],[{t:180,lane:0}],TEST_SCORE)[0].soundMidi,undefined);
});

test('sample playback preserves a source pitch above C6 instead of clipping it to C6',async()=>{const f=fixture();await f.piano.prepare();f.piano.play({midi:89});assert.equal(f.sources[0].playbackRate.events[0][1],2**((89-78)/12));});
