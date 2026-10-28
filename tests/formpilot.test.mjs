import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplication, ensureBlueprint, reviseApplication, checkEntityRecord, removeRecord, addEntity } from '../public/formpilot-model.js';

test('客户需求生成多实体、关联、角色和每个实体的三种页面', () => {
  const a = buildApplication('建立客户管理系统。应用名称：星河 CRM。角色：管理员、销售、查看者');
  const b = a.blueprint;
  assert.equal(a.name, '星河 CRM');
  assert.deepEqual(b.entities.map(e => e.name), ['客户', '联系人', '商机']);
  assert.deepEqual(b.roles.map(r => r.name), ['管理员', '销售', '查看者']);
  assert.deepEqual(b.roles[2].allowed, ['read']);
  assert.equal(b.pages.length, 9);
  for (const e of b.entities) for (const f of e.fields.filter(f => f.type === 'relation')) assert.ok(b.entities.some(e => e.id === f.target));
});
test('迭代保留 ID、数据及已有字段，并拒绝不支持和重复指令', () => {
  const a = buildApplication('库存管理'); const b = a.blueprint; const e = b.entities[0];
  e.records.push({ id: 'record', values: { [e.fields[0].id]: '演示商品' } });
  const appId = a.id, fieldId = e.fields[0].id;
  reviseApplication(a, '添加字段：安全库存，类型：数字，必填', e.id);
  assert.equal(e.fields.at(-1).type, 'number'); assert.equal(e.fields.at(-1).required, true);
  assert.equal(a.id, appId); assert.equal(e.fields[0].id, fieldId); assert.equal(e.records[0].id, 'record');
  assert.throws(() => reviseApplication(a, '添加字段：安全库存', e.id), /已存在/);
  const version = b.version; assert.throws(() => reviseApplication(a, '把它做得更智能', e.id), /本地演示支持/); assert.equal(b.version, version);
  reviseApplication(a, '新增实体：供应商', e.id); assert.equal(b.pages.length, 9);
});
test('关联校验及删除引用保护', () => {
  const a = buildApplication('客户管理'), b = a.blueprint; const [customer, contact] = b.entities;
  customer.records.push({ id: 'c1', values: { [customer.fields[0].id]: '示例客户' } });
  const relation = contact.fields.find(f => f.type === 'relation');
  const values = { [contact.fields[0].id]: '示例联系人', [relation.id]: 'invalid' };
  assert.match(checkEntityRecord(b, contact, values), /不存在/);
  values[relation.id] = 'c1'; assert.equal(checkEntityRecord(b, contact, values), '');
  contact.records.push({ id: 'p1', values }); assert.throws(() => removeRecord(b, customer, 'c1'), /关联记录/);
  removeRecord(b, contact, 'p1'); removeRecord(b, customer, 'c1'); assert.equal(customer.records.length, 0);
});
test('序列化后主实体与原表单共享字段和记录，旧数据可导入', () => {
  const a = JSON.parse(JSON.stringify(buildApplication('费用报销'))); const b = ensureBlueprint(a);
  assert.equal(b.entities[0].fields, a.fields); assert.equal(b.entities[0].records, a.records);
  addEntity(a, '审批备注'); assert.throws(() => addEntity(a, '审批备注'), /已存在/);
  delete a.blueprint; const imported = ensureBlueprint(a); assert.equal(imported.entities[0].records, a.records); assert.equal(imported.pages.length, 3);
});
