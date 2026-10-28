import {fieldEvidence} from './docmorph-evidence.js';
import { uid, makeApp } from './model.js';
import { standardFieldTypes } from './field-rules.js';
export const clone = v => JSON.parse(JSON.stringify(v));
export function segmentsFromText(text, page = 1, prefix = '') {
  return text.split(/\r?\n/).map((text, index) => ({ id: uid(), text: text.trim(), page, line: index + 1, location: `${prefix}${prefix ? ' · ' : ''}第 ${index + 1} 行` })).filter(s => s.text);
}
const ignored = /^(填写说明|填表说明|注意事项|说明|提示|要求|温馨提示|表单名称|标题|申请表|登记表|备注说明|instructions?)\s*[：:]/i;
export function recognizeFields(segments) {
  const fields = [], labels = new Set();
  for (const segment of segments) {
    const text = segment.text.trim().replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1');
    if (ignored.test(text)) { const previous = fields.at(-1); if (previous && /^(说明|提示|要求)[:：]/.test(text)) previous.help += `${previous.help ? '\n' : ''}${text}`; continue; }
    const match = text.match(/^\s*(?:\d+[.、]\s*)?([*＊]?[\p{L}\p{N}_\s\-/]{1,35})([（(][^）)]{0,150}[）)])?\s*[：:]\s*(.*)$/u);
    const bare = !match && /^(姓名|邮箱|电子邮箱|联系电话|手机号码|电话|部门|公司名称|入职日期|申请日期|出生日期|报销金额|申请金额|地址|备注|Full Name|Email|Phone|Department|Date|Amount)$/i.test(text);
    if (!match && !bare) continue;
    const label = (match ? match[1] : text).replace(/^[*＊]/, '').trim(), meta = match ? `${match[2] || ''} ${match[3] || ''}` : '', all = `${label} ${meta}`;
    if (!label || labels.has(label) || label.length > 35) continue;
    let type = /附件|文件上传/.test(label)?'file':/多选|multiple/i.test(meta) ? 'multiselect' : /单选|下拉|select|□|☐|○/.test(meta) ? 'select' : /同意|确认|勾选|checkbox/i.test(label + meta) ? 'checkbox' : /邮箱|邮件|email/i.test(all) ? 'email' : /电话|手机|phone|tel/i.test(all) ? 'tel' : /日期|生日|date/i.test(all) ? 'date' : /金额|数量|人数|年龄|数字|天数|amount|number/i.test(all) ? 'number' : /备注|说明|多行|textarea/i.test(all) ? 'textarea' : 'text';
    let options = [];
    if (['select', 'multiselect'].includes(type)) {
      const content = (match?.[3] || '').replace(/^[（(]?选项[）)]?\s*[：:]?/, '').replace(/[□☐○●]/g, '|');
      options = [...new Set(content.split(/[|/／、,，;；]/).map(o => o.replace(/^\s*[A-H][.、]\s*/, '').trim()).filter(o => o && !/^[_＿\s-]+$/.test(o)))];
      if (!options.length) type = 'text';
    }
    const rules = {}, maxLength = all.match(/(?:最多|不超过|最大长度|max(?:imum)?\s*length)[\s：:]*(\d+)/i), exact = all.match(/(?:固定|长度为)?\s*(\d+)\s*位/), range = all.match(/(-?\d+(?:\.\d+)?)\s*[~～至]\s*(-?\d+(?:\.\d+)?)/);
    if (maxLength) rules.maxLength = Math.min(5000, Number(maxLength[1]));
    if (exact && type !== 'number') rules.exactLength = Number(exact[1]);
    if (range && type === 'number') { rules.min = Number(range[1]); rules.max = Number(range[2]); }
    const required = (/必填|required|[*＊]/i.test(all) || /^[*＊]/.test(text)) && !/非必填|选填|optional/i.test(meta);
    const help = meta.trim().replace(/[（）()]/g, '').replace(/[_＿]{2,}/g, '').trim();
    fields.push({ id: uid(), label, type, required, options, rules, help, source: fieldEvidence(segment), confirmed: false, origin: 'rule' }); labels.add(label);
  }
  return fields;
}
export function makeDocument(name, kind, segments, warnings = []) {
  const id=uid(),fields=recognizeFields(segments);fields.forEach(f=>f.source.documentId=id);return { id, name, kind, revision: 1, segments, fields, warnings, createdAt: new Date().toISOString(), history: [], exported: null };
}
export function validateDocField(field, document) {
  if (!field.label?.trim() || field.label.length > 60) return '字段名称需要 1–60 个字符';
  if (!standardFieldTypes[field.type]) return '不支持的字段类型';
  if (['select', 'multiselect'].includes(field.type) && (!field.options?.length || field.options.some(o => !o.trim()) || new Set(field.options).size !== field.options.length)) return '选项至少一条且不能重复或为空';
  const rules = field.rules || {};
  for (const key of ['min', 'max', 'maxLength', 'exactLength']) if (rules[key] !== undefined && !Number.isFinite(rules[key])) return '字段限制必须是有效数字';
  if (rules.min !== undefined && rules.max !== undefined && rules.min > rules.max) return '最小值不能大于最大值';
  for (const key of ['maxLength', 'exactLength']) if (rules[key] !== undefined && (!Number.isInteger(rules[key]) || rules[key] < 1 || rules[key] > 5000)) return '字符长度必须为 1–5000 的整数';
  if (rules.pattern) { if (typeof rules.pattern !== 'string' || rules.pattern.length > 300) return '正则规则长度无效'; try { new RegExp(rules.pattern); } catch { return '正则规则无效'; } }
  if(field.condition&&(!document.fields.some(f=>f.id===field.condition.fieldId)||field.condition.fieldId===field.id))return '条件引用字段不存在或自引用';
  if (field.condition && (!field.condition.fieldId || !['eq','neq','contains','gt','gte','lt','lte'].includes(field.condition.operator))) return '条件显示规则无效';
  if (!document.segments.some(s => s.id === field.source?.segmentId)) return '请选择有效的原文来源位置';
  if (document.fields.some(f => f.id !== field.id && f.label === field.label.trim())) return '字段名称重复';
  return '';
}
export function updateField(document, field) {
  const error = validateDocField(field, document); if (error) throw new Error(error);
  const old=document.fields.find(f=>f.id===field.id);const f = { ...clone(field), history:[...(old?.history||[]),...(old?[{at:new Date().toISOString(),before:{label:old.label,type:old.type,rules:clone(old.rules||{}),source:clone(old.source)},after:{label:field.label,type:field.type,rules:clone(field.rules||{}),source:clone(field.source)}}]:[])].slice(-30), label: field.label.trim(), confirmed: false }, index = document.fields.findIndex(f => f.id === field.id);
  if (index < 0) document.fields.push(f); else document.fields[index] = f;
  document.revision++; document.history.unshift({ at: new Date().toISOString(), text: `更新字段「${f.label}」，需重新复核` });
  return f;
}
export function confirmAll(document) {
  if (!document.fields.length) throw new Error('请先识别或添加字段');
  for (const f of document.fields) { const error = validateDocField(f, document); if (error) throw new Error(`${f.label}：${error}`); }
  document.fields.forEach(f => { f.confirmed = true; }); document.history.unshift({ at: new Date().toISOString(), text: '人工确认全部字段' });
}
export function createDesignerApp(document) {
  if (!document.fields.length || document.fields.some(f => !f.confirmed)) throw new Error('请先人工复核并确认全部字段');
  for (const field of document.fields) { const error = validateDocField(field, document); if (error) throw new Error(error); }
  const app = makeApp(document.name.replace(/\.[^.]+$/, ''), `由 DocMorph 从「${document.name}」数字化生成。`);
  const ids=new Map(document.fields.map(f=>[f.id,uid()]));
  app.fields = document.fields.map(f => ({ id: ids.get(f.id), label: f.label, type: f.type, required: f.required, placeholder:f.placeholder||'',defaultValue:f.defaultValue??'',options: clone(f.options), rules: clone(f.rules), condition:f.condition?{...clone(f.condition),fieldId:ids.get(f.condition.fieldId)||f.condition.fieldId}:null, help: f.help, provenance: { documentId: document.id, documentRevision: document.revision, ...clone(f.source) } }));
  app.docMorph = { documentId: document.id, revision: document.revision, sourceName: document.name }; return app;
}
export function seedDocMorph() {
  const text = '员工入职登记表\n填写说明：请核对所有必填信息，确认后提交。\n姓名（必填，最多20字）：________\n电子邮箱（必填）：________\n联系电话（11位）：________\n部门（必填，单选）：研发部 / 市场部 / 财务部\n入职日期（必填）：________\n月度预算（数字，0~50000）：________\n备注（最多200字）：________\n确认信息真实（必填，勾选）：本人已核对以上信息。';
  return { version: 1, documents: [makeDocument('员工入职登记表.txt', 'text', segmentsFromText(text), ['示例资料；字段来自本地规则，尚未人工复核。'])] };
}
