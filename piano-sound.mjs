// Recorded Salamander Grand Piano / Alexander Holm / CC BY 3.0.
// See audio/piano/CREDITS.txt. FLOAT retains a separate short chime.
const SAMPLES=[['C3',48],['Fs3',54],['C4',60],['Fs4',66],['C5',72],['Fs5',78]];
export function createPianoSound({contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'}),sampleLoader=async(url,ctx)=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Piano sample unavailable');return ctx.decodeAudioData(await response.arrayBuffer());
}}={}){
  let context=null,master=null,enabled=true,volume=18,loading=null;
  const voices=new Set(),samples=new Map();
  function mix(){if(master)master.gain.setTargetAtTime(enabled?volume/100*.65/Math.sqrt(Math.max(1,voices.size)):0,context.currentTime,.004);}
  function warm(){
    if(!enabled||!volume)return false;
    try{
      if(!context){
        context=contextFactory();master=context.createGain();master.gain.value=0;
        const compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=10;compressor.ratio.value=3;compressor.attack.value=.001;compressor.release.value=.06;
        master.connect(compressor);compressor.connect(context.destination);mix();
      }
      if(context.state==='suspended')context.resume().catch(()=>{});
      if(!loading)loading=Promise.all(SAMPLES.map(async([name,midi])=>{
        const buffer=await sampleLoader(new URL('./audio/piano/'+name+'.mp3',import.meta.url),context);
        let offset=0;
        if(buffer.getChannelData){const data=buffer.getChannelData(0),limit=Math.min(data.length,Math.floor(buffer.sampleRate*.15));for(let i=0;i<limit;i++)if(Math.abs(data[i])>.002){offset=Math.max(0,(i-32)/buffer.sampleRate);break;}}
        samples.set(midi,{buffer,offset});
      })).then(()=>true).catch(()=>false);
      return true;
    }catch{return false;}
  }
  async function prepare(){return warm()?await loading:false;}
  function stop(){for(const voice of [...voices])voice.stop();mix();}
  function configure(options){enabled=options.enabled===true;volume=Math.max(0,Math.min(100,Number(options.volume)||0));if(!enabled||!volume)stop();mix();}
  function play({midi=62,hold=0,float=false}={}){
    if(!enabled||!volume||!Number.isFinite(midi)||!warm())return false;
    // Never enqueue a key-down while loading: a late note would feel like key-up sound.
    if(!float&&samples.size!==SAMPLES.length)return false;
    while(voices.size>=16)voices.values().next().value.stop();
    const now=context.currentTime,nodes=[];let stopped=false,remaining=float?3:1;
    const voice={stop(){if(stopped)return;stopped=true;for(const {source,gain}of nodes){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setTargetAtTime(.00001,context.currentTime,.005);try{source.stop(context.currentTime+.025);}catch{}}voices.delete(voice);mix();}};
    voices.add(voice);mix();
    function ended(source,gain,filter){source.onended=()=>{source.disconnect();gain.disconnect();filter?.disconnect();if(--remaining===0){voices.delete(voice);mix();}};nodes.push({source,gain});}
    if(float){
      const frequency=440*2**((Math.max(36,Math.min(96,midi))-69)/12);
      for(const [multiple,amplitude,decay]of [[2,.28,.22],[3,.16,.18],[4.17,.08,.12]]){
        const source=context.createOscillator(),gain=context.createGain();source.type='sine';source.frequency.setValueAtTime(frequency*multiple,now);source.connect(gain);gain.connect(master);
        gain.gain.setValueAtTime(.00001,now);gain.gain.linearRampToValueAtTime(amplitude,now+.002);gain.gain.exponentialRampToValueAtTime(.00001,now+decay);ended(source,gain);source.start(now);source.stop(now+decay+.015);
      }
    }else{
      const pitch=Math.max(48,Math.min(84,midi)),root=SAMPLES.reduce((a,b)=>Math.abs(b[1]-pitch)<Math.abs(a[1]-pitch)?b:a)[1];
      const {buffer,offset}=samples.get(root),source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
      source.buffer=buffer;source.playbackRate.setValueAtTime(2**((pitch-root)/12),now);
      filter.type='highpass';filter.frequency.value=75;filter.Q.value=.55;source.connect(filter);filter.connect(gain);gain.connect(master);
      const duration=hold>0?Math.min(2.4,Math.max(.9,hold)):.5;
      gain.gain.setValueAtTime(.00001,now);gain.gain.linearRampToValueAtTime(1,now+.001);gain.gain.setValueAtTime(1,now+duration-.09);gain.gain.exponentialRampToValueAtTime(.00001,now+duration);
      ended(source,gain,filter);source.start(now,offset);source.stop(now+duration+.01);
    }
    return true;
  }
  return {warm,prepare,play,stop,configure};
}
