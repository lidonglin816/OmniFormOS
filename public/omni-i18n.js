// =====================================================================
// OmniFormOS — Global i18n engine (zh/en) for the whole interface.
// DOM-level translation: original text is never destroyed; switching
// language re-renders the app and the observer translates text nodes,
// placeholders and titles live. Auth modal (.sa-mask) manages its own
// strings via omni-auth.js and is skipped here.
// =====================================================================
import {EXACT as SHELL} from './omni-i18n-shell.js?v=20261027c';
import {EXACT as MOD1} from './omni-i18n-mod1.js?v=20261027c';
import {EXACT as MOD2,PHRASES} from './omni-i18n-mod2.js?v=20261027c';
import {EXACT as EXTRA} from './omni-i18n-extra.js?v=20261027c';

const K_LANG='omniformos.lang';
export const getLang=()=>{try{return localStorage.getItem(K_LANG)==='zh'?'zh':'en';}catch{return'en';}};
export function setLang(l){
  try{localStorage.setItem(K_LANG,l);}catch{}
  window.dispatchEvent(new CustomEvent('omni-lang-changed',{detail:l}));
}
const EXACT=new Map(Object.entries({...SHELL,...MOD1,...MOD2,...EXTRA}));
const PHR=PHRASES.slice().sort((a,b)=>b[0].length-a[0].length);
const HAS_ZH=/[一-龥]/;
export function tr(s){
  if(getLang()!=='en'||!s||!HAS_ZH.test(s))return s;
  const t=s.trim();
  if(EXACT.has(t))return s.replace(t,EXACT.get(t));
  let out=s;
  // Complete phrases first. Re-check after every replacement so that a
  // phrase produced by older partial translations can still be normalized.
  for(const [zh,en] of PHR)if(out.includes(zh))out=out.split(zh).join(en);
  const normalized=out.trim();
  if(EXACT.has(normalized))out=out.replace(normalized,EXACT.get(normalized));
  return out;
}
const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','NOSCRIPT']);
function translateAttrs(el){
  for(const name of ['placeholder','title','aria-label']){
    const v=el.getAttribute&&el.getAttribute(name);
    if(v&&HAS_ZH.test(v)){const nv=tr(v);if(nv!==v)el.setAttribute(name,nv);}
  }
}
function walk(rootEl){
  if(getLang()!=='en')return;
  const walker=document.createTreeWalker(rootEl,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{
    acceptNode:node=>{
      if(node.nodeType===Node.TEXT_NODE)return NodeFilter.FILTER_ACCEPT;
      const tag=node.tagName;
      if(SKIP.has(tag))return NodeFilter.FILTER_REJECT;
      if(node.closest&&node.closest('.sa-mask'))return NodeFilter.FILTER_REJECT;
      return node.hasAttribute&&(node.hasAttribute('placeholder')||node.hasAttribute('title')||node.hasAttribute('aria-label'))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
    }
  });
  const nodes=[];let n;
  while(n=walker.nextNode())nodes.push(n);
  for(const node of nodes){
    if(node.nodeType===Node.TEXT_NODE){
      const text=node.textContent;
      if(!HAS_ZH.test(text))continue;
      const parent=node.parentElement;
      if(parent&&parent.closest('.sa-mask'))continue;
      const nt=tr(text);
      if(nt!==text)node.textContent=nt;
    }else translateAttrs(node);
  }
  // Some module renderers replace input attributes after mounting. Querying
  // them explicitly guarantees placeholders and accessibility labels are
  // translated even when their elements were skipped by TreeWalker.
  if(rootEl.matches?.('[placeholder],[title],[aria-label]'))translateAttrs(rootEl);
  rootEl.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el=>{
    if(!el.closest('.sa-mask'))translateAttrs(el);
  });
}
export function installGlobalI18n(root){
  if(!root||root.__i18nInstalled)return;
  root.__i18nInstalled=true;
  let pending=false;
  const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;try{walk(root);}catch{}});};
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  window.addEventListener('omni-lang-changed',schedule);
  schedule();
}
