import {voiceChart,noteForKey,pitchForKey} from './melodies.mjs';
import {SONGS,DIFFICULTIES,makeChart,newStats,summary,CHART_VERSION,RhythmSession,customChart,isFullCombo,FLICK_KEYS} from './engine.mjs?v=vocaloid-20-1';
import {createPiano} from './piano.mjs?v=melody-1';
import {API_URL,PUBLIC_KEY} from './config.js';
import {projectPoint} from './geometry.mjs';
import {PlaybackGate} from './playback.mjs';

const $=id=>document.getElementById(id);
const DEFAULT_KEYS=['KeyA','KeyS','KeyD','KeyF','KeyJ','KeyK','KeyL','Semicolon'];
const DEFAULTS={speed:1,volume:50,pianoVolume:30,mixVersion:1,offset:0,keys:DEFAULT_KEYS};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage is optional. */}};
const savedPrefs=read('pulse-prefs',{});
let prefs={...DEFAULTS,...savedPrefs};delete prefs.notation;
if(savedPrefs.mixVersion!==1&&Number.isFinite(savedPrefs.volume))prefs.volume=Math.round(savedPrefs.volume*.7);prefs.mixVersion=1;
const piano=createPiano(()=>prefs.pianoVolume);
if(!Array.isArray(prefs.keys)||prefs.keys.length!==8||new Set(prefs.keys).size!==8||prefs.keys.some(code=>FLICK_KEYS.includes(code)||code==='KeyV'))prefs.keys=[...DEFAULT_KEYS];
prefs.speed=Math.min(2,Math.max(.5,Number(prefs.speed)||1));
prefs.offset=Math.min(500,Math.max(-500,Number(prefs.offset)||0));
prefs.volume=Math.min(100,Math.max(0,Number(prefs.volume)||0));
prefs.pianoVolume=Math.min(100,Math.max(0,Number(prefs.pianoVolume)||0));
let token=read('pulse-device',null);
if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');write('pulse-device',token);}
let name=read('pulse-name','PLAYER-'+token.slice(0,4).toUpperCase());
if(typeof name!=='string')name='PLAYER';
const bests=read('pulse-bests',{});
let selected=0,difficulty=1,mode='idle',session=null,notes=[],stats=newStats(),events=[],runId=null,runPromise=null,eligible=true;
let activeChart=null,libraryPack='all';
let ready=false,player=null,clock=0,lastFrame=performance.now(),sequence=0;
let lastJudge='',judgeAt=0,judgeDelta=0,toastTimer,remapping=false,remapKeys=[],leaderRequest=0,submitted=false;
const pressed=new Set(),upperPressed=new Set(),flashes=Array(8).fill(0),blackFlashes=Array(5).fill(0),particles=[];
const canvas=$('game'),ctx=canvas.getContext('2d');
const playback=new PlaybackGate();let appliedVolume=null,playbackArmed=false,countdownUntil=0,countdownReady=false;
let W=600,H=535,dpr=1;
const label=code=>({Semicolon:';',Comma:',',Period:'.',Slash:'/'}[code]|| (code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):code));
const song=()=>SONGS[selected];
const formatTime=seconds=>String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')+':'+String(Math.floor(Math.max(0,seconds))%60).padStart(2,'0');
const resetTimer=()=>{$('timer').textContent='00:00 / '+formatTime(song().duration);};
const scoreKey=()=>activeChart?`${CHART_VERSION}:${activeChart.kind}:${activeChart.id||activeChart.fingerprint}:${difficulty}`:`${CHART_VERSION}:${song().id}:${difficulty}`;
const fmt=n=>n.toLocaleString('en-US');
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function savePrefs(){write('pulse-prefs',prefs);$('speedLabel').textContent=`SPEED ${prefs.speed.toFixed(1)}×`;syncSettings();renderKeyGuide();}
async function toggleFullscreen(){if(document.body.classList.contains('chart-expanded')){document.body.classList.remove('chart-expanded');syncExpandedControls();return;}try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen({navigationUI:'hide'});}catch{document.body.classList.add('chart-expanded');}syncExpandedControls();}
function syncExpandedControls(){const on=!!document.fullscreenElement||document.body.classList.contains('chart-expanded');$('fullscreenButton').setAttribute('aria-pressed',String(on));$('fullscreenButton').setAttribute('aria-label',on?'譜面の全画面を終了':'譜面を全画面にする');$('fullscreenButton').innerHTML=(on?'⛶ 戻す':'⛶ 譜面全画面')+' <kbd>V</kbd>';$('playFullscreen').textContent=(on?'⛶ 戻す':'⛶ 譜面全画面')+' [V]';}
document.addEventListener('fullscreenchange',syncExpandedControls);
function renderKeyGuide(){for(let hand=0;hand<2;hand++){$(hand?'rightKeys':'leftKeys').innerHTML=prefs.keys.slice(hand*4,hand*4+4).map(code=>`<span class="guide-key"><kbd data-key="${code}">${label(code)}</kbd></span>`).join('');}$('mappingKeys').innerHTML=prefs.keys.map((code,i)=>`<kbd class="${remapping&&i===remapKeys.length?'current':''}">${remapping?(remapKeys[i]?label(remapKeys[i]):'·'):label(code)}</kbd>`).join('');}
function syncSettings(){for(const key of ['speed','volume','pianoVolume','offset']){$(key).value=prefs[key];$(key+'Output').textContent=key==='speed'?prefs[key].toFixed(1)+'×':['volume','pianoVolume'].includes(key)?prefs[key]+'%':prefs[key]+' ms';}}
function setName(){ $('playerName').textContent=name;$('nameInput').value=name; }
function renderSongs(){
  $('songs').innerHTML=SONGS.map((s,i)=>({s,i})).filter(({s})=>libraryPack==='all'||s.pack===libraryPack).map(({s,i})=>`<button class="song ${i===selected?'selected':''}" data-song="${i}" aria-pressed="${i===selected}"><span class="song-art" aria-hidden="true" style="background:${s.color}"></span><span class="song-info"><strong>${s.title}</strong><small>${s.artist} · ${s.pack==='madoka'?'まどマギ':s.pack==='osu'?'osu!定番':s.pack==='taiko'?'太鼓':'ボカロ'}</small></span></button>`).join('');
  $('trackCount').textContent=SONGS.filter(s=>libraryPack==='all'||s.pack===libraryPack).length+' TRACKS';
  document.querySelectorAll('[data-pack]').forEach(button=>{button.classList.toggle('active',button.dataset.pack===libraryPack);button.setAttribute('aria-pressed',String(button.dataset.pack===libraryPack));});
  document.querySelectorAll('[data-song]').forEach(b=>b.addEventListener('click',()=>selectSong(Number(b.dataset.song))));
}
function moveSong(direction){const choices=SONGS.map((s,i)=>({s,i})).filter(({s})=>libraryPack==='all'||s.pack===libraryPack).map(({i})=>i),current=choices.indexOf(selected);if(!choices.length)return;selectSong(choices[current<0?(direction>0?0:choices.length-1):(current+direction+choices.length)%choices.length]);}
function selectSong(index){
  if(mode==='paused'){const target=(index+SONGS.length)%SONGS.length;if(target!==selected)requestSelection(target,difficulty);return;}
  if(mode!=='idle')return;const previous=selected;selected=(index+SONGS.length)%SONGS.length;if(previous!==selected)activeChart=null;renderSongs();const s=song();
  $('trackTitle').textContent=s.title;$('trackArtist').textContent=s.artist+' / '+s.vocal;$('bpm').textContent=s.bpm;$('miniArt').style.background=s.color;
  $('originalLink').href='https://www.youtube.com/watch?v='+s.video;$('sheetLink').href=s.source;$('sheetLink').textContent=s.sourceLabel||'参考楽譜 ↗';$('chartInfo').textContent=activeChart?activeChart.title:s.chartLabel||'公開採譜を参考にした簡略フレーズ';resetTimer();
  if(ready&&previous!==selected)player.cueVideoById(s.video);updateChartControls();updateBest();loadLeaders();
}
function selectDifficulty(index){if(mode==='paused'){const target=(index+3)%3;if(target!==difficulty||activeChart)requestSelection(selected,target);return;}if(mode!=='idle'||activeChart)return;difficulty=(index+3)%3;document.querySelectorAll('[data-difficulty]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.difficulty)===difficulty);b.setAttribute('aria-pressed',Number(b.dataset.difficulty)===difficulty);});$('leaderDifficulty').textContent=DIFFICULTIES[difficulty];updateBest();loadLeaders();}
function requestSelection(nextSong=selected,nextDifficulty=difficulty){
  if(mode!=='paused')return;
  $('changeSong').replaceChildren();for(const [index,track]of SONGS.entries()){const option=document.createElement('option');option.value=index;option.textContent=track.title;$('changeSong').append(option);}
  $('changeSong').value=nextSong;$('changeDifficulty').value=nextDifficulty;updateSelectionWarning();$('changeTrackDialog').showModal();
}
function updateSelectionWarning(){const changed=Number($('changeSong').value)!==selected||Number($('changeDifficulty').value)!==difficulty||!!activeChart;$('confirmTrackChange').disabled=!changed;}
function confirmSelection(){if(mode!=='paused')return;const nextSong=Number($('changeSong').value),nextDifficulty=Number($('changeDifficulty').value);$('changeTrackDialog').close();quit();activeChart=null;selectSong(nextSong);selectDifficulty(nextDifficulty);toast('プレイをリセットして変更しました。Enterでスタート');}
function updateBest(){const b=bests[scoreKey()];$('personalBest').textContent=b?fmt(b.score):'—';}
async function api(path,body){const response=await fetch(API_URL+path,{method:body?'POST':'GET',headers:{apikey:PUBLIC_KEY,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'クラウドへ接続できませんでした');return data;}
async function loadLeaders(){
  const request=++leaderRequest;$('leaders').innerHTML='<li class="empty-state">ランキングを読み込み中…</li>';
  try{
    const data=await api(activeChart?.kind==='published'?'/leaderboard?chart='+activeChart.id:`/leaderboard?song=${song().id}&difficulty=${difficulty}`);if(request!==leaderRequest)return;
    $('cloudStatus').textContent='ONLINE';$('leaders').replaceChildren();
    if(!data.scores?.length){const li=document.createElement('li');li.className='empty-state';li.textContent='まだ記録がありません。最初のスコアを刻もう。';$('leaders').append(li);return;}
    data.scores.forEach((row,i)=>{const li=document.createElement('li'),num=document.createElement('span'),person=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),score=document.createElement('span');num.className='leader-num';num.textContent=String(i+1).padStart(2,'0');person.className='leader-person';strong.textContent=row.name;small.textContent=row.accuracy.toFixed(2)+'% · '+row.max_combo+' COMBO';person.append(strong,small);score.className='leader-score';score.textContent=fmt(row.score);li.append(num,person,score);$('leaders').append(li);});
  }catch{if(request!==leaderRequest)return;$('cloudStatus').textContent='OFFLINE';$('leaders').innerHTML='<li class="empty-state">接続できませんでした。↻ で再読み込みできます。</li>';}
}
function updateChartControls(){
  const busy=!['idle','results'].includes(mode);
  $('communityButton').disabled=busy;$('standardChartButton').disabled=busy;$('standardChartButton').hidden=!activeChart;
  $('chartSource').textContent=activeChart?'公開譜面 / '+activeChart.title:'標準譜面';$('chartSource').title=$('chartSource').textContent;
  $('leaderDifficulty').textContent=activeChart?'CUSTOM':DIFFICULTIES[difficulty];
  document.querySelectorAll('[data-difficulty]').forEach(button=>{button.disabled=mode==='paused'?false:busy||!!activeChart;button.classList.toggle('active',!activeChart&&Number(button.dataset.difficulty)===difficulty);button.setAttribute('aria-pressed',String(!activeChart&&Number(button.dataset.difficulty)===difficulty));});
}
async function leaveExpanded(){document.body.classList.remove('chart-expanded');if(document.fullscreenElement)await document.exitFullscreen();syncExpandedControls();}
async function browseCharts(){if(!['idle','results'].includes(mode))return;await leaveExpanded();$('communitySong').textContent=song().title;$('communityDialog').showModal();await refreshCharts();}
async function refreshCharts(){
  const selectedSong=song().id,list=$('communityList');list.textContent='譜面を読み込み中…';
  try{const data=await api('/charts?song='+selectedSong);if(song().id!==selectedSong)return;list.replaceChildren();
    if(!data.charts?.length){list.textContent='公開済みの譜面はありません。標準譜面から遊べます。';return;}
    for(const chart of data.charts){const button=document.createElement('button'),info=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small'),badge=document.createElement('span');button.className='community-chart';title.textContent=chart.title;detail.textContent=chart.creator_name+' · '+DIFFICULTIES[chart.difficulty]+' · '+chart.note_count+' NOTES';badge.className='verified-chart';badge.textContent='作成者フルコンボ済み';info.append(title,detail);button.append(info,badge);button.onclick=async()=>{button.disabled=true;try{const loaded=await api('/chart?id='+chart.id);if(song().id!==selectedSong||!['idle','results'].includes(mode)||!$('communityDialog').open)return;if(mode==='results')quit();activeChart={...loaded.chart,kind:'published'};difficulty=loaded.chart.difficulty;$('communityDialog').close();selectSong(selected);toast('公開譜面を選びました。Enterでプレイ');}catch(error){toast(error.message);button.disabled=false;}};list.append(button);}
  }catch(error){list.textContent=error.message;}
}
function stateText(text){$('playState').textContent=text;}
function show(id){for(const name of ['stageMessage','pauseMessage','resultMessage'])$(name).classList.toggle('hidden',name!==id);$('videoLoading').classList.toggle('hidden',!['loading','buffering'].includes(mode));$('playCountdown').classList.toggle('hidden',mode!=='countdown');updateChartControls();}
function applyVolume(){if(!ready)return;const volume=['loading','buffering','countdown'].includes(mode)?0:prefs.volume;if(appliedVolume!==volume){player.setVolume(volume);appliedVolume=volume;}}
function waitForVideo(){if(!['running','buffering','loading'].includes(mode))return;piano.stopAll();mode='buffering';playback.hold(performance.now());show(null);stateText('動画読み込み中');applyVolume();}
function beginCountdown(now){
  mode='countdown';countdownUntil=now+3000;countdownReady=false;playbackArmed=false;piano.stopAll();
  player.pauseVideo();player.seekTo(clock,true);player.pauseVideo();$('countdownNumber').textContent='3';show(null);stateText('GET READY · 3');applyVolume();
}
function syncPlayback(now){
  if(mode==='countdown'){
    const remaining=Math.max(0,Math.ceil((countdownUntil-now)/1000));$('countdownNumber').textContent=String(remaining||1);stateText('GET READY · '+remaining);
    if(now>=countdownUntil){mode='loading';countdownReady=true;playback.reset(now,clock);playbackArmed=false;show(null);stateText('動画読み込み中');player.playVideo();}
    return;
  }
  if(!ready||!playbackArmed||!['running','buffering','loading'].includes(mode))return;
  const next=playback.observe(player.getCurrentTime(),player.getPlayerState(),now);
  if(next.seek)eligible=false;
  if(!next.waiting&&mode!=='running'&&!countdownReady){beginCountdown(now);return;}
  clock=next.time;
  if(next.waiting){if(mode==='running'){piano.stopAll();mode='buffering';show(null);}stateText('動画読み込み中');}
  else if(mode!=='running'){countdownReady=false;mode='running';syncHeldKeys();show(null);stateText('NOW PLAYING');canvas.focus();}
  applyVolume();
}
function start(){
  if(!ready){toast('公式プレイヤーを読み込み中です。準備完了後にEnterを押してください。');return;}
  if(mode==='loading')return;
  let chart;try{chart=voiceChart(song(),activeChart?customChart(song(),activeChart.notes,difficulty):makeChart(song(),difficulty));}catch(error){toast(error.message);return;}
  piano.unlock();piano.stopAll();upperPressed.clear();sequence++;const seq=sequence;mode='loading';countdownUntil=0;countdownReady=false;playback.reset(performance.now());playbackArmed=false;document.body.classList.add('focus-play');window.scrollTo({top:0,behavior:'instant'});clock=0;session=new RhythmSession(chart,song().duration);notes=session.notes;stats=session.stats;events=[];eligible=true;runId=null;submitted=false;lastJudge='';pressed.clear();particles.length=0;
  show(null);$('stage').classList.add('running');$('pauseButton').disabled=false;$('progress').style.width='0%';resetTimer();stateText('動画読み込み中');updateStats();canvas.focus();
  runPromise=api('/start',{song:song().id,difficulty,playerToken:token,version:CHART_VERSION,...(activeChart?{chartId:activeChart.id}:{})}).then(data=>{if(seq===sequence)runId=data.runId;}).catch(()=>{if(seq===sequence)toast('クラウドに接続できないため、この回は端末に保存します。');});
  applyVolume();player.setPlaybackRate(1);player.loadVideoById({videoId:song().video,startSeconds:0});
}
function pause(){if(!['running','buffering','loading','countdown'].includes(mode))return;mode='paused';countdownUntil=0;countdownReady=false;piano.stopAll();player?.pauseVideo();$('pauseMessage').querySelector('h2').textContent='PAUSED.';show('pauseMessage');stateText('PAUSED');}
function resume(){if(mode!=='paused')return;syncHeldKeys();mode='loading';countdownReady=false;playback.reset(performance.now(),clock);playbackArmed=false;show(null);stateText('動画読み込み中');applyVolume();player.playVideo();canvas.focus();}
function quit(){piano.stopAll();upperPressed.clear();sequence++;mode='idle';session=null;notes=[];stats=newStats();events=[];runId=null;eligible=false;clock=0;updateStats();document.body.classList.remove('focus-play');player?.pauseVideo();show('stageMessage');$('stage').classList.remove('running');$('pauseButton').disabled=true;pressed.clear();stateText('READY TO PLAY');resetTimer();$('progress').style.width='0%';selectSong(selected);selectDifficulty(difficulty);}
function updateStats(){
  const count=notes.filter(n=>!n.assist).length||1,result=summary(stats,count);
  const score=String(result.score).padStart(7,'0');
  const judged=stats.perfect+stats.great+stats.good+stats.bad+stats.miss;
  const accuracy=judged?(stats.weight/judged*100).toFixed(2):'—';
  $('score').textContent=score;$('accuracy').innerHTML=accuracy+'<small>%</small>';$('maxCombo').textContent=stats.maxCombo;
  $('stageScore').textContent=score;$('stageCombo').textContent=stats.combo;$('stageAccuracy').textContent=accuracy;
}
function finish(){
  if(mode==='results'||mode==='idle')return;mode='results';piano.stopAll();upperPressed.clear();player.pauseVideo();pressed.clear();applyNotifications(session.finish());updateStats();const count=notes.filter(n=>!n.assist).length,result=summary(stats,count),fullCombo=isFullCombo(stats,count);
  $('resultRank').textContent=result.rank;$('resultScore').textContent=String(result.score).padStart(7,'0');$('resultDetail').textContent=`${result.accuracy.toFixed(2)}% ACCURACY / ${result.maxCombo} MAX COMBO`;
  $('resultCounts').innerHTML=['perfect','great','good','bad','miss'].map(key=>`<span>${key.toUpperCase()}<b>${stats[key]}</b></span>`).join('');$('fullComboBadge').hidden=!fullCombo;
  const previous=bests[scoreKey()],isBest=!previous||result.score>previous.score;if(isBest){bests[scoreKey()]=result;write('pulse-bests',bests);}$('bestBadge').style.display=isBest?'':'none';
  $('saveScore').disabled=!eligible;
  $('saveScore').textContent=!eligible?'練習プレイ（シーク・速度変更あり）':'ランキングに登録 [S]';
  $('saveStatus').textContent='名前とスコアが公開されます';show('resultMessage');$('pauseButton').disabled=true;stateText('TRACK COMPLETE');$('progress').style.width='100%';updateBest();
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
    if(event.kind==='assist'){blackFlashes[event.note.blackIndex]=now;continue;}
    if(event.kind==='holdstart'||event.kind==='flickstart'){lastJudge=event.kind==='flickstart'?'flick':'hold';judgeAt=now;continue;}
    if(event.kind!=='judge')continue;
    changed=true;lastJudge=event.result;judgeDelta=Math.round(event.delta*1000);judgeAt=now;
    if(event.result!=='miss'){const x=(event.note.lane+.5)*W/8;for(let i=0;i<9;i++)particles.push({x,y:H-97,vx:(Math.random()-.5)*2.5,vy:-Math.random()*4-1,life:1,color:event.note.lane<4?'#f4917e':'#b4e9cf'});}
  }
  if(changed)updateStats();
}
function inputTime(){return Math.round(((mode==='running'?time():clock)-prefs.offset/1000)*1000)/1000;}
function syncHeldKeys(){
  if(!session)return;
  for(const lane of [...session.down])if(!pressed.has(lane))releaseLane(lane,true);
  for(const lane of pressed)if(!session.down.has(lane)){const t=inputTime();if(recordEvent(t,lane,1))applyNotifications(session.press(t,lane));}
  if(difficulty===2){
    for(const lane of [...session.upperDown])if(!upperPressed.has(lane))releaseUpper(lane,true);
    for(const lane of upperPressed)if(!session.upperDown.has(lane)){const t=inputTime();if(recordEvent(t,lane,2))applyNotifications(session.pressFlick(t,lane));}
  }
}
function hit(lane){flashes[lane]=performance.now();if(mode==='idle'){piano.start(lane);return;}if(mode!=='running')return;const t=inputTime(),target=noteForKey(session.notes,lane,t);piano.start(lane,target?.midi??pitchForKey(session.notes,lane,t));if(recordEvent(t,lane,1))applyNotifications(session.press(t,lane));}
function releaseLane(lane,force=false){piano.stop(lane);if(mode!=='running'&&!force)return;const t=inputTime();if(recordEvent(t,lane,0))applyNotifications(session.release(t,lane));}
function hitUpper(lane){if(mode!=='running')return;const t=inputTime();if(recordEvent(t,lane,2))applyNotifications(session.pressFlick(t,lane));}
function releaseUpper(lane,force=false){if(mode!=='running'&&!force)return;const t=inputTime();if(recordEvent(t,lane,3))applyNotifications(session.releaseFlick(t,lane));}
function loadPlayer(){
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  script.onerror=()=>{stateText('VIDEO CONNECTION FAILED');$('startHint').textContent='YouTubeに接続できません。回線を確認してページを再読み込みしてください。';};
  window.onYouTubeIframeAPIReady=()=>{
    player=new window.YT.Player('youtubePlayer',{width:'100%',height:'100%',videoId:song().video,playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin},events:{
      onReady:()=>{ready=true;applyVolume();$('startHint').textContent='ENTERでスタート · 黒鍵は自動サポート';$('videoStatus').innerHTML='音楽はYouTubeの公式動画から再生します。<br>再生前・再生中に広告が入る場合があります。';},
      onStateChange:event=>{
        if(event.data===1){
          if(['loading','buffering'].includes(mode)){playbackArmed=true;playback.hold(performance.now());}
          else if(['paused','idle','results','countdown'].includes(mode))player.pauseVideo();
        }
        if(event.data===3&&mode==='running')waitForVideo();
        if(event.data===2&&mode==='running')waitForVideo();
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
function project(x,depth){return projectPoint(x,W,depth,40,H-99).x;}
function draw(now){
  const dt=Math.min((now-lastFrame)/16.67,3);lastFrame=now;syncPlayback(now);
  const active=['running','buffering','loading','countdown','paused'].includes(mode);
  const t=(mode==='running'?time():clock)-prefs.offset/1000;
  if(mode==='running'){
    applyNotifications(session.advance(t));$('timer').textContent=formatTime(Math.min(song().duration,t))+' / '+formatTime(song().duration);$('progress').style.width=Math.min(100,Math.max(0,t)/song().duration*100)+'%';if(t>=song().duration)finish();
  }
  ctx.clearRect(0,0,W,H);const top=40,hitY=H-99,span=hitY-top,laneW=W/8;
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#172026');bg.addColorStop(1,'#24312f');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(let lane=0;lane<8;lane++){ctx.beginPath();ctx.moveTo(project(lane*laneW,0),top);ctx.lineTo(project((lane+1)*laneW,0),top);ctx.lineTo((lane+1)*laneW,hitY);ctx.lineTo(lane*laneW,hitY);ctx.closePath();ctx.fillStyle=lane<4?(lane%2?'#ef9e8812':'#ef9e8807'):(lane%2?'#a8e3cb12':'#a8e3cb07');ctx.fill();if(pressed.has(lane)||now-flashes[lane]<170){const glow=ctx.createLinearGradient(0,hitY-160,0,hitY);glow.addColorStop(0,'transparent');glow.addColorStop(1,lane<4?'#ec634b55':'#a8e3cb55');ctx.fillStyle=glow;ctx.fill();}}
  for(let i=0;i<=8;i++){ctx.lineWidth=i===4?2:1;ctx.setLineDash(i===4?[8,7]:[]);ctx.strokeStyle=i===4?'#ffffffaa':i===0||i===8?'#ffffff66':'#ffffff40';ctx.beginPath();ctx.moveTo(project(i*laneW,0),top);ctx.lineTo(i*laneW,hitY);ctx.stroke();}ctx.setLineDash([]);ctx.lineWidth=1;
  ctx.textAlign='center';ctx.font='700 11px "DM Sans",sans-serif';ctx.fillStyle='#f2a38e';ctx.fillText('左手',project(W/4,0),top-12);ctx.fillStyle='#b3e4c8';ctx.fillText('右手',project(W*3/4,0),top-12);
  const lookahead=2.2/prefs.speed;const beat=60/song().bpm;const visualTime=active?t:now/1000*.65;
  for(let b=Math.floor(visualTime/beat);b<visualTime/beat+lookahead/beat+2;b++){const diff=b*beat-visualTime;if(diff<0||diff>lookahead)continue;const depth=1-diff/lookahead,y=top+span*depth*depth;ctx.strokeStyle=b%(song().meter||4)===0?'#c2decd1f':'#c2decd0b';ctx.beginPath();ctx.moveTo(project(0,depth),y);ctx.lineTo(project(W,depth),y);ctx.stroke();}
  let visibleNotes=notes;
  if(!active&&mode!=='results'){visibleNotes=Array.from({length:20},(_,i)=>({t:visualTime+(i*.31-(visualTime%3.1)),lane:[0,2,4,5,3,2,1,0,6,7][i%10],degree:[0,2,4,5,3,2,1,0,6,7][i%10]}));}
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
    const color=n.assist?'#8a99a3':n.lane<4?'#f0937f':'#b3e4c8';
    if(n.end){
      const tailDepth=Math.min(1,Math.max(0,1-tailDiff/lookahead));
      const tail=projectPoint(xBase,W,tailDepth,top,hitY);
      const headHalf=laneW*.21*head.scale,tailHalf=laneW*.21*tail.scale;
      ctx.globalAlpha=n.started?.65:.3;ctx.fillStyle=color;
      ctx.beginPath();ctx.moveTo(tail.x-tailHalf,tail.y);ctx.lineTo(tail.x+tailHalf,tail.y);ctx.lineTo(x+headHalf,y);ctx.lineTo(x-headHalf,y);ctx.closePath();ctx.fill();
      ctx.globalAlpha=.8;ctx.fillRect(tail.x-tailHalf,tail.y,tailHalf*2,3);
      ctx.strokeStyle=color;ctx.lineWidth=n.started?2:1;ctx.beginPath();ctx.moveTo(tail.x-tailHalf,tail.y);ctx.lineTo(x-headHalf,y);ctx.moveTo(tail.x+tailHalf,tail.y);ctx.lineTo(x+headHalf,y);ctx.stroke();
    }
    ctx.globalAlpha=n.assist?.32:.4+.6*depth;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=depth>.7?8:0;
    ctx.beginPath();ctx.roundRect(x-width/2,y-height/2,width,height,Math.max(1,3*depth));ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
    if(!n.assist&&depth>.25){ctx.fillStyle='#244337';ctx.textAlign='center';ctx.font=`700 ${Math.max(7,(n.flick?12:15)*depth)}px \"DM Sans\",sans-serif`;ctx.fillText(n.flick?label(prefs.keys[n.lane])+'↑'+label(FLICK_KEYS[n.lane]):label(prefs.keys[n.lane]),x,y+5*depth);}
  }
  ctx.fillStyle='#fff';ctx.globalAlpha=.65;ctx.fillRect(0,hitY-1,W,2);ctx.globalAlpha=1;ctx.shadowColor='#b3e4c8';ctx.shadowBlur=12;ctx.fillStyle='#b3e4c8';ctx.fillRect(0,hitY,W,1);ctx.shadowBlur=0;
  const keyTop=hitY+3,keyH=H-keyTop-4;
  for(let i=0;i<8;i++){const down=pressed.has(i)||now-flashes[i]<100;const x=i*laneW;const keyGrad=ctx.createLinearGradient(0,keyTop,0,H);keyGrad.addColorStop(0,down?(i<4?'#f5ac98':'#b6e5d2'):'#f3f3e9');keyGrad.addColorStop(1,down?(i<4?'#d8765c':'#76b39b'):'#cbd2bf');ctx.fillStyle=keyGrad;ctx.beginPath();ctx.roundRect(x+1,keyTop,laneW-2,keyH,3);ctx.fill();ctx.fillStyle='#58644e';ctx.textAlign='center';ctx.font='700 12px "DM Sans",sans-serif';ctx.fillText(label(prefs.keys[i]),x+laneW/2,H-20);if(difficulty===2){ctx.font='700 9px \"DM Sans\",sans-serif';ctx.fillStyle='#6a7766';ctx.fillText('↑ '+label(FLICK_KEYS[i]),x+laneW/2,H-36);}}
  [1,2,4,5,6].forEach((boundary,i)=>{const x=boundary*laneW,down=now-blackFlashes[i]<130;ctx.fillStyle=down?'#719c88':'#172127';ctx.shadowColor='#0006';ctx.shadowBlur=4;ctx.beginPath();ctx.roundRect(x-laneW*.25,keyTop,laneW*.5,38,2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=down?'#c4edd7':'#3c494a';ctx.beginPath();ctx.moveTo(x-laneW*.2,keyTop+33);ctx.lineTo(x+laneW*.2,keyTop+33);ctx.stroke();});
  ctx.strokeStyle='#ffffffdd';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W/2,keyTop+42);ctx.lineTo(W/2,H);ctx.stroke();
  ctx.font='700 10px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillStyle='#6b4b40';ctx.fillText('左手',W/4,H-5);ctx.fillStyle='#355749';ctx.fillText('右手',W*3/4,H-5);
  const centerY=hitY-88;if(active&&stats.combo>1){ctx.textAlign='center';ctx.fillStyle='#e0ecdf';ctx.font='500 47px "Barlow Condensed",sans-serif';ctx.fillText(String(stats.combo),W/2,centerY);ctx.font='7px "DM Sans",sans-serif';ctx.fillStyle='#78968b';ctx.fillText('C O M B O',W/2,centerY+16);}
  if(active&&lastJudge&&now-judgeAt<650){ctx.globalAlpha=Math.max(0,1-(now-judgeAt)/650);ctx.textAlign='center';ctx.font='700 19px "Barlow Condensed",sans-serif';ctx.fillStyle=lastJudge==='miss'?'#ef937f':'#c5edcd';ctx.fillText(lastJudge.toUpperCase(),W/2,centerY-44);if(lastJudge!=='miss'&&lastJudge!=='hold'&&lastJudge!=='flick'){ctx.font='8px "DM Sans",sans-serif';ctx.fillStyle='#87b3a3';ctx.fillText((judgeDelta>0?'LATE +':'EARLY ')+judgeDelta+' ms',W/2,centerY-28);}ctx.globalAlpha=1;}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=.035*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,2,3);if(p.life<=0)particles.splice(i,1);}ctx.globalAlpha=1;
  document.querySelectorAll('[data-key]').forEach(k=>k.classList.toggle('pressed',pressed.has(prefs.keys.indexOf(k.dataset.key))));requestAnimationFrame(draw);
}
function openDialog(id){if(['running','buffering','loading','countdown'].includes(mode))pause();$(id).showModal();}
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
  const open=document.querySelector('dialog[open]');
  if(open){if(remapping){event.preventDefault();if(event.code==='Escape'){remapping=false;remapKeys=[];renderKeyGuide();$('remapHint').textContent='変更をキャンセルしました。';return;}if(event.repeat)return;if(!/^Key[A-Z]$|^Digit[0-9]$|^Semicolon$|^Comma$|^Period$|^Slash$/.test(event.code)||[...FLICK_KEYS,'KeyV'].includes(event.code)||remapKeys.includes(event.code)){toast('重複しない英数字・記号を選んでください。上段QWER/UIOPとVは専用キーです。');return;}remapKeys.push(event.code);if(remapKeys.length===8){prefs.keys=[...remapKeys];remapping=false;savePrefs();$('remapHint').textContent='キー配置を保存しました。';}renderKeyGuide();}return;}
  if(event.code==='Tab')return;
  if(event.code==='KeyV'&&!event.repeat){event.preventDefault();toggleFullscreen();return;}
  if(event.code==='KeyO'&&!event.repeat&&(event.shiftKey||difficulty!==2||!['running','buffering','loading','countdown'].includes(mode))){event.preventDefault();openDialog('settingsDialog');return;}
  if(event.key==='?'&&!event.repeat){event.preventDefault();openDialog('helpDialog');return;}
  if(mode==='results'&&event.code==='KeyS'&&!event.repeat){event.preventDefault();saveScore();return;}
  if(mode==='idle'||mode==='paused'){
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){event.preventDefault();if(event.repeat)return;if(event.code==='ArrowUp')moveSong(-1);if(event.code==='ArrowDown')moveSong(1);if(event.code==='ArrowLeft')selectDifficulty(difficulty-1);if(event.code==='ArrowRight')selectDifficulty(difficulty+1);return;}
  }
  if(event.code==='Escape'&&!event.repeat){event.preventDefault();if(mode==='paused'||mode==='results')quit();else pause();return;}
  if(event.code==='Enter'||event.code==='Space'){
    const button=event.target.closest?.('button');if(button&&!button.dataset.song)return;
    event.preventDefault();if(event.repeat)return;if(mode==='paused')resume();else if(['idle','results'].includes(mode))start();return;
  }
  if(event.code==='KeyR'&&!event.repeat&&mode!=='idle'&&(event.shiftKey||difficulty!==2||!['running','buffering','loading','countdown'].includes(mode))){event.preventDefault();mode='retrying';start();return;}
  const upper=FLICK_KEYS.indexOf(event.code);if(difficulty===2&&upper!==-1&&['running','buffering','loading','countdown','paused'].includes(mode)){event.preventDefault();if(event.repeat||upperPressed.has(upper))return;upperPressed.add(upper);hitUpper(upper);return;}
  const lane=prefs.keys.indexOf(event.code);if(lane!==-1){event.preventDefault();if(event.repeat||pressed.has(lane))return;pressed.add(lane);hit(lane);}
});
document.addEventListener('keyup',event=>{const upper=FLICK_KEYS.indexOf(event.code);if(difficulty===2&&upper!==-1){upperPressed.delete(upper);releaseUpper(upper,mode==='buffering');}const lane=prefs.keys.indexOf(event.code);if(lane!==-1){pressed.delete(lane);releaseLane(lane,mode==='buffering');}});
window.addEventListener('blur',()=>{piano.stopAll();upperPressed.clear();pressed.clear();if(['running','buffering','loading','countdown'].includes(mode))pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','buffering','loading','countdown'].includes(mode))pause();});
$('startButton').onclick=start;$('resumeButton').onclick=resume;$('pauseButton').onclick=pause;$('retryButton').onclick=()=>{mode='retrying';start();};$('quitButton').onclick=quit;$('resultRetry').onclick=start;$('resultBack').onclick=quit;$('saveScore').onclick=saveScore;
$('settingsButton').onclick=() =>openDialog('settingsDialog');$('remapShortcut').onclick=()=>openDialog('settingsDialog');$('helpButton').onclick=()=>openDialog('helpDialog');$('profileButton').onclick=()=>{setName();openDialog('profileDialog');};
document.querySelectorAll('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{remapping=false;remapKeys=[];renderKeyGuide();});dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});});
document.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>selectDifficulty(Number(button.dataset.difficulty)));
for(const key of ['speed','volume','pianoVolume','offset'])$(key).oninput=()=>{prefs[key]=Number($(key).value);if(key==='offset'&&mode!=='idle'&&mode!=='results'){eligible=false;toast('この回は練習プレイになります。次のプレイから新しい判定設定を使います。');}savePrefs();if(key==='volume')applyVolume();if(key==='pianoVolume')piano.stopAll();};
$('resetSettings').onclick=()=>{prefs={...DEFAULTS,keys:[...DEFAULT_KEYS]};savePrefs();applyVolume();toast('設定を初期値に戻しました');};
$('remapButton').onclick=()=>{remapping=true;remapKeys=[];renderKeyGuide();$('remapHint').textContent='左から順に8つのキーを押してください。Escでキャンセル。';};
$('profileForm').onsubmit=event=>{event.preventDefault();name=$('nameInput').value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,16)||'PLAYER';write('pulse-name',name);setName();$('profileDialog').close();toast('プレイヤー名を保存しました');};
$('refreshScores').onclick=loadLeaders;
document.querySelectorAll('[data-pack]').forEach(button=>button.onclick=()=>{libraryPack=button.dataset.pack;renderSongs();});
$('pauseChange').onclick=()=>requestSelection();$('changeSong').onchange=updateSelectionWarning;$('changeDifficulty').onchange=updateSelectionWarning;$('confirmTrackChange').onclick=confirmSelection;
$('fullscreenButton').onclick=toggleFullscreen;$('playFullscreen').onclick=toggleFullscreen;
$('exitChartFullscreen').onclick=toggleFullscreen;$('chartPause').onclick=()=>mode==='paused'?resume():pause();
$('communityButton').onclick=browseCharts;$('communityRefresh').onclick=refreshCharts;
$('standardChartButton').onclick=()=>{if(!['idle','results'].includes(mode))return;if(mode==='results')quit();activeChart=null;selectSong(selected);selectDifficulty(difficulty);};
savePrefs();setName();renderSongs();selectSong(0);selectDifficulty(1);loadPlayer();requestAnimationFrame(draw);

let tutorial=null;
async function openTutorial(){if(['running','buffering','loading','countdown'].includes(mode))pause();$('helpDialog').close();if(!tutorial){const {createTutorial}=await import('./tutorial.mjs?v=tutorial-1');tutorial=createTutorial({dialog:$('tutorialDialog'),getKeys:()=>prefs.keys,getDifficulty:()=>difficulty,piano});}tutorial.open();}
$('tutorialHero').onclick=openTutorial;$('tutorialButton').onclick=openTutorial;$('helpTutorial').onclick=openTutorial;

$('testPiano').onclick=()=>{piano.start(0);setTimeout(()=>piano.stop(0),350);};

// Prepare audio on a user gesture before the first played key.
document.addEventListener('pointerdown',()=>piano.unlock(),{capture:true,once:true});
window.addEventListener('keydown',event=>{if(prefs.keys.includes(event.code)&&!event.repeat)piano.unlock();},{capture:true});
