import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPoint} from '../geometry.mjs';
test('all note centers stay on their straight perspective lane centerlines',()=>{
  for(const width of [360,600,1000])for(let lane=0;lane<8;lane++)for(let i=0;i<=100;i++){
    const base=(lane+.5)*width/8,top=40,hit=500;
    const a=projectPoint(base,width,0,top,hit),b=projectPoint(base,width,1,top,hit),p=projectPoint(base,width,i/100,top,hit);
    const cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);
    assert.ok(Math.abs(cross)<1e-7,`${width}/${lane}/${i}: note left its lane`);
    const left=projectPoint(lane*width/8,width,i/100,top,hit).x;
    const right=projectPoint((lane+1)*width/8,width,i/100,top,hit).x;
    assert.ok(p.x>left&&p.x<right);
    assert.ok(width/8*.83*p.scale<right-left);
  }
});
test('heads arrive exactly at keyboard centers and hold edges stay inside their lane',()=>{
  const width=800;for(let lane=0;lane<8;lane++){
    const base=(lane+.5)*100,p=projectPoint(base,width,1,40,500);assert.equal(p.x,base);assert.equal(p.y,500);
    for(const depth of [.1,.4,.8,1]){const p=projectPoint(base,width,depth,40,500),left=projectPoint(lane*100,width,depth,40,500),right=projectPoint((lane+1)*100,width,depth,40,500);assert.ok(p.x-21*p.scale>left.x);assert.ok(p.x+21*p.scale<right.x);}
  }
});
