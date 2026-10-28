// One status per module; reading data never claims unsaved edits were saved.
import {tr} from './omni-i18n.js';
export function installWorkspaceStatus(root){
 const original=window.fetch.bind(window),states=new Map();let activeWrites=0;
 const urlOf=input=>input instanceof Request?input.url:String(input);
 const moduleOf=url=>{const p=new URL(urlOf(url),location.href).pathname;return p.match(/^\/api\/(pilot|exam|flow3|flow|doc|adapt|tablemind|lab|canvas)(?:\/|$)/)?.[1]?.replace('flow3','flow');};
 const current=()=>({pilot:'pilot',exam:'exam',flowform:'flow',docmorph:'doc',adaptform:'adapt',tablemind:'tablemind',labform:'lab',appcanvas:'canvas'})[location.hash.slice(1).split('?')[0]];
 function display(){const item=states.get(current()),el=root.querySelector('.local-indicator');if(el)el.replaceChildren(Object.assign(document.createElement('i'),{}),document.createTextNode(' '+tr(item?.text||'本机工作区 · 保存状态见模块')));}
 window.fetch=async(input,options)=>{const module=moduleOf(input),method=(options?.method||input?.method||'GET').toUpperCase(),path=new URL(urlOf(input),location.href).pathname,writing=module&&method!=='GET'&&!/\/(bootstrap|ai|calculate|check|analytics|report)(\/|$)/.test(path);
  if(writing){activeWrites++;states.set(module,{text:'正在处理…'});display();}
  try{const response=await original(input,options);if(writing){states.set(module,{text:response.ok?'操作已同步 · '+new Date().toLocaleTimeString('zh-CN'):response.status===409?'存在冲突 · 当前修改未保存':'操作失败 · 请查看提示'});display();}return response;}
  catch(error){if(module){states.set(module,{text:navigator.onLine?'连接失败 · 请重试':'离线 · 修改尚未同步'});display();}throw error;}
  finally{if(writing)activeWrites--;}
 };
 root.addEventListener('input',event=>{if(event.target.matches('input[type=search],input[type=file],input[type=checkbox],input[type=radio],select')||event.target.closest('.ea-filters')||/search|filter/.test(event.target.id))return;const module=current();if(module&&!activeWrites){states.set(module,{text:'正在编辑 · 请保存修改'});display();}});
 // Observe node replacements only. Updating text via replaceChildren would itself
 // retrigger this observer, so update only if the displayed label differs.
 new MutationObserver(()=>{const el=root.querySelector('.local-indicator'),text=' '+tr(states.get(current())?.text||'本机工作区 · 保存状态见模块');if(el&&el.textContent!==text)display();}).observe(root,{childList:true,subtree:true});
 window.addEventListener('offline',()=>{const module=current();if(module)states.set(module,{text:'离线 · 请保留当前页面'});display();});
}
