import test from 'node:test';
import assert from 'node:assert/strict';
import {pianoTrialChart} from '../piano-trial.mjs';
import {MONITORING_PIANO_PROFILE} from '../monitoring-vocal.mjs';
import {SONG_PIANO_NOTES} from '../song-piano-data.mjs';
import {pianoFeedbackAt} from '../source-piano.mjs';
import {chartAttacks} from '../audio-chart.mjs';
import {keySoundRequests} from '../key-sound.mjs';
import {SONGS,makeChart,RhythmSession} from '../engine.mjs';

test('all source pitch annotations match each song and preserve chart timing and previously confirmed pitches',()=>{
 const locked=new Map(MONITORING_PIANO_PROFILE.voices[0].map(n=>[n[0],n[2]]));
 for(const song of SONGS){
  const rows=SONG_PIANO_NOTES[song.id],attacks=chartAttacks(song.id);
  assert.deepEqual(rows.map(n=>n[0]),attacks.map(n=>n[0]),song.id);
  assert.ok(new Set(rows.map(n=>n[1])).size>8,song.id+' fixed pitch');
  for(const [ms,midi,second,kind]of rows){assert.ok(midi>=48&&midi<=88&&second>=48&&second<=88);assert.ok(kind>=0&&kind<=3);if(song.id==='monitoring'&&locked.has(ms))assert.equal(midi,locked.get(ms));}
  for(let d=0;d<3;d++){
   const raw=makeChart(song,d),chart=pianoTrialChart(song,raw,song.id==='monitoring'?MONITORING_PIANO_PROFILE:null);
   assert.ok(chart.every(n=>Number.isFinite(n.soundMidi)),song.id+'/'+d);
   assert.deepEqual(chart.map(n=>Object.fromEntries(Object.entries(n).filter(([k])=>!k.startsWith('sound')))),raw);
   for(const n of chart.filter(n=>n.soundVoice===0))assert.equal(n.soundMidi,locked.get(n.soundSourceStart));
  }
  assert.ok(Number.isFinite(pianoFeedbackAt(song,-.2).midi));
 }
});

test('tap, long and FLOAT heads all sound immediately; all annotated heads use recorded piano',()=>{
 const tap={t:1,lane:0,soundMidi:60},hold={t:2,end:3,lane:1,soundMidi:65},float={t:4,lane:2,flick:true,soundMidi:69};
 assert.equal(keySoundRequests([{kind:'judge',result:'perfect',note:tap}])[0].midi,60);
 assert.deepEqual(keySoundRequests([{kind:'holdstart',result:'perfect',note:hold}]),[{midi:65,hold:1,float:false,velocity:1}]);
 assert.deepEqual(keySoundRequests([{kind:'flickstart',result:'perfect',note:float}]),[{midi:69,hold:0,float:false,velocity:1}]);
 assert.equal(keySoundRequests([{kind:'judge',result:'perfect',note:float}],true)[0].float,true);
 assert.equal(keySoundRequests([{kind:'judge',result:'perfect',note:hold},{kind:'holdtick',note:hold},{kind:'judge',result:'miss',note:tap}]).length,0);
});

test('all 35 songs and 105 charts emit exactly one piano head and one separate chime per FLOAT',()=>{
 for(const song of SONGS)for(let d=0;d<3;d++){
  const chart=pianoTrialChart(song,makeChart(song,d),song.id==='monitoring'?MONITORING_PIANO_PROFILE:null),session=new RhythmSession(chart,song.duration);
  const events=chart.flatMap(n=>[[Math.round(n.t*1000),n.lane,1],[Math.round((n.end??n.t+.025)*1000),n.lane,0],...(n.flick?[[Math.round(n.t*1000),0,4],[Math.round((n.t+.08)*1000),n.lane,2],[Math.round((n.t+.1)*1000),n.lane,3],[Math.round((n.t+.12)*1000),0,5]]:[])]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
  let heads=0,chimes=0;
  for(const [ms,lane,action] of events){
   const t=ms/1000;
   if(action===1){const requests=keySoundRequests(session.press(t,lane));for(const r of requests){assert.ok(Number.isFinite(r.midi),song.id);assert.equal('percussive' in r,false);}heads+=requests.length;}
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
