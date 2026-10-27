import test from 'node:test';
import assert from 'node:assert/strict';
import {importPianoScore,validatePianoProfile} from '../score-import.mjs';
test('MML imports pitch, exact note lengths, rests, ties, sharps and independent voices',()=>{
 const p=importPianoScore('MML@t120o4l4c&cr2d+,t120o3l2g;','test');assert.deepEqual(p.voices[0],[[0,1000,60,8],[2000,2500,63,8]]);assert.deepEqual(p.voices[1],[[0,1000,55,8]]);
 const dotted=importPianoScore('MML@t120o4l8.cd8r4;');assert.deepEqual(dotted.voices[0],[[0,375,60,8],[375,625,62,8]]);
});
test('MML scrolls concatenate per voice instead of overlapping or repeating chords',()=>{
 const p=importPianoScore(JSON.stringify(['MML@t120o4l4c;','MML@t120o4l4d;']));assert.deepEqual(p.voices[0],[[0,500,60,8],[500,1000,62,8]]);
});
test('JSON import validates data, strips external metadata and refuses executable or oversized input',()=>{
 const p=importPianoScore(JSON.stringify({title:'my score',source:'untrusted',voices:[[[0,300,70,12]]]}));assert.equal(p.title,'my score');assert.equal(p.source,undefined);
 for(const input of ['<script>alert(1)</script>','MML@t0c;','MML@o100c;','MML@l0c;','MML@;','x'.repeat(500001)])assert.throws(()=>importPianoScore(input));
 assert.throws(()=>validatePianoProfile({voices:[[[100,50,60]]]}));assert.throws(()=>validatePianoProfile({voices:[[[0,100,200]]]}));
});
