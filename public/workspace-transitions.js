let active=null;
const owners=new WeakMap();

// Only the existing project-open action runs inside the snapshot callback.
// Skipping or interrupting a transition must never execute that action twice.
export function transitionProject({source,targetSelector,update,pointer=false,doc=document,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}) {
  const root=doc.querySelector('#app');
  if(!pointer||reduced()||!source||root?.dataset.platformRoute!=='pilot'||!doc.startViewTransition){update();return null;}
  active?.transition?.skipTransition();
  active?.clean?.();
  const session={transition:null};active=session;
  const changed=[];
  function name(element){
    if(!element)return;
    changed.push([element,element.style.viewTransitionName]);owners.set(element,session);
    element.style.viewTransitionName='workspace-project-title';
  }
  function clean(){
    doc.removeEventListener('keydown',interrupt,true);
    doc.defaultView?.removeEventListener('hashchange',interrupt);
    for(const [element,original] of changed)if(owners.get(element)===session){element.style.viewTransitionName=original;owners.delete(element);}
    if(active===session){active=null;doc.documentElement.classList.remove('workspace-sharing');}
  }
  function interrupt(){session.transition?.skipTransition();clean();}
  session.clean=clean;
  let applied=false;
  function apply(){if(applied)return;applied=true;if(root.dataset.platformRoute==='pilot')update();}
  name(source);doc.documentElement.classList.add('workspace-sharing');
  doc.addEventListener('keydown',interrupt,true);
  doc.defaultView?.addEventListener('hashchange',interrupt);
  try {
    session.transition=doc.startViewTransition(()=>{
      apply();
      if(root.dataset.platformRoute==='pilot'&&!reduced())name(doc.querySelector(targetSelector));
      else session.transition?.skipTransition();
    });
    session.transition.finished.then(clean,clean);
    // Snapshot failure is cosmetic; the update callback still has its own lifecycle.
    session.transition.ready.catch(()=>{});
    session.transition.updateCallbackDone.catch(()=>{});
    return session.transition;
  } catch(error){clean();if(!applied)apply();return null;}
}
