import { makeRegistrationForm } from './adaptform-model.js';
export const adaptiveScenarios=[['dorm','宿舍报修','校园 · 紧急故障追加联系方式'],['club','社团招新','校园 · 团队报名显示成员资料'],['borrow','生活物品借用','生活 · 延期时填写原因'],['volunteer','志愿活动报名','生活 · 团队与个人报名分流']];
export function makeAdaptiveScenario(id){
 const spec=adaptiveScenarios.find(t=>t[0]===id);if(!spec)return null;
 const f=makeRegistrationForm(spec[1]);f.description=spec[2];f.steps=[{id:'base',name:'基本信息'},{id:'detail',name:'补充资料'}];
 const field=(id,label,type='text',extra={})=>({id,label,type,stepId:'base',required:true,options:[],rules:{},...extra});
 let trigger,value,target;
 if(id==='dorm'){
  f.fields=[field('name','报修人'),field('room','楼栋与房间'),field('fault','故障描述','textarea'),field('urgent','是否紧急','radio',{options:['否','是']}),field('phone','紧急联系电话','tel',{stepId:'detail'})];trigger='urgent';value='是';target='phone';
 }else if(id==='borrow'){
  f.fields=[field('name','借用人'),field('item','物品名称'),field('date','借用日期','date'),field('return','预计归还日期','date'),field('extension','是否申请延期','radio',{options:['否','是']}),field('reason','延期原因','textarea',{stepId:'detail'})];trigger='extension';value='是';target='reason';
 }else{
  f.fields=[field('name','姓名'),field('contact','联系电话','tel'),field('mode','报名方式','radio',{options:['个人报名','团队报名']}),field('interest',id==='club'?'意向社团':'服务意向'),field('team','团队名称与成员','textarea',{stepId:'detail'})];trigger='mode';value='团队报名';target='team';
 }
 f.rules=[{id:crypto.randomUUID(),name:spec[2],priority:10,logic:'and',conditions:[{fieldId:trigger,op:'eq',value}],actions:[{type:'show',targetId:target},{type:'required',targetId:target,value:true}]}];return f;
}
