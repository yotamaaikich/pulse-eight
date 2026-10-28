import test from 'node:test';
import assert from 'node:assert/strict';
import {keySoundRequests} from '../key-sound.mjs';
import {SONGS,makeChart,RhythmSession} from '../engine.mjs';

test('tap, long and FLOAT heads all sound immediately; unknown pitches use a short strike',()=>{
 const tap={t:1,lane:0},hold={t:2,end:3,lane:1,soundMidi:65},float={t:4,lane:2,flick:true,soundMidi:69};
 assert.equal(keySoundRequests([{kind:'judge',result:'perfect',note:tap}])[0].percussive,true);
 assert.deepEqual(keySoundRequests([{kind:'holdstart',result:'perfect',note:hold}]),[{midi:65,hold:1,float:false,percussive:false}]);
 assert.deepEqual(keySoundRequests([{kind:'flickstart',result:'perfect',note:float}]),[{midi:69,hold:0,float:false,percussive:false}]);
 assert.equal(keySoundRequests([{kind:'judge',result:'perfect',note:float}],true)[0].float,true);
 assert.equal(keySoundRequests([{kind:'judge',result:'perfect',note:hold},{kind:'holdtick',note:hold},{kind:'judge',result:'miss',note:tap}]).length,0);
});

test('all 35 songs and 105 charts emit exactly one piano head and one separate chime per FLOAT',()=>{
 for(const song of SONGS)for(let d=0;d<3;d++){
  const chart=makeChart(song,d),session=new RhythmSession(chart,song.duration);
  const events=chart.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0],...(n.flick?[[Math.round(n.t*1000),0,4],[Math.round((n.t+.08)*1000),n.lane,2],[Math.round((n.t+.1)*1000),n.lane,3],[Math.round((n.t+.12)*1000),0,5]]:[])]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
  let heads=0,chimes=0;
  for(const [ms,lane,action] of events){
   const t=ms/1000;
   if(action===1)heads+=keySoundRequests(session.press(t,lane)).length;
   else if(action===2)chimes+=keySoundRequests(session.pressFlick(t,lane),true).length;
   else if(action===0)assert.equal(keySoundRequests(session.release(t,lane)).length,0);
   else if(action===3)session.releaseFlick(t,lane);
   else if(action===4)session.pressSpace(t);
   else session.releaseSpace(t);
  }
  session.finish();assert.equal(session.stats.miss,0,`${song.id}/${d}`);
  assert.equal(heads,chart.length,`${song.id}/${d}: dropped or doubled piano head`);
  assert.equal(chimes,chart.filter(n=>n.flick).length,`${song.id}/${d}: FLOAT chime`);
 }
});
