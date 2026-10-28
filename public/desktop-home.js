const paths={edit:'M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 3l5 5-10 10-6 1 1-6Z',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',form:'M9 4H5v17h14V4h-4M9 2h6v5H9zM8 12h8M8 16h6',flow:'M3 3h6v6H3zM15 15h6v6h-6zM6 9v9h9M15 3h6v6h-6zM9 6h6',search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',panel:'M3 4h18v16H3zM9 4v16',arrow:'M12 20V4M5 11l7-7 7 7',spark:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',chart:'M4 20V10M10 20V4M16 20v-8M22 20H2',lab:'M9 3h6M10 3v7L4 20h16l-6-10V3M8 14h8',file:'M14 2H5v20h14V7ZM14 2v6h6M8 13h8M8 17h6',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',palette:'M12 2a10 10 0 0 0 0 20c1.16 0 2-.86 2-1.96 0-.51-.2-.97-.52-1.33-.33-.36-.52-.82-.52-1.33 0-1.1.9-2 2-2h2.35A4.68 4.68 0 0 0 22 10.75C21.45 5.86 17.13 2 12 2ZM7 12.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm3.5-4a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm4.5-.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z'};
import {openAuth,openAccountCenter,openSettings} from './omni-auth.js';
export const desktopIcon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.grid}"/></svg>`;
const escText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getAccount=()=>{try{return localStorage.getItem('omniformos.account')||'';}catch{return '';}};
const getProfile=acct=>{try{return JSON.parse(localStorage.getItem('omniformos.users')||'{}')[acct]||{};}catch{return{};}};
// 侧栏底部账户区：个人账户（已登录打开右侧抽屉）+ 调色板 + 设置
const accountHTML=()=>{const acct=getAccount(),profile=acct?getProfile(acct):{},avatar=profile.avatar||'',name=profile.displayName||acct;return `<button type="button" class="omni-acct-user" data-omni-login aria-label="个人账户"><span class="omni-acct-avatar ${avatar?'has-photo':''}">${avatar?`<img src="${escText(avatar)}" alt=""/>`:acct?escText((name||acct).slice(0,1).toUpperCase()):'我'}</span><span class="omni-acct-text"><b>${acct?escText(name):'我的账号'}</b><small>${acct?escText(profile.displayName?acct:'本地账户 · 已登录'):'MHcoding Key'}</small></span></button><span class="omni-acct-tools"><button type="button" class="omni-acct-btn" data-omni-palette title="切换主题" aria-label="切换主题">${desktopIcon('palette')}</button><button type="button" class="omni-acct-btn" data-desktop-settings title="设置" aria-label="设置">${desktopIcon('settings')}</button></span>`;};
export const refreshAccountWidgets=()=>{document.querySelectorAll('.omni-acct').forEach(w=>{w.innerHTML=accountHTML();});};
export function desktopHome({apps,escape}){
  const button=(route,label,icon,active=false)=>`<button class="desk-nav ${active?'selected':''}" data-route="${route}">${desktopIcon(icon)}<span>${label}</span></button>`;
  // 与平台工作区侧栏一致的导航：平台（工作台 / AI 创作中心 / 应用管理）+ 创作工具（八大引擎）
  const groupLabel=text=>`<div class="desk-group-label">${text}</div>`;
  const navButton=(route,label,glyph,active=false)=>`<button class="desk-nav ${active?'selected':''}" data-route="${route}" title="${label}"><span class="g" aria-hidden="true">${glyph}</span><span>${label}</span></button>`;
  const platformNav=groupLabel('平台')+navButton('home','工作台','◈',true)+navButton('studio','AI 创作中心','✦')+navButton('apps','应用管理','▦');
  const modulesNav=groupLabel('创作工具')+[['pilot','FormPilot','✦'],['exam','ExamCraft','♧'],['flowform','FlowForm','⌘'],['docmorph','DocMorph','▧'],['adaptform','AdaptForm','⌁'],['tablemind','TableMind','▦'],['labform','LabForm','⚗'],['appcanvas','AppCanvas','▣']].map(([route,label,glyph])=>navButton(route,label,glyph)).join('');
  const recent=apps.slice(0,8).map(a=>`<button class="desk-recent-item" data-open-app="${escape(a.id)}" title="${escape(a.name)}">${escape(a.name)}</button>`).join('');
  const shortcuts=[['pilot','应用构建','spark'],['exam','考试测评','form'],['flowform','审批流程','flow'],['tablemind','数据分析','chart'],['labform','科研实验','lab']];
  const engines=[
    ['pilot','01','FormPilot','业务系统生成','✦','#a88be7'],
    ['exam','02','ExamCraft','智能考试测评','♧','#dc8599'],
    ['flowform','03','FlowForm','审批与自动化','⌘','#a8cb69'],
    ['docmorph','04','DocMorph','文档数字化','▧','#74b9ca'],
    ['adaptform','05','AdaptForm','自适应表单','⌁','#dea77e'],
    ['tablemind','06','TableMind','数据分析应用','▦','#82b89d'],
    ['labform','07','LabForm','科研实验管理','⚗','#879bd2'],
    ['appcanvas','08','AppCanvas','可视化应用搭建','▣','#d4bc70']
  ];
  const engineCards=engines.map(([route,no,name,desc,glyph,color],index)=>`<button type="button" class="desk-engine-card" data-route="${route}" style="--engine:${color};--fan:${index-3.5}" aria-label="打开 ${name}"><span class="desk-engine-no">${no}</span><span class="desk-engine-arrow">↗</span><span class="desk-engine-glyph" aria-hidden="true">${glyph}</span><span class="desk-engine-copy"><b>${name}</b><small>${desc}</small></span><span class="desk-engine-open">OPEN<br>ENGINE</span></button>`).join('');
  return `<div class="desk-home"><aside class="desk-side"><div class="desk-brand"><a href="#landing" aria-label="OmniFormOS 首页"><img src="/desktop-icon.png" alt=""/><strong>OmniForm<span>OS</span></strong></a><button type="button" class="desk-icon" data-desk-collapse aria-label="收起侧栏" title="收起侧栏">${desktopIcon('panel')}</button></div><nav class="desk-primary" aria-label="桌面导航">${platformNav}${modulesNav}</nav><div class="desk-recents"><div class="desk-section-head"><span>最近项目</span><button class="desk-icon" data-route="apps" aria-label="查找项目">${desktopIcon('search')}</button></div><span class="desk-section-note">当前工作区</span>${recent||'<p class="desk-no-project">还没有项目，从一个想法开始。</p>'}</div><div class="desk-side-bottom omni-acct">${accountHTML()}</div></aside><main class="desk-stage"><button class="desk-reopen desk-icon" data-desk-collapse aria-label="展开侧栏">${desktopIcon('panel')}</button><div class="desk-create"><div class="desk-heading"><h1>你的下一个想法，从这里开始。</h1><p>应用、表单、考试、工作流。说出你的需求，让八大引擎为你协作。</p></div><form id="generate-form" class="desk-composer"><label class="desk-sr" for="prompt">描述你想构建的应用</label><textarea id="prompt" name="prompt" required maxlength="1000" aria-label="描述你想构建的应用" placeholder="例如：创建校园竞赛管理系统，支持团队报名、作品上传和教师评审……"></textarea><div class="desk-composer-tools"><button type="button" class="desk-icon desk-material" data-route="docmorph" aria-label="导入文档材料" title="使用 DocMorph 导入材料">${desktopIcon('file')}</button><span class="desk-mode">${desktopIcon('spark')}需求生成应用</span><span class="desk-local"><i></i>本地工作区</span><div class="desk-model-picker"><button type="button" class="desk-model" data-model-toggle aria-haspopup="menu" aria-expanded="false"><span class="desk-model-dot"></span><span data-model-label>选择 AI 模型</span><span>⌄</span></button><div class="desk-model-menu" data-model-menu hidden role="menu"><div class="desk-model-menu-head"><b>AI 模型</b><small data-model-provider>正在读取配置…</small></div><div class="desk-model-options" data-model-options></div><button type="button" class="desk-model-manage" data-desktop-settings>管理模型与 API <span>↗</span></button></div></div><button class="desk-send" type="submit" aria-label="开始构建应用">${desktopIcon('arrow')}</button></div></form><section class="desk-engine-zone" data-engine-view="quick"><div class="desk-engine-bar"><p class="desk-hint">选择一个专业引擎，或直接描述你想解决的问题</p><div class="desk-engine-switch" role="group" aria-label="引擎入口显示方式"><button type="button" class="on" data-engine-mode="quick">快捷模式</button><button type="button" data-engine-mode="fan">扇形模式</button></div></div><div class="desk-engine-quick"><div class="desk-shortcuts" aria-label="创作快捷入口">${shortcuts.map(([route,label,icon])=>`<button data-route="${route}">${desktopIcon(icon)}${label}<span>↗</span></button>`).join('')}</div><div class="desk-other-engines"><button data-route="docmorph">文档数字化</button><i>·</i><button data-route="adaptform">智能表单</button><i>·</i><button data-route="appcanvas">可视化应用搭建</button></div></div><div class="desk-engine-fan" aria-label="八大创作引擎">${engineCards}</div></section><p class="desk-footnote">先生成可编辑的应用草稿，再按你的需求调整表单、页面和业务流程。</p></div></main></div>`;
}
export function installDesktopHome(){
  let modelInfo=null;
  const modelChoices=()=>{const list=[];if(modelInfo?.model)list.push(modelInfo.model);try{Object.values(JSON.parse(localStorage.getItem('omniformos.modelAssign')||'{}')).forEach(x=>{if(x&&!list.includes(x))list.push(x);});}catch{}return list;};
  const selectedModel=()=>{try{return localStorage.getItem('omniformos.desktop.model')||modelInfo?.model||'';}catch{return modelInfo?.model||'';}};
  const paintModelPicker=()=>{const chosen=selectedModel(),choices=modelChoices();document.querySelectorAll('.desk-model-picker').forEach(p=>{const label=p.querySelector('[data-model-label]'),provider=p.querySelector('[data-model-provider]'),box=p.querySelector('[data-model-options]');if(label)label.textContent=chosen||'选择 AI 模型';if(provider)provider.textContent=modelInfo?.configured?`${new URL(modelInfo.baseUrl).host} · 已配置`:'尚未配置 API';if(box)box.innerHTML=choices.length?choices.map(m=>`<button type="button" role="menuitemradio" aria-checked="${m===chosen}" data-model-choice="${escText(m)}"><span>${escText(m)}</span>${m===modelInfo?.model?'<small>默认</small>':''}</button>`).join(''):'<p>请先在设置中配置模型</p>';});};
  const loadModelPicker=async()=>{try{const r=await fetch('/api/ai/config',{cache:'no-store'});modelInfo=await r.json();}catch{modelInfo=null;}paintModelPicker();};
  document.addEventListener('click',event=>{
    const modelToggle=event.target.closest('[data-model-toggle]');
    if(modelToggle){const picker=modelToggle.closest('.desk-model-picker'),menu=picker?.querySelector('[data-model-menu]'),open=menu?.hidden;if(menu){document.querySelectorAll('[data-model-menu]').forEach(x=>x.hidden=true);menu.hidden=!open;modelToggle.setAttribute('aria-expanded',String(!!open));if(open)loadModelPicker();}return;}
    const modelChoice=event.target.closest('[data-model-choice]');
    if(modelChoice){try{localStorage.setItem('omniformos.desktop.model',modelChoice.dataset.modelChoice);}catch{}const menu=modelChoice.closest('[data-model-menu]');if(menu)menu.hidden=true;paintModelPicker();return;}
    if(!event.target.closest('.desk-model-picker'))document.querySelectorAll('[data-model-menu]').forEach(x=>x.hidden=true);
    const mode=event.target.closest('[data-engine-mode]');
    if(mode){
      const zone=mode.closest('.desk-engine-zone'),value=mode.dataset.engineMode;
      if(zone){zone.dataset.engineView=value;zone.querySelectorAll('[data-engine-mode]').forEach(b=>b.classList.toggle('on',b===mode));try{localStorage.setItem('omniformos.desktop.engineView',value);}catch{}}
      return;
    }
    if(event.target.closest('[data-desk-collapse]')){const closed=document.documentElement.classList.toggle('desk-collapsed');try{localStorage.setItem('omniformos.desktop.sidebar',String(closed));}catch{}}
    if(event.target.closest('[data-desktop-settings]'))openSettings();
    // 调色板：切换深浅主题（复用全局主题存储键 omniformos.theme）
    if(event.target.closest('[data-omni-palette]')){
      const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
      const relay=document.querySelector('[data-theme-toggle]');
      if(relay)relay.click();
      else{document.documentElement.dataset.theme=next;document.documentElement.style.colorScheme=next;try{localStorage.setItem('omniformos.theme',next);}catch{}}
    }
    // 个人账户：未登录显示登录弹窗；已登录从右侧展开账户抽屉
    if(event.target.closest('[data-omni-login]')){if(getAccount())openAccountCenter();else openAuth();}
  });
  window.addEventListener('omni-auth-changed',refreshAccountWidgets);
  try{document.documentElement.classList.toggle('desk-collapsed',localStorage.getItem('omniformos.desktop.sidebar')==='true');}catch{}
  const restoreEngineView=()=>{let value='quick';try{value=localStorage.getItem('omniformos.desktop.engineView')||'quick';}catch{}document.querySelectorAll('.desk-engine-zone').forEach(zone=>{zone.dataset.engineView=value;zone.querySelectorAll('[data-engine-mode]').forEach(b=>b.classList.toggle('on',b.dataset.engineMode===value));});};
  restoreEngineView();loadModelPicker();
  new MutationObserver(()=>{restoreEngineView();paintModelPicker();}).observe(document.getElementById('app'),{childList:true,subtree:false});
  // 登录 / 注册 / 邮箱验证 / 密码找回 / 个人中心：见 omni-auth.js（Premium SaaS Auth）
  // ===== macOS 红绿灯窗口控制（无边框窗口） =====
  const tl=document.createElement('div');
  tl.className='desk-tl';tl.setAttribute('aria-label','窗口控制');
  tl.innerHTML='<button type="button" class="tl tl-close" data-act="close" aria-label="关闭窗口"></button><button type="button" class="tl tl-min" data-act="minimize" aria-label="最小化窗口"></button><button type="button" class="tl tl-max" data-act="toggleMaximize" aria-label="最大化窗口"></button>';
  tl.addEventListener('click',event=>{const b=event.target.closest('.tl');if(b)window.omniWindow?.[b.dataset.act]?.();});
  // ===== 平台侧栏（模块页）底部注入账户区 =====
  const injectAcct=()=>{
    const sb=document.querySelector('#app>.sidebar');
    if(sb&&!sb.querySelector(':scope>.omni-acct')){const w=document.createElement('div');w.className='omni-acct omni-acct-in-sidebar';w.innerHTML=accountHTML();sb.appendChild(w);}
  };
  let observer;
  const startInject=()=>{
    const root=document.getElementById('app');
    if(root){observer=new MutationObserver(()=>{injectAcct();});observer.observe(root,{childList:true,subtree:true});injectAcct();}
    else setTimeout(startInject,300);
  };
  const mount=()=>{if(document.body){if(!tl.isConnected)document.body.appendChild(tl);}};
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>{mount();startInject();});}
  else{mount();startInject();}
  window.addEventListener('load',()=>{mount();injectAcct();});
  // 拖拽区双击最大化/还原（顶栏与品牌区为拖拽区）
  document.addEventListener('dblclick',event=>{
    if(event.target.closest('button,a,input,select,textarea,[data-desk-collapse]'))return;
    if(event.target.closest('.topbar,.desk-brand,#app>.sidebar .brand'))window.omniWindow?.toggleMaximize?.();
  });
}
