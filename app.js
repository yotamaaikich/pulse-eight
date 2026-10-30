import {createAccount} from './auth.mjs?v=desktop-32';
import {initDesktop} from './desktop-ui.mjs?v=desktop-31';
import {createInputMixer,bindTouchInput} from './touch.mjs?v=desktop-31';
import {MONITORING_PIANO_PROFILE} from './monitoring-vocal.mjs?v=library-review-11';
import {nextLife,MAX_LIFE} from './life.mjs?v=luminous-2';
import {drawKeyboard,keyboardStrikeY} from './keyboard.mjs?v=compact-1';
import {NOTE_COLORS,drawNoteHead,drawPerfectHit,drawCombo,drawJudgment} from './note-style.mjs?v=combo-27';
import {importPianoScore,validatePianoProfile} from './score-import.mjs?v=melody-score-1';
import {createPianoSound} from './piano-sound.mjs?v=source-piano-15';
import {pianoFeedbackAt} from './source-piano.mjs?v=hands-19';
import {keySoundRequests} from './key-sound.mjs?v=source-piano-15';
import {noteTravelSeconds,leadInSeconds,leadInClock} from './lead-in.mjs?v=approach-13';
import {PIANO_TRIAL_SONG} from './piano-trial.mjs?v=hands-19';
import {difficultyMetrics,orderedSongs} from './catalog.mjs?v=startup-34';
import {createChartPreparation} from './chart-preparation.mjs?v=startup-34';
import {drawAirRibbons,drawAirHead} from './air.mjs?v=desktop-31';
import {SONGS,DIFFICULTIES,newStats,summary,CHART_VERSION,RhythmSession,isFullCombo} from './engine.mjs?v=desktop-31';
import {API_URL,PUBLIC_KEY} from './config.js';
import {projectPoint} from './geometry.mjs';
import {PlaybackGate,inputClock,expectedVideo,countdownFrame,startupBufferReady} from './playback.mjs?v=startup-34';

const $=id=>document.getElementById(id);
const DEFAULT_KEYS=['KeyA','KeyS','KeyD','KeyF','KeyJ','KeyK','KeyL','Semicolon'];
const DEFAULTS={speed:1,volume:50,mixVersion:1,pianoOn:true,pianoLevel:18,offset:0,touchControls:!!(window.matchMedia?.('(any-pointer: coarse)')?.matches||window.navigator?.maxTouchPoints),keys:DEFAULT_KEYS};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage is optional. */}};
const savedPrefs=read('pulse-prefs',{});
let prefs={...DEFAULTS,...savedPrefs};delete prefs.notation;
if(savedPrefs.mixVersion!==1&&Number.isFinite(savedPrefs.volume))prefs.volume=Math.round(savedPrefs.volume*.7);prefs.mixVersion=1;
delete prefs.pianoVolume;
prefs.pianoOn=prefs.pianoOn===true;
prefs.pianoLevel=Math.max(0,Math.min(100,Number(prefs.pianoLevel)||0));
const pianoSound=createPianoSound();
const chartPreparation=createChartPreparation();
function configurePiano(){pianoSound.configure({enabled:prefs.pianoOn,volume:prefs.pianoLevel});}
configurePiano();
const pianoProfiles=Object.create(null);
for(const track of SONGS){try{const stored=read('pulse-piano-score:'+track.id,null)??(track.id===PIANO_TRIAL_SONG?read('pulse-monitoring-piano-score',null):null);if(stored)pianoProfiles[track.id]=validatePianoProfile(stored);}catch{}}
const currentPianoProfile=()=>song().id==='monitoring'?MONITORING_PIANO_PROFILE:pianoProfiles[song().id]??null;
if(!Array.isArray(prefs.keys)||prefs.keys.length!==8||new Set(prefs.keys).size!==8||prefs.keys.some(code=>['Space','KeyV','KeyR','KeyO'].includes(code)))prefs.keys=[...DEFAULT_KEYS];
prefs.speed=Math.min(2,Math.max(.5,Number(prefs.speed)||1));
prefs.offset=Math.min(500,Math.max(-500,Number(prefs.offset)||0));
prefs.volume=Math.min(100,Math.max(0,Number(prefs.volume)||0));
let token=read('pulse-device',null);
if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');write('pulse-device',token);}
let name=read('pulse-name','PLAYER-'+token.slice(0,4).toUpperCase());
if(typeof name!=='string')name='PLAYER';
let bestStorage='pulse-bests',bests=read(bestStorage,{}),accountUser=null,accountPending=undefined,runOwner=null;
let account=null,accountRequest=0;
let selected=0,difficulty=1,mode='idle',session=null,notes=[],stats=newStats(),events=[],runId=null,runPromise=null,eligible=true;
let life=MAX_LIFE;
let libraryPack='all',librarySearch='',spaceHeld=false;
let librarySort=read('pulse-sort','library');
let ready=false,player=null,clock=0,lastFrame=performance.now(),sequence=0;
let chartPending=false,chartWarmTimer,bufferReadySince=null;
let lastJudge='',judgeAt=0,judgeDelta=0,toastTimer,remapping=false,remapKeys=[],leaderRequest=0,submitted=false;
const pressed=new Set(),upperPressed=new Set(),flashes=Array(8).fill(-Infinity),blackFlashes=Array(5).fill(-Infinity),particles=[],perfectHits=Array(8).fill(null);
const comboPulse={value:0,at:-Infinity};
const canvas=$('game'),ctx=canvas.getContext('2d');
const inputMixer=createInputMixer({
  down(lane){pressed.add(lane);hit(lane);if(difficulty===2&&spaceHeld){upperPressed.add(lane);hitUpper(lane);}},
  up(lane){pressed.delete(lane);releaseLane(lane,mode==='buffering');if(upperPressed.delete(lane))releaseUpper(lane,mode==='buffering');},
  pedal(on){spaceHeld=on;$('touchPedal').classList.toggle('pressed',on);$('touchPedal').setAttribute('aria-pressed',String(on));if(difficulty===2)spaceInput(on,mode==='buffering');if(on){if(difficulty===2)for(const lane of pressed){upperPressed.add(lane);hitUpper(lane);}}else{for(const lane of upperPressed)releaseUpper(lane,mode==='buffering');upperPressed.clear();}}
});
const touchInput=bindTouchInput({canvas,pedal:$('touchPedal'),mixer:inputMixer,enabled:()=>['running','buffering','countdown','paused'].includes(mode),beforeBlur:()=>{if(['running','buffering','loading','countdown'].includes(mode))pause();},window});
function clearControls(){inputMixer.reset(true);touchInput.reset();pressed.clear();upperPressed.clear();spaceHeld=false;$('touchPedal').classList.remove('pressed');$('touchPedal').setAttribute('aria-pressed','false');}

const playback=new PlaybackGate();let appliedVolume=null,playbackArmed=false,countdownUntil=0,countdownSettledAt=null,countdownStarting=false,countdownProbeRaw=null,countdownPlayAt=0,countdownRepaired=false,bufferingSince=null,hasCountedIn=false;
let countdownWaiting=false,countdownRecoveryRequested=false,countdownPreparedAt=0,countdownRecoveries=0,chartVisible=false;
let W=600,H=535,dpr=1;
const label=code=>({Semicolon:';',Comma:',',Period:'.',Slash:'/'}[code]|| (code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):code));
const song=()=>SONGS[selected];
const formatTime=seconds=>String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')+':'+String(Math.floor(Math.max(0,seconds))%60).padStart(2,'0');
const resetTimer=()=>{$('timer').textContent='00:00 / '+formatTime(song().duration);};
const scoreKey=()=>`${CHART_VERSION}:${song().id}:${difficulty}`;
const fmt=n=>n.toLocaleString('en-US');
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function savePrefs(){document.body.classList.toggle('touch-controls-on',prefs.touchControls===true);configurePiano();write('pulse-prefs',prefs);$('speedLabel').textContent=`SPEED ${prefs.speed.toFixed(1)}×`;syncSettings();renderKeyGuide();}
async function toggleFullscreen(){if(document.body.classList.contains('chart-expanded')){document.body.classList.remove('chart-expanded');syncExpandedControls();return;}try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen({navigationUI:'hide'});}catch{document.body.classList.add('chart-expanded');}syncExpandedControls();}
function syncExpandedControls(){const on=!!document.fullscreenElement||document.body.classList.contains('chart-expanded');$('fullscreenButton').setAttribute('aria-pressed',String(on));$('fullscreenButton').setAttribute('aria-label',on?'譜面の全画面を終了':'譜面を全画面にする');$('fullscreenButton').innerHTML=(on?'⛶ 戻す':'⛶ 譜面全画面')+' <kbd>V</kbd>';$('playFullscreen').textContent=(on?'⛶ 戻す':'⛶ 譜面全画面')+' [V]';}
document.addEventListener('fullscreenchange',syncExpandedControls);
function renderKeyGuide(){for(let hand=0;hand<2;hand++){$(hand?'rightKeys':'leftKeys').innerHTML=prefs.keys.slice(hand*4,hand*4+4).map(code=>`<span class="guide-key"><kbd data-key="${code}">${label(code)}</kbd></span>`).join('');}$('mappingKeys').innerHTML=prefs.keys.map((code,i)=>`<kbd class="${remapping&&i===remapKeys.length?'current':''}">${remapping?(remapKeys[i]?label(remapKeys[i]):'·'):label(code)}</kbd>`).join('');}
function renderPianoStatus(){
  const profile=currentPianoProfile(),on=prefs.pianoOn&&prefs.pianoLevel>0;
  $('pianoTrialStatus').textContent=(on?'鍵盤音 ON · '+prefs.pianoLevel+'%':'鍵盤音 OFF')+(profile?' · '+profile.title:' · 曲別ピアノ（音声からの推定）');
}
function syncSettings(){$('touchControls').checked=prefs.touchControls===true;renderPianoStatus();const pianoProfile=currentPianoProfile();$('pianoScoreDetails').hidden=song().id==='monitoring';for(const key of ['speed','volume','pianoLevel','offset']){$(key).value=prefs[key];$(key+'Output').textContent=key==='speed'?prefs[key].toFixed(1)+'×':key==='volume'?prefs[key]+'%':prefs[key]+' ms';}$('pianoOn').checked=prefs.pianoOn;$('pianoLevelOutput').textContent=prefs.pianoLevel+'%';$('testPiano').disabled=!prefs.pianoOn||!prefs.pianoLevel;$('testSongPiano').disabled=!prefs.pianoOn||!prefs.pianoLevel;$('pianoScoreStatus').textContent=pianoProfile?pianoProfile.title+' · '+pianoProfile.voices.reduce((sum,v)=>sum+v.length,0)+'音 読込済み':'曲別ピアノ読込済み · 公式音声からの音高推定';}
function setName(){ $('playerName').textContent=name;$('nameInput').value=name; }
function visibleSongs(){const query=librarySearch.trim().toLocaleLowerCase('ja');return orderedSongs(SONGS,libraryPack,difficulty,librarySort).filter(({s})=>!query||[s.title,s.artist,s.vocal].some(value=>String(value??'').toLocaleLowerCase('ja').includes(query)));}
function renderSongs(){
  const choices=visibleSongs();
  $('songs').innerHTML=choices.map(({s,i})=>`<button class="song ${i===selected?'selected':''}" data-song="${i}" aria-pressed="${i===selected}" style="--song-color:${s.color}"><span class="song-art" aria-hidden="true" style="background-color:${s.color}"><img data-jacket src="https://i.ytimg.com/vi/${s.video}/mqdefault.jpg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span><span class="song-info"><strong>${s.title}</strong><small>${s.artist}</small></span><span class="song-level"><b>LV.${difficultyMetrics(s,difficulty).level}</b><small>${difficultyMetrics(s,difficulty).count} NOTES</small></span></button>`).join('')||'<p class="search-empty">該当する曲がありません。<br>曲名や作者名を変えて検索してください。</p>';
  $('trackCount').textContent=choices.length+' TRACKS';
  document.querySelectorAll('[data-jacket]').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;}));
  document.querySelectorAll('[data-pack]').forEach(button=>{button.classList.toggle('active',button.dataset.pack===libraryPack);button.setAttribute('aria-pressed',String(button.dataset.pack===libraryPack));});
  document.querySelectorAll('[data-song]').forEach(b=>b.addEventListener('click',()=>selectSong(Number(b.dataset.song))));
}
function moveSong(direction){const choices=visibleSongs().map(({i})=>i),current=choices.indexOf(selected);if(!choices.length)return;selectSong(choices[current<0?(direction>0?0:choices.length-1):(current+direction+choices.length)%choices.length]);}
function queueChartWarmup(){clearTimeout(chartWarmTimer);chartWarmTimer=setTimeout(()=>{if(mode==='idle')chartPreparation.prepare(song(),difficulty,currentPianoProfile());},120);}
function selectSong(index){
  if(mode!=='idle'){const target=(index+SONGS.length)%SONGS.length;if(target!==selected)requestSelection(target,difficulty);return;}
  if(mode!=='idle')return;const previous=selected;selected=(index+SONGS.length)%SONGS.length;renderSongs();const s=song();
  const list=$('songs'),row=list.querySelector('.song.selected');
  if(row&&Number.isFinite(row.offsetTop)){const top=row.offsetTop-list.offsetTop;if(top<list.scrollTop)list.scrollTop=top;else if(top+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=top+row.offsetHeight-list.clientHeight;}
  syncSettings();$('trackTitle').textContent=s.title;$('trackArtist').textContent=s.artist+' / '+s.vocal;$('bpm').textContent=s.bpm;$('miniArt').style.background=s.color;$('miniArt').style.backgroundImage=`url("https://i.ytimg.com/vi/${s.video}/mqdefault.jpg")`;
  $('originalLink').href='https://www.youtube.com/watch?v='+s.video;$('sheetLink').href='https://www.youtube.com/watch?v='+s.video;$('sheetLink').textContent='譜面の参照音源 ↗';$('chartInfo').textContent=s.chartLabel||'公開採譜を参考にした簡略フレーズ';resetTimer();
  if(ready&&previous!==selected)player.cueVideoById(s.video);updateChartControls();updateBest();loadLeaders();queueChartWarmup();
}
function selectDifficulty(index){if(mode!=='idle'){const target=(index+3)%3;if(target!==difficulty)requestSelection(selected,target);return;}if(mode!=='idle')return;difficulty=(index+3)%3;document.querySelectorAll('[data-difficulty]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.difficulty)===difficulty);b.setAttribute('aria-pressed',Number(b.dataset.difficulty)===difficulty);});updateChartControls();renderSongs();updateBest();loadLeaders();queueChartWarmup();}
function requestSelection(nextSong=selected,nextDifficulty=difficulty){
  if(['running','buffering','loading','countdown'].includes(mode))pause();
  if(!['paused','results'].includes(mode))return;
  $('changeScoreWarning').textContent=submitted?'このスコアはランキングに登録済みです。曲・難易度を変更しますか？':'スコアは記録されませんが、よろしいですか？';
  $('changeProgressWarning').textContent=mode==='results'?'未登録のスコアはランキングに送信されません。端末の自己ベストは残ります。':'今のプレイ（スコア・コンボ・進行状況）がリセットされます。';
  $('changeSong').replaceChildren();for(const [index,track]of SONGS.entries()){const option=document.createElement('option');option.value=index;option.textContent=track.title;$('changeSong').append(option);}
  $('changeSong').value=nextSong;$('changeDifficulty').value=nextDifficulty;updateSelectionWarning();$('changeTrackDialog').showModal();
}
function updateSelectionWarning(){const changed=Number($('changeSong').value)!==selected||Number($('changeDifficulty').value)!==difficulty;$('confirmTrackChange').disabled=!changed;}
function confirmSelection(){if(!['paused','results'].includes(mode)||$('confirmTrackChange').disabled)return;const nextSong=Number($('changeSong').value),nextDifficulty=Number($('changeDifficulty').value);$('changeTrackDialog').close();quit();selectSong(nextSong);selectDifficulty(nextDifficulty);toast('プレイをリセットして変更しました。Enterでスタート');}
function updateBest(){const b=bests[scoreKey()];$('personalBest').textContent=b?fmt(b.score):'—';}
async function api(path,body,owner=null){const authHeaders=await account?.headers(owner)??{};const response=await fetch(API_URL+path,{method:body?'POST':'GET',headers:{apikey:PUBLIC_KEY,...authHeaders,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'クラウドへ接続できませんでした');return data;}
async function loadLeaders(){
  const request=++leaderRequest;$('leaders').innerHTML='<li class="empty-state">ランキングを読み込み中…</li>';
  try{
    const data=await api(`/leaderboard?song=${song().id}&difficulty=${difficulty}`);if(request!==leaderRequest)return;
    $('cloudStatus').textContent='ONLINE';$('leaders').replaceChildren();
    if(!data.scores?.length){const li=document.createElement('li');li.className='empty-state';li.textContent='まだ記録がありません。最初のスコアを刻もう。';$('leaders').append(li);return;}
    data.scores.forEach((row,i)=>{const li=document.createElement('li'),num=document.createElement('span'),person=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),score=document.createElement('span');num.className='leader-num';num.textContent=String(i+1).padStart(2,'0');person.className='leader-person';strong.textContent=row.name;small.textContent=row.accuracy.toFixed(2)+'% · '+row.max_combo+' COMBO';person.append(strong,small);score.className='leader-score';score.textContent=fmt(row.score);li.append(num,person,score);$('leaders').append(li);});
  }catch{if(request!==leaderRequest)return;$('cloudStatus').textContent='OFFLINE';$('leaders').innerHTML='<li class="empty-state">接続できませんでした。↻ で再読み込みできます。</li>';}
}
function updateChartControls(){document.body.classList.toggle('touch-hard',difficulty===2);
  const metric=difficultyMetrics(song(),difficulty);
  $('leaderDifficulty').textContent=DIFFICULTIES[difficulty]+' LV.'+metric.level;
  $('difficultySummary').textContent=DIFFICULTIES[difficulty]+' · '+metric.count+' NOTES · LV.'+metric.level;
  document.querySelectorAll('[data-difficulty]').forEach(button=>{const d=Number(button.dataset.difficulty),info=difficultyMetrics(song(),d);button.querySelector('span').textContent='LV.'+info.level;button.title=info.count+'ノーツ（100ノーツごとにレベル+2）';button.disabled=false;button.classList.toggle('active',d===difficulty);button.setAttribute('aria-pressed',String(d===difficulty));});
}
function setText(id,text){if($(id).textContent!==text)$(id).textContent=text;}
function stateText(text){setText('playState',text);$('googleSignIn').disabled=mode!=='idle';$('googleSignOut').disabled=mode!=='idle';}
function bufferingGrace(now=performance.now()){return mode==='buffering'&&bufferingSince!==null&&now-bufferingSince<300;}
function playbackOverlays(now=performance.now()){
  const waiting=mode==='loading'||mode==='buffering'&&!bufferingGrace(now)||mode==='countdown'&&(!countdownUntil||countdownWaiting);
  $('videoLoading').classList.toggle('hidden',!waiting);$('playCountdown').classList.toggle('hidden',mode!=='countdown'||!countdownUntil||countdownWaiting);
}
function show(id){for(const name of ['stageMessage','pauseMessage','resultMessage'])$(name).classList.toggle('hidden',name!==id);playbackOverlays();updateChartControls();}
function hasExpectedVideo(){return expectedVideo({url:player.getVideoUrl?.(),duration:player.getDuration?.()},song());}
function applyVolume(){if(!ready)return;const volume=['loading','buffering','countdown'].includes(mode)?0:prefs.volume;if(appliedVolume!==volume){player.setVolume(volume);appliedVolume=volume;}}
function waitForVideo(){if(!['running','buffering','loading'].includes(mode))return;pianoSound.stop();bufferingSince??=performance.now();mode='buffering';playback.hold(performance.now());show(null);stateText(bufferingGrace()?'NOW PLAYING':'動画読み込み中');applyVolume();}
function beginCountdown(now){
  mode='countdown';countdownUntil=0;countdownSettledAt=null;countdownStarting=false;countdownProbeRaw=null;countdownRepaired=false;bufferingSince=null;playbackArmed=false;countdownWaiting=false;countdownPreparedAt=now;
  player.pauseVideo();player.seekTo(clock,true);player.pauseVideo();$('countdownNumber').textContent='3';show(null);stateText('動画読み込み中');applyVolume();
}
function awaitCountdownVideo(now){
  countdownWaiting=true;countdownRecoveryRequested=false;countdownStarting=true;countdownProbeRaw=null;playback.reset(now,clock);
  show(null);stateText('動画読み込み中');applyVolume();
}
function playbackPrompt(){
  mode='paused';countdownStarting=false;countdownWaiting=false;countdownUntil=0;player.pauseVideo();
  show('pauseMessage');$('pauseMessage').querySelector('h2').textContent='READY?';stateText('ENTER TO ALLOW PLAYBACK');toast('再生開始を確認できませんでした。Enterでもう一度再生してください。');
}
function completeCountdown(now,raw){
  clock=Math.max(clock,raw);hasCountedIn=true;playback.resume(now,clock);playbackArmed=true;countdownStarting=false;countdownWaiting=false;countdownRecoveries=0;countdownUntil=0;bufferingSince=null;mode='running';syncHeldKeys();show(null);stateText('NOW PLAYING');applyVolume();canvas.focus();
}
function syncPlayback(now){
  if(!ready||chartPending||!['running','buffering','loading','countdown'].includes(mode))return;
  const raw=player.getCurrentTime(),state=player.getPlayerState(),expected=hasExpectedVideo();
  if(mode==='countdown'){
    if(!expected){if(!countdownWaiting)awaitCountdownVideo(now);playback.hold(now);return;}
    if(countdownWaiting){
      // Leave the final 1 after a real interruption. Wait for fresh progress,
      // then prepare a new count-in, rather than accepting a stale ad clock.
      if([0,2,5].includes(state)&&!countdownRecoveryRequested){countdownRecoveryRequested=true;player.playVideo();return;}
      if(!playback.observe(raw,state,now).waiting){
        if(++countdownRecoveries>2)playbackPrompt();else beginCountdown(now);
      }
      return;
    }
    // Do not start the 3 seconds until the asynchronous rewind has actually settled.
    if(!countdownUntil){
      const settled=state===2&&Number.isFinite(raw)&&Math.abs(raw-clock)<=(clock===0?.04:.25);
      if(!settled){
        countdownSettledAt=null;
        if(state===1&&now-countdownPreparedAt>2000)awaitCountdownVideo(now);
        else if(state===2&&now-countdownPreparedAt>8000)playbackPrompt();
        return;
      }
      countdownSettledAt??=now;
      if(now-countdownSettledAt<150)return;
      const first=notes.find(n=>!n.done&&!n.started&&!n.assist&&n.t>=clock);
      countdownUntil=now+leadInSeconds(prefs.speed,(first?first.t-clock:0)+prefs.offset/1000)*1000;chartVisible=true;show(null);stateText('GET READY');
    }
    const remaining=Math.max(0,Math.ceil((countdownUntil-now)/1000));setText('countdownNumber',remaining>3?'READY':String(remaining||1));stateText(remaining>3?'GET READY':'GET READY · '+Math.max(1,remaining));
    // Send the asynchronous play command just before GO. Keep the final count
    // visible until an actual forward content frame arrives, rather than
    // hiding it into a second loading screen or starting on a stale PLAYING.
    if(!countdownStarting&&now>=countdownUntil-120){countdownStarting=true;countdownPlayAt=now;countdownProbeRaw=player.getCurrentTime();player.playVideo();}
    if(countdownStarting){
      const raw=player.getCurrentTime(),state=player.getPlayerState(),previous=countdownProbeRaw;
      countdownProbeRaw=Number.isFinite(raw)?raw:null;
      const first=notes.find(n=>!n.done&&!n.started&&!n.assist&&n.t+prefs.offset/1000>=clock);
      if(state===1&&countdownFrame(clock,raw,previous,now-countdownPlayAt,first?first.t+prefs.offset/1000:Infinity)){completeCountdown(now,raw);return;}
      // A genuinely stale seek report is repaired once, without resetting the
      // visible countdown or silently skipping the song's first notes.
      if(state===1&&Number.isFinite(raw)&&raw>clock+.25&&!countdownRepaired&&now-countdownPlayAt>=500){countdownRepaired=true;countdownProbeRaw=null;player.seekTo(clock,true);player.playVideo();}
      if(now-countdownPlayAt>=1500)awaitCountdownVideo(now);
    }
    return;
  }
  if(!['running','buffering','loading'].includes(mode))return;
  if(!expected){
    if(mode==='running')waitForVideo();
    hasCountedIn=false;bufferReadySince=null;playback.hold(now);playbackOverlays(now);stateText(bufferingGrace(now)?'NOW PLAYING':'動画読み込み中');return;
  }
  // Poll as well as listen: a late/missing PLAYING callback must not strand loading.
  if(!playbackArmed&&state===1){playbackArmed=true;playback.hold(now);}
  if(!playbackArmed)return;
  // A brief post-count pause already has a verified content origin. Accept its
  // first fresh frame instead of muting and consuming a new .35-second probe.
  if(mode==='buffering'&&hasCountedIn&&bufferingSince!==null&&now-bufferingSince<1500&&state===1&&raw>clock+.0001&&raw<=clock+.25)playback.resume(now,clock);
  const next=playback.observe(raw,state,now);
  if(next.seek)eligible=false;
  if(!next.waiting&&mode!=='running'&&(!hasCountedIn||mode==='loading'||bufferingSince===null||now-bufferingSince>=1500)){
    if(mode==='loading'&&clock===0){
      bufferReadySince??=now;
      if(!startupBufferReady(player.getVideoLoadedFraction?.(),song().duration,now-bufferReadySince)){playbackOverlays(now);stateText('動画読み込み中');return;}
    }
    beginCountdown(now);return;
  }
  clock=next.time;
  if(next.waiting){if(mode==='running'){bufferingSince=now;mode='buffering';pianoSound.stop();show(null);}playbackOverlays(now);stateText(bufferingGrace(now)?'NOW PLAYING':'動画読み込み中');}
  else if(mode!=='running'){bufferingSince=null;mode='running';syncHeldKeys();show(null);stateText('NOW PLAYING');canvas.focus();}
  applyVolume();
}
function start(){
  if(!ready){toast('公式プレイヤーを読み込み中です。準備完了後にEnterを押してください。');return;}
  if(mode==='loading')return;
  if(prefs.pianoOn&&prefs.pianoLevel){pianoSound.warm();pianoSound.prepare().then(ok=>{if(!ok&&prefs.pianoOn&&prefs.pianoLevel)toast('ピアノ音源を読み込めませんでした。設定の試し弾きから確認してください。');});}pianoSound.stop();
  clearTimeout(chartWarmTimer);bufferReadySince=null;const prepared=chartPreparation.prepare(song(),difficulty,currentPianoProfile());
  clearControls();sequence++;const seq=sequence;mode='loading';chartPending=true;countdownUntil=0;countdownStarting=false;hasCountedIn=false;bufferingSince=null;playback.reset(performance.now());playbackArmed=false;document.body.classList.add('focus-play');window.scrollTo({top:0,behavior:'instant'});clock=0;session=null;notes=[];stats=newStats();life=MAX_LIFE;events=[];eligible=true;runId=null;submitted=false;lastJudge='';pressed.clear();particles.length=0;perfectHits.fill(null);
  countdownWaiting=false;countdownRecoveries=0;chartVisible=false;flashes.fill(-Infinity);blackFlashes.fill(-Infinity);
  show(null);$('stage').classList.add('running');$('pauseButton').disabled=false;$('progress').style.width='0%';resetTimer();stateText('動画読み込み中');updateStats();canvas.focus();
  runOwner=accountUser?.id??null;runPromise=api('/start',{song:song().id,difficulty,playerToken:token,version:CHART_VERSION},runOwner).then(data=>{if(seq===sequence)runId=data.runId;}).catch(()=>{if(seq===sequence)toast('クラウドに接続できないため、この回は端末に保存します。');});
  const installChart=chart=>{if(seq!==sequence)return;session=new RhythmSession(chart,song().duration);notes=session.notes;stats=session.stats;chartPending=false;updateStats();};
  if(prepared.chart)installChart(prepared.chart);
  else prepared.promise.then(installChart,()=>{if(seq!==sequence)return;quit();toast('譜面の準備に失敗しました。もう一度お試しください。');});
  // Start video loading in the user's gesture while the worker prepares notes.
  // syncPlayback keeps the clock and judgment frozen until the chart is ready.
  applyVolume();player.setPlaybackRate(1);player.loadVideoById({videoId:song().video,startSeconds:0});
}
function pause(){if(!['running','buffering','loading','countdown'].includes(mode))return;mode='paused';pianoSound.stop();countdownUntil=0;countdownStarting=false;player?.pauseVideo();$('pauseMessage').querySelector('h2').textContent='PAUSED.';show('pauseMessage');stateText('PAUSED');}
function resume(){if(mode!=='paused')return;pianoSound.warm();syncHeldKeys();mode='loading';countdownStarting=false;countdownWaiting=false;countdownRecoveries=0;hasCountedIn=false;bufferingSince=null;playback.reset(performance.now(),clock);playbackArmed=false;show(null);stateText('動画読み込み中');applyVolume();player.playVideo();canvas.focus();}
function quit(){pianoSound.stop();clearControls();sequence++;mode='idle';chartPending=false;session=null;notes=[];stats=newStats();life=MAX_LIFE;events=[];runId=null;eligible=false;clock=0;updateStats();document.body.classList.remove('focus-play');player?.pauseVideo();show('stageMessage');$('stage').classList.remove('running');$('pauseButton').disabled=true;pressed.clear();stateText('READY TO PLAY');applyAccountPending();resetTimer();$('progress').style.width='0%';selectSong(selected);selectDifficulty(difficulty);}
function updateStats(){
  if(stats.combo<comboPulse.value)comboPulse.at=-Infinity;
  else if(Math.floor(stats.combo/100)>Math.floor(comboPulse.value/100))comboPulse.at=performance.now();
  comboPulse.value=stats.combo;
  const count=notes.filter(n=>!n.assist).length||1,result=summary(stats,count);
  const score=String(result.score).padStart(7,'0');
  const judged=stats.perfect+stats.great+stats.good+stats.bad+stats.miss;
  const accuracy=judged?(stats.weight/judged*100).toFixed(2):'—';
  $('score').textContent=score;$('accuracy').innerHTML=accuracy+'<small>%</small>';$('maxCombo').textContent=stats.maxCombo;
  $('lifeValue').textContent=life;$('lifeFill').style.width=(life/MAX_LIFE*100)+'%';$('lifeGauge').setAttribute('aria-valuenow',String(life));$('lifeGauge').classList.toggle('low-life',life<=250);
  $('stageScore').textContent=score;$('stageCombo').textContent=stats.combo;$('stageAccuracy').textContent=accuracy;
}
function finish(){
  if(mode==='results'||mode==='idle')return;mode='results';pianoSound.stop();document.body.classList.remove('focus-play');upperPressed.clear();spaceHeld=false;player.pauseVideo();pressed.clear();applyNotifications(session.finish());updateStats();const count=notes.filter(n=>!n.assist).length,result=summary(stats,count),fullCombo=isFullCombo(stats,count);
  $('resultRank').textContent=result.rank;$('resultScore').textContent=String(result.score).padStart(7,'0');$('resultDetail').textContent=`${result.accuracy.toFixed(2)}% ACCURACY / ${result.maxCombo} MAX COMBO`;
  $('resultCounts').innerHTML=['perfect','great','good','bad','miss'].map(key=>`<span>${key.toUpperCase()}<b>${stats[key]}</b></span>`).join('');$('fullComboBadge').hidden=!fullCombo;
  const previous=bests[scoreKey()],isBest=!previous||result.score>previous.score;if(isBest){bests[scoreKey()]=result;write(bestStorage,bests);}$('bestBadge').style.display=isBest?'':'none';
  $('saveScore').disabled=!eligible;
  $('saveScore').textContent=!eligible?'練習プレイ（シーク・速度変更あり）':'ランキングに登録 [S]';
  $('saveStatus').textContent='名前とスコアが公開されます';show('resultMessage');$('pauseButton').disabled=true;stateText('TRACK COMPLETE');$('progress').style.width='100%';updateBest();
}
async function saveScore(){
  if(mode!=='results'||submitted||!eligible)return;
  const seq=sequence,recorded=events.map(e=>[...e]);$('saveScore').disabled=true;$('saveStatus').textContent='クラウドへ登録中…';
  try{await runPromise;if(seq!==sequence)return;if(!runId)throw new Error('接続できませんでした。次のプレイで再度お試しください。');
    const result=await api('/submit',{runId,playerToken:token,name,events:recorded},runOwner);if(seq!==sequence)return;submitted=true;
    {$('saveScore').textContent=result.improved?'ランキング登録完了':'自己ベストをキープ';$('saveStatus').textContent='保存しました。ランキングを更新しました。';toast('クラウドにスコアを保存しました');}loadLeaders();
  }catch(error){if(seq!==sequence)return;$('saveScore').disabled=false;$('saveStatus').textContent=error.message;}
}
function time(){return clock;}
function recordEvent(t,lane,action){const ms=Math.round(t*1000);if(ms<0||ms>song().duration*1000+200)return false;events.push([Math.max(ms,events.at(-1)?.[0]||0),lane,action]);return true;}
function applyNotifications(list){
  const now=performance.now();let changed=false;
  for(const event of list){
    life=nextLife(life,event);
    if(event.result==='perfect'&&['judge','holdstart','flickstart'].includes(event.kind))perfectHits[event.note.lane]={at:now,float:!!event.note.flick};
    if(event.kind==='assist'){blackFlashes[event.note.blackIndex]=now;continue;}
    if(event.kind==='holdstart'||event.kind==='flickstart'){lastJudge=event.result;judgeDelta=Math.round(event.delta*1000);judgeAt=now;continue;}
    if(event.kind==='holdtick'){changed=true;continue;}
    if(event.kind==='airbreak'){changed=true;lastJudge='airbreak';judgeAt=now;toast('FLOATの帯がないところではSpaceを離してください');continue;}
    if(event.kind!=='judge')continue;
    changed=true;lastJudge=event.result;judgeDelta=Math.round(event.delta*1000);judgeAt=now;
    if(event.result!=='miss'){
      const x=(event.note.lane+.5)*W/8,perfect=event.result==='perfect',color=perfect&&event.note.flick?NOTE_COLORS.float:event.note.lane<4?NOTE_COLORS.left:NOTE_COLORS.right;
      for(let i=0;i<(perfect?18:9);i++)particles.push({x,y:keyboardStrikeY(W,H)+2,vx:(Math.random()-.5)*(perfect?4:2.5),vy:-Math.random()*(perfect?6:4)-1,life:1,color:perfect&&i%3===0?'#f5ffff':color,size:perfect?1.5+Math.random()*1.5:2,spark:perfect});
      if(particles.length>256)particles.splice(0,particles.length-256);
    }
  }
  if(changed)updateStats();
}
function inputTime(){const current=mode==='running'&&ready?inputClock(clock,player.getCurrentTime(),player.getPlayerState(),performance.now()-lastFrame):clock;return Math.round((current-prefs.offset/1000)*1000)/1000;}
function syncHeldKeys(){
  if(!session)return;
  if(session.spaceHeld!==spaceHeld)spaceInput(spaceHeld,true);
  for(const lane of [...session.down])if(!pressed.has(lane))releaseLane(lane,true);
  for(const lane of pressed)if(!session.down.has(lane)){const t=inputTime();if(recordEvent(t,lane,1))applyNotifications(session.press(t,lane));}
  if(difficulty===2){
    for(const lane of [...session.upperDown])if(!upperPressed.has(lane))releaseUpper(lane,true);
    for(const lane of upperPressed)if(!session.upperDown.has(lane)){const t=inputTime();if(recordEvent(t,lane,2))applyNotifications(session.pressFlick(t,lane));}
  }
}
function playAttack(list,float=false){
  let started=0;for(const request of keySoundRequests(list,float))if(pianoSound.play(request))started++;return started;
}
function hit(lane){flashes[lane]=performance.now();if(mode!=='running')return;const t=inputTime(),list=recordEvent(t,lane,1)?session.press(t,lane):[];if(!playAttack(list)){const feedback=pianoFeedbackAt(song(),t,lane);if(feedback)pianoSound.play(feedback);}applyNotifications(list);}
function releaseLane(lane,force=false){if(mode!=='running'&&!force)return;const t=inputTime();if(recordEvent(t,lane,0))applyNotifications(session.release(t,lane));}
function spaceInput(down,force=false){if(mode!=='running'&&!force)return;const t=inputTime();if(recordEvent(t,0,down?4:5))applyNotifications(session[down?'pressSpace':'releaseSpace'](t));}
function hitUpper(lane){if(mode!=='running')return;const t=inputTime();if(recordEvent(t,lane,2)){const list=session.pressFlick(t,lane);playAttack(list,true);applyNotifications(list);}}
function releaseUpper(lane,force=false){if(mode!=='running'&&!force)return;const t=inputTime();if(recordEvent(t,lane,3))applyNotifications(session.releaseFlick(t,lane));}
function loadPlayer(){
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  script.onerror=()=>{stateText('VIDEO CONNECTION FAILED');$('startHint').textContent='YouTubeに接続できません。回線を確認してページを再読み込みしてください。';};
  window.onYouTubeIframeAPIReady=()=>{
    player=new window.YT.Player('youtubePlayer',{width:'100%',height:'100%',videoId:song().video,playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin},events:{
      onReady:()=>{ready=true;applyVolume();$('startHint').textContent='ENTERでスタート · ノーツは奥から流れます';$('videoStatus').innerHTML='音楽はYouTubeの公式動画から再生します。<br>再生前・再生中に広告が入る場合があります。';},
      onStateChange:event=>{
        if(event.data===1){
          if(['loading','buffering'].includes(mode)&&!playbackArmed){playbackArmed=true;playback.hold(performance.now());}
          else if(['paused','idle','results'].includes(mode)||(mode==='countdown'&&!countdownStarting&&hasExpectedVideo()))player.pauseVideo();
        }
        // PAUSED/BUFFERING are sampled by PlaybackGate, which filters seek transitions.
        if(event.data===0&&['running','buffering','loading'].includes(mode)){
          if(clock>=song().duration-2&&hasExpectedVideo())finish();else waitForVideo();
        }
        if(event.data===0&&mode==='countdown')awaitCountdownVideo(performance.now());
      },
      onPlaybackRateChange:event=>{if(event.data!==1&&mode!=='idle'){eligible=false;toast('再生速度が変わったため練習プレイになりました。');}},
      onError:()=>{quit();stateText('VIDEO UNAVAILABLE');$('startHint').textContent='この動画は現在再生できません。別の曲を選んでください。';toast('公式動画の埋め込み再生に失敗しました。別の曲を選んでください。');},
      onAutoplayBlocked:()=>{if(mode==='loading'||mode==='countdown'&&countdownStarting)playbackPrompt();}
    }});
  };
  document.head.append(script);
}
function resize(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;W=rect.width;H=rect.height;dpr=Math.min(devicePixelRatio||1,2);const width=Math.round(W*dpr),height=Math.round(H*dpr);if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);
function project(x,depth){return projectPoint(x,W,depth,40,keyboardStrikeY(W,H)).x;}
function draw(now){
  const dt=Math.min((now-lastFrame)/16.67,3);lastFrame=now;syncPlayback(now);
  const active=['running','buffering','loading','countdown','paused'].includes(mode);
  const contentTime=mode==='countdown'&&countdownUntil?leadInClock(clock,countdownUntil,now):clock;
  const t=contentTime-prefs.offset/1000;
  if(mode==='running'){
    applyNotifications(session.advance(t));$('timer').textContent=formatTime(Math.min(song().duration,t))+' / '+formatTime(song().duration);$('progress').style.width=Math.min(100,Math.max(0,t)/song().duration*100)+'%';if(t>=song().duration)finish();
  }
  ctx.clearRect(0,0,W,H);const top=40,hitY=keyboardStrikeY(W,H),span=hitY-top,laneW=W/8;
  const heightScale=document.fullscreenElement||document.body.classList.contains('chart-expanded')?1:Math.max(.45,Math.min(1,H/1000));
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#172026');bg.addColorStop(1,'#24312f');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(let lane=0;lane<8;lane++){ctx.beginPath();ctx.moveTo(project(lane*laneW,0),top);ctx.lineTo(project((lane+1)*laneW,0),top);ctx.lineTo((lane+1)*laneW,hitY);ctx.lineTo(lane*laneW,hitY);ctx.closePath();ctx.fillStyle=lane<4?(lane%2?'#ff365e18':'#ff365e0b'):(lane%2?'#318cff18':'#318cff0b');ctx.fill();if(pressed.has(lane)||now-flashes[lane]<170){const glow=ctx.createLinearGradient(0,hitY-160,0,hitY);glow.addColorStop(0,'transparent');glow.addColorStop(1,lane<4?'#ff365e66':'#318cff66');ctx.fillStyle=glow;ctx.fill();}}
  for(let i=0;i<=8;i++){ctx.lineWidth=i===4?2:1;ctx.setLineDash(i===4?[8,7]:[]);ctx.strokeStyle=i===4?'#ffffffaa':i===0||i===8?'#ffffff66':'#ffffff40';ctx.beginPath();ctx.moveTo(project(i*laneW,0),top);ctx.lineTo(i*laneW,hitY);ctx.stroke();}ctx.setLineDash([]);ctx.lineWidth=1;
  ctx.textAlign='center';ctx.font='700 11px "DM Sans",sans-serif';ctx.fillStyle=NOTE_COLORS.left;ctx.fillText('左手',project(W/4,0),top-12);ctx.fillStyle=NOTE_COLORS.right;ctx.fillText('右手',project(W*3/4,0),top-12);
  const lookahead=noteTravelSeconds(prefs.speed);const beat=60/song().bpm;const visualTime=active?t:now/1000*.65;
  for(let b=Math.floor(visualTime/beat);b<visualTime/beat+lookahead/beat+2;b++){const diff=b*beat-visualTime;if(diff<0||diff>lookahead)continue;const depth=1-diff/lookahead,y=top+span*depth*depth;ctx.strokeStyle=b%(song().meter||4)===0?'#c2decd1f':'#c2decd0b';ctx.beginPath();ctx.moveTo(project(0,depth),y);ctx.lineTo(project(W,depth),y);ctx.stroke();}
  let visibleNotes=notes;
  // Freeze a prepared highway during buffering; hiding/showing it caused flashes.
  if(!chartVisible&&(['loading','buffering'].includes(mode)||(mode==='countdown'&&!countdownUntil)))visibleNotes=[];
  if(!active&&mode!=='results'){visibleNotes=Array.from({length:20},(_,i)=>({t:visualTime+(i*.31-(visualTime%3.1)),lane:[0,2,4,5,3,2,1,0,6,7][i%10],degree:[0,2,4,5,3,2,1,0,6,7][i%10]}));}
  drawAirRibbons(ctx,visibleNotes,{width:W,time:visualTime,lookahead,top,hitY,held:spaceHeld});
  if(active)drawCombo(ctx,stats.combo,W,hitY,now-comboPulse.at);
  const chords=new Map();
  for(const n of visibleNotes){if(n.done||n.started||n.assist||!n.chord)continue;const diff=n.t-visualTime;if(diff>lookahead||diff<-.17)continue;if(!chords.has(n.t))chords.set(n.t,[]);chords.get(n.t).push(n);}
  for(const [at,group]of chords){
    if(group.length<2)continue;const depth=Math.min(1,Math.max(0,1-(at-visualTime)/lookahead));if(depth<.18)continue;
    const points=group.map(n=>projectPoint((n.lane+.5)*laneW,W,depth,top,hitY)).sort((a,b)=>a.x-b.x);
    const headTop=points[0].y-16*(.35+.65*depth)*heightScale,lineY=headTop-5*heightScale;
    ctx.strokeStyle='#ffffff';ctx.globalAlpha=.35+.55*depth;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(points[0].x,lineY);ctx.lineTo(points.at(-1).x,lineY);
    for(const p of points){ctx.moveTo(p.x,lineY);ctx.lineTo(p.x,headTop);}ctx.stroke();ctx.globalAlpha=1;
  }
  for(let i=visibleNotes.length-1;i>=0;i--){
    const n=visibleNotes[i];if(n.done)continue;
    const diff=n.t-visualTime,tailDiff=(n.end??n.deadline??n.t)-visualTime;
    if(diff>lookahead||tailDiff<-.2)continue;
    const depth=Math.min(1,Math.max(0,1-diff/lookahead));
    const y=top+span*depth*depth;
    const xBase=n.assist?n.boundary*laneW:(n.lane+.5)*laneW;
    const head=projectPoint(xBase,W,depth,top,hitY),x=head.x;
    const width=(n.assist?laneW*.32:laneW*.83)*head.scale,height=(n.assist?12:32)*(.35+.65*depth)*heightScale;
    const color=n.assist?'#8a99a3':n.flick?'#baff5a':n.lane<4?NOTE_COLORS.left:NOTE_COLORS.right;
    if(n.end){
      const tailDepth=Math.min(1,Math.max(0,1-tailDiff/lookahead));
      const tail=projectPoint(xBase,W,tailDepth,top,hitY);
      const headHalf=laneW*.21*head.scale,tailHalf=laneW*.21*tail.scale;
      ctx.globalAlpha=n.started?.65:.3;ctx.fillStyle=color;
      ctx.beginPath();ctx.moveTo(tail.x-tailHalf,tail.y);ctx.lineTo(tail.x+tailHalf,tail.y);ctx.lineTo(x+headHalf,y);ctx.lineTo(x-headHalf,y);ctx.closePath();ctx.fill();
      ctx.globalAlpha=.8;ctx.fillRect(tail.x-tailHalf,tail.y,tailHalf*2,3*heightScale);
      ctx.strokeStyle=color;ctx.lineWidth=n.started?2:1;ctx.beginPath();ctx.moveTo(tail.x-tailHalf,tail.y);ctx.lineTo(x-headHalf,y);ctx.moveTo(tail.x+tailHalf,tail.y);ctx.lineTo(x+headHalf,y);ctx.stroke();
    }
    if(n.flick){drawAirHead(ctx,x,y,width,head.scale,spaceHeld,heightScale);continue;}
    if(n.assist){ctx.globalAlpha=.32;ctx.fillStyle=color;ctx.fillRect(x-width/2,y-height/2,width,height);ctx.globalAlpha=1;}
    else drawNoteHead(ctx,{x,y,width,height,lane:n.lane,time:now,heightScale});
  }
  ctx.fillStyle='#fff';ctx.globalAlpha=.65;ctx.fillRect(0,hitY-1,W,2);ctx.globalAlpha=1;ctx.shadowColor=NOTE_COLORS.right;ctx.shadowBlur=12;ctx.fillStyle=NOTE_COLORS.right;ctx.fillRect(0,hitY,W,1);ctx.shadowBlur=0;
  drawKeyboard(ctx,{width:W,height:H,time:now,pressed,flashes,blackFlashes});
  if(active)for(let lane=0;lane<8;lane++){const hit=perfectHits[lane];if(!hit)continue;const age=now-hit.at;if(age>320){perfectHits[lane]=null;continue;}drawPerfectHit(ctx,{lane,width:W,hitY,age,heightScale,float:hit.float,top});}
  if(active)drawJudgment(ctx,{result:lastJudge,delta:judgeDelta,width:W,hitY,age:now-judgeAt});
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=.035*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=p.spark?9*heightScale:0;ctx.fillRect(p.x,p.y,p.size??2,p.spark?p.size:3);if(p.life<=0)particles.splice(i,1);}ctx.globalAlpha=1;ctx.shadowBlur=0;
  $('spaceGuide').classList.toggle('pressed',spaceHeld);$('spaceGuide').classList.toggle('air-invalid',!!session?.spaceInvalid);const guide=$('spaceGuide').querySelector('span'),guideText=session?.spaceInvalid?'Spaceを離して！ FLOAT区間の外ではコンボが切れます':'黄緑のFLOATの帯だけSpaceを押し、帯が終わったら離す';if(guide.textContent!==guideText)guide.textContent=guideText;document.querySelectorAll('[data-key]').forEach(k=>k.classList.toggle('pressed',pressed.has(prefs.keys.indexOf(k.dataset.key))));requestAnimationFrame(draw);
}
function openDialog(id){if(['running','buffering','loading','countdown'].includes(mode))pause();$(id).showModal();}
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
  const open=document.querySelector('dialog[open]');
  if(open){if(remapping){event.preventDefault();if(event.code==='Escape'){remapping=false;remapKeys=[];renderKeyGuide();$('remapHint').textContent='変更をキャンセルしました。';return;}if(event.repeat)return;if(!/^Key[A-Z]$|^Digit[0-9]$|^Semicolon$|^Comma$|^Period$|^Slash$/.test(event.code)||['Space','KeyV','KeyR','KeyO'].includes(event.code)||remapKeys.includes(event.code)){toast('重複しない英数字・記号を選んでください。Space・V・R・Oは専用キーです。');return;}remapKeys.push(event.code);if(remapKeys.length===8){prefs.keys=[...remapKeys];remapping=false;savePrefs();$('remapHint').textContent='キー配置を保存しました。';}renderKeyGuide();}return;}
  if(event.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  if(event.code==='Tab')return;
  if(event.code==='KeyV'&&!event.repeat){event.preventDefault();toggleFullscreen();return;}
  if(event.code==='KeyO'&&!event.repeat&&(event.shiftKey||difficulty!==2||!['running','buffering','loading','countdown'].includes(mode))){event.preventDefault();openDialog('settingsDialog');return;}
  if(event.key==='?'&&!event.repeat){event.preventDefault();openDialog('helpDialog');return;}
  if(mode==='results'&&event.code==='KeyS'&&!event.repeat){event.preventDefault();saveScore();return;}
  if(['idle','paused','results'].includes(mode)){
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){event.preventDefault();if(event.repeat)return;if(event.code==='ArrowUp')moveSong(-1);if(event.code==='ArrowDown')moveSong(1);if(event.code==='ArrowLeft')selectDifficulty(difficulty-1);if(event.code==='ArrowRight')selectDifficulty(difficulty+1);return;}
  }
  if(event.code==='Escape'&&!event.repeat){event.preventDefault();if(mode==='paused'||mode==='results')requestSelection();else pause();return;}
  if(event.code==='Space'){event.preventDefault();if(!event.repeat)inputMixer.pedal('keyboard',true);return;}
  if(event.code==='Enter'){
    const button=event.target.closest?.('button');if(button&&!button.dataset.song)return;
    event.preventDefault();if(event.repeat)return;if(mode==='paused')resume();else if(['idle','results'].includes(mode))start();return;
  }
  if(event.code==='KeyR'&&!event.repeat&&mode!=='idle'&&(event.shiftKey||difficulty!==2||!['running','buffering','loading','countdown'].includes(mode))){event.preventDefault();mode='retrying';start();return;}
  const lane=prefs.keys.indexOf(event.code);if(lane!==-1){event.preventDefault();if(!event.repeat)inputMixer.down(lane,'keyboard');}
});
document.addEventListener('keyup',event=>{if(event.code==='Space'){inputMixer.pedal('keyboard',false);return;}const lane=prefs.keys.indexOf(event.code);if(lane!==-1)inputMixer.up(lane,'keyboard');});
window.addEventListener('blur',()=>{clearControls();if(['running','buffering','loading','countdown'].includes(mode))pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','buffering','loading','countdown'].includes(mode))pause();});
$('startButton').onclick=start;$('resumeButton').onclick=resume;$('pauseButton').onclick=pause;$('retryButton').onclick=()=>{mode='retrying';start();};$('quitButton').onclick=()=>requestSelection();$('resultRetry').onclick=start;$('resultBack').onclick=()=>requestSelection();$('saveScore').onclick=saveScore;
$('settingsButton').onclick=() =>openDialog('settingsDialog');$('remapShortcut').onclick=()=>openDialog('settingsDialog');$('helpButton').onclick=()=>openDialog('helpDialog');$('profileButton').onclick=()=>{setName();openDialog('profileDialog');};
document.querySelectorAll('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{remapping=false;remapKeys=[];renderKeyGuide();});dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});});
document.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>selectDifficulty(Number(button.dataset.difficulty)));
for(const key of ['speed','volume','pianoLevel','offset'])$(key).oninput=()=>{prefs[key]=Number($(key).value);if(key==='offset'&&mode!=='idle'&&mode!=='results'){eligible=false;toast('この回は練習プレイになります。次のプレイから新しい判定設定を使います。');}savePrefs();if(key==='pianoLevel')pianoSound.warm();if(key==='volume')applyVolume();};
$('pianoScoreFile').onchange=async()=>{const file=$('pianoScoreFile').files?.[0];if(!file)return;const trackId=song().id;try{if(file.size>500000)throw Error('ファイルは500KB以内で指定してください。');const profile=importPianoScore(await file.text(),file.name);localStorage.setItem('pulse-piano-score:'+trackId,JSON.stringify(profile));pianoProfiles[trackId]=profile;syncSettings();if(mode==='idle')selectSong(selected);toast('音程データをこのブラウザに保存しました。次のプレイから反映します。');}catch(error){toast(error.message);}finally{$('pianoScoreFile').value='';}};
$('pianoOn').onchange=()=>{prefs.pianoOn=$('pianoOn').checked;savePrefs();pianoSound.warm();};
$('testPiano').onclick=()=>{configurePiano();for(const midi of [62,65,69])pianoSound.play({midi});};
$('testSongPiano').onclick=()=>{configurePiano();const feedback=pianoFeedbackAt(song(),Math.max(1,clock));if(feedback)pianoSound.play(feedback);};
$('touchControls').onchange=()=>{prefs.touchControls=$('touchControls').checked;savePrefs();};
$('resetSettings').onclick=()=>{prefs={...DEFAULTS,keys:[...DEFAULT_KEYS]};savePrefs();applyVolume();toast('設定を初期値に戻しました');};
$('remapButton').onclick=()=>{remapping=true;remapKeys=[];renderKeyGuide();$('remapHint').textContent='左から順に8つのキーを押してください。Escでキャンセル。';};
$('profileForm').onsubmit=event=>{event.preventDefault();name=$('nameInput').value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,16)||'PLAYER';write('pulse-name',name);setName();$('profileDialog').close();toast('プレイヤー名を保存しました');};
$('refreshScores').onclick=loadLeaders;
$('songSort').value=librarySort;$('songSort').onchange=()=>{librarySort=$('songSort').value;write('pulse-sort',librarySort);renderSongs();};
$('songSearch').oninput=()=>{librarySearch=$('songSearch').value;renderSongs();};
document.querySelectorAll('[data-pack]').forEach(button=>button.onclick=()=>{libraryPack=button.dataset.pack;renderSongs();});
$('pauseChange').onclick=()=>requestSelection();$('changeSong').onchange=updateSelectionWarning;$('changeDifficulty').onchange=updateSelectionWarning;$('confirmTrackChange').onclick=confirmSelection;
$('fullscreenButton').onclick=toggleFullscreen;$('playFullscreen').onclick=toggleFullscreen;
$('exitChartFullscreen').onclick=toggleFullscreen;$('chartPause').onclick=()=>mode==='paused'?resume():pause();
savePrefs();setName();renderSongs();selectSong(0);selectDifficulty(1);requestAnimationFrame(draw);

let tutorial=null;
async function openTutorial(){if(['running','buffering','loading','countdown'].includes(mode))pause();$('helpDialog').close();if(!tutorial){const {createTutorial}=await import('./tutorial.mjs?v=desktop-31');tutorial=createTutorial({dialog:$('tutorialDialog'),getKeys:()=>prefs.keys,getDifficulty:()=>difficulty});}tutorial.open();}
$('tutorialButton').onclick=openTutorial;$('helpTutorial').onclick=openTutorial;

function renderAccount(){
  $('accountStatus').textContent=accountUser?'Googleログイン中 · 自己ベストを共有':'ゲストでプレイ中 · ログインは任意です';
  $('googleSignIn').hidden=!!accountUser;$('googleSignOut').hidden=!accountUser;
  $('accountHint').textContent=accountUser?'同じGoogleアカウントでブラウザ・アプリの登録済み自己ベストを表示できます。':'ログインしなくても全曲プレイ・ランキング登録ができます。ゲストの記録はこの端末に保存します。';
}
function applyAccountPending(){
  if(mode!=='idle'||accountPending===undefined)return;const user=accountPending;accountPending=undefined;
  if((accountUser?.id??null)===(user?.id??null)){accountUser=user;renderAccount();return;}
  accountUser=user;bestStorage=user?'pulse-bests:'+user.id:'pulse-bests';bests=read(bestStorage,{});updateBest();renderAccount();
  const request=++accountRequest;if(user)api('/profile',{},user.id).then(data=>{if(request!==accountRequest||accountUser?.id!==user.id)return;for(const row of data.scores??[]){const key=row.chart_version+':'+row.song+':'+row.difficulty;if(!bests[key]||row.score>bests[key].score)bests[key]={score:row.score,accuracy:row.accuracy,maxCombo:row.max_combo};}write(bestStorage,bests);updateBest();}).catch(()=>toast('アカウントの記録を取得できませんでした。再ログインで読み直せます。'));
}
account=createAccount({bridge:window.pianoPulse,onChange:user=>{accountPending=user;applyAccountPending();},onError:message=>{$('accountStatus').textContent=message;}});
// Complete PKCE URL cleanup before the embedded player reads its parent URL.
// Auth failure still leaves the game available to guests.
function startPlayerAfterAuth(){
  const url=new URL(location.href);
  for(const key of ['code','error','error_code','error_description'])url.searchParams.delete(key);
  if(url.href!==location.href)history.replaceState(history.state,'',url.href);
  loadPlayer();
}
account.ready.then(startPlayerAfterAuth,startPlayerAfterAuth);
$('googleSignIn').onclick=async()=>{if(mode!=='idle'){toast('選曲に戻ってからログインしてください。');return;}$('googleSignIn').disabled=true;try{await account.signIn();$('accountStatus').textContent='ブラウザでGoogleログインを完了してください';}catch(error){$('accountStatus').textContent=error.message;}finally{$('googleSignIn').disabled=mode!=='idle';}};
$('googleSignOut').onclick=async()=>{if(mode!=='idle')return;$('googleSignOut').disabled=true;try{await account.signOut();}catch(error){$('accountStatus').textContent=error.message;}finally{$('googleSignOut').disabled=mode!=='idle';}};
renderAccount();
initDesktop({bridge:window.pianoPulse,button:$('desktopSettings'),snapshot:()=>({songId:song().id,difficulty,phase:mode,position:clock})});
