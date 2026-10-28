import { createHash } from 'node:crypto';
const round=n=>Math.round(n*100)/100;
const avg=a=>a.length?round(a.reduce((s,n)=>s+n,0)/a.length):null;
const rate=(n,d)=>d?round(n/d*100):null;
const labels={single:'单选题',multiple:'多选题',boolean:'判断题',fill:'填空题',short:'简答题',calculation:'计算题'};
export function analytics(state,filters={},now=Date.now()){
 const f=Object.fromEntries(['examId','paperId','className','studentId','from','to','type','topic','attemptIds'].map(k=>[k,String(filters[k]||'')]));
 for(const k of ['from','to'])if(f[k]&&!Number.isFinite(Date.parse(f[k])))throw new Error('日期筛选无效');
 if(f.from&&f.to&&Date.parse(f.from)>Date.parse(f.to))throw new Error('开始日期不能晚于结束日期');
 const exams=(state.exams||[]).filter(e=>(!f.examId||e.id===f.examId)&&(!f.paperId||e.paperId===f.paperId));
 const examMap=new Map(exams.map(e=>[e.id,e]));
 const classOf=a=>a.className||examMap.get(a.examId)?.participants.find(p=>p.id===a.studentId)?.className||'未分班';
 const itemsOf=a=>(a.paper?.items||[]).filter(i=>(!f.type||i.question.type===f.type)&&(!f.topic||(i.question.topic||'未标注')===f.topic));
 const selectedIds=f.attemptIds?new Set(f.attemptIds.split(',')):null;
 const attempts=(state.attempts||[]).filter(a=>(!selectedIds||selectedIds.has(a.id))&&(!f.examId||a.examId===f.examId)&&(!f.paperId||a.paperId===f.paperId)&&(!f.className||classOf(a)===f.className)&&(!f.studentId||(a.studentId||a.id)===f.studentId)&&(!f.from||Date.parse(a.submittedAt||a.startedAt)>=Date.parse(f.from))&&(!f.to||Date.parse(a.submittedAt||a.startedAt)<=Date.parse(f.to))&&itemsOf(a).length);
 const rows=attempts.map(a=>{
  const items=itemsOf(a),grades=items.map(i=>a.grades?.find(g=>g.itemId===i.id));
  const max=items.reduce((n,i)=>n+Number(i.question.points||0),0);
  const valid=a.status==='graded'&&!a.pending&&max>0&&grades.every((g,i)=>g&&!g.pending&&Number.isFinite(g.score)&&g.score>=0&&g.score<=items[i].question.points);
  const score=valid?round(grades.reduce((n,g)=>n+g.score,0)):null;
  const start=Date.parse(a.startedAt),end=Date.parse(a.submittedAt);
  return {id:a.id,examId:a.examId||'',paperId:a.paperId,name:a.name,studentId:a.studentId||a.id,className:classOf(a),paperName:a.paper.name,status:a.status,score,max,percent:valid?rate(score,max):null,passed:valid?score>=max*(Number(a.paper.passPercent??60))/100:null,seconds:Number.isFinite(start)&&Number.isFinite(end)&&end>=start?round((end-start)/1000):null,at:a.submittedAt||a.startedAt,items:items.map(i=>{const g=a.grades?.find(g=>g.itemId===i.id);return {id:i.id,questionId:i.question.id,stem:i.question.stem,topic:i.question.topic||'未标注',type:i.question.type,difficulty:i.question.difficulty,score:g&&!g.pending?g.score:null,max:i.question.points,answer:a.answers?.[i.id]??null,pending:!!g?.pending};})};
 });
 const graded=rows.filter(r=>r.percent!==null),topics=new Map(),types=new Map(),questions=new Map(),heat=new Map();
 const add=(map,key,name,i)=>{const b=map.get(key)||{id:key,name,score:0,max:0,count:0,correct:0};b.score+=i.score;b.max+=i.max;b.count++;if(i.score===i.max)b.correct++;map.set(key,b);return b;};
 for(const r of graded)for(const i of r.items){add(topics,i.topic,i.topic,i);add(types,i.type,labels[i.type]||i.type,i);Object.assign(add(questions,i.questionId+'|'+i.max+'|'+i.stem,i.stem,i),{topic:i.topic,type:i.type,difficulty:i.difficulty,questionId:i.questionId});add(heat,r.className+'\0'+i.topic,r.className,i).topic=i.topic;}
 const finish=m=>[...m.values()].map(b=>({...b,score:round(b.score),max:round(b.max),percent:rate(b.score,b.max),correctRate:rate(b.correct,b.count)}));
 const bins=['0–59','60–69','70–79','80–89','90–100'].map((name,index)=>({name,index,count:0,ids:[]}));
 for(const r of graded){const i=r.percent<60?0:r.percent<70?1:r.percent<80?2:r.percent<90?3:4;bins[i].count++;bins[i].ids.push(r.id);}
 const duration=['0–15 分钟','15–30 分钟','30–60 分钟','60 分钟以上'].map(name=>({name,count:0,ids:[]}));
 for(const r of rows.filter(r=>r.seconds!==null)){const n=r.seconds<900?0:r.seconds<1800?1:r.seconds<3600?2:3;duration[n].count++;duration[n].ids.push(r.id);}
 const group=(key,list)=>{const map=new Map();for(const r of list){const k=key(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r);}return [...map].map(([name,rs])=>({name,count:rs.length,percent:avg(rs.filter(r=>r.percent!==null).map(r=>r.percent)),ids:rs.map(r=>r.id)}));};
 const trend=group(r=>(r.examId||r.paperId),graded).map(g=>({...g,name:graded.find(r=>(r.examId||r.paperId)===g.name)?.paperName,at:graded.filter(r=>g.ids.includes(r.id)).map(r=>r.at).sort()[0]})).sort((a,b)=>a.at.localeCompare(b.at));
 const participation=group(r=>r.at?.slice(0,10)||'未知日期',rows).map(g=>({...g,submitted:rows.filter(r=>g.ids.includes(r.id)&&r.status!=='answering').length})).sort((a,b)=>a.name.localeCompare(b.name));
 const expected=exams.flatMap(e=>(e.participants||[]).filter(p=>(!f.studentId||p.id===f.studentId)&&(!f.className||(p.className||'未分班')===f.className)).map(p=>({id:e.id+':'+p.id,name:p.name,studentId:p.id,className:p.className||'未分班',paperName:e.name,status:(state.attempts||[]).some(a=>a.examId===e.id&&a.studentId===p.id)?'started':now>Date.parse(e.endsAt)?'absent':'notStarted'})));
 const excluded=rows.filter(r=>r.status==='graded'&&r.percent===null).length;
 const metrics={participants:rows.length,submitted:rows.filter(r=>r.status!=='answering').length,pending:rows.filter(r=>r.status==='pending').length,graded:graded.length,answering:rows.filter(r=>r.status==='answering').length,absent:expected.filter(r=>r.status==='absent').length,notStarted:expected.filter(r=>r.status==='notStarted').length,mean:avg(graded.map(r=>r.percent)),highest:graded.length?Math.max(...graded.map(r=>r.percent)):null,lowest:graded.length?Math.min(...graded.map(r=>r.percent)):null,passRate:rate(graded.filter(r=>r.passed).length,graded.length),averageSeconds:avg(rows.filter(r=>r.seconds!==null).map(r=>r.seconds)),excluded};
 const warnings=[...(graded.length<5?['已完成评分的样本少于 5 份，仅作描述性参考，不推断稳定趋势。']:[]),...(metrics.pending?['待人工批阅答卷不参与成绩、正确率及能力统计。']:[]),...(excluded?['存在缺少评分或满分无效的答卷，已从成绩统计排除。']:[])];
 const profiles=[...new Set(graded.map(r=>r.studentId))].map(id=>{const map=new Map();for(const r of graded.filter(r=>r.studentId===id))for(const i of r.items)add(map,i.topic,i.topic,i);return {id,topics:finish(map)};});
 const result={profiles,filters:f,metrics,rows,expected,bins,duration,topics:finish(topics),types:finish(types),questions:finish(questions).sort((a,b)=>a.correctRate-b.correctRate),heat:finish(heat),trend,participation,classes:group(r=>r.className,graded),warnings,scope:'参考人数按答卷计；同一考试参与令牌仅有一份答卷，不同考试分别计入。日期按提交时间（未交卷按开始时间）。成绩统一为得分率，及格线来自各试卷；知识点正确率为满分作答数 / 已评分作答数，掌握度为得分 / 满分。题型或知识点筛选后按选中题目重新计算。平均耗时使用已交卷且时间完整的答卷。',options:{exams:(state.exams||[]).map(e=>({id:e.id,name:e.name})),papers:(state.papers||[]).map(p=>({id:p.id,name:p.name})),students:[...new Map((state.attempts||[]).map(a=>[a.studentId||a.id,{id:a.studentId||a.id,name:a.name}])).values()],classes:[...new Set((state.exams||[]).flatMap(e=>e.participants.map(p=>p.className||'未分班')).concat(rows.map(r=>r.className)))],topics:[...new Set((state.attempts||[]).flatMap(a=>a.paper.items.map(i=>i.question.topic||'未标注')))]}};
 result.fingerprint=createHash('sha256').update(JSON.stringify({f,rows,expected})).digest('hex');result.generatedAt=new Date(now).toISOString();return result;
}
export function evidenceReport(data){const m=data.metrics,weak=data.topics.filter(t=>t.percent<60);return `统计依据：${data.generatedAt}；参考 ${m.participants} 份，已交卷 ${m.submitted} 份，完成评分 ${m.graded} 份，待批阅 ${m.pending} 份。\n${m.graded?`平均得分率 ${m.mean}%，及格率 ${m.passRate}%，最高 ${m.highest}%，最低 ${m.lowest}%。`:'暂无完成评分的答卷，暂不生成表现结论。'}\n${weak.length?'优先复习：'+weak.map(t=>`${t.name}（得分率 ${t.percent}%，${t.count} 次作答）`).join('、')+'。建议回看相关概念和已审核解析，再针对错题练习。':'当前筛选范围内没有得分率低于 60% 的知识点；这不能证明已全面掌握。'}\n${data.types.map(t=>`${t.name}：得分率 ${t.percent}%，${t.count} 次作答。`).join('\n')}\n${data.warnings.join('\n')}\n${data.scope}`;}
export const resultColumns=['姓名','考生编号','班级','考试','状态','得分','满分','得分率(%)','及格','答题时长(秒)','提交/开始时间'];
export const resultValues=r=>[r.name,r.studentId,r.className,r.paperName,r.status==='graded'?'已评分':r.status==='pending'?'待批阅':'未交卷',r.score,r.max,r.percent,r.passed===null?'':r.passed?'是':'否',r.seconds,r.at];
export function resultsCsv(data){const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';return '\uFEFF'+[resultColumns,...data.rows.map(resultValues)].map(r=>r.map(cell).join(',')).join('\r\n');}
