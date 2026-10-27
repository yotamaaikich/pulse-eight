import {MONITORING_ATTACKS,MONITORING_VOCAL_ANALYSIS} from './monitoring-vocal.mjs';
import {AUDIO_ATTACKS,AUDIO_SOURCES} from './audio-attacks.mjs';
export {AUDIO_SOURCES};
export const chartAttacks=id=>id==='monitoring'?MONITORING_ATTACKS:AUDIO_ATTACKS[id];
export const vocalAnalysis=MONITORING_VOCAL_ANALYSIS;
// [source attack ms, spatial contour, tonal sustain ms, flags, salience].
// Difficulty removes attacks; it never fills a regular grid or loops a lane motif.
export function makeAudioChart(song,difficulty){
 const source=chartAttacks(song.id);if(!source)throw Error('この曲の譜面はまだ作成されていません。');
 const gap=[285,155,95][difficulty],chosen=[];
 const scores=source.map(n=>n[4]).sort((a,b)=>a-b),cutoff=scores[Math.floor(scores.length*[.36,.14,0][difficulty])];
 for(const row of [...source].sort((a,b)=>(b[4]+((b[3]&12)?45:0))-(a[4]+((a[3]&12)?45:0))||a[0]-b[0])){
  if(row[4]<cutoff&&!(row[3]&12))continue;
  if(chosen.every(n=>Math.abs(n[0]-row[0])>=gap))chosen.push(row);
 }
 chosen.sort((a,b)=>a[0]-b[0]);
 const notes=[],busy=Array(8).fill(-1);let lastHold=-Infinity,lastChord=-Infinity;
 for(const row of chosen){
  const [ms,contour,sustain,flags,salience]=row,t=ms/1000;
  if(t<.3||t>song.duration-.4)continue;
  let lane=contour;
  if(t<busy[lane]+.06){
   const options=Array.from({length:8},(_,i)=>i).sort((a,b)=>Math.abs(a-contour)-Math.abs(b-contour));
   lane=options.find(i=>t>=busy[i]+.06);if(lane===undefined)continue;
  }
  const n={t,lane,degree:lane,assist:false,sourceMs:ms,phraseStart:!!(flags&4),phraseEnd:!!(flags&8),vocalPhrase:!!(flags&16)};
  if(sustain>=400&&t-lastHold>2.5){n.end=Math.min(song.duration-.2,(ms+sustain)/1000);lastHold=t;}
  busy[lane]=n.end??t;notes.push(n);
  // Two hands emphasize a real multi-band accent, rather than every nth note.
  if(difficulty>0&&(flags&1)&&t-lastChord>(difficulty===1?1.7:.9)){
   const other=(lane+4)%8;if(t>=busy[other]+.08){notes.push({t,lane:other,degree:other,assist:false,sourceMs:ms,chord:true});n.chord=true;busy[other]=t;lastChord=t;}
  }
  if(difficulty===2&&!n.end&&t>=8&&t<song.duration-6&&((flags&2)||(flags&1)))n.flick=true;
 }
 return notes.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
