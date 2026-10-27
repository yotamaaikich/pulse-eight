import {MONITORING_ATTACKS,MONITORING_VOCAL_ANALYSIS} from './monitoring-vocal.mjs?v=library-review-11';
import {AUDIO_ATTACKS,AUDIO_SOURCES} from './audio-attacks.mjs?v=library-review-11';
export {AUDIO_SOURCES};
export const chartAttacks=id=>id==='monitoring'?MONITORING_ATTACKS:AUDIO_ATTACKS[id];
export const vocalAnalysis=MONITORING_VOCAL_ANALYSIS;
// [source attack ms, spatial contour, tonal sustain ms, flags, salience].
// Difficulty removes attacks; it never fills a regular grid or loops a lane motif.
export function makeAudioChart(song,difficulty){
 const source=chartAttacks(song.id);if(!source)throw Error('この曲の譜面はまだ作成されていません。');
 const gap=[285,155,95][difficulty],chosen=[];
 const scores=source.map(n=>n[4]).sort((a,b)=>a-b),cutoff=scores[Math.floor(scores.length*[.36,.14,0][difficulty])];
 const reviewed=song.id!=='monitoring',beat=60/song.bpm;
 const chordGap=reviewed?(difficulty===1?Math.max(.75,Math.min(1.9,beat*2)):Math.max(.4,Math.min(.95,beat))):(difficulty===1?1.7:.9);
 const priority=n=>n[4]+((n[3]&12)?45:0)+((n[3]&64)?400:0)+(reviewed&&(n[3]&1)?30:0);
 for(const row of [...source].sort((a,b)=>priority(b)-priority(a)||a[0]-b[0])){
  if(row[4]<cutoff&&!(row[3]&12))continue;
  if(chosen.every(n=>Math.abs(n[0]-row[0])>=gap))chosen.push(row);
 }
 chosen.sort((a,b)=>a[0]-b[0]);
 const notes=[],busy=Array(8).fill(-1),recent=[];let lastHold=-Infinity,lastChord=-Infinity;
 for(const [index,row] of chosen.entries()){
  const [ms,contour,sustain,flags,salience]=row,t=ms/1000;
  if(t<.3||t>song.duration-.4)continue;
  let lane=contour;
  {
   // Distribute the local melodic contour over the keyboard. Pitch-to-sound
   // remains separate; mapping every pitch class to a key left the edges idle.
   const context=chosen.slice(Math.max(0,index-5),index+6).map(r=>r[1]);
   const ranks=[...new Set(context)].sort((a,b)=>a-b),rank=ranks.indexOf(contour);
   lane=ranks.length>1?Math.round(rank*7/(ranks.length-1)):contour;
   // Keep occasional same-key repeats, then answer with the other hand.
   if(recent.length>=2&&recent.at(-1)===lane&&recent.at(-2)===lane)lane=7-lane;
  }
  if(t<busy[lane]+.06){
   const target=reviewed?lane:contour;
   const options=Array.from({length:8},(_,i)=>i).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target));
   lane=options.find(i=>t>=busy[i]+.06);if(lane===undefined)continue;
  }
  // Holds can occupy the mirrored answer key. Recheck after relocating so
  // that resolving occupancy does not recreate a long unplanned jack run.
  if(reviewed&&recent.at(-1)===lane&&recent.at(-2)===lane){
   const options=Array.from({length:8},(_,i)=>i).filter(i=>i!==lane&&t>=busy[i]+.06).sort((a,b)=>Math.abs(a-lane)-Math.abs(b-lane));
   if(options.length)lane=options[0];
  }
  const n={t,lane,degree:lane,assist:false,sourceMs:ms,phraseStart:!!(flags&4),phraseEnd:!!(flags&8),vocalPhrase:!!(flags&16)};
  if(sustain>=400&&t-lastHold>2.5){n.end=Math.min(song.duration-.2,(ms+sustain)/1000);lastHold=t;}
  busy[lane]=n.end??t;notes.push(n);recent.push(lane);
  // Two hands emphasize a real multi-band accent, rather than every nth note.
  if(difficulty>0&&(flags&1)&&t-lastChord>chordGap){
   const direction=(chosen[index+1]?.[1]??contour)-contour;
   const options=Array.from({length:4},(_,i)=>lane<4?4+i:i).sort((a,b)=>{
    const target=direction>0?(lane<4?4:3):direction<0?(lane<4?7:0):7-lane;
    return Math.abs(a-target)-Math.abs(b-target);
   });
   const other=options.find(i=>t>=busy[i]+.08);
   if(other!==undefined){notes.push({t,lane:other,degree:other,assist:false,sourceMs:ms,chord:true});n.chord=true;busy[other]=t;lastChord=t;}
  }
  if(difficulty===2&&!n.end&&t>=8&&t<song.duration-6&&((flags&2)||(flags&1)))n.flick=true;
 }
 return notes.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
