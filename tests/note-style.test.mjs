import test from 'node:test';
import assert from 'node:assert/strict';
import {timingFeedback,drawJudgment,drawCombo} from '../note-style.mjs';

test('FAST and LATE follow the signed input error, with no direction for an exact hit',()=>{
  assert.deepEqual(timingFeedback(-.024),{label:'FAST',color:'#68ccff',ms:24});
  assert.deepEqual(timingFeedback(.09),{label:'LATE',color:'#ff779f',ms:90});
  assert.equal(timingFeedback(0),null);assert.equal(timingFeedback(NaN),null);
});
test('judgments show timing only for judged hits, and expire without leaving stale text',()=>{
  const words=[];
  const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),fillText:(...args)=>words.push(args)},{get:(o,k)=>o[k]??(()=>{})});
  const input={result:'great',delta:-30,width:780,hitY:435,age:100};
  drawJudgment(ctx,input);assert.deepEqual(words.map(x=>x[0]),['GREAT','FAST','30 ms']);
  words.length=0;drawJudgment(ctx,{...input,result:'miss'});assert.deepEqual(words.map(x=>x[0]),['MISS']);
  words.length=0;drawJudgment(ctx,{...input,age:700});assert.equal(words.length,0);
  drawCombo(ctx,50,780,435);assert.deepEqual(words.map(x=>x[0]),['COMBO','50']);assert.ok(words.every(x=>x[1]===780/2&&x[2]>435-75));
});
