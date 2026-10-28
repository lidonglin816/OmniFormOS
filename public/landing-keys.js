import {stepSpring} from './workspace-physics.js';

// Only the eight detailed module entries. Navigation remains immediate and unchanged.
export function installLandingKeys(root){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const states=new Map();let frame=0,last=0,held=null;
  const keyFor=event=>event.target.closest('.landing-modules > .landing-module');
  function paint(element,state){
    element.style.setProperty('--key-y',`${state.y}px`);
    element.style.setProperty('--key-depth',`${Math.max(1,7-state.y)}px`);
    element.style.setProperty('--key-scale',String(state.down?.99:1));
  }
  function tick(now){
    const dt=last?(now-last)/1000:1/60;last=now;let moving=false;
    for(const [element,state] of states){
      if(!element.isConnected){states.delete(element);continue;}
      const target=state.down?4:state.hover?-3:0;
      const next=stepSpring(state.y-target,state.velocity,dt);
      state.y=next.settled?target:target+next.position;state.velocity=next.settled?0:next.velocity;
      paint(element,state);if(!next.settled)moving=true;
    }
    frame=moving?requestAnimationFrame(tick):0;if(!moving)last=0;
  }
  function change(element,update){
    if(!element)return;
    const state=states.get(element)||{y:0,velocity:0,hover:false,down:false};states.set(element,state);update(state);
    if(reduced.matches){state.y=0;state.velocity=0;paint(element,state);return;}
    if(!frame)frame=requestAnimationFrame(tick);
  }
  root.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const key=keyFor(event);if(key&&!key.contains(event.relatedTarget))change(key,s=>{s.hover=true;});});
  root.addEventListener('pointerout',event=>{const key=keyFor(event);if(key&&!key.contains(event.relatedTarget))change(key,s=>{s.hover=false;s.down=false;});});
  root.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;const key=keyFor(event);if(!key)return;
    held=key;change(key,s=>{s.down=true;});
  });
  function release(){if(held){change(held,s=>{s.down=false;});held=null;}}
  document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);
  function settle(){held=null;for(const [element,state] of states){state.hover=false;state.down=false;state.y=0;state.velocity=0;paint(element,state);}if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
  window.addEventListener('blur',settle);reduced.addEventListener('change',settle);
  root.addEventListener('keydown',event=>{if(keyFor(event))settle();});
}
