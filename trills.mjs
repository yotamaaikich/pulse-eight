import {TRILL_PHRASES,TRILL_CONTOURS} from './trill-data.mjs?v=trills-17';
import {chartAttacks} from './audio-chart.mjs?v=arrangement-12';
const features=new Map(Object.entries(TRILL_CONTOURS).map(([id,rows])=>[id,new Map(rows.map(r=>[r[0],r.slice(1)]))]));
const median=values=>{const v=values.toSorted((a,b)=>a-b),i=v.length>>1;return v.length%2?v[i]:(v[i-1]+v[i])/2;};
function shiftsFor(id,notes,moving){
 const data=features.get(id),fallback=new Map((chartAttacks(id)??[]).map(r=>[r[0],r[1]]));
 const shifts=[];let previous=null,shift=0;
 for(let i=0;i<notes.length;i+=4){
  const values=notes.slice(i,i+4).map(n=>data?.get(n.sourceMs)?.[0]??fallback.get(n.sourceMs)).filter(Number.isFinite);
  const current=values.length?median(values):previous;
  // Eight hits first establish a clear alternation. Later blocks follow the
  // measured contour without leaving the lead hand's four keys.
  if(moving&&i>=8&&previous!==null&&current!==null&&Math.abs(current-previous)>=.75)shift=Math.max(-1,Math.min(1,shift+Math.sign(current-previous)));
  shifts.push(shift);previous=current;
 }
 return shifts;
}
function pairPath(chart,notes,shifts){
 const members=new Set(notes),start=notes[0].t-.065,end=notes.at(-1).t+.065;
 const occupied=new Set(chart.filter(n=>!members.has(n)&&n.t<=end&&(n.end??(n.flick?n.t+.39:n.t))>=start).map(n=>n.lane));
 const hand=notes[0].melodyHand??Math.floor(notes[0].lane/4),offset=hand*4;
 const usage=Array(8).fill(0);for(const n of chart)if(n.trill&&!members.has(n))usage[n.lane]++;
 const previous=chart.filter(n=>n.part==='melody'&&n.t<notes[0].t).at(-1);
 let best=null;
 for(const span of [1,2])for(let base=offset;base+span<offset+4;base++){
  const path=shifts.map(shift=>[base+shift,base+span+shift]);
  if(path.flat().some(lane=>lane<offset||lane>=offset+4||occupied.has(lane)))continue;
  const lanes=[],counts=Array(8).fill(0);let last=previous?.lane;
  for(let i=0;i<notes.length;i+=4){
   const pair=path[i/4],ordered=pair[0]===last?[pair[1],pair[0]]:pair;
   for(let j=0;j<Math.min(4,notes.length-i);j++){const lane=ordered[j%2];lanes.push(lane);counts[lane]++;last=lane;}
  }
  const score=counts.reduce((sum,count,lane)=>sum+2*usage[lane]*count+count*count,0)/notes.length+span*.1;
  if(!best||score<best.score)best={lanes,score};
 }
 return best?.lanes??null;
}
export function applyTrills(song,chart,difficulty){
 if(difficulty===0)return chart;
 const result=chart.map(n=>({...n})),runs=[];let run=[];
 const maxGap=Math.min(.46,60/song.bpm*.95),minimum=8,cap=difficulty===2?24:16;
 // The sparse accompaniment can continue underneath a lead-hand trill.
 for(const n of result.filter(n=>n.part==='melody'||!n.part)){
  if(n.end||n.flick||run.length&&(n.handPhrase!==run.at(-1).handPhrase||n.t-run.at(-1).t>maxGap)){
   if(run.length>=minimum)runs.push(run);run=[];
  }
  if(!n.end&&!n.flick)run.push(n);
 }
 if(run.length>=minimum)runs.push(run);
 const candidates=[];
 for(const run of runs)for(let size=Math.min(cap,run.length);size>=minimum;size--){
  if(size%4)continue;
  for(let i=0;i+size<=run.length;i++){
   const notes=run.slice(i,i+size),gaps=notes.slice(1).map((n,j)=>n.t-notes[j].t),pulse=median(gaps);
   const deviation=Math.sqrt(gaps.reduce((s,g)=>s+(g-pulse)**2,0)/gaps.length)/pulse;
   if(gaps.some(g=>g<pulse*.65||g>pulse*1.65)||deviation>.27)continue;
   candidates.push({notes,deviation});
  }
 }
 const sustained=difficulty===2?candidates.filter(c=>c.notes.length>=12):candidates;
 let serial=0;const selected=[];
 function place(pool,preferMoving=false){
  for(const candidate of pool.toSorted((a,b)=>b.notes.length-a.notes.length||a.deviation-b.deviation)){
   const notes=candidate.notes,start=notes[0].t,end=notes.at(-1).t;
   if(notes.some(n=>n.trill)||selected.some(w=>start<w.end+4&&end>w.start-4))continue;
   let shifts=shiftsFor(song.id,notes,preferMoving&&notes.length>=12),lanes=pairPath(result,notes,shifts);
   if(!lanes&&preferMoving){shifts=shifts.map(()=>0);lanes=pairPath(result,notes,shifts);}
   if(!lanes)continue;
   const kind=new Set(shifts).size>1?'moving':'trill',id=song.id+'-'+difficulty+'-'+serial++;
   notes.forEach((n,i)=>Object.assign(n,{lane:lanes[i],degree:lanes[i],trill:id,trillKind:kind,trillStep:Math.floor(i/4)}));
   selected.push({start,end});return true;
  }
  return false;
 }
 const authored=TRILL_PHRASES[song.id]?.[difficulty]??[];
 for(const [index,[start,end]]of authored.entries())place(sustained.filter(c=>c.notes[0].t>=start-.7&&c.notes.at(-1).t<=end+.7),index%2===0);
 // Choose steady phrases from each song's actual attacks and rests. No new
 // timing grid is inserted into slow or syncopated melodic passages.
 const target=difficulty===2?5:3;
 for(let band=0;band<target&&selected.length<target;band++){
  const a=song.duration*band/target,b=song.duration*(band+1)/target;
  place(sustained.filter(c=>c.notes[0].t>=a&&c.notes.at(-1).t<b),band%2===1);
 }
 if(!selected.length)place(candidates);
 return result.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}

