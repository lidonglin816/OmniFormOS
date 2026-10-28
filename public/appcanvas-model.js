const id = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
const component = (type, title, props = {}) => ({ id: id(), type, title, props });

export function seedAppCanvas() {
  const home = { id: id(), name: '首页', slug: 'home', access: '全部成员', components: [component('hero','欢迎横幅',{headline:'团队业务中心',description:'在一个工作空间查看数据、提交业务并推进协作。',button:'开始使用'}),component('stats','业务概览',{items:['应用 6','待办 3','本月记录 48']}),component('form','快捷申请',{binding:'费用报销'})] };
  const dashboard = { id: id(), name: '数据看板', slug: 'dashboard', access: '管理员与编辑者', components: [component('chart','活动趋势',{binding:'TableMind · 活动运营数据'}),component('table','最近记录',{binding:'TableMind · 活动运营数据'})] };
  const approval = { id: id(), name: '审批中心', slug: 'approval', access: '管理员与编辑者', components: [component('workflow','我的审批',{binding:'FlowForm · 差旅报销审批'})] };
  return { appName:'Omni 业务门户', activePageId:home.id, selectedComponentId:home.components[0].id, device:'desktop', theme:'violet', pages:[home,dashboard,approval], versions:[], publishedVersion:null, dirty:true };
}

export const componentCatalog = {
  hero:{label:'标题横幅',icon:'◫'},stats:{label:'指标卡片',icon:'▦'},form:{label:'业务表单',icon:'▤'},table:{label:'数据表格',icon:'▥'},chart:{label:'数据图表',icon:'⌁'},workflow:{label:'审批待办',icon:'⌘'},exam:{label:'考试模块',icon:'♧'},button:{label:'操作按钮',icon:'＋'}
};
export function activePage(state){ return state.pages.find(p=>p.id===state.activePageId) || state.pages[0]; }
export function addPage(state,name){ const clean=String(name).trim(); if(!clean)throw new Error('页面名称不能为空'); if(state.pages.some(p=>p.name===clean))throw new Error('页面名称已存在'); const page={id:id(),name:clean,slug:`page-${state.pages.length+1}`,access:'全部成员',components:[]};state.pages.push(page);state.activePageId=page.id;state.selectedComponentId=null;state.dirty=true;return page; }
export function addComponent(state,type,index){ if(!componentCatalog[type])throw new Error('未知组件类型');const page=activePage(state),item=component(type,componentCatalog[type].label, type==='hero'?{headline:'新的页面标题',description:'在属性面板中修改内容。',button:'了解更多'}:{binding:''});const at=Number.isInteger(index)?Math.max(0,Math.min(index,page.components.length)):page.components.length;page.components.splice(at,0,item);state.selectedComponentId=item.id;state.dirty=true;return item; }
export function moveComponent(state,componentId,direction){const page=activePage(state),from=page.components.findIndex(c=>c.id===componentId);if(from<0)throw new Error('组件不存在');const to=direction==='up'?from-1:from+1;if(to<0||to>=page.components.length)return false;[page.components[from],page.components[to]]=[page.components[to],page.components[from]];state.dirty=true;return true;}
export function updateComponent(state,componentId,patch){const page=activePage(state),item=page.components.find(c=>c.id===componentId);if(!item)throw new Error('组件不存在');if(patch.title!==undefined&&!String(patch.title).trim())throw new Error('组件标题不能为空');Object.assign(item,{...patch,props:{...item.props,...(patch.props||{})}});state.dirty=true;return item;}
export function validateCanvas(state){if(!state.pages.length)return '至少需要一个页面';for(const page of state.pages){if(!page.name.trim())return '页面名称不能为空';if(!page.components.length)return `页面「${page.name}」还没有组件`;const ids=page.components.map(c=>c.id);if(new Set(ids).size!==ids.length)return '组件 ID 不能重复';}return '';}
export function publishCanvas(state,note=''){const error=validateCanvas(state);if(error)throw new Error(error);const version={id:id(),number:state.versions.length+1,note:String(note).trim()||`发布版本 ${state.versions.length+1}`,at:new Date().toISOString(),snapshot:{appName:state.appName,theme:state.theme,pages:structuredClone(state.pages)}};state.versions.unshift(version);state.publishedVersion=version.number;state.dirty=false;return version;}
export function rollbackCanvas(state,number){const version=state.versions.find(v=>v.number===Number(number));if(!version)throw new Error('发布版本不存在');state.appName=version.snapshot.appName;state.theme=version.snapshot.theme;state.pages=structuredClone(version.snapshot.pages);state.activePageId=state.pages[0].id;state.selectedComponentId=state.pages[0].components[0]?.id||null;state.publishedVersion=version.number;state.dirty=false;return version;}

