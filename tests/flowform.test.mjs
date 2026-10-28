import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFlow, validateFlow, connectNodes, publishFlow, startRun, decideRun, withdrawRun, simulateFlow, mutateFlow, evaluateCondition, transferRun, addSigner, returnRun } from '../public/flowform-model.js';

const input = amount => ({ title: '验收申请', amount, days: 1, reason: '流程测试' });
function fixture() { const f = generateFlow('报销超过1000元需要财务审批'); publishFlow(f); return f; }
test('生成有条件和串行审批的可校验流程，并提取请假阈值', () => {
  const f = fixture(); assert.deepEqual(validateFlow(f), []);
  assert.equal(f.nodes.find(n => n.type === 'condition').config.value, 1000);
  const leave = generateFlow('请假超过5天需要总经理审批');
  assert.equal(leave.nodes.find(n => n.type === 'condition').config.value, 5);
  assert.equal(leave.nodes.find(n => n.id === 'finance').config.assignee, 'director');
});
test('大额申请先主管再财务，多级审批和通知实际执行', () => {
  const r = startRun(fixture(), input(1500)); assert.equal(r.waitingFor, 'manager');
  assert.throws(() => decideRun(r, 'finance', 'approve'), /不是当前/);
  decideRun(r, 'manager', 'approve', '主管同意'); assert.equal(r.waitingFor, 'finance');
  decideRun(r, 'finance', 'approve', '财务确认'); assert.equal(r.status, 'approved');
  assert.ok(r.path.includes('finance')); assert.equal(r.timeline.filter(e => e.type === 'approve').length, 2);
  assert.ok(r.notifications.some(n => n.to === 'applicant'));
  assert.throws(() => decideRun(r, 'finance', 'approve'), /不在待审批/);
});
test('阈值边界与小额分支跳过财务，模拟结果也使用相同规则', () => {
  for (const amount of [0, 500, 1000]) { const r = simulateFlow(fixture(), input(amount)); assert.equal(r.status, 'approved'); assert.ok(!r.path.includes('finance')); assert.equal(r.mode, 'test'); }
  const high = simulateFlow(fixture(), input(1000.01)); assert.ok(high.path.includes('finance'));
});
test('驳回必须有原因，拒绝后不会继续执行', () => {
  const r = startRun(fixture(), input(1500));
  assert.throws(() => decideRun(r, 'manager', 'reject', ' '), /原因/); assert.equal(r.status, 'pending');
  decideRun(r, 'manager', 'reject', '资料不完整'); assert.equal(r.status, 'rejected');
  assert.ok(!r.path.includes('finance')); assert.ok(r.notifications.some(n => n.message.includes('资料不完整')));
  assert.throws(() => withdrawRun(r, 'applicant', '撤回'), /仍在审批/);
});
test('仅申请人可撤回进行中的申请，待办被清除且通知原审批人', () => {
  const r = startRun(fixture(), input(1500));
  assert.throws(() => withdrawRun(r, 'manager', '错误操作'), /只有申请人/);
  assert.throws(() => withdrawRun(r, 'applicant', ''), /撤回原因/);
  withdrawRun(r, 'applicant', '修改金额'); assert.equal(r.status, 'withdrawn'); assert.equal(r.waitingFor, null);
  assert.ok(r.notifications.some(n => n.to === 'manager' && n.message.includes('撤回')));
});
test('申请快照与后续修改隔离，编辑后必须重新发布才可发起', () => {
  const f = fixture(), r = startRun(f, input(1500));
  mutateFlow(f, d => { d.nodes.find(n => n.type === 'condition').config.value = 10000; });
  assert.throws(() => startRun(f, input(1500)), /发布当前/);
  decideRun(r, 'manager', 'approve'); assert.equal(r.waitingFor, 'finance');
  publishFlow(f); const next = startRun(f, input(1500)); decideRun(next, 'manager', 'approve'); assert.equal(next.status, 'approved');
});
test('不完整分支、未配置审批人、孤立节点和环路阻止发布', () => {
  const f = generateFlow(); f.edges = f.edges.filter(e => e.port !== 'no');
  assert.ok(validateFlow(f).some(e => e.includes('两条分支'))); assert.throws(() => publishFlow(f), /分支/);
  const bad = generateFlow(); bad.nodes.find(n => n.type === 'approval').config.assignee = 'missing';
  assert.ok(validateFlow(bad).some(e => e.includes('审批人')));
  const cycle = generateFlow(); cycle.edges.push({ id: 'cycle', source: 'finance', target: 'manager', port: 'next' });
  assert.ok(validateFlow(cycle).some(e => e.includes('循环')));
});
test('编辑连线可替换单个端口，但拒绝循环、自连、无效端口', () => {
  const f = generateFlow(), count = f.edges.length;
  connectNodes(f, 'condition', 'notify', 'yes'); assert.equal(f.edges.length, count); assert.equal(f.edges.find(e => e.source === 'condition' && e.port === 'yes').target, 'notify');
  assert.throws(() => connectNodes(f, 'manager', 'manager'), /无效连接/);
  assert.throws(() => connectNodes(f, 'notify', 'manager'), /循环/);
  assert.throws(() => connectNodes(f, 'manager', 'notify', 'yes'), /端口/);
});
test('序列化恢复后仍可完成待办审批，拒绝非数值与负值输入', () => {
  const f = fixture(), original = startRun(f, input(500)); const restored = JSON.parse(JSON.stringify(original));
  decideRun(restored, 'manager', 'approve'); assert.equal(restored.status, 'approved');
  assert.throws(() => startRun(f, input(NaN)), /有效数值/);
  assert.throws(() => startRun(f, input(-1)), /有效数值/);
});
test('文本、枚举、日期与多条件组合使用同一安全规则引擎',()=>{
  assert.equal(evaluateCondition({logic:'and',conditions:[{field:'category',operator:'in',value:'差旅,采购'},{field:'date',operator:'after',value:'2026-01-01'}]},{category:'差旅',date:'2026-10-18'}),true);
  assert.equal(evaluateCondition({logic:'or',conditions:[{field:'department',operator:'eq',value:'财务部'},{field:'title',operator:'contains',value:'紧急'}]},{department:'研发部',title:'紧急采购'}),true);
});
test('转交、加签与退回均保留真实处理轨迹',()=>{
  const r=startRun(fixture(),input(1500));transferRun(r,'manager','director','请总经理处理');assert.equal(r.waitingFor,'director');
  addSigner(r,'director','finance','请财务核对');assert.equal(r.waitingFor,'finance');decideRun(r,'finance','approve','核对完成');assert.equal(r.waitingFor,'director');
  returnRun(r,'director','补充发票');assert.equal(r.status,'returned');assert.ok(r.timeline.some(e=>e.type==='transfer'));assert.ok(r.timeline.some(e=>e.type==='countersign'));assert.ok(r.timeline.some(e=>e.type==='return'));
});
