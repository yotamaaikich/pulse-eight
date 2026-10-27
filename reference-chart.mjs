// Device-local monitoring score practice. Every note retains a source attack and pitch.
export function referenceChart(song,difficulty,profile){
  if(song.id!=='monitoring'||!profile?.voices?.[0])return null;
  const offset=(profile.offsetMs||0)/1000,lead=profile.voices[0],chart=[],busy=Array(8).fill(-1);
  const whites=[0,2,4,5,7,9,11,12];let last=-Infinity,lastFloat=-Infinity;
  function laneFor(midi){const pitch=((midi%12)+12)%12;return whites.reduce((a,b,i)=>Math.abs(b-pitch)<Math.abs(whites[a]-pitch)?i:a,0);}
  for(let index=0;index<lead.length;index++){
    const [start,end,midi]=lead[index],t=Math.round(start+offset*1000)/1000;
    // The lead track also contains low percussion cues; these are not melody notes.
    if(midi<48||t<.2||t>song.duration-.3||t-last<([.22,.09,.04][difficulty]))continue;
    let lane=laneFor(midi);if(t<busy[lane]+.045){lane=busy.findIndex(at=>t>=at+.045);if(lane<0)continue;}
    const next=lead.slice(index+1).find(n=>n[2]>=48),nextAt=next?next[0]/1000+offset:song.duration;
    const endAt=Math.min(end/1000+offset,nextAt-.045,song.duration-.1);
    const note={t,lane,degree:lane,assist:false,soundMidi:midi,soundOriginalMidi:midi,soundSourceStart:start,soundSourceEnd:end,soundVoice:0};
    if(endAt-t>=.4)note.end=Math.round(endAt*1000)/1000;
    // Isolated FLOATs only, with time to release Space and the lane key.
    if(difficulty===2&&!note.end&&t>8&&t<song.duration-6&&t-lastFloat>6&&nextAt-t>.45){note.flick=true;lastFloat=t;}
    busy[lane]=note.end??(note.flick?t+.39:t);chart.push(note);last=t;
    // Chords use an actual accompanying attack, never a sustained or nearest note.
    if(difficulty>0){for(let voice=1;voice<profile.voices.length;voice++){
      const source=profile.voices[voice].find(n=>Math.abs(n[0]-start)<=1&&n[2]>=48&&n[2]!==midi);if(!source)continue;
      const other=laneFor(source[2]);if(other===lane||t<busy[other]+.045)continue;
      chart.push({t,lane:other,degree:other,assist:false,chord:true,soundMidi:source[2],soundOriginalMidi:source[2],soundSourceStart:source[0],soundSourceEnd:source[1],soundVoice:voice});note.chord=true;busy[other]=t;break;
    }}
  }
  return chart.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
