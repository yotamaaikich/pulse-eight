import test from 'node:test';
import assert from 'node:assert/strict';
import {startupBufferReady} from '../playback.mjs';
test('initial playback waits for a small video buffer but stale buffer metadata cannot wait forever',()=>{
  assert.equal(startupBufferReady(.005,181,0),false);
  assert.equal(startupBufferReady(.03,181,0),true);
  assert.equal(startupBufferReady(.005,181,4499),false);
  assert.equal(startupBufferReady(.005,181,4500),true);
  for(const value of [undefined,NaN,0,-1,2])assert.equal(startupBufferReady(value,181,0),true);
  assert.equal(startupBufferReady(.01,0,0),true);
});
