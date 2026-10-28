import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {localBlueprint,applyPatch,localPatch,validateBlueprint} from '../public/formpilot3-model.js';
import {createPilotService} from '../src/pilot-service.mjs';import {createTableService} from '../src/table-service.mjs';import {createFlowService} from '../src/flow-service.mjs';import {createCanvasService} from '../src/canvas-service.mjs';
async function call(service,path,input,headers={},method){const req=Readable.from(input===undefined?[]:[JSON.stringify(input)]);req.method=method||(input===undefined?'GET':'POST');req.url=path;req.headers={host:'localhost','content-type':'application/json',...headers};let status,raw,h;const ok=await service.handle(req,{writeHead(s,hs){status=s;h=hs;},end(s){raw=s;}},path.split('?')[0]);assert.equal(ok,true);return{status,body:JSON.parse(raw),headers:h};}
function fixture(filename=':memory:'){const table=createTableService(':memory:'),flow=createFlowService(':memory:'),canvas=createCanvasService(':memory:',{table,flow}),pilot=createPilotService(filename,{table,flow,canvas});return{table,flow,canvas,pilot,close(){pilot.close();canvas.close();flow.close();table.close();}};}
const prompt='创建一套校园创新比赛管理系统，支持团队报名、项目上传、教师审核、比赛结果统计和管理后台。';
test('蓝图与增量修改校验依赖，保留 ID，拒绝危险路径与悬空路由',()=>{const b=localBlueprint(prompt);assert.deepEqual(validateBlueprint(b),[]);assert.ok(b.roles.some(r=>r.name==='学生'));const id=b.entities[1].id,patch=localPatch(b,'添加字段：指导教师电话',id),next=applyPatch(b,patch);assert.equal(next.blueprint.entities[1].id,id);assert.equal(b.entities[1].fields.length+1,next.blueprint.entities[1].fields.length);assert.throws(()=>applyPatch(b,[{op:'add',path:'/__proto__/polluted',value:1}]));assert.throws(()=>applyPatch(b,[{op:'replace',path:'/entities/0/id',value:'missing'}]),/引用|关联/);assert.equal({}.polluted,undefined);});
test('高校竞赛：规划、构建、账号权限、真实保存、审核、增量与发布隔离形成闭环',async()=>{
 const f=fixture(),api=(path,input,h,method)=>call(f.pilot,path,input,h,method);try{
  const plan=await api('/api/pilot/plan',{prompt,engine:'template'});assert.equal(plan.status,200);const b=plan.body.blueprint;b.constraints.forEach(c=>c.confirmed=true);
  let p=(await api('/api/pilot/create',{blueprint:b})).body.project;const route=action=>'/api/pilot/projects/'+p.id+'/'+action;
  let r=await api(route('build'),{revision:p.revision});assert.equal(r.status,200,JSON.stringify(r.body));p=r.body.project;assert.equal(p.tasks.every(t=>t.status==='done'),true);assert.equal(f.canvas.read().apps.find(a=>a.id===p.bindings.canvasId).pages.length,b.pages.length);
  for(const [username,roleId]of [['student1','student'],['student2','student'],['teacher','teacher'],['admin','admin']]){r=await api(route('account'),{username,password:'Test-only-9283',roleId});assert.equal(r.status,200);p=r.body.project;}
  r=await api(route('test'),{});assert.equal(r.status,200);assert.ok(r.body.checks.every(c=>c.ok),JSON.stringify(r.body.checks));
  r=await api(route('publish'),{revision:p.revision,access:'members',note:'测试首发'});assert.equal(r.status,200,JSON.stringify(r.body));p=r.body.project;
  const base='/api/pilot/runtime/'+p.token,team=b.entities.find(e=>e.name==='团队'),work=b.entities.find(e=>e.name==='作品');
  assert.equal((await api(base+'/rows/'+team.id)).status,401);
  async function login(username){const r=await api(base+'/login',{username,password:'Test-only-9283'});assert.equal(r.status,200);return{cookie:r.headers['Set-Cookie'].split(';')[0]};}
  const student1=await login('student1'),student2=await login('student2'),teacher=await login('teacher');
  const review=b.entities.find(e=>e.name==='审核记录');assert.equal((await api(base+'/rows/'+review.id,{values:{}},student1)).status,403);
  assert.equal((await api(base+'/rows/'+team.id+'?role=admin',undefined,student2)).body.rows.length,0);
  const vals=Object.fromEntries(team.fields.map(f=>[f.id,f.type==='email'?'student@example.com':f.label+'测试']));
  r=await api(base+'/rows/'+team.id,{values:vals},student1);assert.equal(r.status,200,JSON.stringify(r.body));const teamId=r.body.id;
  assert.equal(f.table.read().state.tables.find(t=>t.id===p.bindings.tables[team.id]).records.length,1);
  assert.equal((await api(base+'/rows/'+team.id,undefined,student1)).body.rows.length,1);assert.equal((await api(base+'/rows/'+team.id,undefined,student2)).body.rows.length,0);
  assert.equal((await api(base+'/rows/'+team.id,{id:teamId,values:vals},student2,'PATCH')).status,403);
  const workVals=Object.fromEntries(work.fields.map(f=>[f.id,f.type==='relation'?teamId:f.type==='file'?{name:'作品.txt',data:'data:text/plain;base64,dGVzdA=='}:f.label+'测试']));
  r=await api(base+'/rows/'+work.id,{values:workVals},student1);assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(r.body.flowId);const runId=r.body.flowId;
  assert.equal((await api(base+'/runs',undefined,student1)).body.runs.length,1);assert.equal((await api(base+'/runs',undefined,student2)).body.runs.length,0);
  assert.equal((await api(base+'/action',{runId,action:'approve'},student1)).status,403);
  r=await api(base+'/action',{runId,action:'approve',comment:'通过'},teacher);assert.equal(r.status,200);assert.equal(r.body.result.status,'approved');
  const before=p.blueprint.entities[1].fields.length;const cand=await api(route('candidate'),{revision:p.revision,engine:'template',entityId:team.id,instruction:'添加字段：指导教师电话'});assert.equal(cand.status,200);assert.equal(f.pilot.read().projects[0].blueprint.entities[1].fields.length,before);
  r=await api(route('patch'),{revision:p.revision,patch:cand.body.patch});assert.equal(r.status,200);p=r.body.project;assert.equal(p.blueprint.entities[1].fields.length,before+1);
  const published=await api(base,undefined,student1);assert.equal(published.body.blueprint.entities[1].fields.length,before);
  assert.equal((await api('/api/pilot/preview/'+p.id+'/rows/'+team.id,{values:vals})).status,403);
  r=await api(route('build'),{revision:p.revision});assert.equal(r.status,200);p=r.body.project;
  assert.equal((await api(base+'/rows/'+team.id,undefined,student1)).body.rows.length,1);
  assert.equal((await api(route('patch'),{revision:p.revision-1,patch:cand.body.patch})).status,409);
 }finally{f.close();}
});
test('AI 未配置不伪造结果；保存失败不创建项目；跨站写入拒绝',async()=>{const f=fixture();try{const before=f.pilot.read().projects.length;const result=await call(f.pilot,'/api/pilot/plan',{prompt,engine:'ai'});if(!process.env.OMNIFORM_AI_API_KEY)assert.equal(result.status,503);assert.equal(f.pilot.read().projects.length,before);assert.equal((await call(f.pilot,'/api/pilot/create',{blueprint:{}},{origin:'https://evil.example'})).status,403);}finally{f.close();}});
test('独立 SQLite 保存后重启可恢复，历史数据副本不覆盖原记录',async()=>{const folder=mkdtempSync(join(tmpdir(),'pilot3-'));let f=fixture(join(folder,'pilot.sqlite'));try{const a={id:'old',name:'历史报名',description:'旧项目',blueprint:{roles:[{id:'admin',name:'管理员',allowed:['read','create','update','delete']}],entities:[{id:'people',name:'报名',fields:[{id:'name',label:'姓名',type:'text',required:true}],records:[{id:'one',values:{name:'保留记录'}}]}]}};const r=await call(f.pilot,'/api/pilot/import',{app:a});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(f.table.read().state.tables.find(t=>t.id===r.body.project.bindings.tables.people).records[0].name,'保留记录');const id=r.body.project.id;f.close();f=fixture(join(folder,'pilot.sqlite'));assert.equal(f.pilot.read().projects[0].id,id);assert.equal(f.pilot.read().legacy[0].app.blueprint.entities[0].records[0].values.name,'保留记录');}finally{f.close();rmSync(folder,{recursive:true,force:true});}});
