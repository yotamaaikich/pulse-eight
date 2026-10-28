import {MONITORING_PIANO_PROFILE} from './monitoring-vocal.mjs?v=library-review-11';
import {referenceChart} from './reference-chart.mjs?v=score-attacks-1';
import {nextLife,MAX_LIFE} from './life.mjs?v=luminous-2';
import {drawKeyboard,keyboardStrikeY} from './keyboard.mjs?v=compact-1';
import {NOTE_COLORS,drawNoteHead,drawCombo,drawJudgment} from './note-style.mjs?v=luminous-2';
import {importPianoScore,validatePianoProfile} from './score-import.mjs?v=melody-score-1';
import {createPianoSound} from './piano-sound.mjs?v=source-piano-15';
import {pianoFeedbackAt} from './source-piano.mjs?v=hands-19';
import {keySoundRequests} from './key-sound.mjs?v=source-piano-15';
import {noteTravelSeconds,leadInSeconds,leadInClock} from './lead-in.mjs?v=approach-13';
import {pianoTrialChart,PIANO_TRIAL_SONG} from './piano-trial.mjs?v=hands-19';
import {difficultyMetrics,orderedSongs} from './catalog.mjs?v=hands-19';
import {drawAirRibbons,drawAirHead} from './air.mjs?v=unlabeled-1';
import {SONGS,DIFFICULTIES,makeChart,newStats,summary,CHART_VERSION,RhythmSession,isFullCombo} from './engine.mjs?v=hands-19';
import {API_URL,PUBLIC_KEY} from './config.js';
import {projectPoint} from './geometry.mjs';
import {PlaybackGate,inputClock} from './playback.mjs?v=approach-13';

const $=id=>document.getElementById(id);
const DEFAULT_KEYS=['KeyA','KeyS','KeyD','KeyF','KeyJ','KeyK','KeyL','Semicolon'];
const DEFAULTS={speed:1,volume:50,mixVersion:1,pianoOn:true,pianoLevel:18,offset:0,keys:DEFAULT_KEYS};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage is optional. */}};
const savedPrefs=read('pulse-prefs',{});
let prefs={...DEFAULTS,...savedPrefs};delete prefs.notation;
if(savedPrefs.mixVersion!==1&&Number.isFinite(savedPrefs.volume))prefs.volume=Math.round(savedPrefs.volume*.7);prefs.mixVersion=1;
delete prefs.pianoVolume;
prefs.pianoOn=prefs.pianoOn===true;
prefs.pianoLevel=Math.max(0,Math.min(100,Number(prefs.pianoLevel)||0));
const pianoSound=createPianoSound();
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
const bests=read('pulse-bests',{});
let selected=0,difficulty=1,mode='idle',session=null,notes=[],stats=newStats(),events=[],runId=null,runPromise=null,eligible=true;
let referenceRun=false;
let life=MAX_LIFE;
let libraryPack='all',librarySearch='',spaceHeld=false;
let librarySort=read('pulse-sort','library');
let ready=false,player=null,clock=0,lastFrame=performance.now(),sequence=0;
let lastJudge='',judgeAt=0,judgeDelta=0,toastTimer,remapping=false,remapKeys=[],leaderRequest=0,submitted=false;
const pressed=new Set(),upperPressed=new Set(),flashes=Array(8).fill(0),blackFlashes=Array(5).fill(0),particles=[];
const canvas=$('game'),ctx=canvas.getContext('2d');
const playback=new PlaybackGate();let appliedVolume=null,playbackArmed=false,countdownUntil=0,countdownReady=false,countdownSettledAt=null;
let W=600,H=535,dpr=1;
const label=code=>({Semicolon:';',Comma:',',Period:'.',Slash:'/'}[code]|| (code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):code));
const song=()=>SONGS[selected];
const referenceEnabled=()=>false;
const formatTime=seconds=>String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')+':'+String(Math.floor(Math.max(0,seconds))%60).padStart(2,'0');
const resetTimer=()=>{$('timer').textContent='00:00 / '+formatTime(song().duration);};
const scoreKey=()=>`${CHART_VERSION}:${song().id}:${difficulty}`;
const fmt=n=>n.toLocaleString('en-US');
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function savePrefs(){configurePiano();write('pulse-prefs',prefs);$('speedLabel').textContent=`SPEED ${prefs.speed.toFixed(1)}×`;syncSettings();renderKeyGuide();}
async function toggleFullscreen(){if(document.body.classList.contains('chart-expanded')){document.body.classList.remove('chart-expanded');syncExpandedControls();return;}try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen({navigationUI:'hide'});}catch{document.body.classList.add('chart-expanded');}syncExpandedControls();}
function syncExpandedControls(){const on=!!document.fullscreenElement||document.body.classList.contains('chart-expanded');$('fullscreenButton').setAttribute('aria-pressed',String(on));$('fullscreenButton').setAttribute('aria-label',on?'譜面の全画面を終了':'譜面を全画面にする');$('fullscreenButton').innerHTML=(on?'⛶ 戻す':'⛶ 譜面全画面')+' <kbd>V</kbd>';$('playFullscreen').textContent=(on?'⛶ 戻す':'⛶ 譜面全画面')+' [V]';}
document.addEventListener('fullscreenchange',syncExpandedControls);
function renderKeyGuide(){for(let hand=0;hand<2;hand++){$(hand?'rightKeys':'leftKeys').innerHTML=prefs.keys.slice(hand*4,hand*4+4).map(code=>`<span class="guide-key"><kbd data-key="${code}">${label(code)}</kbd></span>`).join('');}$('mappingKeys').innerHTML=prefs.keys.map((code,i)=>`<kbd class="${remapping&&i===remapKeys.length?'current':''}">${remapping?(remapKeys[i]?label(remapKeys[i]):'·'):label(code)}</kbd>`).join('');}
function renderPianoStatus(){
  const profile=currentPianoProfile(),on=prefs.pianoOn&&prefs.pianoLevel>0;
  $('pianoImportShortcut').hidden=true;
  $('pianoTrialStatus').textContent=(on?'鍵盤音 ON · '+prefs.pianoLevel+'%':'鍵盤音 OFF')+(profile?' · '+profile.title:' · 曲別ピアノ（音声からの推定）');
}
function syncSettings(){renderPianoStatus();const pianoProfile=currentPianoProfile();$('referencePractice').checked=prefs.referencePractice!==false;$('referencePracticeSetting').hidden=true;$('pianoScoreDetails').hidden=song().id==='monitoring';for(const key of ['speed','volume','pianoLevel','offset']){$(key).value=prefs[key];$(key+'Output').textContent=key==='speed'?prefs[key].toFixed(1)+'×':key==='volume'?prefs[key]+'%':prefs[key]+' ms';}$('pianoOn').checked=prefs.pianoOn;$('pianoLevelOutput').textContent=prefs.pianoLevel+'%';$('testPiano').disabled=!prefs.pianoOn||!prefs.pianoLevel;$('testSongPiano').disabled=!prefs.pianoOn||!prefs.pianoLevel;$('pianoScoreStatus').textContent=pianoProfile?pianoProfile.title+' · '+pianoProfile.voices.reduce((sum,v)=>sum+v.length,0)+'音 読込済み':'曲別ピアノ読込済み · 公式音声からの音高推定';}
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
function selectSong(index){
  if(mode!=='idle'){const target=(index+SONGS.length)%SONGS.length;if(target!==selected)requestSelection(target,difficulty);return;}
  if(mode!=='idle')return;const previous=selected;selected=(index+SONGS.length)%SONGS.length;renderSongs();const s=song();
  const list=$('songs'),row=list.querySelector('.song.selected');
  if(row&&Number.isFinite(row.offsetTop)){const top=row.offsetTop-list.offsetTop;if(top<list.scrollTop)list.scrollTop=top;else if(top+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=top+row.offsetHeight-list.clientHeight;}
  syncSettings();$('trackTitle').textContent=s.title;$('trackArtist').textContent=s.artist+' / '+s.vocal;$('bpm').textContent=s.bpm;$('miniArt').style.background=s.color;$('miniArt').style.backgroundImage=`url("https://i.ytimg.com/vi/${s.video}/mqdefault.jpg")`;
  $('originalLink').href='https://www.youtube.com/watch?v='+s.video;$('sheetLink').href='https://www.youtube.com/watch?v='+s.video;$('sheetLink').textContent='譜面の参照音源 ↗';$('chartInfo').textContent=s.chartLabel||'公開採譜を参考にした簡略フレーズ';resetTimer();
  if(ready&&previous!==selected)player.cueVideoById(s.video);updateChartControls();updateBest();loadLeaders();
}
function selectDifficulty(index){if(mode!=='idle'){const target=(index+3)%3;if(target!==difficulty)requestSelection(selected,target);return;}if(mode!=='idle')return;difficulty=(index+3)%3;document.querySelectorAll('[data-difficulty]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.difficulty)===difficulty);b.setAttribute('aria-pressed',Number(b.dataset.difficulty)===difficulty);});updateChartControls();renderSongs();updateBest();loadLeaders();}
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
async function api(path,body){const response=await fetch(API_URL+path,{method:body?'POST':'GET',headers:{apikey:PUBLIC_KEY,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'クラウドへ接続できませんでした');return data;}
async function loadLeaders(){
  if(referenceEnabled()){leaderRequest++;$('leaders').innerHTML='<li class="empty-state">参照譜面の試験プレイはランキング対象外です。設定で通常譜面へ戻せます。</li>';return;}
  const request=++leaderRequest;$('leaders').innerHTML='<li class="empty-state">ランキングを読み込み中…</li>';
  try{
    const data=await api(`/leaderboard?song=${song().id}&difficulty=${difficulty}`);if(request!==leaderRequest)return;
    $('cloudStatus').textContent='ONLINE';$('leaders').replaceChildren();
    if(!data.scores?.length){const li=document.createElement('li');li.className='empty-state';li.textContent='まだ記録がありません。最初のスコアを刻もう。';$('leaders').append(li);return;}
    data.scores.forEach((row,i)=>{const li=document.createElement('li'),num=document.createElement('span'),person=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),score=document.createElement('span');num.className='leader-num';num.textContent=String(i+1).padStart(2,'0');person.className='leader-person';strong.textContent=row.name;small.textContent=row.accuracy.toFixed(2)+'% · '+row.max_combo+' COMBO';person.append(strong,small);score.className='leader-score';score.textContent=fmt(row.score);li.append(num,person,score);$('leaders').append(li);});
  }catch{if(request!==leaderRequest)return;$('cloudStatus').textContent='OFFLINE';$('leaders').innerHTML='<li class="empty-state">接続できませんでした。↻ で再読み込みできます。</li>';}
}
function updateChartControls(){
  const ref=referenceEnabled()?referenceChart(song(),difficulty,currentPianoProfile()):null;
  const metric=ref?{count:ref.length,level:Math.max(1,Math.ceil(ref.length/100))}:difficultyMetrics(song(),difficulty);
  $('leaderDifficulty').textContent=DIFFICULTIES[difficulty]+(ref?' 参照試験':' LV.'+metric.level);
  $('difficultySummary').textContent=DIFFICULTIES[difficulty]+(ref?'（参照試験）':'')+' · '+metric.count+' NOTES · LV.'+metric.level;
  document.querySelectorAll('[data-difficulty]').forEach(button=>{const d=Number(button.dataset.difficulty),c=ref?referenceChart(song(),d,currentPianoProfile()):null,info=c?{count:c.length,level:Math.max(1,Math.ceil(c.length/100))}:difficultyMetrics(song(),d);button.querySelector('span').textContent='LV.'+info.level;button.title=info.count+'ノーツ（100ノーツごとにレベル+1）';button.disabled=false;button.classList.toggle('active',Number(button.dataset.difficulty)===difficulty);button.setAttribute('aria-pressed',String(Number(button.dataset.difficulty)===difficulty));});
}
function stateText(text){$('playState').textContent=text;}
function show(id){for(const name of ['stageMessage','pauseMessage','resultMessage'])$(name).classList.toggle('hidden',name!==id);$('videoLoading').classList.toggle('hidden',!(['loading','buffering'].includes(mode)||(mode==='countdown'&&!countdownUntil)));$('playCountdown').classList.toggle('hidden',mode!=='countdown'||!countdownUntil);updateChartControls();}
function applyVolume(){if(!ready)return;const volume=['loading','buffering','countdown'].includes(mode)?0:prefs.volume;if(appliedVolume!==volume){player.setVolume(volume);appliedVolume=volume;}}
function waitForVideo(){if(!['running','buffering','loading'].includes(mode))return;pianoSound.stop();mode='buffering';playback.hold(performance.now());show(null);stateText('動画読み込み中');applyVolume();}
function beginCountdown(now,alreadyCounted=false){
  mode='countdown';countdownUntil=0;countdownSettledAt=null;countdownReady=alreadyCounted;playbackArmed=false;
  player.pauseVideo();player.seekTo(clock,true);player.pauseVideo();$('countdownNumber').textContent='3';show(null);stateText('動画読み込み中');applyVolume();
}
function playAfterCountdown(now){mode='loading';countdownReady=true;playback.reset(now,clock);playbackArmed=true;show(null);stateText('動画読み込み中');player.playVideo();}
function syncPlayback(now){
  if(mode==='countdown'){
    // Do not start the 3 seconds until the asynchronous rewind has actually settled.
    if(!countdownUntil){
      const raw=player.getCurrentTime(),settled=player.getPlayerState()===2&&Number.isFinite(raw)&&Math.abs(raw-clock)<=.25;
      if(!settled){countdownSettledAt=null;return;}
      countdownSettledAt??=now;
      if(now-countdownSettledAt<150)return;
      if(countdownReady){playAfterCountdown(now);return;}
      const first=notes.find(n=>!n.done&&!n.started&&!n.assist&&n.t>=clock);
      countdownUntil=now+leadInSeconds(prefs.speed,(first?first.t-clock:0)+prefs.offset/1000)*1000;show(null);stateText('GET READY');
    }
    const remaining=Math.max(0,Math.ceil((countdownUntil-now)/1000));$('countdownNumber').textContent=remaining>3?'READY':String(remaining||1);stateText(remaining>3?'GET READY':'GET READY · '+remaining);
    if(now>=countdownUntil)playAfterCountdown(now);
    return;
  }
  if(!ready||!playbackArmed||!['running','buffering','loading'].includes(mode))return;
  const raw=player.getCurrentTime(),state=player.getPlayerState();
  if(countdownReady){
    // The content was verified before the countdown. Start on PLAYING instead of
    // silently consuming the first .35 seconds and treating late pause events as a new stop.
    if(state!==1||!Number.isFinite(raw)||raw<clock-.15)return;
    if(raw>clock+.5){beginCountdown(now,true);return;}
    playback.resume(now,clock);
  }
  const next=playback.observe(raw,state,now);
  if(next.seek)eligible=false;
  if(!next.waiting&&mode!=='running'&&!countdownReady){beginCountdown(now);return;}
  clock=next.time;
  if(next.waiting){if(mode==='running'){mode='buffering';pianoSound.stop();show(null);}stateText('動画読み込み中');}
  else if(mode!=='running'){countdownReady=false;mode='running';syncHeldKeys();show(null);stateText('NOW PLAYING');canvas.focus();}
  applyVolume();
}
function start(){
  if(!ready){toast('公式プレイヤーを読み込み中です。準備完了後にEnterを押してください。');return;}
  if(mode==='loading')return;
  if(prefs.pianoOn&&prefs.pianoLevel){pianoSound.warm();pianoSound.prepare().then(ok=>{if(!ok&&prefs.pianoOn&&prefs.pianoLevel)toast('ピアノ音源を読み込めませんでした。設定の試し弾きから確認してください。');});}pianoSound.stop();
  let chart;try{referenceRun=referenceEnabled();chart=referenceRun?referenceChart(song(),difficulty,currentPianoProfile()):pianoTrialChart(song(),makeChart(song(),difficulty),currentPianoProfile());}catch(error){toast(error.message);return;}
  upperPressed.clear();spaceHeld=false;sequence++;const seq=sequence;mode='loading';countdownUntil=0;countdownReady=false;playback.reset(performance.now());playbackArmed=false;document.body.classList.add('focus-play');window.scrollTo({top:0,behavior:'instant'});clock=0;session=new RhythmSession(chart,song().duration);notes=session.notes;stats=session.stats;life=MAX_LIFE;events=[];eligible=!referenceRun;runId=null;submitted=false;lastJudge='';pressed.clear();particles.length=0;
  show(null);$('stage').classList.add('running');$('pauseButton').disabled=false;$('progress').style.width='0%';resetTimer();stateText('動画読み込み中');updateStats();canvas.focus();
  runPromise=referenceRun?Promise.resolve():api('/start',{song:song().id,difficulty,playerToken:token,version:CHART_VERSION}).then(data=>{if(seq===sequence)runId=data.runId;}).catch(()=>{if(seq===sequence)toast('クラウドに接続できないため、この回は端末に保存します。');});
  applyVolume();player.setPlaybackRate(1);player.loadVideoById({videoId:song().video,startSeconds:0});
}
function pause(){if(!['running','buffering','loading','countdown'].includes(mode))return;mode='paused';pianoSound.stop();countdownUntil=0;countdownReady=false;player?.pauseVideo();$('pauseMessage').querySelector('h2').textContent='PAUSED.';show('pauseMessage');stateText('PAUSED');}
function resume(){if(mode!=='paused')return;pianoSound.warm();syncHeldKeys();mode='loading';countdownReady=false;playback.reset(performance.now(),clock);playbackArmed=false;show(null);stateText('動画読み込み中');applyVolume();player.playVideo();canvas.focus();}
function quit(){pianoSound.stop();upperPressed.clear();spaceHeld=false;sequence++;mode='idle';session=null;notes=[];stats=newStats();life=MAX_LIFE;events=[];runId=null;eligible=false;clock=0;updateStats();document.body.classList.remove('focus-play');player?.pauseVideo();show('stageMessage');$('stage').classList.remove('running');$('pauseButton').disabled=true;pressed.clear();stateText('READY TO PLAY');resetTimer();$('progress').style.width='0%';selectSong(selected);selectDifficulty(difficulty);}
function updateStats(){
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
  const previous=bests[scoreKey()],isBest=!referenceRun&&(!previous||result.score>previous.score);if(isBest){bests[scoreKey()]=result;write('pulse-bests',bests);}$('bestBadge').style.display=isBest?'':'none';
  $('saveScore').disabled=!eligible;
  $('saveScore').textContent=referenceRun?'参照譜面の試験プレイ':!eligible?'練習プレイ（シーク・速度変更あり）':'ランキングに登録 [S]';
  $('saveStatus').textContent=referenceRun?'端末内の参照譜面のためランキング登録・通常譜面の自己ベスト更新は行いません。':'名前とスコアが公開されます';show('resultMessage');$('pauseButton').disabled=true;stateText('TRACK COMPLETE');$('progress').style.width='100%';updateBest();
}
async function saveScore(){
  if(mode!=='results'||submitted||!eligible)return;
  const seq=sequence,recorded=events.map(e=>[...e]);$('saveScore').disabled=true;$('saveStatus').textContent='クラウドへ登録中…';
  try{await runPromise;if(seq!==sequence)return;if(!runId)throw new Error('接続できませんでした。次のプレイで再度お試しください。');
    const result=await api('/submit',{runId,playerToken:token,name,events:recorded});if(seq!==sequence)return;submitted=true;
    {$('saveScore').textContent=result.improved?'ランキング登録完了':'自己ベストをキープ';$('saveStatus').textContent='保存しました。ランキングを更新しました。';toast('クラウドにスコアを保存しました');}loadLeaders();
  }catch(error){if(seq!==sequence)return;$('saveScore').disabled=false;$('saveStatus').textContent=error.message;}
}
function time(){return clock;}
function recordEvent(t,lane,action){const ms=Math.round(t*1000);if(ms<0||ms>song().duration*1000+200)return false;events.push([Math.max(ms,events.at(-1)?.[0]||0),lane,action]);return true;}
function applyNotifications(list){
  const now=performance.now();let changed=false;
  for(const event of list){
    life=nextLife(life,event);
    if(event.kind==='assist'){blackFlashes[event.note.blackIndex]=now;continue;}
    if(event.kind==='holdstart'||event.kind==='flickstart'){lastJudge=event.result;judgeDelta=Math.round(event.delta*1000);judgeAt=now;continue;}
    if(event.kind==='holdtick'){changed=true;continue;}
    if(event.kind==='airbreak'){changed=true;lastJudge='airbreak';judgeAt=now;toast('FLOATの帯がないところではSpaceを離してください');continue;}
    if(event.kind!=='judge')continue;
    changed=true;lastJudge=event.result;judgeDelta=Math.round(event.delta*1000);judgeAt=now;
    if(event.result!=='miss'){const x=(event.note.lane+.5)*W/8;for(let i=0;i<9;i++)particles.push({x,y:keyboardStrikeY(W,H)+2,vx:(Math.random()-.5)*2.5,vy:-Math.random()*4-1,life:1,color:event.note.lane<4?NOTE_COLORS.left:NOTE_COLORS.right});}
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
          else if(['paused','idle','results','countdown'].includes(mode))player.pauseVideo();
        }
        // PAUSED/BUFFERING are sampled by PlaybackGate, which filters seek transitions.
        if(event.data===0&&['running','buffering','loading'].includes(mode)){
          if(clock>=song().duration-2)finish();else waitForVideo();
        }
      },
      onPlaybackRateChange:event=>{if(event.data!==1&&mode!=='idle'){eligible=false;toast('再生速度が変わったため練習プレイになりました。');}},
      onError:()=>{quit();stateText('VIDEO UNAVAILABLE');$('startHint').textContent='この動画は現在再生できません。別の曲を選んでください。';toast('公式動画の埋め込み再生に失敗しました。別の曲を選んでください。');},
      onAutoplayBlocked:()=>{if(mode==='loading'){mode='paused';show('pauseMessage');$('pauseMessage').querySelector('h2').textContent='READY?';stateText('ENTER TO ALLOW PLAYBACK');toast('Enterでもう一度再生してください。');}}
    }});
  };
  document.head.append(script);
}
function resize(){const rect=canvas.getBoundingClientRect();W=rect.width;H=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
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
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#172026');bg.addColorStop(1,'#24312f');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(let lane=0;lane<8;lane++){ctx.beginPath();ctx.moveTo(project(lane*laneW,0),top);ctx.lineTo(project((lane+1)*laneW,0),top);ctx.lineTo((lane+1)*laneW,hitY);ctx.lineTo(lane*laneW,hitY);ctx.closePath();ctx.fillStyle=lane<4?(lane%2?'#ff365e18':'#ff365e0b'):(lane%2?'#318cff18':'#318cff0b');ctx.fill();if(pressed.has(lane)||now-flashes[lane]<170){const glow=ctx.createLinearGradient(0,hitY-160,0,hitY);glow.addColorStop(0,'transparent');glow.addColorStop(1,lane<4?'#ff365e66':'#318cff66');ctx.fillStyle=glow;ctx.fill();}}
  for(let i=0;i<=8;i++){ctx.lineWidth=i===4?2:1;ctx.setLineDash(i===4?[8,7]:[]);ctx.strokeStyle=i===4?'#ffffffaa':i===0||i===8?'#ffffff66':'#ffffff40';ctx.beginPath();ctx.moveTo(project(i*laneW,0),top);ctx.lineTo(i*laneW,hitY);ctx.stroke();}ctx.setLineDash([]);ctx.lineWidth=1;
  ctx.textAlign='center';ctx.font='700 11px "DM Sans",sans-serif';ctx.fillStyle=NOTE_COLORS.left;ctx.fillText('左手',project(W/4,0),top-12);ctx.fillStyle=NOTE_COLORS.right;ctx.fillText('右手',project(W*3/4,0),top-12);
  const lookahead=noteTravelSeconds(prefs.speed);const beat=60/song().bpm;const visualTime=active?t:now/1000*.65;
  for(let b=Math.floor(visualTime/beat);b<visualTime/beat+lookahead/beat+2;b++){const diff=b*beat-visualTime;if(diff<0||diff>lookahead)continue;const depth=1-diff/lookahead,y=top+span*depth*depth;ctx.strokeStyle=b%(song().meter||4)===0?'#c2decd1f':'#c2decd0b';ctx.beginPath();ctx.moveTo(project(0,depth),y);ctx.lineTo(project(W,depth),y);ctx.stroke();}
  let visibleNotes=notes;
  if((['loading','buffering'].includes(mode)&&!countdownReady)||(mode==='countdown'&&!countdownUntil))visibleNotes=[];
  if(!active&&mode!=='results'){visibleNotes=Array.from({length:20},(_,i)=>({t:visualTime+(i*.31-(visualTime%3.1)),lane:[0,2,4,5,3,2,1,0,6,7][i%10],degree:[0,2,4,5,3,2,1,0,6,7][i%10]}));}
  drawAirRibbons(ctx,visibleNotes,{width:W,time:visualTime,lookahead,top,hitY,held:spaceHeld});
  const chords=new Map();
  for(const n of visibleNotes){if(n.done||n.started||n.assist||!n.chord)continue;const diff=n.t-visualTime;if(diff>lookahead||diff<-.17)continue;if(!chords.has(n.t))chords.set(n.t,[]);chords.get(n.t).push(n);}
  for(const [at,group]of chords){
    if(group.length<2)continue;const depth=Math.min(1,Math.max(0,1-(at-visualTime)/lookahead));if(depth<.18)continue;
    const points=group.map(n=>projectPoint((n.lane+.5)*laneW,W,depth,top,hitY)).sort((a,b)=>a.x-b.x);
    const headTop=points[0].y-16*(.35+.65*depth),lineY=headTop-5;
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
    const width=(n.assist?laneW*.32:laneW*.83)*head.scale,height=(n.assist?12:32)*(.35+.65*depth);
    const color=n.assist?'#8a99a3':n.flick?'#baff5a':n.lane<4?NOTE_COLORS.left:NOTE_COLORS.right;
    if(n.end){
      const tailDepth=Math.min(1,Math.max(0,1-tailDiff/lookahead));
      const tail=projectPoint(xBase,W,tailDepth,top,hitY);
      const headHalf=laneW*.21*head.scale,tailHalf=laneW*.21*tail.scale;
      ctx.globalAlpha=n.started?.65:.3;ctx.fillStyle=color;
      ctx.beginPath();ctx.moveTo(tail.x-tailHalf,tail.y);ctx.lineTo(tail.x+tailHalf,tail.y);ctx.lineTo(x+headHalf,y);ctx.lineTo(x-headHalf,y);ctx.closePath();ctx.fill();
      ctx.globalAlpha=.8;ctx.fillRect(tail.x-tailHalf,tail.y,tailHalf*2,3);
      ctx.strokeStyle=color;ctx.lineWidth=n.started?2:1;ctx.beginPath();ctx.moveTo(tail.x-tailHalf,tail.y);ctx.lineTo(x-headHalf,y);ctx.moveTo(tail.x+tailHalf,tail.y);ctx.lineTo(x+headHalf,y);ctx.stroke();
    }
    if(n.flick){drawAirHead(ctx,x,y,width,head.scale,spaceHeld);continue;}
    if(n.assist){ctx.globalAlpha=.32;ctx.fillStyle=color;ctx.fillRect(x-width/2,y-height/2,width,height);ctx.globalAlpha=1;}
    else drawNoteHead(ctx,{x,y,width,height,lane:n.lane,time:now});
  }
  ctx.fillStyle='#fff';ctx.globalAlpha=.65;ctx.fillRect(0,hitY-1,W,2);ctx.globalAlpha=1;ctx.shadowColor=NOTE_COLORS.right;ctx.shadowBlur=12;ctx.fillStyle=NOTE_COLORS.right;ctx.fillRect(0,hitY,W,1);ctx.shadowBlur=0;
  drawKeyboard(ctx,{width:W,height:H,time:now,pressed,flashes,blackFlashes});
  if(active)drawCombo(ctx,stats.combo,W,hitY);
  if(active)drawJudgment(ctx,{result:lastJudge,delta:judgeDelta,width:W,hitY,age:now-judgeAt});
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=.035*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,2,3);if(p.life<=0)particles.splice(i,1);}ctx.globalAlpha=1;
  $('spaceGuide').classList.toggle('pressed',spaceHeld);$('spaceGuide').classList.toggle('air-invalid',!!session?.spaceInvalid);$('spaceGuide').querySelector('span').textContent=session?.spaceInvalid?'Spaceを離して！ FLOAT区間の外ではコンボが切れます':'黄緑のFLOATの帯だけSpaceを押し、帯が終わったら離す';document.querySelectorAll('[data-key]').forEach(k=>k.classList.toggle('pressed',pressed.has(prefs.keys.indexOf(k.dataset.key))));requestAnimationFrame(draw);
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
  if(event.code==='Space'){event.preventDefault();if(event.repeat||spaceHeld)return;spaceHeld=true;if(difficulty===2)spaceInput(true);if(difficulty===2)for(const lane of pressed){upperPressed.add(lane);hitUpper(lane);}return;}
  if(event.code==='Enter'){
    const button=event.target.closest?.('button');if(button&&!button.dataset.song)return;
    event.preventDefault();if(event.repeat)return;if(mode==='paused')resume();else if(['idle','results'].includes(mode))start();return;
  }
  if(event.code==='KeyR'&&!event.repeat&&mode!=='idle'&&(event.shiftKey||difficulty!==2||!['running','buffering','loading','countdown'].includes(mode))){event.preventDefault();mode='retrying';start();return;}
  const lane=prefs.keys.indexOf(event.code);if(lane!==-1){event.preventDefault();if(event.repeat||pressed.has(lane))return;pressed.add(lane);hit(lane);if(difficulty===2&&spaceHeld){upperPressed.add(lane);hitUpper(lane);}}
});
document.addEventListener('keyup',event=>{if(event.code==='Space'){spaceHeld=false;if(difficulty===2)spaceInput(false,mode==='buffering');for(const lane of upperPressed)releaseUpper(lane,mode==='buffering');upperPressed.clear();return;}const lane=prefs.keys.indexOf(event.code);if(lane!==-1){pressed.delete(lane);releaseLane(lane,mode==='buffering');if(upperPressed.delete(lane))releaseUpper(lane,mode==='buffering');}});
window.addEventListener('blur',()=>{upperPressed.clear();spaceHeld=false;pressed.clear();if(['running','buffering','loading','countdown'].includes(mode))pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','buffering','loading','countdown'].includes(mode))pause();});
$('startButton').onclick=start;$('resumeButton').onclick=resume;$('pauseButton').onclick=pause;$('retryButton').onclick=()=>{mode='retrying';start();};$('quitButton').onclick=()=>requestSelection();$('resultRetry').onclick=start;$('resultBack').onclick=()=>requestSelection();$('saveScore').onclick=saveScore;
$('pianoImportShortcut').onclick=()=>{syncSettings();$('settingsDialog').showModal();$('pianoScoreDetails').open=true;$('pianoScoreFile').click();};
$('settingsButton').onclick=() =>openDialog('settingsDialog');$('remapShortcut').onclick=()=>openDialog('settingsDialog');$('helpButton').onclick=()=>openDialog('helpDialog');$('profileButton').onclick=()=>{setName();openDialog('profileDialog');};
document.querySelectorAll('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{remapping=false;remapKeys=[];renderKeyGuide();});dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});});
document.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>selectDifficulty(Number(button.dataset.difficulty)));
for(const key of ['speed','volume','pianoLevel','offset'])$(key).oninput=()=>{prefs[key]=Number($(key).value);if(key==='offset'&&mode!=='idle'&&mode!=='results'){eligible=false;toast('この回は練習プレイになります。次のプレイから新しい判定設定を使います。');}savePrefs();if(key==='pianoLevel')pianoSound.warm();if(key==='volume')applyVolume();};
$('pianoScoreFile').onchange=async()=>{const file=$('pianoScoreFile').files?.[0];if(!file)return;const trackId=song().id;try{if(file.size>500000)throw Error('ファイルは500KB以内で指定してください。');const profile=importPianoScore(await file.text(),file.name);localStorage.setItem('pulse-piano-score:'+trackId,JSON.stringify(profile));pianoProfiles[trackId]=profile;syncSettings();if(mode==='idle')selectSong(selected);toast('音程データをこのブラウザに保存しました。次のプレイから反映します。');}catch(error){toast(error.message);}finally{$('pianoScoreFile').value='';}};
$('referencePractice').onchange=()=>{if(mode!=='idle'&&mode!=='results'){syncSettings();toast('曲を終了してから切り替えてください。');return;}prefs.referencePractice=$('referencePractice').checked;savePrefs();selectSong(selected);};
$('pianoOn').onchange=()=>{prefs.pianoOn=$('pianoOn').checked;savePrefs();pianoSound.warm();};
$('testPiano').onclick=()=>{configurePiano();for(const midi of [62,65,69])pianoSound.play({midi});};
$('testSongPiano').onclick=()=>{configurePiano();const feedback=pianoFeedbackAt(song(),Math.max(1,clock));if(feedback)pianoSound.play(feedback);};
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
savePrefs();setName();renderSongs();selectSong(0);selectDifficulty(1);loadPlayer();requestAnimationFrame(draw);

let tutorial=null;
async function openTutorial(){if(['running','buffering','loading','countdown'].includes(mode))pause();$('helpDialog').close();if(!tutorial){const {createTutorial}=await import('./tutorial.mjs?v=hands-19');tutorial=createTutorial({dialog:$('tutorialDialog'),getKeys:()=>prefs.keys,getDifficulty:()=>difficulty});}tutorial.open();}
$('tutorialHero').onclick=openTutorial;$('tutorialButton').onclick=openTutorial;$('helpTutorial').onclick=openTutorial;
