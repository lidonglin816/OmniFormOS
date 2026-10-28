# OmniFormOS · Web 与 Windows 桌面工作区

包含 FormPilot、ExamCraft、FlowForm、DocMorph、AdaptForm、TableMind、LabForm 和 AppCanvas 八个模块。各模块具体范围见 docs 中对应的升级与验收说明；下方早期版本记录保留作为历史资料。

Windows 桌面版安装包：`output/desktop/OmniFormOS-Desktop-1.0.0-x64-Setup.exe`。内置运行环境，数据存放在用户目录。使用、迁移和限制见 [桌面版说明](docs/Windows桌面版使用与验收.md)。开发桌面窗口使用 `npm run desktop`，重新打包使用 `npm run desktop:build`。

## ⚡ 10 分钟极速复现指南

**第 1 步（2 分钟）环境准备**

- 安装 [Node.js 24+](https://nodejs.org/)（桌面端建议 22+，网页端 24+）
- 克隆本仓库：`git clone <仓库地址>` 后进入项目目录

**第 2 步（3 分钟）安装依赖**

```powershell
npm install        # 依赖清单见 package.json，全本地安装，无需全局工具
npm run build      # 预构建画布资产（仓库已含预构建产物，仅在改动 React Flow 源码时需要）
```

**第 3 步（2 分钟）环境变量（可选）**

```powershell
copy .env.example .env
```

- `.env` 中填入 `OMNIFORM_AI_BASE_URL` / `OMNIFORM_AI_API_KEY` / `OMNIFORM_AI_MODEL`（OpenAI 兼容接口）
- **不配置也能运行全部核心功能**，AI 出题等能力会以本地规则引擎降级并明确提示

**第 4 步（1 分钟）启动**

```powershell
npm run dev        # 网页端 http://127.0.0.1:3100（旧版 3000）
npm run desktop    # 或启动 Windows 桌面壳（Electron）
```

**第 5 步（2 分钟）验证**

```powershell
npm run check      # 全量语法检查
npm test           # 单元测试
```

浏览器打开工作台，输入"创建校园竞赛管理系统"生成第一个应用，或进入 `#exam` 体验 AI 出题。完整体验流程见下方"体验流程"章节。

> 常见问题：端口被占用改 `PORT` 环境变量；浏览器数据清理会删除 localStorage 原型数据，正式数据使用桌面版 SQLite 工作区。



网页工作区双击 `Start-OmniForm.cmd`，使用 `http://127.0.0.1:3100`；桌面版使用独立的 3102 服务和数据目录。

## DocMorph v0.5

入口：`http://127.0.0.1:3000/#docmorph`。

实际支持 PDF、DOCX、XLSX、扫描图片和 TXT 导入；PDF 原件预览、本地中英文 OCR、左右对照、来源定位、字段/选项/限制校正、人工复核及送入表单设计器。原件保存在 IndexedDB，定义存入工作空间；转出的表单可实际提交记录，并继续执行字段限制。

规则识别和 OCR 需要人工核对，旧 DOC / XLS 与专用手写识别未实现。支持范围、文件限制、原件备份及数据说明见 [DocMorph 文档](docs/DOCMORPH.md)。

## FlowForm v0.4

入口：`http://127.0.0.1:3000/#flowform`。

支持报销/请假规则生成、实际 React Flow 画布、节点/分支/审批人编辑、图结构校验、本地发布、申请发起、串行审批、驳回和撤回、时间轴、本地通知、审计导出和模拟执行。实例使用独立流程快照，改版不会影响在途申请。

真实 AI、正式账号权限、外部通知、并行会签和服务端执行尚未实现。使用说明和构建方式见 [FlowForm 文档](docs/FLOWFORM.md)。

## ExamCraft v0.3

入口：`http://127.0.0.1:3000/#exam`。

支持 TXT 大纲及 JSON 题库导入、四类题型的本地模板生成、题库编辑与即时预览、试卷拖动/按钮排序、题型与分值配置、本地发布、答题保存、客观题自动评分、简答题关键词建议及人工确认、覆盖分析、成绩看板和 FormPilot 应用内嵌入口。

首次初始化带 12 道标注来源的示例题，不预置试卷或成绩。真实 AI、身份隔离、强制限时收卷、公开部署均未实现。详细格式、评分规则和数据边界见 [ExamCraft 文档](docs/EXAMCRAFT.md)。

## FormPilot v0.2

默认首页为 FormPilot；也可以直接打开 http://127.0.0.1:3000/#pilot 。

1. 输入业务需求，或选择客户、报销、库存、项目示例。
2. 生成多实体应用蓝图，查看字段、实体关联、角色操作配置和页面结构。
3. 在蓝图中添加实体、编辑字段及权限设计；新增实体自动配套列表、表单和详情页面。
4. 点击「预览应用」，在业务页面中新增、搜索、编辑、查看详情和删除记录。关联字段从目标实体的记录中选择；被引用记录不能直接删除。
5. 使用「添加字段：预算，类型：数字，必填」「新增实体：合同」「新增角色：经理」「应用名称改为我的系统」等明确指令迭代。已有数据和字段 ID 保留。
6. 查看 Schema 或导出应用蓝图 JSON；全工作空间备份仍从右上角导出。应用蓝图不含业务记录，工作空间备份包含记录。

生成使用本地领域模板和规则，不提供任意自然语言理解。客户模板会建议客户、联系人、商机；其他模板也有各自预设结构，需人工检查。可用「角色：管理员、销售、查看者」及「应用名称：我的系统」明确指定角色和名称。角色操作配置不执行认证或访问限制。

蓝图和业务数据使用 localStorage；当前项目、页签和选中实体使用 sessionStorage 恢复。没有独立部署生成应用、真实模型调用或后台 API。

## 启动

需要 Node.js 20 或以上。仓库包含画布预构建资产，可直接启动。修改 React Flow 画布源文件时，先执行 `npm install` 和 `npm run build`。

```powershell
npm run dev
```

浏览器打开 http://127.0.0.1:3000 。服务仅监听本机。可通过 `PORT` 环境变量修改端口。

```powershell
npm run check
npm test
```

## 体验流程

1. 工作台选择模板，或输入需求点击「生成应用」。
2. 进入表单设计，添加或编辑字段；修改布局可使用「页面搭建」。
3. 填写预览表单，提交后自动进入数据管理。
4. 搜索记录，进入工作流点击「模拟运行」，最新记录将校验并标记为待处理。
5. 刷新页面查看本地数据保留；右上角下载按钮可导出工作空间 JSON 备份。

## 当前能力与限制

- 应用、字段、记录、布局、模拟步骤和演示成员保存在浏览器 localStorage，使用同一浏览器、同一地址和端口访问。
- 应用生成基于本地关键词和模板规则；没有接入真实 AI。
- 工作流只校验最新记录并更新本地状态；步骤名称可修改，执行逻辑固定。
- 连接器为规划目录；权限页为角色配置演示，不提供认证或安全控制。
- 预置应用没有业务记录，统计来自实际本地状态。
- 提供 JSON 导出；当前未实现导入恢复。清理浏览器数据会删除原型内容。
- 不包含服务端数据库、多用户同步、正式审批、部署和真实第三方服务。

产品建议和后续里程碑见 `PROJECT_PLAN.md`。

## 文件

- `server.mjs`：本地静态服务。
- `public/index.html`、`public/style.css`：应用外壳与响应式样式。
- `public/app.js`：页面交互、数据保存和导航。
- `public/model.js`：应用模板及字段校验。
- `tests/model.test.mjs`：核心数据逻辑测试。
# OmniFormOS 六模块本地原型

当前已完成 FormPilot、ExamCraft、FlowForm、DocMorph、AdaptForm、TableMind、LabForm 与 AppCanvas 八个交互模块。运行 `npm run dev` 后访问 `http://127.0.0.1:3000`。

模块说明： [AdaptForm](docs/ADAPTFORM.md) · [TableMind](docs/TABLEMIND.md) · [LabForm](docs/LABFORM.md) · [AppCanvas](docs/APPCANVAS.md)



## ExamCraft 专业测评升级

ExamCraft 已新增 SQLite 服务端持久化、教师登录、受控学生考试入口与 ECharts 分析。要求 Node.js 24+。首次进入 #exam 设置教师密码后，原浏览器测评数据自动迁移。AI 服务须通过本地 .env 配置，未配置时明确提示，详情见 [升级说明](docs/EXAMCRAFT-UPGRADE.md)。
