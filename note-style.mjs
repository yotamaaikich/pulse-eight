import {projectPoint} from './geometry.mjs';
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
export function drawPerfectHit(ctx,{lane,width,hitY,age,heightScale=1,float=false,top=40}){
  if(age<0||age>320)return;
  const t=age/320,fade=(1-t)**2,laneW=width/8,x=(lane+.5)*laneW,y=hitY-2;
  const color=float?NOTE_COLORS.float:lane<4?NOTE_COLORS.left:NOTE_COLORS.right;
  const rise=Math.min(150,Math.max(70,(hitY-top)*.25)),depth=Math.sqrt(Math.max(0,1-rise/Math.max(1,hitY-top)));
  const tip=projectPoint((lane+.5)*laneW,width,depth,top,hitY),half=laneW*.34,farHalf=half*tip.scale*.6;
  ctx.save();ctx.globalAlpha=fade;ctx.globalCompositeOperation='lighter';
  // The column follows the same perspective as the struck lane.
  const beam=ctx.createLinearGradient(0,y-rise,0,y);beam.addColorStop(0,color+'00');beam.addColorStop(.55,color+'18');beam.addColorStop(.9,color+'70');beam.addColorStop(1,'#ffffffc9');
  ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(tip.x-farHalf,tip.y);ctx.lineTo(tip.x+farHalf,tip.y);ctx.lineTo(x+half,y);ctx.lineTo(x-half,y);ctx.closePath();ctx.fill();
  // An elliptical bloom is local to the hit; no screen-wide white flash.
  ctx.save();ctx.translate(x,y);ctx.scale(1,.38);const r=laneW*.64;
  const bloom=ctx.createRadialGradient(0,0,0,0,0,r);bloom.addColorStop(0,'#ffffffdb');bloom.addColorStop(.22,'#f7ffff8c');bloom.addColorStop(.5,color+'70');bloom.addColorStop(1,color+'00');
  ctx.fillStyle=bloom;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
  const ringW=laneW*(.32+t*.27),ringH=(3+t*12)*heightScale;
  ctx.strokeStyle='#f4ffff';ctx.lineWidth=Math.max(1,2.3*heightScale)*(1-t);ctx.shadowColor=color;ctx.shadowBlur=28*heightScale;
  ctx.beginPath();ctx.ellipse(x,y,ringW,ringH,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=fade*Math.max(0,1-age/150);ctx.fillStyle='#ffffff';ctx.shadowBlur=36*heightScale;
  const h=Math.max(3,8*heightScale);ctx.beginPath();ctx.roundRect(x-laneW*.38,y-h/2,laneW*.76,h,Math.min(2,h/2));ctx.fill();ctx.restore();
}
function feedbackLayout(width,hitY){
  const comboSize=Math.min(42,Math.max(24,width*.05));
  return {x:width/2,comboSize,comboY:hitY-34,labelY:hitY-16,judgmentY:hitY-48-comboSize};
}
export function drawCombo(ctx,combo,width,hitY,pulseAge=Infinity){
  if(combo<2)return;
  const layout=feedbackLayout(width,hitY),pulse=pulseAge>=0&&pulseAge<650?(1-pulseAge/650)**2:0;
  ctx.save();const x=layout.x,y=layout.comboY,size=layout.comboSize*(1+pulse*.1);
  const ink=ctx.createLinearGradient(0,y-size,0,y+8);ink.addColorStop(0,'#ff82d5');ink.addColorStop(.5,'#fff');ink.addColorStop(1,'#67ddff');
  ctx.textAlign='center';ctx.lineJoin='round';ctx.shadowColor=pulse?'#c4faff':'#7b3bcd';ctx.shadowBlur=8+pulse*20;
  ctx.font='700 '+Math.max(9,layout.comboSize*.26)+'px sans-serif';ctx.fillStyle='#e5eaf2';ctx.strokeStyle='#131c2c';ctx.lineWidth=3;ctx.strokeText('COMBO',x,layout.labelY);ctx.fillText('COMBO',x,layout.labelY);
  ctx.font='800 '+size+'px sans-serif';ctx.strokeStyle='#131c2c';ctx.lineWidth=3;ctx.strokeText(String(combo),x,y);ctx.fillStyle=pulse?'#f6ffff':ink;ctx.fillText(String(combo),x,y);ctx.restore();
}
export function drawJudgment(ctx,{result,delta,width,hitY,age}){
  if(!result||age<0||age>650)return;
  ctx.save();ctx.globalAlpha=Math.min(1,(650-age)/160);ctx.textAlign='center';ctx.lineJoin='round';
  const {x,judgmentY:y}=feedbackLayout(width,hitY),size=Math.min(34,Math.max(22,width*.047));
  const ink=ctx.createLinearGradient(0,y-size,0,y);ink.addColorStop(0,'#ff9fdf');ink.addColorStop(.5,'#fff');ink.addColorStop(1,'#7ae1ff');
  ctx.fillStyle=result==='miss'?'#ff537b':ink;ctx.strokeStyle='#171c46';ctx.lineWidth=4;ctx.font='800 '+size+'px sans-serif';
  const label=result==='airbreak'?'RELEASE SPACE':result==='flick'?'FLOAT':result.toUpperCase();ctx.strokeText(label,x,y);ctx.fillText(label,x,y);
  const feedback=!['perfect','miss','airbreak','flick','hold'].includes(result)&&timingFeedback(delta/1000);
  if(feedback){const rowY=y-Math.max(27,size*.95);ctx.font='800 13px sans-serif';ctx.fillStyle=feedback.color;ctx.textAlign='right';ctx.strokeText(feedback.label,x-5,rowY);ctx.fillText(feedback.label,x-5,rowY);ctx.textAlign='left';ctx.font='12px sans-serif';ctx.strokeText(feedback.ms+' ms',x+5,rowY);ctx.fillText(feedback.ms+' ms',x+5,rowY);}
  ctx.restore();
}
