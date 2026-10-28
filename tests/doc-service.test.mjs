import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createDocService } from '../src/doc-service.mjs';
import { seedDocMorph,confirmAll } from '../public/docmorph-model.js';

const request=(method,payload)=>{const req=Readable.from(payload?[JSON.stringify(payload)]:[]);req.method=method;req.headers={host:'127.0.0.1:3000',...(payload?{'content-type':'application/json'}:{})};return req;};
const response=()=>{let status,raw='';return{writeHead(code){status=code;return this;},end(value=''){raw+=value;},get(){return{status,body:JSON.parse(raw)}}};};
async function call(service,path,method='GET',payload){const req=request(method,payload),res=response();assert.equal(await service.handle(req,res,path),true);return res.get();}

test('DocMorph 从复核、多步骤发布到真实提交和版本回滚形成闭环',async()=>{
  const service=createDocService(':memory:');await call(service,'/api/doc/bootstrap','POST',{});const doc=seedDocMorph().documents[0];confirmAll(doc);
  const steps=[{id:'identity',name:'个人信息',fieldIds:doc.fields.slice(0,4).map(f=>f.id)},{id:'work',name:'工作信息',fieldIds:doc.fields.slice(4).map(f=>f.id)}];
  const published=await call(service,'/api/doc/publish','POST',{document:doc,steps,name:'入职登记'});assert.equal(published.status,200);assert.equal(published.body.result.version,1);assert.equal(published.body.result.steps.length,2);
  const form=published.body.result,values=Object.fromEntries(doc.fields.map(f=>[f.id,f.type==='checkbox'?true:f.type==='number'?100:f.type==='select'?f.options[0]:f.type==='email'?'user@example.com':f.type==='tel'?'13800138000':f.type==='date'?'2026-10-18':'测试']));
  const submitted=await call(service,`/api/doc/public/${form.token}/submit`,'POST',{values});assert.equal(submitted.status,201);assert.equal(service.read().state.records.length,1);
  const second=await call(service,'/api/doc/publish','POST',{document:doc,steps,name:'入职登记'});assert.equal(second.body.result.version,2);const firstVersion=second.body.state.versions.find(v=>v.version===1);
  const rolled=await call(service,'/api/doc/form-action','POST',{formId:form.id,action:'rollback',versionId:firstVersion.id});assert.equal(rolled.body.result.version,3);assert.equal(service.read().state.versions.length,3);service.close();
});

test('DocMorph 拒绝未复核发布，且未配置模型时不伪造 AI 结果',async()=>{
  const saved=[process.env.OMNIFORM_AI_BASE_URL,process.env.OMNIFORM_AI_API_KEY,process.env.OMNIFORM_AI_MODEL];delete process.env.OMNIFORM_AI_BASE_URL;delete process.env.OMNIFORM_AI_API_KEY;delete process.env.OMNIFORM_AI_MODEL;
  const service=createDocService(':memory:');await call(service,'/api/doc/bootstrap','POST',{});const doc=seedDocMorph().documents[0];
  const publish=await call(service,'/api/doc/publish','POST',{document:doc});assert.equal(publish.status,400);assert.match(publish.body.error,/人工复核/);
  const ai=await call(service,'/api/doc/ai','POST',{document:doc,prompt:'识别所有字段'});assert.equal(ai.status,503);assert.match(ai.body.error,/尚未配置 AI 服务/);service.close();[process.env.OMNIFORM_AI_BASE_URL,process.env.OMNIFORM_AI_API_KEY,process.env.OMNIFORM_AI_MODEL]=saved;
});
