import test from 'node:test';
import assert from 'node:assert/strict';
import {createPiano} from '../piano.mjs';

test('short taps retain a piano attack and release tail, with silent zero volume and polyphony',()=>{
  const sources=[],gains=[];
  class Param{constructor(){this.value=0;this.calls=[];}setValueAtTime(...v){this.calls.push(['set',...v]);}linearRampToValueAtTime(...v){this.calls.push(['linear',...v]);}exponentialRampToValueAtTime(...v){this.calls.push(['exp',...v]);}cancelAndHoldAtTime(...v){this.calls.push(['hold',...v]);}setTargetAtTime(...v){this.calls.push(['target',...v]);}}
  const node=()=>({gain:new Param(),frequency:new Param(),detune:new Param(),Q:new Param(),connect(){},disconnect(){},setPeriodicWave(){},start(){},stop(t){this.stopAt=t;},addEventListener(){}});
  let audio;
  globalThis.AudioContext=class{constructor(){audio=this;this.currentTime=0;this.sampleRate=48000;this.destination={};}resume(){return Promise.resolve();}createGain(){const n=node();gains.push(n);return n;}createDynamicsCompressor(){return {...node(),threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param()};}createPeriodicWave(){return {};}createBuffer(ch,n){return {getChannelData:()=>new Float32Array(n)};}createBiquadFilter(){return node();}createOscillator(){const n=node();sources.push(n);return n;}createBufferSource(){return node();}};
  try{
    let volume=30;const piano=createPiano(()=>volume);piano.start(0);piano.start(7);
    assert.equal(sources.length,6);assert.ok(sources[3].frequency.value>sources[0].frequency.value);
    audio.currentTime=.01;piano.stop(0);
    assert.ok(sources[0].stopAt>=.8,'quick releases preserve an audible body and tail');
    assert.ok(gains.some(n=>n.gain.calls.some(c=>c[0]==='hold'&&c[1]===.18)));
    volume=0;piano.start(1);assert.equal(sources.length,6,'explicit mute stays silent');
    audio.currentTime=1;piano.stopAll();assert.equal(sources[3].stopAt,1.65);
  }finally{delete globalThis.AudioContext;}
});
