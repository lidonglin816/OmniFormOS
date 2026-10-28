import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionProject} from '../public/workspace-transitions.js';

function fixture(native=true){
  const classes=new Set(),root={dataset:{platformRoute:'pilot'}},source={style:{viewTransitionName:''}},target={style:{viewTransitionName:''}};
  let callback,finish;
  const doc={querySelector:s=>s==='#app'?root:target,addEventListener(){},removeEventListener(){},documentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}};
  if(native)doc.startViewTransition=cb=>{callback=cb;return {skipTransition(){},ready:Promise.resolve(),updateCallbackDone:Promise.resolve(),finished:new Promise(resolve=>{finish=resolve;})};};
  return {doc,root,source,target,classes,run:()=>callback(),finish:async()=>{finish();await Promise.resolve();}};
}
test('project opening falls back immediately for keyboard, reduced motion and unsupported browsers',()=>{
  for(const [pointer,reduced,native] of [[false,false,true],[true,true,true],[true,false,false]]){
    const f=fixture(native);let count=0;
    assert.equal(transitionProject({doc:f.doc,source:f.source,targetSelector:'.title',pointer,reduced:()=>reduced,update:()=>count++}),null);
    assert.equal(count,1);assert.equal(f.classes.size,0);
  }
});
test('shared project transition executes the existing open action once and restores names',async()=>{
  const f=fixture();let count=0;
  transitionProject({doc:f.doc,source:f.source,targetSelector:'.title',pointer:true,reduced:()=>false,update:()=>count++});
  f.run();f.run();assert.equal(count,1);
  assert.equal(f.target.style.viewTransitionName,'workspace-project-title');
  await f.finish();assert.equal(f.source.style.viewTransitionName,'');assert.equal(f.target.style.viewTransitionName,'');assert.equal(f.classes.size,0);
});
test('navigating away before a delayed snapshot never reopens an old project',async()=>{
  const f=fixture();let count=0;
  transitionProject({doc:f.doc,source:f.source,targetSelector:'.title',pointer:true,reduced:()=>false,update:()=>count++});
  f.root.dataset.platformRoute='landing';f.run();await f.finish();assert.equal(count,0);assert.equal(f.classes.size,0);
});
