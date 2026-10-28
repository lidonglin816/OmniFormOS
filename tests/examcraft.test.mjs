import test from 'node:test';
import assert from 'node:assert/strict';
import { clone, seedExamCraft, parseSyllabus, normalizeImportedBank, generateQuestions, makePaper, addQuestion, moveItem, publishPaper, startAttempt, submitAttempt, reviewGrade, totalPoints, coverage } from '../public/examcraft-model.js';

function fixture(types) {
  const store = seedExamCraft(), p = makePaper('验收测评');
  for (const type of types) addQuestion(p, store.questions.find(q => q.type === type));
  publishPaper(p); return { store, p };
}
test('大纲与规则生成绑定知识点、来源和行号；无事实时拒绝出题', () => {
  const s = parseSyllabus('账号管理：离职账号应停用。\n信息安全：仅访问授权数据。', '培训.txt');
  const questions = generateQuestions(s, ['single', 'short']);
  assert.equal(questions.length, 4); assert.equal(questions[2].sourceRef, '培训.txt · 第 2 行'); assert.equal(questions[2].topic, '信息安全');
  assert.equal(questions[1].answer, s.topics[0].statement);
  assert.throws(() => generateQuestions(parseSyllabus('只有知识点标题')), /事实说明/);
  assert.throws(() => generateQuestions(s, []), /有效题型/);
});
test('题库导入校验全部题目，拒绝越界答案和不匹配题型', () => {
  const q = seedExamCraft().questions[0];
  const valid = normalizeImportedBank(JSON.stringify([q]), 'new-source');
  assert.notEqual(valid[0].id, q.id); assert.equal(valid[0].sourceId, 'new-source');
  assert.throws(() => normalizeImportedBank(JSON.stringify([q, { ...q, answer: [100] }]), 's'), /第 2 题/);
  assert.throws(() => normalizeImportedBank(JSON.stringify([{ ...q, type: 'boolean' }]), 's'), /判断题选项/);
  assert.throws(() => normalizeImportedBank('{oops', 's'), /有效 JSON/);
  assert.throws(() => normalizeImportedBank('null', 's'), /1–200/);
  assert.throws(() => normalizeImportedBank('[null]', 's'), /第 1 题/);
});
test('试卷快照不随题库修改；排序保持题目 ID；发布后不可加入或调整', () => {
  const s = seedExamCraft(), p = makePaper('期末'); addQuestion(p, s.questions[0]); addQuestion(p, s.questions[1]);
  const first = p.items[0].id, stem = p.items[0].question.stem;
  s.questions[0].stem = '已编辑题库'; assert.equal(p.items[0].question.stem, stem);
  moveItem(p, 0, 1); assert.equal(p.items[1].id, first);
  assert.throws(() => addQuestion(p, s.questions[0]), /已有此题/);
  publishPaper(p); assert.throws(() => moveItem(p, 1, 0), /已发布/); assert.throws(() => addQuestion(p, s.questions[2]), /已发布/);
});
test('多选采用精确集合评分：全对得分，漏选、多选、重复、字符串答案不得分', () => {
  const { p } = fixture(['multiple']); const item = p.items[0];
  for (const [answer, expected] of [[[1, 0], 5], [[0], 0], [[0, 1, 2], 0], [[0, 0], 0], [['0', '1'], 0], [[], 0]]) {
    const a = startAttempt(p, '测试'); a.answers[item.id] = answer; submitAttempt(a); assert.equal(a.total, expected); assert.equal(a.status, 'graded');
  }
});
test('主观题建议不计入最终成绩，人工评分校验分值并更新通过结果', () => {
  const { p } = fixture(['single', 'short']); const a = startAttempt(p, '验收学员');
  a.answers[p.items[0].id] = clone(p.items[0].question.answer); a.answers[p.items[1].id] = p.items[1].question.answer;
  submitAttempt(a); assert.equal(a.total, 5); assert.equal(a.status, 'pending'); assert.equal(a.passed, null); assert.equal(a.grades[1].suggestion, 10);
  assert.throws(() => reviewGrade(a, p.items[1].id, 11, ''), /0–10/); assert.equal(a.status, 'pending');
  reviewGrade(a, p.items[1].id, 8, '表达正确，部分细节不足'); assert.equal(a.total, 13); assert.equal(a.status, 'graded'); assert.equal(a.passed, true);
  assert.throws(() => submitAttempt(a), /已提交/);
});
test('答卷使用试卷快照，未作答题目为零且不误报通过', () => {
  const { p } = fixture(['single', 'short']); const a = startAttempt(p, '未作答');
  p.items[0].question.points = 99; assert.equal(totalPoints(a.paper), 15);
  submitAttempt(a); assert.equal(a.total, 0); assert.equal(a.pending, 0); assert.equal(a.status, 'graded'); assert.equal(a.passed, false);
});
test('覆盖分析包含未命中的大纲知识点，不把未覆盖算已覆盖', () => {
  const s = seedExamCraft(), p = makePaper('覆盖'); addQuestion(p, s.questions[0]);
  const rows = coverage(p, s.sources); assert.equal(rows.length, 3); assert.equal(rows.filter(r => r.count > 0).length, 1); assert.equal(rows.reduce((n, r) => n + r.points, 0), 5);
});
test('相同事实的多个知识点仍生成互异选项，资料名称不能全空白', () => {
  const s = parseSyllabus('账号：应及时停用。\n账号维护：应及时停用。');
  const questions = generateQuestions(s, ['single', 'boolean']);
  assert.equal(questions.length, 4);
  assert.equal(new Set(questions[0].options).size, questions[0].options.length);
  assert.ok(!questions[1].stem.includes('。。'));
  assert.throws(() => parseSyllabus('知识点：事实', '  '), /资料名称/);
});
