import {drawAirRibbons,drawAirHead} from './air.mjs';
import {RhythmSession,isFullCombo} from './engine.mjs';
import {projectPoint} from './geometry.mjs';

export const LESSONS=[
  {title:'単押し',lanes:[0],text:'ノーツが下の判定ラインに重なったら、表示されたキーを1回押そう。'},
  {title:'長押し',lanes:[2],hold:1.2,text:'帯の先頭で押し、帯がなくなるまで押し続けよう。途中で離すと失敗。'},
  {title:'同時押し',lanes:[3,4],text:'白い横線でつながった2つのノーツを、左右の手で同時に押そう。'},
  {title:'AIR：キー＋Space',lanes:[3],flick:true,text:'HARD限定。ラインでレーンキーを押したまま、0.22秒以内にSpace。Spaceだけでは成功しません。'},
  {title:'AIR：帯に沿ってレーン移動',lanes:[4,5,6],flick:true,sweep:true,text:'黄緑の帯に沿ってSpaceを押し続け、上向き矢印に合わせて右手の3キーを順に押そう。Spaceは途中で離さず、レーンキーだけを移動します。'},
];
export function lessonsFor(difficulty,includeFlick=true){return LESSONS.slice(0,difficulty===0?2:difficulty===1||!includeFlick?3:5);}
export class TutorialAttempt{
  constructor(lesson){this.session=new RhythmSession(lesson.lanes.map((lane,index)=>({t:2.4+(lesson.sweep?index*.7:0),lane,...(lesson.hold?{end:2.4+lesson.hold}:{}),...(lesson.flick?{flick:true}:{})})),6);this.status='running';}
  update(t,action,lane){
    const events=action?this.session[action](t,lane):this.session.advance(t);
    if(this.session.stats.miss||this.session.stats.bad)this.status='retry';
    else if(this.session.notes.every(n=>n.done))this.status=isFullCombo(this.session.stats,this.session.notes.length)?'success':'retry';
    return events;
  }
}

export function createTutorial({dialog,getKeys,getDifficulty,piano}){
  const $=id=>dialog.querySelector('#'+id),canvas=$('tutorialCanvas'),ctx=canvas.getContext('2d');
  let lessons=LESSONS,step=0,attempt=null,started=0,frame=0,retryAt=0,held=new Set();
  const keyLabel=code=>code==='Semicolon'?';':code.replace(/^Key|^Digit/,'');
  function release(){held.clear();piano.stopAll();}
  function showLesson(){
    attempt=null;retryAt=0;release();const lesson=lessons[step],keys=getKeys();
    $('tutorialProgress').textContent=`${step+1} / ${lessons.length}`;
    $('tutorialTitle').textContent=lesson.title;$('tutorialText').textContent=lesson.text;
    $('tutorialKeys').textContent=lesson.lanes.map(lane=>keyLabel(keys[lane])+(lesson.flick?' + SPACE':'')).join(lesson.sweep?' → ':' ＋ ');
    $('tutorialStatus').textContent='Enter または「練習開始」でスタート';
    $('tutorialNext').textContent='練習開始 [Enter]';$('tutorialNext').hidden=false;
    $('tutorialBack').disabled=step===0;
  }
  function begin(){release();attempt=new TutorialAttempt(lessons[step]);started=performance.now();retryAt=0;$('tutorialStatus').textContent='ノーツがラインに重なるまで待とう';$('tutorialNext').hidden=true;canvas.focus();}
  function next(){if(attempt?.status==='success'){if(step===lessons.length-1){dialog.close();return;}step++;showLesson();}else begin();}
  function update(t,action,lane){
    if(!attempt||attempt.status!=='running')return;
    const events=attempt.update(t,action,lane);
    if(attempt.status==='success'){$('tutorialStatus').textContent=step===lessons.length-1?'全レッスンクリア！ 選んだ難易度の曲で試してみよう。':'成功！ 次の操作へ進もう。';$('tutorialNext').textContent=step===lessons.length-1?'練習を終える [Enter]':'次へ [Enter]';$('tutorialNext').hidden=false;piano.stopAll();}
    else if(attempt.status==='retry'){$('tutorialStatus').textContent='もう一度！ キーを離して、次のノーツを待とう。';retryAt=performance.now()+1400;release();}
    else if(events.some(e=>e.kind==='holdstart'))$('tutorialStatus').textContent='そのまま押し続けて…';
    else if(events.some(e=>e.kind==='flickstart'))$('tutorialStatus').textContent='キーを押したままSpace！';
  }
  function draw(now){
    if(!dialog.open)return;
    if(retryAt&&now>=retryAt)begin();
    const t=attempt?(now-started)/1000:0;update(t);
    const W=800,H=360,hit=288,laneW=W/8;ctx.clearRect(0,0,W,H);ctx.fillStyle='#18282a';ctx.fillRect(0,0,W,H);
    const point=(x,d)=>projectPoint(x,W,d,22,hit);
    for(let i=0;i<=8;i++){const a=point(i*laneW,0),b=point(i*laneW,1);ctx.strokeStyle=i===4?'#ffffffaa':'#ffffff30';ctx.lineWidth=i===4?2:1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    ctx.fillStyle='#ef9b89';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('左手',290,16);ctx.fillStyle='#b3dfc4';ctx.fillText('右手',510,16);
    ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,hit);ctx.lineTo(W,hit);ctx.stroke();
    const keys=getKeys();for(let lane=0;lane<8;lane++){ctx.fillStyle=held.has(keys[lane])?(lane<4?'#ef947d':'#a9dcbf'):'#eff0e6';ctx.fillRect(lane*laneW+2,hit+6,laneW-4,62);ctx.fillStyle='#273b34';ctx.font='bold 19px sans-serif';ctx.fillText(keyLabel(keys[lane]),(lane+.5)*laneW,hit+39);}
    const lesson=lessons[step],notes=attempt?.session.notes||[];
    drawAirRibbons(ctx,notes,{width:W,time:t,lookahead:2.4,top:22,hitY:hit,held:held.has('Space')});
    const depth=at=>Math.max(0,Math.min(1.08,1-(at-t)/2.4));
    if(notes.length>1&&!lesson.sweep&&!notes.every(n=>n.done)){const d=depth(2.4),a=point((notes[0].lane+.5)*laneW,d),b=point((notes[1].lane+.5)*laneW,d);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const n of notes){if(n.done)continue;const d=n.started?1:depth(n.t),head=point((n.lane+.5)*laneW,d),color=n.lane<4?'#ef947d':'#a9dcbf';ctx.fillStyle=color;
      if(n.end){const tail=point((n.lane+.5)*laneW,depth(n.end));ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(head.x-33*head.scale,head.y);ctx.lineTo(tail.x-33*tail.scale,tail.y);ctx.lineTo(tail.x+33*tail.scale,tail.y);ctx.lineTo(head.x+33*head.scale,head.y);ctx.fill();ctx.globalAlpha=1;}
      if(n.flick){drawAirHead(ctx,head.x,head.y,84*head.scale,head.scale,keyLabel(keys[n.lane]),held.has('Space'));continue;}
      ctx.fillRect(head.x-42*head.scale,head.y-10*head.scale,84*head.scale,20*head.scale);ctx.fillStyle='#20332c';ctx.font=`bold ${Math.max(10,15*head.scale)}px sans-serif`;ctx.fillText(n.flick?keyLabel(keys[n.lane])+'+SP':keyLabel(keys[n.lane]),head.x,head.y+5*head.scale);
    }
    if(!attempt){ctx.fillStyle='#e1ebe3';ctx.font='bold 20px sans-serif';ctx.fillText('下のラインでキーを押す',W/2,150);}
    frame=requestAnimationFrame(draw);
  }
  function input(event,down){
    if(!dialog.open)return;
    if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
    const keys=getKeys(),lane=keys.indexOf(event.code),space=event.code==='Space';
    if(down&&event.code==='Enter'&&event.target.closest?.('select,input,button:not(#tutorialNext)'))return;
    if(down&&event.code==='Enter'){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat&&(!attempt||attempt.status==='success'))next();return;}
    if(lane<0&&!space)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(down){if(event.repeat||held.has(event.code))return;held.add(event.code);if(lane>=0)piano.start(lane);}
    else{held.delete(event.code);if(lane>=0)piano.stop(lane);}
    if(attempt?.status==='running'){
      const t=(performance.now()-started)/1000;
      if(space){for(let i=0;i<8;i++)if(held.has(keys[i])||!down)update(t,down?'pressFlick':'releaseFlick',i);}
      else{update(t,down?'press':'release',lane);if(down&&held.has('Space'))update(t,'pressFlick',lane);if(!down)update(t,'releaseFlick',lane);}
    }
  }
  document.addEventListener('keydown',e=>input(e,true),true);document.addEventListener('keyup',e=>input(e,false),true);
  window.addEventListener('blur',()=>{if(dialog.open){release();showLesson();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)showLesson();});
  dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);release();attempt=null;});
  $('tutorialNext').onclick=next;$('tutorialRetry').onclick=begin;$('tutorialBack').onclick=()=>{if(step>0){step--;showLesson();}};
  function chooseDifficulty(){const difficulty=Number($('tutorialDifficulty').value);$('tutorialFlick').disabled=difficulty!==2;lessons=lessonsFor(difficulty,$('tutorialFlick').checked);step=0;showLesson();}
  $('tutorialDifficulty').onchange=()=>{$('tutorialFlick').checked=Number($('tutorialDifficulty').value)===2;chooseDifficulty();};$('tutorialFlick').onchange=chooseDifficulty;
  return {open(){$('tutorialDifficulty').value=String(getDifficulty());$('tutorialFlick').checked=getDifficulty()===2;chooseDifficulty();dialog.showModal();piano.unlock();cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}};
}
