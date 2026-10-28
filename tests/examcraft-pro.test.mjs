import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExamService } from '../src/exam-service.mjs';
import { seedExamCraft, makePaper, addQuestion } from '../public/examcraft-model.js';
import { migrateExam, assemblePaper, examAnalytics } from '../public/examcraft-pro-model.js';

test('数据迁移保留旧题目、试卷与答案，新增审核与版本字段',()=>{const old=seedExamCraft(),s=migrateExam(old);assert.equal(s.questions.length,old.questions.length);assert.deepEqual(s.questions[0].answer,old.questions[0].answer);assert.equal(s.questions[0].id,old.questions[0].id);assert.equal(s.questions[0].reviewStatus,'pending');assert.equal(s.version,2);});
test('约束组卷精确控制题型和总分，拒绝未审核、重复及知识点缺失',()=>{const s=migrateExam(seedExamCraft());assert.throws(()=>assemblePaper(s.questions,{counts:{single:2},total:100}),/不足/);s.questions.forEach(q=>q.reviewStatus='approved');const p=assemblePaper(s.questions,{counts:{single:2,short:1},total:100,ratios:[30,50,20],topics:[s.questions[0].topic,s.questions[4].topic]});assert.equal(p.items.length,3);assert.equal(p.items.reduce((n,i)=>n+i.question.points,0),100);assert.ok(p.items.some(i=>i.question.type==='short'));assert.throws(()=>assemblePaper(s.questions,{counts:{single:1},total:100,topics:['不存在']}),/不足|覆盖/);assert.throws(()=>assemblePaper(s.questions,{counts:{single:1},total:100,ratios:[30,30,20]}),/100/);});
test('知识点覆盖百分比与题型数量同时满足，无法满足时明确拒绝',()=>{const s=migrateExam(seedExamCraft());s.questions.forEach(q=>q.reviewStatus='approved');const a=s.questions[0].topic,b=s.questions[4].topic;const p=assemblePaper(s.questions,{counts:{single:2,short:2},total:100,topicWeights:{[a]:50,[b]:50}});assert.equal(p.items.filter(i=>i.question.topic===a).length,2);assert.equal(p.items.filter(i=>i.question.type==='single').length,2);assert.throws(()=>assemblePaper(s.questions,{counts:{single:3},total:100,topicWeights:{[a]:100}}),/不能同时满足/);assert.throws(()=>assemblePaper(s.questions,{counts:{single:2},total:100,topicWeights:{[a]:50}}),/100/);});
test('后端权限、考试、评分、持久化和未连接 AI 完整闭环',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'omniform-exam-')),filename=join(dir,'exam.sqlite');let service=createExamService(filename);
  const server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://local').pathname));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let cookie='';
  async function req(path,body,token,asTeacher=true){const r=await fetch(base+'/api/exam'+path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(asTeacher&&cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,...await r.json()};}
  try {
    assert.equal((await req('/state')).status,401);
    const legacy=seedExamCraft();assert.equal((await req('/bootstrap',{legacy})).status,401);
    let state=await req('/bootstrap',{legacy,password:'test-teacher-password'});assert.equal(state.status,200);const originalId=state.state.questions[0].id;
    const all=state.state;all.questions.forEach(q=>q.reviewStatus='approved');const p=makePaper('服务端验收考试');for(const type of ['single','multiple','fill','calculation']){let q=all.questions.find(q=>q.type===type);if(!q){q={...structuredClone(all.questions.find(q=>q.type==='short')),id:type,stem:type+'验收题',type,answer:type==='fill'?'42':'参考推导',keywords:['参考','推导']};all.questions.push(q);}addQuestion(p,q);}all.papers.push(p);
    state=await req('/state',{state:all,revision:state.revision,message:'验收保存'});assert.equal(state.status,200);
    assert.equal((await req('/state',{state:all,revision:state.revision-1})).status,409);
    const pub=await req('/publish',{paperId:p.id,startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),participants:[{id:'001',name:'测试考生'}]});assert.equal(pub.status,200);const invitation=pub.result.participants[0].code;
    assert.equal((await req('/public/'+invitation+'/start',{studentId:'other',name:'测试考生'},null,false)).status,403);
    const opened=await req('/public/'+invitation+'/start',{studentId:'001',name:'测试考生'},null,false);assert.equal(opened.status,200);const a=opened.attempt,token=opened.token;
    assert.equal(a.paper.items[0].question.answer,undefined);assert.equal(a.paper.items[0].question.keywords,undefined);assert.equal(a.secret,undefined);
    assert.equal((await req('/attempts/'+a.id,undefined,'wrong',false)).status,403);
    const answers=Object.fromEntries(p.items.map(i=>[i.id,i.question.answer]));const saved=await req('/attempts/'+a.id+'/save',{answers,flags:[p.items[0].id]},token,false);assert.equal(saved.status,200);assert.equal(saved.attempt.flags.length,1);
    const concurrent=await req('/state',{state:pub.state,revision:pub.revision,message:'教师编辑与考生保存并发'});assert.equal(concurrent.status,200);assert.deepEqual(concurrent.state.attempts.find(x=>x.id===a.id).answers,answers);
    const submitted=await req('/attempts/'+a.id+'/submit',{answers},token,false);assert.equal(submitted.status,200);assert.equal(submitted.attempt.pending,1);assert.equal(submitted.attempt.total,20);assert.equal(submitted.attempt.passed,null);
    assert.equal((await req('/attempts/'+a.id+'/save',{answers:{}},token,false)).status,409);
    assert.equal((await req('/review',{attemptId:a.id,itemId:p.items[3].id,score:100,comment:'测试'})).status,400);
    const reviewed=await req('/review',{attemptId:a.id,itemId:p.items[3].id,score:8,comment:'推导正确，扣除单位缺失分'});assert.equal(reviewed.status,200);assert.equal(reviewed.state.attempts[0].status,'graded');assert.equal(reviewed.state.attempts[0].total,28);
    const stats=examAnalytics(reviewed.state);assert.equal(stats.count,1);assert.equal(stats.bins.reduce((a,b)=>a+b),1);
    if(!process.env.OMNIFORM_AI_API_KEY)assert.equal((await req('/ai',{config:{count:1,types:['single']},prompt:'测试'})).status,503);
    service.close();service=createExamService(filename);const reopened=await req('/state');assert.equal(reopened.status,200);assert.equal(reopened.state.questions[0].id,originalId);assert.equal(reopened.state.attempts[0].total,28);
    // Force a deadline in server-owned data: late saves cannot replace existing answers.
    const pub2=await req('/publish',{paperId:p.id,startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),participants:[{id:'002',name:'到时考生'}]});
    const started2=await req('/public/'+pub2.result.participants[0].code+'/start',{studentId:'002',name:'到时考生'},null,false);
    service.mutate(s=>{s.attempts.find(a=>a.id===started2.attempt.id).deadline=Date.now()-1000;});
    const late=await req('/attempts/'+started2.attempt.id+'/save',{answers},started2.token,false);assert.equal(late.status,409);
    const expired=await req('/attempts/'+started2.attempt.id,undefined,started2.token,false);assert.equal(expired.attempt.status,'graded');assert.equal(expired.attempt.total,0);assert.equal(expired.attempt.autoSubmitted,true);
    // Same invitation resumes the existing answer sheet, never creates a duplicate.
    const resumed=await req('/public/'+invitation+'/start',{studentId:'001',name:'测试考生'},null,false);assert.equal(resumed.attempt.id,a.id);
    const extra=seedExamCraft();extra.questions[0].stem='另一浏览器保留的原题目';const merged=await req('/bootstrap',{legacy:extra,mergeLegacy:true});assert.equal(merged.status,200);assert.ok(merged.state.questions.some(q=>q.id===extra.questions[0].id));assert.equal(merged.state.attempts.find(x=>x.id===a.id).total,28);const backups=await req('/legacy-backups');assert.ok(backups.backups.length>=2);assert.ok(backups.backups.some(b=>b.state.questions[0].stem==='另一浏览器保留的原题目'));
  }finally{await new Promise(r=>server.close(r));service.close();await rm(dir,{recursive:true,force:true});}
});

test('真实 AI 协议调用校验数量、去重、引文并存入人工审核队列',async()=>{
  const oldEnv=Object.fromEntries(['OMNIFORM_AI_BASE_URL','OMNIFORM_AI_API_KEY','OMNIFORM_AI_MODEL'].map(k=>[k,process.env[k]]));let responseQuestions;let received;
  const provider=http.createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;received=JSON.parse(text);res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({choices:[{message:{content:JSON.stringify({questions:responseQuestions})}}]}));});await new Promise(r=>provider.listen(0,'127.0.0.1',r));
  process.env.OMNIFORM_AI_BASE_URL='http://127.0.0.1:'+provider.address().port+'/v1';process.env.OMNIFORM_AI_API_KEY='test-provider-key';process.env.OMNIFORM_AI_MODEL='test-structured-model';
  const service=createExamService(':memory:');const server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://local').pathname));await new Promise(r=>server.listen(0,'127.0.0.1',r));let cookie='';
  const send=async(path,body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/exam'+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,...await r.json()};};
  try{const initial=await send('/bootstrap',{password:'test-teacher-password',legacy:seedExamCraft()});const source=initial.state.sources[0];const config={count:1,types:['single'],sourceId:source.id,bindSource:true,difficulty:'30,50,20'};
    responseQuestions=[{type:'single',stem:'根据给定资料，必填检查在记录提交时如何处理缺失信息？',options:['拒绝提交','自动忽略'],answer:[0],points:5,difficulty:2,topic:'字段校验',sourceRef:'第 1 行',sourceQuote:'必填规则用于阻止缺少必要信息的记录提交。',explanation:'依据原文，必填阻止缺失必要信息的提交。'}];
    const generated=await send('/ai',{prompt:'生成一道检查理解的题',config});assert.equal(generated.status,200);assert.equal(received.model,'test-structured-model');assert.equal(generated.state.questions[0].reviewStatus,'pending');assert.equal(generated.state.questions[0].origin,'AI 生成');assert.equal(generated.state.questions[0].sourceId,source.id);assert.equal(generated.state.questions[0].answer[0],0);
    assert.equal((await send('/ai',{prompt:'重复生成',config})).status,409);
    responseQuestions[0].stem='新的题干';responseQuestions[0].sourceQuote='原文不存在的引文';assert.equal((await send('/ai',{prompt:'测试伪造引文',config})).status,502);
    responseQuestions[0].sourceQuote='必填规则用于阻止缺少必要信息的记录提交。';responseQuestions[0].answer=[9];assert.equal((await send('/ai',{prompt:'测试无效答案',config})).status,400);
    assert.equal(service.read().state.questions.length,initial.state.questions.length+1);
  }finally{await new Promise(r=>server.close(r));await new Promise(r=>provider.close(r));service.close();for(const[k,v]of Object.entries(oldEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
