import test from 'node:test';
import assert from 'node:assert/strict';
import {airLinks,airPoint} from '../air.mjs';
import {projectPoint} from '../geometry.mjs';

test('AIR ribbons connect successive lane targets without linking distant phrases or taps',()=>{
  const notes=[{t:1,lane:3,flick:true},{t:1.3,lane:0},{t:1.7,lane:4,flick:true},{t:2.4,lane:5,flick:true},{t:12,lane:2,flick:true}];
  const links=airLinks(notes);assert.equal(links.length,2);assert.equal(links[0].from,notes[0]);assert.equal(links[0].to,notes[2]);
  notes[0].done=true;assert.equal(airLinks(notes).length,2,'the outgoing ribbon stays visible after its head is hit');
  for(const link of links)for(const note of [link.from,link.to]){
    const actual=airPoint(link,note.t,800,0,4,40,500),expected=projectPoint((note.lane+.5)*100,800,1-note.t/4,40,500);
    assert.deepEqual(actual,expected,'ribbon meets the center of its lane target');
  }
});
test('AIR paths stay finite and inside the highway during screen clipping',()=>{
  const link={from:{t:1,lane:0},to:{t:3,lane:7}};
  for(const width of [320,800,1500])for(const at of [1,1.5,2,2.5,3]){
    const p=airPoint(link,at,width,1.2,2,30,450);assert.ok(p.x>=0&&p.x<=width);assert.ok(p.y>=30&&p.y<=450);
  }
});
