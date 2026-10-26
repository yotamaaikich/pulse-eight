import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {difficultyMetrics,orderedSongs} from '../catalog.mjs';
import * as engine from '../engine.mjs';
import {projectPoint} from '../geometry.mjs';
import {PlaybackGate} from '../playback.mjs';
import {drawAirRibbons,drawAirHead} from '../air.mjs';
let wall=0;const elements=new Map(),storage=new Map(),volumes=[],listeners=new Map();
const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
function element(id){if(!elements.has(id)){const classes=new Set();elements.set(id,{classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle(n,on){if(on)classes.add(n);else classes.delete(n);}},textContent:'',value:'',innerHTML:'',style:{},open:false,setAttribute(){},addEventListener(){},replaceChildren(){},append(){},focus(){},close(){this.open=false;},showModal(){this.open=true;},getContext:()=>context2d,querySelector:()=>({textContent:''})});}return elements.get(id);}
const document={getElementById:element,querySelectorAll:()=>[],querySelector:()=>elements.get('changeTrackDialog')?.open?elements.get('changeTrackDialog'):null,createElement:()=>element('generated'),addEventListener:(key,fn)=>listeners.set(key,fn),body:element('body'),head:{append(){}},hidden:false};
const fakePlayer={time:0,state:5,options:null,setVolume:v=>volumes.push(v),setPlaybackRate(){},loadVideoById(){this.time=0;this.state=1;},cueVideoById(){},seekTo(t){this.time=t;},pauseVideo(){this.state=2;},playVideo(){this.state=1;},getCurrentTime(){return this.time;},getPlayerState(){return this.state;}};
const window={addEventListener(){},scrollTo(){},YT:{Player:function(id,options){fakePlayer.options=options;return fakePlayer;}}};
const scope=vm.createContext({...engine,difficultyMetrics,orderedSongs,projectPoint,PlaybackGate,drawAirRibbons,drawAirHead,API_URL:'https://qa.invalid',PUBLIC_KEY:'qa',document,window,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},crypto:webcrypto,performance:{now:()=>wall},requestAnimationFrame(){},ResizeObserver:class{observe(){}},location:{origin:'http://localhost'},fetch:async(url)=>({ok:true,json:async()=>url.includes('/leaderboard')?{scores:[]}:{runId:'local-mock'}}),AbortSignal,URL,console,setTimeout,clearTimeout});
const source=(await fs.readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .+;\r?\n/gm,'');
vm.runInContext(source+`\nglobalThis.qa={start,draw,finish,pause,resume,requestSelection,confirmSelection,selectSong,selectDifficulty,get mode(){return mode},get clock(){return clock},get stats(){return stats},get selected(){return selected},get difficulty(){return difficulty},get events(){return events},setPractice(chart,diff=2){difficulty=diff;mode='running';clock=1;session=new RhythmSession(chart,5);notes=session.notes;stats=session.stats;events=[];pressed.clear();upperPressed.clear();spaceHeld=false;},setHard(){spaceHeld=false;difficulty=2;mode='running';clock=1;session=new RhythmSession([{t:1,lane:3,flick:true,midi:66}],181);notes=session.notes;stats=session.stats;events=[];pressed.clear();upperPressed.clear();},setClock(t){clock=t;}};`,scope);
window.onYouTubeIframeAPIReady();fakePlayer.options.events.onReady();
scope.qa.start();assert.equal(volumes.at(-1),0);assert.equal(elements.get('videoLoading').classList.contains('hidden'),false);assert.equal(JSON.parse(storage.get('pulse-prefs')).volume,50);
for(wall=0;wall<30000;wall+=100)scope.qa.draw(wall);
assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);assert.equal(volumes.at(-1),0);
fakePlayer.options.events.onStateChange({data:0});assert.ok(['buffering','loading'].includes(scope.qa.mode));
fakePlayer.time=10;for(let i=0;i<20;i++){wall+=50;fakePlayer.time+=.05;scope.qa.draw(wall);}assert.equal(scope.qa.clock,0);
fakePlayer.time=0;fakePlayer.options.events.onStateChange({data:1});
for(let i=0;i<15&&scope.qa.mode!=='countdown';i++){wall+=50;fakePlayer.time=i*.05;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.clock,0);assert.equal(volumes.at(-1),0);
const countStart=wall;for(let i=0;i<29;i++){wall+=100;scope.qa.draw(wall);}
assert.equal(scope.qa.mode,'countdown');assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);
wall=countStart+3000;scope.qa.draw(wall);assert.equal(scope.qa.mode,'loading');assert.equal(fakePlayer.time,0);
function becomeRunning(){fakePlayer.state=1;fakePlayer.options.events.onStateChange({data:1});for(let i=0;i<100&&scope.qa.mode!=='running';i++){wall+=50;const wasCountdown=scope.qa.mode==='countdown';if(fakePlayer.state===1)fakePlayer.time+=.05;scope.qa.draw(wall);if(wasCountdown&&scope.qa.mode==='loading'&&fakePlayer.state===1)fakePlayer.options.events.onStateChange({data:1});}assert.equal(scope.qa.mode,'running');}
becomeRunning();
assert.equal(scope.qa.mode,'running');assert.equal(volumes.at(-1),50);
for(let i=0;i<650;i++){wall+=100;fakePlayer.time+=.1;scope.qa.draw(wall);}assert.equal(scope.qa.mode,'running');assert.ok(scope.qa.clock>60);
fakePlayer.options.events.onStateChange({data:2});assert.equal(scope.qa.mode,'buffering');assert.equal(volumes.at(-1),0);
becomeRunning();
assert.equal(scope.qa.mode,'running');const frozenTime=scope.qa.clock;
for(let i=0;i<50;i++){wall+=100;scope.qa.draw(wall);}assert.equal(scope.qa.mode,'buffering');assert.equal(scope.qa.clock,frozenTime);
elements.get('volume').value='0';elements.get('volume').oninput();becomeRunning();assert.equal(volumes.at(-1),0);assert.equal(JSON.parse(storage.get('pulse-prefs')).volume,0);
// Change requests keep the paused game intact until explicitly confirmed.
scope.qa.pause();const before=scope.qa.clock,stats=scope.qa.stats;scope.qa.selectSong(1);assert.equal(elements.get('changeTrackDialog').open,true);assert.equal(scope.qa.selected,0);assert.equal(scope.qa.clock,before);assert.equal(scope.qa.stats,stats);elements.get('changeTrackDialog').close();assert.equal(scope.qa.mode,'paused');
scope.qa.selectDifficulty(2);assert.equal(scope.qa.difficulty,1);scope.qa.confirmSelection();assert.equal(scope.qa.mode,'idle');assert.equal(scope.qa.difficulty,2);assert.equal(scope.qa.clock,0);assert.equal(scope.qa.stats.miss,0);
const key=(code,shiftKey=false)=>({code,key:code,shiftKey,preventDefault(){},target:{closest(){return null;}}});
assert.ok(!/createPiano|piano\.start|testPiano/.test(source),'no synthetic keyboard audio remains');
const down=code=>listeners.get('keydown')(key(code)),up=code=>listeners.get('keyup')(key(code));
scope.qa.setHard();down('KeyF');scope.qa.setClock(1.08);down('Space');up('Space');up('KeyF');assert.equal(scope.qa.mode,'running');assert.equal(scope.qa.stats.perfect,1);assert.deepEqual(Array.from(scope.qa.events,e=>Array.from(e)),[[1000,3,1],[1080,0,4],[1080,3,2],[1080,0,5],[1080,3,3],[1080,3,0]]);
// Space alone never scores; holding it allows fresh lane presses across the chart.
scope.qa.setPractice([{t:1,lane:3,flick:true},{t:1.5,lane:4,flick:true}]);down('Space');assert.equal(scope.qa.stats.perfect,0);down('KeyF');up('KeyF');scope.qa.setClock(1.5);down('KeyJ');up('KeyJ');up('Space');assert.equal(scope.qa.stats.perfect,2);
assert.equal(engine.scoreChartReplay([{t:1,lane:3,flick:true},{t:1.5,lane:4,flick:true}],5,Array.from(scope.qa.events,e=>Array.from(e))).maxCombo,2);
// Releasing Space does not release an ordinary long note.
scope.qa.setPractice([{t:1,lane:3,end:2},{t:1.5,lane:4,flick:true}]);down('KeyF');scope.qa.setClock(1.3);down('Space');scope.qa.setClock(1.5);down('KeyJ');up('KeyJ');up('Space');assert.equal(scope.qa.stats.miss,0);scope.qa.setClock(2);up('KeyF');assert.equal(scope.qa.stats.perfect,2);
// Both held lanes can flick on one Space press; old upper-row keys do not score.
scope.qa.setPractice([{t:1,lane:3,flick:true},{t:1,lane:4,flick:true}]);down('KeyF');down('KeyJ');down('KeyR');up('KeyR');assert.equal(scope.qa.stats.perfect,0);down('Space');assert.equal(scope.qa.stats.perfect,2);up('Space');up('KeyF');up('KeyJ');
console.log('PASS: 3-second count-in, full-song play, Space flicks and sweeps, replay scoring, simultaneous flicks, held notes, upper-row removal and music-only playback.');

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
