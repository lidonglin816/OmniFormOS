import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createExamService} from '../src/exam-service.mjs';
import {monitorExam,reviewSignals} from '../public/examcraft-learning-model.js';
import {seedExamCraft,makePaper,addQuestion} from '../public/examcraft-model.js';

test('进度与选项统计区分未开始、作答中、待批阅；不输出邀请与答案',()=>{
 const state={exams:[{id:'e',paperId:'p',participants:[{id:'s',name:'甲',code:'secret'},{id:'z',name:'乙'}]}],papers:[{id:'p',items:[{id:'i',question:{stem:'题目',options:['甲','乙'],answer:[0]}}]}],attempts:[{id:'a',examId:'e',studentId:'s',status:'answering',deadline:2000,paper:{items:[{id:'i'}]},answers:{i:[1]},secret:'bearer'}]};
 const data=monitorExam(state,'e',1000);assert.equal(data.rows[0].completed,1);assert.equal(data.rows[1].status,'未开始');assert.equal(data.questions[0].options[1].count,0);assert.ok(!JSON.stringify(data).includes('secret'));assert.ok(!JSON.stringify(data).includes('bearer'));
 state.attempts[0].status='pending';state.attempts[0].grades=[{itemId:'i',pending:true}];assert.equal(monitorExam(state,'e').questions[0].sample,0);assert.equal(monitorExam(state,'e').questions[0].options[1].count,1);
});
test('审核提示核对原文与重复选项，不声称答案已验证',()=>{
 assert.ok(reviewSignals({options:['A','A'],sourceId:'s',sourceQuote:'伪造'},[{id:'s',text:'原文'}]).includes('来源引文待核对'));
 assert.equal(reviewSignals({topic:'知识点',explanation:'解析',options:['A','B'],sourceId:'s',sourceQuote:'原文'},[{id:'s',text:'原文'}]).length,0);
});
test('错题练习验证本人权限、考试结束限制，独立记录且不更改正式成绩',async()=>{
 const service=createExamService(':memory:');const server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://local').pathname));await new Promise(r=>server.listen(0,'127.0.0.1',r));let cookie='';
 const call=async(path,body,token,teacher=false)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/exam${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(teacher?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,...await r.json()};};
 try{const legacy=seedExamCraft();legacy.questions.forEach(q=>q.reviewStatus='approved');const p=makePaper('练习验收');addQuestion(p,legacy.questions.find(q=>q.type==='single'));legacy.papers.push(p);
 await call('/bootstrap',{legacy,password:'learning-test-password'},null,true);
 const pub=await call('/publish',{paperId:p.id,startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),participants:[{id:'s',name:'测试'}]},null,true);
 const started=await call('/public/'+pub.result.participants[0].code+'/start',{studentId:'s',name:'测试'});const path='/attempts/'+started.attempt.id+'/practice';
 assert.equal((await call(path)).status,403);assert.equal((await call(path,undefined,started.token)).status,409);
 await call('/attempts/'+started.attempt.id+'/submit',{answers:{}},started.token);assert.equal((await call(path,undefined,started.token)).status,409);
 assert.equal((await call('/monitor/'+pub.result.id)).status,401);assert.equal((await call('/monitor/'+pub.result.id,undefined,null,true)).rows[0].status,'已评分');
 await call('/close',{id:pub.result.id},null,true);
 const practice=await call(path,undefined,started.token);assert.equal(practice.items.length,1);assert.equal(practice.items[0].question.answer,undefined);
 assert.equal((await call(path,{answers:{bad:[0]}},started.token)).status,400);
 assert.equal((await call(path,{answers:{[p.items[0].id]:[99]}},started.token)).status,400);
 const result=await call(path,{answers:{[p.items[0].id]:p.items[0].question.answer}},started.token);assert.equal(result.correct,1);
 const original=service.read().state.attempts[0];assert.equal(original.total,0);assert.equal(original.practiceHistory.length,1);assert.deepEqual(original.answers,{});
 }finally{await new Promise(r=>server.close(r));service.close();}
});
