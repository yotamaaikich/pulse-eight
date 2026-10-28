import {SONG_PIANO_NOTES} from './song-piano-data.mjs?v=source-piano-15';

// Pitches belong to source timestamps, independently of the eight key lanes.
// These are audio-derived harmony estimates, not a complete melody transcription.
const ORIGINS=['audio-harmony','confirmed-vocal','stable-vocal','carried-harmony'];
function sourceAt(id,ms){
  const rows=SONG_PIANO_NOTES[id];if(!rows?.length)return null;
  let low=0,high=rows.length;
  while(low<high){const mid=(low+high)>>1;if(rows[mid][0]<ms)low=mid+1;else high=mid;}
  const before=rows[low-1],after=rows[low];
  return !before?after:!after?before:ms-before[0]<=after[0]-ms?before:after;
}
export function pianoFeedbackAt(song,time,lane=0){
  const row=sourceAt(song.id,Math.max(0,time)*1000);
  if(!row)return null;
  return {midi:row[lane<4?2:1],velocity:row[3]===3?.45:.65};
}
export function applySourcePiano(song,chart){
  const result=chart.map(n=>({...n})),groups=new Map();
  for(const n of result)if(!n.assist){if(!groups.has(n.t))groups.set(n.t,[]);groups.get(n.t).push(n);}
  for(const group of groups.values()){
    for(const [index,n] of [...group].sort((a,b)=>b.lane-a.lane).entries()){
      if(Number.isFinite(n.soundMidi))continue;
      const row=sourceAt(song.id,n.sourceMs??Math.round(n.t*1000));if(!row)continue;
      Object.assign(n,{soundMidi:row[index?2:1],soundOrigin:ORIGINS[row[3]],soundSourceStart:row[0],soundVelocity:row[3]===1?1:row[3]===3?.55:.75});
    }
  }
  return result;
}
