import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createTableService } from '../src/table-service.mjs';
import { applyView, cleanPreview, normalizeTable, parseDelimited, rowsToTable, validateRecord } from '../public/tablemind-pro-model.js';

function request(method, payload) {
  const req = Readable.from(payload === undefined ? [] : [JSON.stringify(payload)]);
  req.method = method;
  req.headers = { host: '127.0.0.1:3000', ...(payload === undefined ? {} : { 'content-type': 'application/json' }) };
  return req;
}

async function call(service, path, method = 'GET', payload) {
  let status, raw = '';
  const res = { writeHead(code) { status = code; return this; }, end(value = '') { raw += value; } };
  assert.equal(await service.handle(request(method, payload), res, path), true);
  return { status, body: JSON.parse(raw) };
}

function serviceFor(t) {
  const service = createTableService(':memory:');
  t.after(() => service.close());
  return service;
}

function makeTable(overrides = {}) {
  return {
    id: 'activities', name: '活动数据', fields: [
      { id: 'department', name: '部门', type: 'text', required: true },
      { id: 'people', name: '人数', type: 'number' },
      { id: 'date', name: '日期', type: 'date' },
      { id: 'code', name: '活动编码', type: 'text', unique: true }
    ],
    records: [
      { id: 'row-a', department: '研发部', people: 10, date: '2026-10-01', code: 'A' },
      { id: 'row-b', department: '研发部', people: '', date: '2026-10-18', code: 'B' },
      { id: 'row-c', department: '市场部', people: 30, date: '2026-09-30', code: 'C' }
    ],
    ...overrides
  };
}

async function putTable(service, table = makeTable()) {
  const result = await call(service, '/api/tablemind/table', 'POST', { table });
  assert.equal(result.status, 200, result.body.error);
  return result.body.result;
}

test('TableMind 迁移保留旧字段标题、记录 ID 和零值', () => {
  const table = normalizeTable({ fields: [{ id: 'count', label: '参与人数', type: 'number' }], records: [{ id: 'legacy-row', count: 0 }] });
  assert.equal(table.fields[0].name, '参与人数');
  assert.equal(table.fields[0].id, 'count');
  assert.equal(table.records[0].id, 'legacy-row');
  assert.equal(table.records[0].count, 0);
});

test('TableMind CSV 支持引号内逗号、换行、转义引号，缺失数值不变成零', () => {
  const rows = parseDelimited('名称,备注,人数\r\n"创新,比赛","第一行\n第二行 ""原文""",12\r\n讲座,待补,\r\n');
  assert.deepEqual(rows, [['名称', '备注', '人数'], ['创新,比赛', '第一行\n第二行 "原文"', '12'], ['讲座', '待补', '']]);
  const table = rowsToTable('导入活动', rows);
  const number = table.fields.find(field => field.name === '人数');
  assert.equal(number.type, 'number');
  assert.ok(table.records[1][number.id] === '' || table.records[1][number.id] == null);
});

test('TableMind 必填、唯一性和默认值在记录保存前校验', () => {
  const table = normalizeTable(makeTable());
  table.fields.push({ id: 'status', name: '状态', type: 'text', defaultValue: '待开始' });
  const candidate = { department: '', code: 'A', people: 'NaN' };
  const errors = validateRecord(table, candidate);
  assert.ok(errors.department);
  assert.ok(errors.code);
  assert.ok(errors.people);
  assert.equal(candidate.status, '待开始');
  assert.deepEqual(validateRecord(table, { department: '研发部', code: 'A', people: 0 }, 'row-a'), {});
});

test('TableMind 保存视图按同一数据源筛选排序，不修改原记录顺序', () => {
  const table = normalizeTable(makeTable());
  const before = structuredClone(table.records);
  const filtered = applyView(table, { filters: [{ fieldId: 'department', op: 'eq', value: '研发部' }], sorts: [{ fieldId: 'date', direction: 'desc' }] });
  assert.deepEqual(filtered.map(row => row.id), ['row-b', 'row-a']);
  assert.deepEqual(table.records, before);
  table.records[0].people = 50;
  assert.equal(applyView(table, { filters: [{ fieldId: 'people', op: 'gt', value: 40 }] })[0].id, 'row-a');
});

test('TableMind 数据清洗预览输出差异且不改变原表', () => {
  const table = normalizeTable(makeTable({ records: [{ id: 'one', department: ' 研发部 ', people: '' }, { id: 'two', department: '市场部', people: 0 }] }));
  const before = structuredClone(table);
  const result = cleanPreview(table, [{ type: 'trim', fieldId: 'department' }, { type: 'fill', fieldId: 'people', value: 8 }]);
  assert.deepEqual(table, before);
  assert.equal(result.after[0].department, '研发部');
  assert.equal(result.after[0].people, 8);
  assert.equal(result.after[1].people, 0);
  assert.equal(result.changes.length, 2);
});

test('TableMind bootstrap 一次迁移历史数据且后续不会覆盖新数据', async t => {
  const service = serviceFor(t);
  const legacy = { fields: [{ id: 'legacy', label: '历史字段', type: 'text' }], records: [{ id: 'old', legacy: '保留' }] };
  const first = await call(service, '/api/tablemind/bootstrap', 'POST', { legacy });
  assert.equal(first.status, 200);
  assert.equal(first.body.state.tables.length, 1);
  assert.equal(first.body.state.tables[0].fields[0].name, '历史字段');
  const second = await call(service, '/api/tablemind/bootstrap', 'POST', { legacy: { fields: legacy.fields, records: [] } });
  assert.equal(second.body.state.tables[0].records[0].legacy, '保留');
  assert.equal(second.body.state.tables.length, 1);
});

test('TableMind 记录 CRUD 执行必填及唯一校验并持久化有效修改', async t => {
  const service = serviceFor(t);
  await putTable(service);
  const invalid = await call(service, '/api/tablemind/tables/activities/rows', 'POST', { record: { department: '', code: 'A' } });
  assert.equal(invalid.status, 422);
  assert.equal(service.read().state.tables.find(table => table.id === 'activities').records.length, 3);
  const created = await call(service, '/api/tablemind/tables/activities/rows', 'POST', { record: { id: 'row-new', department: '运营部', people: 0, code: 'D' } });
  assert.equal(created.status, 200);
  const changed = await call(service, '/api/tablemind/tables/activities/rows/row-new', 'PATCH', { record: { people: 16 } });
  assert.equal(changed.body.result.people, 16);
  const duplicate = await call(service, '/api/tablemind/tables/activities/rows/row-new', 'PATCH', { record: { code: 'A' } });
  assert.equal(duplicate.status, 422);
  const removed = await call(service, '/api/tablemind/tables/activities/rows/row-new', 'DELETE', {});
  assert.equal(removed.status, 200);
  assert.equal(service.read().state.tables.find(table => table.id === 'activities').records.length, 3);
});

test('TableMind 导入字段映射拒绝不存在的目标并保持原表不变', async t => {
  const service = serviceFor(t);
  await putTable(service);
  const incoming = { name: '外部活动', fields: [{ id: 'source_department', name: '部门', type: 'text' }], records: [{ id: 'source-one', source_department: '运营部' }] };
  const invalid = await call(service, '/api/tablemind/import', 'POST', { table: incoming, mergeTableId: 'activities', mapping: { source_department: 'does_not_exist' } });
  assert.ok(invalid.status >= 400, '错误字段映射必须拒绝，不能静默新增不可见数据');
  assert.equal(service.read().state.tables.find(table => table.id === 'activities').records.length, 3);
  const valid = await call(service, '/api/tablemind/import', 'POST', { table: incoming, mergeTableId: 'activities', mapping: { source_department: 'department' } });
  assert.equal(valid.status, 200, valid.body.error);
  assert.equal(valid.body.result.records.at(-1).department, '运营部');
});

test('TableMind 查询校验全部字段和操作，拒绝 SQL 与非法聚合', async t => {
  const service = serviceFor(t);
  await putTable(service);
  const invalidPlans = [
    { filters: [{ fieldId: 'missing', op: 'eq', value: 'x' }] },
    { groupBy: 'missing', aggregation: 'count' },
    { groupBy: 'department', metric: 'missing', aggregation: 'sum' },
    { groupBy: 'department', metric: 'people', aggregation: 'eval' },
    { filters: [{ fieldId: 'department', op: 'rawSql', value: '1=1' }] },
    { sql: 'DELETE FROM tablemind_state', groupBy: 'department', aggregation: 'count' }
  ];
  for (const plan of invalidPlans) {
    const result = await call(service, '/api/tablemind/query', 'POST', { tableId: 'activities', plan });
    assert.ok(result.status >= 400, `应拒绝 ${JSON.stringify(plan)}`);
  }
  assert.equal(service.read().state.tables.find(table => table.id === 'activities').records.length, 3);
});

test('TableMind 分组平均值忽略缺失数据，并提供真实计算依据', async t => {
  const service = serviceFor(t);
  await putTable(service);
  const result = await call(service, '/api/tablemind/query', 'POST', { tableId: 'activities', prompt: '按部门平均人数', plan: { filters: [], sorts: [], groupBy: 'department', metric: 'people', aggregation: 'avg', limit: 100 } });
  assert.equal(result.status, 200, result.body.error);
  assert.equal(result.body.result.output.rows.find(row => row.label === '研发部').value, 10);
  assert.equal(result.body.result.output.evidence.matched, 3);
  assert.equal(result.body.result.output.evidence.total, 3);
  assert.equal(service.read().state.queries.length, 1);
});

test('TableMind 日期范围查询按实际日期比较而非数值转换', async t => {
  const service = serviceFor(t);
  await putTable(service);
  const result = await call(service, '/api/tablemind/query', 'POST', { tableId: 'activities', plan: { filters: [{ fieldId: 'date', op: 'gte', value: '2026-10-01' }, { fieldId: 'date', op: 'lte', value: '2026-10-31' }], sorts: [{ fieldId: 'date', direction: 'asc' }], limit: 100 } });
  assert.equal(result.status, 200, result.body.error);
  assert.deepEqual(result.body.result.output.rows.map(row => row.id), ['row-a', 'row-b']);
});

test('TableMind 清洗预览、确认和撤销保留完整可恢复记录', async t => {
  const service = serviceFor(t);
  await putTable(service);
  const before = structuredClone(service.read().state.tables.find(table => table.id === 'activities').records);
  const operations = [{ type: 'fill', fieldId: 'people', value: 25 }];
  const preview = await call(service, '/api/tablemind/clean/preview', 'POST', { tableId: 'activities', operations });
  assert.equal(preview.body.changes.length, 1);
  assert.deepEqual(service.read().state.tables.find(table => table.id === 'activities').records, before);
  const applied = await call(service, '/api/tablemind/clean/apply', 'POST', { tableId: 'activities', operations });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.result.table.records.find(row => row.id === 'row-b').people, 25);
  const rolledBack = await call(service, '/api/tablemind/clean/rollback', 'POST', { runId: applied.body.result.run.id });
  assert.equal(rolledBack.status, 200);
  assert.deepEqual(rolledBack.body.result.records, before);
});

test('TableMind 关联字段拒绝悬空记录，接受已存在的另一数据表记录', async t => {
  const service = serviceFor(t);
  await putTable(service, { id: 'departments', name: '部门', fields: [{ id: 'name', name: '名称', type: 'text' }], records: [{ id: 'dept-rd', name: '研发部' }] });
  await putTable(service, { id: 'members', name: '成员', fields: [{ id: 'name', name: '姓名', type: 'text', required: true }, { id: 'departmentId', name: '所属部门', type: 'relation', relation: { tableId: 'departments', labelFieldId: 'name' } }], records: [] });
  const invalid = await call(service, '/api/tablemind/tables/members/rows', 'POST', { record: { name: '测试成员', departmentId: 'missing-department' } });
  assert.equal(invalid.status, 422);
  const valid = await call(service, '/api/tablemind/tables/members/rows', 'POST', { record: { name: '测试成员', departmentId: 'dept-rd' } });
  assert.equal(valid.status, 200, valid.body.error);
  assert.equal(valid.body.result.departmentId, 'dept-rd');
});

test('TableMind 保存视图和仪表盘后发布，公开分享只返回筛选结果', async t => {
  const service = serviceFor(t);
  await putTable(service);
  const saved = await call(service, '/api/tablemind/view', 'POST', { view: { id: 'rd', name: '研发活动', tableId: 'activities', type: 'grid', filters: [{ fieldId: 'department', op: 'eq', value: '研发部' }], sorts: [], config: {} } });
  assert.equal(saved.status, 200);
  const dashboard = await call(service, '/api/tablemind/dashboard', 'POST', { dashboard: { id: 'dash', name: '活动统计', tableId: 'activities', widgets: [{ id: 'w', type: 'chart', viewId: 'rd', x: 0, y: 0, w: 6, h: 4 }] } });
  assert.equal(dashboard.status, 200);
  const published = await call(service, '/api/tablemind/publish', 'POST', { entityType: 'view', entityId: 'rd', access: 'public' });
  assert.equal(published.status, 200);
  const opened = await call(service, `/api/tablemind/public/${published.body.result.token}`);
  assert.equal(opened.status, 200);
  assert.equal(opened.body.table.records.length, 2);
  assert.ok(opened.body.table.records.every(row => row.department === '研发部'));
  await call(service, '/api/tablemind/publish', 'POST', { entityType: 'view', entityId: 'rd', access: 'workspace' });
  const privateView = await call(service, `/api/tablemind/public/${published.body.result.token}`);
  assert.ok(privateView.status === 403 || privateView.status === 404);
});

test('TableMind 同步平台来源重复执行不重复建表且保留表 ID', async t => {
  const service = serviceFor(t);
  const source = { name: '报名数据', sourceKey: 'AdaptForm:form-1', source: { module: 'AdaptForm', formId: 'form-1' }, fields: [{ id: 'name', name: '姓名', type: 'text' }], records: [{ id: 'submission-1', name: '小林' }] };
  const first = await call(service, '/api/tablemind/sync', 'POST', { sources: [source] });
  assert.equal(first.status, 200);
  const id = first.body.result[0].id;
  source.records.push({ id: 'submission-2', name: '小张' });
  const second = await call(service, '/api/tablemind/sync', 'POST', { sources: [source] });
  assert.equal(second.status, 200);
  assert.equal(second.body.result[0].id, id);
  const synced = second.body.state.tables.filter(table => table.sourceKey === source.sourceKey);
  assert.equal(synced.length, 1);
  assert.equal(synced[0].records.length, 2);
  assert.equal(synced[0].source.formId, 'form-1');
});
