import test from 'node:test';
import assert from 'node:assert/strict';
import {SONGS,makeChart,RhythmSession} from '../engine.mjs';
import {MELODIES,voiceChart,noteForKey,pitchForKey} from '../melodies.mjs';

test('every stock song has varied, bounded note pitches without changing judgment or chart data',()=>{
  assert.equal(Object.keys(MELODIES).length,SONGS.length);
  for(const song of SONGS){
    const chart=makeChart(song,2),original=JSON.stringify(chart),voiced=voiceChart(song,chart),pitches=voiced.filter(n=>!n.assist).map(n=>n.midi);
    assert.ok(new Set(pitches).size>=5,song.id);
    assert.ok(pitches.every(n=>Number.isInteger(n)&&n>=48&&n<=84));
    assert.equal(JSON.stringify(chart),original);
    assert.deepEqual(voiced.map(({midi,...n})=>n),chart);
    const lanes=new Map();for(const n of voiced.filter(n=>!n.assist)){if(!lanes.has(n.lane))lanes.set(n.lane,new Set());lanes.get(n.lane).add(n.midi);}
    assert.ok([...lanes.values()].some(notes=>notes.size>1),'same key can change pitch: '+song.id);
  }
});
test('note targeting and empty key previews never advance the timed melody',()=>{
  const notes=[{t:1,lane:0,midi:61},{t:2,lane:0,midi:68},{t:1,lane:1,midi:49}];
  assert.equal(noteForKey(notes,0,1).midi,61);assert.equal(noteForKey(notes,0,2).midi,68);assert.equal(noteForKey(notes,1,1).midi,49);
  assert.equal(noteForKey(notes,0,1.5),null);assert.equal(pitchForKey(notes,0,1.8),68);assert.equal(pitchForKey(notes,0,1.8),68);assert.equal(notes[1].done,undefined);notes[0].done=true;assert.equal(noteForKey(notes,0,1),null);
  const session=new RhythmSession([{t:1,lane:0,midi:61,end:2}],3);session.press(1,0);assert.equal(noteForKey(session.notes,0,1),null);
});
