import test from 'node:test';
import assert from 'node:assert/strict';
import {pointerGaze,dampingAlpha} from '../public/mascot-tracking.js';
test('face gaze follows screen direction with bounded head angles and no body motion',()=>{
  const left=pointerGaze(0,450,1600,900),right=pointerGaze(1600,450,1600,900);
  assert.ok(left.yaw<0&&right.yaw>0);
  assert.ok(pointerGaze(800,0,1600,900).pitch<0);
  assert.ok(pointerGaze(800,900,1600,900).pitch>0);
  const beyond=pointerGaze(9999,-9999,1600,900);
  assert.equal(beyond.yaw,20*Math.PI/180);assert.equal(beyond.pitch,-12*Math.PI/180);assert.equal(beyond.bodyYaw,0);
  assert.equal(pointerGaze(800,450,1600,900).yaw,0);
});
test('time based damping is independent of frame rate and returns more gently',()=>{
  assert.ok(Math.abs((1-dampingAlpha(1/60))**60-(1-dampingAlpha(1/30))**30)<1e-10);
  assert.ok(dampingAlpha(1/60,true)<dampingAlpha(1/60,false));
  assert.ok(1-(1-dampingAlpha(1/60))**9>.8);
  assert.ok(dampingAlpha(10)<1);assert.equal(dampingAlpha(-1),0);
});
