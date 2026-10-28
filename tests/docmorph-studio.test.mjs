import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createDocService} from '../src/doc-service.mjs';
import {seedDocMorph,makeDocument,segmentsFromText,confirmAll} from '../public/docmorph-model.js';
import {reviewIssues,saveMappingTemplate,applyTemplate,extractRuleCandidates,applyRuleCandidate,runExtractionRule,extractDocumentValues} from '../public/docmorph-studio-model.js';
import {fieldEvidence} from '../public/docmorph-evidence.js';
import {verifyDocumentBytes} from '../public/docmorph-file-validation.js';

test('原文规则必须经确认才生效，保留证据并清除字段复核状态',()=>{
 const doc=makeDocument('报名表','text',segmentsFromText('团队人数（数字）：____\n填写说明：团队人数不得超过5人'));doc.fields[0].type='number';confirmAll(doc);
 const candidates=extractRuleCandidates(doc);assert.equal(candidates.length,1);assert.equal(doc.fields[0].rules.max,undefined);
 applyRuleCandidate(doc,candidates[0]);assert.equal(doc.fields[0].rules.max,5);assert.equal(doc.fields[0].confirmed,false);assert.equal(doc.fields[0].history.length,1);assert.match(doc.fields[0].ruleEvidence.text,/不得超过5/);
 assert.throws(()=>applyRuleCandidate(doc,{...candidates[0],sourceQuote:'假原文'}),/原文证据/);
});
test('映射模板复用保留新文档的字段和来源 ID，不能冒充自动确认',()=>{
 const one=seedDocMorph().documents[0];assert.throws(()=>saveMappingTemplate(one,'模板'),/复核/);confirmAll(one);const template=saveMappingTemplate(one,'登记');
 const two=seedDocMorph().documents[0],source=structuredClone(two.fields[0].source),id=two.fields[0].id;confirmAll(two);applyTemplate(two,template);assert.equal(two.fields[0].id,id);assert.deepEqual(two.fields[0].source,source);assert.equal(two.fields[0].confirmed,false);
 const evidence=fieldEvidence({...two.segments[0],confidence:65,bbox:{x:0,y:0,width:.5,height:.1}},two.id);two.fields[0].source=evidence;two.segments[0].confidence=65;assert.ok(reviewIssues(two.fields[0],two).some(x=>x.includes('80%')));
});
test('文件实际签名校验拒绝伪装文件及零字节，保留正常文本',()=>{
 assert.throws(()=>verifyDocumentBytes('x.pdf',new TextEncoder().encode('<script>bad</script>')),/不符/);assert.throws(()=>verifyDocumentBytes('x.txt',new Uint8Array()),/15 MB/);assert.equal(verifyDocumentBytes('x.txt',new TextEncoder().encode('团队人数：3')),'txt');
});
test('文档迁移、并发版本、任务、原件、发布与筛选导出形成持久闭环',async()=>{
 const service=createDocService(':memory:'),server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://local').pathname));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=async(path,body,raw=false)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/doc${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:raw?Buffer.from(await r.arrayBuffer()):await r.json(),headers:r.headers};};
 try{await call('/bootstrap',{});const doc=seedDocMorph().documents[0];let merged=await call('/documents/merge',{documents:[doc]});assert.equal(merged.body.state.documents.length,1);assert.equal(merged.body.state.documents[0].id,doc.id);
 const old=merged.body.state.documents[0];const next=structuredClone(old);next.name='新报名表';const saved=await call('/document',{document:next,expectedVersion:1});assert.equal(saved.body.result.serverVersion,2);assert.equal((await call('/document',{document:old,expectedVersion:1})).status,409);
 await call('/documents/merge',{documents:[doc]});assert.equal(service.read().state.documents[0].name,'新报名表');assert.ok(service.read().state.documentVersions.length);
 const original=await call('/original/'+doc.id,{name:'source.txt',base64:Buffer.from('实际原件').toString('base64')});assert.equal(original.status,200);assert.equal((await call('/original/'+doc.id,undefined,true)).body.toString(),'实际原件');assert.equal((await call('/original/bad',{name:'bad.pdf',base64:Buffer.from('fake').toString('base64')})).status,400);
 await call('/task',{task:{id:'task',name:'source.txt',status:'failed',error:'解析错误'}});assert.equal(service.read().state.tasks[0].error,'解析错误');await call('/task',{task:{id:'task',status:'done',documentId:doc.id}});assert.equal(service.read().state.tasks.length,1);
 confirmAll(next);const pub=await call('/publish',{document:next});assert.equal(pub.status,200);const form=pub.body.result;const publicForm=await call('/public/'+form.token);assert.equal(publicForm.body.form.fields[0].source,undefined);assert.equal(publicForm.body.form.fields[0].history,undefined);
 const values=Object.fromEntries(next.fields.map(f=>[f.id,f.type==='checkbox'?true:f.type==='number'?2:f.type==='select'?f.options[0]:f.type==='email'?'test@example.com':f.type==='tel'?'13800138000':f.type==='date'?'2026-10-23':'真实报名']));
 assert.equal((await call('/public/'+form.token+'/submit',{values})).status,201);
 const csv=await call('/records/export',{formId:form.id,format:'csv',search:'真实报名'},true);assert.match(csv.body.toString(),/真实报名/);const empty=await call('/records/export',{formId:form.id,format:'csv',search:'不匹配'},true);assert.ok(!empty.body.toString().includes('真实报名'));
 const xlsx=await call('/records/export',{formId:form.id,format:'xlsx'},true);assert.equal(xlsx.body.subarray(0,2).toString(),'PK');
 }finally{await new Promise(r=>server.close(r));service.close();}
});

test('自定义提取规则使用真实原文，拒绝未匹配与复杂表达式',()=>{const doc=makeDocument('材料.txt','text',segmentsFromText('编号：ABC-2026'));runExtractionRule(doc,{id:'rule',label:'登记编号',anchor:'编号',type:'text',pattern:'编号[:：]([A-Z0-9-]+)'});assert.equal(doc.fields.find(f=>f.label==='登记编号').extractedValue,'ABC-2026');assert.equal(extractDocumentValues(doc).find(f=>f.label==='登记编号').value,'ABC-2026');assert.throws(()=>runExtractionRule(doc,{label:'金额',anchor:'不存在',type:'number'}),/未匹配/);assert.throws(()=>runExtractionRule(doc,{label:'错误',anchor:'编号',type:'text',pattern:'(a+)+$'}),/过于复杂/);});
