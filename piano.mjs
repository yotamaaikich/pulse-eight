const MIDI=[60,62,64,65,67,69,71,72];
// A quiet, damped harmonic tone; no external audio assets are needed.
export function createPiano(volume){
  let context=null,output=null;const voices=new Map();
  function unlock(){
    try{
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
      if(!context){context=new Audio();output=context.createGain();output.connect(context.destination);}
      context.resume().catch(()=>{});
    }catch{/* The game remains playable without Web Audio. */}
  }
  function stop(lane){
    const voice=voices.get(lane);if(!voice||!context)return;voices.delete(lane);
    const now=context.currentTime;voice.envelope.gain.cancelScheduledValues(now);voice.envelope.gain.setTargetAtTime(0,now,.045);
    for(const oscillator of voice.oscillators)oscillator.stop(now+.3);
  }
  function start(lane){
    unlock();if(!context||!output||volume()<=0)return;stop(lane);
    const now=context.currentTime,envelope=context.createGain(),oscillators=[];
    envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(.13*volume()/100,now+.006);envelope.gain.exponentialRampToValueAtTime(.001,now+2.6);envelope.connect(output);
    const frequency=440*2**((MIDI[lane]-69)/12);
    [1,.32,.13,.05].forEach((weight,index)=>{
      const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency*(index+1);gain.gain.value=weight;oscillator.connect(gain);gain.connect(envelope);oscillator.start(now);oscillator.stop(now+3);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillators.push(oscillator);
    });
    const voice={envelope,oscillators};voices.set(lane,voice);oscillators[0].addEventListener('ended',()=>{if(voices.get(lane)===voice)voices.delete(lane);envelope.disconnect();},{once:true});
  }
  return {unlock,start,stop,stopAll(){for(const lane of [...voices.keys()])stop(lane);}};
}
