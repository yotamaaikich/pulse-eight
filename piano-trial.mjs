export const PIANO_TRIAL_SONG='monitoring';
// Follow actual pitched notes in the reference score, never a generated chord cycle.
// Nearby endings/attacks tolerate the simplified chart's rounding. Longer rests stay silent.
export function scoreNoteAt(voice,timeMs,tolerance=75){
  let low=0,high=voice.length;
  while(low<high){const mid=(low+high)>>1;if(voice[mid][0]<=timeMs)low=mid+1;else high=mid;}
  const previous=voice[low-1],next=voice[low];
  if(previous&&timeMs>=previous[0]&&timeMs<previous[1])return previous;
  const before=previous?timeMs-previous[1]:Infinity,after=next?next[0]-timeMs:Infinity;
  if(Math.min(before,after)>tolerance)return null;
  return before<=after?previous:next;
}
function playablePitch(midi){while(midi<48)midi+=12;while(midi>84)midi-=12;return midi;}
export function pianoTrialChart(song,chart,profile=null){
  if(song.id!==PIANO_TRIAL_SONG||!profile)return chart;
  const result=chart.map(n=>{const copy={...n};for(const key of ['soundMidi','soundOriginalMidi','soundSourceStart','soundSourceEnd','soundVoice'])delete copy[key];return copy;}),groups=new Map();
  for(const n of result)if(!n.assist){if(!groups.has(n.t))groups.set(n.t,[]);groups.get(n.t).push(n);}
  for(const [time,group]of groups){
    const at=Math.round(time*1000)-(profile.offsetMs||0),used=new Set();
    const candidates=profile.voices.map((voice,index)=>({note:scoreNoteAt(voice,at),index})).filter(x=>x.note);
    // Rightmost key takes the main melodic voice; other keys use available score voices.
    for(const n of [...group].sort((a,b)=>b.lane-a.lane)){
      const candidate=candidates.find(x=>!used.has(playablePitch(x.note[2])));if(!candidate)continue;
      const [start,end,midi]=candidate.note,soundMidi=playablePitch(midi);used.add(soundMidi);
      Object.assign(n,{soundMidi,soundOriginalMidi:midi,soundSourceStart:start,soundSourceEnd:end,soundVoice:candidate.index});
    }
  }
  return result;
}
