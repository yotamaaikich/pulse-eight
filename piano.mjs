const MIDI=[60,62,64,65,67,69,71,72];
// Locally synthesized struck strings and a short hammer transient.
export function createPiano(volume){
  let context=null,output=null,wave=null,hammer=null;const voices=new Map();
  function unlock(){
    try{
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
      if(!context){
        context=new Audio({latencyHint:'interactive'});output=context.createGain();
        const limiter=context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=15;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.15;output.connect(limiter);limiter.connect(context.destination);
        const real=new Float32Array(10),imag=new Float32Array([0,1,.45,.23,.13,.08,.045,.027,.016,.009]);wave=context.createPeriodicWave(real,imag);
        hammer=context.createBuffer(1,Math.ceil(context.sampleRate*.025),context.sampleRate);const data=hammer.getChannelData(0);let seed=1973;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=((seed/4294967296)*2-1)*Math.exp(-i/(context.sampleRate*.004));}
      }
      context.resume().catch(()=>{});
    }catch{/* Audio may be unavailable on this device. */}
  }
  function stop(lane,immediate=false){
    const voice=voices.get(lane);if(!voice||!context)return;voices.delete(lane);
    const releaseAt=immediate?context.currentTime:Math.max(context.currentTime,voice.started+.18);
    if(voice.envelope.gain.cancelAndHoldAtTime)voice.envelope.gain.cancelAndHoldAtTime(releaseAt);
    else{voice.envelope.gain.cancelScheduledValues(releaseAt);voice.envelope.gain.setValueAtTime(voice.level*Math.exp(-Math.max(0,releaseAt-voice.started)*1.35),releaseAt);}
    voice.envelope.gain.setTargetAtTime(0,releaseAt,.12);
    for(const source of voice.sources)source.stop(releaseAt+.65);
  }
  function start(lane){
    if(!Number.isInteger(lane)||lane<0||lane>=MIDI.length)return;
    unlock();const level=Math.max(0,Math.min(100,Number(volume())||0))/100*.65;if(!context||!output||!wave||!level)return;stop(lane,true);
    const now=context.currentTime,envelope=context.createGain(),filter=context.createBiquadFilter(),sources=[];
    envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(level,now+.004);envelope.gain.exponentialRampToValueAtTime(level*.56,now+.18);envelope.gain.exponentialRampToValueAtTime(.0001,now+3.4);
    filter.type='lowpass';filter.frequency.setValueAtTime(6500,now);filter.frequency.exponentialRampToValueAtTime(1300,now+1.3);filter.Q.value=.35;filter.connect(envelope);envelope.connect(output);
    const frequency=440*2**((MIDI[lane]-69)/12);
    [0,-3,3].forEach((detune,index)=>{const oscillator=context.createOscillator(),gain=context.createGain();oscillator.setPeriodicWave(wave);oscillator.frequency.value=frequency;oscillator.detune.value=detune;gain.gain.value=[.62,.19,.19][index];oscillator.connect(gain);gain.connect(filter);oscillator.start(now);oscillator.stop(now+3.6);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};sources.push(oscillator);});
    const noise=context.createBufferSource(),noiseGain=context.createGain();noise.buffer=hammer;noiseGain.gain.value=.11;noise.connect(noiseGain);noiseGain.connect(filter);noise.start(now);noise.stop(now+.03);noise.onended=()=>{noise.disconnect();noiseGain.disconnect();};sources.push(noise);
    const voice={envelope,sources,started:now,level};voices.set(lane,voice);sources[0].addEventListener('ended',()=>{if(voices.get(lane)===voice)voices.delete(lane);filter.disconnect();envelope.disconnect();},{once:true});
  }
  return {unlock,start,stop:lane=>stop(lane),stopAll(){for(const lane of [...voices.keys()])stop(lane,true);}};
}
