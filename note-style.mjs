export const NOTE_COLORS={left:'#ff365e',right:'#318cff',float:'#baff5a'};
export function timingFeedback(delta){
  if(!Number.isFinite(delta)||Math.abs(delta)<.0005)return null;
  return {label:delta<0?'FAST':'LATE',color:delta<0?'#68ccff':'#ff779f',ms:Math.abs(Math.round(delta*1000))};
}
export function drawNoteHead(ctx,{x,y,width,height,lane,time=0,heightScale=1}){
  const color=lane<4?NOTE_COLORS.left:NOTE_COLORS.right;
  ctx.save();
  ctx.shadowColor=color;ctx.shadowBlur=15*heightScale;
  const fill=ctx.createLinearGradient(0,y-height/2,0,y+height/2);
  fill.addColorStop(0,'#ffffff');fill.addColorStop(.16,lane<4?'#ff9bb0':'#9edbff');
  fill.addColorStop(.36,'#f5fcff');fill.addColorStop(.58,color);fill.addColorStop(1,lane<4?'#a7083d':'#123dab');
  ctx.fillStyle=fill;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(x-width/2,y-height/2,width,height,2);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.fillStyle='#ffffffb3';ctx.fillRect(x-width*.45,y-height*.33,width*.9,Math.max(1,height*.12));ctx.strokeStyle=color;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x-width*.43,y+height*.28);ctx.lineTo(x+width*.43,y+height*.28);ctx.stroke();
  // A small four-point glint stays inside each note's silhouette.
  const sx=x+width*.29,sy=y-height*.18,r=Math.min(height*.32,5*heightScale)*( .8+.2*Math.sin(time/260+lane));
  ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(sx,sy-r);ctx.lineTo(sx+r*.3,sy-r*.3);ctx.lineTo(sx+r,sy);ctx.lineTo(sx+r*.3,sy+r*.3);ctx.lineTo(sx,sy+r);ctx.lineTo(sx-r*.3,sy+r*.3);ctx.lineTo(sx-r,sy);ctx.lineTo(sx-r*.3,sy-r*.3);ctx.closePath();ctx.fill();ctx.restore();
}
export function drawCombo(ctx,combo,width,hitY){
  if(combo<2)return;
  ctx.save();const x=width*.84,y=Math.max(125,hitY*.42),size=Math.min(76,Math.max(38,width*.105));
  const ink=ctx.createLinearGradient(0,y-size,0,y+8);ink.addColorStop(0,'#ff82d5');ink.addColorStop(.5,'#fff');ink.addColorStop(1,'#67ddff');
  ctx.textAlign='center';ctx.lineJoin='round';ctx.shadowColor='#7b3bcd';ctx.shadowBlur=12;
  ctx.font='800 '+Math.max(11,size*.24)+'px sans-serif';ctx.fillStyle='#ffd9f3';ctx.fillText('COMBO',x,y-size*.95);
  ctx.font='800 '+size+'px sans-serif';ctx.strokeStyle='#191e52';ctx.lineWidth=4;ctx.strokeText(String(combo),x,y);ctx.fillStyle=ink;ctx.fillText(String(combo),x,y);ctx.restore();
}
export function drawJudgment(ctx,{result,delta,width,hitY,age}){
  if(!result||age<0||age>650)return;
  ctx.save();ctx.globalAlpha=Math.min(1,(650-age)/160);ctx.textAlign='center';ctx.lineJoin='round';
  const x=width/2,y=hitY-76,size=Math.min(34,Math.max(22,width*.047));
  const ink=ctx.createLinearGradient(0,y-size,0,y);ink.addColorStop(0,'#ff9fdf');ink.addColorStop(.5,'#fff');ink.addColorStop(1,'#7ae1ff');
  ctx.fillStyle=result==='miss'?'#ff537b':ink;ctx.strokeStyle='#171c46';ctx.lineWidth=4;ctx.font='800 '+size+'px sans-serif';
  const label=result==='airbreak'?'RELEASE SPACE':result==='flick'?'FLOAT':result.toUpperCase();ctx.strokeText(label,x,y);ctx.fillText(label,x,y);
  const feedback=!['perfect','miss','airbreak','flick','hold'].includes(result)&&timingFeedback(delta/1000);
  if(feedback){ctx.font='800 19px sans-serif';ctx.fillStyle=feedback.color;ctx.strokeText(feedback.label,x,y+27);ctx.fillText(feedback.label,x,y+27);ctx.font='12px sans-serif';ctx.fillText(feedback.ms+' ms',x,y+44);}
  ctx.restore();
}
