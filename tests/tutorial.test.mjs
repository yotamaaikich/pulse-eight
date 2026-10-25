import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS,TutorialAttempt,lessonsFor} from '../tutorial.mjs';

test('tutorial teaches tap, sustained hold, chord and both flick hands with real judgment',()=>{
  for(const lesson of LESSONS){
    const attempt=new TutorialAttempt(lesson);
    for(const lane of lesson.lanes)attempt.update(2.4,'press',lane);
    if(lesson.hold){assert.equal(attempt.status,'running');attempt.update(3.6);}
    if(lesson.flick){assert.equal(attempt.status,'running');attempt.update(2.5,'pressFlick',lesson.lanes[0]);}
    assert.equal(attempt.status,'success',lesson.title);
  }
});
test('tutorial rejects early hold release, incomplete chords, reversed and late flicks',()=>{
  let attempt=new TutorialAttempt(LESSONS[1]);attempt.update(2.4,'press',2);attempt.update(2.6,'release',2);assert.equal(attempt.status,'retry');
  attempt=new TutorialAttempt(LESSONS[2]);attempt.update(2.4,'press',3);attempt.update(2.58);assert.equal(attempt.status,'retry');
  for(const lesson of LESSONS.slice(3)){
    attempt=new TutorialAttempt(lesson);attempt.update(2.35,'pressFlick',lesson.lanes[0]);attempt.update(2.4,'press',lesson.lanes[0]);attempt.update(2.7);assert.equal(attempt.status,'retry');
    attempt=new TutorialAttempt(lesson);attempt.update(2.4,'press',lesson.lanes[0]);attempt.update(2.63,'pressFlick',lesson.lanes[0]);assert.equal(attempt.status,'retry');
  }
});

test('difficulty lessons exclude flicks on EASY/NORMAL and support HARD without flicks',()=>{assert.equal(lessonsFor(0).length,2);assert.equal(lessonsFor(1).length,3);assert.equal(lessonsFor(2).length,5);for(const group of [lessonsFor(0),lessonsFor(1),lessonsFor(2,false)])assert.ok(group.every(l=>!l.flick));});
