import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputMixer,bindTouchInput} from '../touch.mjs';
import {RhythmSession,isFullCombo} from '../engine.mjs';
function target(){const listeners=new Map();return {addEventListener(n,f){listeners.set(n,f);},removeEventListener(n){listeners.delete(n);},getBoundingClientRect:()=>({left:0,top:0,width:800,height:400}),setPointerCapture(){},releasePointerCapture(){},fire(n,pointerId,x=50,y=350){listeners.get(n)?.({pointerId,clientX:x,clientY:y,pointerType:'touch',button:0,preventDefault(){}});}};}
function fixture(chart){let time=1;const session=new RhythmSession(chart,5),canvas=target(),pedal=target(),win=target();const mixer=createInputMixer({down:lane=>{session.press(time,lane);if(session.spaceHeld)session.pressFlick(time,lane);},up:lane=>{session.release(time,lane);session.releaseFlick(time,lane);},pedal:on=>{if(on){session.pressSpace(time);for(const lane of session.down)session.pressFlick(time,lane);}else{session.releaseSpace(time);for(let lane=0;lane<8;lane++)session.releaseFlick(time,lane);}}});const input=bindTouchInput({canvas,pedal,mixer,window:win});return {canvas,pedal,win,mixer,input,session,time:t=>{time=t;session.advance(t);}};}
test('touch supports chords and sustained notes, with no repeated press from two fingers on one key',()=>{
 const f=fixture([{t:1,lane:0,end:2},{t:1,lane:4}]);f.canvas.fire('pointerdown',1,50);f.canvas.fire('pointerdown',2,450);f.canvas.fire('pointerdown',3,50);f.canvas.fire('pointerup',1,50);assert.equal(f.session.down.has(0),true);f.canvas.fire('pointerup',2,450);f.time(2);f.canvas.fire('pointerup',3,50);assert.equal(f.session.stats.perfect,2);assert.ok(f.session.stats.holdTicks>0);assert.ok(isFullCombo(f.session.stats,2));
});
test('the piano pedal supports FLOAT gliding across keys and release never ends an ordinary hold',()=>{
 const f=fixture([{t:1,lane:0,end:2},{t:1,lane:4,flick:true},{t:1.5,lane:5,flick:true}]);f.canvas.fire('pointerdown',1,50);f.pedal.fire('pointerdown',9);f.canvas.fire('pointerdown',2,450);f.time(1.5);f.canvas.fire('pointermove',2,550);f.canvas.fire('pointerup',2,550);f.pedal.fire('pointerup',9);assert.equal(f.session.down.has(0),true);f.time(2);f.canvas.fire('pointerup',1,50);assert.equal(f.session.stats.perfect,3);assert.equal(f.session.stats.miss,0);
});
test('holding the pedal outside FLOAT breaks combo; cancellation and leaving the surface release keys',()=>{
 const f=fixture([{t:1,lane:0},{t:3,lane:4,flick:true}]);f.canvas.fire('pointerdown',1,50);f.canvas.fire('pointerup',1,50);f.pedal.fire('pointerdown',9);assert.equal(f.session.stats.airBreaks,1);f.time(3);f.canvas.fire('pointerdown',2,450);assert.equal(f.session.stats.perfect,1);f.canvas.fire('pointercancel',2,450);f.pedal.fire('pointercancel',9);assert.equal(f.session.spaceHeld,false);assert.equal(f.session.down.size,0);
});
test('keyboard and touch ownership stay independent until the final source is released',()=>{
 const events=[],m=createInputMixer({down:n=>events.push(['down',n]),up:n=>events.push(['up',n]),pedal:n=>events.push(['pedal',n])});m.down(0,'keyboard');m.down(0,'touch');m.up(0,'touch');assert.deepEqual(events,[['down',0]]);m.up(0,'keyboard');m.pedal('keyboard',true);m.pedal('touch',true);m.pedal('touch',false);assert.deepEqual(events,[['down',0],['up',0],['pedal',true]]);m.pedal('keyboard',false);assert.deepEqual(events.at(-1),['pedal',false]);
 const f=fixture([{t:1,lane:0,end:3}]);f.canvas.fire('pointerdown',1,50);f.canvas.fire('pointermove',1,-10);assert.equal(f.session.down.size,0);f.input.reset();f.input.destroy();
});
