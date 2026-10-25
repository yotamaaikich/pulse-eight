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
    volume=30;piano.start(2);
    // Simulate a browser without cancelAndHoldAtTime on the new voice.
    const voiceEnvelope=gains.findLast(n=>n.gain.calls.some(c=>c[0]==='linear'));
    voiceEnvelope.gain.cancelAndHoldAtTime=undefined;
    voiceEnvelope.gain.cancelScheduledValues=()=>{};
    audio.currentTime=1.5;const count=sources.length;piano.stop(2);
    assert.equal(sources.length,count,'release creates no new oscillator');
    const release=voiceEnvelope.gain.calls.findLast(c=>c[0]==='set');
    assert.ok(release[1]<.65*.3*.56,'release never jumps above the already decaying note');
    piano.start(0,66);assert.ok(Math.abs(sources.at(-1).frequency.value-440*2**((66-69)/12))<.001,'the same lane can play an explicit chart pitch');
  }finally{delete globalThis.AudioContext;}
});
