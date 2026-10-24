import {SONGS,DIFFICULTIES,SESSION_SECONDS,makeChart,newStats,summary,CHART_VERSION,RhythmSession} from './engine.mjs';
import {API_URL,PUBLIC_KEY} from './config.js';
import {projectPoint} from './geometry.mjs';

const $=id=>document.getElementById(id);
const DEFAULT_KEYS=['KeyA','KeyS','KeyD','KeyF','KeyJ','KeyK','KeyL','Semicolon'];
const DEFAULTS={speed:1,volume:70,offset:0,notation:true,keys:DEFAULT_KEYS};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage is optional. */}};
let prefs={...DEFAULTS,...read('pulse-prefs',{})};
if(!Array.isArray(prefs.keys)||prefs.keys.length!==8||new Set(prefs.keys).size!==8)prefs.keys=[...DEFAULT_KEYS];
prefs.speed=Math.min(2,Math.max(.5,Number(prefs.speed)||1));
prefs.offset=Math.min(500,Math.max(-500,Number(prefs.offset)||0));
prefs.volume=Math.min(100,Math.max(0,Number(prefs.volume)||0));
let token=read('pulse-device',null);
if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');write('pulse-device',token);}
let name=read('pulse-name','PLAYER-'+token.slice(0,4).toUpperCase());
if(typeof name!=='string')name='PLAYER';
const bests=read('pulse-bests',{});
let selected=0,difficulty=1,mode='idle',session=null,notes=[],stats=newStats(),events=[],runId=null,runPromise=null,eligible=true;
let ready=false,player=null,lastRaw=0,lastWall=performance.now(),clock=0,lastFrame=performance.now(),loadingStarted=0,sequence=0;
let lastJudge='',judgeAt=0,judgeDelta=0,toastTimer,remapping=false,remapKeys=[],leaderRequest=0,submitted=false;
const pressed=new Set(),flashes=Array(8).fill(0),blackFlashes=Array(5).fill(0),particles=[];
const canvas=$('game'),ctx=canvas.getContext('2d');
let W=600,H=535,dpr=1;
const label=code=>({Semicolon:';',Comma:',',Period:'.',Slash:'/'}[code]|| (code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):code));
const song=()=>SONGS[selected];
const scoreKey=()=>`${CHART_VERSION}:${song().id}:${difficulty}`;
const fmt=n=>n.toLocaleString('en-US');
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function savePrefs(){write('pulse-prefs',prefs);$('speedLabel').textContent=`SPEED ${prefs.speed.toFixed(1)}×`;syncSettings();renderKeyGuide();}
async function toggleFullscreen(){if(document.body.classList.contains('chart-expanded')){document.body.classList.remove('chart-expanded');syncExpandedControls();return;}try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen({navigationUI:'hide'});}catch{document.body.classList.add('chart-expanded');}syncExpandedControls();}
function syncExpandedControls(){const on=!!document.fullscreenElement||document.body.classList.contains('chart-expanded');$('fullscreenButton').setAttribute('aria-pressed',String(on));$('fullscreenButton').setAttribute('aria-label',on?'譜面の全画面を終了':'譜面を全画面にする');$('fullscreenButton').innerHTML=(on?'⛶ 戻す':'⛶ 譜面全画面')+' <kbd>V</kbd>';$('playFullscreen').textContent=(on?'⛶ 戻す':'⛶ 譜面全画面')+' [V]';}
document.addEventListener('fullscreenchange',syncExpandedControls);
function staffSvg(degree){const y=34-degree*2.5;return `<svg width="34" height="38" viewBox="0 0 34 38" aria-hidden="true"><g stroke="currentColor" opacity=".35" stroke-width=".5">${[9,14,19,24,29].map(y=>`<path d="M2 ${y}H32"/>`).join('')}</g>${degree===0?'<path d="M8 34H24" stroke="currentColor" stroke-width=".7"/>':''}<ellipse cx="16" cy="${y}" rx="3.5" ry="2.5" fill="currentColor" transform="rotate(-18 16 ${y})"/><path d="M19 ${y}v-15" stroke="currentColor" stroke-width="1"/></svg>`;}
function renderKeyGuide(){for(let hand=0;hand<2;hand++){$(hand?'rightKeys':'leftKeys').innerHTML=prefs.keys.slice(hand*4,hand*4+4).map((code,i)=>`<span class="guide-key">${prefs.notation?staffSvg(i+hand*4):''}<kbd data-key="${code}">${label(code)}</kbd></span>`).join('');}$('mappingKeys').innerHTML=prefs.keys.map((code,i)=>`<kbd class="${remapping&&i===remapKeys.length?'current':''}">${remapping?(remapKeys[i]?label(remapKeys[i]):'·'):label(code)}</kbd>`).join('');}
function syncSettings(){for(const key of ['speed','volume','offset']){$(key).value=prefs[key];$(key+'Output').textContent=key==='speed'?prefs[key].toFixed(1)+'×':key==='volume'?prefs[key]+'%':prefs[key]+' ms';}$('notationToggle').checked=prefs.notation;$('notationButton').textContent=`♪ 音符 ${prefs.notation?'ON':'OFF'} [N]`;}
function setName(){ $('playerName').textContent=name;$('nameInput').value=name; }
function renderSongs(){
  $('songs').innerHTML=SONGS.map((s,i)=>`<button class="song ${i===selected?'selected':''}" data-song="${i}" aria-pressed="${i===selected}"><span class="song-art" style="background:${s.color}">${String(s.rank).padStart(2,'0')}</span><span class="song-info"><strong>${s.title}</strong><small>${s.artist}</small></span></button>`).join('');
  document.querySelectorAll('[data-song]').forEach(b=>b.addEventListener('click',()=>selectSong(Number(b.dataset.song))));
}
function selectSong(index){if(mode!=='idle')return;const previous=selected;selected=(index+SONGS.length)%SONGS.length;renderSongs();const s=song();$('trackTitle').textContent=s.title;$('trackArtist').textContent=s.artist+' / '+s.vocal;$('bpm').textContent=s.bpm;$('miniArt').textContent=String(s.rank).padStart(2,'0');$('miniArt').style.background=s.color;$('originalLink').href='https://www.youtube.com/watch?v='+s.video;$('sheetLink').href=s.source;$('chartInfo').textContent=s.chartLabel||'公開採譜を参考にした簡略フレーズ';if(ready&&previous!==selected)player.cueVideoById(s.video);updateBest();loadLeaders();}
function selectDifficulty(index){if(mode!=='idle')return;difficulty=(index+3)%3;document.querySelectorAll('[data-difficulty]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.difficulty)===difficulty);b.setAttribute('aria-pressed',Number(b.dataset.difficulty)===difficulty);});$('leaderDifficulty').textContent=DIFFICULTIES[difficulty];updateBest();loadLeaders();}
function updateBest(){const b=bests[scoreKey()];$('personalBest').textContent=b?fmt(b.score):'—';}
async function api(path,body){const response=await fetch(API_URL+path,{method:body?'POST':'GET',headers:{apikey:PUBLIC_KEY,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'クラウドへ接続できませんでした');return data;}
async function loadLeaders(){const request=++leaderRequest;$('leaders').innerHTML='<li class="empty-state">ランキングを読み込み中…</li>';try{const data=await api(`/leaderboard?song=${song().id}&difficulty=${difficulty}`);if(request!==leaderRequest)return;$('cloudStatus').textContent='ONLINE';$('leaders').replaceChildren();if(!data.scores?.length){const li=document.createElement('li');li.className='empty-state';li.textContent='まだ記録がありません。\n最初のスコアを刻もう。';$('leaders').append(li);return;}data.scores.forEach((row,i)=>{const li=document.createElement('li'),num=document.createElement('span'),person=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),score=document.createElement('span');num.className='leader-num';num.textContent=String(i+1).padStart(2,'0');person.className='leader-person';strong.textContent=row.name;small.textContent=row.accuracy.toFixed(2)+'% · '+row.max_combo+' COMBO';person.append(strong,small);score.className='leader-score';score.textContent=fmt(row.score);li.append(num,person,score);$('leaders').append(li);});}catch{if(request!==leaderRequest)return;$('cloudStatus').textContent='OFFLINE';$('leaders').innerHTML='<li class="empty-state">接続できませんでした。<br>↻ で再読み込みできます。</li>';}}
function stateText(text){$('playState').textContent=text;}
function show(id){for(const name of ['stageMessage','pauseMessage','resultMessage'])$(name).classList.toggle('hidden',name!==id);}
function start(){
  if(!ready){toast('公式プレイヤーを読み込み中です。準備完了後にEnterを押してください。');return;}
  if(mode==='loading')return;
  sequence++;const seq=sequence;mode='loading';document.body.classList.add('focus-play');window.scrollTo({top:0,behavior:'instant'});clock=0;lastRaw=0;lastWall=performance.now();loadingStarted=performance.now();session=new RhythmSession(makeChart(song(),difficulty));notes=session.notes;stats=session.stats;events=[];eligible=true;runId=null;submitted=false;lastJudge='';pressed.clear();particles.length=0;
  show(null);$('stage').classList.add('running');$('pauseButton').disabled=false;$('progress').style.width='0%';stateText('LOADING OFFICIAL VIDEO');updateStats();canvas.focus();
  runPromise=api('/start',{song:song().id,difficulty,playerToken:token,version:CHART_VERSION}).then(data=>{if(seq===sequence)runId=data.runId;}).catch(()=>{if(seq===sequence)toast('クラウドに接続できないため、この回は端末に保存します。');});
  player.setVolume(prefs.volume);player.setPlaybackRate(1);player.loadVideoById({videoId:song().video,startSeconds:0,endSeconds:SESSION_SECONDS});
}
function pause(){if(!['running','buffering','loading'].includes(mode))return;mode='paused';player?.pauseVideo();$('pauseMessage').querySelector('h2').textContent='PAUSED.';show('pauseMessage');stateText('PAUSED');}
function resume(){if(mode!=='paused')return;syncHeldKeys();mode='loading';loadingStarted=performance.now();show(null);stateText('RESUMING');player.playVideo();canvas.focus();}
function quit(){sequence++;mode='idle';document.body.classList.remove('focus-play');player?.pauseVideo();show('stageMessage');$('stage').classList.remove('running');$('pauseButton').disabled=true;pressed.clear();stateText('READY TO PLAY');$('timer').textContent='00:00 / 01:00';$('progress').style.width='0%';selectSong(selected);selectDifficulty(difficulty);}
function updateStats(){
  const count=notes.filter(n=>!n.assist).length||1,result=summary(stats,count);
  const score=String(result.score).padStart(7,'0');
  const judged=stats.perfect+stats.great+stats.good+stats.bad+stats.miss;
  const accuracy=judged?(stats.weight/judged*100).toFixed(2):'—';
  $('score').textContent=score;$('accuracy').innerHTML=accuracy+'<small>%</small>';$('maxCombo').textContent=stats.maxCombo;
  $('stageScore').textContent=score;$('stageCombo').textContent=stats.combo;$('stageAccuracy').textContent=accuracy;
}
function finish(){if(mode==='results'||mode==='idle')return;mode='results';player.pauseVideo();pressed.clear();applyNotifications(session.finish());updateStats();const result=summary(stats,notes.filter(n=>!n.assist).length);$('resultRank').textContent=result.rank;$('resultScore').textContent=String(result.score).padStart(7,'0');$('resultDetail').textContent=`${result.accuracy.toFixed(2)}% ACCURACY / ${result.maxCombo} MAX COMBO`;$('resultCounts').innerHTML=['perfect','great','good','bad','miss'].map(key=>`<span>${key.toUpperCase()}<b>${stats[key]}</b></span>`).join('');const prev=bests[scoreKey()];const isBest=!prev||result.score>prev.score;if(isBest){bests[scoreKey()]=result;write('pulse-bests',bests);}$('bestBadge').style.display=isBest?'':'none';$('saveScore').disabled=!eligible;$('saveScore').textContent=eligible?'ランキングに登録 [S]':'練習プレイ（シーク・速度変更あり）';$('saveStatus').textContent='名前とスコアが公開されます';show('resultMessage');$('pauseButton').disabled=true;stateText('SESSION COMPLETE');$('progress').style.width='100%';updateBest();}
async function saveScore(){if(mode!=='results'||submitted||!eligible)return;$('saveScore').disabled=true;$('saveStatus').textContent='クラウドへ登録中…';try{await runPromise;if(!runId)throw new Error('接続できませんでした。次のプレイで再度お試しください。');const result=await api('/submit',{runId,playerToken:token,name,events});submitted=true;$('saveScore').textContent=result.improved?'ランキング登録完了':'自己ベストをキープ';$('saveStatus').textContent='保存しました。ランキングを更新しました。';loadLeaders();toast('クラウドにスコアを保存しました');}catch(error){$('saveScore').disabled=false;$('saveStatus').textContent=error.message;}}
function time(){if(mode!=='running')return clock;const raw=player.getCurrentTime()||0,now=performance.now();if(raw===0&&clock>1)return clock;if(Math.abs(raw-clock)>1.3&&raw>1)eligible=false;clock=raw;lastRaw=raw;lastWall=now;return clock;}
function recordEvent(t,lane,action){const ms=Math.round(t*1000);if(ms<0||ms>60200)return false;events.push([Math.max(ms,events.at(-1)?.[0]||0),lane,action]);return true;}
function applyNotifications(list){
  const now=performance.now();let changed=false;
  for(const event of list){
    if(event.kind==='assist'){blackFlashes[event.note.blackIndex]=now;continue;}
    if(event.kind==='holdstart'){lastJudge='hold';judgeAt=now;continue;}
    if(event.kind!=='judge')continue;
    changed=true;lastJudge=event.result;judgeDelta=Math.round(event.delta*1000);judgeAt=now;
    if(event.result!=='miss'){const x=(event.note.lane+.5)*W/8;for(let i=0;i<9;i++)particles.push({x,y:H-97,vx:(Math.random()-.5)*2.5,vy:-Math.random()*4-1,life:1,color:event.note.chord?'#f3d386':event.note.lane<4?'#f4917e':'#b4e9cf'});}
  }
  if(changed)updateStats();
}
function inputTime(){return Math.round(((mode==='running'?time():clock)-prefs.offset/1000)*1000)/1000;}
function syncHeldKeys(){if(!session)return;for(const lane of [...session.down])if(!pressed.has(lane))releaseLane(lane,true);for(const lane of pressed)if(!session.down.has(lane)){const t=inputTime();if(recordEvent(t,lane,1))applyNotifications(session.press(t,lane));}}
function hit(lane){flashes[lane]=performance.now();if(mode!=='running')return;const t=inputTime();if(recordEvent(t,lane,1))applyNotifications(session.press(t,lane));}
function releaseLane(lane,force=false){if(mode!=='running'&&!force)return;const t=inputTime();if(recordEvent(t,lane,0))applyNotifications(session.release(t,lane));}
function loadPlayer(){const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{stateText('VIDEO CONNECTION FAILED');$('startHint').textContent='YouTubeに接続できません。回線を確認してページを再読み込みしてください。';};window.onYouTubeIframeAPIReady=()=>{player=new window.YT.Player('youtubePlayer',{width:'100%',height:'100%',videoId:song().video,playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin},events:{onReady:()=>{ready=true;player.setVolume(prefs.volume);$('startHint').textContent='ENTERでスタート · 黒鍵は自動サポート';$('videoStatus').innerHTML='公式動画をそのまま再生。<br>音楽に合わせて、世界のスコアに挑戦。';},onStateChange:event=>{if(event.data===1){if(['loading','buffering'].includes(mode)){clock=player.getCurrentTime()||0;lastWall=performance.now();mode='running';syncHeldKeys();stateText('NOW PLAYING');show(null);}else if(mode==='paused')player.pauseVideo();else if(['idle','results'].includes(mode))player.pauseVideo();}if(event.data===3&&mode==='running'){clock=player.getCurrentTime()||clock;mode='buffering';stateText('BUFFERING · ノーツも停止しています');}if(event.data===2&&mode==='running'){mode='paused';show('pauseMessage');stateText('PAUSED');}if(event.data===0&&['running','buffering','loading'].includes(mode)){if(Math.max(clock,player.getCurrentTime()||0)>=SESSION_SECONDS-2)finish();else{eligible=false;pause();toast('動画が終了しました。リトライしてください。');}}},onPlaybackRateChange:event=>{if(event.data!==1&&mode!=='idle'){eligible=false;toast('再生速度が変わったため練習プレイになりました。');}},onError:()=>{quit();stateText('VIDEO UNAVAILABLE');$('startHint').textContent='この動画は現在再生できません。別の曲を選んでください。';toast('公式動画の埋め込み再生に失敗しました。別の曲を選んでください。');},onAutoplayBlocked:()=>{if(mode==='loading'){mode='paused';show('pauseMessage');$('pauseMessage').querySelector('h2').textContent='READY?';stateText('ENTER TO ALLOW PLAYBACK');toast('Enterでもう一度再生してください。');}}}});};document.head.append(script);}
function resize(){const rect=canvas.getBoundingClientRect();W=rect.width;H=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);
function project(x,depth){return projectPoint(x,W,depth,40,H-99).x;}
function drawStaff(cx,cy,degree,scale=1,color='#24352f'){
  ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=.6;ctx.globalAlpha=.35;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-11,-8+i*4);ctx.lineTo(11,-8+i*4);ctx.stroke();}ctx.globalAlpha=1;const y=12-degree*2;if(degree===0){ctx.beginPath();ctx.moveTo(-6,y);ctx.lineTo(7,y);ctx.stroke();}ctx.beginPath();ctx.ellipse(0,y,3.5,2.3,-.3,0,Math.PI*2);ctx.fill();ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(3,y);ctx.lineTo(3,y-16);ctx.stroke();ctx.restore();
}
function draw(now){
  const dt=Math.min((now-lastFrame)/16.67,3);lastFrame=now;
  const active=['running','buffering','loading','paused'].includes(mode);
  const t=(mode==='running'?time():clock)-prefs.offset/1000;
  if(mode==='running'){
    applyNotifications(session.advance(t));$('timer').textContent=`00:${String(Math.min(60,Math.floor(Math.max(0,t)))).padStart(2,'0')} / 01:00`;$('progress').style.width=Math.min(100,Math.max(0,t)/60*100)+'%';if(t>=SESSION_SECONDS)finish();
  }
  if(mode==='loading'&&now-loadingStarted>18000){pause();toast('読み込みに時間がかかっています。Enterで再開できます。');}
  ctx.clearRect(0,0,W,H);const top=40,hitY=H-99,span=hitY-top,laneW=W/8;
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#172026');bg.addColorStop(1,'#24312f');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(let lane=0;lane<8;lane++){ctx.beginPath();ctx.moveTo(project(lane*laneW,0),top);ctx.lineTo(project((lane+1)*laneW,0),top);ctx.lineTo((lane+1)*laneW,hitY);ctx.lineTo(lane*laneW,hitY);ctx.closePath();ctx.fillStyle=lane%2?'#0e191c44':'#bbd8bd07';ctx.fill();if(pressed.has(lane)||now-flashes[lane]<170){const glow=ctx.createLinearGradient(0,hitY-160,0,hitY);glow.addColorStop(0,'transparent');glow.addColorStop(1,lane<4?'#ec634b55':'#a8e3cb55');ctx.fillStyle=glow;ctx.fill();}}
  ctx.lineWidth=1;for(let i=0;i<=8;i++){ctx.strokeStyle=i===0||i===8?'#8cb4a14d':'#c5e1ce18';ctx.beginPath();ctx.moveTo(project(i*laneW,0),top);ctx.lineTo(i*laneW,hitY);ctx.stroke();}
  const lookahead=2.2/prefs.speed;const beat=60/song().bpm;const visualTime=active?t:now/1000*.65;
  for(let b=Math.floor(visualTime/beat);b<visualTime/beat+lookahead/beat+2;b++){const diff=b*beat-visualTime;if(diff<0||diff>lookahead)continue;const depth=1-diff/lookahead,y=top+span*depth*depth;ctx.strokeStyle=b%4===0?'#c2decd1f':'#c2decd0b';ctx.beginPath();ctx.moveTo(project(0,depth),y);ctx.lineTo(project(W,depth),y);ctx.stroke();}
  let visibleNotes=notes;
  if(!active&&mode!=='results'){visibleNotes=Array.from({length:20},(_,i)=>({t:visualTime+(i*.31-(visualTime%3.1)),lane:[0,2,4,5,3,2,1,0,6,7][i%10],degree:[0,2,4,5,3,2,1,0,6,7][i%10]}));}
  for(let i=visibleNotes.length-1;i>=0;i--){
    const n=visibleNotes[i];if(n.done)continue;
    const diff=n.t-visualTime,tailDiff=(n.end??n.t)-visualTime;
    if(diff>lookahead||tailDiff<-.2)continue;
    const depth=Math.min(1,Math.max(0,1-diff/lookahead));
    const y=top+span*depth*depth;
    const xBase=n.assist?n.boundary*laneW:(n.lane+.5)*laneW;
    const head=projectPoint(xBase,W,depth,top,hitY),x=head.x;
    const width=(n.assist?laneW*.32:laneW*.83)*head.scale,height=(n.assist?12:32)*(.35+.65*depth);
    const color=n.assist?'#8a99a3':n.chord?'#f3d386':n.lane<4?'#f0937f':'#b3e4c8';
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
    if(!n.assist&&depth>.25){
      if(prefs.notation){drawStaff(x-width*.13,y-1,n.degree??n.lane,Math.max(.35,depth*.92));ctx.fillStyle='#244337';ctx.textAlign='center';ctx.font=`700 ${Math.max(6,10*depth)}px "DM Sans",sans-serif`;ctx.fillText(label(prefs.keys[n.lane]),x+width*.29,y+4*depth);}
      else{ctx.fillStyle='#244337';ctx.textAlign='center';ctx.font=`700 ${Math.max(7,13*depth)}px "DM Sans",sans-serif`;ctx.fillText(label(prefs.keys[n.lane]),x,y+4*depth);}
    }
  }
  ctx.fillStyle='#fff';ctx.globalAlpha=.65;ctx.fillRect(0,hitY-1,W,2);ctx.globalAlpha=1;ctx.shadowColor='#b3e4c8';ctx.shadowBlur=12;ctx.fillStyle='#b3e4c8';ctx.fillRect(0,hitY,W,1);ctx.shadowBlur=0;
  const keyTop=hitY+3,keyH=H-keyTop-4;
  for(let i=0;i<8;i++){const down=pressed.has(i)||now-flashes[i]<100;const x=i*laneW;const keyGrad=ctx.createLinearGradient(0,keyTop,0,H);keyGrad.addColorStop(0,down?(i<4?'#f5ac98':'#b6e5d2'):'#f3f3e9');keyGrad.addColorStop(1,down?(i<4?'#d8765c':'#76b39b'):'#cbd2bf');ctx.fillStyle=keyGrad;ctx.beginPath();ctx.roundRect(x+1,keyTop,laneW-2,keyH,3);ctx.fill();ctx.fillStyle='#58644e';ctx.textAlign='center';ctx.font='700 12px "DM Sans",sans-serif';ctx.fillText(label(prefs.keys[i]),x+laneW/2,H-11);if(prefs.notation)drawStaff(x+laneW/2,H-44,i,.85,'#4b5d44');}
  [1,2,4,5,6].forEach((boundary,i)=>{const x=boundary*laneW,down=now-blackFlashes[i]<130;ctx.fillStyle=down?'#719c88':'#172127';ctx.shadowColor='#0006';ctx.shadowBlur=4;ctx.beginPath();ctx.roundRect(x-laneW*.25,keyTop,laneW*.5,38,2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=down?'#c4edd7':'#3c494a';ctx.beginPath();ctx.moveTo(x-laneW*.2,keyTop+33);ctx.lineTo(x+laneW*.2,keyTop+33);ctx.stroke();});
  const centerY=hitY-88;if(active&&stats.combo>1){ctx.textAlign='center';ctx.fillStyle='#e0ecdf';ctx.font='500 47px "Barlow Condensed",sans-serif';ctx.fillText(String(stats.combo),W/2,centerY);ctx.font='7px "DM Sans",sans-serif';ctx.fillStyle='#78968b';ctx.fillText('C O M B O',W/2,centerY+16);}
  if(active&&lastJudge&&now-judgeAt<650){ctx.globalAlpha=Math.max(0,1-(now-judgeAt)/650);ctx.textAlign='center';ctx.font='700 19px "Barlow Condensed",sans-serif';ctx.fillStyle=lastJudge==='miss'?'#ef937f':'#c5edcd';ctx.fillText(lastJudge.toUpperCase(),W/2,centerY-44);if(lastJudge!=='miss'&&lastJudge!=='hold'){ctx.font='8px "DM Sans",sans-serif';ctx.fillStyle='#87b3a3';ctx.fillText((judgeDelta>0?'LATE +':'EARLY ')+judgeDelta+' ms',W/2,centerY-28);}ctx.globalAlpha=1;}
  if(['loading','buffering'].includes(mode)){ctx.textAlign='center';ctx.font='700 14px "DM Sans",sans-serif';ctx.fillStyle='#b4d1c2';ctx.fillText(mode==='loading'?'GET READY…':'BUFFERING…',W/2,hitY/2);}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=.035*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,2,3);if(p.life<=0)particles.splice(i,1);}ctx.globalAlpha=1;
  document.querySelectorAll('[data-key]').forEach(k=>k.classList.toggle('pressed',pressed.has(prefs.keys.indexOf(k.dataset.key))));requestAnimationFrame(draw);
}
function openDialog(id){if(['running','buffering','loading'].includes(mode))pause();$(id).showModal();}
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
  const open=document.querySelector('dialog[open]');
  if(open){if(remapping){event.preventDefault();if(event.code==='Escape'){remapping=false;remapKeys=[];renderKeyGuide();$('remapHint').textContent='変更をキャンセルしました。';return;}if(event.repeat)return;if(!/^Key[A-Z]$|^Digit[0-9]$|^Semicolon$|^Comma$|^Period$|^Slash$/.test(event.code)||['KeyR','KeyO','KeyN','KeyV'].includes(event.code)||remapKeys.includes(event.code)){toast('重複しない英数字・記号を選んでください。R・O・N・Vは操作用です。');return;}remapKeys.push(event.code);if(remapKeys.length===8){prefs.keys=[...remapKeys];remapping=false;savePrefs();$('remapHint').textContent='キー配置を保存しました。';}renderKeyGuide();}return;}
  if(event.code==='Tab')return;
  if(event.code==='KeyV'&&!event.repeat){event.preventDefault();toggleFullscreen();return;}
  if(event.code==='KeyO'&&!event.repeat){event.preventDefault();openDialog('settingsDialog');return;}
  if(event.code==='KeyN'&&!event.repeat){event.preventDefault();prefs.notation=!prefs.notation;savePrefs();return;}
  if(event.key==='?'&&!event.repeat){event.preventDefault();openDialog('helpDialog');return;}
  if(mode==='results'&&event.code==='KeyS'&&!event.repeat){event.preventDefault();saveScore();return;}
  if(mode==='idle'){
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){event.preventDefault();if(event.repeat)return;if(event.code==='ArrowUp')selectSong(selected-1);if(event.code==='ArrowDown')selectSong(selected+1);if(event.code==='ArrowLeft')selectDifficulty(difficulty-1);if(event.code==='ArrowRight')selectDifficulty(difficulty+1);return;}
  }
  if(event.code==='Escape'&&!event.repeat){event.preventDefault();if(mode==='paused'||mode==='results')quit();else pause();return;}
  if(event.code==='Enter'||event.code==='Space'){
    const button=event.target.closest?.('button');if(button&&!button.dataset.song)return;
    event.preventDefault();if(event.repeat)return;if(mode==='paused')resume();else if(['idle','results'].includes(mode))start();return;
  }
  if(event.code==='KeyR'&&!event.repeat&&mode!=='idle'){event.preventDefault();mode='retrying';start();return;}
  const lane=prefs.keys.indexOf(event.code);if(lane!==-1){event.preventDefault();if(event.repeat||pressed.has(lane))return;pressed.add(lane);hit(lane);}
});
document.addEventListener('keyup',event=>{const lane=prefs.keys.indexOf(event.code);if(lane!==-1){pressed.delete(lane);releaseLane(lane,mode==='buffering');}});
window.addEventListener('blur',()=>{pressed.clear();if(mode==='running'||mode==='buffering')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','buffering','loading'].includes(mode))pause();});
$('startButton').onclick=start;$('resumeButton').onclick=resume;$('pauseButton').onclick=pause;$('retryButton').onclick=()=>{mode='retrying';start();};$('quitButton').onclick=quit;$('resultRetry').onclick=start;$('resultBack').onclick=quit;$('saveScore').onclick=saveScore;
$('settingsButton').onclick=() =>openDialog('settingsDialog');$('remapShortcut').onclick=()=>openDialog('settingsDialog');$('helpButton').onclick=()=>openDialog('helpDialog');$('profileButton').onclick=()=>{setName();openDialog('profileDialog');};
document.querySelectorAll('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{remapping=false;remapKeys=[];renderKeyGuide();});dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});});
document.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>selectDifficulty(Number(button.dataset.difficulty)));
for(const key of ['speed','volume','offset'])$(key).oninput=()=>{prefs[key]=Number($(key).value);if(key==='offset'&&mode!=='idle'&&mode!=='results'){eligible=false;toast('この回は練習プレイになります。次のプレイから新しい判定設定を使います。');}savePrefs();if(key==='volume'&&ready)player.setVolume(prefs.volume);};
const toggleNotation=()=>{prefs.notation=!prefs.notation;savePrefs();};$('notationToggle').onchange=()=>{prefs.notation=$('notationToggle').checked;savePrefs();};$('notationButton').onclick=toggleNotation;
$('resetSettings').onclick=()=>{prefs={...DEFAULTS,keys:[...DEFAULT_KEYS]};savePrefs();if(ready)player.setVolume(prefs.volume);toast('設定を初期値に戻しました');};
$('remapButton').onclick=()=>{remapping=true;remapKeys=[];renderKeyGuide();$('remapHint').textContent='左から順に8つのキーを押してください。Escでキャンセル。';};
$('profileForm').onsubmit=event=>{event.preventDefault();name=$('nameInput').value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,16)||'PLAYER';write('pulse-name',name);setName();$('profileDialog').close();toast('プレイヤー名を保存しました');};
$('refreshScores').onclick=loadLeaders;
$('fullscreenButton').onclick=toggleFullscreen;$('playFullscreen').onclick=toggleFullscreen;
$('exitChartFullscreen').onclick=toggleFullscreen;$('chartPause').onclick=()=>mode==='paused'?resume():pause();
savePrefs();setName();renderSongs();selectSong(0);selectDifficulty(1);loadPlayer();requestAnimationFrame(draw);
