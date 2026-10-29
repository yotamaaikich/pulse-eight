// Keyboard, pen and touch all share one held-key state and the same judgment.
export function createInputMixer({down,up,pedal}){
  const lanes=Array.from({length:8},()=>new Set()),pedals=new Set();
  return {
    down(lane,source){if(!Number.isInteger(lane)||lane<0||lane>7)return;const held=lanes[lane];if(held.has(source))return;const first=!held.size;held.add(source);if(first)down(lane);},
    up(lane,source){const held=lanes[lane];if(!held?.delete(source))return;if(!held.size)up(lane);},
    pedal(source,on){const before=pedals.size;if(on)pedals.add(source);else pedals.delete(source);if(!!before!==!!pedals.size)pedal(!!pedals.size);},
    reset(silent=false){for(let lane=0;lane<8;lane++){const active=lanes[lane].size;lanes[lane].clear();if(active&&!silent)up(lane);}const active=pedals.size;pedals.clear();if(active&&!silent)pedal(false);}
  };
}
export function bindTouchInput({canvas,pedal,mixer,enabled=()=>true,beforeBlur=()=>{},window:win=globalThis.window}){
  const fingers=new Map(),pedalFingers=new Set(),counts=Array(8).fill(0),listeners=[];
  const listen=(target,type,fn)=>{target.addEventListener(type,fn,{passive:false});listeners.push([target,type,fn]);};
  const laneAt=e=>{const r=canvas.getBoundingClientRect();return r.width>0&&e.clientX>=r.left&&e.clientX<r.left+r.width&&e.clientY>=r.top&&e.clientY<=r.top+r.height?Math.min(7,Math.floor((e.clientX-r.left)/r.width*8)):null;};
  function move(id,lane){const previous=fingers.get(id);if(previous===lane)return;if(previous!==null&&previous!==undefined&&--counts[previous]===0)mixer.up(previous,'touch');fingers.set(id,lane);if(lane!==null&&counts[lane]++===0)mixer.down(lane,'touch');}
  function end(e){if(!fingers.has(e.pointerId))return;e.preventDefault();move(e.pointerId,null);fingers.delete(e.pointerId);try{canvas.releasePointerCapture(e.pointerId);}catch{}}
  listen(canvas,'pointerdown',e=>{if(!enabled()||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();fingers.set(e.pointerId,null);try{canvas.setPointerCapture(e.pointerId);}catch{}move(e.pointerId,laneAt(e));});
  listen(canvas,'pointermove',e=>{if(!fingers.has(e.pointerId))return;e.preventDefault();move(e.pointerId,laneAt(e));});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,end);
  listen(canvas,'contextmenu',e=>e.preventDefault());
  if(pedal){
    listen(pedal,'pointerdown',e=>{if(!enabled()||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();pedalFingers.add(e.pointerId);try{pedal.setPointerCapture(e.pointerId);}catch{}mixer.pedal('touch',true);});
    const release=e=>{if(!pedalFingers.delete(e.pointerId))return;e.preventDefault();if(!pedalFingers.size)mixer.pedal('touch',false);try{pedal.releasePointerCapture(e.pointerId);}catch{}};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(pedal,type,release);
    // A focused HTML button must not generate a second click on Space/Enter.
    listen(pedal,'click',e=>e.preventDefault());
  }
  function reset(){const ids=[...fingers.keys()],pedalIds=[...pedalFingers];for(const id of ids)move(id,null);fingers.clear();pedalFingers.clear();counts.fill(0);mixer.pedal('touch',false);for(const id of ids)try{canvas.releasePointerCapture(id);}catch{}for(const id of pedalIds)try{pedal?.releasePointerCapture(id);}catch{}}
  if(win)listen(win,'blur',()=>{beforeBlur();reset();});
  return {reset,destroy(){reset();for(const [target,type,fn]of listeners)target.removeEventListener(type,fn);}};
}
