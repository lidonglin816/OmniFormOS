import test from 'node:test';
import assert from 'node:assert/strict';
import {flowTrace,waitingQueue,blueprintSummary} from '../public/flow-observability.js';
import {renderFlowInspector,renderBlueprintChanges} from '../public/flow-inspector-ui.js';
import {campusFlow} from '../public/flow-campus-model.js';
import {startRun,decideRun} from '../public/flowform-model.js';

test('条件节点保留当时输入和实际路由；提交快照不受后续数据更新影响',()=>{
 const flow=campusFlow('expense');const run=startRun(flow,{title:'检查轨迹',amount:2000},'test');
 const input=structuredClone(run.submittedData);decideRun(run,'manager','approve');
 const condition=run.timeline.find(e=>e.type==='condition');assert.ok(condition.inspection);assert.equal(condition.inspection.rules[0].actual,2000);assert.equal(condition.inspection.port,'yes');
 run.data.amount=1;assert.equal(condition.inspection.rules[0].actual,2000);assert.deepEqual(run.submittedData,input);
 const trace=flowTrace(run);assert.equal(trace.find(n=>n.id==='finance').state,'waiting');assert.equal(trace.find(n=>n.id==='condition').state,'visited');
});
test('待办队列严格排除测试、已完成和筛选外记录，按超时与等待排序',()=>{
 const f=campusFlow('expense'),r=startRun(f,{title:'正式待办'},'test');r.mode='live';r.dueAt='2000-01-01T00:00:00Z';
 const testRun={...structuredClone(r),id:'test',mode:'test'},approved={...r,id:'done',status:'approved'};
 const rows=waitingQueue([r,testRun,approved],{},Date.now());assert.equal(rows.length,1);assert.equal(rows[0].overdue,true);assert.equal(rows[0].actors[0],f.actors.find(a=>a.id===r.waitingFor).name);assert.equal(waitingQueue([r],{flowId:'other'}).length,0);
});
test('蓝图差异按稳定 ID 计算，流转检查安全转义用户内容',()=>{
 const before=campusFlow('expense'),after=structuredClone(before);after.nodes[0].label='<script>alert(1)</script>';after.form.fields[0].label='申请姓名';
 const diff=blueprintSummary(before,after);assert.equal(diff.nodes.changed.length,1);assert.equal(diff.nodes.added.length,0);assert.equal(diff.fields.changed.length,1);
 const html=renderBlueprintChanges(before,after);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(renderFlowInspector({flow:before,status:'draft',timeline:[],path:[]}).includes('未流转'));
});
