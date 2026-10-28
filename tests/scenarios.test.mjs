import test from 'node:test';
import assert from 'node:assert/strict';
import {formScenarios,extraFlowTemplates,extraDocTemplates,extraTableTemplates} from '../public/scenario-catalog.js';
import {buildApplication} from '../public/formpilot-model.js';
import {generateFlow,validateFlow} from '../public/flowform-model.js';
import {adaptiveScenarios,makeAdaptiveScenario} from '../public/scenario-adapt.js';
import {evaluateForm,validateFormSchema} from '../public/adaptform-model.js';
import {makeDocument,segmentsFromText} from '../public/docmorph-model.js';
import {createExperiment,units} from '../public/labform-pro-model.js';
import {normalizeTable} from '../public/tablemind-pro-model.js';
test('20 个场景生成真实实体与空记录，关联引用有效，序列化保留结构',()=>{
 assert.equal(formScenarios.length,20);
 for(const s of formScenarios){const a=buildApplication(s.prompt),b=a.blueprint;
  if(s.entities.length)assert.deepEqual(b.entities.map(e=>e.name),s.entities.map(e=>e[0]),s.id);
  assert.deepEqual(b.roles.map(r=>r.name),['管理员','普通用户']);
  assert.equal(b.pages.length,b.entities.length*3);
  for(const e of b.entities){assert.deepEqual(e.records,[]);for(const f of e.fields.filter(f=>f.type==='relation'))assert.ok(b.entities.some(x=>x.id===f.target));}
  assert.deepEqual(JSON.parse(JSON.stringify(a)).blueprint,b);
 }
 assert.deepEqual(buildApplication('建立一个学生信息系统，角色有管理员和普通用户，支持搜索筛选').blueprint.roles.map(r=>r.name),['管理员','普通用户']);
});
test('校园与生活审批模板使用对应审批角色及天数分支',()=>{
 for(const t of extraFlowTemplates){const f=generateFlow(t[4]);assert.deepEqual(validateFlow(f),[]);assert.ok(!f.actors.some(a=>/财务|总经理|部门主管/.test(a.name)),t[0]);}
 const borrow=generateFlow(extraFlowTemplates.at(-1)[4]);assert.equal(borrow.field,'days');assert.equal(borrow.nodes.find(n=>n.type==='condition').config.value,7);
});
test('动态模板的条件字段真实切换，不满足时清除隐藏值',()=>{
 for(const s of adaptiveScenarios){const f=makeAdaptiveScenario(s[0]);assert.equal(validateFormSchema(f),'');const c=f.rules[0].conditions[0],target=f.rules[0].actions[0].targetId;
  assert.equal(evaluateForm(f,{[c.fieldId]:c.value}).fieldState[target].visible,true);
  const result=evaluateForm(f,{[c.fieldId]:'其他',[target]:'旧数据'});assert.equal(result.fieldState[target].visible,false);assert.equal(result.values[target],'');
 }
});
test('文档与数据场景包含可解析字段，数据表不注入示例记录',()=>{
 for(const t of extraDocTemplates){const d=makeDocument(t[1]+'.txt','text',segmentsFromText(t[3]));assert.ok(d.fields.length>=4,t[0]);}
 for(const t of extraTableTemplates){const table=normalizeTable({name:t[1],fields:t[3].map((s,i)=>{const[name,type]=s.split(':');return{id:'f'+i,name,type,options:type==='select'?['待开始','进行中','已完成']:[]};}),records:[]});assert.equal(table.fields.length,t[3].length);assert.deepEqual(table.records,[]);}
});
test('校园生活实验使用有效单位，不伪造测量值',()=>{
 for(const id of ['plant','cooling','pendulum']){const p=createExperiment(id);assert.equal(p.templateId,id);for(const f of p.fields)assert.ok(units[f.unit],f.unit);assert.deepEqual(p.rows,[]);}
});
