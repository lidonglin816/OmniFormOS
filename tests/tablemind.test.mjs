import test from 'node:test';
import assert from 'node:assert/strict';
import { seedTableMind, parseCSV, analyzeQuery, groupCount } from '../public/tablemind-model.js';

test('CSV 自动识别数字、日期与文本字段', () => { const r = parseCSV('名称,日期,人数\n活动A,2026-10-01,12'); assert.deepEqual(r.fields.map(f => f.type), ['text', 'date', 'number']); assert.equal(r.records[0].col_2, 12); });
test('自然语言筛选部门、本月和人数', () => { const s = seedTableMind(); const r = analyzeQuery(s.records, '统计本月研发部人数超过 40 的活动'); assert.equal(r.records.length, 1); assert.equal(r.records[0].department, '研发部'); });
test('分组统计生成有序结果', () => { const s = seedTableMind(); const groups = groupCount(s.records, 'status'); assert.equal(groups[0][0], '已完成'); assert.equal(groups[0][1], 2); });
