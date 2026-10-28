import test from 'node:test';
import assert from 'node:assert/strict';
import {stepSpring,flipDelta} from '../public/workspace-physics.js';
test('spring converges after a large displacement and retains supplied velocity',()=>{
  let p=240,v=-80;
  for(let n=0;n<500;n++){const state=stepSpring(p,v,1/60);p=state.position;v=state.velocity;}
  assert.ok(Math.abs(p)<.15&&Math.abs(v)<.5);
  assert.notEqual(stepSpring(10,100,1/60).position,stepSpring(10,-100,1/60).position);
});
test('spring background-tab pauses are bounded and FLIP uses actual movement',()=>{
  assert.deepEqual(stepSpring(100,0,10),stepSpring(100,0,.064));
  assert.deepEqual(flipDelta({left:10,top:150},{left:30,top:70}),{x:-20,y:80});
  assert.deepEqual(stepSpring(0,0,1/60),{position:0,velocity:0,settled:true});
});
