import { uid, makeApp, validateRecord } from './model.js';
import { standardFieldTypes } from './field-rules.js';
import { findFormScenario, scenarioCategories } from './scenario-catalog.js';

export const fieldTypes = { ...standardFieldTypes, relation: '关联记录' };
export const actions = ['read', 'create', 'update', 'delete'];
const field = (label, type = 'text', required = false) => ({ id: uid(), label, type, required });
export const makeEntity = (name, fields = [field('名称', 'text', true), field('备注', 'textarea')]) => ({ id: uid(), name, fields, records: [] });
function pagesFor(entity) { return ['list', 'create', 'detail'].map(type => ({ id: uid(), entityId: entity.id, type, title: `${entity.name}${({ list: '列表', create: '表单', detail: '详情' })[type]}` })); }
const role = (name, allowed) => ({ id: uid(), name, allowed });
export function ensureBlueprint(app) {
  if (!app.blueprint) app.blueprint = { version: 1, source: '从现有应用导入', domain: '自定义业务', roles: [role('管理员', [...actions]), role('业务成员', ['read', 'create', 'update']), role('查看者', ['read'])], entities: [{ id: uid(), name: app.name, fields: app.fields, records: app.records }], pages: [], history: [], notes: ['角色权限仅为设计配置，未执行服务端鉴权。'] };
  const b = app.blueprint;
  b.entities[0].fields = app.fields;
  b.entities[0].records = app.records;
  if (!b.pages.length) b.pages = b.entities.flatMap(pagesFor);
  return b;
}
export function addEntity(app, name) {
  const b = ensureBlueprint(app);
  if (b.entities.some(e => e.name === name)) throw new Error('该实体已存在');
  const entity = makeEntity(name); b.entities.push(entity); b.pages.push(...pagesFor(entity)); return entity;
}
export function buildApplication(prompt) {
  if (!prompt.trim()) throw new Error('请描述业务需求');
  let domain = '通用业务', name = '业务管理系统', entities;
  const scenario = findFormScenario(prompt);
  if (scenario) {
    domain = scenarioCategories[scenario.category]; name = `${scenario.name}系统`;
    entities = scenario.entities.map(([label, specs]) => makeEntity(label, specs.map((spec, i) => {
      const [label, type] = spec.split(':');
      return { ...field(label, type, i === 0), ...(type === 'select' ? { options: ['待处理', '处理中', '已完成'] } : {}) };
    })));
    entities.forEach(e => e.fields.filter(f => f.type === 'relation').forEach(f => { f.target = entities[0].id; }));
  } else if (/客户|CRM|销售|商机/i.test(prompt)) {
    domain = '客户与销售'; name = '客户关系管理系统';
    const customer = makeEntity('客户', [field('客户名称', 'text', true), field('行业'), field('联系邮箱', 'email'), field('联系电话'), field('负责人', 'text', true)]);
    const contact = makeEntity('联系人', [field('姓名', 'text', true), { ...field('所属客户', 'relation'), target: customer.id }, field('联系电话'), field('职位')]);
    const deal = makeEntity('商机', [field('商机名称', 'text', true), { ...field('关联客户', 'relation', true), target: customer.id }, field('预计金额', 'number'), field('预计成交日', 'date'), field('跟进备注', 'textarea')]);
    entities = [customer, contact, deal];
  } else if (/报销|费用|财务/.test(prompt)) {
    domain = '费用与财务'; name = '费用报销管理系统';
    entities = [makeEntity('报销申请', [field('申请人', 'text', true), field('报销金额', 'number', true), field('发生日期', 'date'), field('费用说明', 'textarea', true)]), makeEntity('费用类别', [field('类别名称', 'text', true), field('预算上限', 'number')])];
  } else if (/库存|仓库|采购|商品|进销存/.test(prompt)) {
    domain = '库存与采购'; name = '库存管理系统';
    const product = makeEntity('商品', [field('商品名称', 'text', true), field('商品编码', 'text', true), field('库存数量', 'number', true), field('单价', 'number')]);
    entities = [product, makeEntity('出入库记录', [{ ...field('商品', 'relation', true), target: product.id }, field('变动数量', 'number', true), field('操作日期', 'date'), field('说明', 'textarea')])];
  } else {
    name = /项目|任务/.test(prompt) ? '项目协作管理系统' : '业务管理系统';
    entities = [makeEntity('项目', [field('项目名称', 'text', true), field('负责人', 'text', true), field('截止日期', 'date'), field('描述', 'textarea')])];
    entities.push(makeEntity('任务', [field('任务名称', 'text', true), { ...field('所属项目', 'relation'), target: entities[0].id }, field('负责人'), field('截止日期', 'date')]));
  }
  const explicitName = prompt.match(/(?:应用名称|系统名称|命名为)[：:\s]*[“「"]?([^，。；\n”」"]{1,40})/);
  if (explicitName) name = explicitName[1].trim();
  const roleMatch = prompt.match(/角色(?:有|为|包括|[：:\s])+([^。；\n]+)/);
  const roles = roleMatch ? [...new Set(roleMatch[1].split(/[，,](?=支持|功能)/)[0].split(/[、,，和]/).map(s => s.trim()).filter(Boolean))].slice(0, 8).map((name, i) => role(name, i === 0 ? [...actions] : /查看|只读/.test(name) ? ['read'] : ['read', 'create', 'update'])) : [role('管理员', [...actions]), role('业务成员', ['read', 'create', 'update']), role('查看者', ['read'])];
  const app = makeApp(name, prompt.trim(), domain === '客户与销售' ? 'customer' : domain === '费用与财务' ? 'expense' : 'general');
  app.fields = entities[0].fields; app.records = entities[0].records;
  app.blueprint = { version: 1, source: '本地规则与领域模板', domain, roles, entities, pages: entities.flatMap(pagesFor), history: [{ id: uid(), text: '生成初始应用蓝图', at: new Date().toISOString() }], notes: [`按「${domain}」模板建议实体和字段，可在蓝图中调整。`, '可用「角色：管理员、销售、查看者」和「应用名称：我的系统」显式指定。', '页面及数据操作在浏览器中运行；权限配置仅为设计，不提供安全隔离。'] };
  return app;
}
export function reviseApplication(app, instruction, entityId) {
  const b = ensureBlueprint(app), entity = b.entities.find(e => e.id === entityId) || b.entities[0];
  const text = instruction.trim(); let message;
  const newField = text.match(/^(?:新增|添加)字段[：:\s]+([^，。；\n]{1,40})/);
  const rename = text.match(/^(?:应用名称改为|重命名为)[：:\s]*([^。；\n]{1,60})$/);
  const newRole = text.match(/^(?:新增|添加)角色[：:\s]+([^。；\n]{1,30})$/);
  const newEntity = text.match(/^(?:新增|添加)实体[：:\s]+([^。；\n]{1,30})$/);
  if (newField) {
    const label = newField[1].trim();
    if (entity.fields.some(f => f.label === label)) throw new Error('该字段已存在');
    const explicitType = text.match(/类型[：:\s]*([^，。；\s]+)/)?.[1];
    if (explicitType && !['文本', '数字', '金额', '邮箱', '日期', '多行', '多行文本'].includes(explicitType)) throw new Error('指令支持文本、数字、邮箱、日期、多行文本；关联字段请在蓝图中添加。');
    const type = /类型[：:\s]*(数字|金额)/.test(text) ? 'number' : /类型[：:\s]*邮箱/.test(text) ? 'email' : /类型[：:\s]*日期/.test(text) ? 'date' : /类型[：:\s]*多行/.test(text) ? 'textarea' : 'text';
    entity.fields.push(field(label, type, /必填/.test(text))); message = `为「${entity.name}」添加字段「${label}」`;
  } else if (rename) { app.name = rename[1].trim(); message = `应用已重命名为「${app.name}」`; }
  else if (newRole) { if (b.roles.some(r => r.name === newRole[1])) throw new Error('该角色已存在'); b.roles.push(role(newRole[1], ['read'])); message = `新增角色「${newRole[1]}」，默认仅查看`; }
  else if (newEntity) { addEntity(app, newEntity[1]); message = `新增实体「${newEntity[1]}」及列表、表单、详情页面`; }
  else throw new Error('本地演示支持：添加字段：电话，类型：文本；新增角色：经理；新增实体：合同；应用名称改为我的系统。复杂语义修改尚未接入真实 AI。');
  b.version++; b.history.unshift({ id: uid(), text: message, instruction: text, at: new Date().toISOString() }); return message;
}
export function checkEntityRecord(blueprint, entity, values) {
  const error = validateRecord(entity.fields, values); if (error) return error;
  for (const f of entity.fields.filter(f => f.type === 'relation')) {
    if (values[f.id] && !blueprint.entities.find(e => e.id === f.target)?.records.some(r => r.id === values[f.id])) return `${f.label}关联的记录已不存在，请重新选择`;
  }
  return '';
}
export function removeRecord(blueprint, entity, id) {
  for (const e of blueprint.entities) for (const f of e.fields.filter(f => f.type === 'relation' && f.target === entity.id)) {
    if (e.records.some(r => r.values[f.id] === id)) throw new Error(`「${e.name}」仍有关联记录，请先解除关联`);
  }
  const index = entity.records.findIndex(r => r.id === id); if (index !== -1) entity.records.splice(index, 1);
}
