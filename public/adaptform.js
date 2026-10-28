import { evaluateAdaptForm, sections, addRule } from './adaptform-model.js';

const fieldMarkup = (key, answers, esc) => ({
  mode: `<label>报名方式<select name="mode"><option ${answers.mode === '个人报名' ? 'selected' : ''}>个人报名</option><option ${answers.mode === '团队报名' ? 'selected' : ''}>团队报名</option></select></label>`,
  reimbursement: `<label>是否需要报销<select name="reimbursement"><option ${answers.reimbursement === '否' ? 'selected' : ''}>否</option><option ${answers.reimbursement === '是' ? 'selected' : ''}>是</option></select></label>`,
  borrowDays: `<label>设备借用天数<input name="borrowDays" type="number" min="1" max="90" value="${esc(answers.borrowDays)}"></label>`,
  name: '<label>姓名<input name="name" required placeholder="请输入姓名"></label>',
  email: '<label>联系邮箱<input name="email" type="email" required placeholder="name@company.com"></label>',
  teamName: '<label>团队名称<input name="teamName" required placeholder="请输入团队名称"></label>',
  memberCount: '<label>成员人数<input name="memberCount" type="number" min="2" required value="5"></label>',
  invoiceTitle: '<label>发票抬头<input name="invoiceTitle" required placeholder="请输入单位名称"></label>',
  taxNo: '<label>纳税人识别号<input name="taxNo" required maxlength="20"></label>'
})[key];

export function createAdaptForm(ctx) {
  const store = ctx.store;
  const outcome = () => evaluateAdaptForm(store());
  function render() {
    const s = store(), result = outcome();
    return `<section class="af-root"><header class="af-heading"><div><span class="af-kicker">OMNIFORMOS / MODULE 05</span><h1>AdaptForm <small>自适应智能表单引擎</small></h1><p>让字段、步骤和审批路线，根据填写内容实时变化。</p></div><div class="af-status"><i></i> 规则实时运行</div></header>
      <div class="af-metrics"><article><span>条件规则</span><strong>${s.rules.length}</strong><small>4 条内置场景规则</small></article><article><span>当前可见区块</span><strong>${result.visible.length}</strong><small>随答案即时更新</small></article><article><span>审批路线</span><strong>${result.route.includes('主管') ? '2 级' : '1 级'}</strong><small>${ctx.escape(result.route)}</small></article></div>
      <div class="af-layout"><section class="af-canvas"><div class="af-panel-head"><div><span>01</span><strong>逻辑画布</strong><small>答案 → 条件 → 动作</small></div><button class="secondary" id="af-add-rule">＋ 新建规则</button></div><div class="af-flow">
        <article class="af-node af-trigger"><span>START</span><strong>填写业务表单</strong><small>监听报名方式、报销需求、借用天数</small></article><div class="af-arrow">→</div>
        <div class="af-rule-stack">${s.rules.map((r, i) => `<button class="af-rule ${r.effect === 'route' ? 'route' : ''}" data-af-rule="${r.id}"><span>RULE ${String(i + 1).padStart(2, '0')}</span><strong>${ctx.escape(({mode:'报名方式',reimbursement:'需要报销',borrowDays:'借用天数'})[r.field])}</strong><small>${r.op === 'equals' ? '等于' : '大于'} ${ctx.escape(r.value)} · ${r.effect === 'show' ? '显示区块' : '切换路线'}</small></button>`).join('')}</div><div class="af-arrow">→</div>
        <article class="af-node af-result"><span>RESULT</span><strong>${result.visible.length} 个区块可见</strong><small>${ctx.escape(result.route)}</small></article></div>
        <div class="af-legend"><span><i class="purple"></i>显示字段</span><span><i class="green"></i>审批路线</span><span>每次修改答案都会重新计算全部规则</span></div></section>
        <section class="af-preview"><div class="af-panel-head"><div><span>02</span><strong>实时体验</strong><small>修改内容查看表单变化</small></div><span class="af-live">LIVE</span></div><form id="af-demo-form"><div class="af-form-progress"><b style="width:${result.visible.length * 25}%"></b></div>${result.visible.map(key => `<fieldset data-section="${key}"><legend>${ctx.escape(sections[key].label)}</legend><div class="af-fields">${sections[key].fields.map(f => fieldMarkup(f, s.answers, ctx.escape)).join('')}</div></fieldset>`).join('')}<div class="af-route"><span>⌘</span><div><small>提交后进入</small><strong>${ctx.escape(result.route)}</strong></div></div><button class="primary">验证并模拟提交 →</button></form></section></div>
      <div class="af-note">规则在浏览器本地执行，适合验证条件分支与字段依赖；正式生产仍需服务端校验、身份权限和审批接口。</div></section>`;
  }
  function afterRender() {
    const root = document.querySelector('.af-root'); if (!root) return;
    root.querySelectorAll('#af-demo-form select,#af-demo-form input').forEach(el => el.addEventListener('change', () => {
      const s = store(); if (['mode','reimbursement'].includes(el.name)) s.answers[el.name] = el.value; if (el.name === 'borrowDays') s.answers.borrowDays = Number(el.value || 1); s.lastEvaluation = outcome(); ctx.persist(); ctx.render();
    }));
    root.querySelector('#af-demo-form [name="borrowDays"]')?.addEventListener('input', e => { const days = Number(e.target.value); if (!Number.isFinite(days)) return; store().answers.borrowDays = days; store().lastEvaluation = outcome(); ctx.persist(); ctx.render(); });
    root.querySelector('#af-demo-form')?.addEventListener('submit', e => { e.preventDefault(); const r = outcome(); store().lastEvaluation = r; ctx.commit(`AdaptForm 模拟提交，进入「${r.route}」`); ctx.toast(`校验通过：${r.route}`); ctx.render(); });
    root.querySelector('#af-add-rule')?.addEventListener('click', () => { ctx.modal(`<h2>新增自适应规则</h2><form id="af-rule-form" class="stack"><label>条件字段<select name="field"><option value="mode">报名方式</option><option value="reimbursement">需要报销</option><option value="borrowDays">借用天数</option></select></label><label>比较方式<select name="op"><option value="equals">等于</option><option value="greater">大于</option></select></label><label>比较值<input name="value" required value="团队报名"></label><label>动作<select name="effect"><option value="show">显示区块</option><option value="route">切换审批路线</option></select></label><label>目标<select name="target"><option value="team">团队成员</option><option value="invoice">发票资料</option><option value="manager">主管审批</option></select></label><button class="primary">保存并启用</button></form>`); document.querySelector('#af-rule-form').addEventListener('submit', e => { e.preventDefault(); const d = new FormData(e.target); try { addRule(store(), Object.fromEntries(d)); ctx.persist(); ctx.closeModal(); ctx.render(); ctx.toast('新规则已启用'); } catch (err) { ctx.toast(err.message); } }); });
  }
  return { render, afterRender };
}

