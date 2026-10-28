import {rankCommands,nextCommandIndex} from './workspace-ui-model.js';
import {installWorkspaceMotion} from './workspace-motion.js';
import {installModuleExperiences} from './module-experiences.js';
import {tr} from './omni-i18n.js';

const environments = {
  home:['工作空间','从项目继续，或快速切换到需要的工具','◈'],
  studio:['创作中心','描述、规划、构建，找到下一步','✦'],
  apps:['应用管理','集中查找并打开你的业务项目','▦'],
  pilot:['应用构建','对话迭代 · 应用预览 · 属性上下文','✦'],
  exam:['测评工作区','出题、组卷、考试与阅卷连贯切换','♧'],
  flowform:['流程编排','节点、分支与运行记录，各就其位','⌘'],
  docmorph:['文档复核','原件与字段并排，逐项保留依据','▧'],
  adaptform:['动态表单','条件与预览联动，按需展开面板','⌁'],
  tablemind:['数据工作区','视图切换 · 单元格编辑 · 记录侧览','▦'],
  labform:['实验工作区','原始测量、计算与报告连续查看','⚗'],
  appcanvas:['页面工作室','页面结构、组件属性与画布协同','▣']
};
const tabs = '.fc-nav,.fp3-view-tabs,.fp3-entity-tabs,.tmp-view-tabs,.cp-tabs,.fp-main-tabs,.ec-nav,.ffp-nav,.dmp-nav,.afp-nav,.tmp-nav,.lfp-nav';
const tabActions = '[data-fp-panel],[data-x-view],[data-ffp-tab],[data-dmp-tab],[data-afp-tab],[data-tmp-area],[data-tmp-view],[data-lfp-tab]';
const panels = [
  ['.fp-properties','属性上下文'],['.afp-home-preview','实时填写预览'],['.afp-live','动态表单预览'],
  ['.dm-source-pane','文档原件'],['.lfp-research-ledger','研究档案'],['.lfp-plot-config','曲线配置'],['.tmp-resources','数据资源目录']
];
const esc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelOf = el => (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
const visible = el => el.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';

export function installWorkspaceUI({root,getRoute,navigate,routes}) {
  const motion=installWorkspaceMotion({root,getRoute});
  installModuleExperiences({root,getRoute});
  let pending=false, lastRoute='', commandDialog=null, optionsDialog=null, focused=false, returnFocus=null;
  const folded=new Set();
  let compact=false;
  try {compact=sessionStorage.getItem('omniform-ui-density')==='compact';}catch{}

  function reflow(){window.dispatchEvent(new Event('resize'));}
  function focusMode(next){focused=next;document.body.classList.toggle('wui-focus-mode',next);update();requestAnimationFrame(reflow);}
  function panelState(panel,selector,next){
    const key=getRoute()+selector;
    if(next)folded.add(key);else folded.delete(key);
    panel.classList.toggle('wui-panel-folded',next);
    panel.parentElement.classList.toggle('wui-parent-folded',!!panel.parentElement.querySelector(':scope > .wui-panel-folded'));
    const button=panel.querySelector(':scope > .wui-panel-toggle');
    if(button){button.setAttribute('aria-expanded',String(!next));button.setAttribute('aria-label',(next?'展开':'收起')+button.dataset.panelName);button.textContent=next?'‹': '›';button.title=(next?'展开':'收起')+button.dataset.panelName;}
    requestAnimationFrame(reflow);
  }
  function closeTransient(){commandDialog?.close();optionsDialog?.close();}
  function commandItems(){
    const list=[],seen=new Set();
    root.querySelectorAll(tabActions).forEach(el=>{
      if(!visible(el)||el.disabled||el.closest('.sidebar,[data-wui]'))return;
      const label=labelOf(el);if(!label||label.length>85||seen.has(label))return;seen.add(label);
      list.push({label,group:'当前工作区',keywords:getRoute(),run:()=>{if(el.isConnected)el.click();}});
    });
    const projectSelector='[data-fp-open],[data-open-app],[data-ffp-open],[data-dmp-open],[data-afp-open],[data-tmp-open],[data-lfp-open],[data-x-paper]';
    root.querySelectorAll(projectSelector).forEach(el=>{
      if(!visible(el)||el.disabled)return;
      const card=el.closest('article')||el.closest('.ec-desk-paper')||el;
      const title=card.querySelector('h3,strong')?.textContent?.trim()||labelOf(el);
      if(!title||seen.has(title))return;seen.add(title);
      list.push({label:title.slice(0,85),group:'当前项目',keywords:'项目 打开 继续',run:()=>{if(el.isConnected)el.click();}});
    });
    routes.filter(([id])=>['home','studio','apps','pilot','exam','flowform','docmorph','adaptform','tablemind','labform','appcanvas'].includes(id)).forEach(([id,name])=>{
      list.push({label:name,group:'前往',keywords:`${id} ${environments[id]?.[1]||''}`,run:()=>navigate(id)});
    });
    if(getRoute()!=='appcanvas')list.push({label:focused?'退出专注模式':'进入专注模式',group:'显示',keywords:'focus 全屏',run:()=>focusMode(!focused)});
    list.push({label:compact?'切换为舒适间距':'切换为紧凑间距',group:'显示',keywords:'density 密度',run:()=>setDensity(!compact)});
    return list;
  }
  function setDensity(next){compact=next;try{sessionStorage.setItem('omniform-ui-density',next?'compact':'comfortable');}catch{}update();}
  function openCommands(){
    if(getRoute()==='landing'||document.querySelector('dialog[open]'))return;
    returnFocus=document.activeElement;
    const commands=commandItems(); let matches=commands,index=0;
    const dialog=document.createElement('dialog');commandDialog=dialog;
    dialog.className='wui-command';dialog.setAttribute('aria-labelledby','wui-command-title');
    dialog.innerHTML=`<header><span>⌕</span><div><h2 id="wui-command-title">快速查找</h2><input id="wui-command-search" aria-label="搜索页面、视图或当前项目" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="wui-command-results" placeholder="输入功能、视图或项目名称…" autocomplete="off"></div><button type="button" aria-label="关闭命令菜单">Esc</button></header><div id="wui-command-results" role="listbox" aria-label="可用操作"></div><footer><span><kbd>↑</kbd><kbd>↓</kbd> 选择　<kbd>Enter</kbd> 打开</span><span>当前工作区 · ${esc(environments[getRoute()]?.[0]||'OmniForm OS')}</span></footer>`;
    const input=dialog.querySelector('input'),results=dialog.querySelector('[role=listbox]');
    function draw(){
      if(index>=matches.length)index=matches.length-1;
      results.innerHTML=matches.map((item,i)=>`<button type="button" id="wui-command-${i}" role="option" aria-selected="${i===index}" data-index="${i}"><span class="wui-command-symbol">${item.group==='前往'?'↗':item.group==='当前项目'?'▤':'◇'}</span><span><b>${esc(item.label)}</b><small>${esc(item.group)}</small></span>${i===index?'<kbd>↵</kbd>':''}</button>`).join('')||'<div class="wui-no-results">没有匹配的功能或项目。换个关键词试试。</div>';
      if(index>=0)input.setAttribute('aria-activedescendant',`wui-command-${index}`);else input.removeAttribute('aria-activedescendant');
      results.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
    }
    input.oninput=()=>{matches=rankCommands(commands,input.value);index=matches.length?0:-1;draw();};
    input.onkeydown=e=>{if(e.isComposing)return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();index=nextCommandIndex(index,e.key==='ArrowDown'?1:-1,matches.length);draw();}else if(e.key==='Enter'){e.preventDefault();const item=matches[index];if(item){dialog.close();item.run();}}};
    results.onclick=e=>{const item=e.target.closest('[data-index]');if(item){const command=matches[Number(item.dataset.index)];dialog.close();command?.run();}};
    dialog.querySelector('header button').onclick=()=>dialog.close();
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    dialog.onclose=()=>{dialog.remove();commandDialog=null;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});};
    document.body.append(dialog);draw();dialog.showModal();input.focus();
  }
  function openOptions(){
    if(document.querySelector('dialog[open]'))return;
    const available=panels.filter(([selector])=>root.querySelector(selector));
    const dialog=document.createElement('dialog');optionsDialog=dialog;dialog.className='wui-options';dialog.setAttribute('aria-labelledby','wui-options-title');
    dialog.innerHTML=`<header><div><small>YOUR WORKSPACE</small><h2 id="wui-options-title">调整工作区域</h2></div><button type="button" aria-label="关闭界面选项">×</button></header><p>界面设置只影响显示，不修改项目内容。</p><section><h3>外观主题</h3><div class="wui-density"><button type="button" data-theme-set="light" aria-pressed="${document.documentElement.dataset.theme!=='dark'}">☀ 浅色</button><button type="button" data-theme-set="dark" aria-pressed="${document.documentElement.dataset.theme==='dark'}">☾ 深色</button></div></section><section><h3>信息密度</h3><div class="wui-density"><button data-density="comfortable" aria-pressed="${!compact}"><i>▤</i>舒适间距</button><button data-density="compact" aria-pressed="${compact}"><i>☷</i>紧凑间距</button></div></section><section><h3>面板显示</h3>${available.length?available.map(([selector,name],i)=>`<label><span>${esc(name)}</span><input type="checkbox" data-panel="${i}" ${folded.has(getRoute()+selector)?'':'checked'}></label>`).join(''):'<p>当前页面没有可折叠的辅助面板。进入编辑器后可按需调整。</p>'}</section><footer><button type="button" class="primary">完成</button></footer>`;
    dialog.querySelector('header button').onclick=()=>dialog.close();dialog.querySelector('footer button').onclick=()=>dialog.close();
    dialog.onclick=e=>{const button=e.target.closest('[data-density]');if(button){setDensity(button.dataset.density==='compact');dialog.querySelectorAll('[data-density]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.density==='compact')===compact)));}};
    dialog.onchange=e=>{if(e.target.dataset.panel!==undefined){const [selector]=available[Number(e.target.dataset.panel)],panel=root.querySelector(selector);if(panel)panelState(panel,selector,!e.target.checked);}};
    dialog.onclose=()=>{dialog.remove();optionsDialog=null;};document.body.append(dialog);dialog.showModal();
  }
  function update(){
    const route=getRoute();
    if(route==='landing'){
      if(focused)focusMode(false);
      document.body.classList.remove('wui-density-compact');closeTransient();return;
    }
    if(route!==lastRoute){lastRoute=route;closeTransient();if(route==='appcanvas'&&focused)focusMode(false);}
    document.body.classList.toggle('wui-density-compact',compact);
    const top=root.querySelector('.top-actions');
    if(top&&!top.querySelector('[data-wui="command"]')){
      const button=document.createElement('button');button.type='button';button.className='wui-search-trigger';button.dataset.wui='command';button.innerHTML='⌕ <span>搜索与切换</span><kbd>Ctrl K</kbd>';button.title='快速查找（Ctrl / ⌘ K）';top.prepend(button);
    }
    const config=environments[route];
    const differentiated=['exam','flowform','docmorph','adaptform','tablemind','labform'].includes(route);
    if(top&&differentiated&&!top.querySelector('[data-wui="options"]')){
      const tools=document.createElement('div');tools.className='wui-inline-tools';tools.innerHTML='<button type="button" data-wui="focus" aria-label="切换专注模式" title="专注模式">⛶</button><button type="button" data-wui="options" aria-label="界面选项" title="界面选项">☷</button>';top.append(tools);
    }
    if(differentiated&&!root.querySelector('.wui-focus-exit')){
      const exit=document.createElement('button');exit.className='wui-focus-exit';exit.type='button';exit.dataset.wui='focus';exit.setAttribute('aria-label','退出专注模式');exit.textContent='退出专注';root.append(exit);
    }
    if(config&&!differentiated&&!root.querySelector('.cp-studio')){
      const host=root.querySelector('.fp-root,.ec-pro,.ffp-root,.dmp-root,.afp-root,.tmp-root,.lfp-root,.cp-home')||root.querySelector('.main-shell > main');
      if(host&&!host.querySelector(':scope > .wui-context')){
        const bar=document.createElement('div');bar.className='wui-context';bar.dataset.wui='context';
        bar.innerHTML=`<div><i>${config[2]}</i><span><strong>${config[0]}</strong><small>${config[1]}</small></span></div><div><button type="button" data-wui="command" title="查找功能与项目"><span>⌕</span>快速查找</button>${route!=='appcanvas'?'<button type="button" data-wui="focus" aria-pressed="false">⛶ 专注模式</button>':''}<button type="button" data-wui="options">☷ 界面选项</button></div>`;
        const nav=host.querySelector(':scope > nav');if(nav)nav.after(bar);else host.prepend(bar);
      }
    }
    root.querySelectorAll('[data-wui="focus"]').forEach(button=>{
      const icon=focused?'⤢':'⛶',label=tr(focused?'退出专注模式':'专注模式');
      // 顶栏空间有限：内联工具始终保持纯图标，完整含义放在 title/aria-label 中。
      const text=button.closest('.wui-inline-tools')?icon:`${icon} ${label}`;
      if(button.textContent!==text)button.textContent=text;
      button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(focused));
    });
    panels.forEach(([selector,name])=>{
      root.querySelectorAll(selector).forEach(panel=>{
        if(!panel.querySelector(':scope > .wui-panel-toggle')){
          const button=document.createElement('button');button.className='wui-panel-toggle';button.type='button';button.dataset.wui='fold';button.dataset.panelSelector=selector;button.dataset.panelName=name;panel.classList.add('wui-foldable');panel.prepend(button);
          panelState(panel,selector,folded.has(route+selector));
        }
      });
    });
    root.querySelectorAll(tabs).forEach(nav=>{
      nav.classList.add('wui-segmented');nav.querySelectorAll(':scope > button').forEach(button=>button.setAttribute('aria-current',button.classList.contains('active')?'page':'false'));
    });
  }
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;update();});}
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-wui]');if(!button||getRoute()==='landing')return;
    if(button.dataset.wui==='command')openCommands();
    if(button.dataset.wui==='focus')focusMode(!focused);
    if(button.dataset.wui==='options')openOptions();
    if(button.dataset.wui==='fold'){const panel=button.parentElement;const change=()=>panelState(panel,button.dataset.panelSelector,!panel.classList.contains('wui-panel-folded'));if(event.detail>0)motion.panelChange(panel,change);else change();}
  });
  document.addEventListener('keydown',event=>{
    if(getRoute()==='landing'||event.isComposing)return;
    if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='k'){event.preventDefault();if(commandDialog?.open)commandDialog.close();else openCommands();}
    if(event.key==='Escape'&&focused&&!document.querySelector('dialog[open]')){event.preventDefault();focusMode(false);}
  });
  const draggable='[data-afp-drag],[data-tmp-drag-row],[data-cr-id]';
  root.addEventListener('dragstart',e=>e.target.closest(draggable)?.classList.add('wui-dragging'));
  root.addEventListener('dragover',e=>{const target=e.target.closest('[data-afp-drag],[data-tmp-drop-group]');root.querySelectorAll('.wui-drop-hint').forEach(el=>{if(el!==target)el.classList.remove('wui-drop-hint');});target?.classList.add('wui-drop-hint');});
  function cleanDrag(){root.querySelectorAll('.wui-dragging,.wui-drop-hint').forEach(el=>el.classList.remove('wui-dragging','wui-drop-hint'));}
  root.addEventListener('dragend',cleanDrag);root.addEventListener('drop',cleanDrag);schedule();
}
