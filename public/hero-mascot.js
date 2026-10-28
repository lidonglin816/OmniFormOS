// The heavyweight R3F bundle is requested only while the homepage Hero exists.
export function installHeroMascot(root){
  let hero=null,layer=null,paws=null,dispose=null,token=0,pending=false;
  function sync(){
    pending=false;const next=root.querySelector('.landing-hero');if(next===hero)return;
    token++;dispose?.();dispose=null;layer?.remove();paws?.remove();hero=next;if(!hero)return;
    const current=token;
    layer=document.createElement('div');layer.className='hero-mascot-background';layer.setAttribute('aria-hidden','true');layer.inert=true;
    const image=document.createElement('img');image.className='hero-mascot-fallback';image.src='/assets/omniform-mascot-reference.png';image.alt='';image.decoding='async';layer.append(image);
    const stage=document.createElement('div');stage.className='hero-mascot-stage';layer.append(stage);hero.prepend(layer);
    const caption=root.querySelector('.landing-gallery-stage .gallery-caption');
    paws=document.createElement('div');paws.className='hero-mascot-paws';paws.setAttribute('aria-hidden','true');paws.inert=true;
    caption?.append(paws);
    import('/vendor/hero-mascot.js').then(module=>{if(current!==token)return;dispose=module.mountHeroMascot(stage,layer,paws);}).catch(()=>{if(current===token)layer.dataset.renderer='fallback';});
  }
  new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(sync);}}).observe(root,{childList:true,subtree:true});sync();
}
