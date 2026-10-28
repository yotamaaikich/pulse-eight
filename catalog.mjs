import {makeChart} from './engine.mjs?v=hands-19';

export function chartMetrics(chart){
  const count=chart.filter(n=>!n.assist).length;
  return {count,level:Math.max(1,Math.ceil(count/100))*2};
}
const cache=new WeakMap();
export function difficultyMetrics(song,difficulty){
  if(!cache.has(song))cache.set(song,new Map());
  const byDifficulty=cache.get(song);
  if(!byDifficulty.has(difficulty))byDifficulty.set(difficulty,chartMetrics(makeChart(song,difficulty)));
  return byDifficulty.get(difficulty);
}
export function orderedSongs(songs,pack,difficulty,order){
  const list=songs.map((s,i)=>({s,i})).filter(({s})=>pack==='all'||s.pack===pack);
  if(order==='level-asc'||order==='level-desc'){
    const sign=order==='level-desc'?-1:1;
    list.sort((a,b)=>sign*(difficultyMetrics(a.s,difficulty).count-difficultyMetrics(b.s,difficulty).count)||a.i-b.i);
  }
  return list;
}
