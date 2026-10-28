import { uid } from './model.js';
import { questionTypes, clone, totalPoints, parseSyllabus, normalizeImportedBank, generateQuestions, validateQuestion, makePaper, addQuestion, moveItem, publishPaper, startAttempt, submitAttempt, reviewGrade, coverage } from './examcraft-model.js';

const letters = 'ABCDEFGH';
const statusNames = { answering: '答题中', pending: '待人工评分', graded: '评分完成' };
export function createExamCraft(ctx) {
  const { escape: esc, toast, modal, closeModal } = ctx;
  const store = () => ctx.store();
  let view = 'bank', selected = store().questions[0]?.id, paperId = store().papers[0]?.id, attemptId, bankQuery = '', bankType = '', lastLink = '', dragId;
  try {
    const ui = JSON.parse(sessionStorage.getItem('examcraft.ui'));
    if (ui) {
      if (['dashboard', 'bank', 'papers', 'paper', 'sources', 'results', 'launch', 'answer', 'review'].includes(ui.view)) view = ui.view;
      if (store().questions.some(q => q.id === ui.selected)) selected = ui.selected;
      if (store().papers.some(p => p.id === ui.paperId)) paperId = ui.paperId;
      if (store().attempts.some(a => a.id === ui.attemptId)) attemptId = ui.attemptId;
      const linked = new URLSearchParams(location.hash.split('?')[1] || '').get('paper');
      if (ui.view === 'answer' && store().attempts.some(a => a.id === attemptId && a.status === 'answering' && a.paperId === linked)) lastLink = linked;
    }
  } catch { /* Optional UI state. */ }
  store().drafts ||= {};
  const bankQuestion = () => store().questions.find(q => q.id === selected);
  const draft = () => store().drafts[selected] || bankQuestion();
  const paper = () => store().papers.find(p => p.id === paperId);
  const attempt = () => store().attempts.find(a => a.id === attemptId);
  const save = message => { ctx.commit(message); };
  const paint = () => ctx.render();
  const opt = (value, label, match) => `<option value="${esc(value)}" ${match ? 'selected' : ''}>${esc(label)}</option>`;
  const tag = (text, cls = '') => `<span class="ec-tag ${cls}">${esc(text)}</span>`;
  const empty = (title, desc) => `<div class="ec-empty"><span>▧</span><h3>${title}</h3><p>${desc}</p></div>`;
  const humanTime = value => new Date(value).toLocaleString('zh-CN');
  function applyPaperSettings(form = document.querySelector('#ec-paper-settings')) {
    if (!form || paper()?.status !== 'draft') throw new Error('只能设置试卷草稿');
    const data = new FormData(form), name = data.get('name').trim(), minutes = Number(data.get('minutes')), passPercent = Number(data.get('passPercent'));
    if (!name || !Number.isInteger(minutes) || minutes < 1 || minutes > 600 || !Number.isFinite(passPercent) || passPercent < 0 || passPercent > 100) throw new Error('请检查名称、建议时长和通过线');
    Object.assign(paper(), { name, minutes, passPercent });
  }
  function render() {
    const linked = new URLSearchParams(location.hash.split('?')[1] || '').get('paper');
    if (linked && linked !== lastLink) { lastLink = linked; paperId = linked; view = 'launch'; }
    try { sessionStorage.setItem('examcraft.ui', JSON.stringify({ view, selected, paperId, attemptId })); } catch { /* Business data is persisted separately. */ }
    const tabs = [['dashboard', '◈ 测评概览'], ['bank', '▤ 题库编辑'], ['papers', '▧ 试卷工坊'], ['sources', '⌁ 大纲与来源'], ['results', '▥ 成绩分析']];
    return `<div class="ec-root"><div class="ec-heading"><div><div class="ec-kicker">OMNIFORMOS / MODULE 02</div><h1>ExamCraft<span>智能考试与测评工厂</span></h1><p>让每一道题有据可依，让每一次测评看见成长。</p></div><div class="button-group"><button class="secondary" data-ec-view="sources">↥ 导入资料</button><button class="ec-primary" data-ec-action="generate">✦ 规则出题</button></div></div><section class="ec-shell"><div class="ec-shell-top"><div class="ec-logo"><span>▰</span> ExamCraft Studio <small>LOCAL PROTOTYPE</small></div><span class="ec-online"><i></i> 浏览器本地保存</span></div><nav class="ec-nav">${tabs.map(([id, label]) => `<button class="${view === id || ['paper', 'launch', 'answer'].includes(view) && id === 'papers' ? 'active' : ''}" data-ec-view="${id}">${label}</button>`).join('')}</nav><div class="ec-content">${({ dashboard, bank: bankView, papers: papersView, paper: paperView, sources: sourcesView, results: resultsView, launch: launchView, answer: answerView, review: reviewView })[view]?.() || dashboard()}</div><div class="ec-footnote">本地原型 · 规则与模板出题，未接入真实 AI · 题库和答案保存在本机，无考试防作弊或身份隔离</div></section></div>`;
  }
  function dashboard() {
    const s = store(), graded = s.attempts.filter(a => a.status === 'graded'), pending = s.attempts.filter(a => a.status === 'pending');
    return `<div class="ec-hero"><div><span class="ec-kicker">ASSESS WHAT MATTERS</span><h2>把知识，转化为可衡量的成长。</h2><p>从大纲到试卷，从答题到反馈。完整的测评流程，在这里连接。</p><button class="ec-primary" data-ec-action="new-paper">＋ 创建第一份试卷</button></div><div class="ec-hero-art" aria-hidden="true">▧<span>✓</span></div></div><div class="ec-stats">${[[s.questions.length, '题库题目'], [s.papers.length, '试卷数量'], [graded.length, '已完成评分'], [pending.length, '待人工评分']].map(([n, t]) => `<div><small>${t}</small><strong>${n.toString().padStart(2, '0')}</strong></div>`).join('')}</div><div class="ec-two-col"><section class="ec-box"><div class="ec-section-head"><h2>最近的试卷</h2><button data-ec-view="papers">全部试卷 →</button></div>${s.papers.slice(0, 4).map(p => `<button class="ec-paper-row" data-ec-paper="${p.id}"><span>▧</span><div><strong>${esc(p.name)}</strong><small>${p.items.length} 道题 · ${totalPoints(p)} 分</small></div>${tag(p.status === 'published' ? '已本地发布' : '草稿')}</button>`).join('') || empty('第一份试卷，从这里开始', '选择题库中的题目，配置测评规则。')}</section><section class="ec-box"><div class="ec-section-head"><h2>测评流程</h2></div><div class="ec-steps">${[['01', '导入资料', '每行一个知识点，可附事实说明。'], ['02', '组卷与校对', '配置题型、分值、解析和来源。'], ['03', '答题与评分', '客观题自动评分，简答题人工确认。'], ['04', '分析与反馈', '查看知识点覆盖和真实答卷成绩。']].map(([n, t, d]) => `<div><span>${n}</span><p><strong>${t}</strong><small>${d}</small></p></div>`).join('')}</div></section></div>`;
  }
  function bankList() {
    const rows = store().questions.filter(q => (!bankType || q.type === bankType) && `${q.stem} ${q.topic}`.toLowerCase().includes(bankQuery.toLowerCase()));
    return rows.map((q, i) => `<button class="ec-question-link ${q.id === selected ? 'active' : ''}" data-ec-question="${q.id}"><span>${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(q.stem)}</strong><small>${questionTypes[q.type]} · ${esc(q.topic)} ${store().drafts[q.id] ? '· 未保存草稿' : ''}</small></div></button>`).join('') || empty('未找到题目', '更换搜索条件试试。');
  }
  function bankView() {
    if (!bankQuestion()) selected = store().questions[0]?.id;
    return `<div class="ec-bank-toolbar"><span>${store().questions.length} 道题 · 示例题已标注来源</span><div><input id="ec-bank-query" aria-label="搜索题目" value="${esc(bankQuery)}" placeholder="搜索题干或知识点…" /><select id="ec-bank-type" aria-label="按题型筛选"><option value="">全部题型</option>${Object.entries(questionTypes).map(([id, name]) => opt(id, name, bankType === id)).join('')}</select><button class="ec-primary" data-ec-action="new-question">＋ 新建题目</button></div></div><div class="ec-editor-grid"><aside class="ec-question-list" id="ec-question-list">${bankList()}</aside>${bankQuestion() ? editor() : empty('题库还是空的', '导入题库，或创建第一道题目。')}</div>`;
  }
  function questionPreview(q, answers = false) {
    return `<article class="ec-preview-card"><div class="ec-preview-meta">${tag(questionTypes[q.type])}<span>${Number(q.points) || 0} 分</span></div><h3>${esc(q.stem)}</h3>${q.type === 'short' ? `<div class="ec-preview-short">在这里填写你的回答…</div>` : `<div class="ec-preview-options">${q.options.map((o, i) => `<div class="${answers && q.answer.includes(i) ? 'correct' : ''}"><span>${q.type === 'multiple' ? '□' : '○'}</span><b>${letters[i]}</b> ${esc(o)}${answers && q.answer.includes(i) ? '<em>✓</em>' : ''}</div>`).join('')}</div>`}${answers ? `<div class="ec-answer-reference"><strong>参考答案</strong><p>${esc(q.type === 'short' ? q.answer : q.answer.map(i => letters[i]).join('、'))}</p><small>${esc(q.explanation || '尚未填写解析')}</small></div>` : ''}<div class="ec-preview-source">⌁ ${esc(q.topic)}<br>来源：${esc(q.sourceRef)}</div></article>`;
  }
  function editor() {
    const q = draft();
    return `<section class="ec-edit-pane"><div class="ec-pane-head"><span>▤ 题目编辑器</span>${tag(store().drafts[selected] ? '有未保存修改' : '已保存', store().drafts[selected] ? 'amber' : '')}</div><form id="ec-question-form" class="ec-form"><div class="ec-form-row"><label>题型<select name="type" id="ec-question-type">${Object.entries(questionTypes).map(([id, name]) => opt(id, name, q.type === id)).join('')}</select></label><label>难度<select name="difficulty">${[1, 2, 3, 4, 5].map(n => opt(n, `${n} / 5`, q.difficulty === n)).join('')}</select></label><label>分值<input name="points" type="number" min="0.01" max="100" step="0.01" required value="${q.points}" /></label></div><label>题干<textarea name="stem" required maxlength="5000" rows="5">${esc(q.stem)}</textarea></label>${q.type === 'short' ? `<label>参考答案<textarea name="answerText" required rows="3">${esc(q.answer)}</textarea></label><label>评分关键词（每行一条，仅辅助评分）<textarea name="keywords" required rows="3">${esc(q.keywords.join('\n'))}</textarea></label>` : `<fieldset><legend>选项与正确答案 ${q.type === 'multiple' ? '（可多选）' : '（选择一项）'}</legend>${q.options.map((o, i) => `<div class="ec-option-editor"><label class="ec-answer-check"><input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="correct" value="${i}" ${q.answer.includes(i) ? 'checked' : ''} aria-label="选项 ${letters[i]} 为正确答案" /><span>${letters[i]}</span></label><input name="option-${i}" value="${esc(o)}" required ${q.type === 'boolean' ? 'readonly' : ''} aria-label="选项 ${letters[i]} 内容" /></div>`).join('')}${q.type !== 'boolean' && q.options.length < 8 ? '<button type="button" class="ec-text-button" data-ec-action="add-option">＋ 添加选项</button>' : ''}</fieldset>`}<label>知识点<input name="topic" required maxlength="80" value="${esc(q.topic)}" /></label><label>来源文档<select name="sourceId">${store().sources.map(s => opt(s.id, s.name, q.sourceId === s.id)).join('')}</select></label><label>来源位置<input name="sourceRef" required maxlength="300" value="${esc(q.sourceRef)}" placeholder="如：培训手册，第 3 节" /></label><label>答案解析<textarea name="explanation" maxlength="5000" rows="3">${esc(q.explanation)}</textarea></label><p class="ec-help">规则：客观题全部匹配才得分；简答题按关键词给出建议，最终分数需人工确认。题库修改不影响已加入试卷的题目快照。</p><div class="ec-editor-save"><button class="ec-primary">保存题目</button><button type="button" class="ec-quiet" data-ec-action="discard-draft">撤销草稿</button></div></form></section><section class="ec-preview-pane"><div class="ec-pane-head"><span>◉ 学生实时预览</span><small>含答案 · 教师视角</small></div><div id="ec-live-preview">${questionPreview(q, true)}</div></section>`;
  }
  function sourcesView() {
    return `<div class="ec-section-head"><div><h2>大纲与来源资料</h2><p>大纲按行解析，题目保留知识点和来源位置。</p></div><button class="ec-quiet" data-ec-action="bank-template">⇩ 下载题库 JSON 示例</button></div><div class="ec-two-col"><section class="ec-box"><h3>导入教学大纲</h3><form id="ec-syllabus-form" class="ec-form"><label>资料名称<input name="name" required maxlength="100" placeholder="例如：新员工培训大纲" /></label><label>大纲正文<textarea name="text" id="ec-syllabus-text" required rows="8" placeholder="信息安全：敏感数据应按权限最小化原则访问。&#10;账号管理：离职账号应及时停用。"></textarea></label><label class="ec-upload">↥ 读取 UTF-8 TXT 文件<input id="ec-syllabus-file" type="file" accept=".txt,text/plain" /></label><p class="ec-help">每行格式：知识点：事实说明。只有标题也可导入，但不能据此生成题目。支持 TXT / 粘贴文本；不支持 PDF、Word 或 OCR。</p><button class="ec-primary">导入大纲</button></form></section><section class="ec-box"><h3>导入已有题库</h3><form id="ec-bank-import" class="ec-form"><label>来源名称<input name="name" required maxlength="100" placeholder="例如：培训题库 v1" /></label><label>JSON 题库<textarea name="json" id="ec-bank-json" required rows="8" placeholder='{"questions":[{"type":"single", "stem":"题干", ...}]}'></textarea></label><label class="ec-upload">↥ 读取 JSON 文件<input id="ec-bank-file" type="file" accept=".json,application/json" /></label><p class="ec-help">导入前校验所有题目；任意一题无效则整批不导入。答案为选项的零起始序号数组。单批最多 200 题，文件最多 2 MB。</p><button class="ec-primary">校验并导入题库</button></form></section></div><section class="ec-box ec-margin"><div class="ec-section-head"><h2>资料库</h2><span>${store().sources.length} 份资料</span></div>${store().sources.map(s => `<div class="ec-source-row"><span>▤</span><div><strong>${esc(s.name)}</strong><small>${s.topics.length} 个大纲知识点 · ${store().questions.filter(q => q.sourceId === s.id).length} 道关联题目</small></div><button class="ec-quiet" data-ec-source="${s.id}">查看原文</button></div>`).join('')}</section>`;
  }
  function papersView() {
    return `<div class="ec-section-head"><div><h2>试卷工坊</h2><p>题目以快照加入试卷，发布后保持稳定。</p></div><button class="ec-primary" data-ec-action="new-paper">＋ 创建试卷</button></div><div class="ec-paper-grid">${store().papers.map(p => `<article class="ec-paper-card"><div>${tag(p.status === 'published' ? '本地已发布' : '草稿', p.status === 'published' ? 'green' : '')}<span>▧</span></div><h3>${esc(p.name)}</h3><p>${p.items.length} 道题 <b>·</b> ${totalPoints(p)} 分 <b>·</b> 建议 ${p.minutes} 分钟</p><div><button class="ec-text-button" data-ec-paper="${p.id}">${p.status === 'published' ? '查看试卷' : '继续编辑'} →</button>${p.status === 'published' ? `<button class="ec-primary" data-ec-launch="${p.id}">开始测评</button>` : ''}</div></article>`).join('') || empty('还没有试卷', '创建草稿，添加题目并设置评分规则。')}</div>`;
  }
  function paperView() {
    const p = paper(); if (!p) return papersView(); const editable = p.status === 'draft'; const cov = coverage(p, store().sources); const covered = cov.filter(t => t.count).length;
    return `<div class="ec-section-head"><div><button class="ec-text-button" data-ec-view="papers">← 试卷列表</button><h2>${esc(p.name)} ${tag(editable ? '草稿' : '本地已发布', editable ? '' : 'green')}</h2><p>${p.items.length} 道题 · ${totalPoints(p)} 分 · 覆盖 ${covered}/${cov.length} 个知识点</p></div><div class="button-group"><button class="ec-quiet" data-ec-action="copy-paper">复制为新草稿</button>${editable ? '<button class="ec-primary" data-ec-action="publish">本地发布试卷 ↗</button>' : `<button class="ec-primary" data-ec-launch="${p.id}">开始测评 →</button>`}</div></div><div class="ec-paper-layout"><section><div class="ec-box"><form id="ec-paper-settings" class="ec-form"><div class="ec-form-row"><label>试卷名称<input name="name" value="${esc(p.name)}" required maxlength="100" ${editable ? '' : 'disabled'} /></label><label>建议时长（分钟）<input name="minutes" type="number" min="1" max="600" value="${p.minutes}" required ${editable ? '' : 'disabled'} /></label><label>通过线（%）<input name="passPercent" type="number" min="0" max="100" value="${p.passPercent}" required ${editable ? '' : 'disabled'} /></label></div>${editable ? '<button class="ec-quiet">保存试卷配置</button>' : ''}</form><p class="ec-help">建议时长不自动收卷。发布只在当前浏览器生效；题型评分按试卷快照执行。</p></div><div class="ec-paper-items">${p.items.map((item, i) => `<article class="ec-paper-item" draggable="${editable}" data-ec-item="${item.id}"><div class="ec-item-top"><span class="ec-drag" title="拖动调整顺序">⠿</span><strong>${String(i + 1).padStart(2, '0')}</strong>${tag(questionTypes[item.question.type])}<span>${esc(item.question.topic)}</span><b>${item.question.points} 分</b></div><p>${esc(item.question.stem)}</p><small>⌁ ${esc(item.question.sourceRef)}</small><div class="ec-item-actions"><button data-ec-item-preview="${item.id}">查看题目</button>${editable ? `<button data-ec-move="${i}" data-direction="-1" ${i === 0 ? 'disabled' : ''} aria-label="第 ${i + 1} 题上移">↑ 上移</button><button data-ec-move="${i}" data-direction="1" ${i === p.items.length - 1 ? 'disabled' : ''} aria-label="第 ${i + 1} 题下移">↓ 下移</button><label>分值<input type="number" data-ec-item-points="${item.id}" value="${item.question.points}" min="0.01" max="100" step="0.01" aria-label="第 ${i + 1} 题分值" /></label><button class="ec-danger" data-ec-remove-item="${item.id}">移出试卷</button>` : ''}</div></article>`).join('') || empty('把题目加入这份试卷', '从右侧题库选择题目，可拖动排序，也可以使用上下移动按钮。')}</div></section><aside class="ec-box ec-paper-side"><div class="ec-section-head"><h2>${editable ? '从题库添加' : '知识点覆盖'}</h2></div>${editable ? `<div class="ec-add-bank">${store().questions.map(q => `<div><span>${tag(questionTypes[q.type])} ${q.points} 分</span><strong>${esc(q.stem)}</strong><small>${esc(q.topic)}</small><button class="ec-quiet" data-ec-add-question="${q.id}" ${p.items.some(i => i.question.id === q.id) ? 'disabled' : ''}>${p.items.some(i => i.question.id === q.id) ? '已加入' : '＋ 加入试卷'}</button></div>`).join('')}</div>` : ''}<div class="ec-coverage"><h3>知识点覆盖分析</h3>${cov.map(t => `<div><span>${esc(t.name)} ${!t.inSyllabus ? '（大纲外）' : ''}</span><small>${t.count} 题 / ${t.points} 分</small><div class="ec-meter"><i style="width:${totalPoints(p) ? t.points / totalPoints(p) * 100 : 0}%"></i></div></div>`).join('')}</div>${!editable ? `<button class="ec-quiet" data-ec-action="embed">嵌入 FormPilot 应用</button><button class="ec-quiet" data-ec-action="export-paper">导出试卷 JSON</button>` : ''}</aside></div>`;
  }
  function launchView() {
    const p = paper(); if (!p || p.status !== 'published') return empty('试卷不可用', '此浏览器中没有对应的已发布试卷，请从试卷工坊选择。');
    const ongoing = store().attempts.filter(a => a.paperId === p.id && a.status === 'answering');
    return `<div class="ec-launch"><span class="ec-kicker">ASSESSMENT READY</span><h2>${esc(p.name)}</h2><div class="ec-launch-meta">${tag(`${p.items.length} 道题`)}${tag(`总分 ${totalPoints(p)}`)}${tag(`通过线 ${p.passPercent}%`)}${tag(`建议 ${p.minutes} 分钟`)}</div><p>客观题提交后自动评分；已作答的简答题需要人工确认评分。<br>当前为本地演示，答题不提供身份验证或防作弊保护。</p><form id="ec-start-form" class="ec-form"><label>答题人名称<input name="name" required maxlength="60" placeholder="例如：体验学员" /></label><button class="ec-primary">开始答题 →</button></form>${ongoing.length ? `<div class="ec-resume"><h3>未提交的本地答卷</h3>${ongoing.map(a => `<button class="ec-quiet" data-ec-resume="${a.id}">继续 ${esc(a.name)} 的答卷 →</button>`).join('')}</div>` : ''}</div>`;
  }
  function answerView() {
    const a = attempt(); if (!a || a.status !== 'answering') return resultsView();
    const count = a.paper.items.filter(i => Array.isArray(a.answers[i.id]) ? a.answers[i.id].length : String(a.answers[i.id] || '').trim()).length;
    return `<div class="ec-section-head"><div><h2>${esc(a.paper.name)}</h2><p>${esc(a.name)} · 已作答 ${count}/${a.paper.items.length} 题 · 自动保存在本地</p></div><button class="ec-primary" data-ec-action="submit-exam">提交答卷 →</button></div><div class="ec-answer-layout"><div class="ec-answer-list">${a.paper.items.map((item, i) => { const q = item.question, value = a.answers[item.id]; return `<section class="ec-answer-question" id="ec-answer-${i}"><div class="ec-preview-meta"><span>QUESTION ${String(i + 1).padStart(2, '0')} ${tag(questionTypes[q.type])}</span><span>${q.points} 分</span></div><h3>${esc(q.stem)}</h3>${q.type === 'short' ? `<textarea data-ec-response="${item.id}" aria-label="第 ${i + 1} 题回答" rows="5" maxlength="10000" placeholder="请输入你的回答…">${esc(value || '')}</textarea>` : `<div class="ec-answer-options">${q.options.map((text, n) => `<label><input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="answer-${item.id}" data-ec-response="${item.id}" value="${n}" ${Array.isArray(value) && value.includes(n) ? 'checked' : ''} /><span>${letters[n]}</span>${esc(text)}</label>`).join('')}</div>`}</section>`; }).join('')}</div><aside class="ec-box ec-answer-map"><h3>答题卡</h3><div>${a.paper.items.map((item, i) => `<a href="#ec-answer-${i}" data-ec-scroll="ec-answer-${i}" class="${Array.isArray(a.answers[item.id]) ? a.answers[item.id].length ? 'answered' : '' : String(a.answers[item.id] || '').trim() ? 'answered' : ''}">${i + 1}</a>`).join('')}</div><p>蓝色表示已作答。可以跳题，未作答题目按 0 分处理。</p><button class="ec-quiet" data-ec-view="papers">保存并返回</button></aside></div>`;
  }
  function resultsView() {
    const rows = store().attempts.filter(a => a.status !== 'answering'), graded = rows.filter(a => a.status === 'graded');
    const avg = graded.length ? (graded.reduce((n, a) => n + a.total / totalPoints(a.paper) * 100, 0) / graded.length).toFixed(1) : '—';
    return `<div class="ec-section-head"><div><h2>成绩与知识点分析</h2><p>统计来自实际提交的本地答卷。待人工评分答卷不计入平均分与通过率。</p></div><button class="ec-quiet" data-ec-action="export-results">⇩ 导出成绩 JSON</button></div><div class="ec-stats">${[[rows.length, '已提交答卷'], [rows.filter(a => a.status === 'pending').length, '待人工评分'], [avg === '—' ? avg : avg + '%', '平均得分率'], [graded.length ? `${Math.round(graded.filter(a => a.passed).length / graded.length * 100)}%` : '—', '通过率']].map(([n, text]) => `<div><small>${text}</small><strong>${n}</strong></div>`).join('')}</div><div class="ec-box"><div class="table-wrap"><table><thead><tr><th>答题人</th><th>试卷</th><th>当前得分 / 总分</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.paper.name)}</td><td>${a.total} / ${totalPoints(a.paper)}${a.pending ? '（暂计）' : ''}</td><td>${tag(a.status === 'pending' ? `待批 ${a.pending} 题` : a.passed ? '已通过' : '未通过', a.status === 'graded' && a.passed ? 'green' : a.pending ? 'amber' : '')}</td><td><button class="ec-text-button" data-ec-review="${a.id}">查看 / 评分 →</button></td></tr>`).join('')}</tbody></table></div>${rows.length ? '' : empty('还没有提交的答卷', '本地发布试卷并完成一次答题后，这里将展示真实成绩。')}</div>`;
  }
  function reviewView() {
    const a = attempt(); if (!a || a.status === 'answering') return resultsView();
    const topics = [...new Set(a.paper.items.map(i => i.question.topic))];
    return `<div class="ec-section-head"><div><button class="ec-text-button" data-ec-view="results">← 成绩列表</button><h2>${esc(a.name)} · ${esc(a.paper.name)}</h2><p>${humanTime(a.submittedAt)} · ${statusNames[a.status]} · 当前得分 ${a.total}/${totalPoints(a.paper)}${a.pending ? '（含未批题目暂计 0 分）' : ''}</p></div>${tag(a.pending ? `${a.pending} 道题待确认` : a.passed ? '已通过' : '未通过', a.pending ? 'amber' : 'green')}</div><div class="ec-topic-report">${topics.map(t => { const items = a.paper.items.filter(i => i.question.topic === t), grades = items.map(i => a.grades.find(g => g.itemId === i.id)); const max = grades.reduce((n, g) => n + g.max, 0), score = grades.reduce((n, g) => n + (g.score || 0), 0); return `<div><span>${esc(t)}</span><strong>${score}/${max}</strong><small>${grades.some(g => g.pending) ? '含待评分题目' : '已评分'}</small><div class="ec-meter"><i style="width:${score / max * 100}%"></i></div></div>`; }).join('')}</div><div class="ec-review-list">${a.paper.items.map((item, i) => {
      const q = item.question, g = a.grades.find(g => g.itemId === item.id), value = a.answers[item.id];
      return `<section class="ec-box"><div class="ec-section-head"><h3>第 ${i + 1} 题 · ${questionTypes[q.type]}</h3>${tag(g.pending ? '待人工评分' : `${g.score}/${g.max} 分`, g.pending ? 'amber' : '')}</div><p class="ec-review-stem">${esc(q.stem)}</p><dl class="ec-review-detail"><dt>学员作答</dt><dd>${esc(q.type === 'short' ? value || '未作答' : Array.isArray(value) && value.length ? value.map(n => `${letters[n]} · ${q.options[n]}`).join('\n') : '未作答')}</dd><dt>参考答案</dt><dd>${esc(q.type === 'short' ? q.answer : q.answer.map(n => `${letters[n]} · ${q.options[n]}`).join('\n'))}</dd><dt>解析与来源</dt><dd>${esc(q.explanation)}<small>${esc(q.sourceRef)} · ${esc(q.topic)}</small></dd></dl>${q.type === 'short' ? `<div class="ec-review-assist">辅助建议：${g.suggestion ?? 0}/${g.max} 分 · 命中 ${g.matches?.length || 0}/${q.keywords.length} 个关键词。该建议不是最终评分。</div><form class="ec-grade-form" data-item="${item.id}"><label>人工确认得分<input name="score" type="number" min="0" max="${g.max}" step="0.01" required value="${g.score ?? ''}" /></label><label>评分反馈<input name="comment" maxlength="1000" value="${esc(g.comment || '')}" placeholder="填写评分理由" /></label><button class="ec-primary">确认评分</button></form>` : `<p class="ec-help">${g.method} · 多选题采用全部匹配得分，不设部分分。</p>`}</section>`;
    }).join('')}</div>`;
  }
  function questionFromForm() {
    const form = document.querySelector('#ec-question-form'); if (!form) return draft(); const data = new FormData(form), current = draft();
    return { ...clone(current), type: data.get('type'), stem: data.get('stem'), points: Number(data.get('points')), difficulty: Number(data.get('difficulty')), topic: data.get('topic'), sourceId: data.get('sourceId') || '', sourceRef: data.get('sourceRef'), explanation: data.get('explanation'), options: current.type === 'short' ? [] : current.options.map((_, i) => data.get(`option-${i}`) || ''), answer: current.type === 'short' ? data.get('answerText') || '' : data.getAll('correct').map(Number), keywords: current.type === 'short' ? (data.get('keywords') || '').split('\n').map(k => k.trim()).filter(Boolean) : [] };
  }
  function download(data, name) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function generateModal() { modal(`<h2>根据大纲规则出题</h2><form id="ec-generate-form" class="ec-form ec-modal-form"><label>来源大纲<select name="source">${store().sources.filter(s => s.topics.length).map(s => opt(s.id, s.name, false)).join('')}</select></label><fieldset><legend>生成题型（每个带事实说明的知识点各生成一题）</legend>${Object.entries(questionTypes).map(([id, label]) => `<label class="ec-check"><input type="checkbox" name="types" value="${id}" ${id === 'single' ? 'checked' : ''} /> ${label}</label>`).join('')}</fieldset><p class="ec-help">本地模板将直接引用来源事实，干扰项和题目质量需人工审核。生成数量受资料中事实条目和所选题型决定，不调用真实 AI。</p><button class="ec-primary">生成并加入题库</button></form>`); }
  function newPaperModal() { modal('<h2>创建试卷草稿</h2><form id="ec-new-paper" class="ec-form ec-modal-form"><label>试卷名称<input name="name" required maxlength="100" placeholder="例如：新员工业务基础测评" /></label><button class="ec-primary">创建试卷</button></form>'); }
  function embedModal() {
    if (!ctx.apps().length) return toast('请先在 FormPilot 创建一个应用');
    modal(`<h2>嵌入 FormPilot 应用</h2><form id="ec-embed-form" class="ec-form ec-modal-form"><label>选择业务应用<select name="app">${ctx.apps().map(a => opt(a.id, a.name, false)).join('')}</select></label><p class="ec-help">在应用预览的概览页添加考试入口，点击后进入本地测评。此版本不生成公开网站，也不提供跨浏览器共享。</p><button class="ec-primary">添加测评入口</button></form>`);
  }
  document.addEventListener('click', event => {
    const scroll = event.target.closest('[data-ec-scroll]'); if (scroll) { event.preventDefault(); document.getElementById(scroll.dataset.ecScroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const el = event.target.closest('button'); if (!el) return; const d = el.dataset;
    try {
      if (d.ecView) { view = d.ecView; paint(); }
      if (d.ecQuestion) { selected = d.ecQuestion; paint(); }
      if (d.ecPaper) { paperId = d.ecPaper; view = 'paper'; paint(); }
      if (d.ecLaunch) { paperId = d.ecLaunch; view = 'launch'; paint(); }
      if (d.ecResume) { attemptId = d.ecResume; view = 'answer'; paint(); }
      if (d.ecReview) { attemptId = d.ecReview; view = 'review'; paint(); }
      if (d.ecSource) { const s = store().sources.find(s => s.id === d.ecSource); modal(`<h2>${esc(s.name)}</h2><pre class="ec-source-text">${esc(s.text)}</pre>`); }
      if (d.ecAddQuestion) { addQuestion(paper(), store().questions.find(q => q.id === d.ecAddQuestion)); save('向试卷加入题目'); paint(); }
      if (d.ecMove !== undefined) { moveItem(paper(), Number(d.ecMove), Number(d.ecMove) + Number(d.direction)); save('调整试卷题目顺序'); paint(); }
      if (d.ecRemoveItem) { if (paper().status !== 'draft') throw new Error('只允许修改草稿'); paper().items = paper().items.filter(i => i.id !== d.ecRemoveItem); save('将题目移出试卷'); paint(); }
      if (d.ecItemPreview) modal(questionPreview(paper().items.find(i => i.id === d.ecItemPreview).question, true));
      if (d.ecAction === 'generate') generateModal();
      if (d.ecAction === 'new-paper') newPaperModal();
      if (d.ecAction === 'new-question') {
        const s = store().sources[0]; if (!s) throw new Error('请先导入一份来源资料');
        const q = { id: uid(), type: 'single', stem: '请编辑新题目的题干', options: ['选项 A', '选项 B', '选项 C', '选项 D'], answer: [0], points: 5, difficulty: 3, topic: '未分类', sourceId: s.id, sourceRef: `${s.name} · 待校对位置`, explanation: '', keywords: [], origin: '手动创建' }; store().questions.unshift(q); selected = q.id; save('新建测评题目'); paint();
      }
      if (d.ecAction === 'add-option') { const q = questionFromForm(); if (q.options.length < 8) q.options.push(`新选项 ${letters[q.options.length]}`); store().drafts[selected] = q; ctx.persist(); paint(); }
      if (d.ecAction === 'discard-draft') { delete store().drafts[selected]; ctx.persist(); paint(); }
      if (d.ecAction === 'publish') { applyPaperSettings(); publishPaper(paper()); save(`本地发布测评「${paper().name}」`); paint(); toast('已在当前浏览器发布，可开始答题'); }
      if (d.ecAction === 'copy-paper') { const p = clone(paper()); p.id = uid(); p.name += ' · 副本'; p.status = 'draft'; p.createdAt = new Date().toISOString(); delete p.publishedAt; p.items.forEach(i => i.id = uid()); store().papers.unshift(p); paperId = p.id; save('复制试卷为新草稿'); paint(); }
      if (d.ecAction === 'export-paper') download(paper(), 'examcraft-paper.json');
      if (d.ecAction === 'export-results') download(store().attempts.filter(a => a.status !== 'answering'), 'examcraft-results.json');
      if (d.ecAction === 'embed') embedModal();
      if (d.ecAction === 'bank-template') download({ questions: [{ type: 'single', stem: '必填规则的作用是什么？', options: ['阻止必要信息缺失', '自动删除所有记录'], answer: [0], points: 5, difficulty: 2, topic: '字段校验', sourceRef: '培训手册，第 1 节', explanation: '提交前检查必要字段。' }, { type: 'short', stem: '说明权限校验应在哪里进行。', answer: '在服务端进行身份和操作授权校验。', keywords: ['服务端', '身份', '授权'], points: 10, difficulty: 3, topic: '权限控制', sourceRef: '培训手册，第 2 节' }] }, 'examcraft-bank-example.json');
      if (d.ecAction === 'submit-exam') {
        const a = attempt(); const missing = a.paper.items.filter(i => Array.isArray(a.answers[i.id]) ? !a.answers[i.id].length : !String(a.answers[i.id] || '').trim()).length;
        modal(`<h2>确认提交答卷？</h2><p class="muted">${missing ? `还有 ${missing} 道题未作答，将按 0 分处理。` : '所有题目均已作答。'}提交后不能修改答案，简答题由人工确认评分。</p><button class="ec-primary" id="ec-confirm-submit">确认提交</button>`);
        document.querySelector('#ec-confirm-submit').onclick = () => { submitAttempt(a); save(`提交测评答卷「${a.name}」`); closeModal(); view = 'review'; paint(); };
      }
    } catch (error) { toast(error.message); }
  });
  document.addEventListener('submit', event => {
    const form = event.target; if (!form.id?.startsWith('ec-') && !form.classList.contains('ec-grade-form')) return;
    event.preventDefault(); const data = new FormData(form);
    try {
      if (form.id === 'ec-question-form') { const q = validateQuestion(questionFromForm()); if (!store().sources.some(s => s.id === q.sourceId)) throw new Error('来源文档不存在'); const index = store().questions.findIndex(q => q.id === selected); store().questions[index] = q; delete store().drafts[selected]; save('保存题目与评分规则'); paint(); toast('题目已保存'); }
      if (form.id === 'ec-syllabus-form') { const s = parseSyllabus(data.get('text'), data.get('name').trim()); store().sources.unshift(s); save('导入测评大纲'); paint(); toast(`已导入 ${s.topics.length} 个知识点`); }
      if (form.id === 'ec-bank-import') { const name = data.get('name').trim(); if (!name) throw new Error('请输入来源名称'); const id = uid(), questions = normalizeImportedBank(data.get('json'), id); store().sources.unshift({ id, name, text: data.get('json'), topics: [], importedAt: new Date().toISOString() }); store().questions.unshift(...questions); selected = questions[0].id; save(`导入 ${questions.length} 道题目`); view = 'bank'; paint(); toast('题库校验通过，已完整导入'); }
      if (form.id === 'ec-generate-form') { const source = store().sources.find(s => s.id === data.get('source')); if (!source) throw new Error('请先导入带事实说明的大纲'); const questions = generateQuestions(source, data.getAll('types')); store().questions.unshift(...questions); selected = questions[0].id; save(`按大纲模板生成 ${questions.length} 道题`); closeModal(); view = 'bank'; paint(); toast('规则生成完成，请人工校对后组卷'); }
      if (form.id === 'ec-new-paper') { const name = data.get('name').trim(); if (!name) throw new Error('请输入试卷名称'); const p = makePaper(name); store().papers.unshift(p); paperId = p.id; save('创建测评试卷草稿'); closeModal(); view = 'paper'; paint(); }
      if (form.id === 'ec-paper-settings') { applyPaperSettings(form); save('更新试卷配置'); paint(); toast('试卷配置已保存'); }
      if (form.id === 'ec-start-form') { const a = startAttempt(paper(), data.get('name')); store().attempts.unshift(a); attemptId = a.id; save(`开始测评「${a.name}」`); view = 'answer'; paint(); }
      if (form.classList.contains('ec-grade-form')) { reviewGrade(attempt(), form.dataset.item, Number(data.get('score')), data.get('comment')); save('人工确认简答题评分'); paint(); toast('评分已确认，成绩统计已更新'); }
      if (form.id === 'ec-embed-form') { ctx.embed(data.get('app'), paper()); save('向 FormPilot 应用添加测评入口'); closeModal(); toast('已添加，可在该应用概览中打开考试'); }
    } catch (error) { toast(error.message); }
  });
  function persistAnswer(el) {
    const a = attempt(); if (!a || a.status !== 'answering') return;
    const id = el.dataset.ecResponse, q = a.paper.items.find(i => i.id === id)?.question; if (!q) return;
    if (q.type === 'short') a.answers[id] = el.value;
    else if (q.type === 'multiple') { const values = new Set(a.answers[id] || []); if (el.checked) values.add(Number(el.value)); else values.delete(Number(el.value)); a.answers[id] = [...values]; }
    else a.answers[id] = [Number(el.value)];
    ctx.persist();
    const index = a.paper.items.findIndex(i => i.id === id), link = document.querySelector(`[data-ec-scroll="ec-answer-${index}"]`); const answered = Array.isArray(a.answers[id]) ? a.answers[id].length : String(a.answers[id] || '').trim(); link?.classList.toggle('answered', Boolean(answered));
    const head = document.querySelector('.ec-answer-layout')?.previousElementSibling?.querySelector('p');
    const n = a.paper.items.filter(i => Array.isArray(a.answers[i.id]) ? a.answers[i.id].length : String(a.answers[i.id] || '').trim()).length;
    if (head) head.textContent = `${a.name} · 已作答 ${n}/${a.paper.items.length} 题 · 自动保存在本地`;
  }
  document.addEventListener('input', event => {
    const el = event.target;
    if (el.id === 'ec-bank-query') { bankQuery = el.value; document.querySelector('#ec-question-list').innerHTML = bankList(); }
    if (el.closest('#ec-question-form') && el.id !== 'ec-question-type') { store().drafts[selected] = questionFromForm(); ctx.persist(); document.querySelector('#ec-live-preview').innerHTML = questionPreview(draft(), true); const badge = document.querySelector('.ec-edit-pane .ec-tag'); if (badge) { badge.textContent = '有未保存修改'; badge.classList.add('amber'); } }
    if (el.dataset.ecResponse && el.tagName === 'TEXTAREA') persistAnswer(el);
  });
  document.addEventListener('change', async event => {
    const el = event.target;
    try {
      if (el.id === 'ec-bank-type') { bankType = el.value; document.querySelector('#ec-question-list').innerHTML = bankList(); }
      if (el.id === 'ec-question-type') {
        const q = questionFromForm(); q.type = el.value;
        if (q.type === 'short') { q.options = []; q.answer = ''; q.keywords = []; }
        else { q.options = q.type === 'boolean' ? ['正确', '错误'] : ['选项 A', '选项 B', '选项 C', '选项 D']; q.answer = [0]; q.keywords = []; }
        store().drafts[selected] = q; ctx.persist(); paint();
      }
      if (el.id === 'ec-syllabus-file' || el.id === 'ec-bank-file') { const file = el.files[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) throw new Error('文件不能超过 2 MB'); const text = await file.text(); const form = el.closest('form'); form.querySelector('textarea').value = text; if (!form.querySelector('[name="name"]').value) form.querySelector('[name="name"]').value = file.name; toast('已读取文件，请检查后导入'); }
      if (el.dataset.ecItemPoints) { const p = paper(), points = Number(el.value); if (p.status !== 'draft' || !Number.isFinite(points) || points <= 0 || points > 100) throw new Error('草稿题目分值应在 0–100 之间，且大于 0'); p.items.find(i => i.id === el.dataset.ecItemPoints).question.points = points; save('更新试卷题目分值'); paint(); }
      if (el.dataset.ecResponse && el.tagName !== 'TEXTAREA') persistAnswer(el);
    } catch (error) { toast(error.message); }
  });
  document.addEventListener('dragstart', event => { const el = event.target.closest('[data-ec-item]'); if (!el || paper()?.status !== 'draft') return; dragId = el.dataset.ecItem; event.dataTransfer.setData('text/plain', dragId); event.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
  document.addEventListener('dragover', event => { if (dragId && event.target.closest('[data-ec-item]')) event.preventDefault(); });
  document.addEventListener('drop', event => { const el = event.target.closest('[data-ec-item]'); if (!el || !dragId) return; event.preventDefault(); try { const p = paper(); moveItem(p, p.items.findIndex(i => i.id === dragId), p.items.findIndex(i => i.id === el.dataset.ecItem)); save('拖动调整试卷顺序'); paint(); } catch (error) { toast(error.message); } dragId = null; });
  document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging')); });
  return { render };
}
