import {TRILL_PHRASES,TRILL_CONTOURS} from './trill-data.mjs?v=trills-17';
const features=new Map(Object.entries(TRILL_CONTOURS).map(([id,rows])=>[id,new Map(rows.map(r=>[r[0],r.slice(1)]))]));
const median=values=>{const v=[...values].sort((a,b)=>a-b),i=v.length>>1;return v.length%2?v[i]:(v[i-1]+v[i])/2;};
function shiftsFor(id,notes){
 const data=features.get(id),shifts=[];let previous=null,shift=0;
 for(let i=0;i<notes.length;i+=4){
  const block=notes.slice(i,i+4).map(n=>data?.get(n.sourceMs)).filter(Boolean);
  const current=block.length?{pitch:median(block.map(r=>r[0])),contour:median(block.map(r=>r[1]))}:previous;
  if(previous&&current){
   const pitch=current.pitch-previous.pitch,contour=current.contour-previous.contour;
   // Four-attack smoothing avoids following every overtone or octave jump.
   const direction=Math.abs(pitch)>=.75&&Math.abs(pitch)<=12?Math.sign(pitch):
    Math.abs(pitch)>12&&Math.abs(contour)>=.75&&Math.sign(pitch)===Math.sign(contour)?Math.sign(pitch):0;
   shift+=direction;
  }
  shifts.push(shift);previous=current;
 }
 return shifts;
}
function pairPath(chart,notes,preferred,shifts){
 const members=new Set(notes),start=notes[0].t-.065,end=notes.at(-1).t+.065;
 const occupied=new Set(chart.filter(n=>!members.has(n)&&n.t<=end&&(n.end??(n.flick?n.t+.39:n.t))>=start).map(n=>n.lane));
 const pairs=[preferred,[1,5],[2,6],[3,4],[2,3],[4,5],[1,2],[5,6],[0,1],[6,7],[0,7]];
 const previous=chart.filter(n=>n.t<notes[0].t).at(-1);
 for(const pair of pairs)for(const offset of [0,-1,1,-2,2,-3,3,-4,4]){
  const path=shifts.map(shift=>pair.map(lane=>lane+offset+shift));
  if(path.flat().some(lane=>lane<0||lane>7||occupied.has(lane)))continue;
  const lanes=[];let last=previous?.lane;
  for(let i=0;i<notes.length;i+=4){
   const pair=path[i/4],ordered=pair[0]===last?[pair[1],pair[0]]:pair;
   for(let j=0;j<Math.min(4,notes.length-i);j++){const lane=ordered[j%2];lanes.push(lane);last=lane;}
  }
  return lanes;
 }
 return null;
}
export function applyTrills(song,chart,difficulty){
 const phrases=TRILL_PHRASES[song.id]?.[difficulty];if(!phrases)return chart;
 const result=chart.map(n=>({...n})),groups=[...Map.groupBy(result,n=>n.t).values()];
 for(const [index,[start,end,a,b,cap]]of phrases.entries()){
  let run=[],best=null;const minimum=difficulty===2?8:6;
  function consider(){
   for(let size=Math.min(cap,run.length);size>=minimum;size--){
    if(size%4===1)continue;
    let found=false;
    for(let i=0;i+size<=run.length;i++){
     const notes=run.slice(i,i+size),gaps=notes.slice(1).map((n,j)=>n.t-notes[j].t),pulse=median(gaps);
     // Keep source syncopation and short rests, without bridging a new phrase.
     if(gaps.some(g=>g<pulse*.6||g>pulse*2.15))continue;
     const shifts=shiftsFor(song.id,notes),lanes=pairPath(result,notes,[a,b],shifts);if(!lanes)continue;
     found=true;
     const score=size*100-Math.abs((notes[0].t+notes.at(-1).t)-(start+end));
     if(!best||score>best.score)best={notes,lanes,score};
    }
    if(found)break;
   }
   run=[];
  }
  for(const group of groups){
   const n=group[0];if(n.t<start||n.t>end)continue;
   if(group.length!==1||n.end||n.flick||n.trill){consider();continue;}
   if(run.length&&n.t-run.at(-1).t>.29)consider();run.push(n);
  }
  consider();if(!best)continue;
  best.notes.forEach((n,i)=>Object.assign(n,{lane:best.lanes[i],degree:best.lanes[i],trill:song.id+'-'+difficulty+'-'+index,trillStep:Math.floor(i/4)}));
 }
 return result.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
