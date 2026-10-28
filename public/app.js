import {installWorkspaceStatus} from './workspace-status.js';
import { uid, makeApp, generateApp, validateRecord } from './model.js';
import { createFormPilot } from './formpilot3.js';
import { ensureBlueprint, removeRecord } from './formpilot-model.js';
import { seedExamCraft } from './examcraft-model.js';
import { createExamCraft } from './examcraft-pro.js';
import { seedFlowForm, publishFlow, startRun } from './flowform-model.js';
import { createFlowForm } from './flowform3.js';
import { createDocMorph } from './docmorph-pro.js';
import { makeDocument, segmentsFromText } from './docmorph-model.js';
import { seedDocMorph } from './docmorph-model.js';
import { createAdaptForm } from './adaptform-pro.js';
import { seedAdaptForm } from './adaptform-model.js';
import { createTableMind } from './tablemind-pro.js';
import { seedTableMind } from './tablemind-model.js';
import { createLabForm } from './labform-pro.js';
import { seedLabForm } from './labform-model.js';
import { createAppCanvas } from './appcanvas.js';
import { seedAppCanvas, addPage, addComponent } from './appcanvas-model.js';
import { standardFieldTypes, renderFieldControls, valuesFromForm } from './field-rules.js';
import { installWorkspaceUI } from './workspace-ui.js';
import { installHeroMascot } from './hero-mascot.js';
import { installLandingKeys } from './landing-keys.js';
import {desktopHome,installDesktopHome} from './desktop-home.js';
import {installGlobalI18n,getLang} from './omni-i18n.js?v=20261027c';
if(window.omniDesktop?.isDesktop)installDesktopHome();

const icons = { appcanvas: '▣', labform: '⚗', tablemind: '▦', adaptform: '⌁', docmorph: '▧', flowform: '⌘', exam: '♧', pilot: '✦' };
const nav = [['pilot', 'FormPilot'], ['exam', 'ExamCraft'], ['flowform', 'FlowForm'], ['docmorph', 'DocMorph'], ['adaptform', 'AdaptForm'], ['tablemind', 'TableMind'], ['labform', 'LabForm'], ['appcanvas', 'AppCanvas']];
const primaryNav = [['home', '工作台', '◈'], ['studio', 'AI 创作中心', '✦'], ['apps', '应用管理', '▦']];
const internalRoutes = [['landing', '首页'], ['studio', 'AI 创作中心'], ['home', '工作台'], ['apps', '应用管理'], ['form', '应用编辑'], ['data', '数据管理'], ['page', '页面搭建'], ['flow', '工作流'], ['ai', 'AI 助手'], ['link', '集成中心'], ['team', '成员与权限']];
const routes = [...nav, ...internalRoutes];
const moduleMeta = {
  pilot: ['业务系统生成', '从自然语言生成应用蓝图、数据实体与业务页面。', '应用入口'],
  exam: ['智能考试测评', '创建题库、试卷和评分规则，并嵌入业务应用。', '人才与培训'],
  flowform: ['审批与自动化', '编排条件分支、审批人、通知和执行记录。', '流程引擎'],
  docmorph: ['文档数字化', '把 PDF、Word、Excel 和扫描件转成结构化表单。', '内容入口'],
  adaptform: ['自适应表单', '让字段、页面和审批路径随填写内容动态变化。', '交互引擎'],
  tablemind: ['数据应用与多视图', '统一管理业务数据，并生成网格、看板和图表。', '数据中枢'],
  labform: ['科研实验管理', '记录实验数据、公式计算、版本和研究报告。', '行业场景'],
  appcanvas: ['多页面应用构建', '组合表单、数据、流程和测评，发布完整 Web 应用。', '发布出口']
};
const key = 'omniformos.v1';
const seed = () => ({ apps: [makeApp('客户关系管理', '统一管理客户资料，让每一次跟进都有迹可循。', 'customer'), makeApp('费用报销', '从费用提交到审批处理，让财务协作井井有条。', 'expense'), makeApp('项目任务管理', '连接项目、任务与团队，推进每一个重要目标。')], members: [{ id: uid(), name: '本地体验用户', role: '管理员' }], activity: [] });
let state;
let storageWarning = false;
let legacyExamAvailable = false;
try { const stored = JSON.parse(localStorage.getItem(key)); legacyExamAvailable=!!stored?.examcraft&&!stored.examcraft.serverBacked; state = stored && Array.isArray(stored.apps) && Array.isArray(stored.members) && Array.isArray(stored.activity) ? stored : seed(); } catch { state = seed(); storageWarning = true; }
let route = 'home', activeId = state.apps[0]?.id, filter = '', recordFilter = '';
const root = document.querySelector('#app');
// Observe the complete desktop interface, not only #app: sidebar, top bar,
// window controls and module portals are mounted outside the app root.
installGlobalI18n(document.body);
const dialog = document.querySelector('#modal');
installWorkspaceStatus(root);
try{await fetch('/api/workspace/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}catch{}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const current = () => state.apps.find(a => a.id === activeId);
const date = value => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3500); }
function save() { try { const snapshot=state.examcraft?.serverBacked?{...state,examcraft:{version:2,serverBacked:true,questions:[],sources:[],papers:[],attempts:[],drafts:{},exams:[],audit:[]}}:state;localStorage.setItem(key, JSON.stringify(snapshot)); return true; } catch { toast('本地保存失败：浏览器存储不可用或空间已满，请导出备份。'); return false; } }
function activity(text) { state.activity.unshift({ id: uid(), text, at: new Date().toISOString() }); state.activity = state.activity.slice(0, 30); save(); }
function openModal(content) { dialog.innerHTML = `<div class="modal-head"><span class="eyebrow">OMNIFORMOS STUDIO</span><button class="icon-button" data-action="close" aria-label="关闭弹窗">×</button></div>${content}`; dialog.showModal(); }
function pill(text, cls = '') { return `<span class="pill ${cls}">${escape(text)}</span>`; }
function empty(title, detail, action = '') { return `<div class="empty"><div>◇</div><h3>${title}</h3><p>${detail}</p>${action}</div>`; }
function appSelect() { return `<label class="app-select">当前应用 <select id="app-select" aria-label="选择当前应用">${state.apps.map(a => `<option value="${a.id}" ${a.id === activeId ? 'selected' : ''}>${escape(a.name)}</option>`).join('')}</select></label>`; }
const pilot = createFormPilot({
  apps: () => state.apps, current, select: id => { activeId = id; },
  add: a => { state.apps.unshift(a); activeId = a.id; },
  remove: id => { state.apps = state.apps.filter(a => a.id !== id); activeId = state.apps[0]?.id; },
  commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close(),
  openModule: id => go(id)
});
state.examcraft ||= seedExamCraft();
const examcraft = createExamCraft({
  store: () => state.examcraft, apps: () => state.apps,
  legacyAvailable: () => legacyExamAvailable && !state.examcraft.serverBacked,
  documents: () => state.docmorph?.documents || [],
  integrate: (module, paper, attempts) => {
    if (!paper) throw new Error('请先打开一份试卷');
    if (module === 'tablemind') {
      if (!attempts.length) throw new Error('此试卷暂无已完成评分的真实成绩');
      tablemind.ingest?.({sourceKey:`examcraft:${paper.id}`,name:`ExamCraft · ${paper.name}`,source:{module:'ExamCraft',key:`examcraft:${paper.id}`},fields:[{id:'examName',name:'考试名称',type:'text'},{id:'studentId',name:'考生编号',type:'text'},{id:'score',name:'考试得分',type:'number'},{id:'maxScore',name:'试卷满分',type:'number'},{id:'passResult',name:'考试结果',type:'select'}],records:attempts.map(a=>({id:`exam-${a.id}`,examName:paper.name,studentId:a.studentId||'',score:a.total,maxScore:a.paper.items.reduce((n,i)=>n+i.question.points,0),passResult:a.passed?'已通过':'未通过'}))}).catch(error=>toast(error.message));
    }
    if (module === 'appcanvas') {
      let page=state.appcanvas.pages.find(p=>p.examPaperId===paper.id);
      if (!page) { page=addPage(state.appcanvas,`测评 · ${paper.name}`.slice(0,40));page.examPaperId=paper.id;const item=addComponent(state.appcanvas,'exam');item.title=paper.name;item.props={binding:`ExamCraft · ${paper.name}`,paperId:paper.id}; }
      state.appcanvas.activePageId=page.id;state.appcanvas.dirty=true;
    }
    if (module === 'flowform') {
      const passed=attempts.filter(a=>a.passed);
      if(!passed.length)throw new Error('此试卷暂无已通过且完成复核的答卷');
      let flow=state.flowform.definitions.find(f=>f.examPaperId===paper.id);
      if(!flow){const stamp=new Date().toISOString();flow={id:uid(),name:`考核通过确认 · ${paper.name}`,examPaperId:paper.id,description:'ExamCraft 完成评分且通过考核后，提交主管确认并通知考生。',revision:1,status:'draft',createdAt:stamp,actors:[{id:'applicant',name:'考生'},{id:'manager',name:'培训主管'}],field:'amount',nodes:[{id:'start',type:'start',label:'考核通过',position:{x:300,y:40},config:{}},{id:'manager',type:'approval',label:'培训主管确认',position:{x:300,y:190},config:{assignee:'manager'}},{id:'notify',type:'notify',label:'通知考生',position:{x:300,y:340},config:{recipient:'applicant',message:'培训考核通过与审批确认已完成。'}},{id:'end',type:'end',label:'完成',position:{x:300,y:490},config:{}}],edges:[['start','manager'],['manager','notify'],['notify','end']].map(([source,target])=>({id:uid(),source,target,port:'next'}))};publishFlow(flow);state.flowform.definitions.unshift(flow);}
      for(const a of passed)if(!state.flowform.runs.some(r=>r.examAttemptId===a.id)){const run=startRun(flow,{title:`${a.name} · 考核通过确认`.slice(0,100),reason:`ExamCraft 答卷 ${a.id}，成绩 ${a.total} 分`});run.examAttemptId=a.id;run.examPaperId=paper.id;state.flowform.runs.unshift(run);}
    }
  },
  commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close(),
  embed: (id, paper) => {
    const a = state.apps.find(a => a.id === id); if (!a) throw new Error('应用已不存在');
    const b = ensureBlueprint(a); b.assessments ||= [];
    if (b.assessments.some(item => item.paperId === paper.id)) return;
    b.assessments.push({ paperId: paper.id, name: paper.name }); b.version++;
    b.history.unshift({ id: uid(), text: `嵌入测评「${paper.name}」`, at: new Date().toISOString() });
  }
});
state.flowform ||= seedFlowForm();
const flowform = createFlowForm({documents:()=>state.docmorph?.documents||[], store: () => state.flowform, commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close() });
state.docmorph ||= seedDocMorph();
const docmorph = createDocMorph({ store: () => state.docmorph, commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close(), addApp: a => state.apps.unshift(a), hasApp: id => state.apps.some(a => a.id === id), openApp: id => { activeId = id; go('form'); }, integrate: async (module, document, form, records) => {
  if (!document?.fields?.length) throw new Error('请先识别文档字段');
  const link={documentId:document.id,documentRevision:document.revision,formId:form?.id||null,fieldIds:document.fields.map(f=>f.id),linkedAt:new Date().toISOString()};
  if(module==='adaptform'){state.adaptform.linkedForms||=[];state.adaptform.linkedForms.unshift({...link,name:document.name,conditions:document.fields.filter(f=>f.condition).map(f=>({fieldId:f.id,...f.condition}))});}
  if(module==='tablemind'){await tablemind.ingest?.({sourceKey:`docmorph:${document.id}`,name:`DocMorph · ${document.name}`,source:{module:'DocMorph',key:`docmorph:${document.id}`},fields:document.fields.map(f=>({id:`doc_${f.id}`,name:f.label,type:f.type})),records:(records||[]).map(r=>({id:`doc-${r.id}`,...Object.fromEntries(document.fields.map(f=>[`doc_${f.id}`,r.values[f.id]])),status:r.status,submittedAt:r.submittedAt}))});}
  if(module==='flowform'){let flow=state.flowform.definitions.find(f=>f.documentId===document.id);if(!flow){const stamp=new Date().toISOString();flow={id:uid(),name:`${document.name.replace(/\.[^.]+$/,'')}·表单审批`,documentId:document.id,description:'DocMorph 数字表单提交后启动人工审批。',revision:1,status:'draft',createdAt:stamp,actors:[{id:'applicant',name:'填写人'},{id:'manager',name:'审批人'}],nodes:[{id:'start',type:'start',label:'表单提交',position:{x:300,y:40},config:{}},{id:'manager',type:'approval',label:'人工复核',position:{x:300,y:190},config:{assignee:'manager'}},{id:'end',type:'end',label:'完成',position:{x:300,y:340},config:{}}],edges:[['start','manager'],['manager','end']].map(([source,target])=>({id:uid(),source,target,port:'next'}))};state.flowform.definitions.unshift(flow);}}
  if(module==='labform'){state.labform.importedSchemas||=[];if(!state.labform.importedSchemas.some(x=>x.documentId===document.id))state.labform.importedSchemas.unshift({...link,name:document.name,fields:structuredClone(document.fields)});}
  if(module==='appcanvas'){let page=state.appcanvas.pages.find(p=>p.documentId===document.id);if(!page){page=addPage(state.appcanvas,`表单 · ${document.name.replace(/\.[^.]+$/,'')}`.slice(0,40));page.documentId=document.id;const item=addComponent(state.appcanvas,'form');item.title=document.name.replace(/\.[^.]+$/,'');item.props={binding:`DocMorph · ${document.name}`,documentId:document.id,formId:form?.id||null};}state.appcanvas.activePageId=page.id;state.appcanvas.dirty=true;}
} });
state.adaptform ||= seedAdaptForm();
const adaptform = createAdaptForm({ store: () => state.adaptform, commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close(), integrate: async (module, form, records) => {
  if (module === 'formpilot') { const app = makeApp(form.name, form.description || '由 AdaptForm 生成的动态业务应用'); const blueprint=ensureBlueprint(app); blueprint.forms=[{formId:form.id,name:form.name,version:form.version}]; state.apps.unshift(app); activeId=app.id; }
  if (module === 'flowform') { let flow=state.flowform.definitions.find(x=>x.adaptFormId===form.id); if(!flow){const stamp=new Date().toISOString();flow={id:uid(),name:`${form.name} · 提交审批`,adaptFormId:form.id,description:'AdaptForm 提交后进入审批并通知申请人。',revision:1,status:'draft',createdAt:stamp,actors:[{id:'applicant',name:'申请人'},{id:'manager',name:'审批人'}],nodes:[{id:'start',type:'start',label:'表单提交',position:{x:300,y:40},config:{}},{id:'manager',type:'approval',label:'负责人审批',position:{x:300,y:190},config:{assignee:'manager'}},{id:'notify',type:'notify',label:'通知申请人',position:{x:300,y:340},config:{recipient:'applicant',message:'审批已完成'}},{id:'end',type:'end',label:'完成',position:{x:300,y:490},config:{}}],edges:[['start','manager'],['manager','notify'],['notify','end']].map(([source,target])=>({id:uid(),source,target,port:'next'}))};state.flowform.definitions.unshift(flow);} }
  if (module === 'tablemind') { await tablemind.ingest?.({sourceKey:`adaptform:${form.id}`,name:`AdaptForm · ${form.name}`,source:{module:'AdaptForm',key:`adaptform:${form.id}`},fields:form.fields.map(f=>({id:`adapt_${f.id}`,name:f.label,type:['number','date','select'].includes(f.type)?f.type:'text'})),records:records.map(r=>({id:`adapt-${r.id}`,...Object.fromEntries(form.fields.map(f=>[`adapt_${f.id}`,r.values[f.id]])),submittedAt:r.submittedAt}))}); }
  if (module === 'labform') { state.labform.importedSchemas ||= []; if(!state.labform.importedSchemas.some(x=>x.adaptFormId===form.id))state.labform.importedSchemas.unshift({adaptFormId:form.id,name:form.name,fields:structuredClone(form.fields),linkedAt:new Date().toISOString()}); }
  if (module === 'appcanvas') { let page=state.appcanvas.pages.find(p=>p.adaptFormId===form.id);if(!page){page=addPage(state.appcanvas,`表单 · ${form.name}`.slice(0,40));page.adaptFormId=form.id;const item=addComponent(state.appcanvas,'form');item.title=form.name;item.props={binding:`AdaptForm · ${form.name}`,adaptFormId:form.id};}state.appcanvas.activePageId=page.id;state.appcanvas.dirty=true; }
  save();
} });
state.tablemind ||= seedTableMind();
async function collectTableSources(){
  const sources=[];
  const add=(sourceKey,name,fields,records,source)=>{if(fields?.length)sources.push({sourceKey,name,description:`由 ${source} 同步，保留来源标识并可重复更新。`,source:{module:source,key:sourceKey},fields:fields.map((f,i)=>({id:f.id||`field_${i}`,name:f.name||f.label||`字段 ${i+1}`,type:['number','date','boolean','select'].includes(f.type)?f.type:'text',required:!!f.required,unique:!!f.unique,options:f.options||[]})),records:(records||[]).map((r,i)=>({id:r.id||`${sourceKey}_${i}`,...(r.values||r)}))});};
  for(const app of state.apps||[])for(const entity of app.blueprint?.entities?.length?app.blueprint.entities:[{id:app.id,name:app.name,fields:app.fields,records:app.records}])add(`formpilot:${app.id}:${entity.id}`,`${app.name} · ${entity.name}`,entity.fields,entity.records||app.records||[], 'FormPilot');
  const requests=await Promise.allSettled(['/api/exam/state','/api/flow/state','/api/doc/state','/api/adapt/state'].map(url=>fetch(url).then(async r=>r.ok?(await r.json()).state:null)));
  const [exam,flow,doc,adapt]=requests.map(x=>x.status==='fulfilled'?x.value:null);
  if(exam?.attempts?.length)add('examcraft:results','ExamCraft · 考试成绩',[{id:'exam',name:'考试',type:'text'},{id:'student',name:'考生',type:'text'},{id:'score',name:'得分',type:'number'},{id:'passed',name:'是否通过',type:'select',options:['是','否']},{id:'submittedAt',name:'提交时间',type:'date'}],exam.attempts.map(a=>({id:a.id,exam:exam.papers?.find(p=>p.id===a.paperId)?.name||a.paperId,student:a.name||a.studentId,score:a.total,passed:a.passed?'是':'否',submittedAt:a.submittedAt})),'ExamCraft');
  if(flow?.runs?.length)add('flowform:runs','FlowForm · 流程运行记录',[{id:'flow',name:'流程',type:'text'},{id:'applicant',name:'申请人',type:'text'},{id:'status',name:'状态',type:'select'},{id:'startedAt',name:'发起时间',type:'date'}],flow.runs.map(r=>({id:r.id,flow:flow.definitions?.find(f=>f.id===r.flowId)?.name||r.flowId,applicant:r.applicant||r.applicationId||'',status:r.status,startedAt:r.startedAt||r.createdAt})),'FlowForm');
  for(const form of doc?.forms||[])add(`docmorph:${form.id}`,`DocMorph · ${form.name}`,form.fields,(doc.records||[]).filter(r=>r.formId===form.id).map(r=>({id:r.id,...r.values,status:r.status,submittedAt:r.submittedAt})),'DocMorph');
  for(const form of adapt?.forms||[])add(`adaptform:${form.id}`,`AdaptForm · ${form.name}`,form.fields,(adapt.records||[]).filter(r=>r.formId===form.id).map(r=>({id:r.id,...r.values,submittedAt:r.submittedAt})),'AdaptForm');
  const labSnapshot=await fetch('/api/lab/state').then(r=>r.ok?r.json():null).catch(()=>null);for(const project of labSnapshot?.state.projects||[]){let records=project.result?.rows||project.rows;add(`labform:${project.id}`,`LabForm · ${project.name}`,project.fields.map(f=>({...f,name:f.label+(f.unit?' ('+f.unit+')':''),type:f.type==='calculated'?'number':f.type})),records.map(r=>({id:r.id,...r.values})),'LabForm');}
  return sources;
}
const tablemind = createTableMind({ store: () => state.tablemind, commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close(), download, sources:collectTableSources, embed:(table,view,publication)=>{state.appcanvas ||= seedAppCanvas();let page=state.appcanvas.pages.find(p=>p.tableMindTableId===table.id);if(!page){page=addPage(state.appcanvas,`数据 · ${table.name}`.slice(0,40));page.tableMindTableId=table.id;const chart=addComponent(state.appcanvas,'chart');chart.title=view?.name||`${table.name} 图表`;chart.props={binding:`TableMind · ${table.name}`,tableId:table.id,viewId:view?.id||null,shareToken:publication?.token||null};const grid=addComponent(state.appcanvas,'table');grid.title=`${table.name} 数据`;grid.props={binding:`TableMind · ${table.name}`,tableId:table.id,viewId:view?.id||null,shareToken:publication?.token||null};}state.appcanvas.activePageId=page.id;state.appcanvas.dirty=true;save();route='appcanvas';location.hash='appcanvas';render();} });
state.labform ||= seedLabForm();
const labform = createLabForm({ store: () => state.labform, commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close(), download,integrate:async(module,project,result)=>{
  const link={projectId:project.id,sourceModule:'LabForm',sourceRevision:project.updatedAt,linkedAt:new Date().toISOString()};
  if(module==='tablemind'||module==='appcanvas'){if(result?.error)throw new Error(result.error);const dataset={sourceKey:`labform:${project.id}`,name:`LabForm · ${project.name}`,source:{module:'LabForm',key:`labform:${project.id}`,...link},fields:project.fields.map(f=>({id:f.id,name:f.label+(f.unit?` (${f.unit})`:''),type:['number','calculated'].includes(f.type)?'number':'text'})),records:(result?.rows||project.rows).map(r=>({id:r.id,...r.values}))};const synced=await tablemind.ingest(dataset);if(module==='appcanvas'){const table=synced.result[0],view={id:uid(),tableId:table.id,name:project.name+' · 实验数据',type:'grid',filters:[],sorts:[]};const response=await fetch('/api/tablemind/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({view})});if(!response.ok)throw new Error('保存实验视图失败');state.appcanvas||=seedAppCanvas();const page=addPage(state.appcanvas,('实验 · '+project.name).slice(0,40)),component=addComponent(state.appcanvas,'table');component.title=project.name;component.props={binding:'LabForm · '+project.name,tableId:table.id,viewId:view.id,...link};page.labProjectId=project.id;state.appcanvas.dirty=true;} }
  if(module==='pilot'){const app=makeApp(project.name+'实验管理',project.purpose||'实验教学与数据记录');app.labProjectId=project.id;app.fields=project.fields.filter(f=>f.type!=='calculated').map(f=>({id:f.id,label:f.label,type:f.type,required:f.required}));app.records=project.rows.map(r=>({id:r.id,...r.values}));state.apps.unshift(app);activeId=app.id;}
  if(module==='docmorph'){const text=[project.purpose,project.principle,project.protocol,...project.fields.map(f=>f.label+' ('+f.unit+')：________')].filter(Boolean).join('\n');const document=makeDocument(project.name+' · 实验指导书','text',segmentsFromText(text));document.labSource=link;state.docmorph.documents.unshift(document);}
  if(module==='adaptform'){const form={id:uid(),name:project.name+' · 实验采集',description:project.purpose,steps:[{id:'main',name:'实验测量'}],fields:project.fields.filter(f=>f.type!=='calculated').map(f=>({id:f.id,label:f.label+(f.unit?' ('+f.unit+')':''),type:f.type==='number'?'number':'text',stepId:'main',required:!!f.required,rules:{}})),rules:[],status:'draft',version:1,history:[],access:'public',hiddenPolicy:'clear',source:link};const response=await fetch('/api/adapt/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({form})});if(!response.ok)throw new Error((await response.json()).error);}
  if(module==='flowform'){const flow={id:uid(),name:project.name+' · 报告审核',description:'实验报告完成后由指导教师审核。',...link,revision:1,status:'draft',createdAt:new Date().toISOString(),actors:[{id:'applicant',name:'实验人员'},{id:'teacher',name:'指导教师'}],nodes:[{id:'start',type:'start',label:'提交实验报告',position:{x:300,y:40},config:{}},{id:'teacher',type:'approval',label:'教师审核',position:{x:300,y:190},config:{assignee:'teacher'}},{id:'end',type:'end',label:'完成归档',position:{x:300,y:340},config:{}}],edges:[['start','teacher'],['teacher','end']].map(([source,target])=>({id:uid(),source,target,port:'next'}))};const response=await fetch('/api/flow/state');if(!response.ok)throw new Error('无法读取工作流');const saved=await response.json();saved.state.definitions.unshift(flow);const updated=await fetch('/api/flow/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:saved.state,revision:saved.state.contentRevision,message:'从 LabForm 创建报告审核',flowId:flow.id})});if(!updated.ok)throw new Error((await updated.json()).error);state.flowform=(await updated.json()).state;}
  if(module==='exam'){const response=await fetch('/api/exam/state');if(!response.ok)throw new Error('请先登录 ExamCraft 教师工作区，再从 LabForm 关联实验资料');const snapshot=await response.json(),text=[project.purpose,project.principle,project.protocol].filter(Boolean).join('\n');if(!text.trim())throw new Error('请先补充实验目的、原理或步骤作为出题依据');snapshot.state.sources.unshift({id:uid(),name:project.name+' · 实验预习资料',text,kind:'text',createdAt:new Date().toISOString(),...link});const updated=await fetch('/api/exam/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot.state,revision:snapshot.state.contentRevision||0,message:'LabForm 关联实验预习资料'})});if(!updated.ok)throw new Error((await updated.json()).error);state.examcraft=(await updated.json()).state;}
  save();location.hash=module;route=module;render();if(['flowform','exam','adaptform','docmorph'].includes(module))location.reload();
} });
state.appcanvas ||= seedAppCanvas();
const appcanvas = createAppCanvas({ store: () => state.appcanvas, apps: () => state.apps, tablemind:()=>tablemind.snapshot?.(), commit: activity, persist: save, render, escape, toast, modal: openModal, closeModal: () => dialog.close() });
function brandMarkup() { return `<span class="brand-mark">O<span>✦</span></span><div>OmniForm<span>OS</span><small>AI NATIVE WORKSPACE</small></div>`; }
function engineGallery() {
  const colors = ['iris','rose','lime','sky','peach','mint','blue','gold'];
  return `<div class="engine-gallery" aria-label="选择 AI 创作引擎">${nav.map(([id,name],i)=>`<button class="engine-object tone-${colors[i]}" data-route="${id}" style="--slot:${i};--tilt:${[-12,-9,-6,-2,2,6,9,12][i]}deg;--lift:${[30,12,0,-9,-9,0,12,30][i]}px" aria-label="打开 ${name}：${moduleMeta[id][0]}"><span class="engine-object-top"><b>${String(i+1).padStart(2,'0')}</b><i>↗</i></span><strong>${name}</strong><small>${moduleMeta[id][0]}</small><span class="engine-sculpture sculpture-${i}" aria-hidden="true"><i></i><b>${icons[id]}</b><em></em></span><span class="engine-object-bottom">${moduleMeta[id][2]}<i>OPEN ENGINE</i></span></button>`).join('')}</div>`;
}
function landingView() {
  if(window.omniDesktop?.isDesktop)return desktopHome({apps:state.apps,escape});
  const modules = nav.map(([id, name], index) => { const [title, description, role] = moduleMeta[id]; return `<button class="landing-module" data-route="${id}"><span class="landing-module-number">0${index + 1}</span><span class="nav-icon">${icons[id]}</span><span><b>${name}</b><small>${title}</small></span><p>${description}</p><em>${role} →</em></button>`; }).join('');
  const templates = [['customer', '客户关系管理', '客户建档、跟进与销售协作', '◈'], ['expense', '智能费用报销', '动态表单、审批与财务数据', '▣'], ['general', '项目任务中心', '任务收集、状态看板与协同', '⌘']].map(([id, name, desc, icon]) => `<button class="landing-template" data-template="${id}"><span>${icon}</span><div><b>${name}</b><small>${desc}</small></div><em>使用模板 ↗</em></button>`).join('');
  return `<div class="landing-shell"><header class="landing-header"><a href="#landing" class="brand" aria-label="OmniFormOS 首页">${brandMarkup()}</a><nav><a href="#capabilities">创作流程</a><a href="#modules">八大引擎</a><a href="#templates">应用模板</a></nav><div><button class="landing-quiet" data-route="home">我的工作台</button><button class="landing-primary" data-route="studio">开始创作 ↗</button></div></header><main class="landing-main"><section class="landing-hero"><div class="landing-hero-copy"><div class="landing-badge"><i></i> OMNIFORM OS / CREATIVE INTELLIGENCE</div><h1>让想法，<br><span>拥有自己的形状。</span></h1><p>从一句需求，到一个真正运行的应用。<br>八个专业引擎，连接你的整个业务世界。</p><a class="landing-discover" href="#modules">探索八大创作引擎 <span>↓</span></a></div><div class="landing-composer-wrap"><div class="composer-index"><span>01 / START WITH AN IDEA</span><span>✦</span></div><form id="generate-form" class="landing-prompt"><label for="prompt">你想构建什么？</label><textarea id="prompt" name="prompt" required maxlength="1000" aria-label="描述你想构建的应用" placeholder="例如：为团队创建一个带审批流程、数据看板的项目管理应用……"></textarea><div><span>需求 → 蓝图 → 应用</span><button type="submit">开始构建 <b>↗</b></button></div></form><div class="landing-suggestions">${['客户管理与销售跟进','员工培训考试','费用报销审批','实验数据管理'].map(s=>`<button data-prompt="${s}">${s} ↗</button>`).join('')}</div></div></section><section class="landing-gallery-stage" aria-label="八大引擎快捷入口"><div class="gallery-caption"><span>EIGHT ENGINES. ENDLESS POSSIBILITIES.</span><span>选择你的起点 ↗</span></div>${engineGallery()}<div class="gallery-baseline"><span>BUILD · CONNECT · PUBLISH</span><span>01 — 08 / OMNIFORM COLLECTION</span></div></section><section class="landing-proof" id="capabilities"><span>01 需求理解</span><i>→</i><span>02 结构化生成</span><i>→</i><span>03 可视化编辑</span><i>→</i><span>04 自动化运行</span><i>→</i><span>05 发布使用</span></section><section class="landing-section" id="modules"><div class="landing-section-head"><div><small>THE ENGINE COLLECTION</small><h2>各有所长，彼此相连。</h2><p>从创作到交付，每个引擎都在同一个工作空间中协作。</p></div><button data-route="studio">打开 AI 创作中心 ↗</button></div><div class="landing-modules">${modules}</div></section><section class="landing-section" id="templates"><div class="landing-section-head"><div><small>A HEAD START FOR YOUR NEXT IDEA</small><h2>好想法，从不必从零开始。</h2><p>选择业务模板，带着成熟结构进入编辑。</p></div><button data-route="apps">我的应用 ↗</button></div><div class="landing-templates">${templates}</div></section><section class="landing-cta"><div><small>MAKE IT YOURS.</small><h2>下一个好用的应用，由你定义。</h2></div><button data-route="studio">开始创建 ↗</button></section></main><footer class="landing-footer"><a href="#landing" class="brand">${brandMarkup()}</a><p>AI 原生应用创作与业务自动化平台</p><span>从想法到应用 · OmniForm OS</span></footer></div>`;
}
function render() {
  flowform.beforeRender();
  document.title = route === 'landing' ? 'OmniForm OS · AI 原生业务应用平台' : route === 'exam' ? 'ExamCraft · OmniFormOS 智能考试与测评工厂' : route === 'pilot' ? 'FormPilot · OmniFormOS 业务系统生成中心' : 'OmniFormOS · 智能应用工作台';
  root.classList.toggle('landing-mode', route === 'landing');
  root.dataset.platformRoute = route;
  root.classList.toggle('pilot-mode', route === 'pilot');
  root.classList.toggle('exam-mode', route === 'exam');
  root.classList.toggle('flowform-mode', route === 'flowform');
  root.classList.toggle('docmorph-mode', route === 'docmorph');
  root.classList.toggle('adaptform-mode', route === 'adaptform');
  root.classList.toggle('tablemind-mode', route === 'tablemind');
  root.classList.toggle('labform-mode', route === 'labform');
  root.classList.toggle('appcanvas-mode', route === 'appcanvas');
  if (route === 'docmorph') document.title = 'DocMorph · OmniFormOS 智能文档数字化';
  if (route === 'flowform') document.title = 'FlowForm · OmniFormOS 审批与工作流';
  if (route === 'adaptform') document.title = 'AdaptForm · OmniFormOS 自适应智能表单';
  if (route === 'tablemind') document.title = 'TableMind · OmniFormOS 智能数据应用';
  if (route === 'labform') document.title = 'LabForm · OmniFormOS 科研实验管理';
  if (route === 'appcanvas') document.title = 'AppCanvas · OmniFormOS 多页面应用构建器';
  if (route === 'landing') { root.innerHTML = landingView(); return; }
  const title = routes.find(n => n[0] === route)?.[1] || 'FormPilot';
  root.innerHTML = `<aside class="sidebar"><a href="#landing" class="brand" aria-label="OmniFormOS 首页">${brandMarkup()}</a><div class="workspace"><span class="workspace-avatar">O</span><div>我的工作空间<small>${state.apps.length} 个应用 · 个人版</small></div><span class="workspace-chevron">⌄</span></div><div class="nav-label">平台</div><nav class="primary-nav">${primaryNav.map(([id, label, icon]) => `<button class="nav-item ${route === id ? 'active' : ''}" data-route="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</nav><div class="nav-label module-label">创作工具</div><nav class="module-nav">${nav.map(([id, label]) => `<button class="nav-item ${route === id ? 'active' : ''}" data-route="${id}" title="${moduleMeta[id][0]}"><span class="nav-icon">${icons[id]}</span>${label}</button>`).join('')}</nav></aside><div class="main-shell"><header class="topbar"><div class="breadcrumb"><button data-route="landing">OmniForm OS</button><span>/</span><strong>${title}</strong></div><div class="top-actions"><button class="top-center-link" data-route="studio">✦ AI 创作中心</button><span class="local-indicator"><i></i> ${route==='exam'?'测评工作区':'本机工作区 · 保存状态见模块'}</span><a class="workspace-data-link" href="/workspace-data.html?module=${({flowform:'flow',docmorph:'doc',adaptform:'adapt',tablemind:'table',labform:'lab',appcanvas:'canvas'})[route]||route}" target="_blank" rel="noopener">测试与数据管理</a><button class="icon-button" data-action="export" aria-label="导出工作空间备份" title="导出工作空间备份">⇩</button><span class="avatar small">L</span></div></header><main><div class="page-head"><div><div class="eyebrow">${route === 'home' ? 'WORKSPACE OVERVIEW' : route === 'studio' ? 'AI CREATION CENTER' : 'BUILD YOUR NEXT POSSIBILITY.'}</div><h1>${title}<span class="heading-dot">.</span></h1><p>${route === 'home' ? '集中管理应用、数据与最近活动。' : route === 'studio' ? '从业务目标出发，选择合适的 AI 引擎完成构建。' : '在统一工作空间中编辑，并与其他引擎协同。'}</p></div><button class="primary" data-route="studio">✦ AI 创建应用</button></div>${view()}</main><footer><span>OmniFormOS <b>·</b> 从想法到应用</span><span>OmniFormOS v1.0 · 8 个核心引擎 · 本地交互原型</span></footer></div>`;
  if (route === 'pilot') pilot.afterRender();
  if (route === 'flowform') flowform.afterRender();
  if (route === 'docmorph') docmorph.afterRender();
  if (route === 'adaptform') adaptform.afterRender();
  if (route === 'tablemind') tablemind.afterRender();
  if (route === 'labform') labform.afterRender();
  if (route === 'appcanvas') appcanvas.afterRender();
  const footer = root.querySelector('.main-shell > footer span:last-child');
  if (footer) footer.textContent = 'OmniFormOS v1.0 · 8 个核心引擎 · 本地交互原型';
}
function view() {
  if (route === 'appcanvas') return appcanvas.render();
  if (route === 'labform') return labform.render();
  if (route === 'tablemind') return tablemind.render();
  if (route === 'adaptform') return adaptform.render();
  if (route === 'docmorph') return docmorph.render();
  if (route === 'flowform') return flowform.render();
  if (route === 'exam') return examcraft.render();
  if (route === 'pilot') return pilot.render();
  if (route === 'studio') return studioView();
  if (route === 'home') return homeView();
  if (route === 'apps') return appsView();
  if (route === 'ai') return aiView();
  if (route === 'link') return integrationsView();
  if (route === 'team') return teamView();
  if (!current()) return empty('还没有应用', '创建第一个应用，开始设计你的业务流程。', '<button class="primary" data-action="new">创建应用</button>');
  return `<div class="editor-toolbar">${appSelect()}<button class="secondary" data-action="preview">◉ 预览并填表</button></div>${({ form: formView, data: dataView, page: pageView, flow: flowView })[route]()}`;
}
function promptBox(compact = false) {
  return `<section class="ai-banner ${compact ? 'compact' : ''}"><div class="ai-banner-content"><div class="ai-label">✦ OMNI AI <span>本地规则演示</span></div><h2>一个想法，就是一个新起点。</h2><p>描述你想构建的应用，让构建从此简单。</p><form id="generate-form"><div class="prompt-input"><textarea id="prompt" name="prompt" required maxlength="1000" placeholder="例如：帮我创建一个客户管理应用，记录客户信息和跟进备注……" aria-label="描述你想构建的应用"></textarea><div class="prompt-bottom"><span>✧ 应用结构 · 表单字段 · 数据模型</span><button class="primary" type="submit">生成应用 <span>↗</span></button></div></div></form><div class="suggestions"><span>试试这些灵感</span>${['客户管理', '费用报销', '项目任务'].map(s => `<button data-prompt="${s}">${s} ↗</button>`).join('')}</div></div><div class="orb-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orb"><span>✦</span></div><span class="orbit-spark">✧</span><div class="orb-caption">IDEA → APP</div></div></section>`;
}
function studioView() {
  const cards = nav.map(([id, name], index) => { const [title, description, role] = moduleMeta[id]; return `<article class="studio-module"><div><span>${String(index + 1).padStart(2, '0')}</span><i>${icons[id]}</i></div><small>${role}</small><h3>${name}</h3><h4>${title}</h4><p>${description}</p><button data-route="${id}">打开引擎 <b>↗</b></button></article>`; }).join('');
  return `<section class="studio-intro">${promptBox(true)}<div class="creation-path"><button data-route="studio" class="active"><span>01</span><b>描述需求</b><small>AI 理解目标</small></button><i>→</i><button data-route="pilot"><span>02</span><b>生成应用</b><small>蓝图与数据模型</small></button><i>→</i><button data-route="form"><span>03</span><b>编辑应用</b><small>页面与业务规则</small></button><i>→</i><button data-route="apps"><span>04</span><b>管理应用</b><small>数据与版本</small></button><i>→</i><button data-route="appcanvas"><span>05</span><b>发布使用</b><small>组合与交付</small></button></div></section><section class="section-block"><div class="section-head"><div><h2>八大 AI 引擎</h2><p>模块共享应用上下文，可在同一条业务链路中连续使用。</p></div>${pill('统一创作中心')}</div><div class="studio-modules">${cards}</div></section><section class="engine-link-panel"><div><small>推荐联动</small><h3>文档导入 → 自适应表单 → 审批流程 → 数据看板 → 应用发布</h3><p>使用 DocMorph 提取字段，AdaptForm 设置动态规则，FlowForm 编排审批，TableMind 分析数据，最后由 AppCanvas 发布。</p></div><button data-route="docmorph">从文档开始 →</button></section>`;
}
function homeView() {
  const records = state.apps.reduce((n, a) => n + a.records.length, 0);
  const runs = state.apps.reduce((n, a) => n + a.logs.length, 0);
  return `<section class="workspace-hero"><div><small>GOOD DAY, CREATOR</small><h2>你的业务应用，都在这里。</h2><p>从最近项目继续，或进入 AI 创作中心启动新的业务流程。</p></div><button data-route="studio">✦ 创建新应用 ↗</button></section><section class="stats-grid">${[['▦', '应用总数', state.apps.length, '统一管理全部项目'], ['▤', '已收集记录', records, '跨应用业务数据'], ['⌘', '流程运行次数', runs, '自动化执行记录'], ['◎', '工作空间成员', state.members.length, '团队角色与协作']].map(([icon, label, value, hint]) => `<article class="stat"><div class="stat-title"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong>${value.toString().padStart(2, '0')}</strong><small>${hint}</small></article>`).join('')}</section><section class="section-block"><div class="section-head"><div><h2>最近的应用 <span>${state.apps.length}</span></h2><p>继续编辑、管理数据或进入发布流程。</p></div><button class="text-button" data-route="apps">管理全部应用 <span>→</span></button></div><div class="app-grid">${state.apps.slice(0, 3).map(appCard).join('') || empty('从第一个应用开始', '前往 AI 创作中心描述你的需求。', '<button class="primary" data-route="studio">开始创作</button>')}</div></section><section class="bottom-grid"><div class="panel template-panel"><div class="section-head"><div><h2>快速创建</h2><p>从成熟模板进入应用编辑。</p></div><span class="muted">↗</span></div>${[['customer', '客户关系管理', '客户资料 · 销售跟进', '◈'], ['expense', '费用报销', '费用提交 · 财务记录', '▣'], ['general', '项目任务管理', '团队协作 · 任务收集', '⌘']].map(([id, name, desc, icon]) => `<button class="template-row" data-template="${id}"><span class="template-icon ${id}">${icon}</span><div><strong>${name}</strong><small>${desc}</small></div><span>＋</span></button>`).join('')}</div><div class="panel activity-panel"><div class="section-head"><div><h2>最近动态</h2><p>应用生成、数据与流程活动。</p></div><span class="live-dot"></span></div>${state.activity.length ? `<div class="timeline">${state.activity.slice(0, 4).map(a => `<div><i></i><p>${escape(a.text)}<small>${date(a.at)}</small></p></div>`).join('')}</div>` : '<div class="welcome-note"><span>✧</span><h3>等待第一个项目动态</h3><p>创建应用后，关键操作会显示在这里。</p></div>'}</div></section>`;
}
function appCard(a) {
  return `<article class="app-card"><div class="app-card-top"><span class="app-icon ${a.template}">${a.template === 'customer' ? '◈' : a.template === 'expense' ? '▣' : '⌘'}</span>${pill('本地草稿')}<button class="icon-button delete-app" data-delete-app="${a.id}" aria-label="删除${escape(a.name)}">⋯</button></div><button class="app-name" data-open-app="${a.id}">${escape(a.name)} <span>↗</span></button><p>${escape(a.description || '为你的团队构建更顺畅的业务体验。')}</p><div class="app-meta"><span>▤ ${a.fields.length} 个字段 <span class="meta-divider">·</span> ${a.records.length} 条记录</span></div><div class="app-card-actions"><button data-manage-app="${a.id}" data-target="form">编辑</button><button data-manage-app="${a.id}" data-target="data">数据</button><button data-manage-app="${a.id}" data-target="flow">流程</button><button data-route="appcanvas">发布 ↗</button></div></article>`;
}
function appsView() { return `<div class="section-head"><div class="tabs"><span class="selected">全部应用 <b>${state.apps.length}</b></span></div><input class="search" id="app-search" type="search" placeholder="搜索应用…" aria-label="搜索应用" value="${escape(filter)}" /></div><div class="app-grid" id="app-results">${appResults()}</div>`; }
function appResults() { return state.apps.filter(a => `${a.name} ${a.description}`.toLowerCase().includes(filter.toLowerCase())).map(appCard).join('') || empty('没有找到应用', '试试其他关键词，或创建一个新应用。'); }
const typeNames = standardFieldTypes;
function fieldsMarkup(a) { return renderFieldControls(a.fields, escape); }
function formView() {
  const a = current();
  return `<div class="builder-grid"><section class="panel"><div class="section-head"><div><h2>表单字段</h2><p>调整字段，定义你需要的信息。</p></div>${pill(`${a.fields.length} 个字段`)}</div><div class="field-list">${a.fields.map((f, i) => `<div class="field-row"><span class="field-order">${i + 1}</span><div><strong>${escape(f.label)} ${f.required ? '<span class="required">*</span>' : ''}</strong><small>${typeNames[f.type]}</small></div><button class="icon-button" data-edit-field="${f.id}" aria-label="编辑${escape(f.label)}">✎</button><button class="icon-button danger" data-delete-field="${f.id}" aria-label="删除${escape(f.label)}">×</button></div>`).join('') || '<p class="muted">添加字段后即可提交表单。</p>'}</div><button class="dashed-button" data-action="add-field">＋ 添加字段</button></section><section class="panel form-preview"><div class="preview-label"><i></i> 实时表单预览</div><h2>${escape(a.name)}</h2><p class="muted">${escape(a.description)}</p><form class="record-form ${a.layout}" data-record-form="${a.id}">${fieldsMarkup(a)}<button class="primary" ${a.fields.length ? '' : 'disabled'}>提交记录 →</button></form></section></div>`;
}
function dataView() {
  const a = current();
  return `<section class="panel"><div class="section-head"><div><h2>业务数据 <span>${a.records.length}</span></h2><p>表单提交的记录保存在当前浏览器。</p></div><div class="button-group"><input class="search" id="record-search" type="search" aria-label="搜索记录" placeholder="搜索记录…" value="${escape(recordFilter)}" /><button class="secondary" data-action="export-app">导出 JSON</button><button class="primary" data-action="preview">＋ 新增记录</button></div></div><div id="records-table">${recordsTable()}</div></section>`;
}
function recordsTable() {
  const a = current();
  const records = a.records.filter(r => Object.values(r.values).some(v => String(v).toLowerCase().includes(recordFilter.toLowerCase())));
  return records.length ? `<div class="table-wrap"><table><thead><tr><th>状态</th>${a.fields.map(f => `<th>${escape(f.label)}</th>`).join('')}<th>提交时间</th><th>操作</th></tr></thead><tbody>${records.map(r => `<tr><td>${pill(r.status)}</td>${a.fields.map(f => `<td>${escape(r.values[f.id] || '—')}</td>`).join('')}<td class="muted">${date(r.at)}</td><td><button class="text-button danger" data-delete-record="${r.id}">删除</button></td></tr>`).join('')}</tbody></table></div>` : empty(a.records.length ? '没有匹配的记录' : '等待第一条业务记录', a.records.length ? '试试其他搜索关键词。' : '点击「新增记录」，填写并提交你的表单。');
}
function pageView() {
  const a = current();
  return `<div class="builder-grid"><section class="panel"><div class="section-head"><div><h2>页面布局</h2><p>选择表单布局，右侧即时预览。</p></div></div><div class="layout-options">${[['single', '单列布局', '适合简洁的信息收集'], ['double', '双列布局', '适合桌面端业务表单']].map(([id, name, desc]) => `<button class="layout-choice ${a.layout === id ? 'chosen' : ''}" data-layout="${id}"><span>${id === 'single' ? '▤' : '▥'}</span><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><div class="note">页面搭建首版支持表单布局切换；组件自由编排待后续扩展。</div></section><section class="panel form-preview"><div class="preview-label"><i></i> 页面预览 · 可提交</div><h2>${escape(a.name)}</h2><form class="record-form ${a.layout}" data-record-form="${a.id}">${fieldsMarkup(a)}<button class="primary" ${a.fields.length ? '' : 'disabled'}>提交记录 →</button></form></section></div>`;
}
function flowView() {
  const a = current();
  return `<section class="panel flow-panel"><div class="section-head"><div><h2>${escape(a.name)} · 业务流程</h2><p>仅模拟流程执行和本地状态变更，不会发送外部请求。</p></div><button class="primary" data-action="run-flow" ${a.records.length ? '' : 'disabled'}>▷ 模拟运行</button></div><div class="workflow">${a.workflow.map((step, i) => `<div class="flow-step"><span class="flow-step-icon">${i === 0 ? 'ϟ' : i === a.workflow.length - 1 ? '✓' : '◇'}</span><div><small>${i === 0 ? 'TRIGGER' : 'ACTION'} ${String(i + 1).padStart(2, '0')}</small><strong>${escape(step)}</strong></div>${i > 0 ? `<button class="icon-button" data-edit-step="${i}" aria-label="编辑步骤${i + 1}">✎</button>` : ''}</div>${i < a.workflow.length - 1 ? '<div class="flow-connector">↓</div>' : ''}`).join('')}</div><div class="note">模拟运行会校验最新一条记录，并将其标记为「待处理」。${a.records.length ? '' : '请先填写表单，创建一条记录。'}</div></section><section class="panel section-block"><div class="section-head"><h2>模拟运行日志</h2>${pill('本地执行')}</div>${a.logs.length ? a.logs.slice(0, 10).map(log => `<div class="log-row"><span class="${log.ok ? 'success' : 'danger'}">${log.ok ? '✓ 校验通过' : '× 校验失败'}</span><span>${escape(log.message)}</span><small>${date(log.at)}</small></div>`).join('') : empty('还没有运行记录', '提交一条业务记录，然后模拟运行流程。')}</section>`;
}
function aiView() { return `${promptBox(true)}<div class="panel section-block"><div class="section-head"><div><h2>应用构建建议</h2><p>按当前应用统计生成的本地提示。</p></div>${pill('规则演示')}</div><div class="advice-grid">${[['01', '从简单的表单开始', `当前工作空间有 ${state.apps.length} 个应用。先用少量字段验证业务，再扩展复杂流程。`], ['02', '让数据形成闭环', `已收集 ${state.apps.reduce((n, a) => n + a.records.length, 0)} 条记录。你可以在数据管理中检索记录，并导出 JSON 备份。`], ['03', '在接入前验证流程', '先用模拟工作流验证必填字段和状态变化，再接入真实审批和通知服务。']].map(([n, title, text]) => `<article><span>${n}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div><div class="note">尚未接入大语言模型。应用生成仅识别客户、报销和通用业务关键词；不会发送你的输入到外部服务。</div></div>`; }
function integrationsView() { return `<div class="note top-note">连接器目录预览。以下连接器尚未接入，当前版本不会连接或调用外部服务。</div><div class="integration-grid">${[['↗', 'Webhook', '以 HTTP 事件连接业务系统', '触发器 · 动作'], ['✉', '邮件通知', '让重要的业务变化及时送达', '通知 · 协作'], ['▥', '数据库', '连接现有的业务数据来源', '数据 · 同步'], ['⌘', '企业协作', '连接团队的日常沟通工具', '消息 · 审批'], ['✦', '大语言模型', '用真实模型生成应用和业务建议', 'AI · 生成'], ['▧', '文件存储', '统一管理业务附件和文档', '文件 · 对象存储']].map(([icon, name, desc, tag]) => `<article class="panel integration-card"><span class="integration-icon">${icon}</span>${pill('规划中')}<h3>${name}</h3><p>${desc}</p><div><small>${tag}</small><button class="text-button" data-connector="${name}">查看规划 ↗</button></div></article>`).join('')}</div>`; }
function teamView() { return `<div class="note top-note">本地角色配置演示，不提供真实登录、邀请、身份认证或访问隔离。请勿用于存放敏感业务数据。</div><section class="panel"><div class="section-head"><div><h2>工作空间成员</h2><p>设计团队角色，预演协作方式。</p></div><button class="primary" data-action="add-member">＋ 添加演示成员</button></div><div class="table-wrap"><table><thead><tr><th>成员</th><th>角色</th><th>作用范围</th><th>操作</th></tr></thead><tbody>${state.members.map((m, i) => `<tr><td><span class="member-name"><span class="avatar small">${escape(m.name.slice(0, 1))}</span>${escape(m.name)}</span></td><td><select data-member-role="${m.id}" aria-label="${escape(m.name)}的角色" ${i === 0 ? 'disabled' : ''}>${['管理员', '编辑者', '查看者'].map(r => `<option ${r === m.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td class="muted">本地演示配置</td><td>${i === 0 ? pill('当前用户') : `<button class="text-button danger" data-delete-member="${m.id}">移除</button>`}</td></tr>`).join('')}</tbody></table></div></section><section class="panel section-block"><div class="section-head"><div><h2>工作空间备份</h2><p>导出八大模块 SQLite 数据库、数据库内附件与当前浏览器工作区。</p></div><button class="secondary" data-action="export">⇩ 导出 JSON 备份</button></div></section>`; }
function go(next) { route = routes.some(n => n[0] === next) ? next : 'landing'; filter = ''; recordFilter = ''; location.hash = route; render(); window.scrollTo({ top: 0 }); }
function creationTarget(prompt) {
  if (/考试|题库|测评|培训/.test(prompt)) return 'exam';
  if (/文档|PDF|Word|Excel|扫描|识别/.test(prompt)) return 'docmorph';
  if (/实验|科研|公式|曲线/.test(prompt)) return 'labform';
  if (/数据|看板|图表|分析|CSV/.test(prompt)) return 'tablemind';
  if (/审批|流程|自动化|报销/.test(prompt)) return 'flowform';
  if (/动态|条件|自适应|分支/.test(prompt)) return 'adaptform';
  if (/多页面|门户|发布|网站/.test(prompt)) return 'appcanvas';
  return 'pilot';
}
function newAppModal() { openModal('<h2>从一个新想法开始</h2><p class="muted">先为你的业务应用起个名字。</p><form id="new-app-form" class="stack"><label>应用名称<input name="name" required maxlength="60" placeholder="例如：客户关系管理" /></label><label>应用描述<textarea name="description" maxlength="300" placeholder="这个应用将帮助你解决什么问题？"></textarea></label><button class="primary">创建应用 →</button></form>'); }
function fieldModal(id) {
  const f = current().fields.find(f => f.id === id);
  openModal(`<h2>${f ? '编辑' : '添加'}表单字段</h2><form id="field-form" class="stack" data-field-id="${id || ''}"><label>字段名称<input name="label" required maxlength="60" value="${escape(f?.label || '')}" placeholder="例如：联系电话" /></label><label>字段类型<select name="type">${Object.entries(typeNames).map(([id, label]) => `<option value="${id}" ${f?.type === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="checkbox"><input name="required" type="checkbox" ${f?.required ? 'checked' : ''} /> 必填字段</label><p class="muted">修改类型或必填设置后，已有记录不会自动转换。</p><button class="primary">保存字段</button></form>`);
  const optionLabel = document.createElement('label'); optionLabel.textContent = '选项（单选/多选使用，每行一项）';
  const options = document.createElement('textarea'); options.name = 'options'; options.value = (f?.options || []).join('\n'); optionLabel.append(options);
  document.querySelector('#field-form').insertBefore(optionLabel, document.querySelector('#field-form .checkbox'));
}
function confirmModal(title, description, callback) { openModal(`<h2>${escape(title)}</h2><p class="muted">${escape(description)}</p><div class="modal-actions"><button class="secondary" data-action="close">取消</button><button class="primary destructive" id="confirm-action">确认删除</button></div>`); document.querySelector('#confirm-action').onclick = () => { callback(); dialog.close(); render(); }; }
function download(data, name) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('备份已导出'); }

document.addEventListener('click', async event => {
  const el = event.target.closest('button, a.brand'); if (!el) return;
  if (el.matches('a.brand')) { event.preventDefault(); go('landing'); return; }
  const d = el.dataset;
  if (d.route) go(d.route);
  if (d.manageApp) { activeId = d.manageApp; go(d.target || 'form'); }
  if (d.openApp) { activeId = d.openApp; if (current().blueprint) { go('pilot'); pilot.enter(activeId); } else go('form'); }
  if (d.prompt) { document.querySelector('#prompt').value = `帮我创建一个${d.prompt}应用`; document.querySelector('#prompt').focus(); }
  if (d.template) { const names = { customer: '客户关系管理', expense: '费用报销', general: '项目任务管理' }; const a = makeApp(names[d.template], '从模板创建，按你的业务需要继续调整。', d.template); state.apps.unshift(a); activeId = a.id; activity(`从模板创建「${a.name}」`); go('form'); toast('应用已创建，可以继续调整字段'); }
  if (d.deleteApp) { const a = state.apps.find(a => a.id === d.deleteApp); confirmModal(`删除「${a.name}」？`, '应用、表单字段和全部业务记录将从当前浏览器删除。此操作无法撤销，建议先导出备份。', () => { state.apps = state.apps.filter(a => a.id !== d.deleteApp); activeId = state.apps[0]?.id; activity(`删除应用「${a.name}」`); }); }
  if (d.editField) fieldModal(d.editField);
  if (d.deleteField) { const a = current(), f = a.fields.find(f => f.id === d.deleteField); confirmModal(`删除字段「${f.label}」？`, '该字段以及已有记录中的对应值将一并删除。', () => { a.fields = a.fields.filter(f => f.id !== d.deleteField); a.records.forEach(r => delete r.values[d.deleteField]); activity(`删除「${a.name}」的字段「${f.label}」`); }); }
  if (d.deleteRecord) confirmModal('删除这条记录？', '删除后无法恢复，建议先导出数据。', () => { const a = current(); try { if (a.blueprint) { const b = ensureBlueprint(a); removeRecord(b, b.entities[0], d.deleteRecord); } else a.records = a.records.filter(r => r.id !== d.deleteRecord); activity(`删除「${a.name}」的一条记录`); } catch (error) { toast(error.message); } });
  if (d.layout) { current().layout = d.layout; save(); render(); toast('页面布局已保存'); }
  if (d.editStep) openModal(`<h2>编辑流程步骤</h2><form id="step-form" class="stack" data-step="${d.editStep}"><label>步骤显示名称<input name="label" required maxlength="60" value="${escape(current().workflow[Number(d.editStep)])}" /></label><p class="muted">仅修改显示名称。模拟逻辑固定为：校验最新记录并标记待处理。</p><button class="primary">保存步骤</button></form>`);
  if (d.connector) openModal(`<h2>${escape(d.connector)} · 接入规划</h2><p class="muted">此连接器尚未实现。正式接入需要配置服务端凭据保护、授权校验、请求日志和失败重试。</p><div class="note">原型不会收集 API 密钥，也不会向第三方发送数据。</div><button class="secondary" data-action="close">知道了</button>`);
  if (d.deleteMember) { state.members = state.members.filter(m => m.id !== d.deleteMember); activity('移除一位演示成员'); render(); }
  if (d.action === 'close') dialog.close();
  if (d.action === 'new') { if (route === 'pilot') pilot.start(); else newAppModal(); }
  if (d.action === 'add-field') fieldModal();
  if (d.action === 'preview') { const a = current(); openModal(`<h2>${escape(a.name)}</h2><p class="muted">提交后可在「数据管理」查看记录。</p><form class="record-form ${a.layout}" data-record-form="${a.id}">${fieldsMarkup(a)}<button class="primary" ${a.fields.length ? '' : 'disabled'}>提交记录 →</button></form>`); }
  if (d.action === 'export') {
    try{
      toast('正在备份八大模块数据库和浏览器工作区…');
      const browserStorage=Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]));browserStorage[key]=JSON.stringify(state);
      const response=await fetch('/api/workspace/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({browserStorage})});
      if(!response.ok)throw Error((await response.json()).error||'备份失败');
      const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='OmniFormOS-'+new Date().toISOString().slice(0,10)+'.ofbackup';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('完整备份已导出，含八模块数据库；恢复方式见备份恢复说明');
    }catch(error){toast('备份失败：'+error.message);}
  }
  if (d.action === 'export-app') download(current(), 'omniformos-app.json');
  if (d.action === 'run-flow') {
    const a = current(), r = a.records[0]; if (!r) return;
    const error = validateRecord(a.fields, r.values); if (!error) r.status = '待处理';
    a.logs.unshift({ id: uid(), at: new Date().toISOString(), ok: !error, message: error || `已校验最新记录，状态已更新为待处理（${a.workflow.length} 个模拟步骤）` });
    activity(`「${a.name}」模拟流程${error ? '校验失败' : '运行完成'}`); render(); toast(error || '模拟运行完成，最新记录已标记待处理');
  }
  if (d.action === 'add-member') openModal('<h2>添加演示成员</h2><form id="member-form" class="stack"><label>成员名称<input name="name" required maxlength="40" /></label><label>演示角色<select name="role"><option>编辑者</option><option>查看者</option><option>管理员</option></select></label><p class="muted">只保存在本地，不发送邀请。</p><button class="primary">添加成员</button></form>');
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target, data = new FormData(form);
  if (form.id === 'generate-form') {
    const prompt = data.get('prompt').trim(); if (!prompt) return toast('请先描述你想构建的应用');
    const a = generateApp(prompt); state.apps.unshift(a); activeId = a.id; const target = creationTarget(prompt); activity(`通过 AI 创作中心生成「${a.name}」，进入 ${routes.find(item => item[0] === target)?.[1] || '应用编辑'}`); go(target); toast('应用草稿已生成，已进入匹配的创作引擎');
  }
  if (form.id === 'new-app-form') {
    const name = data.get('name').trim(); if (!name) return toast('请输入应用名称');
    const a = makeApp(name, data.get('description').trim()); state.apps.unshift(a); activeId = a.id; activity(`创建应用「${a.name}」`); dialog.close(); go('form'); toast('应用已创建');
  }
  if (form.id === 'field-form') {
    const label = data.get('label').trim(); if (!label) return toast('请输入字段名称');
    const a = current(); const id = form.dataset.fieldId; const field = { ...a.fields.find(f => f.id === id), id: id || uid(), label, type: data.get('type'), required: data.has('required'), options: data.get('options').split('\n').map(o => o.trim()).filter(Boolean) };
    if (['select', 'multiselect'].includes(field.type) && (!field.options.length || new Set(field.options).size !== field.options.length)) return toast('请填写非空且不重复的选项');
    if (a.fields.some(f => f.id !== id && f.label === label)) return toast('该字段名称已存在');
    if (id) a.fields = a.fields.map(f => f.id === id ? field : f); else a.fields.push(field);
    activity(`更新「${a.name}」的表单字段`); dialog.close(); render(); toast('字段已保存');
  }
  if (form.dataset.recordForm) {
    const a = state.apps.find(a => a.id === form.dataset.recordForm), values = valuesFromForm(a.fields, data);
    const error = validateRecord(a.fields, values); if (error) return toast(error);
    a.records.unshift({ id: uid(), values, at: new Date().toISOString(), status: '新提交' }); activity(`「${a.name}」收到一条新记录`); if (dialog.open) dialog.close(); go('data'); toast('提交成功，记录已保存');
  }
  if (form.id === 'step-form') { const label = data.get('label').trim(); if (!label) return toast('请输入步骤名称'); current().workflow[Number(form.dataset.step)] = label; save(); dialog.close(); render(); toast('步骤名称已保存'); }
  if (form.id === 'member-form') { const name = data.get('name').trim(); if (!name) return toast('请输入成员名称'); state.members.push({ id: uid(), name, role: data.get('role') }); activity(`添加演示成员「${name}」`); dialog.close(); render(); }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.id === 'app-select') { activeId = el.value; recordFilter = ''; render(); }
  if (el.dataset.memberRole) { const member = state.members.find(m => m.id === el.dataset.memberRole); member.role = el.value; activity(`更新「${member.name}」的演示角色`); toast('演示角色已保存'); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'app-search') { filter = event.target.value; document.querySelector('#app-results').innerHTML = appResults(); }
  if (event.target.id === 'record-search') { recordFilter = event.target.value; document.querySelector('#records-table').innerHTML = recordsTable(); }
});
window.addEventListener('hashchange', () => { const next = location.hash.slice(1).split('?')[0]; if (route === 'landing' && ['capabilities', 'modules', 'templates'].includes(next)) return; if (next !== route || next === 'exam') { route = routes.some(n => n[0] === next) ? next : 'landing'; render(); } });
// 语言切换：重建界面（DOM 文本由全局 i18n 观察器翻译）
window.addEventListener('omni-lang-changed', () => render());
installWorkspaceUI({root,getRoute:()=>route,navigate:go,routes});
installHeroMascot(root);
installLandingKeys(root);
route = routes.some(n => n[0] === location.hash.slice(1).split('?')[0]) ? location.hash.slice(1).split('?')[0] : 'landing';
render();
if (storageWarning) toast('无法读取上次的本地数据，已载入初始模板');

document.addEventListener('click', event => { if(event.target.closest('a[href^="#exam?paper="]')) dialog.close(); });
