export const standardFieldTypes = { text: '单行文本', textarea: '多行文本', number: '数字', email: '邮箱', tel: '电话', date: '日期', select: '单选下拉', multiselect: '多选', checkbox: '确认勾选',file:'文件附件' };
export function valuesFromForm(fields, data) {
  return Object.fromEntries(fields.map(f => [f.id, f.type === 'multiselect' ? data.getAll(f.id) : f.type === 'checkbox' ? data.has(f.id) : f.type==='file'&&!data.get(f.id)?.size?'':data.get(f.id) ?? '']));
}
export async function readFieldFiles(fields,data,values){for(const f of fields.filter(f=>f.type==='file')){const file=data.get(f.id);if(file?.size){if(file.size>2*1024*1024)throw Error('附件超过 2 MB');values[f.id]={name:file.name,data:await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);})};}else values[f.id]='';}return values;}
export function conditionMatches(condition,values){if(!condition)return true;const actual=values[condition.fieldId],expected=condition.value;switch(condition.operator){case'eq':return String(actual??'')===String(expected??'');case'neq':return String(actual??'')!==String(expected??'');case'contains':return String(actual??'').includes(String(expected??''));case'gt':return Number(actual)>Number(expected);case'gte':return Number(actual)>=Number(expected);case'lt':return Number(actual)<Number(expected);case'lte':return Number(actual)<=Number(expected);default:return false;}}
export function validateFields(fields, values) {
  for (const f of fields) {
    const raw = values[f.id], text = String(raw ?? '').trim(), empty = f.type === 'checkbox' ? raw !== true : Array.isArray(raw) ? !raw.length : !text;
    if (f.required && empty) return `请填写${f.label}`;
    if (empty) continue;
    if(f.type==='file'){if(!raw||typeof raw!=='object'||typeof raw.name!=='string'||typeof raw.data!=='string'||!/^data:[\w.+/-]+;base64,[A-Za-z0-9+/=]+$/.test(raw.data)||raw.data.length>2800000)return `${f.label}需要不超过 2 MB 的有效附件`;continue;}
    const rules = f.rules || {};
    if (f.type === 'number') {
      const value = Number(text); if (!Number.isFinite(value)) return `${f.label}需要有效数字`;
      if (rules.min !== undefined && value < rules.min) return `${f.label}不能小于${rules.min}`;
      if (rules.max !== undefined && value > rules.max) return `${f.label}不能大于${rules.max}`;
    }
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `${f.label}需要有效邮箱`;
    if (f.type === 'tel' && !/^[+\d][\d\s()-]{5,24}$/.test(text)) return `${f.label}需要有效电话`;
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${f.label}需要有效日期`;
    if (f.type === 'select' && !f.options?.includes(text)) return `${f.label}请选择已有选项`;
    if (f.type === 'multiselect' && (!Array.isArray(raw) || raw.some(v => !f.options?.includes(v)))) return `${f.label}包含无效选项`;
    if (rules.pattern) { try { if (!new RegExp(rules.pattern).test(text)) return `${f.label}格式不符合要求`; } catch { return `${f.label}的正则规则无效`; } }
    if (rules.maxLength !== undefined && text.length > rules.maxLength) return `${f.label}最多${rules.maxLength}个字符`;
    if (rules.exactLength !== undefined && text.length !== rules.exactLength) return `${f.label}需要${rules.exactLength}个字符`;
  }
  return '';
}
export function renderFieldControls(fields, esc, values = {}) {
  return fields.map(f => {
    const required = f.required ? 'required' : '', rules = f.rules || {}, value = values[f.id] ?? f.defaultValue ?? '';
    const common = `name="${esc(f.id)}" ${required} aria-label="${esc(f.label)}${f.required ? ' *' : ''}"`;
    let control;
    if(f.type==='file')control=`<input ${common} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx"><small>单个附件不超过 2 MB</small>`;
    else if (f.type === 'select') control = `<select ${common}><option value="">请选择</option>${(f.options || []).map(o => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (f.type === 'multiselect') control = `<select ${common} multiple size="${Math.min(4, Math.max(2, f.options?.length || 0))}">${(f.options || []).map(o => `<option value="${esc(o)}" ${Array.isArray(value) && value.includes(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (f.type === 'checkbox') control = `<input ${common} type="checkbox" ${value === true ? 'checked' : ''} />`;
    else if (f.type === 'textarea') control = `<textarea ${common} maxlength="${rules.maxLength ?? 5000}" placeholder="${esc(f.placeholder || `请输入${f.label}`)}">${esc(value)}</textarea>`;
    else control = `<input ${common} type="${f.type === 'relation' ? 'text' : esc(f.type)}" value="${esc(value)}" ${f.type === 'number' ? `step="any" ${rules.min !== undefined ? `min="${rules.min}"` : ''} ${rules.max !== undefined ? `max="${rules.max}"` : ''}` : `maxlength="${rules.maxLength ?? 5000}"`} ${rules.pattern ? `pattern="${esc(rules.pattern)}"` : ''} placeholder="${esc(f.placeholder || `请输入${f.label}`)}" />`;
    return `<label class="preview-field ${f.type === 'checkbox' ? 'field-checkbox' : ''}">${esc(f.label)}${f.required ? '<span class="required"> *</span>' : ''}${control}${f.help ? `<small class="field-help">${esc(f.help)}</small>` : ''}</label>`;
  }).join('');
}
