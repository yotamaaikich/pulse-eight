// Small procedural piano/chime voices. No remote samples or audio downloads.
export function createPianoSound({contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'})}={}){
  let context=null,master=null,compressor=null,enabled=true,volume=18;
  const voices=new Set();
  function mix(){if(master)master.gain.setTargetAtTime(enabled?volume/100*.5/Math.sqrt(Math.max(1,voices.size)):0,context.currentTime,.008);}
  function warm(){
    if(!enabled||volume===0)return false;
    try{
      if(!context){context=contextFactory();master=context.createGain();master.gain.value=0;compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=10;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.08;master.connect(compressor);compressor.connect(context.destination);mix();}
      if(context.state==='suspended')context.resume().catch(()=>{});
      return true;
    }catch{return false;}
  }
  function stop(){for(const voice of [...voices])voice.stop();mix();}
  function configure(options){enabled=options.enabled===true;volume=Math.max(0,Math.min(100,Number(options.volume)||0));if(!enabled||!volume)stop();mix();}
  function play({midi=62,hold=0,float=false}={}){
    if(!enabled||!volume||!Number.isFinite(midi)||!warm())return false;
    while(voices.size>=16)voices.values().next().value.stop();
    const now=context.currentTime,frequency=440*2**((Math.max(36,Math.min(96,midi))-69)/12);
    const duration=float?.34:Math.min(2.8,hold>0?Math.max(1.1,hold):.75);
    const parts=float?[[2,.28,.22],[3,.16,.18],[4.17,.08,.12]]:[[1,.62,duration],[2.002,.23,duration*.6],[3.01,.1,duration*.35],[4.025,.05,duration*.2]];
    const nodes=[];let stopped=false,remaining=parts.length;
    const voice={stop(){if(stopped)return;stopped=true;for(const {osc,gain}of nodes){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setTargetAtTime(.00001,context.currentTime,.006);try{osc.stop(context.currentTime+.03);}catch{}}voices.delete(voice);mix();}};
    voices.add(voice);mix();
    for(const [multiple,amplitude,decay]of parts){
      const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency*multiple,now);osc.connect(gain);gain.connect(master);
      gain.gain.setValueAtTime(.00001,now);gain.gain.linearRampToValueAtTime(amplitude,now+.003);gain.gain.exponentialRampToValueAtTime(.00001,now+Math.max(.03,decay));
      osc.onended=()=>{osc.disconnect();gain.disconnect();if(--remaining===0){voices.delete(voice);mix();}};
      nodes.push({osc,gain});osc.start(now);osc.stop(now+Math.max(.03,decay)+.015);
    }
    return true;
  }
  return {warm,play,stop,configure};
}
