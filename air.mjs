import {AIR_LINK_GAP} from './engine.mjs?v=hold-air-3';
import {projectPoint} from './geometry.mjs';

const cache=new WeakMap();
export function airLinks(notes,maxGap=AIR_LINK_GAP){
  if(cache.get(notes)?.gap===maxGap)return cache.get(notes).links;
  const groups=[];
  for(const note of notes.filter(n=>n.flick&&!n.assist).sort((a,b)=>a.t-b.t||a.lane-b.lane)){
    if(groups.at(-1)?.[0].t===note.t)groups.at(-1).push(note);else groups.push([note]);
  }
  const links=[];
  for(let i=0;i<groups.length-1;i++){
    if(groups[i+1][0].t-groups[i][0].t>maxGap)continue;
    for(const from of groups[i]){const to=groups[i+1].reduce((a,b)=>Math.abs(a.lane-from.lane)<=Math.abs(b.lane-from.lane)?a:b);links.push({from,to});}
  }
  cache.set(notes,{gap:maxGap,links});return links;
}
export function airPoint(link,at,width,time,lookahead,top,hitY){
  const ratio=Math.max(0,Math.min(1,(at-link.from.t)/(link.to.t-link.from.t)));
  const lane=link.from.lane+(link.to.lane-link.from.lane)*ratio;
  return projectPoint((lane+.5)*width/8,width,Math.max(0,Math.min(1,1-(at-time)/lookahead)),top,hitY);
}
export function drawAirRibbons(ctx,notes,{width,time,lookahead,top,hitY,held=false}){
  ctx.save();
  for(const link of airLinks(notes)){
    const start=Math.max(time,link.from.t),end=Math.min(time+lookahead,link.to.t);
    if(end<=start)continue;
    const left=[],right=[];
    for(let i=0;i<=20;i++){
      const at=start+(end-start)*i/20,p=airPoint(link,at,width,time,lookahead,top,hitY),half=width/8*.22*p.scale;
      left.push([p.x-half,p.y]);right.push([p.x+half,p.y]);
    }
    ctx.beginPath();ctx.moveTo(...left[0]);for(const p of left.slice(1))ctx.lineTo(...p);for(const p of right.reverse())ctx.lineTo(...p);ctx.closePath();
    ctx.fillStyle=held?'#bbff53':'#a3ed49';ctx.globalAlpha=held?.48:.24;ctx.fill();ctx.globalAlpha=held?.85:.5;ctx.strokeStyle='#d6ff9c';ctx.lineWidth=1;ctx.stroke();
  }
  ctx.restore();
}
export function drawAirHead(ctx,x,y,width,scale,label,held=false){
  ctx.save();const h=Math.max(12,31*scale),w=width;
  ctx.shadowColor='#b8ff55';ctx.shadowBlur=held?15:7;ctx.fillStyle='#baff5a';ctx.strokeStyle='#efffd2';ctx.lineWidth=Math.max(1,1.5*scale);
  // A broad upward arrow: visual identity remains readable without '+SP' text.
  ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+w*.47,y-h*.1);ctx.lineTo(x+w*.2,y-h*.1);ctx.lineTo(x+w*.2,y+h*.43);ctx.lineTo(x-w*.2,y+h*.43);ctx.lineTo(x-w*.2,y-h*.1);ctx.lineTo(x-w*.47,y-h*.1);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  if(scale>.48){ctx.fillStyle='#244415';ctx.font=`800 ${Math.max(9,13*scale)}px sans-serif`;ctx.textAlign='center';ctx.fillText(label,x,y+h*.27);}
  ctx.restore();
}
