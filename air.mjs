import {AIR_LINK_GAP} from './engine.mjs?v=desktop-30';
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
    const left=[],right=[],center=[];
    for(let i=0;i<=20;i++){
      const at=start+(end-start)*i/20,p=airPoint(link,at,width,time,lookahead,top,hitY),half=width/8*.16*p.scale;
      left.push([p.x-half,p.y]);right.push([p.x+half,p.y]);center.push([p.x,p.y]);
    }
    const glass=ctx.createLinearGradient(0,left.at(-1)[1],0,left[0][1]);
    glass.addColorStop(0,held?'#91fdbb24':'#91fdbb0a');glass.addColorStop(1,held?'#b9ffad66':'#b9ffad27');
    ctx.globalAlpha=1;ctx.beginPath();ctx.moveTo(...left[0]);for(const p of left.slice(1))ctx.lineTo(...p);for(const p of [...right].reverse())ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=glass;ctx.fill();
    // A translucent center and two light rails leave the notes below readable.
    for(const rail of [left,right,center]){
      ctx.beginPath();ctx.moveTo(...rail[0]);for(const p of rail.slice(1))ctx.lineTo(...p);
      ctx.strokeStyle=rail===center?(held?'#f1ffe6b3':'#d5ffbc45'):(held?'#d9ffbdc4':'#aaffb86b');
      ctx.lineWidth=rail===center?(held?1.5:.8):(held?1.7:1);ctx.shadowColor='#8dffc1';ctx.shadowBlur=held?6:0;ctx.stroke();
    }
  }
  ctx.restore();
}
export function drawAirHead(ctx,x,y,width,scale,held=false,heightScale=1){
  ctx.save();ctx.globalAlpha=1;const h=Math.max(3.5,Math.max(5,18*scale)*heightScale),w=width,c=Math.min(6*scale,w*.1,h*.3);
  const face=ctx.createLinearGradient(0,y-h/2,0,y+h/2);
  face.addColorStop(0,'#fbffed');face.addColorStop(.18,'#e9ffb9');face.addColorStop(.4,held?'#e3ffd2':'#baff73');face.addColorStop(.6,'#57dba6');face.addColorStop(1,'#175950');
  ctx.shadowColor='#94ff9b';ctx.shadowBlur=(held?19:12)*heightScale;ctx.fillStyle=face;ctx.strokeStyle='#eaffd9';ctx.lineWidth=Math.max(.8,1.4*scale*heightScale);
  ctx.beginPath();ctx.moveTo(x-w/2+c,y-h/2);ctx.lineTo(x+w/2-c,y-h/2);ctx.lineTo(x+w/2,y-h/2+c);ctx.lineTo(x+w/2,y+h/2-c);ctx.lineTo(x+w/2-c,y+h/2);ctx.lineTo(x-w/2+c,y+h/2);ctx.lineTo(x-w/2,y+h/2-c);ctx.lineTo(x-w/2,y-h/2+c);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.fillStyle='#ffffffbb';ctx.fillRect(x-w*.43,y-h*.32,w*.86,Math.max(.7,h*.12));
  ctx.strokeStyle='#74ffd5';ctx.lineWidth=Math.max(.8,1.6*scale*heightScale);ctx.beginPath();ctx.moveTo(x-w*.4,y+h*.31);ctx.lineTo(x+w*.4,y+h*.31);ctx.stroke();
  // Detached double chevrons read as an upward action, while the luminous
  // beveled head keeps the same center and lane width as the normal notes.
  const a=Math.max(4,w*.22);ctx.lineJoin='round';ctx.lineCap='round';
  for(const lift of [1.8,.98]){
    const tip=y-h*lift;ctx.beginPath();ctx.moveTo(x-a,tip+h*.5);ctx.lineTo(x,tip);ctx.lineTo(x+a,tip+h*.5);
    ctx.strokeStyle=held?'#9effad':'#8be99a';ctx.lineWidth=Math.max(2,5*scale*heightScale);ctx.shadowColor='#9bffa4';ctx.shadowBlur=(held?12:7)*heightScale;ctx.stroke();
    ctx.strokeStyle='#f6ffe2';ctx.lineWidth=Math.max(.8,1.6*scale*heightScale);ctx.shadowBlur=0;ctx.stroke();
  }
  const sx=x+w*.32,sy=y-h*.02,r=Math.min(3.6,h*.22);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(sx,sy-r);ctx.lineTo(sx+r*.28,sy-r*.25);ctx.lineTo(sx+r,sy);ctx.lineTo(sx+r*.28,sy+r*.25);ctx.lineTo(sx,sy+r);ctx.lineTo(sx-r*.28,sy+r*.25);ctx.lineTo(sx-r,sy);ctx.lineTo(sx-r*.28,sy-r*.25);ctx.closePath();ctx.fill();
  ctx.restore();
}
