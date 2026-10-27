// Independent accompaniment voicing, not a transcription of the original melody.
// Reference: https://ja.chordwiki.org/wiki/モニタリング（DECO27）
export const PIANO_TRIAL_SONG='monitoring';
const HARMONY=[[58,62,65],[57,61,64],[50,53,57],[50,53,57]];
export function pianoTrialChart(song,chart){
  if(song.id!==PIANO_TRIAL_SONG)return chart;
  const used=new Map();
  return chart.map(n=>{
    if(n.assist)return {...n};
    const beat=Math.max(0,(n.t-song.offset)/(60/song.bpm)),chord=HARMONY[Math.floor(beat/4)%HARMONY.length];
    const candidates=[];for(const root of chord)for(let octave=-1;octave<=2;octave++){const midi=root+octave*12;if(midi>=48&&midi<=79)candidates.push(midi);}
    const target=55+n.lane*2,occupied=used.get(n.t)||new Set();
    candidates.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b);
    const soundMidi=candidates.find(m=>!occupied.has(m))??candidates[0];occupied.add(soundMidi);used.set(n.t,occupied);
    return {...n,soundMidi};
  });
}
