import {validateCustomNotes,draftKey} from './engine.mjs?v=vocaloid-20-1';
const $=id=>document.getElementById(id);
const keyLabel=code=>({Semicolon:';',Comma:',',Period:'.',Slash:'/'}[code]||code.replace(/^Key|^Digit/,''));
export function createCreator({onPlay,onEdit}){
  let song=null,keys=[],bar=0,notes=[],title='',difficulty=1,history=[],cursor={lane:0,step:0};
  const beat=()=>60/song.bpm,meter=()=>song.meter||4,steps=()=>meter()*4,barCount=()=>Math.ceil(song.duration/beat()/meter());
  const at=step=>Math.round((bar*meter()+step/4)*beat()*1000);
  const storageKey=()=>`pulse-draft-v1:${song.id}`;
  function save(){try{localStorage.setItem(storageKey(),JSON.stringify({title,notes,difficulty}));}catch{$('editorStatus').textContent='このブラウザでは下書きを保存できません。';}}
  function changed(){save();onEdit();render();}
  function checkpoint(){history.push({title,difficulty,notes:notes.map(n=>[...n])});if(history.length>40)history.shift();}
  function toggle(lane,step){
    const ms=at(step),cover=notes.findIndex(n=>n[1]===lane&&(Math.abs(n[0]-ms)<2||(n[2]>0&&n[0]<=ms&&n[0]+n[2]>ms)));
    let next=notes.map(n=>[...n]);
    if(cover>=0)next.splice(cover,1);
    else next.push($('editorLength').value==='flick'?[ms,lane,0,1]:[ms,lane,Math.round(Number($('editorLength').value)*beat()*1000)]);
    try{if(next.length)next=validateCustomNotes(song,next,difficulty);}catch(error){$('editorStatus').textContent=error.message;return;}
    checkpoint();notes=next;cursor={lane,step};$('editorStatus').textContent='';changed();focusCell();
  }
  function focusCell(){$('editorGrid').querySelector(`[data-lane="${cursor.lane}"][data-step="${cursor.step}"]`)?.focus();}
  function render(){
    const validSteps=Array.from({length:steps()},(_,step)=>step).filter(step=>at(step)>=1000&&at(step)<=song.duration*1000-170);
    if(!validSteps.includes(cursor.step))cursor.step=validSteps.reduce((best,step)=>Math.abs(step-cursor.step)<Math.abs(best-cursor.step)?step:best,validSteps[0]??0);
    $('editorDifficulty').value=difficulty;$('editorFlick').disabled=difficulty!==2;
    $('editorBarLabel').textContent=`${bar+1} / ${barCount()} 小節`;$('editorBar').max=barCount();$('editorBar').value=bar+1;
    $('editorPrev').disabled=bar===0;$('editorNext').disabled=bar>=barCount()-1;$('editorUndo').disabled=!history.length;$('editorPlay').disabled=!notes.length;$('editorCount').textContent=notes.length+' NOTES';
    const grid=$('editorGrid');grid.style.setProperty('--editor-steps',steps());grid.replaceChildren();
    const header=document.createElement('div');header.className='editor-row editor-beats';header.setAttribute('role','row');const corner=document.createElement('span');corner.textContent='KEY';header.append(corner);
    for(let step=0;step<steps();step++){const cell=document.createElement('span');cell.textContent=step%4===0?String(step/4+1):'·';header.append(cell);}grid.append(header);
    for(let lane=0;lane<8;lane++){
      const row=document.createElement('div');row.className='editor-row '+(lane<4?'left-hand':'right-hand')+(lane===4?' hand-boundary':'');row.setAttribute('role','row');
      const label=document.createElement('span');label.className='editor-key';label.setAttribute('role','rowheader');label.textContent=(lane===0?'左手 ':lane===4?'右手 ':'')+keyLabel(keys[lane]);row.append(label);
      for(let step=0;step<steps();step++){
        const ms=at(step),note=notes.find(n=>n[1]===lane&&Math.abs(n[0]-ms)<2),tail=notes.find(n=>n[1]===lane&&n[2]>0&&n[0]<ms&&n[0]+n[2]>ms);
        const button=document.createElement('button');button.className='editor-cell'+(step%4===0?' beat-start':'')+(note?' occupied':'')+(tail?' hold-body':'');button.setAttribute('role','gridcell');button.dataset.lane=lane;button.dataset.step=step;
        button.setAttribute('aria-label',`${bar+1}小節 ${step/4+1}拍目 ${keyLabel(keys[lane])} ${note?(note[3]?'フリック':note[2]?'長押し':'単押し'):tail?'長押しの途中':'空き'}`);button.setAttribute('aria-selected',String(!!(note||tail)));
        button.disabled=ms<1000||ms>song.duration*1000-170;button.tabIndex=cursor.lane===lane&&cursor.step===step?0:-1;button.textContent=note?.[3]?'↑':note?.[2]?'━':'';button.onclick=()=>toggle(lane,step);
        button.onfocus=()=>{cursor={lane,step};};button.onkeydown=event=>{let nextLane=lane,nextStep=step;
          if(event.code==='ArrowLeft')nextStep--;else if(event.code==='ArrowRight')nextStep++;else if(event.code==='ArrowUp')nextLane--;else if(event.code==='ArrowDown')nextLane++;else return;
          event.preventDefault();if(nextStep<0&&bar>0){bar--;nextStep=steps()-1;}if(nextStep>=steps()&&bar<barCount()-1){bar++;nextStep=0;}cursor={lane:Math.max(0,Math.min(7,nextLane)),step:Math.max(0,Math.min(steps()-1,nextStep))};render();focusCell();
        };row.append(button);
      }grid.append(row);
    }
  }
  $('editorPrev').onclick=()=>{bar=Math.max(0,bar-1);render();};$('editorNext').onclick=()=>{bar=Math.min(barCount()-1,bar+1);render();};$('editorBar').oninput=()=>{bar=Number($('editorBar').value)-1;render();};
  $('editorName').oninput=()=>{title=$('editorName').value;save();onEdit();};
  $('editorDifficulty').onchange=()=>{const next=Number($('editorDifficulty').value);if(next!==2&&notes.some(n=>n[3])){$('editorDifficulty').value=difficulty;$('editorStatus').textContent='フリックを削除するとEASY・NORMALへ変更できます。';return;}checkpoint();difficulty=next;if(next!==2&&$('editorLength').value==='flick')$('editorLength').value='0';$('editorStatus').textContent='';changed();};
  $('editorUndo').onclick=()=>{const previous=history.pop();if(!previous)return;title=previous.title;difficulty=previous.difficulty;notes=previous.notes;$('editorName').value=title;if(difficulty!==2&&$('editorLength').value==='flick')$('editorLength').value='0';changed();};
  $('editorClearBar').onclick=()=>{const from=at(0),until=at(steps());if(!notes.some(n=>n[0]>=from&&n[0]<until))return;checkpoint();notes=notes.filter(n=>n[0]<from||n[0]>=until);changed();};
  $('editorPlay').onclick=()=>{try{const cleaned=validateCustomNotes(song,notes,difficulty);if(!title.trim()||[...title.trim()].length>32||/[\u0000-\u001f\u007f]/.test(title))throw Error('譜面名を1〜32文字で入力してください。');save();$('creatorDialog').close();onPlay({kind:'draft',song:song.id,title:title.trim(),difficulty,notes:cleaned,fingerprint:draftKey(cleaned)});}catch(error){$('editorStatus').textContent=error.message;}};
  return {open(selected,selectedKeys,selectedDifficulty=1){
    song=selected;keys=[...selectedKeys];difficulty=selectedDifficulty;bar=0;history=[];notes=[];title=(song.title+' / MY CHART').slice(0,32);cursor={lane:0,step:Math.min(steps()-1,Math.ceil(1/beat()*4))};
    try{const saved=JSON.parse(localStorage.getItem(storageKey()));if(saved){title=typeof saved.title==='string'?saved.title:title;difficulty=[0,1,2].includes(saved.difficulty)?saved.difficulty:1;notes=saved.notes?.length?validateCustomNotes(song,saved.notes,difficulty):[];}}catch{/* A corrupt local draft does not prevent creating a new chart. */}
    if(difficulty!==2&&$('editorLength').value==='flick')$('editorLength').value='0';
    $('editorName').value=title;$('editorSong').textContent=song.title+' / '+song.artist+' · '+song.bpm+' BPM · '+meter()+'拍子';$('editorStatus').textContent='';render();$('creatorDialog').showModal();
  }};
}
