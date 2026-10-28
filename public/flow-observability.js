// Shared, side-effect-free inspection of persisted workflow snapshots.
export function flowTrace(run, now = Date.now()) {
 const entries=run.timeline||[],path=run.path||[];
 return run.flow.nodes.map(node=>{
  const events=entries.filter(e=>e.nodeId===node.id),entered=events.filter(e=>e.type==='enter'),latest=entered.at(-1);
  const current=run.currentNodeId===node.id;
  const active=current&&['pending','waiting','running','returned','failed'].includes(run.status);
  const state=active?(run.status==='failed'?'failed':run.status==='returned'?'returned':'waiting'):path.includes(node.id)||entered.length?'visited':'unvisited';
  const wait=events.findLast(e=>['waiting','delay'].includes(e.type));
  const finish=wait?events.find(e=>Date.parse(e.at)>=Date.parse(wait.at)&&['approve','reject','return','resume'].includes(e.type)):null;
  return {id:node.id,label:node.label,type:node.type,state,visits:entered.length,
   waitingMinutes:wait&&active?Math.max(0,Math.round((now-Date.parse(wait.at))/60000)):null,
   completedMinutes:wait&&finish?Math.max(0,Math.round((Date.parse(finish.at)-Date.parse(wait.at))/60000)):null,
   enteredAt:latest?.at,events,config:node.config||{},
   routes:run.flow.edges.filter(e=>e.source===node.id).map(e=>({port:e.port,target:run.flow.nodes.find(n=>n.id===e.target)?.label||e.target}))};
 });
}
export function waitingQueue(runs,filters={},now=Date.now()) {
 return runs.filter(r=>r.mode==='live'&&['pending','waiting'].includes(r.status)&&(!filters.flowId||r.flowId===filters.flowId)&&(!filters.status||r.status===filters.status)&&(!filters.type||r.flow.campusTemplate===filters.type)&&(!filters.from||r.startedAt>=filters.from)&&(!filters.to||r.startedAt<=filters.to)).map(r=>{
  const node=r.flow.nodes.find(n=>n.id===r.currentNodeId),wait=r.timeline.findLast(e=>e.nodeId===r.currentNodeId&&['waiting','delay'].includes(e.type));
  const since=wait?.at||r.startedAt;
  return {id:r.id,title:r.title,flowName:r.flow.name,node:node?.label||r.currentNodeId,status:r.status,
   actors:(r.parallelPending||[r.waitingFor]).filter(Boolean).map(id=>r.flow.actors.find(a=>a.id===id)?.name||id),
   since,minutes:Math.max(0,Math.floor((now-Date.parse(since))/60000)),overdue:!!r.dueAt&&Date.parse(r.dueAt)<now};
 }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||b.minutes-a.minutes);
}
export function blueprintSummary(before,after) {
 const diff=(old=[],next=[])=>({added:next.filter(n=>!old.some(o=>o.id===n.id)).map(n=>n.label||n.name||n.id),removed:old.filter(o=>!next.some(n=>o.id===n.id)).map(n=>n.label||n.name||n.id),changed:next.filter(n=>{const oldItem=old.find(o=>o.id===n.id);return oldItem&&JSON.stringify(oldItem)!==JSON.stringify(n);}).map(n=>n.label||n.name||n.id)});
 return {nodes:diff(before?.nodes,after?.nodes),fields:diff(before?.form?.fields,after?.form?.fields),edges:diff(before?.edges,after?.edges)};
}
