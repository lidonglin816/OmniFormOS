import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Only export the explicitly selected project conversation; never scan other chats.
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/export-competition-evidence.mjs <project-session.jsonl>');
const raw = fs.readFileSync(source, 'utf8');
const messages = [];
raw.split('\n').forEach((line, index) => {
  try {
    const record = JSON.parse(line), p = record.payload;
    if (record.type === 'response_item' && p.type === 'message' && ['user', 'assistant'].includes(p.role)) {
      messages.push({ timestamp: record.timestamp, role: p.role, line: index + 1,
        text: (p.content || []).map(c => c.text || '').join('\n'), channel: p.channel });
    }
  } catch { /* JSONL may end with a partially written record. */ }
});
const clean = text => text
  .replace(/<in-app-browser-context\b[\s\S]*?<\/in-app-browser-context>/g, '[已移除自动浏览器状态]')
  .replace(/C:[\\/]Users[\\/][^\\/\s]+/gi, 'C:/Users/[LOCAL_USER]')
  .replace(/\b(?:sk|sb_secret|sb_publishable)[_-][A-Za-z0-9_-]{16,}/g, '[REDACTED_KEY]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
const groups = [
  ['01-导航切换与闪烁修复', [[29,40]], '导航交互 → 跨模块统一 → 横向强调线与闪烁反馈 → 修复回复'],
  ['02-全项目检查与问题修复', [[41,51]], '功能检查要求 → AI 检查反馈 → 用户要求修复 → 修复与验证回复'],
  ['03-本地服务连接失败与恢复', [[139,144],[157,160]], '打开与连接失败 → AI 回复 → 再次反馈反复失败 → 持久服务方案回复；两段之间为其他功能开发，未纳入本专题'],
];
const dir = 'docs/competition/原始对话摘录';
fs.mkdirSync(dir, { recursive: true });
const manifest = { sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
  sessionId: '01a15df0-5c3b-7810-8087-690f520eef34', exportedAt: new Date().toISOString(),
  scope: '选定区间的用户与助手可见文字，不含工具调用、推理、系统指令；截图与附件正文另行核验。时间为 UTC。', files: [] };
for (const [name, ranges, description] of groups) {
  const selected = ranges.flatMap(([a,b]) => messages.slice(a,b+1));
  if (!selected.length || selected.some(m=>!m.timestamp)) throw new Error('Missing source messages');
  const body = `# ${name}\n\n${description}\n\n来源：本项目 Codex 原始 JSONL 会话。以下为文字摘录，非重写的示例对话。保留 UTC 时间和原始行号；本机用户名及疑似密钥脱敏。附件路径仅为引用，不表示已附上附件原件。助手当时的结论属于历史陈述，不等于本次重新验证。\n\n` +
    selected.map(m=>`## ${m.timestamp} · ${m.role} · JSONL 行 ${m.line}\n\n${clean(m.text)}\n`).join('\n');
  const file = `${name}.md`;
  fs.writeFileSync(path.join(dir,file),body);
  manifest.files.push({file, messages:selected.length, ranges, sha256:crypto.createHash('sha256').update(body).digest('hex')});
}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.files));
