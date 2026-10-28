import { uid } from './model.js';

export const questionTypes = { single: '单选题', multiple: '多选题', boolean: '判断题', short: '简答题', fill: '填空题', calculation: '计算题' };
export const clone = value => JSON.parse(JSON.stringify(value));
export const totalPoints = paper => paper.items.reduce((sum, item) => sum + item.question.points, 0);
const now = () => new Date().toISOString();
export function parseSyllabus(text, name = '教学大纲.txt') {
  if (typeof text !== 'string' || typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('请填写有效资料名称（1–100 字）和大纲正文');
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 100) throw new Error('大纲需要 1–100 条非空知识点');
  const topics = lines.map((line, i) => {
    const parts = line.split(/[：:]/); const label = parts.shift().replace(/^[-*\d.、\s]+/, '').trim(); const statement = parts.join('：').trim();
    if (!label || label.length > 80 || statement.length > 2000) throw new Error(`第 ${i + 1} 行格式或长度不正确`);
    return { id: uid(), name: label, statement, line: i + 1 };
  });
  return { id: uid(), name: name.trim(), text, topics, importedAt: now() };
}
export function validateQuestion(q) {
  if (!questionTypes[q.type]) throw new Error('不支持的题型');
  if (typeof q.stem !== 'string' || !q.stem.trim() || q.stem.length > 5000) throw new Error('题干需要 1–5000 个字符');
  if (!Number.isFinite(q.points) || q.points <= 0 || q.points > 100) throw new Error('每题分值必须大于 0 且不超过 100');
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) throw new Error('难度必须为 1–5');
  if (typeof q.topic !== 'string' || !q.topic.trim() || q.topic.length > 80) throw new Error('知识点需要 1–80 个字符');
  if (typeof q.sourceId !== 'string' || typeof q.sourceRef !== 'string' || !q.sourceRef.trim()) throw new Error('请绑定来源及位置');
  if (typeof q.explanation !== 'string' || q.explanation.length > 5000) throw new Error('解析最多 5000 个字符');
  if (['short', 'calculation', 'fill'].includes(q.type)) {
    if (typeof q.answer !== 'string' || !q.answer.trim()) throw new Error('请填写参考答案');
    if (!Array.isArray(q.keywords) || !q.keywords.length || q.keywords.some(k => typeof k !== 'string' || !k.trim())) throw new Error('简答题需要至少一个评分关键词');
  } else {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8 || q.options.some(o => typeof o !== 'string' || !o.trim())) throw new Error('客观题需要 2–8 个非空选项');
    if (new Set(q.options).size !== q.options.length) throw new Error('选项不能重复');
    if (!Array.isArray(q.answer) || !q.answer.length || new Set(q.answer).size !== q.answer.length || q.answer.some(n => !Number.isInteger(n) || n < 0 || n >= q.options.length)) throw new Error('正确答案必须对应有效选项');
    if (q.type !== 'multiple' && q.answer.length !== 1) throw new Error('单选及判断题需要一个正确答案');
    if (q.type === 'boolean' && (q.options.length !== 2 || q.options[0] !== '正确' || q.options[1] !== '错误')) throw new Error('判断题选项必须为「正确」「错误」');
  }
  return q;
}
export function normalizeImportedBank(text, sourceId) {
  let input; try { input = JSON.parse(text); } catch { throw new Error('题库不是有效 JSON'); }
  const rows = Array.isArray(input) ? input : input?.questions;
  if (!Array.isArray(rows) || !rows.length || rows.length > 200) throw new Error('题库需要包含 1–200 道题');
  return rows.map((q, i) => {
    if (!q || typeof q !== 'object' || Array.isArray(q)) throw new Error(`第 ${i + 1} 题：需要题目对象`);
    const item = { id: uid(), type: q.type, stem: q.stem, options: q.options ?? [], answer: q.answer, points: Number(q.points ?? 5), difficulty: Number(q.difficulty ?? 3), topic: q.topic, sourceId, sourceRef: q.sourceRef || `题库第 ${i + 1} 题`, explanation: q.explanation || '', keywords: q.keywords || [], createdAt: now(), origin: '导入题库' };
    try { return validateQuestion(item); } catch (error) { throw new Error(`第 ${i + 1} 题：${error.message}`); }
  });
}
export function generateQuestions(source, types = ['single', 'boolean', 'short']) {
  if (!types.length || types.some(t => !questionTypes[t])) throw new Error('请选择有效题型');
  const topics = source.topics.filter(t => t.statement);
  if (!topics.length) throw new Error('至少需要一行「知识点：事实说明」才能生成题目；只有标题的大纲可用于覆盖分析');
  if (topics.length * types.length > 200) throw new Error('单次最多生成 200 道题，请减少知识点或题型');
  return topics.flatMap((topic, i) => types.map(type => {
    const q = { id: uid(), type, topic: topic.name, sourceId: source.id, sourceRef: `${source.name} · 第 ${topic.line} 行`, points: type === 'short' ? 10 : 5, difficulty: 2, createdAt: now(), origin: '本地模板生成', keywords: [topic.name], explanation: `来源原文：${topic.statement}` };
    if (type === 'short') Object.assign(q, { stem: `请简述「${topic.name}」的核心含义。`, options: [], answer: topic.statement, keywords: topic.statement.split(/[，,；;。]/).map(x => x.trim()).filter(Boolean).slice(0, 4) });
    else if (type === 'boolean') Object.assign(q, { stem: `根据资料，「${topic.name}」：${topic.statement.replace(/[。.!！]+$/, '')}。这一说法是否正确？`, options: ['正确', '错误'], answer: [0] });
    else if (type === 'multiple') Object.assign(q, { stem: `根据资料，选择对「${topic.name}」描述正确的所有选项。`, options: [topic.statement, `资料将此内容归入「${topic.name}」知识点`, '以上内容与资料无关', '资料未提供该知识点的说明'], answer: [0, 1] });
    else { const distractor = topics.find(t => t.statement !== topic.statement); Object.assign(q, { stem: `根据资料，以下哪项描述了「${topic.name}」？`, options: [...new Set([topic.statement, distractor?.statement || '资料未定义此概念', '此概念不属于本次资料范围', '以上选项均不正确', '该选项不是此知识点的定义'])].slice(0, 4), answer: [0] }); }
    return validateQuestion(q);
  }));
}
export function seedExamCraft() {
  const source = parseSyllabus('字段校验：必填规则用于阻止缺少必要信息的记录提交。\n数据关联：关联字段用于连接不同业务实体中的记录。\n权限控制：正式权限需要在服务端进行身份和操作授权校验。', '业务系统基础 · 示例大纲');
  return { version: 1, sources: [source], questions: generateQuestions(source, ['single', 'multiple', 'boolean', 'short']), papers: [], attempts: [] };
}
export function makePaper(name) { return { id: uid(), name: name.trim(), description: '', minutes: 30, passPercent: 60, status: 'draft', items: [], createdAt: now(), revision: 1 }; }
export function addQuestion(paper, question) {
  if (paper.status !== 'draft') throw new Error('已发布试卷不可直接修改，请复制为新草稿');
  if (paper.items.some(i => i.question.id === question.id)) throw new Error('试卷中已有此题');
  paper.items.push({ id: uid(), question: clone(validateQuestion(question)) }); paper.revision++;
}
export function moveItem(paper, from, to) {
  if (paper.status !== 'draft') throw new Error('已发布试卷不可调整');
  if (![from, to].every(n => Number.isInteger(n) && n >= 0 && n < paper.items.length)) throw new Error('排序位置不正确');
  const [item] = paper.items.splice(from, 1); paper.items.splice(to, 0, item); paper.revision++;
}
export function publishPaper(paper) {
  if (!paper.name.trim() || !paper.items.length) throw new Error('请设置试卷名称，并至少加入一道题');
  if (!Number.isFinite(paper.passPercent) || paper.passPercent < 0 || paper.passPercent > 100) throw new Error('通过线需要在 0–100% 之间');
  if (!Number.isInteger(paper.minutes) || paper.minutes < 1 || paper.minutes > 600) throw new Error('建议时长需要在 1–600 分钟之间');
  paper.items.forEach(i => validateQuestion(i.question)); paper.status = 'published'; paper.publishedAt = now();
}
export function startAttempt(paper, name) {
  if (paper.status !== 'published') throw new Error('请先在本地发布试卷');
  if (!name.trim() || name.trim().length > 60) throw new Error('请填写 1–60 字的答题人名称');
  return { id: uid(), paperId: paper.id, paper: clone(paper), name: name.trim(), startedAt: now(), status: 'answering', answers: {}, grades: [], total: null };
}
function equalSet(a, b) { return Array.isArray(a) && a.length === b.length && new Set(a).size === a.length && b.every(n => a.includes(n)); }
export function submitAttempt(attempt) {
  if (attempt.status !== 'answering') throw new Error('该答卷已提交');
  attempt.grades = attempt.paper.items.map(item => {
    const q = item.question, answer = attempt.answers[item.id];
    if (!['short', 'calculation', 'fill'].includes(q.type)) return { itemId: item.id, max: q.points, score: equalSet(answer, q.answer) ? q.points : 0, pending: false, method: '客观题自动评分' };
    const text = String(answer || '').trim();
    if (q.type === 'fill') return { itemId: item.id, max: q.points, score: text.normalize('NFKC').trim().toLowerCase() === q.answer.normalize('NFKC').trim().toLowerCase() ? q.points : 0, pending: false, method: '填空题标准答案匹配' };
    if (!text) return { itemId: item.id, max: q.points, score: 0, pending: false, method: '未作答' };
    const matches = q.keywords.filter(k => text.toLowerCase().includes(k.toLowerCase()));
    return { itemId: item.id, max: q.points, score: null, pending: true, suggestion: Math.round(q.points * matches.length / q.keywords.length * 100) / 100, matches, method: '关键词辅助，待人工确认', comment: '' };
  });
  attempt.submittedAt = now(); summarizeAttempt(attempt); return attempt;
}
export function summarizeAttempt(attempt) {
  attempt.pending = attempt.grades.filter(g => g.pending).length;
  attempt.total = Math.round(attempt.grades.reduce((n, g) => n + (g.score ?? 0), 0) * 100) / 100;
  attempt.status = attempt.pending ? 'pending' : 'graded';
  attempt.passed = attempt.pending ? null : attempt.total >= totalPoints(attempt.paper) * attempt.paper.passPercent / 100;
}
export function reviewGrade(attempt, itemId, score, comment) {
  if (attempt.status === 'answering') throw new Error('答卷尚未提交');
  const g = attempt.grades.find(g => g.itemId === itemId), item = attempt.paper.items.find(i => i.id === itemId);
  if (!g || !['short', 'calculation'].includes(item?.question.type)) throw new Error('只能人工批改简答题');
  if (!Number.isFinite(score) || score < 0 || score > g.max) throw new Error(`得分需要在 0–${g.max} 之间`);
  g.score = Math.round(score * 100) / 100; g.comment = comment.trim(); g.pending = false; g.method = '人工确认'; g.reviewedAt = now(); summarizeAttempt(attempt);
}
export function coverage(paper, sources) {
  const topics = [...new Set(sources.flatMap(s => s.topics || []).map(t => t.name))];
  const names = [...new Set([...topics, ...paper.items.map(i => i.question.topic)])];
  return names.map(name => ({ name, inSyllabus: topics.includes(name), count: paper.items.filter(i => i.question.topic === name).length, points: paper.items.filter(i => i.question.topic === name).reduce((n, i) => n + i.question.points, 0) }));
}
