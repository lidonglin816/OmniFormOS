import { validateFields } from './field-rules.js';
export const uid = () => globalThis.crypto.randomUUID();
export function makeApp(name, description = '', template = 'general') {
  const fields = template === 'expense'
    ? [{ label: '申请人', type: 'text', required: true }, { label: '报销金额', type: 'number', required: true }, { label: '费用说明', type: 'textarea', required: true }]
    : template === 'customer'
    ? [{ label: '客户名称', type: 'text', required: true }, { label: '联系邮箱', type: 'email', required: true }, { label: '跟进备注', type: 'textarea', required: false }]
    : [{ label: '标题', type: 'text', required: true }, { label: '负责人', type: 'text', required: true }, { label: '详细说明', type: 'textarea', required: false }];
  return { id: uid(), name: name.trim(), description, template, createdAt: new Date().toISOString(), fields: fields.map(f => ({ ...f, id: uid() })), records: [], workflow: ['提交新记录', '检查必填字段', '标记为待处理'], layout: 'single', logs: [] };
}
export function generateApp(prompt) {
  const template = /报销|费用|财务/.test(prompt) ? 'expense' : /客户|CRM|销售|线索/i.test(prompt) ? 'customer' : 'general';
  return makeApp(template === 'expense' ? '费用报销' : template === 'customer' ? '客户关系管理' : prompt.trim().slice(0, 16) || '新业务应用', prompt.trim(), template);
}
export function validateRecord(fields, values) {
  return validateFields(fields, values);
}
