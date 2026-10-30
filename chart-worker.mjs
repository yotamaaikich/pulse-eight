import {SONGS} from './engine.mjs?v=desktop-31';
import {chartForSong} from './catalog.mjs?v=startup-34';
import {pianoTrialChart} from './piano-trial.mjs?v=hands-19';
self.onmessage=({data})=>{
  const {id,songId,difficulty,profile}=data,song=SONGS.find(s=>s.id===songId);
  try{
    if(!song||![0,1,2].includes(difficulty))throw Error('Unknown chart');
    self.postMessage({id,chart:pianoTrialChart(song,chartForSong(song,difficulty),profile)});
  }catch{self.postMessage({id,error:true});}
};
