// Eight playable white keys, C–C, with the physical 2 + 3 black-key grouping.
const BLACK_BOUNDARIES=[1,2,4,5,6];
export const keyboardStrikeY=(width,height)=>height-Math.min(height*.15,Math.max(64,width*.09));

export function drawKeyboard(ctx,{width,height,time,pressed,flashes,blackFlashes}){
  const top=keyboardStrikeY(width,height)+3,lane=width/8;
  const rear=top+9,front=height-18,blackEnd=rear+(front-rear)*.61;
  const gradient=(x1,y1,x2,y2,stops)=>{
    const g=ctx.createLinearGradient(x1,y1,x2,y2);for(const [at,color]of stops)g.addColorStop(at,color);return g;
  };
  const rect=(x,y,w,h,r=0)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
  ctx.save();
  // Polished fallboard, a narrow brass edge and the red felt behind the keys.
  ctx.fillStyle=gradient(0,top,0,height,[[0,'#32312e'],[.12,'#090b0e'],[1,'#15171b']]);ctx.fillRect(0,top,width,height-top);
  ctx.fillStyle='#78705b';ctx.fillRect(0,top+2,width,1);
  ctx.fillStyle='#601b29';ctx.fillRect(0,top+5,width,5);
  ctx.fillStyle='#b45464';ctx.fillRect(0,top+5,width,1);
  for(let i=0;i<8;i++){
    const down=pressed.has(i)||time-flashes[i]<100,drop=down?4:0;
    const x=i*lane+1.1,w=lane-2.2,bottom=front+drop;
    const leftNotch=BLACK_BOUNDARIES.includes(i)?lane*.265:0;
    const rightNotch=BLACK_BOUNDARIES.includes(i+1)?lane*.265:0;
    ctx.save();
    // The key's vertical ivory front remains visible underneath the playing surface.
    ctx.fillStyle=gradient(0,bottom,0,height-6,[[0,'#c5c1b6'],[.2,'#eeece5'],[1,'#89867e']]);
    rect(x,bottom-3,w,Math.max(3,height-6-bottom+3),[0,0,2,2]);ctx.fill();
    // Real white-key shoulders fit around the raised ebony keys.
    ctx.beginPath();ctx.moveTo(x+leftNotch,rear);ctx.lineTo(x+w-rightNotch,rear);
    ctx.lineTo(x+w-rightNotch,blackEnd+5);ctx.lineTo(x+w,blackEnd+5);
    ctx.lineTo(x+w,bottom-2);ctx.quadraticCurveTo(x+w,bottom,x+w-2,bottom);
    ctx.lineTo(x+2,bottom);ctx.quadraticCurveTo(x,bottom,x,bottom-2);
    ctx.lineTo(x,blackEnd+5);ctx.lineTo(x+leftNotch,blackEnd+5);ctx.closePath();
    ctx.fillStyle=gradient(0,rear,0,bottom,[[0,'#b9b6ac'],[.1,'#e5e2d8'],[.32,'#fbfaf4'],[.85,'#fffef9'],[1,down?'#d4d0c6':'#efede5']]);
    ctx.fill();ctx.save();ctx.clip();
    // Thin side highlights and soft shadows make each key a separate solid piece.
    ctx.fillStyle=gradient(x,0,x+w,0,[[0,'#72716a55'],[.025,'#ffffffbb'],[.08,'#ffffff00'],[.9,'#ffffff00'],[1,'#5c5a504d']]);ctx.fillRect(x,rear,w,bottom-rear);
    if(down){
      ctx.fillStyle=gradient(0,blackEnd,0,bottom,[[0,'#ffffff00'],[.8,i<4?'#ff365e18':'#318cff18'],[1,i<4?'#ff365e55':'#318cff55']]);ctx.fillRect(x,blackEnd,w,bottom-blackEnd);
    }
    ctx.restore();ctx.strokeStyle='#8a877e';ctx.lineWidth=.7;ctx.stroke();
    ctx.strokeStyle=down?'#d0cdc4':'#ffffff';ctx.beginPath();ctx.moveTo(x+3,bottom-1);ctx.lineTo(x+w-3,bottom-1);ctx.stroke();
    ctx.restore();
  }
  BLACK_BOUNDARIES.forEach((boundary,index)=>{
    const center=boundary*lane,w=lane*.53,x=center-w/2;
    const down=time-blackFlashes[index]<130,drop=down?3:0;
    const y=rear-1+drop,end=blackEnd+drop,bevel=Math.max(3,w*.095);
    ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=5;ctx.shadowOffsetX=3;ctx.shadowOffsetY=5;
    ctx.fillStyle='#090a0c';rect(x,y,w,end-y+8,[1,1,3,3]);ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
    // The black top is narrower than its base, with bevels along both sides.
    ctx.fillStyle=gradient(x,0,x+w,0,[[0,'#55575b'],[.13,'#22242a'],[.83,'#0a0b0e'],[1,'#393b40']]);
    rect(x,y,w,end-y,2);ctx.fill();
    ctx.fillStyle=gradient(0,y,0,end,[[0,'#17191e'],[.17,'#373940'],[.24,'#27292f'],[.8,'#0c0d11'],[1,'#1c1e23']]);
    rect(x+bevel,y+1,w-2*bevel,end-y-4,[1,1,2,2]);ctx.fill();
    ctx.strokeStyle='#666971';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x+bevel,y+2);ctx.lineTo(x+bevel,end-6);ctx.stroke();
    ctx.fillStyle=gradient(0,end-3,0,end+7,[[0,'#686a6e'],[.15,'#33353b'],[1,'#0b0c10']]);
    rect(x+1,end-3,w-2,10,[0,0,2,2]);ctx.fill();
    if(down){ctx.fillStyle='#d7e2e9';ctx.fillRect(x+bevel,end-3,w-2*bevel,1);}
    ctx.restore();
  });
  // A slim black key slip under the ivory fronts finishes the instrument casing.
  ctx.fillStyle=gradient(0,height-6,0,height,[[0,'#48474a'],[.25,'#17181c'],[1,'#06070a']]);ctx.fillRect(0,height-6,width,6);
  ctx.restore();
}
