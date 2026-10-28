export function noteTravelSeconds(speed=1){return 2.2/Math.min(2,Math.max(.5,Number(speed)||1));}
// The first head must begin beyond the far edge, even at the slowest speed.
export function leadInSeconds(speed,untilFirstHead=0){return Math.max(3,noteTravelSeconds(speed)-(Number.isFinite(untilFirstHead)?untilFirstHead:0)+.1);}
export function leadInClock(contentTime,deadline,now){return contentTime-Math.max(0,(deadline-now)/1000);}
