import { uid } from './model.js';
export const clone = value => JSON.parse(JSON.stringify(value));
export const nodeTypes = { start: '发起申请', condition: '条件分支', approval: '审批节点', notify: '站内通知', end: '流程结束', form: '表单提交', parallel: '并行审批', data: '数据更新', delay: '延迟等待', confirm: '人工确认' };
export const operators = { gt: '大于', gte: '大于或等于', lt: '小于', lte: '小于或等于', eq: '等于', neq: '不等于', contains: '包含', before: '早于', after: '晚于', in: '属于' };
export const runStatuses = { pending: '审批中', approved: '已通过', rejected: '已驳回', withdrawn: '已撤回', returned: '已退回', running: '执行中', failed: '执行异常', draft:'草稿', submitted:'已提交', waiting:'延迟等待', closed:'已结束' };
export const demoActors = [{ id: 'applicant', name: '申请人' }, { id: 'manager', name: '部门主管' }, { id: 'finance', name: '财务负责人' }, { id: 'director', name: '总经理' }];
const now = () => new Date().toISOString();
const node = (id, type, label, x, y, config = {}) => ({ id, type, label, position: { x, y }, config });
const edge = (source, target, port = 'next') => ({ id: uid(), source, target, port });
export function generateFlow(prompt = '报销金额超过1000元需财务负责人审批，其余由主管审批') {
  if (!prompt.trim()) throw new Error('请描述流程需求');
  const threshold = Number(prompt.match(/(?:超过|大于|高于|>=|>)[\s：:]*(\d+(?:\.\d+)?)/)?.[1] || 1000);
  const leave = /请假|休假|借用.*天/.test(prompt);
  const campus = /学生|学院|社团|宿舍/.test(prompt), community = /社区|居民/.test(prompt), borrowing = /物品借用/.test(prompt);
  const actors = clone(demoActors);
  if (campus || community || borrowing) {
    const names = /宿舍/.test(prompt) ? ['学生','宿管','后勤负责人','后勤负责人'] : /社团/.test(prompt) ? ['社团学生','指导老师','学院负责人','学院负责人'] : campus ? ['学生','辅导员','学院负责人','学院负责人'] : community ? ['居民','组织者','社区负责人','社区负责人'] : ['借用人','物品所有者','物品管理员','物品管理员'];
    actors.forEach((a,i)=>a.name=names[i]);
  }
  const field = leave ? 'days' : 'amount';
  const configured = prompt.match(/(?:流程名称|命名为)[：:\s]*([^，。\n]{1,60})/)?.[1];
  const flow = {
    id: uid(), name: configured || (leave ? '请假申请审批' : '费用报销审批'), description: prompt.trim(), revision: 1, status: 'draft', createdAt: now(), actors, field,
    nodes: [node('start', 'start', '提交申请', 330, 30), node('manager', 'approval', '部门主管审批', 330, 160, { assignee: 'manager' }), node('condition', 'condition', leave ? '请假天数判断' : '报销金额判断', 330, 300, { field, operator: 'gt', value: leave && threshold === 1000 ? 3 : threshold }), node('finance', 'approval', leave ? '总经理审批' : '财务负责人审批', 100, 455, { assignee: leave ? 'director' : 'finance' }), node('notify', 'notify', '通知申请人', 330, 610, { recipient: 'applicant', message: '申请已完成全部审批，请查看处理结果。' }), node('end', 'end', '审批完成', 330, 750)],
    edges: [edge('start', 'manager'), edge('manager', 'condition'), edge('condition', 'finance', 'yes'), edge('condition', 'notify', 'no'), edge('finance', 'notify'), edge('notify', 'end')]
  };
  if (campus || community || borrowing) {
    flow.nodes.find(n=>n.id==='manager').label=actors[1].name+'确认';
    flow.nodes.find(n=>n.id==='finance').label=actors[leave?3:2].name+'复核';
    flow.nodes.find(n=>n.id==='condition').label=leave?(borrowing?'借用天数判断':'请假天数判断'):'预算 / 金额判断';
    flow.nodes.find(n=>n.id==='notify').label='通知'+actors[0].name;
  }
  return flow;
}
export function seedFlowForm() { return { version: 1, definitions: [generateFlow()], runs: [], audit: [] }; }
export function validateFlow(flow) {
  const errors = [], nodes = flow.nodes || [], edges = flow.edges || [], ids = new Set(nodes.map(n => n.id));
  if (!flow.name?.trim()) errors.push('请设置流程名称');
  if (!nodes.length || nodes.length > 60) errors.push('流程需要 1–60 个节点');
  if (ids.size !== nodes.length) errors.push('节点 ID 重复');
  if (nodes.filter(n => n.type === 'start').length !== 1) errors.push('流程需要且只能有一个发起节点');
  if (nodes.filter(n => n.type === 'end').length !== 1) errors.push('流程需要且只能有一个结束节点');
  const actorIds = new Set((flow.actors || []).map(a => a.id));
  for (const n of nodes) {
    if (!nodeTypes[n.type] || !n.label?.trim()) errors.push('存在无效节点类型或名称');
    const outgoing = edges.filter(e => e.source === n.id), incoming = edges.filter(e => e.target === n.id);
    if (n.type === 'start' && incoming.length) errors.push('发起节点不能有入线');
    if (n.type !== 'start' && !incoming.length) errors.push(`「${n.label}」缺少入线`);
    if (n.type === 'end' && outgoing.length) errors.push('结束节点不能有出线');
    if (n.type !== 'end' && n.type !== 'condition' && (outgoing.length !== 1 || outgoing[0]?.port !== 'next')) errors.push(`「${n.label}」需要一条下一步连线`);
    if (n.type === 'condition' && (outgoing.length !== 2 || !outgoing.some(e => e.port === 'yes') || !outgoing.some(e => e.port === 'no'))) errors.push(`「${n.label}」需要满足/不满足两条分支`);
    if (n.type === 'condition') {
      const rules = n.config.conditions?.length ? n.config.conditions : [n.config];
      if (!['and', 'or'].includes(n.config.logic || 'and') || rules.some(rule => !String(rule.field || '').trim() || !operators[rule.operator] || rule.value === undefined || rule.value === '')) errors.push(`「${n.label}」条件配置无效`);
    }
    if (['approval','confirm'].includes(n.type) && !actorIds.has(n.config.assignee)) errors.push(`「${n.label}」缺少有效审批人`);
    if(n.config.timeout!==undefined&&(!Number.isFinite(n.config.timeout)||n.config.timeout<=0||n.config.timeout>87600))errors.push(`「${n.label}」审批时限无效`);
    if(n.type==='parallel'&&(!Array.isArray(n.config.assignees)||n.config.assignees.length<2||new Set(n.config.assignees).size!==n.config.assignees.length||n.config.assignees.some(a=>!actorIds.has(a))))errors.push(`「${n.label}」需要至少两位不同的有效审批人`);
    if(n.type==='delay'&&(!Number.isFinite(n.config.minutes)||n.config.minutes<=0||n.config.minutes>525600))errors.push(`「${n.label}」等待分钟数无效`);
    if(n.type==='data'&&(!/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,99}$/.test(n.config.field||'')||['constructor','prototype','__proto__'].includes(n.config.field)||!['string','number','boolean'].includes(typeof n.config.value)))errors.push(`「${n.label}」数据更新字段或值无效`);
    if (n.type === 'notify' && (!actorIds.has(n.config.recipient) || !n.config.message?.trim())) errors.push(`「${n.label}」通知配置不完整`);
  }
  const seenPorts = new Set();
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) errors.push('连线引用了不存在的节点');
    if (e.source === e.target) errors.push('节点不能连接自身');
    if (seenPorts.has(`${e.source}:${e.port}`)) errors.push('同一个输出端口不能连接多个目标');
    seenPorts.add(`${e.source}:${e.port}`);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push('流程存在循环，请使用无环审批结构'); return; }
    if (visited.has(id)) return;
    visiting.add(id); for (const e of edges.filter(e => e.source === id)) if (ids.has(e.target)) visit(e.target);
    visiting.delete(id); visited.add(id);
  }
  for (const n of nodes) visit(n.id);
  const start = nodes.find(n => n.type === 'start');
  if (start) {
    const reached = new Set();
    function reach(id) { if (reached.has(id)) return; reached.add(id); edges.filter(e => e.source === id).forEach(e => reach(e.target)); }
    reach(start.id); if (nodes.some(n => !reached.has(n.id))) errors.push('存在从发起节点无法到达的节点');
  }
  return [...new Set(errors)];
}
export function connectNodes(flow, source, target, port = 'next') {
  const a = flow.nodes.find(n => n.id === source), b = flow.nodes.find(n => n.id === target);
  if (!a || !b || a.type === 'end' || b.type === 'start' || source === target) throw new Error('无效连接：不能自连、从结束节点连出或连入发起节点');
  if (a.type === 'condition' ? !['yes', 'no'].includes(port) : port !== 'next') throw new Error('输出端口不匹配');
  const proposed = { ...flow, edges: [...flow.edges.filter(e => !(e.source === source && e.port === port)), edge(source, target, port)] };
  if (validateFlow(proposed).some(e => e.includes('循环'))) throw new Error('此连线会产生循环');
  flow.edges = proposed.edges; flow.revision++;
}
export function publishFlow(flow) {
  const errors = validateFlow(flow); if (errors.length) throw new Error(errors.join('；'));
  flow.status = 'published'; flow.publishedRevision = flow.revision; flow.publishedAt = now();
}
function event(run, type, message, actor = 'system', nodeId = run.currentNodeId) {
  run.timeline.push({ id: uid(), at: now(), type, message, actor, nodeId });
}
function notify(run, to, message) {
  run.notifications.push({ id: uid(), runId: run.id, to, message, at: now(), read: false, local: true });
  event(run, 'notification', `本地站内通知 → ${run.flow.actors.find(a => a.id === to)?.name || to}：${message}`);
}
export function evaluateCondition(config, data) {
  const compare = rule => {
    const actual = data[rule.field], expected = rule.value;
    switch (rule.operator) {
      case 'gt': case 'gte': case 'lt': case 'lte': { const a=Number(actual), b=Number(expected); if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error(`条件字段 ${rule.field} 必须为有效数值`); return rule.operator==='gt'?a>b:rule.operator==='gte'?a>=b:rule.operator==='lt'?a<b:a<=b; }
      case 'eq': return String(actual ?? '') === String(expected ?? '');
      case 'neq': return String(actual ?? '') !== String(expected ?? '');
      case 'contains': return String(actual ?? '').includes(String(expected ?? ''));
      case 'in': return String(expected ?? '').split(',').map(v=>v.trim()).includes(String(actual ?? ''));
      case 'before': case 'after': { const a=Date.parse(actual),b=Date.parse(expected);if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error(`条件字段 ${rule.field} 必须为有效日期`);return rule.operator==='before'?a<b:a>b; }
      default: throw new Error('未知条件操作符');
    }
  };
  const rules=config.conditions?.length?config.conditions:[config], results=rules.map(compare);
  return (config.logic||'and')==='or'?results.some(Boolean):results.every(Boolean);
}
export function advanceRun(run) {
  const f = run.flow;
  for (let steps = 0; steps <= f.nodes.length; steps++) {
    const n = f.nodes.find(n => n.id === run.currentNodeId); if (!n) throw new Error('执行节点不存在');
    run.path.push(n.id); event(run, 'enter', `进入「${n.label}」`);
    if (n.type === 'end') { run.status = 'approved'; run.completedAt = now(); event(run, 'approved', '流程审批完成'); notify(run, 'applicant', '申请已通过全部审批。'); return; }
    if (['approval','confirm','parallel'].includes(n.type)) { run.status = 'pending'; run.parallelPending=n.type==='parallel'?[...n.config.assignees]:null;run.waitingFor = run.parallelPending?.[0]||n.config.assignee; event(run, 'waiting', `等待${f.actors.find(a => a.id === run.waitingFor)?.name}审批`); if(run.parallelPending)run.parallelPending.slice(1).forEach(a=>notify(run,a,`收到并行审批：${run.title}`)); notify(run, run.waitingFor, `收到待审批申请：${run.title}`); return; }
    if(n.type==='delay'){run.status='waiting';run.resumeAt=new Date(Date.now()+n.config.minutes*60000).toISOString();run.waitingFor=null;event(run,'delay',`等待 ${n.config.minutes} 分钟`);return;}
    if(n.type==='data'){const previous=clone(run.data[n.config.field]??null);run.data[n.config.field]=clone(n.config.value);event(run,'data',`更新字段 ${n.config.field}`);run.timeline.at(-1).inspection={field:n.config.field,before:previous,after:clone(n.config.value)};}
    let port = 'next';
    if (n.type === 'condition') { const passed = evaluateCondition(n.config, run.data); port = passed ? 'yes' : 'no'; const rules=n.config.conditions?.length?n.config.conditions:[n.config]; event(run, 'condition', `${rules.map(rule=>`${rule.field} ${operators[rule.operator]} ${rule.value}`).join(n.config.logic==='or'?' 或 ':' 且 ')} → ${passed ? '满足' : '不满足'}，走${passed ? '满足' : '不满足'}分支`);run.timeline.at(-1).inspection={logic:n.config.logic||'and',port,rules:rules.map(rule=>({field:rule.field,operator:rule.operator,expected:rule.value,actual:clone(run.data[rule.field]??null),matched:evaluateCondition(rule,run.data)}))}; }
    if (n.type === 'notify') notify(run, n.config.recipient, n.config.message);
    const next = f.edges.find(e => e.source === n.id && e.port === port); if (!next) throw new Error('流程缺少后续连线'); run.currentNodeId = next.target;
  }
  throw new Error('流程执行超过节点上限');
}
export function startRun(flow, { title, amount = 0, days = 0, reason = '', ...fields }, mode = 'live') {
  if (mode !== 'test' && (flow.status !== 'published' || flow.publishedRevision !== flow.revision)) throw new Error('请先校验并发布当前流程版本');
  const errors = validateFlow(flow); if (errors.length) throw new Error(errors.join('；'));
  if (!title?.trim() || title.trim().length > 100) throw new Error('请填写 1–100 字的申请标题');
  if (![amount, days].every(n => Number.isFinite(n) && n >= 0)) throw new Error('金额和天数必须为非负有效数值');
  const run = { id: uid(), flowId: flow.id, flow: clone(flow), title: title.trim(), applicant: 'applicant', mode, data: { amount, days, reason, ...fields }, status: 'running', currentNodeId: flow.nodes.find(n => n.type === 'start').id, timeline: [], notifications: [], path: [], startedAt: now(), waitingFor: null };
  run.submittedData=clone(run.data);event(run, 'submit', `${mode === 'test' ? '模拟' : '本地'}提交申请「${run.title}」`, 'applicant'); advanceRun(run); return run;
}
export function decideRun(run, actor, decision, comment = '') {
  if (run.status !== 'pending') throw new Error('该申请当前不在待审批状态');
  if (run.parallelPending?!run.parallelPending.includes(actor):run.waitingFor !== actor) throw new Error('演示操作人不是当前待审批人');
  if (!['approve', 'reject'].includes(decision)) throw new Error('无效审批操作');
  if (decision === 'reject' && !comment.trim()) throw new Error('驳回时请填写原因');
  const current = run.flow.nodes.find(n => n.id === run.currentNodeId);
  event(run, decision, `${decision === 'approve' ? '同意' : '驳回'}「${current.label}」${comment.trim() ? `：${comment.trim()}` : ''}`, actor);
  run.waitingFor = null;
  if (decision === 'reject') { run.status = 'rejected'; run.completedAt = now(); notify(run, 'applicant', `申请已驳回：${comment.trim()}`); return; }
  if(run.parallelPending){run.parallelPending=run.parallelPending.filter(a=>a!==actor);if(run.parallelPending.length){run.waitingFor=run.parallelPending[0];run.status='pending';return;}run.parallelPending=null;}
  if(run.pendingSigners?.length){const pending=run.pendingSigners.pop();run.waitingFor=pending.returnTo;run.status='pending';event(run,'waiting',`加签完成，返回${run.flow.actors.find(a=>a.id===pending.returnTo)?.name}`,actor);notify(run,pending.returnTo,`加签已完成，请继续审批：${run.title}`);return;}
  run.currentNodeId = run.flow.edges.find(e => e.source === current.id && e.port === 'next').target; run.status = 'running'; advanceRun(run);
}
export function transferRun(run, actor, target, comment = '') {
  if(run.status!=='pending'||run.waitingFor!==actor)throw new Error('只有当前审批人可以转交');
  if(!run.flow.actors.some(a=>a.id===target)||target===actor)throw new Error('请选择其他有效处理人');
  event(run,'transfer',`转交给${run.flow.actors.find(a=>a.id===target).name}${comment.trim()?`：${comment.trim()}`:''}`,actor);run.waitingFor=target;notify(run,target,`收到转交审批：${run.title}`);
}
export function addSigner(run, actor, target, comment = '') {
  if(run.status!=='pending'||run.waitingFor!==actor)throw new Error('只有当前审批人可以加签');
  if(!run.flow.actors.some(a=>a.id===target)||target===actor)throw new Error('请选择其他有效处理人');
  run.pendingSigners ||= [];run.pendingSigners.push({actor,returnTo:actor,nodeId:run.currentNodeId});event(run,'countersign',`加签${run.flow.actors.find(a=>a.id===target).name}${comment.trim()?`：${comment.trim()}`:''}`,actor);run.waitingFor=target;notify(run,target,`收到加签任务：${run.title}`);
}
export function returnRun(run, actor, comment = '') {
  if(run.status!=='pending'||(run.parallelPending?!run.parallelPending.includes(actor):run.waitingFor!==actor))throw new Error('只有当前审批人可以退回');
  if(!comment.trim())throw new Error('退回时请填写原因');event(run,'return',`退回申请人：${comment.trim()}`,actor);run.status='returned';run.waitingFor=null;run.completedAt=now();notify(run,'applicant',`申请已退回：${comment.trim()}`);
}
export function withdrawRun(run, actor, reason) {
  if (!['pending','waiting'].includes(run.status)) throw new Error('只能撤回仍在审批中的申请');
  if (actor !== run.applicant) throw new Error('只有申请人可以撤回');
  if (!reason?.trim()) throw new Error('请填写撤回原因');
  event(run, 'withdraw', `申请人撤回：${reason.trim()}`, actor); const reviewer = run.waitingFor; run.status = 'withdrawn'; run.waitingFor = null; run.completedAt = now(); if (reviewer) notify(run, reviewer, '该申请已由申请人撤回。');
}
export function simulateFlow(flow, data) {
  const run = startRun(flow, data, 'test');
  let steps = 0; while (['pending','waiting'].includes(run.status) && steps++ <= flow.nodes.length*10){if(run.status==='pending')decideRun(run, run.waitingFor, 'approve', '模拟器自动同意（非人工审批）');else{event(run,'test-clock','隔离模拟器推进等待时间');run.currentNodeId=run.flow.edges.find(e=>e.source===run.currentNodeId&&e.port==='next').target;run.status='running';advanceRun(run);}}
  return run;
}
export function mutateFlow(flow, callback) { callback(flow); flow.revision++; flow.status = 'draft'; }
