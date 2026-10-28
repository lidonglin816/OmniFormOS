import {makePaper,addQuestion} from '../public/examcraft-model.js';
let cookie='';const base='http://127.0.0.1:3100/api/exam';
async function api(path,body){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}
let saved=await api('/bootstrap',{localWorkspace:true});const s=saved.state;const paper=makePaper('分析中心验收测试 · 非正式教学数据');
for(const type of ['single','multiple','fill','short']){const q=structuredClone(s.questions.find(q=>q.type===type));if(!q)continue;q.reviewStatus='approved';q.points=25;addQuestion(paper,q);}
s.papers.push(paper);saved=await api('/state',{state:s,revision:saved.revision,message:'建立隔离验收考试'});
const published=await api('/publish',{paperId:paper.id,startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),participants:Array.from({length:7},(_,i)=>({id:'qa-'+i,name:'验收考生 '+(i+1),className:i<4?'验收一班':'验收二班'}))});
for(const [n,p]of published.result.participants.slice(0,6).entries()){
 const opened=await api('/public/'+p.code+'/start',{studentId:p.id,name:p.name});const answers=Object.fromEntries(paper.items.map((i,index)=>[i.id,['short','calculation','fill'].includes(i.question.type)?i.question.answer:n===0||n+index<5?i.question.answer:[]]));
 const r=await fetch(base+'/attempts/'+opened.attempt.id+'/submit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+opened.token},body:JSON.stringify({answers})});const submitted=await r.json();if(!r.ok)throw new Error(submitted.error);
 if(n!==5)for(const g of submitted.attempt.grades.filter(g=>g.pending))await api('/review',{attemptId:opened.attempt.id,itemId:g.itemId,score:n===0?g.max:Math.max(0,g.max-n*5),comment:'隔离验收测试：依据测试评分标准复核'});
}
const result=await api('/analytics');console.log(JSON.stringify({metrics:result.metrics,charts:{topics:result.topics.length,types:result.types.length,classes:result.classes.length},database:'artifacts/exam-analytics-ui.sqlite'}));
