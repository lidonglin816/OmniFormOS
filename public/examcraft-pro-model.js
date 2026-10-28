import { clone, validateQuestion, makePaper, addQuestion, totalPoints } from './examcraft-model.js';
export const textQuestion = q => ['short','calculation','fill'].includes(q.type);
export const subjective = q => ['short','calculation'].includes(q.type);
export const signature = q => String(q.stem).normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
export function migrateExam(input = {}) {
  const s = clone(input); s.questions ||= []; s.papers ||= []; s.sources ||= []; s.attempts ||= []; s.drafts ||= {}; s.exams ||= []; s.audit ||= [];
  for (const q of s.questions) { q.category ||= '未分类'; q.tags ||= []; q.reviewStatus ||= q.origin === '手动创建' || q.origin === '导入题库' ? 'pending' : 'pending'; q.revision ||= 1; q.history ||= []; }
  s.version = 2; return s;
}
export function assemblePaper(questions, config) {
  const counts = config.counts || {}; const requested = Object.entries(counts).filter(([,n]) => Number(n)>0);
  if (!requested.length || requested.some(([,n]) => !Number.isInteger(Number(n)) || n>200)) throw new Error('请配置有效题型数量（总计不超过 200 题）');
  const count = requested.reduce((n,[,v])=>n+Number(v),0);
  if (count>200) throw new Error('单卷最多 200 题');
  const ratios = (config.ratios || [30,50,20]).map(Number);
  if (ratios.length!==3 || ratios.some(n=>!Number.isFinite(n)||n<0) || ratios.reduce((a,b)=>a+b,0)!==100) throw new Error('难度比例之和必须为 100%');
  const weights = config.topicWeights || {};
  const weightedTopics=Object.keys(weights);
  if(weightedTopics.length && (Object.values(weights).some(v=>!Number.isFinite(v)||v<=0)||Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-100)>0.001))throw new Error('知识点覆盖比例之和必须为 100%');
  const topics = weightedTopics.length?weightedTopics:config.topics || [];
  const candidates = questions.filter(q=>q.reviewStatus==='approved' && (!topics.length || topics.includes(q.topic)));
  const targets = ratios.map(r=>count*r/100), used=[0,0,0], chosen=[], seen=new Set();
  let slots=requested.flatMap(([type,n])=>Array.from({length:Number(n)},()=>({type})));
  if(weightedTopics.length){
    const quotas=weightedTopics.map(name=>({name,raw:count*weights[name]/100,n:Math.floor(count*weights[name]/100)}));
    const left=count-quotas.reduce((n,q)=>n+q.n,0);[...quotas].sort((a,b)=>(b.raw-b.n)-(a.raw-a.n)).slice(0,left).forEach(q=>q.n++);
    // Bipartite maximum flow enforces type counts and chapter quotas together.
    const types=requested.map(([t])=>t),source=0,firstType=1,firstTopic=firstType+types.length,sink=firstTopic+quotas.length,graph=Array.from({length:sink+1},()=>[]);
    const edge=(a,b,cap)=>{const forward={to:b,cap,original:cap,rev:graph[b].length},back={to:a,cap:0,original:0,rev:graph[a].length};graph[a].push(forward);graph[b].push(back);return forward;};
    requested.forEach(([,n],i)=>edge(source,firstType+i,Number(n)));quotas.forEach((q,i)=>edge(firstTopic+i,sink,q.n));
    const pairs=[];types.forEach((type,i)=>quotas.forEach((q,j)=>pairs.push({type,topic:q.name,e:edge(firstType+i,firstTopic+j,new Set(candidates.filter(c=>c.type===type&&c.topic===q.name).map(signature)).size)})));
    let flow=0;
    while(true){const parent=Array(sink+1).fill(null),queue=[source];parent[source]=[-1,-1];for(let k=0;k<queue.length&&!parent[sink];k++){const u=queue[k];graph[u].forEach((e,i)=>{if(e.cap>0&&!parent[e.to]){parent[e.to]=[u,i];queue.push(e.to);}});}if(!parent[sink])break;let n=Infinity;for(let v=sink;v!==source;){const[u,i]=parent[v];n=Math.min(n,graph[u][i].cap);v=u;}for(let v=sink;v!==source;){const[u,i]=parent[v],e=graph[u][i];e.cap-=n;graph[v][e.rev].cap+=n;v=u;}flow+=n;}
    if(flow!==count)throw new Error('已审核题库不能同时满足题型数量与知识点覆盖比例，请调整配置或补充题目');
    slots=pairs.flatMap(({type,topic,e})=>Array.from({length:e.original-e.cap},()=>({type,topic})));
  }
  for (const {type,topic} of slots) {
    const pool=candidates.filter(q=>q.type===type&&(!topic||q.topic===topic)&&!seen.has(signature(q)));
    pool.sort((a,b)=>{ const bucket=q=>q.difficulty<=2?0:q.difficulty===3?1:2; return (targets[bucket(b)]-used[bucket(b)])-(targets[bucket(a)]-used[bucket(a)]) || (chosen.some(q=>q.topic===a.topic)?1:0)-(chosen.some(q=>q.topic===b.topic)?1:0); });
    const q=pool[0]; if(!q) throw new Error(`已审核且不重复的「${type}」题目不足，请补充题库`);
    chosen.push(q); seen.add(signature(q)); used[q.difficulty<=2?0:q.difficulty===3?1:2]++;
  }
  if (topics.some(t=>!chosen.some(q=>q.topic===t))) throw new Error('当前题型与数量无法覆盖所有指定知识点，请增加题量或调整题型');
  const total=Number(config.total); if(!Number.isFinite(total)||total<=0||total>count*100||total<count*0.01) throw new Error('总分不符合每题 0.01–100 分限制');
  const p=makePaper(config.name||'智能组卷'); p.minutes=Number(config.minutes||30); p.passPercent=Number(config.passPercent??60);
  chosen.forEach((q,i)=>{const item=clone(q); item.points=i===count-1?Math.round((total-Math.round(total/count*100)/100*(count-1))*100)/100:Math.round(total/count*100)/100; validateQuestion(item); addQuestion(p,item);});
  p.assembly={ratios,actual:used.map(n=>Math.round(n/count*100)),topics,topicWeights:weights,warnings:used.some((n,i)=>Math.abs(n-targets[i])>=1)?['受题库供给限制，实际难度比例与目标存在偏差，请确认。']:[]};
  return p;
}
export function validatePaper(p) {
  if(!p.items?.length) throw new Error('试卷至少需要一道题');
  const seen=new Set(); for(const i of p.items){validateQuestion(i.question); if(seen.has(signature(i.question))) throw new Error('试卷包含重复题干'); seen.add(signature(i.question)); if(i.question.reviewStatus!=='approved') throw new Error('请先审核通过所有题目，再发布考试');}
  return true;
}
export function examAnalytics(s, paperId='') {
  const attempts=s.attempts.filter(a=>a.status==='graded'&&(!paperId||a.paperId===paperId));
  const bins=[0,0,0,0,0], topics={}, questions={}, difficulties=[1,2,3,4,5].map(d=>({name:`难度 ${d}`,score:0,max:0}));
  for(const a of attempts){const pct=100*a.total/totalPoints(a.paper); bins[Math.min(4,Math.floor(pct/20))]++; for(const i of a.paper.items){const g=a.grades.find(g=>g.itemId===i.id);if(!g||g.pending)continue; const q=i.question; const t=topics[q.topic] ||= {name:q.topic,score:0,max:0,count:0}; t.score+=g.score;t.max+=g.max;t.count++;const r=questions[q.id] ||= {id:q.id,name:q.stem,topic:q.topic,correct:0,count:0};r.count++;if(g.score===g.max)r.correct++; const d=difficulties[q.difficulty-1];d.score+=g.score;d.max+=g.max;}}
  return {count:attempts.length,bins,topics:Object.values(topics),questions:Object.values(questions).sort((a,b)=>a.correct/a.count-b.correct/b.count),difficulties,trend:attempts.toSorted((a,b)=>a.submittedAt.localeCompare(b.submittedAt)).map(a=>({name:a.name,at:a.submittedAt,value:Math.round(100*a.total/totalPoints(a.paper))})),mean:attempts.length?Math.round(attempts.reduce((n,a)=>n+100*a.total/totalPoints(a.paper),0)/attempts.length):null};
}
