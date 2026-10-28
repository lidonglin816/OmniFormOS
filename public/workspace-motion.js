import {stepSpring,flipDelta} from './workspace-physics.js';
// Motion decorates existing interactions; it never delays or performs business actions.
export function installWorkspaceMotion({root,getRoute}) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const navs='nav,.wui-segmented,.tmp-view-tabs,.fp-main-tabs,.fp3-view-tabs,.fp3-entity-tabs,.cp-tabs';
  const switches='[data-f3-space],[data-f3-view],[data-f3-entity],.fc-nav [data-fc=tab],[data-route],[data-fp-panel],[data-x-view],[data-ffp-tab],[data-dmp-tab],[data-afp-tab],[data-tmp-area],[data-tmp-view],[data-lfp-tab],.cp-tabs button';
  let pending=null,frame=0,pressed=null;
  const running=new Map();
  const springs=new Map();
  const reorderItems='[data-afp-drag]';
  let firstRects=null,layoutFrame=0,layoutUntil=0;
  function springToRest(element,dx,dy){
    const old=springs.get(element);
    if(old)cancelAnimationFrame(old.frame);
    const state={x:dx,y:dy,vx:old?.vx||0,vy:old?.vy||0,time:performance.now(),frame:0,original:old?.original??element.style.translate};
    springs.set(element,state);
    function tick(now){
      if(!element.isConnected||reduced.matches||getRoute()==='landing'){element.style.translate=state.original;springs.delete(element);return;}
      const dt=(now-state.time)/1000;state.time=now;
      const x=stepSpring(state.x,state.vx,dt),y=stepSpring(state.y,state.vy,dt);
      state.x=x.position;state.y=y.position;state.vx=x.velocity;state.vy=y.velocity;
      if(x.settled&&y.settled){element.style.translate=state.original;springs.delete(element);return;}
      element.style.translate=`${state.x}px ${state.y}px`;state.frame=requestAnimationFrame(tick);
    }
    element.style.translate=`${dx}px ${dy}px`;state.frame=requestAnimationFrame(tick);
  }
  function captureLayout(){
    if(reduced.matches||getRoute()==='landing')return;
    layoutUntil=performance.now()+900;
    firstRects=new Map([...root.querySelectorAll(reorderItems)].map(el=>[el.dataset.afpDrag,el.getBoundingClientRect()]));
  }
  function finishLayout(){
    layoutFrame=0;if(!firstRects)return;
    const previous=firstRects;firstRects=null;
    if(reduced.matches||getRoute()==='landing'||performance.now()>layoutUntil)return;
    root.querySelectorAll(reorderItems).forEach(el=>{
      const before=previous.get(el.dataset.afpDrag);if(!before)return;
      const delta=flipDelta(before,el.getBoundingClientRect());
      if(Math.abs(delta.x)+Math.abs(delta.y)>.5)springToRest(el,delta.x,delta.y);
    });
  }
  root.addEventListener('click',event=>{if(event.detail&&event.target.closest('[data-afp-move]'))captureLayout();},true);
  root.addEventListener('drop',captureLayout,true);
  function play(element,frames,options){
    if(!element||!element.isConnected||reduced.matches||getRoute()==='landing'||!element.animate)return;
    running.get(element)?.cancel();
    const animation=element.animate(frames,{easing:'cubic-bezier(0.23,1,0.32,1)',...options});
    running.set(element,animation);
    const clean=()=>{if(running.get(element)===animation)running.delete(element);};
    animation.onfinish=clean;animation.oncancel=clean;
  }
  function release(){pressed?.removeAttribute('data-motion-pressed');pressed=null;}
  root.addEventListener('pointerdown',event=>{
    if(getRoute()==='landing'||event.button!==0)return;
    root.dataset.motionInput='pointer';
    const button=event.target.closest('button');
    if(button&&!button.disabled){release();pressed=button;button.setAttribute('data-motion-pressed','');}
  },true);
  document.addEventListener('pointerup',release,true);
  document.addEventListener('pointercancel',release,true);
  window.addEventListener('blur',release);
  root.addEventListener('click',event=>{
    if(!event.detail||reduced.matches||getRoute()==='landing')return;
    const button=event.target.closest(switches);
    if(!button||button.disabled||button.classList.contains('active')||button.dataset.route==='landing')return;
    const nav=button.closest(navs);
    const previous=nav?.querySelector('.active');
    pending={until:performance.now()+900,button,old:(nav?.querySelector('.workspace-moving-highlight')||previous)?.getBoundingClientRect(),navClass:nav?.className.split(/\s+/).filter(c=>!c.startsWith('workspace-')).join(' ')};
  },true);
  function flush(){
    frame=0;
    if(!pending)return;
    const action=pending;pending=null;
    if(performance.now()>action.until||getRoute()==='landing')return;
    let active=action.button.isConnected?action.button:null;
    if(!active&&action.navClass){
      const classes=action.navClass.split(/\s+/).filter(Boolean);
      const nav=[...root.querySelectorAll(navs)].find(el=>classes.every(c=>el.classList.contains(c)));
      active=nav?.querySelector('.active');
    }
    if(active?.classList.contains('active')&&action.old){
      const next=active.getBoundingClientRect(),delta=flipDelta(action.old,next);
      // A shared highlight moves behind the text; labels themselves stay stationary.
      const nav=active.closest(navs);
      if(nav&&!nav.closest('.sidebar')){
        nav.querySelectorAll('.workspace-moving-highlight').forEach(el=>el.remove());
        const marker=document.createElement('span');marker.className='workspace-moving-highlight';marker.setAttribute('aria-hidden','true');
        const bounds=nav.getBoundingClientRect();
        marker.style.cssText=`left:${next.left-bounds.left+nav.scrollLeft}px;top:${next.top-bounds.top+nav.scrollTop}px;width:${next.width}px;height:${next.height}px`;
        nav.classList.add('workspace-motion-nav');nav.append(marker);
        {
          nav.classList.add('workspace-highlight-travel');
          const animation=marker.animate([
            {transform:`translate(${delta.x}px,${delta.y}px) scale(${action.old.width/next.width},${action.old.height/next.height})`},
            {transform:'translate(0,0) scale(1,1)'}
          ],{duration:240,easing:'cubic-bezier(0.23,1,0.32,1)'});
          const finish=()=>{nav.classList.remove('workspace-highlight-travel');marker.remove();};
          animation.onfinish=finish;animation.oncancel=finish;
          running.set(marker,animation);
          animation.finished.catch(()=>{}).finally(()=>running.delete(marker));
        }
      }
    }
  }
  function alignNavigation(){
    root.querySelectorAll(navs).forEach(nav=>{
      if(nav.closest('.sidebar'))return;
      const buttons=[...nav.children].filter(el=>el.tagName==='BUTTON');
      if(buttons.length<2)return;
      const first=buttons[0].getBoundingClientRect(),next=buttons[1].getBoundingClientRect();
      const axis=Math.abs(next.top-first.top)>Math.abs(next.left-first.left)?'vertical':'horizontal';
      if(nav.dataset.workspaceAxis!==axis)nav.dataset.workspaceAxis=axis;
    });
  }
  // Mutation observers run before paint: never show the destination highlight for
  // one frame before moving it back to the previous (possibly in-flight) position.
  new MutationObserver(()=>{alignNavigation();if(pending)flush();if(firstRects&&!layoutFrame)layoutFrame=requestAnimationFrame(finishLayout);}).observe(root,{childList:true,subtree:true});
  window.addEventListener('resize',alignNavigation);
  alignNavigation();
  function stop(){release();pending=null;firstRects=null;for(const animation of running.values())animation.cancel();running.clear();for(const [el,state] of springs){cancelAnimationFrame(state.frame);el.style.translate=state.original;}springs.clear();root.querySelectorAll('.workspace-moving-highlight').forEach(el=>el.remove());root.querySelectorAll('.workspace-highlight-travel').forEach(el=>el.classList.remove('workspace-highlight-travel'));}
  reduced.addEventListener('change',()=>{if(reduced.matches)stop();});
  document.addEventListener('keydown',()=>{if(getRoute()!=='landing')root.dataset.motionInput='keyboard';stop();},true);
  return {
    panelChange(panel,update){
      if(reduced.matches||getRoute()==='landing'){update();return;}
      const neighbors=[...panel.parentElement.children].filter(el=>el!==panel);
      const before=new Map(neighbors.map(el=>[el,el.getBoundingClientRect()]));
      update();
      for(const element of neighbors){
        if(!element.isConnected)continue;
        // First was captured at the visible in-flight position. Last must be
        // the natural new layout, while springToRest retains the old velocity.
        const existing=springs.get(element);
        if(existing)element.style.translate=existing.original;
        const delta=flipDelta(before.get(element),element.getBoundingClientRect());
        if(Math.abs(delta.x)+Math.abs(delta.y)>.5)springToRest(element,delta.x,delta.y);
      }
      if(!panel.classList.contains('wui-panel-folded'))play(panel,[{opacity:.6},{opacity:1}],{duration:160});
    }
  };
}
