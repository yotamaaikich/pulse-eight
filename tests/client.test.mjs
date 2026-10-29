import {createInputMixer,bindTouchInput} from '../touch.mjs';
import {MONITORING_PIANO_PROFILE} from '../monitoring-vocal.mjs';
import {nextLife,MAX_LIFE} from '../life.mjs';
import {drawKeyboard,keyboardStrikeY} from '../keyboard.mjs';
import {NOTE_COLORS,drawNoteHead,drawPerfectHit,drawCombo,drawJudgment} from '../note-style.mjs';
import {importPianoScore,validatePianoProfile} from '../score-import.mjs';
import {pianoTrialChart,PIANO_TRIAL_SONG} from '../piano-trial.mjs';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {chartMetrics,chartForSong,difficultyMetrics,orderedSongs} from '../catalog.mjs';
import * as engine from '../engine.mjs';
import {projectPoint} from '../geometry.mjs';
import {PlaybackGate,inputClock,expectedVideo,countdownFrame} from '../playback.mjs';
import {noteTravelSeconds,leadInSeconds,leadInClock} from '../lead-in.mjs';
import {pianoFeedbackAt} from '../source-piano.mjs';
import {keySoundRequests} from '../key-sound.mjs';
import {drawAirRibbons,drawAirHead} from '../air.mjs';
const soundCalls=[],soundStub={enabled:true,volume:18,warm(){return true;},async prepare(){return true;},stop(){},configure(o){Object.assign(this,o);},play(o){if(!this.enabled||!this.volume)return false;soundCalls.push(o);return true;}};
const createPianoSound=()=>soundStub;
let wall=0;const elements=new Map(),storage=new Map(),volumes=[],listeners=new Map();
const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
function element(id){if(!elements.has(id)){const classes=new Set();elements.set(id,{classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle(n,on){if(on)classes.add(n);else classes.delete(n);}},textContent:'',value:'',innerHTML:'',style:{},open:false,setAttribute(){},addEventListener(){},replaceChildren(){},append(){},click(){this.clicked=true;},focus(){},close(){this.open=false;},showModal(){this.open=true;},getContext:()=>context2d,querySelector:selector=>element(id+' '+selector)});}return elements.get(id);}
for(const [,id] of (await fs.readFile(new URL('../index.html',import.meta.url),'utf8')).matchAll(/\bid="([^"]+)"/g))element(id);
const document={getElementById:element,querySelectorAll:()=>[],querySelector:()=>elements.get('changeTrackDialog')?.open?elements.get('changeTrackDialog'):null,createElement:()=>element('generated'),addEventListener:(key,fn)=>listeners.set(key,fn),body:element('body'),head:{append(){}},hidden:false};
const fakePlayer={time:0,state:5,options:null,setVolume:v=>volumes.push(v),setPlaybackRate(){},loadVideoById({videoId}){this.video=videoId;this.time=0;this.state=1;},cueVideoById(videoId){this.video=videoId;},getVideoUrl(){return this.urlOverride??"https://www.youtube.com/watch?v="+this.video;},getDuration(){return this.durationOverride??engine.SONGS.find(s=>s.video===this.video)?.duration??0;},seekTo(t){this.seekCalls=(this.seekCalls||0)+1;if(this.deferSeek){this.seekTarget=t;return;}this.time=t;},pauseVideo(){this.state=2;},playVideo(){this.playCalls=(this.playCalls||0)+1;this.state=this.deferPlay?3:1;},getCurrentTime(){return this.time;},getPlayerState(){return this.state;}};
const window={addEventListener(){},scrollTo(){},YT:{Player:function(id,options){fakePlayer.options=options;fakePlayer.video=options.videoId;return fakePlayer;}}};
const scope=vm.createContext({createAccount:()=>({headers:async()=>({})}),initDesktop:()=>()=>{},...engine,createInputMixer,bindTouchInput,MONITORING_PIANO_PROFILE,nextLife,MAX_LIFE,drawKeyboard,keyboardStrikeY,NOTE_COLORS,drawNoteHead,drawPerfectHit,drawCombo,drawJudgment,importPianoScore,validatePianoProfile,createPianoSound,pianoTrialChart,PIANO_TRIAL_SONG,chartMetrics,chartForSong,difficultyMetrics,orderedSongs,projectPoint,PlaybackGate,inputClock,expectedVideo,countdownFrame,noteTravelSeconds,leadInSeconds,leadInClock,pianoFeedbackAt,keySoundRequests,drawAirRibbons,drawAirHead,API_URL:'https://qa.invalid',PUBLIC_KEY:'qa',document,window,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},crypto:webcrypto,performance:{now:()=>wall},requestAnimationFrame(){},ResizeObserver:class{observe(){}},devicePixelRatio:2,location:{origin:'http://localhost'},fetch:async(url)=>({ok:true,json:async()=>url.includes('/leaderboard')?{scores:[]}:{runId:'local-mock'}}),AbortSignal,URL,console,setTimeout,clearTimeout});
const source=(await fs.readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .+;\r?\n/gm,'');
vm.runInContext(source+`\nglobalThis.qa={quit,start,draw,finish,pause,resume,resize,requestSelection,confirmSelection,selectSong,selectDifficulty,setTrial(){selected=0;},get countdownUntil(){return countdownUntil},get mode(){return mode},get clock(){return clock},get stats(){return stats},get selected(){return selected},get difficulty(){return difficulty},get eligible(){return eligible},get notes(){return notes},get events(){return events},setPractice(chart,diff=2){difficulty=diff;mode='running';clock=1;session=new RhythmSession(chart,5);notes=session.notes;stats=session.stats;events=[];inputMixer.reset(true);pressed.clear();upperPressed.clear();spaceHeld=false;},setHard(){spaceHeld=false;difficulty=2;mode='running';clock=1;session=new RhythmSession([{t:1,lane:3,flick:true,midi:66}],181);notes=session.notes;stats=session.stats;events=[];inputMixer.reset(true);pressed.clear();upperPressed.clear();},setClock(t){clock=t;}};`,scope);
window.onYouTubeIframeAPIReady();fakePlayer.options.events.onReady();
scope.qa.start();assert.equal(volumes.at(-1),0);assert.equal(elements.get('videoLoading').classList.contains('hidden'),false);assert.equal(JSON.parse(storage.get('pulse-prefs')).volume,50);
for(wall=0;wall<30000;wall+=100)scope.qa.draw(wall);
assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);assert.equal(volumes.at(-1),0);
fakePlayer.options.events.onStateChange({data:0});assert.ok(['buffering','loading'].includes(scope.qa.mode));
fakePlayer.time=10;for(let i=0;i<20;i++){wall+=50;fakePlayer.time+=.05;scope.qa.draw(wall);}assert.equal(scope.qa.clock,0);
fakePlayer.time=0;fakePlayer.options.events.onStateChange({data:1});
for(let i=0;i<15&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time=i*.05;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.clock,0);assert.equal(volumes.at(-1),0);
for(let i=0;i<5;i++){wall+=50;scope.qa.draw(wall);}
const countStart=wall;for(let i=0;i<29;i++){wall+=100;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);
wall=countStart+3000;scope.qa.draw(wall);assert.equal(scope.qa.mode,'countdown');assert.equal(fakePlayer.time,0);
function becomeRunning(){fakePlayer.state=1;fakePlayer.options.events.onStateChange({data:1});for(let i=0;i<100&&scope.qa.mode!=='running';i++){wall+=50;const wasCountdown=scope.qa.mode==='countdown';if(fakePlayer.state===1)fakePlayer.time+=.05;scope.qa.draw(wall);if(wasCountdown&&scope.qa.mode==='loading'&&fakePlayer.state===1)fakePlayer.options.events.onStateChange({data:1});}assert.equal(scope.qa.mode,'running');}
becomeRunning();
assert.equal(scope.qa.mode,'running');assert.equal(volumes.at(-1),50);
for(let i=0;i<650;i++){wall+=100;fakePlayer.time+=.1;scope.qa.draw(wall);}assert.equal(scope.qa.mode,'running');assert.ok(scope.qa.clock>60);
fakePlayer.state=2;fakePlayer.options.events.onStateChange({data:2});for(let i=0;i<6;i++){wall+=100;scope.qa.draw(wall);}assert.equal(scope.qa.mode,'buffering');assert.equal(volumes.at(-1),0);
becomeRunning();
assert.equal(scope.qa.mode,'running');const frozenTime=scope.qa.clock;
for(let i=0;i<50;i++){wall+=100;scope.qa.draw(wall);}assert.equal(scope.qa.mode,'buffering');assert.equal(scope.qa.clock,frozenTime);
elements.get('volume').value='0';elements.get('volume').oninput();becomeRunning();assert.equal(volumes.at(-1),0);assert.equal(JSON.parse(storage.get('pulse-prefs')).volume,0);
// Change requests keep the paused game intact until explicitly confirmed.
scope.qa.pause();const before=scope.qa.clock,stats=scope.qa.stats;scope.qa.selectSong(1);assert.equal(elements.get('changeTrackDialog').open,true);assert.equal(scope.qa.selected,0);assert.equal(scope.qa.clock,before);assert.equal(scope.qa.stats,stats);elements.get('changeTrackDialog').close();assert.equal(scope.qa.mode,'paused');
scope.qa.selectDifficulty(2);assert.equal(scope.qa.difficulty,1);scope.qa.confirmSelection();assert.equal(scope.qa.mode,'idle');assert.equal(scope.qa.difficulty,2);assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);
const key=(code,shiftKey=false)=>({code,key:code,shiftKey,preventDefault(){},target:{closest(){return null;}}});
assert.ok(source.includes('pianoTrialChart'),'piano pitches are assigned from a timed score');
const down=code=>listeners.get('keydown')(key(code)),up=code=>listeners.get('keyup')(key(code));
scope.qa.setHard();down('KeyF');scope.qa.setClock(1.08);down('Space');up('Space');up('KeyF');assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.stats.perfect,1);assert.deepEqual(Array.from(scope.qa.events,e=>Array.from(e)),[[1000,3,1],[1080,0,4],[1080,3,2],[1080,0,5],[1080,3,3],[1080,3,0]]);
// Space alone never scores; holding it allows fresh lane presses across the chart.
scope.qa.setPractice([{t:1,lane:3,flick:true},{t:1.5,lane:4,flick:true}]);down('Space');assert.equal(scope.qa.stats.perfect,0);down('KeyF');up('KeyF');scope.qa.setClock(1.5);down('KeyJ');up('KeyJ');up('Space');assert.equal(scope.qa.stats.perfect,2);
assert.equal(engine.scoreChartReplay([{t:1,lane:3,flick:true},{t:1.5,lane:4,flick:true}],5,Array.from(scope.qa.events,e=>Array.from(e))).maxCombo,2);
// Releasing Space does not release an ordinary long note.
scope.qa.setPractice([{t:1,lane:3,end:2},{t:1.5,lane:4,flick:true}]);down('KeyF');scope.qa.setClock(1.3);down('Space');scope.qa.setClock(1.5);down('KeyJ');up('KeyJ');up('Space');assert.equal(scope.qa.stats.miss,0);scope.qa.setClock(2);up('KeyF');assert.equal(scope.qa.stats.perfect,2);
// Both held lanes can flick on one Space press; old upper-row keys do not score.
scope.qa.setPractice([{t:1,lane:3,flick:true},{t:1,lane:4,flick:true}]);down('KeyF');down('KeyJ');down('KeyR');up('KeyR');assert.equal(scope.qa.stats.perfect,0);down('Space');assert.equal(scope.qa.stats.perfect,2);up('Space');up('KeyF');up('KeyJ');
console.log('PASS: 3-second count-in, full-song play, Space flicks and sweeps, replay scoring, simultaneous flicks, held notes, upper-row removal and piano trial input timing.');

// Space held from a normal section taints AIR until released; replay includes the global Space state.
scope.qa.setPractice([{t:1,lane:0},{t:3,lane:3,flick:true}]);down('KeyA');up('KeyA');down('Space');assert.equal(scope.qa.stats.combo,0);assert.equal(scope.qa.stats.airBreaks,1);scope.qa.setClock(3);down('KeyF');up('KeyF');assert.equal(scope.qa.stats.perfect,1);up('Space');assert.ok(scope.qa.events.some(e=>e[2]===4));assert.ok(scope.qa.events.some(e=>e[2]===5));

// Finishing a track keeps selection active, shows the unsaved-score warning, and preserves the result on cancel.
scope.qa.setPractice([{t:1,lane:0}],1);scope.qa.finish();assert.equal(scope.qa.mode,'results');assert.equal(document.body.classList.contains('focus-play'),false);
const resultStats=scope.qa.stats,oldSong=scope.qa.selected,oldDiff=scope.qa.difficulty;
scope.qa.selectSong((oldSong+1)%engine.SONGS.length);assert.equal(elements.get('changeTrackDialog').open,true);assert.equal(scope.qa.selected,oldSong);assert.equal(scope.qa.mode,'results');assert.match(elements.get('changeScoreWarning').textContent,/スコアは記録されません/);
elements.get('changeTrackDialog').close();assert.equal(scope.qa.stats,resultStats);assert.equal(scope.qa.mode,'results');
scope.qa.selectDifficulty((oldDiff+1)%3);scope.qa.confirmSelection();assert.equal(scope.qa.mode,'idle');assert.equal(scope.qa.difficulty,(oldDiff+1)%3);assert.equal(scope.qa.clock,0);
// The result-screen button and arrow keys open selection without Escape.
scope.qa.setPractice([{t:1,lane:0}],1);scope.qa.finish();elements.get('resultBack').onclick();assert.equal(elements.get('changeTrackDialog').open,true);elements.get('changeTrackDialog').close();
down('ArrowDown');assert.equal(elements.get('changeTrackDialog').open,true);elements.get('changeTrackDialog').close();down('ArrowRight');assert.equal(elements.get('changeTrackDialog').open,true);elements.get('changeTrackDialog').close();
// During play, clicking another track automatically pauses before asking to reset.
scope.qa.setPractice([{t:1,lane:0}],1);scope.qa.selectSong((scope.qa.selected+1)%engine.SONGS.length);assert.equal(scope.qa.mode,'paused');assert.equal(elements.get('changeTrackDialog').open,true);elements.get('changeTrackDialog').close();assert.equal(scope.qa.mode,'paused');

// Slow asynchronous seek must settle before the three seconds start.
elements.get('changeTrackDialog').close();scope.qa.confirmSelection();
elements.get('volume').value='50';elements.get('volume').oninput();fakePlayer.deferSeek=true;scope.qa.start();fakePlayer.state=1;fakePlayer.options.events.onStateChange({data:1});
for(let i=0;i<15&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time=i*.05;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.countdownUntil,0);
for(let i=0;i<40;i++){wall+=100;scope.qa.draw(wall);}assert.equal(scope.qa.countdownUntil,0);assert.equal(scope.qa.clock,0);
fakePlayer.time=fakePlayer.seekTarget;fakePlayer.state=2;fakePlayer.deferSeek=false;
for(let i=0;i<5;i++){wall+=50;scope.qa.draw(wall);}const deadline=scope.qa.countdownUntil;assert.ok(deadline>wall);
wall=deadline-1;scope.qa.draw(wall);assert.equal(scope.qa.mode,'countdown');
wall=deadline;scope.qa.draw(wall);assert.equal(scope.qa.mode,'countdown');
// A stale pre-seek timestamp is repaired once, without resetting the visible count.
const seekBeforeRepair=fakePlayer.seekCalls;
fakePlayer.state=1;fakePlayer.time=2;wall+=20;scope.qa.draw(wall);assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.countdownUntil,deadline);assert.equal(scope.qa.clock,0);
for(let i=0;i<12;i++){wall+=50;scope.qa.draw(wall);}assert.equal(scope.qa.mode,'countdown');assert.equal(fakePlayer.seekCalls,seekBeforeRepair+1);assert.equal(scope.qa.countdownUntil,deadline);
// A late PAUSED callback during handoff does not consume another countdown.
fakePlayer.state=2;fakePlayer.options.events.onStateChange({data:2});wall+=30;scope.qa.draw(wall);assert.equal(scope.qa.mode,'countdown');
fakePlayer.state=1;fakePlayer.time=.02;fakePlayer.options.events.onStateChange({data:1});fakePlayer.options.events.onStateChange({data:1});wall+=20;scope.qa.draw(wall);assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.clock,.02);assert.equal(volumes.at(-1),50); // first content frame is audible, without a silent .35-second probe
fakePlayer.state=3;fakePlayer.options.events.onStateChange({data:3});wall+=50;scope.qa.draw(wall);assert.equal(scope.qa.mode,'running');
fakePlayer.state=2;fakePlayer.options.events.onStateChange({data:2});wall+=100;scope.qa.draw(wall);assert.equal(scope.qa.mode,'running');
fakePlayer.state=1;fakePlayer.time=.05;fakePlayer.options.events.onStateChange({data:1});wall+=50;scope.qa.draw(wall);assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.clock,.05);

// Piano attacks are emitted by real key-down only. Releases, auto-repeat and hold ticks never retrigger.
scope.qa.setTrial();scope.qa.setPractice([{t:1,lane:0,soundMidi:62},{t:2,lane:1,end:3,soundMidi:65}],1);soundCalls.length=0;
down('KeyA');assert.equal(soundCalls.length,1);down('KeyA');assert.equal(soundCalls.length,1);up('KeyA');assert.equal(soundCalls.length,1);
scope.qa.setClock(2);down('KeyS');assert.equal(soundCalls.length,2);scope.qa.setClock(3);up('KeyS');assert.equal(soundCalls.length,2);
scope.qa.setPractice([{t:1,lane:3,flick:true,soundMidi:69}]);soundCalls.length=0;down('KeyF');assert.equal(soundCalls.length,1);assert.equal(soundCalls[0].float,false);down('Space');assert.equal(soundCalls.length,2);assert.equal(soundCalls[1].float,true);up('Space');up('KeyF');assert.equal(soundCalls.length,2);
elements.get('pianoOn').checked=false;elements.get('pianoOn').onchange();scope.qa.setPractice([{t:1,lane:0,soundMidi:62}],1);down('KeyA');up('KeyA');assert.equal(soundCalls.length,2);
elements.get('pianoOn').checked=true;elements.get('pianoOn').onchange();elements.get('pianoLevel').value='0';elements.get('pianoLevel').oninput();scope.qa.setPractice([{t:1,lane:0,soundMidi:62}],1);down('KeyA');up('KeyA');assert.equal(soundCalls.length,2);

// Every library song can use its own score, including actual key-down audio.
elements.get('pianoLevel').value='18';elements.get('pianoLevel').oninput();
for(let i=0;i<engine.SONGS.length;i++){
 scope.qa.quit();scope.qa.selectSong(i);scope.qa.setPractice([{t:1,lane:0,soundMidi:60+i%12}],1);
 const before=soundCalls.length;down('KeyA');up('KeyA');assert.equal(soundCalls.length,before+1,engine.SONGS[i].id);
}
scope.qa.quit();scope.qa.selectSong(1);
elements.get('pianoScoreFile').files=[{size:100,name:'test.mml',text:async()=> 'MML@t120o4l4crd;'}];
await elements.get('pianoScoreFile').onchange();
assert.ok(storage.has('pulse-piano-score:tetoris'));assert.equal(storage.has('pulse-piano-score:monitoring'),false);
assert.match(elements.get('pianoScoreStatus').textContent,/test.mml/);
scope.qa.selectSong(0);assert.match(elements.get('pianoScoreStatus').textContent,/公式音声/);

// Imported piano pitches no longer replace the shipped rhythm or disable ranking.
elements.get('pianoScoreFile').files=[{size:100,name:'reference.mml',text:async()=> 'MML@t120o4l4crd;'}];await elements.get('pianoScoreFile').onchange();
scope.qa.start();assert.equal(scope.qa.eligible,true);scope.qa.quit();

// A fresh browser has automatic song-specific piano; local score import remains optional.
scope.qa.selectSong(2);assert.match(elements.get('pianoTrialStatus').textContent,/曲別ピアノ/);
elements.get('settingsDialog').close();scope.qa.selectSong(0);assert.match(elements.get('pianoTrialStatus').textContent,/鍵盤音 ON/);

// Every Monitoring head is pitched on a fresh browser, without any score import.
scope.qa.quit();scope.qa.selectSong(0);scope.qa.start();
const annotated=Array.from(scope.qa.notes);assert.ok(annotated.some(n=>Number.isFinite(n.soundMidi)));assert.ok(annotated.every(n=>Number.isFinite(n.soundMidi)));
const voiced=annotated.find(n=>Number.isFinite(n.soundMidi));scope.qa.setPractice([{t:1,lane:0,soundMidi:voiced.soundMidi}],1);soundCalls.length=0;down('KeyA');up('KeyA');assert.equal(soundCalls.length,1);assert.equal(soundCalls[0].midi,voiced.soundMidi);assert.equal(soundCalls[0].percussive,undefined);
scope.qa.setPractice([{t:1,lane:0}],1);soundCalls.length=0;down('KeyA');up('KeyA');assert.equal(soundCalls.length,1);assert.ok(Number.isFinite(soundCalls[0].midi));assert.equal(soundCalls[0].percussive,undefined);scope.qa.quit();

// A keyboard event uses a fresh player timestamp, rather than the previous frame.
scope.qa.setPractice([{t:1,lane:0}],1);fakePlayer.time=1.024;fakePlayer.state=1;down('KeyA');
assert.equal(scope.qa.events[0][0],1024);up('KeyA');scope.qa.quit();

// Empty keys use current source harmony too; releasing never retriggers it.
scope.qa.selectSong(2);scope.qa.setPractice([{t:1,lane:0}],1);fakePlayer.time=.05;soundCalls.length=0;
down('KeyA');up('KeyA');assert.equal(soundCalls.length,1);assert.ok(Number.isFinite(soundCalls[0].midi));assert.equal(soundCalls[0].percussive,undefined);
down('KeyS');up('KeyS');assert.equal(soundCalls.length,2);assert.ok(Number.isFinite(soundCalls[1].midi));assert.equal(soundCalls[1].percussive,undefined);scope.qa.quit();

// Calibration can make a timestamp negative at the start. Such a press is not
// added to the replay, but must still provide immediate physical key feedback.
elements.get('offset').value='500';elements.get('offset').oninput();scope.qa.setPractice([{t:1,lane:0}],1);scope.qa.setClock(.1);fakePlayer.time=.1;soundCalls.length=0;
down('KeyA');up('KeyA');assert.equal(scope.qa.events.length,0);assert.equal(soundCalls.length,1);assert.ok(Number.isFinite(soundCalls[0].midi));assert.equal(soundCalls[0].percussive,undefined);scope.qa.quit();
elements.get('offset').value='0';elements.get('offset').oninput();

// Both settings previews use actual recorded piano pitches.
elements.get('settingsDialog').showModal();soundCalls.length=0;
elements.get('testSongPiano').onclick();assert.equal(soundCalls.length,1);assert.ok(Number.isFinite(soundCalls[0].midi));assert.equal(soundCalls[0].percussive,undefined);
elements.get('testPiano').onclick();assert.equal(soundCalls.length,4);assert.ok(soundCalls.slice(1).every(n=>Number.isFinite(n.midi)&&!n.percussive));
elements.get('settingsDialog').close();

// Delayed playVideo: the last count stays visible until the content clock moves.
// A short startup buffer must not seek back and run another three-second count.
scope.qa.quit();elements.get('volume').value='50';elements.get('volume').oninput();
fakePlayer.deferPlay=false;scope.qa.start();fakePlayer.options.events.onStateChange({data:1});
for(let i=0;i<20&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time=i*.05;scope.qa.draw(wall);}
for(let i=0;i<6&&!scope.qa.countdownUntil;i++){wall+=50;scope.qa.draw(wall);}
const delayedDeadline=scope.qa.countdownUntil;assert.ok(delayedDeadline>wall);
const startupSeeks=fakePlayer.seekCalls,startupPlays=fakePlayer.playCalls;
fakePlayer.deferPlay=true;wall=delayedDeadline-120;scope.qa.draw(wall);wall=delayedDeadline;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'countdown','finishing 321 must not expose a loading/frozen highway while playVideo is pending');
for(let i=0;i<6;i++){wall+=50;scope.qa.draw(wall);assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);}
fakePlayer.deferPlay=false;fakePlayer.state=1;fakePlayer.time=0;
fakePlayer.options.events.onStateChange({data:1});
for(let i=0;i<4;i++){wall+=50;scope.qa.draw(wall);assert.equal(scope.qa.mode,'countdown','PLAYING with a stale zero clock is not a started song');}
fakePlayer.time=.02;wall+=20;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.clock,.02);assert.equal(volumes.at(-1),50);
assert.equal(fakePlayer.seekCalls,startupSeeks);assert.equal(fakePlayer.playCalls,startupPlays+1);
fakePlayer.state=3;
for(let i=0;i<6;i++){wall+=100;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'buffering');
fakePlayer.state=1;fakePlayer.options.events.onStateChange({data:1});
wall+=50;fakePlayer.time=.07;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'running','a short handoff buffer must resume without a new 321');
assert.equal(scope.qa.clock,.07);assert.equal(volumes.at(-1),50,'the first resumed frame must be audible, not another silent .35-second probe');
assert.equal(fakePlayer.seekCalls,startupSeeks);assert.equal(scope.qa.stats.miss,0);
console.log('PASS: delayed video start, stale PLAYING clock, and brief startup buffering use one countdown without a rewind.');


// Long interruptions still receive a fresh count-in and do not advance judgment.
const beforeLongBuffer=scope.qa.clock;fakePlayer.state=3;
for(let i=0;i<30;i++){wall+=100;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'buffering');assert.equal(scope.qa.clock,beforeLongBuffer);assert.equal(scope.qa.stats.miss,0);
fakePlayer.state=1;fakePlayer.options.events.onStateChange({data:1});
for(let i=0;i<12&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time+=.05;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.clock,beforeLongBuffer);assert.equal(fakePlayer.seekCalls,startupSeeks+1);
for(let i=0;i<6&&!scope.qa.countdownUntil;i++){wall+=50;scope.qa.draw(wall);}
assert.ok(scope.qa.countdownUntil>=wall+2700,'a long stop still prepares a full three seconds');
// Autoplay can be denied during the final handoff too; leave a usable Enter prompt.
fakePlayer.deferPlay=true;wall=scope.qa.countdownUntil-100;scope.qa.draw(wall);
fakePlayer.options.events.onAutoplayBlocked();assert.equal(scope.qa.mode,'paused');assert.equal(elements.get('pauseMessage').querySelector('h2').textContent,'READY?');
assert.equal(elements.get('pauseMessage').classList.contains('hidden'),false);assert.equal(scope.qa.stats.miss,0);fakePlayer.deferPlay=false;scope.qa.quit();
console.log('PASS: a long interruption keeps a full count-in; a blocked final handoff returns to the resume prompt.');

// YouTube's first timestamp may arrive after the old 250ms acceptance window.
function prepareHandoff(index=1){
 scope.qa.quit();fakePlayer.deferPlay=false;fakePlayer.deferSeek=false;
 delete fakePlayer.durationOverride;delete fakePlayer.urlOverride;
 scope.qa.selectSong(index);scope.qa.start();fakePlayer.options.events.onStateChange({data:1});
 for(let i=0;i<30&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time=i*.05;scope.qa.draw(wall);}
 for(let i=0;i<8&&!scope.qa.countdownUntil;i++){wall+=50;scope.qa.draw(wall);}
 assert.ok(scope.qa.countdownUntil>wall);
 wall=scope.qa.countdownUntil-120;scope.qa.draw(wall);
 return scope.qa.countdownUntil;
}
let sparseDeadline=prepareHandoff();
wall=sparseDeadline+320;fakePlayer.time=.32;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'running','a delayed first timestamp must not leave the chart on 1 while the video plays');
assert.equal(scope.qa.clock,.32);assert.equal(scope.qa.stats.miss,0);assert.equal(volumes.at(-1),50);
scope.qa.quit();
console.log('PASS: a first content timestamp after 250ms starts the chart instead of trapping the final count.');

// An interrupted handoff leaves 1 for a loading indicator, then counts in only
// after new content progress and the rewind have both been verified.
let interruptedDeadline=prepareHandoff();
wall=interruptedDeadline+1700;fakePlayer.time=0;scope.qa.draw(wall);
assert.equal(elements.get('playCountdown').classList.contains('hidden'),true);
assert.equal(elements.get('videoLoading').classList.contains('hidden'),false);
for(let i=0;i<90;i++){wall+=1000;scope.qa.draw(wall);assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);}
for(let i=1;i<=8&&scope.qa.countdownUntil;i++){wall+=100;fakePlayer.time=i*.1;scope.qa.draw(wall);}
assert.equal(scope.qa.countdownUntil,0);assert.equal(scope.qa.clock,0);
for(let i=0;i<6&&!scope.qa.countdownUntil;i++){wall+=50;scope.qa.draw(wall);}
assert.ok(scope.qa.countdownUntil>=wall+2700);
wall=scope.qa.countdownUntil-120;scope.qa.draw(wall);fakePlayer.time=.02;wall+=140;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.stats.miss,0);
console.log('PASS: even a 90-second stalled preroll leaves no frozen 1, advances no judgments, and receives a fresh count-in.');

// Metadata is a negative signal only: a clearly different video/duration must
// not start the chart, even if its clock advances normally. No ad DOM access.
let metadataDeadline=prepareHandoff(),metadataSeeks=fakePlayer.seekCalls;
fakePlayer.durationOverride=30;wall=metadataDeadline;fakePlayer.time=2;scope.qa.draw(wall);
for(let i=0;i<90;i++){wall+=1000;fakePlayer.time=(i+2)%30;scope.qa.draw(wall);}
assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);assert.equal(scope.qa.eligible,true);
assert.equal(fakePlayer.seekCalls,metadataSeeks,'do not spam seek commands while metadata contradicts the MV');
assert.equal(elements.get('playCountdown').classList.contains('hidden'),true);assert.equal(volumes.at(-1),0);
delete fakePlayer.durationOverride;fakePlayer.urlOverride='https://www.youtube.com/watch?v=other';
for(let i=0;i<8;i++){wall+=100;fakePlayer.time=i*.1;scope.qa.draw(wall);}
assert.equal(scope.qa.countdownUntil,metadataDeadline);delete fakePlayer.urlOverride;
for(let i=0;i<10&&scope.qa.countdownUntil;i++){wall+=100;fakePlayer.time=i*.1;scope.qa.draw(wall);}
assert.equal(scope.qa.countdownUntil,0);
for(let i=0;i<6&&!scope.qa.countdownUntil;i++){wall+=50;scope.qa.draw(wall);}
assert.ok(scope.qa.countdownUntil>=wall+2700);assert.equal(scope.qa.clock,0);
wall=scope.qa.countdownUntil-120;scope.qa.draw(wall);fakePlayer.time=.02;wall+=140;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.stats.miss,0);assert.equal(scope.qa.eligible,true);
console.log('PASS: mismatched video metadata waits muted without seeking or scoring; returning MV metadata recovers without a new PLAYING event.');

// A late ad/metadata change can happen before playVideo was issued. Once the
// expected MV returns paused, issue play once so verification can make progress.
scope.qa.quit();scope.qa.start();
for(let i=0;i<30&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time=i*.05;scope.qa.draw(wall);}
for(let i=0;i<6&&!scope.qa.countdownUntil;i++){wall+=50;scope.qa.draw(wall);}
assert.equal(fakePlayer.state,2);fakePlayer.durationOverride=30;wall+=50;scope.qa.draw(wall);
const recoveryPlays=fakePlayer.playCalls;delete fakePlayer.durationOverride;wall+=50;scope.qa.draw(wall);
assert.equal(fakePlayer.playCalls,recoveryPlays+1);assert.equal(fakePlayer.state,1);
for(let i=0;i<10&&scope.qa.countdownUntil;i++){wall+=100;fakePlayer.time=i*.1;scope.qa.draw(wall);}
assert.equal(scope.qa.countdownUntil,0);assert.equal(fakePlayer.playCalls,recoveryPlays+1);scope.qa.quit();

// If an early note already passed in the first report, seek rather than score
// it as a miss. A failed seek must expose a usable resume prompt, not an endless 1.
let earlyDeadline=prepareHandoff(engine.SONGS.findIndex(s=>s.id==='heat'));
fakePlayer.deferSeek=true;fakePlayer.time=2;wall=earlyDeadline+600;scope.qa.draw(wall);
assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);assert.equal(scope.qa.mode,'countdown');
wall=earlyDeadline+1700;scope.qa.draw(wall);
for(let i=1;i<=8&&scope.qa.countdownUntil;i++){wall+=100;fakePlayer.time=2+i*.1;scope.qa.draw(wall);}
assert.equal(scope.qa.countdownUntil,0);wall+=8100;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'paused');assert.equal(elements.get('pauseMessage').querySelector('h2').textContent,'READY?');
assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);fakePlayer.deferSeek=false;
scope.qa.quit();scope.qa.selectSong(1);scope.qa.start(); // deliberately omit onStateChange
for(let i=0;i<30&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time=i*.05;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'countdown','polling recovers a missing PLAYING callback');
scope.qa.quit();
console.log('PASS: failed startup rewinds offer Enter to resume without lost notes; missing player callbacks do not strand loading.');

// Actual note drawing remains present and at the same position while the video
// buffers. The prepared highway must not blink empty on each state transition.
let visualDeadline=prepareHandoff();fakePlayer.time=.02;wall=visualDeadline+20;scope.qa.draw(wall);
const nativeDrawHead=scope.drawNoteHead;let headPositions=[];
scope.drawNoteHead=(ctx,n)=>{headPositions.push([n.x,n.y]);nativeDrawHead(ctx,n);};
wall+=20;scope.qa.draw(wall);const beforeBuffer=headPositions;assert.ok(beforeBuffer.length>0);
fakePlayer.state=3;
for(let i=0;i<6;i++){headPositions=[];wall+=100;scope.qa.draw(wall);assert.deepEqual(headPositions,beforeBuffer);}
assert.equal(scope.qa.mode,'buffering');assert.equal(scope.qa.stats.miss,0);scope.drawNoteHead=nativeDrawHead;scope.qa.quit();

// Canvas width/height assignment clears its bitmap. ResizeObserver can deliver
// the same dimensions more than once; those deliveries must not clear a frame.
const game=elements.get('game');let bitmapWidth=0,bitmapHeight=0,bitmapResets=0;
Object.defineProperty(game,'width',{configurable:true,get:()=>bitmapWidth,set:value=>{bitmapWidth=value;bitmapResets++;}});
Object.defineProperty(game,'height',{configurable:true,get:()=>bitmapHeight,set:value=>{bitmapHeight=value;bitmapResets++;}});
game.getBoundingClientRect=()=>({width:600,height:535});scope.qa.resize();assert.equal(bitmapResets,2);
scope.qa.resize();scope.qa.resize();assert.equal(bitmapResets,2);
game.getBoundingClientRect=()=>({width:601,height:535});scope.qa.resize();assert.equal(bitmapResets,3);
console.log('PASS: buffering keeps all note heads frozen and visible; unchanged resize notifications never clear the canvas.');

// A queued timestamp from before the count can arrive before the real first
// frame. It must fit the time elapsed since playVideo, not just a fixed window.
let queuedDeadline=prepareHandoff();fakePlayer.time=.23;wall=queuedDeadline-80;scope.qa.draw(wall);
assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.clock,0);
fakePlayer.time=.02;wall+=20;scope.qa.draw(wall);assert.equal(scope.qa.mode,'countdown');
fakePlayer.time=.04;wall+=20;scope.qa.draw(wall);assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.clock,.04);

// Short startup state changes still freeze the clock and mute immediately,
// but must not flash a loading overlay/text for a 200ms interruption.
let graceDeadline=prepareHandoff();wall=graceDeadline+320;fakePlayer.time=.32;scope.qa.draw(wall);
fakePlayer.time=0;wall+=20;scope.qa.draw(wall);assert.equal(scope.qa.mode,'buffering');
assert.equal(scope.qa.clock,.32);assert.equal(volumes.at(-1),0);
assert.equal(elements.get('videoLoading').classList.contains('hidden'),true);assert.equal(elements.get('playState').textContent,'NOW PLAYING');
wall+=200;fakePlayer.time=.37;scope.qa.draw(wall);assert.equal(scope.qa.mode,'running');
assert.equal(elements.get('videoLoading').classList.contains('hidden'),true);assert.equal(scope.qa.stats.miss,0);assert.equal(volumes.at(-1),50);
fakePlayer.time=0;wall+=20;scope.qa.draw(wall);assert.equal(scope.qa.mode,'buffering');
wall+=320;scope.qa.draw(wall);assert.equal(elements.get('videoLoading').classList.contains('hidden'),false);
assert.equal(elements.get('playState').textContent,'動画読み込み中');assert.equal(scope.qa.clock,.37);assert.equal(scope.qa.stats.miss,0);scope.qa.quit();
console.log('PASS: stale startup timestamps cannot run ahead of the play command; 200ms transitions never flash loading while real stalls still show it.');
