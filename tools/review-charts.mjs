import {SONGS,makeChart,HOLD_TICK} from '../engine.mjs';
import {writeFileSync} from 'node:fs';
export function review(song,difficulty){
 const notes=makeChart(song,difficulty),groups=new Map();
 for(const n of notes){if(!groups.has(n.t))groups.set(n.t,[]);groups.get(n.t).push(n);}
 let run=0,maxSameLaneRun=0,last=-1,collisions=0;
 for(const group of groups.values()){
  const lane=group.length===1?group[0].lane:-1;
  run=lane>=0&&lane===last?run+1:1;last=lane;maxSameLaneRun=Math.max(maxSameLaneRun,run);
 }
 const holds=notes.filter(n=>n.end),chords=[...groups.values()].filter(g=>g.length>1);
 for(const h of holds)if(notes.some(n=>n!==h&&n.lane===h.lane&&n.t>=h.t&&n.t<h.end-1e-8))collisions++;
 return {difficulty,notes:notes.length,holds:holds.length,chords:chords.length,
  shapes:new Set(chords.map(g=>g.map(n=>n.lane).join(','))).size,
  lanes:Array.from({length:8},(_,i)=>notes.filter(n=>n.lane===i).length),maxSameLaneRun,collisions,
  comboCeiling:notes.length+holds.reduce((sum,n)=>sum+Math.max(0,Math.ceil((n.end-n.t)/HOLD_TICK-1e-8)-1),0),
  holdsByThird:[0,1,2].map(k=>holds.filter(n=>n.t>=song.duration*k/3&&n.t<song.duration*(k+1)/3).length)};
}
const report=SONGS.map(s=>({id:s.id,title:s.title,duration:s.duration,bpm:s.bpm,difficulties:[0,1,2].map(d=>review(s,d))}));
writeFileSync(process.argv[2]||'docs/library-layout-v11.json',JSON.stringify(report,null,2));
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(SONGS.map(s=>({id:s.id,title:s.title,duration:s.duration,charts:[0,1,2].map(d=>makeChart(s,d))}))));
console.log(report.map(s=>({id:s.id,...s.difficulties[1]})));
