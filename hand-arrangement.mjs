import {chartAttacks} from './audio-chart.mjs?v=arrangement-12';

// A musical phrase has one lead hand. The opposite hand plays the sparse
// accent/held line; changing the lead is a hand-off, never a rapid hand split.
export function arrangeHands(song,chart){
 const result=chart.map(n=>({...n})),groups=[...Map.groupBy(result,n=>n.t).values()];
 const contours=new Map(chartAttacks(song.id).map(row=>[row[0],row[1]])),beat=60/song.bpm;
 const phrases=[];let phrase=[],start=0,previous=null;
 for(const group of groups){
  const head=group.find(n=>Object.hasOwn(n,'phraseStart'))??group[0],t=head.t;
  const elapsed=t-start,gap=previous?t-previous.t:0;
  const boundary=phrase.length&&elapsed>=Math.max(3,beat*8)&&(
   head.phraseStart||gap>=beat*1.5||previous.phraseEnd&&gap>=beat*.35||elapsed>=beat*16&&gap>=beat*.55);
  if(boundary){phrases.push(phrase);phrase=[];}
  if(!phrase.length)start=t;phrase.push(group);previous=head;
 }
 if(phrase.length)phrases.push(phrase);
 const busy=Array(8).fill(-Infinity),last=Array(2).fill(-1),runs=Array(2).fill(0);
 for(const [index,groups]of phrases.entries()){
  const hand=index%2?0:1,offset=hand*4,supportOffset=(1-hand)*4;
  const ranks=[...new Set(groups.map(g=>contours.get(g[0].sourceMs)??0))].sort((a,b)=>a-b);
  let supportKey=1,nextMove=-Infinity;
  for(const group of groups){
   // Preserve the existing pitch/voice assignment before relocating any key.
   [...group].sort((a,b)=>b.lane-a.lane).forEach((n,i)=>n.pianoOrder=i);
   const primary=group.find(n=>Object.hasOwn(n,'phraseStart'))??group[0];
   const melody=primary.end?group.find(n=>n!==primary&&!n.end):primary;
   const contour=contours.get(primary.sourceMs)??0;
   for(const n of [...group].sort((a,b)=>Number(b===melody)-Number(a===melody))){
    const lead=n===melody,base=lead?offset:supportOffset;
    const rank=ranks.indexOf(contour),target=lead?(ranks.length>1?Math.round(rank*3/(ranks.length-1)):1):supportKey;
    if(!lead&&n.t>=nextMove){
     const goal=contour>=4?2:1;supportKey+=Math.sign(goal-supportKey);nextMove=n.t+beat*2;
    }
    const aim=lead?target:supportKey;
    let options=Array.from({length:4},(_,i)=>base+i).filter(lane=>n.t>=busy[lane]+.06-1e-9);
    if(lead&&runs[hand]>=2&&options.length>1)options=options.filter(lane=>lane!==last[hand]);
    options.sort((a,b)=>Math.abs(a-base-aim)-Math.abs(b-base-aim)||a-b);
    if(!options.length)throw Error(song.id+': no free key in '+(lead?'melody':'support')+' hand at '+n.t);
    const lane=options[0];Object.assign(n,{lane,degree:lane,part:lead?'melody':'support',melodyHand:hand,handPhrase:index});
    busy[lane]=n.end??(n.flick?n.t+.39:n.t);
    if(lead){runs[hand]=last[hand]===lane?runs[hand]+1:1;last[hand]=lane;}
   }
  }
 }
 return result.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
