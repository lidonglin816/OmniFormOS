const id = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

export function seedTableMind() {
  return {
    view: 'grid', query: '', filter: '全部',
    fields: [
      { id: 'name', label: '活动名称', type: 'text' },
      { id: 'department', label: '部门', type: 'select' },
      { id: 'owner', label: '负责人', type: 'text' },
      { id: 'date', label: '日期', type: 'date' },
      { id: 'participants', label: '参与人数', type: 'number' },
      { id: 'status', label: '状态', type: 'select' }
    ],
    records: [
      { id: id(), name: 'AI 产品工作坊', department: '产品部', owner: '林晓', date: '2026-10-06', participants: 42, status: '已完成' },
      { id: id(), name: '秋季客户开放日', department: '市场部', owner: '周然', date: '2026-10-12', participants: 68, status: '已完成' },
      { id: id(), name: '研发效能分享会', department: '研发部', owner: '陈默', date: '2026-10-20', participants: 55, status: '进行中' },
      { id: id(), name: '财务合规培训', department: '财务部', owner: '许青', date: '2026-10-27', participants: 31, status: '待开始' },
      { id: id(), name: '新人训练营', department: '人力资源部', owner: '唐宁', date: '2026-11-03', participants: 26, status: '待开始' }
    ]
  };
}

export function parseCSV(text) {
  const lines = String(text).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('至少需要表头和一行数据');
  const rows = lines.map(line => line.split(',').map(v => v.trim().replace(/^"|"$/g, '')));
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new Error('表头不能重复');
  const fields = headers.map((label, index) => {
    const values = rows.map(row => row[index] || '');
    const type = values.every(v => v === '' || !Number.isNaN(Number(v))) ? 'number' : values.every(v => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) ? 'date' : 'text';
    return { id: `col_${index}`, label, type };
  });
  return { fields, records: rows.map(row => Object.fromEntries([['id', id()], ...fields.map((f, i) => [f.id, f.type === 'number' ? Number(row[i] || 0) : row[i] || ''])])) };
}

export function analyzeQuery(records, query) {
  const q = String(query).trim();
  let result = [...records], explanation = '显示全部数据';
  const dept = q.match(/(产品部|市场部|研发部|财务部|人力资源部)/)?.[1];
  if (dept) { result = result.filter(r => Object.values(r).includes(dept)); explanation = `筛选部门为「${dept}」`; }
  const min = q.match(/(?:大于|超过)\s*(\d+)/)?.[1];
  if (min) { result = result.filter(r => Object.values(r).some(v => typeof v === 'number' && v > Number(min))); explanation += `${dept ? '，并' : ''}筛选数值大于 ${min}`; }
  if (/本月/.test(q)) { result = result.filter(r => /^2026-10/.test(r.date || '')); explanation += `${dept || min ? '，并' : ''}限定 2026 年 10 月`; }
  return { records: result, explanation };
}

export function groupCount(records, field) {
  return Object.entries(records.reduce((acc, row) => { const key = row[field] || '未分类'; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
}
