import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createFlowService } from '../src/flow-service.mjs';
import { seedFlowForm } from '../public/flowform-model.js';
import { extraFlowTemplates } from '../public/scenario-catalog.js';

const request=(method,payload)=>{const req=Readable.from(payload?[JSON.stringify(payload)]:[]);req.method=method;req.headers={host:'127.0.0.1:3000',...(payload?{'content-type':'application/json'}:{})};return req;};
const response=()=>{let status,raw='';return{writeHead(code){status=code;return this;},end(value=''){raw+=value;},get(){return{status,body:JSON.parse(raw)}}};};
async function call(service,path,method='GET',payload){const req=request(method,payload),res=response();assert.equal(await service.handle(req,res,path),true);return res.get();}

test('校园生活模板通过真实 API 保存，借用审批按天数执行',async()=>{
 const service=createFlowService(':memory:');
 try{
  await call(service,'/api/flow/bootstrap','POST',{});
  for(const t of extraFlowTemplates){const r=await call(service,'/api/flow/template','POST',{template:t[0]});assert.equal(r.status,200);assert.ok(r.body.result.name);assert.ok(service.read().state.definitions.some(f=>f.id===r.body.result.id));}
  const f=service.read().state.definitions.find(f=>f.template==='daily-borrow');
  await call(service,'/api/flow/publish','POST',{flowId:f.id,actor:'designer'});
  const r=await call(service,'/api/flow/run','POST',{flowId:f.id,data:{title:'借用测试',days:8,amount:0}});
  assert.equal(r.status,200);
  const first=await call(service,'/api/flow/action','POST',{runId:r.body.result.id,action:'approve',actor:'manager',comment:'同意'});
  assert.equal(first.body.result.waitingFor,'director');
 }finally{service.close();}
});

test('FlowForm 服务迁移、发布、条件执行和持久化形成闭环',async()=>{
  const service=createFlowService(':memory:');const boot=await call(service,'/api/flow/bootstrap','POST',{legacy:seedFlowForm()});assert.equal(boot.status,200);const flow=boot.body.state.definitions[0];
  const published=await call(service,'/api/flow/publish','POST',{flowId:flow.id,actor:'designer'});assert.equal(published.status,200);assert.equal(published.body.result.status,'published');
  const run=await call(service,'/api/flow/run','POST',{flowId:flow.id,data:{title:'大额报销',amount:1500,days:1}});assert.equal(run.status,200);assert.equal(run.body.result.waitingFor,'manager');
  const first=await call(service,'/api/flow/action','POST',{runId:run.body.result.id,action:'approve',actor:'manager',comment:'同意'});assert.equal(first.body.result.waitingFor,'finance');
  const second=await call(service,'/api/flow/action','POST',{runId:run.body.result.id,action:'approve',actor:'finance',comment:'确认'});assert.equal(second.body.result.status,'approved');
  assert.equal(service.read().state.runs[0].status,'approved');assert.equal(service.read().state.versions.length,1);service.close();
});

test('未配置模型时 AI 端点明确失败且不写入伪造流程',async()=>{
  const service=createFlowService(':memory:');await call(service,'/api/flow/bootstrap','POST',{legacy:seedFlowForm()});const before=service.read().state.definitions.length;const result=await call(service,'/api/flow/ai','POST',{prompt:'创建采购审批'});assert.equal(result.status,503);assert.match(result.body.error,/尚未配置 AI 服务/);assert.equal(service.read().state.definitions.length,before);service.close();
});
