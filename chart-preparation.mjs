import {chartForSong} from './catalog.mjs?v=startup-34';
import {pianoTrialChart} from './piano-trial.mjs?v=hands-19';

export function createChartPreparation({workerFactory=typeof Worker==='function'?()=>new Worker(new URL('./chart-worker.mjs?v=startup-34',import.meta.url),{type:'module'}):null,build=(song,difficulty,profile)=>pianoTrialChart(song,chartForSong(song,difficulty),profile),timeoutMs=1500}={}){
  const cache=[],pending=new Map();let worker=null,tried=false,nextId=0;
  function complete(entry,chart,error){
    if(!pending.delete(entry.id))return;clearTimeout(entry.timer);
    if(error)entry.reject(error);else{entry.chart=chart;entry.resolve(chart);}
  }
  function fallback(entry){try{complete(entry,build(entry.song,entry.difficulty,entry.profile));}catch(error){complete(entry,null,error);}}
  function unavailable(){const failed=worker;worker=null;failed?.terminate();for(const entry of [...pending.values()])fallback(entry);}
  function connect(){
    if(tried)return;tried=true;if(!workerFactory)return;
    try{
      worker=workerFactory();
      worker.onmessage=({data})=>{const entry=pending.get(data?.id);if(!entry)return;if(Array.isArray(data.chart))complete(entry,data.chart);else fallback(entry);};
      worker.onerror=event=>{event.preventDefault?.();unavailable();};
    }catch{worker=null;}
  }
  function prepare(song,difficulty,profile=null){
    const found=cache.find(entry=>entry.song===song&&entry.difficulty===difficulty&&entry.profile===profile);if(found)return found;
    const entry={id:++nextId,song,difficulty,profile,chart:null};
    entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});
    // Selection warming has no caller awaiting failures; start still sees them.
    entry.promise.catch(()=>{});pending.set(entry.id,entry);cache.push(entry);if(cache.length>8)cache.shift();
    connect();
    if(worker){
      entry.timer=setTimeout(unavailable,timeoutMs);
      try{worker.postMessage({id:entry.id,songId:song.id,difficulty,profile});}catch{fallback(entry);}
    }else fallback(entry);
    return entry;
  }
  return {prepare};
}
