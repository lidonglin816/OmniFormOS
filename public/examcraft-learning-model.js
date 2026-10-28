export const answered = value => Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim().length > 0;
export function reviewSignals(q, sources = []) {
  const source = sources.find(s => s.id === q.sourceId);
  return [!q.explanation?.trim() && '缺少答案解析', !q.topic?.trim() && '缺少知识点',
    source && (!q.sourceQuote?.trim() || !source.text?.replace(/\s/g, '').includes(q.sourceQuote.replace(/\s/g, ''))) && '来源引文待核对',
    !source && '无绑定原文，需人工核对', q.options?.length && new Set(q.options.map(o => o.trim())).size !== q.options.length && '存在重复选项'].filter(Boolean);
}
export function monitorExam(state, id, now = Date.now()) {
  const exam = state.exams.find(e => e.id === id);
  if (!exam) throw new Error('考试不存在');
  const paper = state.papers.find(p => p.id === exam.paperId);
  const attempts = state.attempts.filter(a => a.examId === id);
  const rows = exam.participants.map(p => {
    const a = attempts.find(a => a.studentId === p.id);
    return {studentId:p.id,name:p.name,className:p.className || '',attemptId:a?.id,
      status:!a?(exam.closed||now>=Date.parse(exam.endsAt)?'缺考':'未开始'):a.status==='answering'?'答题中':a.pending?'待批阅':'已评分',
      completed:a?a.paper.items.filter(i => answered(a.answers[i.id])).length:0,
      count:a?.paper.items.length || paper?.items.length || 0, savedAt:a?.savedAt || null,
      remaining:a?.status==='answering'?Math.max(0,Math.ceil((a.deadline-now)/1000)):null};
  });
  const questions = (paper?.items || []).map((item,index) => {
    const submitted = attempts.filter(a => a.status !== 'answering');
    const grades = submitted.map(a => a.grades.find(g => g.itemId === item.id)).filter(g => g && !g.pending);
    return {id:item.id,index:index+1,stem:item.question.stem,topic:item.question.topic,
      sample:grades.length,correct:grades.filter(g => g.score === g.max).length,
      pending:submitted.filter(a => a.grades.find(g => g.itemId === item.id)?.pending).length,
      options:(item.question.options || []).map((text,k) => ({text,count:submitted.filter(a => a.answers[item.id]?.includes?.(k)).length}))};
  });
  return {exam:{id,name:exam.name},generatedAt:new Date(now).toISOString(),rows,questions};
}
export function practiceItems(attempt) {
  return attempt.paper.items.filter(i => attempt.grades.some(g => g.itemId===i.id && !g.pending && g.score<g.max));
}
