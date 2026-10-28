import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizeFields, segmentsFromText, makeDocument, seedDocMorph, confirmAll, updateField, createDesignerApp, validateDocField } from '../public/docmorph-model.js';
import { validateFields, valuesFromForm } from '../public/field-rules.js';

test('原文识别字段、必填、选项与数值限制，并保留精确来源', () => {
  const d = seedDocMorph().documents[0];
  assert.equal(d.fields.length, 8);
  const name = d.fields.find(f => f.label === '姓名'), department = d.fields.find(f => f.label === '部门'), budget = d.fields.find(f => f.label === '月度预算');
  assert.equal(name.required, true); assert.equal(name.rules.maxLength, 20);
  assert.deepEqual(department.options, ['研发部', '市场部', '财务部']); assert.equal(department.type, 'select');
  assert.deepEqual(budget.rules, { min: 0, max: 50000 });
  assert.equal(name.source.segmentId, d.segments[2].id); assert.equal(name.source.location, '第 3 行');
  assert.ok(!d.fields.some(f => f.label === '填写说明'));
});
test('星号必填、选填、独立标签及 Excel 单元格来源', () => {
  const segments = segmentsFromText('*姓名：____\n备注（非必填）：____\nEmail\n说明：填写可联系的邮箱');
  segments[0].sheet = '入职'; segments[0].cell = 'A1'; segments[0].location = '入职!A1';
  const f = recognizeFields(segments); assert.equal(f[0].required, true); assert.equal(f[1].required, false);
  assert.equal(f[2].type, 'email'); assert.match(f[2].help, /可联系/); assert.equal(f[0].source.cell, 'A1');
});
test('人工校正重置该字段复核，拒绝重复、失效来源与非法限制', () => {
  const d = seedDocMorph().documents[0]; confirmAll(d); const old = d.fields[0];
  updateField(d, { ...old, label: '申请人姓名' }); assert.equal(d.fields[0].confirmed, false); assert.ok(d.fields[1].confirmed); assert.equal(d.revision, 2);
  assert.throws(() => updateField(d, { ...d.fields[0], source: { segmentId: 'missing' } }), /有效.*来源/);
  assert.match(validateDocField({ ...d.fields[0], label: d.fields[1].label }, d), /重复/);
  assert.match(validateDocField({ ...d.fields[0], rules: { min: 10, max: 2 } }, d), /最小值/);
});
test('只有人工确认后才能送入设计器，生成独立字段与来源快照', () => {
  const d = seedDocMorph().documents[0]; assert.throws(() => createDesignerApp(d), /人工复核/); confirmAll(d);
  const app = createDesignerApp(d); assert.equal(app.fields.length, d.fields.length); assert.notEqual(app.fields[0].id, d.fields[0].id);
  assert.equal(app.fields[0].provenance.documentId, d.id); assert.deepEqual(app.fields[3].options, d.fields[3].options);
  d.fields[0].label = '已修改'; assert.equal(app.fields[0].label, '姓名');
});
test('范围、长度、下拉、多选与确认勾选在业务表单中仍执行校验', () => {
  const fields = [{ id: 'amount', label: '金额', type: 'number', rules: { min: 0, max: 100 }, required: true }, { id: 'department', label: '部门', type: 'select', options: ['研发', '财务'], required: true }, { id: 'confirm', label: '确认', type: 'checkbox', required: true }];
  const valid = { amount: 0, department: '研发', confirm: true }; assert.equal(validateFields(fields, valid), '');
  assert.match(validateFields(fields, { ...valid, amount: 101 }), /不能大于100/);
  assert.match(validateFields(fields, { ...valid, department: '伪造选项' }), /已有选项/);
  assert.match(validateFields(fields, { ...valid, confirm: false }), /请填写确认/);
  assert.match(validateFields([{ id: 'x', label: '电话', type: 'tel', rules: { exactLength: 11 } }], { x: '123456' }), /11/);
  assert.match(validateFields([{ id: 'x', label: '选项', type: 'multiselect', options: ['A'] }], { x: ['B'] }), /无效选项/);
});
test('FormData 保留多选数组及布尔值，而不是丢失选项', () => {
  const data = new FormData(); data.append('choices', 'A'); data.append('choices', 'B'); data.append('agree', 'on');
  const values = valuesFromForm([{ id: 'choices', type: 'multiselect' }, { id: 'agree', type: 'checkbox' }, { id: 'missing', type: 'checkbox' }], data);
  assert.deepEqual(values, { choices: ['A', 'B'], agree: true, missing: false });
});
test('无字段文档不会被伪装为已识别成功，也不可输出空应用', () => {
  const d = makeDocument('说明.txt', 'text', segmentsFromText('这是一段普通说明，不包含表单字段。'));
  assert.equal(d.fields.length, 0); assert.throws(() => confirmAll(d), /先识别/); assert.throws(() => createDesignerApp(d), /人工复核/);
});
test('中文 OCR 字间空格不影响字段类型、必填及选项，但原始证据保留', () => {
  const segments = segmentsFromText('姓 名 ( 必 填 ) : _\n电 子 邮 箱 ( 必 填 ) : _\n部 门 ( 单 选 ) : 研 发 部 / 财 务 部');
  const fields = recognizeFields(segments); assert.equal(fields[0].label, '姓名'); assert.equal(fields[0].required, true);
  assert.equal(fields[1].type, 'email'); assert.deepEqual(fields[2].options, ['研发部', '财务部']);
  assert.equal(fields[0].source.text, '姓 名 ( 必 填 ) : _');
});
test('正则限制与条件依赖会进入统一 Schema 并持续校验',()=>{
  const d=seedDocMorph().documents[0],phone=d.fields.find(f=>f.type==='tel'),department=d.fields.find(f=>f.label==='部门');phone.rules.pattern='^1\\d{10}$';department.condition={fieldId:phone.id,operator:'contains',value:'138'};
  assert.equal(validateDocField(phone,d),'');assert.equal(validateDocField(department,d),'');assert.match(validateFields([phone],{[phone.id]:'123'}),/(格式不正确|有效电话)/);
  confirmAll(d);const app=createDesignerApp(d),mappedPhone=app.fields.find(f=>f.label===phone.label),mappedDepartment=app.fields.find(f=>f.label===department.label);assert.equal(mappedDepartment.condition.fieldId,mappedPhone.id);
});
