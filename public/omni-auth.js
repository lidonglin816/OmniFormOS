// =====================================================================
// OmniFormOS — Premium SaaS Auth System (EN/中文 bilingual UI)
// Local backend: accounts persisted in localStorage with salted
// SHA-256 password hashes, email verification codes, password reset
// codes, sessions, and an "Account Center" (个人中心) view.
// Also provides the Settings dialog (language / theme / data folder).
// =====================================================================
const K_USERS='omniformos.users',K_SESSION='omniformos.session',K_ACCT='omniformos.account';
import {getLang,setLang as setLangPref} from './omni-i18n.js';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const users=()=>{try{return JSON.parse(localStorage.getItem(K_USERS)||'{}');}catch{return{};}};
const saveUsers=u=>{try{localStorage.setItem(K_USERS,JSON.stringify(u));}catch{}};
const getSession=()=>{try{return localStorage.getItem(K_SESSION)||'';}catch{return'';}};
const setSession=email=>{try{if(email)localStorage.setItem(K_SESSION,email);else localStorage.removeItem(K_SESSION);}catch{}};
const syncAcct=email=>{try{if(email)localStorage.setItem(K_ACCT,email);else localStorage.removeItem(K_ACCT);}catch{}};
const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const maskEmail=e=>{const [a,b]=e.split('@');const m=a.length<=2?a[0]+'•'.repeat(Math.max(a.length-1,1)):a.slice(0,2)+'•'.repeat(Math.max(a.length-2,2));return m+'@'+b;};
async function hashPass(pass,salt){
  const data=new TextEncoder().encode(salt+'::'+pass);
  if(crypto?.subtle?.digest){const buf=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  let h=2166136261;for(const b of data){h^=b;h=Math.imul(h,16777619)>>>0;}return 'fnv'+h.toString(16);
}
const makeSalt=()=>crypto?.randomUUID?crypto.randomUUID().replace(/-/g,''):String(Date.now())+Math.random().toString(36).slice(2);
const makeCode=()=>String(Math.floor(100000+Math.random()*900000));
const emitChanged=()=>window.dispatchEvent(new CustomEvent('omni-auth-changed'));
// ---- local preference helpers + startup application ----
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch{return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const fmtBytes=n=>n>=1073741824?(n/1073741824).toFixed(2)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
(function applySavedPrefs(){
  try{
    const th=localStorage.getItem('omniformos.theme');
    if(th==='system'){
      const r=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
      if(document.documentElement.dataset.theme!==r){document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;}
      localStorage.setItem('omniformos.theme.resolved',r);
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{
        const r2=e.matches?'dark':'light';
        try{localStorage.setItem('omniformos.theme.resolved',r2);}catch{}
        if(localStorage.getItem('omniformos.theme')==='system'&&document.documentElement.dataset.theme!==r2){
          document.documentElement.dataset.theme=r2;document.documentElement.style.colorScheme=r2;
          window.dispatchEvent(new CustomEvent('omni-theme-changed',{detail:r2}));
        }
      });
    }
    const fs=parseFloat(localStorage.getItem('omniformos.fontScale')||'1');
    if(fs!==1)document.documentElement.style.fontSize=(16*fs)+'px';
    if(localStorage.getItem('omniformos.anim')==='off')document.documentElement.classList.add('omni-no-anim');
    const sm=(localStorage.getItem('omniformos.startup')||'').replace(/^#/,'');
    if(sm&&!location.hash)history.replaceState(null,'','#'+sm);
  }catch{}
})();

// =====================================================================
// i18n（语言核心在 omni-i18n.js，auth 文案在下方 STR 表）
// =====================================================================
const STR={
en:{
  welcome:'Welcome back',welcomeSub:'Sign in to your account to continue.',
  email:'Email address',emailPh:'name@company.com',password:'Password',passPh:'Enter your password',
  passPhNew:'At least 8 characters',passPhRe:'Re-enter your password',
  forgot:'Forgot password?',signin:'Sign in',
  noAccount:"Don't have an account?",signupLink:'Sign up',
  createTitle:'Create your account',createSub:'Get started with your free account.',
  confirm:'Confirm password',createBtn:'Create account',
  terms:'By creating an account, you agree to our',termsAnd:'and',tos:'Terms of Service',privacy:'Privacy Policy',
  termsNote:'Terms of Service and Privacy Policy are not part of this local build.',
  hasAccount:'Already have an account?',signinLink:'Sign in',
  verifyTitle:'Check your inbox',
  verifySub:m=>`We've sent a verification code to ${m}. Enter it below to verify your email address.`,
  back:'Back',resendIn:s=>`Resend available in ${s}`,noCode:"Didn't receive the code?",
  resend:'Resend verification email',verifyBtn:'Verify email',
  mailbox:'Developer mailbox',mailboxNote:'— local build, no external email is sent. Your code is',
  autofill:'Autofill',wrongAddr:'Wrong address?',diffEmail:'Use a different email',
  forgotTitle:'Forgot your password?',
  forgotSub:"Enter your email address and we'll send you a code to reset your password.",
  sendReset:'Send reset code',forgotSentSub:m=>`If an account exists for ${m}, a password reset code has been generated. It expires in 10 minutes.`,
  mailboxReset:'— your reset code is',enterReset:'Enter reset code',backToSignin:'Back to sign in',
  resetTitle:'Set a new password',resetSub:'Choose a strong password for your account.',
  resetCode:'Reset code',resetCodePh:'6-digit code',newPass:'New password',confirmNew:'Confirm new password',
  updateBtn:'Update password',remembered:'Remembered it?',
  meTitle:'Account',meSub:'Manage your profile, appearance and session.',
  verified:'Verified',pending:'Pending verification',
  kEmail:'Email',kSince:'Member since',kWorkspace:'Workspace',vWorkspace:'Local · This device',
  kTheme:'Appearance',light:'Light',dark:'Dark',kVerify:'Verification',verifyNow:'Verify email',
  signout:'Sign out',
  avatarChange:'Change photo',avatarRemove:'Remove photo',avatarHint:'JPG, PNG or WebP · stored locally on this device',avatarBad:'Please choose an image smaller than 8 MB.',close:'Close',
  displayName:'Display name',displayNamePh:'How others see you',bio:'About you',bioPh:'A short introduction (optional)',saveProfile:'Save profile',profileSaved:'Profile updated.',profileInvalid:'Display name must be 2–30 characters.',copyEmail:'Copy email',copied:'Copied',exportProfile:'Export profile',accountActions:'Account tools',loginId:'Login email',
  meNote:'This account is stored locally on this device. Passwords are saved as salted SHA-256 hashes and never in plain text.',
  settings:'Settings',setSub:'General, AI, account, data, modules, integrations, desktop, diagnostics and about — nine categories on the left.',
  setNavAI:'AI model & API',setNavAIDesc:'Provider, endpoint, key, test',
  setNavGeneral:'General & appearance',setNavGeneralDesc:'Theme, language, font, startup',
  setNavAccount:'Account & security',setNavAccountDesc:'Password, verification, session',
  setNavData:'Workspace & data',setNavDataDesc:'Backup, storage, recycle bin',
  setNavModules:'Module settings',setNavModulesDesc:'Eight modules at a glance',
  setNavInteg:'Integrations',setNavIntegDesc:'Webhooks & notifications',
  setNavDesktop:'Desktop app',setNavDesktopDesc:'Startup, tray, service',
  setNavDiag:'Run & diagnostics',setNavDiagDesc:'Health, logs, export',
  setNavAbout:'About & updates',setNavAboutDesc:'Version, changelog, feedback',
  th_light:'Light',th_dark:'Dark',th_system:'System',kOn:'On',kOff:'Off',
  kFont:'Font size',fsNormal:'Default',fsLarge:'Large',kAnim:'Animations',kStartup:'Startup module',startupHome:'Home',
  aiTest:'Test connection',aiTesting:'Testing…',aiTestOk:l=>`Connection OK · ${l} ms`,aiTestFail:'Connection failed (unreachable or blocked by CORS).',
  aiAssign:'Per-module models',aiAssignDesc:'Optional overrides. Modules that support model selection use their own model; others follow the global model.',
  aiFollow:'Follow global model',
  chPassTitle:'Change password',chCur:'Current password',chBtn:'Update password',chOk:'Password changed.',
  secNote:'Local account · salted SHA-256 hashes · stored on this device only.',
  wsAuth:'Workspace access',wsAuthV:'Unlocked on this device',
  wsName:'Workspace name',
  backupDesc:'Bundles the eight module databases plus local preferences into a downloadable .ofbackup file.',
  btnBackup:'Back up now',btnBackupDone:'Backup downloaded (.ofbackup).',btnBackupFail:m=>`Backup failed: ${m}`,
  kStorage:'Storage used',trashTitle:'Recycle bin',trashNote:'Deleted records stay recoverable inside each module.',
  trashEmpty:'Recycle bin empty across all eight modules.',trashCount:(n,c)=>`${n} module(s): ${c} item(s) in total.`,
  trashAuth:'Unlock the local workspace to read recycle-bin counts.',
  integNote:'Webhook endpoints are stored locally; event delivery will be enabled in a future release.',
  whTitle:'Webhooks',whPh:'https://example.com/hook',whAdd:'Add webhook',whNone:'No webhooks yet.',
  kNotify:'System notifications',notifyNote:'Show desktop notifications for long-running tasks.',
  openAtLogin:'Open at login',closeToTray:'Close button minimizes to tray',desktopNote:'Preferences are saved now and applied by the desktop shell in a future release.',
  svcStatus:'Background service',svcOk:'Running',svcDown:'Not responding',svcCheck:'Check again',svcLatency:l=>`local service · ${l} ms`,
  logTitle:'Service log',logDesc:'Service and module logs are written to desktop-service.log next to your workspace settings.',
  diagBtn:'Export diagnostics',diagDone:'Diagnostics file downloaded.',
  verOk:'You are up to date.',checkUpd:'Check for updates',changelog:'What\u2019s new',
  changelogText:'v1.1.0 — Settings rebuilt into nine categories · AI provider presets with live apply · global interface language (EN/中文) · workspace backup & diagnostics export.',
  docsLink:'User guide',fbLink:'Send feedback',openMod:'Open',
  modulesNote:'Per-module business rules and defaults are managed inside each module\u2019s own settings page.',
  setStatus:'Connection status',setRefresh:'Refresh status',
  stOk:'Configured',stNo:'Not configured',stLoading:'Loading…',
  intDesc:'Use your own API key and model presets; usage is billed by your provider.',
  modelCard:'Model & connection',modelCardDesc:'Switch provider, edit endpoint, model and key. Changes apply at once to all modules.',
  verTitle:'Version',wsTitle:'Workspace databases',
  wsDesc:'Eight local SQLite databases stored on this device. The AI config file lives next to your desktop settings.',
  cfgFile:'AI config file',
  kLang:'Language',kData:'Data folder',openData:'Open',done:'Done',
  kAI:'AI model',aiCustom:'Custom',aiYuntu:'Yuntu API',
  aiBase:'API Base URL',aiModel:'Model',aiKey:'API Key',
  aiKeyPh:'Leave blank to keep the current key',aiKeyEnv:'Using key from desktop config',
  aiSave:'Save & apply',aiSaved:'AI model updated. All modules use it now.',
  aiFail:'Failed to update AI config.',aiNone:'Not configured',aiConfiguring:'Loading AI settings…',
  setStatus:'Connection status',setRefresh:'Refresh status',
  stOk:'Configured',stNo:'Not configured',stLoading:'Loading…',
  intDesc:'Use your own API key and model presets; usage is billed by your provider.',
  modelCard:'Model & connection',modelCardDesc:'Switch provider, edit endpoint, model and key. Changes apply at once to all modules.',
  verTitle:'Version',wsTitle:'Workspace databases',
  wsDesc:'Eight local SQLite databases stored on this device. The AI config file lives next to your desktop settings.',
  cfgFile:'AI config file',
  kLang:'Language',kData:'Data folder',openData:'Open',done:'Done',
  kAI:'AI model',aiCustom:'Custom',aiYuntu:'Yuntu API',
  aiBase:'API Base URL',aiModel:'Model',aiKey:'API Key',
  aiKeyPh:'Leave blank to keep the current key',aiKeyEnv:'Using key from desktop config',
  aiSave:'Save & apply',aiSaved:'AI model updated. All modules use it now.',
  pwUpdated:'Password updated successfully. Sign in with your new password.',
  // errors
  eEmailReq:'Email address is required.',eEmailFmt:'Enter a valid email address.',
  ePassReq:'Password is required.',ePassShort:'Password must be at least 8 characters.',
  ePassMatch:'Passwords do not match.',eCred:'Invalid email or password.',
  eNetwork:'Something went wrong. Please try again.',eVerifyPending:'Please verify your email address to continue.',
  eCode6:'Please enter the 6-digit verification code.',eCodeBad:'Invalid verification code.',
  eCodeExp:'This verification code has expired. Send a new one below.',
  eExists:'An account with this email already exists.',
  eResetBad:'Invalid reset code.',eResetExp:'This reset code has expired. Request a new one.',
  eFillCode:'Please enter the 6-digit verification code.',
  strength:['Weak','Weak','Fair','Good','Strong'],
  since:d=>new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})
},
zh:{
  welcome:'欢迎回来',welcomeSub:'登录你的账户以继续。',
  email:'邮箱地址',emailPh:'name@company.com',password:'密码',passPh:'输入密码',
  passPhNew:'至少 8 个字符',passPhRe:'再次输入密码',
  forgot:'忘记密码？',signin:'登录',
  noAccount:'还没有账户？',signupLink:'注册',
  createTitle:'创建你的账户',createSub:'创建免费账户，立即开始。',
  confirm:'确认密码',createBtn:'创建账户',
  terms:'创建账户即表示你同意我们的',termsAnd:'和',tos:'服务条款',privacy:'隐私政策',
  termsNote:'本地构建暂不包含服务条款与隐私政策页面。',
  hasAccount:'已有账户？',signinLink:'登录',
  verifyTitle:'查收你的邮箱',
  verifySub:m=>`我们已向 ${m} 发送验证码，请在下方输入以完成邮箱验证。`,
  back:'返回',resendIn:s=>`${s} 后可重新发送`,noCode:'没有收到验证码？',
  resend:'重新发送验证邮件',verifyBtn:'验证邮箱',
  mailbox:'开发者邮箱',mailboxNote:'— 本地构建不发送外部邮件，你的验证码为',
  autofill:'自动填入',wrongAddr:'邮箱写错了？',diffEmail:'使用其他邮箱',
  forgotTitle:'忘记密码？',
  forgotSub:'输入你的邮箱地址，我们将发送用于重置密码的验证码。',
  sendReset:'发送重置码',forgotSentSub:m=>`如果 ${m} 存在对应账户，重置码已生成，10 分钟内有效。`,
  mailboxReset:'— 你的重置码为',enterReset:'输入重置码',backToSignin:'返回登录',
  resetTitle:'设置新密码',resetSub:'请为你的账户设置一个强密码。',
  resetCode:'重置码',resetCodePh:'6 位数字验证码',newPass:'新密码',confirmNew:'确认新密码',
  updateBtn:'更新密码',remembered:'想起来了？',
  meTitle:'个人中心',meSub:'管理你的资料、外观与会话。',
  verified:'已验证',pending:'待验证',
  kEmail:'邮箱',kSince:'注册于',kWorkspace:'工作区',vWorkspace:'本地 · 此设备',
  kTheme:'外观',light:'浅色',dark:'深色',kVerify:'邮箱验证',verifyNow:'验证邮箱',
  signout:'退出登录',
  avatarChange:'更换头像',avatarRemove:'恢复默认',avatarHint:'支持 JPG、PNG 或 WebP · 仅保存在此设备',avatarBad:'请选择小于 8 MB 的图片。',close:'关闭',
  displayName:'显示昵称',displayNamePh:'输入你希望显示的昵称',bio:'个人简介',bioPh:'简单介绍一下自己（选填）',saveProfile:'保存资料',profileSaved:'个人资料已更新。',profileInvalid:'昵称长度应为 2–30 个字符。',copyEmail:'复制邮箱',copied:'已复制',exportProfile:'导出个人资料',accountActions:'账户工具',loginId:'登录邮箱',
  meNote:'此账户仅保存在本设备。密码以加盐 SHA-256 哈希存储，绝不保存明文。',
  settings:'设置',setSub:'通用、AI、账户、数据、模块、集成、桌面、诊断与关于 —— 分九类放在左侧。',
  setNavAI:'AI 模型与 API',setNavAIDesc:'服务商、地址、密钥、测试',
  setNavGeneral:'通用与外观',setNavGeneralDesc:'主题、语言、字体、启动',
  setNavAccount:'账户与安全',setNavAccountDesc:'密码、验证、会话',
  setNavData:'工作区与数据',setNavDataDesc:'备份、存储、回收站',
  setNavModules:'模块设置',setNavModulesDesc:'八大模块一览',
  setNavInteg:'集成与自动化',setNavIntegDesc:'Webhook 与通知',
  setNavDesktop:'桌面应用',setNavDesktopDesc:'开机启动、托盘、服务',
  setNavDiag:'运行与诊断',setNavDiagDesc:'健康检查、日志、导出',
  setNavAbout:'关于与更新',setNavAboutDesc:'版本、更新记录、反馈',
  th_light:'浅色',th_dark:'深色',th_system:'跟随系统',kOn:'开',kOff:'关',
  kFont:'字体大小',fsNormal:'默认',fsLarge:'大',kAnim:'动画效果',kStartup:'默认启动模块',startupHome:'首页',
  aiTest:'测试连接',aiTesting:'测试中…',aiTestOk:l=>`连接正常 · ${l} ms`,aiTestFail:'连接失败（地址不可达或被 CORS 拦截）。',
  aiAssign:'各模块模型分配',aiAssignDesc:'可选覆盖：支持选择模型的模块将使用自己的模型，其余模块跟随全局模型。',
  aiFollow:'跟随全局模型',
  chPassTitle:'修改密码',chCur:'当前密码',chBtn:'更新密码',chOk:'密码已修改。',
  secNote:'本地账户 · 加盐 SHA-256 哈希 · 仅保存在此设备。',
  wsAuth:'工作区授权',wsAuthV:'本机已解锁',
  wsName:'工作区名称',
  backupDesc:'将八个模块数据库与本地偏好打包为 .ofbackup 文件下载保存。',
  btnBackup:'立即备份',btnBackupDone:'备份文件已下载（.ofbackup）。',btnBackupFail:m=>`备份失败：${m}`,
  kStorage:'存储占用',trashTitle:'回收站',trashNote:'已删除记录保留在各自模块的回收站中，可随时恢复。',
  trashEmpty:'八个模块的回收站均为空。',trashCount:(n,c)=>`${n} 个模块共有 ${c} 条可恢复记录。`,
  trashAuth:'请先解锁本机工作区以读取回收站数量。',
  integNote:'Webhook 地址先保存在本机；事件推送将在后续版本接入。',
  whTitle:'Webhook',whPh:'https://example.com/hook',whAdd:'添加 Webhook',whNone:'还没有 Webhook。',
  kNotify:'系统通知',notifyNote:'长时间任务完成时显示桌面通知。',
  openAtLogin:'开机自动启动',closeToTray:'关闭窗口最小化到托盘',desktopNote:'偏好先保存在本机，后续版本由桌面壳应用生效。',
  svcStatus:'后台服务',svcOk:'运行中',svcDown:'无响应',svcCheck:'重新检测',svcLatency:l=>`本机服务 · ${l} ms`,
  logTitle:'服务日志',logDesc:'服务与模块日志写入工作区设置同目录下的 desktop-service.log。',
  diagBtn:'导出诊断信息',diagDone:'诊断文件已下载。',
  verOk:'当前已是最新版本。',checkUpd:'检查更新',changelog:'更新记录',
  changelogText:'v1.1.0 — 设置重构为九大栏目 · AI 服务商预设并即时生效 · 全局界面语言（中/英）· 工作区备份与诊断导出。',
  docsLink:'使用说明',fbLink:'反馈建议',openMod:'打开',
  modulesNote:'各模块的业务规则与默认参数在各模块自身的设置页中管理。',
  pwUpdated:'密码更新成功，请使用新密码登录。',
  aiFail:'AI 配置更新失败。',aiNone:'未配置',aiConfiguring:'正在读取 AI 配置…',
  setStatus:'连接状态',setRefresh:'刷新状态',
  stOk:'配置已就绪',stNo:'未配置',stLoading:'正在读取…',
  intDesc:'使用你自己的 API Key 与模型预设，费用由你的服务商结算。',
  modelCard:'模型与连接',modelCardDesc:'切换供应商、修改接口地址、模型与密钥，保存后对所有模块立即生效。',
  verTitle:'版本',wsTitle:'工作区数据库',
  wsDesc:'八个本地 SQLite 数据库保存在此设备；AI 配置文件与桌面设置存放于同一目录。',
  cfgFile:'AI 配置文件',
  kLang:'界面语言',kData:'数据目录',openData:'打开',done:'完成',
  kAI:'AI 模型',aiCustom:'自定义',aiYuntu:'云途API',
  aiBase:'API 地址',aiModel:'模型',aiKey:'API 密钥',
  aiKeyPh:'留空则沿用当前密钥',aiKeyEnv:'当前密钥来自桌面配置文件',
  aiSave:'保存并应用',aiSaved:'AI 模型已更新，所有模块立即生效。',
  eEmailReq:'请输入邮箱地址。',eEmailFmt:'请输入有效的邮箱地址。',
  ePassReq:'请输入密码。',ePassShort:'密码至少需要 8 个字符。',
  ePassMatch:'两次输入的密码不一致。',eCred:'邮箱或密码不正确。',
  eNetwork:'出了点问题，请重试。',eVerifyPending:'请先验证你的邮箱地址。',
  eCode6:'请输入 6 位验证码。',eCodeBad:'验证码不正确。',
  eCodeExp:'验证码已过期，请重新发送。',
  eExists:'该邮箱已注册过账户。',
  eResetBad:'重置码不正确。',eResetExp:'重置码已过期，请重新申请。',
  eFillCode:'请输入 6 位验证码。',
  strength:['弱','弱','一般','良好','强'],
  since:d=>new Date(d).toLocaleDateString('zh-CN',{year:'numeric',month:'short',day:'numeric'})
}};
const t=(k,...a)=>{const v=(STR[getLang()]||STR.en)[k];return typeof v==='function'?v(...a):(v??k);};

// ---- icons ----
const I={
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-2.2 3M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  arrowL:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/></svg>',
  box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z"/><path d="M3 8.5 12 14l9-5.5M12 14v7"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.7 2.6 4 6 4 9.5s-1.3 6.9-4 9.5c-2.7-2.6-4-6-4-9.5s1.3-6.9 4-9.5Z"/></svg>',
  folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5.5A1.5 1.5 0 0 1 4.5 4h4L11 6.5h8.5A1.5 1.5 0 0 1 21 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V7Z"/></svg>',
  robot:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2.5"/><path d="M12 8V4.5M9.5 4.5h5"/><circle cx="9" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><path d="M9 17h6"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08A1.7 1.7 0 0 0 10 4.09V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.88Z"/></svg>',
  plug:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z"/><path d="M12 17v5"/></svg>',
  monitor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  activity:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 8-6-16-3 8H2"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none"/></svg>',
  type:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5V5h16v1.5M12 5v14M9 19h6"/></svg>'
};
const eyeBtn=on=>`<button type="button" class="sa-eye" data-eye aria-label="${on?'Hide password':'Show password'}" aria-pressed="${on}">${on?I.eyeOff:I.eye}</button>`;

// ---- module state ----
let mask,card,setMask,setCard,accountDrawer,accountPanel;
// ---- AI model switching (Modex-style presets) ----
const AI_PRESETS={
  yuntu:{baseUrl:'https://ytapi.co/v1',model:'gpt-6-astra'},
  mhcode:{baseUrl:'https://api.mhcode.ai/v1',model:'gpt-6.1-sol'},
  sub2api:{baseUrl:'http://localhost:8080',model:'gpt-5.5'},
  custom:{baseUrl:'',model:''}
};
let aiInfo=null; // latest GET /api/ai/config result
async function loadAiInfo(){
  try{const r=await fetch('/api/ai/config',{cache:'no-store'});aiInfo=await r.json();}
  catch{aiInfo=null;}
  return aiInfo;
}
async function saveAiConfig(cardEl){
  const btn=cardEl.querySelector('[data-ai-save]');
  const status=cardEl.querySelector('.sa-ai-status');
  const baseUrl=cardEl.querySelector('[data-ai-base]')?.value?.trim()||'';
  const model=cardEl.querySelector('[data-ai-model]')?.value?.trim()||'';
  const apiKey=cardEl.querySelector('[data-ai-key]')?.value?.trim()||'';
  if(btn){btn.disabled=true;btn.innerHTML='<span class="sa-spin"></span>';}
  if(status){status.textContent='';status.className='sa-ai-status';}
  try{
    const r=await fetch('/api/ai/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseUrl,model,apiKey})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'');
    aiInfo=data;
    const key=cardEl.querySelector('[data-ai-key]');if(key)key.value='';
    cardEl.querySelectorAll('[data-ai-provider]').forEach(c=>c.classList.toggle('on',c.dataset.aiProvider===aiActivePreset()));
    const badge=cardEl.querySelector('.sa-pc-line b');if(badge)badge.textContent=aiInfo.model||t('aiNone');
    const dot=cardEl.querySelector('.sa-pc-line .sa-badge');if(dot){dot.className='sa-badge'+(aiInfo.configured?'':' unverified');dot.textContent=aiInfo.configured?t('stOk'):t('stNo');}
    if(status){status.textContent=t('aiSaved');status.className='sa-ai-status ok';}
  }catch(e){
    if(status){status.textContent=t('aiFail')+(e.message?` (${e.message})`:'');status.className='sa-ai-status err';}
  }finally{
    if(btn){btn.disabled=false;btn.textContent=t('aiSave');}
  }
}
const aiActivePreset=()=>{
  if(!aiInfo)return null;
  for(const [id,p] of Object.entries(AI_PRESETS)){
    if(id!=='custom'&&p.baseUrl===aiInfo.baseUrl&&p.model===aiInfo.model)return id;
  }
  return 'custom';
};
const state={view:'signin',email:'',verifyCode:'',verifyExpire:0,resendAt:0,resetCode:'',resetExpire:0,forgotSent:false,lastForgotEmail:''};
const fmtLeft=ts=>{const s=Math.max(0,Math.ceil((ts-Date.now())/1000));return s>60?`${Math.ceil(s/60)} min`:s+'s';};
const passScore=p=>{let s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return Math.max(1,Math.min(4,s-0));};
const strengthHTML=p=>p?`<div class="sa-strength" data-level="${passScore(p)}"><span class="sa-segs"><i></i><i></i><i></i><i></i></span><small>${t('strength')[passScore(p)]}</small></div>`:'';
const notice=(cls,msg)=>msg?`<p class="${cls}" role="${cls==='sa-err'?'alert':'status'}"><span>${msg}</span></p>`:'';

// =====================================================================
// View templates
// =====================================================================
const brand=()=>`<div class="sa-brand"><img src="/desktop-icon.png" alt=""/><strong>OmniForm<span>OS</span></strong></div>`;
const themeNow=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
const seg2=(attr,cur,a,b,la,lb)=>`<span class="sa-seg2" ${attr}><button type="button" data-${attr==='data-lang2'?'setlang':'settheme'}="${a}" class="${cur===a?'on':''}">${la}</button><button type="button" data-${attr==='data-lang2'?'setlang':'settheme'}="${b}" class="${cur===b?'on':''}">${lb}</button></span>`;

function vSignin(msg,ok){
  return `${brand()}
  <h1 class="sa-title">${t('welcome')}</h1>
  <p class="sa-sub">${t('welcomeSub')}</p>
  ${notice('sa-ok',ok)}${notice('sa-err',msg)}
  <form data-form="signin" novalidate>
    <div class="sa-field"><label class="sa-label" for="f-email">${t('email')}</label>
      <input class="sa-input" id="f-email" name="email" type="email" autocomplete="email" placeholder="${t('emailPh')}" value="${esc(state.email)}"></div>
    <div class="sa-field"><label class="sa-label" for="f-pass">${t('password')} <button type="button" class="sa-link muted" data-go="forgot">${t('forgot')}</button></label>
      <span class="sa-wrap"><input class="sa-input has-eye" id="f-pass" name="password" type="password" autocomplete="current-password" placeholder="${t('passPh')}">${eyeBtn(false)}</span></div>
    <button class="sa-btn" type="submit">${t('signin')}</button>
  </form>
  <p class="sa-footer">${t('noAccount')} <button type="button" class="sa-link" data-go="signup">${t('signupLink')}</button></p>`;
}
function vSignup(msg){
  return `${brand()}
  <h1 class="sa-title">${t('createTitle')}</h1>
  <p class="sa-sub">${t('createSub')}</p>
  ${notice('sa-err',msg)}
  <form data-form="signup" novalidate>
    <div class="sa-field"><label class="sa-label" for="s-email">${t('email')}</label>
      <input class="sa-input" id="s-email" name="email" type="email" autocomplete="email" placeholder="${t('emailPh')}" value="${esc(state.email)}"></div>
    <div class="sa-field"><label class="sa-label" for="s-pass">${t('password')}</label>
      <span class="sa-wrap"><input class="sa-input has-eye" id="s-pass" name="password" type="password" autocomplete="new-password" placeholder="${t('passPhNew')}">${eyeBtn(false)}</span>${strengthHTML('')}</div>
    <div class="sa-field"><label class="sa-label" for="s-pass2">${t('confirm')}</label>
      <span class="sa-wrap"><input class="sa-input has-eye" id="s-pass2" name="confirm" type="password" autocomplete="new-password" placeholder="${t('passPhRe')}">${eyeBtn(false)}</span></div>
    <button class="sa-btn" type="submit">${t('createBtn')}</button>
  </form>
  <p class="sa-terms">${t('terms')} <button type="button" class="sa-link" data-terms>${t('tos')}</button> ${t('termsAnd')} <button type="button" class="sa-link" data-terms>${t('privacy')}</button>.</p>
  <p class="sa-footer">${t('hasAccount')} <button type="button" class="sa-link" data-go="signin">${t('signinLink')}</button></p>`;
}
function vVerify(msg){
  const masked=maskEmail(state.email);
  return `<button type="button" class="sa-back" data-go="signup">${I.arrowL}${t('back')}</button>
  <h1 class="sa-title">${t('verifyTitle')}</h1>
  <p class="sa-sub">${t('verifySub',`<b>${esc(masked)}</b>`)}</p>
  ${notice('sa-err',msg)}
  <form data-form="verify" novalidate>
    <div class="sa-code" data-code>${Array.from({length:6},(_,i)=>`<input inputmode="numeric" maxlength="1" autocomplete="${i===0?'one-time-code':'off'}" aria-label="Verification digit ${i+1}">`).join('')}</div>
    <div class="sa-resend"><span>${state.resendAt>Date.now()?t('resendIn',fmtLeft(state.resendAt)):t('noCode')}</span>
      <button type="button" class="sa-link" data-resend ${state.resendAt>Date.now()?'disabled':''}>${t('resend')}</button></div>
    <button class="sa-btn" type="submit">${t('verifyBtn')}</button>
  </form>
  ${state.verifyCode?`<div class="sa-mailbox">${I.mail} <b>${t('mailbox')}</b> ${t('mailboxNote')} <b>${state.verifyCode}</b><button type="button" class="sa-link" data-autofill>${t('autofill')}</button></div>`:''}
  <p class="sa-footer">${t('wrongAddr')} <button type="button" class="sa-link" data-go="signup">${t('diffEmail')}</button></p>`;
}
const _vForgotPlain=(msg,ok)=>`<button type="button" class="sa-back" data-go="signin">${I.arrowL}${t('backToSignin')}</button>
  <h1 class="sa-title">${t('forgotTitle')}</h1>
  <p class="sa-sub">${t('forgotSub')}</p>
  ${notice('sa-err',msg)}${notice('sa-ok',ok)}
  <form data-form="forgot" novalidate>
    <div class="sa-field"><label class="sa-label" for="g-email">${t('email')}</label>
      <input class="sa-input" id="g-email" name="email" type="email" autocomplete="email" placeholder="${t('emailPh')}" value="${esc(state.email)}"></div>
    <button class="sa-btn" type="submit">${t('sendReset')}</button>
  </form>
  <p class="sa-footer"><button type="button" class="sa-link" data-go="signin">${t('backToSignin')}</button></p>`;
const VIEWS={};
VIEWS.forgot=function(msg,ok){
  if(state.view==='forgot'&&state.forgotSent&&state.lastForgotEmail){
    return `<button type="button" class="sa-back" data-go="signin">${I.arrowL}${t('backToSignin')}</button>
    <h1 class="sa-title">${t('verifyTitle')}</h1>
    <p class="sa-sub">${t('forgotSentSub',`<b>${esc(state.lastForgotEmail)}</b>`)}</p>
    ${state.resetCode?`<div class="sa-mailbox">${I.mail} <b>${t('mailbox')}</b> ${t('mailboxReset')} <b>${state.resetCode}</b><button type="button" class="sa-link" data-resetgo>${t('enterReset')}</button></div>`:''}
    <button type="button" class="sa-btn" data-go="reset-direct">${t('enterReset')}</button>
    <p class="sa-footer"><button type="button" class="sa-link" data-go="signin">${t('backToSignin')}</button></p>`;
  }
  return _vForgotPlain(msg,ok);
};
VIEWS.reset=function(msg){
  return `<button type="button" class="sa-back" data-go="forgot">${I.arrowL}${t('back')}</button>
  <h1 class="sa-title">${t('resetTitle')}</h1>
  <p class="sa-sub">${t('resetSub')}</p>
  ${notice('sa-err',msg)}
  <form data-form="reset" novalidate>
    <div class="sa-field"><label class="sa-label" for="r-code">${t('resetCode')}</label>
      <input class="sa-input" id="r-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="${t('resetCodePh')}"></div>
    <div class="sa-field"><label class="sa-label" for="r-pass">${t('newPass')}</label>
      <span class="sa-wrap"><input class="sa-input has-eye" id="r-pass" name="password" type="password" autocomplete="new-password" placeholder="${t('passPhNew')}">${eyeBtn(false)}</span>${strengthHTML('')}</div>
    <div class="sa-field"><label class="sa-label" for="r-pass2">${t('confirmNew')}</label>
      <span class="sa-wrap"><input class="sa-input has-eye" id="r-pass2" name="confirm" type="password" autocomplete="new-password" placeholder="${t('passPhRe')}">${eyeBtn(false)}</span></div>
    <button class="sa-btn" type="submit">${t('updateBtn')}</button>
  </form>
  <p class="sa-footer">${t('remembered')} <button type="button" class="sa-link" data-go="signin">${t('backToSignin')}</button></p>`;
};
VIEWS.signin=vSignin;VIEWS.signup=vSignup;VIEWS.verify=vVerify;
VIEWS.me=function(){
  const u=users()[getSession()]||{};
  const verified=!!u.verified;
  const since=u.createdAt?t('since',u.createdAt):'—';
  const lang=getLang();
  const avatar=u.avatar||'',displayName=(u.displayName||'').trim(),bio=(u.bio||'').trim();
  const primaryName=displayName||getSession();
  return `<button type="button" class="sa-drawer-close" data-close-account aria-label="${t('close')}">✕</button>
  ${brand()}
  <h1 class="sa-title">${t('meTitle')}</h1>
  <p class="sa-sub">${t('meSub')}</p>
  <div class="sa-me-head sa-avatar-editor">
    <button type="button" class="sa-me-avatar ${avatar?'has-photo':''}" data-avatar-pick aria-label="${t('avatarChange')}">${avatar?`<img src="${esc(avatar)}" alt=""/>`:esc(primaryName.slice(0,1).toUpperCase())}<span class="sa-avatar-edit">✎</span></button>
    <span class="sa-me-id"><b>${esc(primaryName)}</b>
      ${displayName?`<small class="sa-login-id">${esc(getSession())}</small>`:''}
      <span class="sa-badge ${verified?'':'unverified'}">${verified?I.check+' '+t('verified'):t('pending')}</span>
      <span class="sa-avatar-actions"><button type="button" class="sa-link" data-avatar-pick>${t('avatarChange')}</button>${avatar?`<button type="button" class="sa-link muted" data-avatar-remove>${t('avatarRemove')}</button>`:''}</span>
      <small class="sa-avatar-hint">${t('avatarHint')}</small></span>
    <input type="file" data-avatar-file accept="image/jpeg,image/png,image/webp" hidden>
  </div>
  <form class="sa-profile-form" data-form="profile" novalidate>
    <div class="sa-profile-grid">
      <div class="sa-field"><label class="sa-label" for="profile-name">${t('displayName')}</label><input class="sa-input" id="profile-name" name="displayName" maxlength="30" autocomplete="nickname" placeholder="${t('displayNamePh')}" value="${esc(displayName)}"></div>
      <div class="sa-field"><label class="sa-label" for="profile-bio">${t('bio')}</label><textarea class="sa-input sa-profile-bio" id="profile-bio" name="bio" maxlength="120" placeholder="${t('bioPh')}">${esc(bio)}</textarea><small class="sa-char-count">${bio.length}/120</small></div>
    </div>
    <div class="sa-profile-save"><p class="sa-ai-status" data-profile-status role="status"></p><button type="submit" class="sa-btn sa-btn-sm">${t('saveProfile')}</button></div>
  </form>
  <div class="sa-rows">
    <div class="sa-row">${I.mail}<span class="k">${t('kEmail')}</span><span class="v sa-account-email">${esc(getSession())}<button type="button" class="sa-copy-btn" data-copy-email>${t('copyEmail')}</button></span></div>
    <div class="sa-row">${I.cal}<span class="k">${t('kSince')}</span><span class="v">${esc(since)}</span></div>
    <div class="sa-row">${I.box}<span class="k">${t('kWorkspace')}</span><span class="v">${t('vWorkspace')}</span></div>
    <div class="sa-row">${I.shield}<span class="k">${t('kTheme')}</span>
      <span class="v">${seg2('data-themeseg',themeNow(),'light','dark',t('light'),t('dark'))}</span></div>
    <div class="sa-row">${I.globe}<span class="k">${t('kLang')}</span>
      <span class="v">${seg2('data-lang2',lang,'zh','en','中文','English')}</span></div>
    ${verified?'':`<div class="sa-row">${I.mail}<span class="k">${t('kVerify')}</span><span class="v"><button type="button" class="sa-link" data-reverify>${t('verifyNow')}</button></span></div>`}
  </div>
  <div class="sa-account-tools"><span>${t('accountActions')}</span><button type="button" class="sa-btn-ghost" data-export-profile>${t('exportProfile')}</button></div>
  <button type="button" class="sa-btn-danger" data-signout>${t('signout')}</button>
  <p class="sa-note">${t('meNote')}</p>`;
};
// ---- settings tabs (nine categories) ----
let setTab='general';
const MODULES=[['#pilot','FormPilot'],['#exam','ExamCraft'],['#flowform','FlowForm'],['#docmorph','DocMorph'],['#adaptform','AdaptForm'],['#tablemind','TableMind'],['#labform','LabForm'],['#appcanvas','AppCanvas']];
const SET_TABS=[
  ['general','setNavGeneral','setNavGeneralDesc','gear'],
  ['ai','setNavAI','setNavAIDesc','robot'],
  ['account','setNavAccount','setNavAccountDesc','shield'],
  ['data','setNavData','setNavDataDesc','folder'],
  ['modules','setNavModules','setNavModulesDesc','box'],
  ['integ','setNavInteg','setNavIntegDesc','plug'],
  ['desktop','setNavDesktop','setNavDesktopDesc','monitor'],
  ['diag','setNavDiag','setNavDiagDesc','activity'],
  ['about','setNavAbout','setNavAboutDesc','info']
];
const themePref=()=>{try{return localStorage.getItem('omniformos.theme')||themeNow();}catch{return themeNow();}};
const fontScale=()=>{try{return localStorage.getItem('omniformos.fontScale')||'1';}catch{return'1';}};
const animPref=()=>{try{return localStorage.getItem('omniformos.anim')||'on';}catch{return'on';}};
const startupPref=()=>{try{return localStorage.getItem('omniformos.startup')||'';}catch{return'';}};
const whList=()=>LS.get('omniformos.webhooks',[]);
const assignMap=()=>LS.get('omniformos.modelAssign',{});
const seg3=()=>`<span class="sa-seg2">${['light','dark','system'].map(m=>`<button type="button" data-settheme="${m}" class="${themePref()===m?'on':''}">${t('th_'+m)}</button>`).join('')}</span>`;
const onOffSeg=(attr,cur)=>`<span class="sa-seg2"><button type="button" ${attr}="on" class="${cur!=='off'?'on':''}">${t('kOn')}</button><button type="button" ${attr}="off" class="${cur==='off'?'on':''}">${t('kOff')}</button></span>`;
const startupSelect=()=>`<select class="sa-select" data-startup>${[['',''] ,...MODULES].map(([v,l])=>`<option value="${v}"${startupPref()===v?' selected':''}>${v?l:t('startupHome')}</option>`).join('')}</select>`;
function flashStatus(root,sel,msg,ok){const s=root.querySelector(sel);if(s){s.textContent=msg;s.className='sa-ai-status '+(ok?'ok':'err');}}
async function doBackup(root){
  const btn=root.querySelector('[data-backup]');if(btn)btn.disabled=true;
  flashStatus(root,'[data-backup-status]','',true);
  try{
    const browserStorage={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);browserStorage[k]=localStorage.getItem(k);}
    const r=await fetch('/api/workspace/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({browserStorage})});
    if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||r.status);}
    const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='OmniFormOS-workspace.ofbackup';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    flashStatus(root,'[data-backup-status]',t('btnBackupDone'),true);
  }catch(e){flashStatus(root,'[data-backup-status]',t('btnBackupFail',e.message),false);}
  finally{if(btn){btn.disabled=false;btn.textContent=t('btnBackup');}}
}
async function testAi(root){
  const btn=root.querySelector('[data-ai-test]');if(btn){btn.disabled=true;btn.textContent=t('aiTesting');}
  const s=root.querySelector('[data-ai-test-status]');
  const base=(root.querySelector('[data-ai-base]')?.value||'').trim().replace(/\/+$/,'');
  try{
    if(!base||!/^https?:\/\//.test(base))throw Error('bad url');
    const t0=performance.now();
    await fetch(base+'/models',{mode:'cors',cache:'no-store',signal:AbortSignal.timeout(8000)});
    const ms=Math.round(performance.now()-t0);
    if(s){s.textContent=t('aiTestOk',ms);s.className='sa-ai-status ok';}
  }catch{if(s){s.textContent=t('aiTestFail');s.className='sa-ai-status err';}}
  finally{if(btn){btn.disabled=false;btn.textContent=t('aiTest');}}
}
async function exportDiag(root){
  const btn=root.querySelector('[data-diag]');if(btn){btn.disabled=true;btn.textContent=t('aiTesting');}
  try{
    let health=null,storage=null;
    try{health=await (await fetch('/api/health',{cache:'no-store'})).json();}catch{}
    try{storage=await (navigator.storage?.estimate?.()||null);}catch{}
    const diag={exportedAt:new Date().toISOString(),version:'1.1.0',userAgent:navigator.userAgent,language:getLang(),service:health,
      ai:aiInfo?{baseUrl:aiInfo.baseUrl,model:aiInfo.model,configured:aiInfo.configured,keyMasked:aiInfo.keyMasked}:null,
      storage,preferences:{theme:themePref(),fontScale:fontScale(),anim:animPref(),startup:startupPref(),desktop:LS.get('omniformos.desktop',{}),notify:animPref(),webhooks:whList().map(w=>({on:w.on}))}};
    const blob=new Blob([JSON.stringify(diag,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='OmniFormOS-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    flashStatus(root,'[data-diag-status]',t('diagDone'),true);
  }catch(e){flashStatus(root,'[data-diag-status]',String(e.message||e),false);}
  finally{const b=root.querySelector('[data-diag]');if(b){b.disabled=false;b.textContent=t('diagBtn');}}
}
async function runTabAsync(){
  if(!setCard||setMask.hidden)return;
  if(setTab==='data'){
    try{const e=await navigator.storage?.estimate?.();const el=setCard.querySelector('[data-storage]');if(el&&e)el.textContent=fmtBytes(e.usage||0)+' / '+fmtBytes(e.quota||0);}catch{}
    const trash=setCard.querySelector('[data-trash]');
    if(trash){try{
      const rs=await Promise.all(MODULES.map(async([h])=>{const r=await fetch(`/api/workspace/records?module=${h.slice(1)}&trash=1`,{cache:'no-store'});if(!r.ok)throw Error(r.status);const d=await r.json();return(d.items||[]).length;}));
      const total=rs.reduce((a,b)=>a+b,0);
      const names=MODULES.filter((m,i)=>rs[i]>0).map(m=>m[1]).join(', ');
      trash.textContent=total?t('trashCount',names,total):t('trashEmpty');
      trash.className='sa-ai-status '+(total?'':'ok');
    }catch{trash.textContent=t('trashAuth');trash.className='sa-ai-status';}}
  }
  if(setTab==='desktop'||setTab==='diag'){
    const el=setCard.querySelector('[data-svc]');
    if(el){el.innerHTML=`<span class="sa-badge unverified">${t('stLoading')}</span>`;
      try{const t0=performance.now();const r=await fetch('/api/health',{cache:'no-store'});const d=await r.json();const ms=Math.round(performance.now()-t0);
        el.innerHTML=`<span class="sa-badge ${d.ok?'':'unverified'}">${d.ok?t('svcOk'):t('svcDown')}</span><span class="sa-muted-text">${t('svcLatency',ms)}</span>`;
      }catch{el.innerHTML=`<span class="sa-badge unverified">${t('svcDown')}</span>`;}}
  }
}
VIEWS.settings=function(){
  const lang=getLang();
  const item=([id,name,desc,icon])=>`<button type="button" class="sa-set-item ${setTab===id?'on':''}" data-set-tab="${id}">${I[icon]}<span class="t"><b>${t(name)}</b><small>${t(desc)}</small></span></button>`;
  const st=aiInfo;
  let main='';
  if(setTab==='general'){
    main=`<h3>${t('setNavGeneral')}</h3><p class="sa-set-desc">${t('setNavGeneralDesc')}</p>
    <div class="sa-panel-card"><div class="sa-row">${I.shield}<span class="k">${t('kTheme')}</span><span class="v">${seg3()}</span></div></div>
    <div class="sa-panel-card"><div class="sa-row">${I.globe}<span class="k">${t('kLang')}</span><span class="v">${seg2('data-lang2',lang,'zh','en','中文','English')}</span></div></div>
    <div class="sa-panel-card"><div class="sa-row">${I.type}<span class="k">${t('kFont')}</span><span class="v">${seg2('data-font',fontScale(),'1','1.15',t('fsNormal'),t('fsLarge'))}</span></div></div>
    <div class="sa-panel-card"><div class="sa-row">${I.activity}<span class="k">${t('kAnim')}</span><span class="v">${onOffSeg('data-anim',animPref())}</span></div></div>
    <div class="sa-panel-card"><div class="sa-row">${I.box}<span class="k">${t('kStartup')}</span><span class="v">${startupSelect()}</span></div></div>`;
  }else if(setTab==='ai'){
    main=`<h3>${t('setNavAI')}</h3><p class="sa-set-desc">${t('intDesc')}</p>
    <div class="sa-panel-card">
      <div class="sa-pc-head"><div><b>${t('setStatus')}</b><p>${st?esc(st.baseUrl||'—'):t('stLoading')}</p></div>
        <button type="button" class="sa-btn-ghost" data-ai-refresh>${t('setRefresh')}</button></div>
      <p class="sa-pc-line">${st?`<span class="sa-badge ${st.configured?'':'unverified'}">${st.configured?t('stOk'):t('stNo')}</span> <b>${esc(st.model||'—')}</b>${st.keyMasked?`<span class="sa-muted-text">${esc(st.keyMasked)}</span>`:''}`:t('stLoading')}</p>
    </div>
    <div class="sa-panel-card">
      <b class="sa-pc-title">${t('modelCard')}</b><p class="sa-pc-sub">${t('modelCardDesc')}</p>
      ${st?`<div class="sa-ai">
        <div class="sa-ai-presets" role="tablist">
          ${['yuntu','mhcode','sub2api','custom'].map(id=>`<button type="button" class="sa-chip ${aiActivePreset()===id?'on':''}" data-ai-provider="${id}">${esc(id==='yuntu'?t('aiYuntu'):id==='custom'?t('aiCustom'):id==='mhcode'?'MHCode':'Sub2API')}</button>`).join('')}
        </div>
        <div class="sa-field"><label class="sa-label" for="ai-base">${t('aiBase')}</label>
          <input class="sa-input" id="ai-base" data-ai-base name="aiBase" type="url" placeholder="https://api.example.com/v1" value="${esc(st.baseUrl||'')}" spellcheck="false"></div>
        <div class="sa-field"><label class="sa-label" for="ai-model">${t('aiModel')}</label>
          <input class="sa-input" id="ai-model" data-ai-model name="aiModel" type="text" placeholder="gpt-6-astra" value="${esc(st.model||'')}" spellcheck="false"></div>
        <div class="sa-field"><label class="sa-label" for="ai-key">${t('aiKey')}</label>
          <span class="sa-wrap"><input class="sa-input has-eye" id="ai-key" data-ai-key name="aiKey" type="password" autocomplete="off" placeholder="${st.keyMasked?t('aiKeyPh'):t('aiKeyEnv')}">${eyeBtn(false)}</span></div>
        <div class="sa-ai-actions"><button type="button" class="sa-btn sa-btn-sm" data-ai-save>${t('aiSave')}</button>
        <button type="button" class="sa-btn-ghost" data-ai-test>${t('aiTest')}</button></div>
        <p class="sa-ai-status" data-ai-test-status role="status"></p>
      </div>`:t('stLoading')}
    </div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('aiAssign')}</b><p class="sa-pc-sub">${t('aiAssignDesc')}</p>
      ${st?MODULES.map(([h,n])=>`<div class="sa-assign-row"><label class="sa-label" for="as-${h.slice(1)}">${n}</label>
        <input class="sa-input" id="as-${h.slice(1)}" data-assign="${h}" type="text" value="${esc((assignMap()[h]||''))}" placeholder="${esc((st.model||'')+' · '+t('aiFollow'))}" spellcheck="false"></div>`).join(''):t('stLoading')}
      <button type="button" class="sa-btn sa-btn-sm" data-assign-save>${t('aiSave')}</button>
      <p class="sa-ai-status" data-assign-status role="status"></p>
    </div>`;
  }else if(setTab==='account'){
    const u=users()[getSession()]||{};
    const verified=!!u.verified;
    main=`<h3>${t('setNavAccount')}</h3><p class="sa-set-desc">${t('setNavAccountDesc')}</p>
    <div class="sa-panel-card">
      <div class="sa-row">${I.mail}<span class="k">${t('kEmail')}</span><span class="v">${esc(getSession()||'—')}</span></div>
      <div class="sa-row">${I.shield}<span class="k">${t('kVerify')}</span><span class="v"><span class="sa-badge ${verified?'':'unverified'}">${verified?I.check+' '+t('verified'):t('pending')}</span>${verified?'':`<button type="button" class="sa-link" data-reverify2>${t('verifyNow')}</button>`}</span></div>
      <div class="sa-row">${I.box}<span class="k">${t('wsAuth')}</span><span class="v">${t('wsAuthV')}</span></div>
    </div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('chPassTitle')}</b>
      <form data-form="chpass" novalidate>
        <div class="sa-field"><label class="sa-label" for="cp-cur">${t('chCur')}</label>
          <input class="sa-input" id="cp-cur" name="cur" type="password" autocomplete="current-password"></div>
        <div class="sa-field"><label class="sa-label" for="cp-new">${t('newPass')}</label>
          <input class="sa-input" id="cp-new" name="password" type="password" autocomplete="new-password" placeholder="${t('passPhNew')}"></div>
        <div class="sa-field"><label class="sa-label" for="cp-cf">${t('confirm')}</label>
          <input class="sa-input" id="cp-cf" name="confirm" type="password" autocomplete="new-password" placeholder="${t('passPhRe')}"></div>
        <button type="submit" class="sa-btn sa-btn-sm">${t('chBtn')}</button>
        <p class="sa-ai-status" data-chpass-status role="status"></p>
      </form></div>
    <button type="button" class="sa-btn-danger" data-signout>${t('signout')}</button>
    <p class="sa-note">${t('secNote')}</p>`;
  }else if(setTab==='data'){
    main=`<h3>${t('setNavData')}</h3><p class="sa-set-desc">${t('setNavDataDesc')}</p>
    <div class="sa-panel-card">
      <div class="sa-row">${I.folder}<span class="k">${t('kData')}</span><span class="v"><button type="button" class="sa-link" data-open-data>${t('openData')}</button></span></div>
      <div class="sa-row">${I.box}<span class="k">${t('wsName')}</span><span class="v"><input class="sa-input sa-input-inline" data-wsname type="text" value="${esc(LS.get('omniformos.workspaceName',''))}" placeholder="OmniFormOS"></span></div>
      <div class="sa-row">${I.activity}<span class="k">${t('kStorage')}</span><span class="v" data-storage>${t('stLoading')}</span></div>
    </div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('btnBackup')}</b><p class="sa-pc-sub">${t('backupDesc')}</p>
      <button type="button" class="sa-btn sa-btn-sm" data-backup>${t('btnBackup')}</button>
      <p class="sa-ai-status" data-backup-status role="status"></p></div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('trashTitle')}</b><p class="sa-pc-sub">${t('trashNote')}</p>
      <div class="sa-ai-status" data-trash>${t('stLoading')}</div></div>`;
  }else if(setTab==='modules'){
    main=`<h3>${t('setNavModules')}</h3><p class="sa-set-desc">${t('setNavModulesDesc')}</p>
    <div class="sa-panel-card">
      ${MODULES.map(([h,n])=>`<div class="sa-row">${I.box}<span class="k">${n}</span><span class="v"><button type="button" class="sa-link" data-open-mod="${h}">${t('openMod')}</button></span></div>`).join('')}
    </div>
    <p class="sa-note">${t('modulesNote')}</p>`;
  }else if(setTab==='integ'){
    const wh=whList();
    main=`<h3>${t('setNavInteg')}</h3><p class="sa-set-desc">${t('setNavIntegDesc')}</p>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('whTitle')}</b><p class="sa-pc-sub">${t('integNote')}</p>
      ${wh.length?wh.map((w,i)=>`<div class="sa-row"><span class="k sa-wh-url">${esc(w.url)}</span><span class="v"><span class="sa-seg2"><button type="button" data-wh-tog="${i}" data-toggle="on" class="${w.on?'on':''}">${t('kOn')}</button><button type="button" data-wh-tog="${i}" data-toggle="off" class="${w.on?'':'on'}">${t('kOff')}</button></span><button type="button" class="sa-link" data-wh-del="${i}">✕</button></span></div>`).join(''):`<p class="sa-pc-sub">${t('whNone')}</p>`}
      <div class="sa-wh-add"><input class="sa-input" data-wh-url type="url" placeholder="${t('whPh')}" spellcheck="false">
        <button type="button" class="sa-btn sa-btn-sm" data-wh-add>${t('whAdd')}</button></div>
    </div>
    <div class="sa-panel-card"><div class="sa-row">${I.activity}<span class="k">${t('kNotify')}</span><span class="v">${onOffSeg('data-notify',LS.get('omniformos.notify','on'))}</span></div>
      <p class="sa-pc-sub">${t('notifyNote')}</p></div>`;
  }else if(setTab==='desktop'){
    const dp=LS.get('omniformos.desktop',{});
    main=`<h3>${t('setNavDesktop')}</h3><p class="sa-set-desc">${t('setNavDesktopDesc')}</p>
    <div class="sa-panel-card">
      <div class="sa-row">${I.monitor}<span class="k">${t('openAtLogin')}</span><span class="v"><span class="sa-seg2"><button type="button" data-dpref="openAtLogin" data-toggle="on" class="${dp.openAtLogin!=='off'?'on':''}">${t('kOn')}</button><button type="button" data-dpref="openAtLogin" data-toggle="off" class="${dp.openAtLogin==='off'?'on':''}">${t('kOff')}</button></span></span></div>
      <div class="sa-row">${I.box}<span class="k">${t('closeToTray')}</span><span class="v"><span class="sa-seg2"><button type="button" data-dpref="closeToTray" data-toggle="on" class="${dp.closeToTray!=='off'?'on':''}">${t('kOn')}</button><button type="button" data-dpref="closeToTray" data-toggle="off" class="${dp.closeToTray==='off'?'on':''}">${t('kOff')}</button></span></span></div>
    </div>
    <p class="sa-note">${t('desktopNote')}</p>
    <div class="sa-panel-card">
      <div class="sa-pc-head"><div><b>${t('svcStatus')}</b></div>
        <button type="button" class="sa-btn-ghost" data-svc-check>${t('svcCheck')}</button></div>
      <p class="sa-pc-line" data-svc><span class="sa-badge unverified">${t('stLoading')}</span></p>
    </div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('logTitle')}</b><p class="sa-pc-sub">${t('logDesc')}</p></div>`;
  }else if(setTab==='diag'){
    main=`<h3>${t('setNavDiag')}</h3><p class="sa-set-desc">${t('setNavDiagDesc')}</p>
    <div class="sa-panel-card">
      <div class="sa-pc-head"><div><b>${t('svcStatus')}</b></div>
        <button type="button" class="sa-btn-ghost" data-svc-check>${t('svcCheck')}</button></div>
      <p class="sa-pc-line" data-svc><span class="sa-badge unverified">${t('stLoading')}</span></p>
    </div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('kAI')}</b>
      <p class="sa-pc-line">${st?`<span class="sa-badge ${st.configured?'':'unverified'}">${st.configured?t('stOk'):t('stNo')}</span> <b>${esc(st.model||'—')}</b>${st.keyMasked?`<span class="sa-muted-text">${esc(st.keyMasked)}</span>`:''}`:t('stLoading')}</p>
      <p class="sa-pc-sub">${st?esc(st.baseUrl||'—'):''}</p></div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('logTitle')}</b><p class="sa-pc-sub">${t('logDesc')}</p></div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('diagBtn')}</b>
      <button type="button" class="sa-btn sa-btn-sm" data-diag>${t('diagBtn')}</button>
      <p class="sa-ai-status" data-diag-status role="status"></p></div>`;
  }else{
    main=`<h3>${t('setNavAbout')}</h3><p class="sa-set-desc">${t('setNavAboutDesc')}</p>
    <div class="sa-panel-card"><div class="sa-row"><span class="k">${t('verTitle')}</span><span class="v">OmniFormOS · v1.1.0</span></div>
      <div class="sa-pc-head" style="margin-top:12px"><div></div>
        <button type="button" class="sa-btn-ghost" data-check-upd>${t('checkUpd')}</button></div>
      <p class="sa-ai-status" data-upd-status role="status"></p></div>
    <div class="sa-panel-card"><b class="sa-pc-title">${t('changelog')}</b><p class="sa-pc-sub">${t('changelogText')}</p></div>
    <div class="sa-panel-card">
      <div class="sa-row">${I.info}<span class="k">${t('docsLink')}</span><span class="v"><button type="button" class="sa-link" data-open-mod="#landing">${t('openMod')}</button></span></div>
      <div class="sa-row">${I.mail}<span class="k">${t('fbLink')}</span><span class="v"><a class="sa-link" href="mailto:feedback@omniformos.app">Email</a></span></div>
    </div>`;
  }
  return `<div class="sa-set">
    <aside class="sa-set-nav">
      <h2>${t('settings')}</h2><p class="sa-set-sub">${t('setSub')}</p>
      ${SET_TABS.map(item).join('')}
    </aside>
    <section class="sa-set-main">${main}</section>
    <button type="button" class="sa-set-close" data-close-settings aria-label="Close">✕</button>
  </div>`;
};
function render(view,opts={}){
  state.view=view;
  const fn=VIEWS[view];if(!fn)return;
  card.innerHTML=fn(opts.err,opts.ok);
  card.classList.remove('sa-swap');void card.offsetWidth;card.classList.add('sa-swap');
  const first=card.querySelector('.sa-input:not([type=hidden]),.sa-code input');
  if(!opts.noFocus)setTimeout(()=>first?.focus(),80);
}
function renderSettings(){
  if(setCard)setCard.innerHTML=VIEWS.settings();
  runTabAsync();
}

// =====================================================================
// Interactions
// =====================================================================
function fieldErr(input,msg){
  if(input){input.classList.add('sa-invalid');input.addEventListener('input',()=>input.classList.remove('sa-invalid'),{once:true});}
  const old=card.querySelector('.sa-err');if(old)old.remove();
  card.insertAdjacentHTML('beforeend',`<p class="sa-err" role="alert"><span>${msg}</span></p>`);
}
function valErr(form,name){
  const input=form.querySelector(`[name="${name}"]`);const v=String(input?.value||'').trim();
  if(name==='email'&&!v)return[fieldErr(input,t('eEmailReq')),null];
  if(name==='email'&&!emailOk(v))return[fieldErr(input,t('eEmailFmt')),null];
  if(name==='password'&&!v)return[fieldErr(input,t('ePassReq')),null];
  if(name==='password'&&v.length<8)return[fieldErr(input,t('ePassShort')),null];
  return[null,v];
}
function beginVerify(email){
  state.email=email;state.verifyCode=makeCode();state.verifyExpire=Date.now()+10*60*1000;state.resendAt=Date.now()+60*1000;
  const u=users();u[email]=u[email]||{createdAt:Date.now()};u[email].verify={code:state.verifyCode,expire:state.verifyExpire};saveUsers(u);
  render('verify');
}
function resend(){
  state.verifyCode=makeCode();state.verifyExpire=Date.now()+10*60*1000;state.resendAt=Date.now()+60*1000;
  const u=users();if(u[state.email])u[state.email].verify={code:state.verifyCode,expire:state.verifyExpire};saveUsers(u);
  render('verify');
}
function finishSignIn(email){
  setSession(email);syncAcct(email);emitChanged();
  render('me');
}
function signOut(){
  setSession('');syncAcct('');emitChanged();
  closeAccountCenter();openAuth();
}
async function saveAvatar(file){
  if(!file||!file.type.startsWith('image/')||file.size>8*1024*1024)return false;
  const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=src;});
  const size=256,c=document.createElement('canvas');c.width=size;c.height=size;const g=c.getContext('2d');
  const side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
  g.drawImage(img,sx,sy,side,side,0,0,size,size);
  const data=c.toDataURL('image/jpeg',.86),all=users(),email=getSession();if(!all[email])return false;
  all[email].avatar=data;saveUsers(all);emitChanged();renderAccountDrawer();return true;
}
function renderAccountDrawer(){if(accountPanel)accountPanel.innerHTML=VIEWS.me();}
function openAccountDrawer(){ensureMasks();renderAccountDrawer();accountDrawer.hidden=false;requestAnimationFrame(()=>accountDrawer.classList.add('open'));}
function closeAccountCenter(){if(accountDrawer){accountDrawer.classList.remove('open');setTimeout(()=>{if(!accountDrawer.classList.contains('open'))accountDrawer.hidden=true;},220);}}
function setTheme(mode){
  const resolved=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;
  try{localStorage.setItem('omniformos.theme',mode);localStorage.setItem('omniformos.theme.resolved',resolved);}catch{}
  if(document.documentElement.dataset.theme!==resolved){
    document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;
    window.dispatchEvent(new CustomEvent('omni-theme-changed',{detail:resolved}));
  }
  if(accountDrawer&&!accountDrawer.hidden)renderAccountDrawer();
  else if(setMask&&!setMask.hidden)renderSettings();
  else if(mask&&!mask.hidden&&state.view==='me')render('me');
}
function setLang(lang){
  setLangPref(lang);
  if(accountDrawer&&!accountDrawer.hidden)renderAccountDrawer();
  else if(setMask&&!setMask.hidden)renderSettings();
  else if(mask&&!mask.hidden)render(state.view);
}

function bindCard(root,onClose){
  root.addEventListener('click',async event=>{
    const eye=event.target.closest('[data-eye]');
    if(eye){const input=eye.parentElement.querySelector('input');const show=input.type==='password';
      input.type=show?'text':'password';eye.innerHTML=show?I.eyeOff:I.eye;eye.setAttribute('aria-pressed',String(show));input.focus();return;}
    const go=event.target.closest('[data-go]');
    if(go){
      const to=go.dataset.go==='reset-direct'?'reset':go.dataset.go;
      if(to==='forgot'){state.forgotSent=false;state.lastForgotEmail='';state.resetCode='';}
      state.email=card.querySelector('input[name=email]')?.value?.trim()||state.email;render(to,{noFocus:false});return;}
    if(event.target.closest('[data-terms]')){fieldErr(null,t('termsNote'));return;}
    if(event.target.closest('[data-resend]')){resend();return;}
    if(event.target.closest('[data-autofill]')){const boxes=card.querySelectorAll('.sa-code input');state.verifyCode.split('').forEach((c,i)=>boxes[i]&&(boxes[i].value=c));card.querySelector('[data-form=verify]')?.requestSubmit();return;}
    if(event.target.closest('[data-resetgo]')){render('reset');return;}
    if(event.target.closest('[data-reverify]')){beginVerify(getSession());return;}
    if(event.target.closest('[data-signout]')){signOut();return;}
    if(event.target.closest('[data-close-account]')){closeAccountCenter();return;}
    if(event.target.closest('[data-avatar-pick]')){root.querySelector('[data-avatar-file]')?.click();return;}
    if(event.target.closest('[data-avatar-remove]')){const all=users(),email=getSession();if(all[email]){delete all[email].avatar;saveUsers(all);emitChanged();renderAccountDrawer();}return;}
    const copy=event.target.closest('[data-copy-email]');if(copy){try{await navigator.clipboard.writeText(getSession());copy.textContent=t('copied');setTimeout(()=>{if(copy.isConnected)copy.textContent=t('copyEmail');},1400);}catch{}return;}
    if(event.target.closest('[data-export-profile]')){const email=getSession(),u=users()[email]||{};const safe={displayName:u.displayName||'',email,verified:!!u.verified,bio:u.bio||'',memberSince:u.createdAt||null,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(safe,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='OmniFormOS-profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return;}
    const seg=event.target.closest('[data-settheme]');
    if(seg){setTheme(seg.dataset.settheme);return;}
    const lang=event.target.closest('[data-setlang]');
    if(lang){setLang(lang.dataset.setlang);return;}
    if(event.target.closest('[data-open-data]')){window.omniDesktop?.openSettings?.();return;}
    const tab=event.target.closest('[data-set-tab]');
    if(tab){setTab=tab.dataset.setTab;renderSettings();return;}
    if(event.target.closest('[data-ai-refresh]')){const b=event.target.closest('[data-ai-refresh]');if(b)b.disabled=true;loadAiInfo().then(()=>{if(setMask&&!setMask.hidden)renderSettings();});return;}
    const aiChip=event.target.closest('[data-ai-provider]');
    if(aiChip){
      const p=AI_PRESETS[aiChip.dataset.aiProvider]||AI_PRESETS.custom;
      const base=root.querySelector('[data-ai-base]'),model=root.querySelector('[data-ai-model]');
      if(p.baseUrl){if(base)base.value=p.baseUrl;if(model)model.value=p.model;}
      root.querySelectorAll('[data-ai-provider]').forEach(c=>c.classList.toggle('on',c===aiChip));
      base?.focus();
      return;
    }
    if(event.target.closest('[data-ai-save]')){saveAiConfig(root);return;}
    if(event.target.closest('[data-ai-test]')){testAi(root);return;}
    if(event.target.closest('[data-assign-save]')){const map={};root.querySelectorAll('[data-assign]').forEach(x=>{if(x.value.trim())map[x.dataset.assign]=x.value.trim();});LS.set('omniformos.modelAssign',map);flashStatus(root,'[data-assign-status]',t('aiSaved'),true);return;}
    if(event.target.closest('[data-backup]')){doBackup(root);return;}
    if(event.target.closest('[data-diag]')){exportDiag(root);return;}
    if(event.target.closest('[data-svc-check]')){runTabAsync();return;}
    if(event.target.closest('[data-check-upd]')){flashStatus(root,'[data-upd-status]',t('verOk'),true);return;}
    if(event.target.closest('[data-reverify2]')){closeSettings();openAuth();beginVerify(getSession());return;}
    const fm=event.target.closest('[data-font]');if(fm){const v=fm.dataset.font;localStorage.setItem('omniformos.fontScale',v);document.documentElement.style.fontSize=(16*parseFloat(v))+'px';renderSettings();return;}
    const am=event.target.closest('[data-anim]');if(am){localStorage.setItem('omniformos.anim',am.dataset.anim);document.documentElement.classList.toggle('omni-no-anim',am.dataset.anim==='off');renderSettings();return;}
    const nm=event.target.closest('[data-notify]');if(nm){LS.set('omniformos.notify',nm.dataset.notify);renderSettings();return;}
    const dp=event.target.closest('[data-dpref]');if(dp){const v=LS.get('omniformos.desktop',{});v[dp.dataset.dpref]=dp.dataset.toggle;LS.set('omniformos.desktop',v);renderSettings();return;}
    const wh=event.target.closest('[data-wh-tog]');if(wh){const v=whList(),i=Number(wh.dataset.whTog);v[i].on=wh.dataset.toggle==='on';LS.set('omniformos.webhooks',v);renderSettings();return;}
    const wd=event.target.closest('[data-wh-del]');if(wd){const v=whList();v.splice(Number(wd.dataset.whDel),1);LS.set('omniformos.webhooks',v);renderSettings();return;}
    if(event.target.closest('[data-wh-add]')){const x=root.querySelector('[data-wh-url]'),url=x?.value.trim();if(url&&/^https?:\/\//.test(url)){const v=whList();v.push({url,on:true});LS.set('omniformos.webhooks',v);renderSettings();}return;}
    const om=event.target.closest('[data-open-mod]');if(om){location.hash=om.dataset.openMod;closeSettings();return;}
    if(onClose&&event.target.closest('[data-close-settings]')){onClose();return;}
  });
  // verification code boxes: auto-advance / backspace
  root.addEventListener('change',async event=>{
    if(event.target.matches('[data-avatar-file]')){const ok=await saveAvatar(event.target.files?.[0]);if(!ok)alert(t('avatarBad'));return;}
    if(event.target.matches('[data-startup]')){localStorage.setItem('omniformos.startup',event.target.value);return;}
    if(event.target.matches('[data-wsname]')){LS.set('omniformos.workspaceName',event.target.value.trim());return;}
  });
  root.addEventListener('input',event=>{
    if(event.target.matches('[name=bio]')){const c=root.querySelector('.sa-char-count');if(c)c.textContent=`${event.target.value.length}/120`;}
    const box=event.target.closest('.sa-code input');
    if(box){box.value=box.value.replace(/\D/g,'').slice(0,1);
      if(box.value)box.nextElementSibling?.focus();
      if([...card.querySelectorAll('.sa-code input')].every(b=>b.value))card.querySelector('[data-form=verify] [type=submit]')?.click();
      return;}
    const pass=event.target.closest('input[name=password]');
    if(pass&&pass.closest('[data-form=signup],[data-form=reset]')){
      const st=pass.closest('.sa-field').querySelector('.sa-strength');
      if(st)st.outerHTML=strengthHTML(pass.value);
      else pass.closest('.sa-field').insertAdjacentHTML('beforeend',strengthHTML(pass.value));
    }
  });
  root.addEventListener('keydown',event=>{
    const box=event.target.closest('.sa-code input');
    if(box&&event.key==='Backspace'&&!box.value)box.previousElementSibling?.focus();
  });
  // form submits
  root.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.target;if(!form.dataset.form)return;
    const kind=form.dataset.form;
    const submit=form.querySelector('[type=submit]');
    if(submit){submit.disabled=true;submit.innerHTML='<span class="sa-spin"></span>';}
    try{await handle(kind,form);}catch{fieldErr(null,t('eNetwork'));}
    finally{busy=false;}
  });
}
let busy=false;
async function handle(kind,form){
  if(kind==='profile'){
    const email=getSession(),all=users(),u=all[email];
    const name=String(form.querySelector('[name=displayName]')?.value||'').trim(),bio=String(form.querySelector('[name=bio]')?.value||'').trim();
    const status=form.querySelector('[data-profile-status]'),button=form.querySelector('[type=submit]');
    if(name&&(name.length<2||name.length>30)){if(status){status.textContent=t('profileInvalid');status.className='sa-ai-status err';}if(button){button.disabled=false;button.textContent=t('saveProfile');}return;}
    if(u){if(name)u.displayName=name;else delete u.displayName;if(bio)u.bio=bio;else delete u.bio;saveUsers(all);emitChanged();}
    renderAccountDrawer();const fresh=accountPanel?.querySelector('[data-profile-status]');if(fresh){fresh.textContent=t('profileSaved');fresh.className='sa-ai-status ok';}
    return;
  }
  if(kind==='chpass'){
    const email=getSession(),all=users(),u=all[email];
    const cur=String(form.querySelector('[name=cur]')?.value||''),pass=String(form.querySelector('[name=password]')?.value||''),confirm=String(form.querySelector('[name=confirm]')?.value||'');
    const status=form.querySelector('[data-chpass-status]');
    const fail=msg=>{if(status){status.textContent=msg;status.className='sa-ai-status err';}const b=form.querySelector('[type=submit]');if(b){b.disabled=false;b.textContent=t('chBtn');}};
    if(!u||await hashPass(cur,u.salt)!==u.hash){fail(t('eCred'));return;}
    if(pass.length<8){fail(t('ePassShort'));return;}
    if(pass!==confirm){fail(t('ePassMatch'));return;}
    u.salt=makeSalt();u.hash=await hashPass(pass,u.salt);saveUsers(all);form.reset();
    if(status){status.textContent=t('chOk');status.className='sa-ai-status ok';}
    const b=form.querySelector('[type=submit]');if(b){b.disabled=false;b.textContent=t('chBtn');}return;
  }
  if(kind==='signin'){
    const [e1,email]=valErr(form,'email');if(e1)return;
    const [e2,pass]=valErr(form,'password');if(e2)return;
    const u=users()[email];
    if(!u||await hashPass(pass,u.salt)!==u.hash){fieldErr(form.querySelector('[name=email]'),t('eCred'));return;}
    if(!u.verified){state.email=email;const v=u.verify||{};state.verifyCode=v.code||makeCode();state.verifyExpire=v.expire||Date.now()+10*60*1000;state.resendAt=Date.now()+60*1000;
      u[email].verify={code:state.verifyCode,expire:state.verifyExpire};saveUsers(u);
      fieldErr(form.querySelector('[name=password]'),t('eVerifyPending'));setTimeout(()=>render('verify'),900);return;}
    state.email=email;finishSignIn(email);return;
  }
  if(kind==='signup'){
    const [e1,email]=valErr(form,'email');if(e1)return;
    const [e2,pass]=valErr(form,'password');if(e2)return;
    const confirm=String(form.querySelector('[name=confirm]').value);
    if(pass!==confirm){fieldErr(form.querySelector('[name=confirm]'),t('ePassMatch'));return;}
    const u=users();
    if(u[email]){fieldErr(form.querySelector('[name=email]'),t('eExists'));return;}
    const salt=makeSalt();
    u[email]={email,salt,hash:await hashPass(pass,salt),verified:false,createdAt:Date.now()};saveUsers(u);
    beginVerify(email);return;
  }
  if(kind==='verify'){
    const code=[...form.querySelectorAll('.sa-code input')].map(b=>b.value).join('');
    if(code.length<6){form.querySelectorAll('.sa-code input').forEach(b=>b.classList.add('sa-invalid'));fieldErr(form,t('eCode6'));return;}
    const u=users();const rec=u[state.email];
    if(!rec||!rec.verify||rec.verify.code!==code){form.querySelectorAll('.sa-code input').forEach(b=>{b.classList.add('sa-invalid');b.value='';});form.querySelector('.sa-code input')?.focus();fieldErr(form,t('eCodeBad'));return;}
    if(Date.now()>rec.verify.expire){fieldErr(form,t('eCodeExp'));return;}
    rec.verified=true;delete rec.verify;saveUsers(u);
    finishSignIn(state.email);return;
  }
  if(kind==='forgot'){
    const [e1,email]=valErr(form,'email');if(e1)return;
    state.email=email;state.forgotSent=true;state.lastForgotEmail=email;
    const u=users();
    if(u[email]){state.resetCode=makeCode();state.resetExpire=Date.now()+10*60*1000;u[email].reset={code:state.resetCode,expire:state.resetExpire};saveUsers(u);}
    else state.resetCode='';
    render('forgot',{noFocus:true});
    return;
  }
  if(kind==='reset'){
    const code=String(form.querySelector('[name=code]').value).trim();
    const [e2,pass]=valErr(form,'password');if(e2)return;
    const confirm=String(form.querySelector('[name=confirm]').value);
    if(pass!==confirm){fieldErr(form.querySelector('[name=confirm]'),t('ePassMatch'));return;}
    const u=users();const rec=u[state.email];
    if(!rec||!rec.reset||rec.reset.code!==code){fieldErr(form.querySelector('[name=code]'),t('eResetBad'));return;}
    if(Date.now()>rec.reset.expire){fieldErr(form.querySelector('[name=code]'),t('eResetExp'));return;}
    rec.salt=makeSalt();rec.hash=await hashPass(pass,rec.salt);delete rec.reset;saveUsers(u);
    render('signin',{ok:t('pwUpdated')});
    return;
  }
}

// =====================================================================
// Masks
// =====================================================================
function ensureMasks(){
  if(!mask){
    mask=document.createElement('div');mask.className='sa-mask';mask.hidden=true;
    card=document.createElement('div');card.className='sa-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
    mask.appendChild(card);bindCard(card);
    mask.addEventListener('mousedown',e=>{if(e.target===mask)closeAuth();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(accountDrawer&&!accountDrawer.hidden)closeAccountCenter();else if(setMask&&!setMask.hidden)closeSettings();else if(mask&&!mask.hidden)closeAuth();}});
  }
  if(!setMask){
    setMask=document.createElement('div');setMask.className='sa-mask';setMask.hidden=true;
    setCard=document.createElement('div');setCard.className='sa-card sa-card-xl';setCard.setAttribute('role','dialog');setCard.setAttribute('aria-modal','true');
    setMask.appendChild(setCard);bindCard(setCard,closeSettings);
    setMask.addEventListener('mousedown',e=>{if(e.target===setMask)closeSettings();});
  }
  if(!accountDrawer){
    accountDrawer=document.createElement('div');accountDrawer.className='sa-account-drawer';accountDrawer.hidden=true;
    accountPanel=document.createElement('aside');accountPanel.className='sa-account-panel';accountPanel.setAttribute('role','dialog');accountPanel.setAttribute('aria-label',t('meTitle'));
    accountDrawer.appendChild(accountPanel);bindCard(accountPanel,closeAccountCenter);
    accountDrawer.addEventListener('mousedown',e=>{if(e.target===accountDrawer)closeAccountCenter();});
  }
  if(!mask.isConnected)document.body.appendChild(mask);
  if(!setMask.isConnected)document.body.appendChild(setMask);
  if(!accountDrawer.isConnected)document.body.appendChild(accountDrawer);
}
// =====================================================================
// Public API
// =====================================================================
export const authAccount=()=>getSession();
export const getLangPref=getLang;
export function openAuth(){
  ensureMasks();
  if(getSession())render('me');else render('signin');
  mask.hidden=false;
}
export function closeAuth(){if(mask)mask.hidden=true;}
export function openAccountCenter(){if(getSession())openAccountDrawer();else openAuth();}
export function openSettings(){
  ensureMasks();
  renderSettings();
  setMask.hidden=false;
  loadAiInfo().then(()=>{if(setMask&&!setMask.hidden)renderSettings();});
}
export function closeSettings(){if(setMask)setMask.hidden=true;}
