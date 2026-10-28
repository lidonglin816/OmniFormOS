import {clone,uid,walk,find,remove,layouts,makeComponent} from './appcanvas-pro-model.js';

export const deviceWidths={desktop:1440,tablet:768,mobile:390};
export function fitZoom(available,device='desktop'){return Math.max(10,Math.min(100,Math.floor((available-48)/deviceWidths[device]*100)));}
export function duplicateGroups(components){const groups=new Map();walk(components,c=>{let key;if(c.type==='hero')key='hero:'+String(c.props?.headline||c.title).trim();if(c.type==='button'&&(!c.props?.action||c.props.action==='none'))key='button:unconfigured';if(!key)return;const g=groups.get(key)||{kind:c.type==='hero'?'相同标题横幅':'未配置操作的按钮',label:c.props?.headline||c.props?.label||c.title,ids:[]};g.ids.push(c.id);groups.set(key,g);});return [...groups.values()].filter(g=>g.ids.length>1);}
export function locate(items,id){for(const c of items){if(c.id===id)return{items,index:items.indexOf(c),component:c};const child=locate(c.children||[],id);if(child)return child;}return null;}
export function insertComponent(items,component,{targetId,position='after'}={}){const target=locate(items,targetId);if(!target){items.push(component);return;}if(position==='inside'&&layouts.includes(target.component.type)){target.component.children||=[];target.component.children.push(component);}else target.items.splice(target.index+(position==='after'?1:0),0,component);}
export function moveInto(items,id,placement){const c=find(items,id);if(!c||c.props?.locked)throw Error('组件不存在或已锁定');const target=find(items,placement.targetId);let cycle=false;walk([c],x=>{if(x.id===placement.targetId)cycle=true;});if(cycle)throw Error('不能将组件放入自身或子组件');if(target?.props?.locked)throw Error('目标组件已锁定');remove(items,id);insertComponent(items,c,placement);return c;}
export function organizePage(page){const before=clone(page.components);const eligible=c=>['stats','chart','table','workflow','exam','lab','kanban','calendar','timeline'].includes(c.type)&&!c.props?.locked;
const organize=items=>{const out=[];for(let i=0;i<items.length;){const c=items[i];if(eligible(c)&&eligible(items[i+1]||{})){const row=makeComponent('grid');row.title='业务内容分组';row.props.style={gap:'24px',gridTemplateColumns:'1fr 1fr'};row.props.responsive={mobile:{gridTemplateColumns:'1fr'}};row.children=[c,items[i+1]];out.push(row);i+=2;}else{if(c.children&&!c.props?.locked&&!['grid','columns'].includes(c.type))c.children=organize(c.children);out.push(c);i++;}}return out;};page.components=organize(page.components);page.layout={...page.layout,gap:24,padding:32};return{before,after:clone(page.components)};}
export function copySelection(items,ids){const selected=new Set(ids),result=[];const visit=(list,parentSelected=false)=>{for(const c of list){const own=selected.has(c.id);if(own&&!parentSelected)result.push(clone(c));visit(c.children||[],parentSelected||own);}};visit(items);return result;}

export function editorShortcut(event,{enabled=true,textEditing=false,modalOpen=false,hasSelection=false,actions={}}={}){
  if(!enabled||textEditing||modalOpen)return false;
  const mod=event.ctrlKey||event.metaKey,key=String(event.key).toLowerCase();let action;
  if(mod&&key==='z')action=event.shiftKey?'redo':'undo';
  else if(mod&&key==='y')action='redo';
  else if(mod&&key==='c'&&hasSelection)action='copy';
  else if(mod&&key==='v')action='paste';
  else if(mod&&key==='d'&&hasSelection)action='duplicate';
  else if(mod&&key==='s')action='save';
  else if(['delete','backspace'].includes(key)&&hasSelection)action='remove';
  else if(key==='escape')action='deselect';
  if(!action)return false;
  // Native copy must still emit a clipboard event so copying also works outside this tab.
  if(action!=='copy')event.preventDefault();
  actions[action]?.();return true;
}
