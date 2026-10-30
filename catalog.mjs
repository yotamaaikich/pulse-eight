import {makeChart,CHART_VERSION} from './engine.mjs?v=desktop-31';
import {CHART_METRICS,METRICS_VERSION} from './chart-metrics.mjs?v=startup-34';

export function chartMetrics(chart){
  const count=chart.filter(n=>!n.assist).length;
  return {count,level:Math.max(1,Math.ceil(count/100))*2};
}
const cache=new WeakMap();
function cachedEntry(song,difficulty){
  if(!cache.has(song))cache.set(song,new Map());
  const byDifficulty=cache.get(song);
  if(!byDifficulty.has(difficulty)){
    const chart=makeChart(song,difficulty);
    byDifficulty.set(difficulty,{chart,metrics:chartMetrics(chart)});
  }
  return byDifficulty.get(difficulty);
}
// Read-only source chart. Audio decoration and RhythmSession copy these notes.
export function chartForSong(song,difficulty){return cachedEntry(song,difficulty).chart;}
export function difficultyMetrics(song,difficulty){
  const row=CHART_METRICS[song.id];
  if(METRICS_VERSION===CHART_VERSION&&row&&row.video===song.video&&row.duration===song.duration&&row.bpm===song.bpm&&row.offset===(song.offset??0)&&Number.isInteger(row.counts[difficulty])){
    const count=row.counts[difficulty];return {count,level:Math.max(1,Math.ceil(count/100))*2};
  }
  return cachedEntry(song,difficulty).metrics;
}
export function orderedSongs(songs,pack,difficulty,order){
  const list=songs.map((s,i)=>({s,i})).filter(({s})=>pack==='all'||s.pack===pack);
  if(order==='level-asc'||order==='level-desc'){
    const sign=order==='level-desc'?-1:1;
    list.sort((a,b)=>sign*(difficultyMetrics(a.s,difficulty).count-difficultyMetrics(b.s,difficulty).count)||a.i-b.i);
  }
  return list;
}
