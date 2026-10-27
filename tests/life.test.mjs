import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextLife,MAX_LIFE} from '../life.mjs';
test('HP tracks judgements, clamps, recovers from zero and ignores hold ticks',()=>{
 assert.equal(nextLife(MAX_LIFE,{kind:'judge',result:'perfect'}),1000);
 assert.equal(nextLife(1000,{kind:'judge',result:'miss'}),920);
 assert.equal(nextLife(20,{kind:'judge',result:'bad'}),0);
 assert.equal(nextLife(0,{kind:'judge',result:'perfect'}),3);
 assert.equal(nextLife(500,{kind:'holdtick'}),500);
 assert.equal(nextLife(500,{kind:'assist'}),500);
 assert.equal(nextLife(500,{kind:'airbreak'}),460);
});
