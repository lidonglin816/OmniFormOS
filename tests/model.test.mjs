import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, generateApp, validateRecord } from '../public/model.js';

test('生成结构使用独立 ID，客户和费用需求选择正确模板', () => {
  const customer = generateApp('为销售创建客户管理系统');
  const expense = generateApp('我要一个费用报销应用');
  assert.equal(customer.template, 'customer');
  assert.equal(expense.template, 'expense');
  assert.ok(expense.fields.some(f => f.type === 'number'));
  const ids = [customer.id, expense.id, ...customer.fields.map(f => f.id), ...expense.fields.map(f => f.id)];
  assert.equal(new Set(ids).size, ids.length);
});
test('记录校验拒绝缺失必填、无效数字及邮箱，允许数字零', () => {
  const fields = [{ id: 'n', label: '金额', type: 'number', required: true }, { id: 'e', label: '邮箱', type: 'email' }];
  assert.equal(validateRecord(fields, { n: 0 }), '');
  assert.equal(validateRecord(fields, { n: ' ' }), '请填写金额');
  assert.equal(validateRecord(fields, { n: 'abc' }), '金额需要有效数字');
  assert.equal(validateRecord(fields, { n: '1', e: 'invalid' }), '邮箱需要有效邮箱');
  assert.equal(validateRecord(fields, { n: '12.5', e: 'test@example.com' }), '');
});
test('新增必填字段后已有数据需要重新通过校验', () => {
  const app = makeApp('采购');
  const values = Object.fromEntries(app.fields.map(f => [f.id, '示例内容']));
  assert.equal(validateRecord(app.fields, values), '');
  app.fields.push({ id: 'new', label: '审批人', type: 'text', required: true });
  assert.equal(validateRecord(app.fields, values), '请填写审批人');
});
