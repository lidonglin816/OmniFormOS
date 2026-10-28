import {buildApplication} from './formpilot-model.js';
import {standardFieldTypes,validateFields} from './field-rules.js';
export const clone=v=>structuredClone(v), uid=()=>crypto.randomUUID();
export const engines={exam:'ExamCraft',flowform:'FlowForm',docmorph:'DocMorph',adaptform:'AdaptForm',tablemind:'TableMind',labform:'LabForm',appcanvas:'AppCanvas'};
const field=(label,type='text',extra={})=>({id:uid(),label,type,required:false,...extra});
export function localBlueprint(prompt){
 const a=buildApplication(prompt),b=a.blueprint;
 if(/竞赛|比赛/.test(prompt)){
  const e=(name,fields)=>({id:uid(),name,fields,records:[]});
  const contest=e('竞赛',[field('竞赛名称','text',{required:true}),field('竞赛说明','textarea')]);
  const team=e('团队',[field('团队名称','text',{required:true}),field('队长','text',{required:true}),field('指导教师邮箱','email')]);
  const project=e('作品',[field('作品名称','text',{required:true}),field('所属团队','relation',{target:team.id,required:true}),field('作品说明','textarea'),field('作品文件','file')]);
  const review=e('审核记录',[field('关联作品','relation',{target:project.id,required:true}),field('审核意见','textarea'),field('成绩','number'),field('审核结果','select',{options:['待审核','通过','退回']})]);
  contest.readScope='all';contest.permissions={create:['teacher','admin'],update:['teacher','admin'],delete:['admin']};
  review.permissions={create:['teacher','admin'],update:['teacher','admin'],delete:['admin']};review.ownerFromRelation=review.fields.find(f=>f.type==='relation').id;
  b.entities=[contest,team,project,review];a.name='校园创新比赛管理系统';b.roles=[{id:'student',name:'学生',allowed:['read','create','update'],scope:'own'},{id:'teacher',name:'指导教师',allowed:['read','create','update','approve'],scope:'all'},{id:'admin',name:'管理员',allowed:['read','create','update','delete','approve'],scope:'all'}];
 }
 return normalizeBlueprint({schemaVersion:3,name:a.name,description:prompt,entities:b.entities.map(({records,...e})=>e),roles:b.roles,pages:[],constraints:[{id:uid(),text:'请确认报名截止时间、人数上限与上传文件要求。',confirmed:false}],modules:[],theme:'violet',source:'本地领域模板（非 AI）'});
}
export function normalizeBlueprint(raw){
 const b=clone(raw);b.schemaVersion=3;b.id||=uid();b.projectId||=b.id;b.name=String(b.name||'未命名应用');b.description=String(b.description||'');b.theme||='violet';
 b.entities||=[];for(const e of b.entities){e.id||=uid();for(const f of e.fields||[]){f.id||=uid();f.required=!!f.required;f.rules||={};}}
 b.roles=(b.roles||[]).map((r,i)=>({...r,id:r.id||uid(),scope:r.scope||(/管理员|教师|经理/.test(r.name)?'all':'own'),allowed:r.allowed||['read']}));
 if(!b.roles.some(r=>r.allowed?.includes('delete')&&r.scope==='all'))b.roles.push({id:uid(),name:'管理员',allowed:['read','create','update','delete','approve'],scope:'all'});
 if(!b.pages?.length)b.pages=b.entities.flatMap((e,i)=>[{id:uid(),title:e.name+'列表',entityId:e.id,type:'list',slug:'data-'+i},{id:uid(),title:e.name+'提交',entityId:e.id,type:'create',slug:'submit-'+i}]);
 b.constraints||=[];b.modules||=[];b.workflows||=[];b.forms||=[];
 const recommendations={flowform:/审核|审批|报修/.test(b.description),adaptform:/报名|条件|动态/.test(b.description),exam:/考试|测评|培训/.test(b.description),docmorph:/文档|资料|文件/.test(b.description),labform:/实验|科研/.test(b.description),tablemind:true,appcanvas:true};
 for(const [module,yes]of Object.entries(recommendations))if(yes&&!b.modules.some(m=>m.module===module))b.modules.push({module,status:'suggested'});
 return b;
}
export function validateBlueprint(b){
 const errors=[],idPattern=/^[a-zA-Z0-9_-]{1,120}$/;
 if(!b||b.schemaVersion!==3)return['蓝图版本必须为 3'];if(!String(b.name||'').trim()||b.name.length>100)errors.push('应用名称需为 1–100 字');
 if(!Array.isArray(b.entities)||!b.entities.length||b.entities.length>30)return [...errors,'实体数量需为 1–30'];
 const ids=new Set(),entities=new Set(b.entities.map(e=>e.id)),slugs=new Set();
 const checkId=id=>{if(!idPattern.test(id||'')||ids.has(id))errors.push('ID 无效或重复：'+id);ids.add(id);};
 for(const e of b.entities){checkId(e.id);if(!e.name?.trim())errors.push('实体缺少名称');if(!Array.isArray(e.fields)||!e.fields.length||e.fields.length>80){errors.push(e.name+'字段数量需为 1–80');continue;}const names=new Set();for(const f of e.fields){checkId(f.id);if(!f.label?.trim()||names.has(f.label))errors.push('字段名称为空或重复');names.add(f.label);if(!standardFieldTypes[f.type]&&!['relation','file'].includes(f.type))errors.push('字段类型不支持：'+f.type);if(f.type==='relation'&&!entities.has(f.target))errors.push(f.label+'关联目标不存在');if(['select','multiselect'].includes(f.type)&&(!Array.isArray(f.options)||!f.options.length))errors.push(f.label+'需要选项');}}
 if(!Array.isArray(b.pages)||!b.pages.length||b.pages.length>100)errors.push('页面数量需为 1–100');else for(const p of b.pages){checkId(p.id);if(!['list','create','detail','stats'].includes(p.type)||!entities.has(p.entityId))errors.push('页面类型或实体引用无效');if(!/^[a-zA-Z0-9_-]{1,80}$/.test(p.slug||'')||slugs.has(p.slug))errors.push('页面路由重复或无效');slugs.add(p.slug);if(!p.title?.trim())errors.push('页面缺少名称');}
 if(!Array.isArray(b.roles)||!b.roles.length||b.roles.length>12)errors.push('角色数量需为 1–12');else for(const r of b.roles){if(!idPattern.test(r.id)||!r.name?.trim()||!['own','all'].includes(r.scope)||!Array.isArray(r.allowed)||r.allowed.some(x=>!['read','create','update','delete','approve'].includes(x)))errors.push('角色规则无效');}
 if(new Set(b.roles?.map(r=>r.id)).size!==b.roles?.length)errors.push('角色 ID 重复');
 if(!b.roles?.some(r=>r.scope==='all'&&r.allowed.includes('delete')&&r.allowed.includes('read')))errors.push('必须保留可管理数据的管理员角色');
 for(const e of b.entities){for(const [operation,roles]of Object.entries(e.permissions||{}))if(!['read','create','update','delete'].includes(operation)||!Array.isArray(roles)||roles.some(id=>!b.roles.some(r=>r.id===id)))errors.push('实体权限引用无效');if(e.readScope&&!['all','role'].includes(e.readScope))errors.push('实体读取范围无效');if(e.ownerFromRelation&&!e.fields.some(f=>f.id===e.ownerFromRelation&&f.type==='relation'))errors.push('记录归属引用无效');for(const f of e.fields){if(f.rules?.pattern)errors.push('暂不支持自由正则，请使用类型与长度校验');for(const k of ['min','max','maxLength','exactLength'])if(f.rules?.[k]!==undefined&&!Number.isFinite(f.rules[k]))errors.push('字段校验参数必须是数值');}}
 if(!Array.isArray(b.modules)||b.modules.some(m=>!engines[m.module]))errors.push('模块引用无效');
 if(!Array.isArray(b.constraints)||b.constraints.some(c=>typeof c.text!=='string'||typeof c.confirmed!=='boolean'))errors.push('待确认约束无效');
 if(!['violet','blue','mint'].includes(b.theme))errors.push('主题不支持');
 if(JSON.stringify(b).length>500000)errors.push('蓝图过大');return [...new Set(errors)];
}
export const canEntity=(role,entity,operation)=>role.allowed.includes(operation)&&(!entity.permissions?.[operation]||entity.permissions[operation].includes(role.id));
const forbidden=new Set(['__proto__','constructor','prototype']);
export function applyPatch(blueprint,patch){
 if(!Array.isArray(patch)||!patch.length||patch.length>100)throw Error('变更计划需为 1–100 项');const next=clone(blueprint),diff=[];
 for(const op of patch){if(!['add','replace','remove'].includes(op.op)||typeof op.path!=='string'||!/^\/(name|description|entities|pages|roles|constraints|theme|modules)(\/|$)/.test(op.path))throw Error('禁止修改此路径');const keys=op.path.slice(1).split('/').map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~'));if(keys.some(k=>forbidden.has(k)||['records','tableId','token','flowId','canvasId','projectId'].includes(k)))throw Error('禁止修改系统数据与模块标识');let target=next;for(const key of keys.slice(0,-1)){if(!Object.hasOwn(target,key)||target[key]===null||typeof target[key]!=='object')throw Error('修改路径不存在');target=target[key];}const key=keys.at(-1);let before;
  if(Array.isArray(target)){const index=key==='-'?target.length:Number(key);if(!Number.isInteger(index)||index<0||index>target.length||((op.op!=='add')&&index===target.length))throw Error('数组路径无效');before=target[index];if(op.op==='add')target.splice(index,0,clone(op.value));else if(op.op==='remove')target.splice(index,1);else target[index]=clone(op.value);}
  else{if(op.op!=='add'&&!Object.hasOwn(target,key))throw Error('字段路径不存在');before=target[key];if(op.op==='remove')delete target[key];else target[key]=clone(op.value);}
  diff.push({path:op.path,op:op.op,before:before??null,after:op.op==='remove'?null:op.value});
 }
 const errors=validateBlueprint(next);if(errors.length)throw Error(errors.join('；'));return{blueprint:next,diff};
}
export function localPatch(b,instruction,entityId){
 const index=Math.max(0,b.entities.findIndex(e=>e.id===entityId)),m=instruction.match(/(?:新增|添加|增加)(?:一个)?(?:字段)?[：:\s]*[「“"]?([^，。；「」“”"]{1,30}?)(?:字段)?[」”"]?(?:[，。；]|$)/);
 if(!m)throw Error('本地模式支持“添加字段：指导教师邮箱，类型：邮箱”。复杂修改请切换已配置的 AI 引擎。');let label=m[1].trim().replace(/^(?:在.+?页面|给.+?表单)(?:中)?/,'');if(!label)throw Error('请指定字段名称');
 const type=/邮箱|email/.test(label+instruction)?'email':/数字|金额|人数/.test(instruction)?'number':/日期/.test(label)?'date':'text';
 return[{op:'add',path:`/entities/${index}/fields/-`,value:field(label,type,{required:/必填/.test(instruction)})}];
}
export function blueprintChecks(b){
 const errors=validateBlueprint(b);const checks=[{id:'schema',name:'Schema 与依赖',ok:!errors.length,details:errors.join('；')||'实体、字段与引用有效'},{id:'routes',name:'页面路由',ok:!errors.some(e=>/页面|路由/.test(e)),details:`${b.pages?.length||0} 个页面`},{id:'permissions',name:'角色配置',ok:!errors.some(e=>/角色|管理员/.test(e)),details:`${b.roles?.length||0} 个角色；公开运行时使用服务端会话`},{id:'rules',name:'必填字段验证',ok:true,details:''}];
 const required=b.entities.flatMap(e=>e.fields.filter(f=>f.required&&f.type!=='file'));checks[3].ok=required.every(f=>!!validateFields([f],{}));checks[3].details=`实际执行 ${required.length} 个必填字段空值测试`;
 return checks;
}
