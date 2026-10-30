// The public YouTube API has no ad event. Treat a stopped content clock as
// waiting instead, and require fresh forward progress before resuming play.
// A key event may arrive between animation frames. Sample its content time
// without accepting a seek, a rewind, or a paused/buffering clock.
export function expectedVideo({url,duration},song){
  // Metadata can contradict the selected MV, but cannot prove that an ad ended.
  if(Number.isFinite(duration)&&(duration<=0||Math.abs(duration-song.duration)>Math.max(15,song.duration*.2)))return false;
  if(typeof url==='string'){
    try{const parsed=new URL(url),id=parsed.searchParams.get('v')||(parsed.hostname==='youtu.be'?parsed.pathname.slice(1):null);if(id!==song.video)return false;}catch{return false;}
  }
  return true;
}
export function countdownFrame(origin,raw,previous,elapsedMs,nextNoteAt=Infinity){
  // IFrame timestamps arrive asynchronously, sometimes more than 250ms apart.
  // Allow a late report only before the next unplayed note, never a large seek.
  const advance=Math.min(.75,Math.max(.04,Math.max(0,elapsedMs)/1000+.04));
  return Number.isFinite(raw)&&raw>=origin-.02&&raw<=Math.min(origin+advance,nextNoteAt)&&raw>(previous??origin)+.0001;
}
export function inputClock(frameTime,raw,state,frameAgeMs=0){
 const advance=Math.max(.12,Math.min(.75,Math.max(0,frameAgeMs)/1000+.04));
 return state===1&&Number.isFinite(raw)&&raw>=frameTime-.02&&raw<=frameTime+advance?Math.max(frameTime,raw):frameTime;
}
// Bounded prebuffer hint at the start of a verified MV. Missing optional
// API data must never strand the loading screen.
export function startupBufferReady(fraction,duration,elapsedMs){
  if(!Number.isFinite(fraction)||fraction<=0||fraction>1||!Number.isFinite(duration)||duration<=0)return true;
  return fraction*duration>=Math.min(3.5,duration)||elapsedMs>=4500;
}
export class PlaybackGate {
  constructor(){this.reset(0);}
  reset(now,time=0){this.time=time;this.lastRaw=time;this.lastSample=now;this.lastMoving=now;this.progress=0;this.waiting=true;this.nonPlayingSince=null;}
  hold(now){this.waiting=true;this.progress=0;this.lastRaw=null;this.lastSample=now;this.lastMoving=now;this.nonPlayingSince=null;}
  resume(now,time){this.reset(now,time);this.waiting=false;this.progress=.35;}
  observe(raw,state,now){
    if(!Number.isFinite(raw)||raw<0){this.hold(now);return this.snapshot();}
    const delta=this.lastRaw===null?0:raw-this.lastRaw;
    const elapsed=Math.max(0,(now-this.lastSample)/1000);
    this.lastRaw=raw;this.lastSample=now;
    if(state!==1){
      // seek/pause/play can deliver brief PAUSED/BUFFERING states after resume.
      // Freeze the clock immediately, but do not restart the count-in for that transient.
      if(!this.waiting&&(state===2||state===3)){
        this.nonPlayingSince??=now;
        if(now-this.nonPlayingSince<400)return this.snapshot();
      }
      this.waiting=true;this.progress=0;this.lastMoving=now;return this.snapshot();
    }
    this.nonPlayingSince=null;
    if(raw<this.time-.15){this.waiting=true;this.progress=0;this.lastMoving=now;return this.snapshot();}
    const seek=!this.waiting&&delta>Math.max(1.3,elapsed+1);
    if(seek){this.hold(now);return this.snapshot(true);}
    if(delta>0.0001){
      this.lastMoving=now;this.progress+=Math.min(delta,elapsed+.1);
      if(this.progress>=.35)this.waiting=false;
    }else if(now-this.lastMoving>=1200){this.waiting=true;this.progress=0;}
    if(!this.waiting)this.time=Math.max(this.time,raw);
    return this.snapshot(seek);
  }
  snapshot(seek=false){return {time:this.time,waiting:this.waiting,seek};}
}
