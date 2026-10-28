# OmniFormOS Windows 桌面版 1.0.0

## 使用

安装包：`output/desktop/OmniFormOS-Desktop-1.0.0-x64-Setup.exe`。安装后使用桌面或开始菜单的 **OmniFormOS** 快捷方式。

无需安装 Node.js 或先开启网页服务器。程序内置 Electron、Node.js 24 和八模块资源，自动启动仅监听本机的 3102 后台；关闭所有桌面窗口即退出并关闭自身后台。原网页 3100 服务独立运行，不受桌面版退出影响。

工作区菜单提供首页、数据库备份、备份恢复和数据目录；视图菜单提供刷新、缩放、全屏。导出文件使用原生保存窗口。应用支持单实例，重复打开会激活现有窗口。后台意外退出会尝试重启，恢复后提示刷新；启动失败显示原因与日志路径。

## 数据迁移

本机已从现有项目复制八个 SQLite 数据库到 `%APPDATA%/OmniFormOS Desktop/workspace`，原数据保留，并额外保存 `before-desktop-import.ofbackup`。

**这是一次性复制，此后网页与桌面版的数据分别保存，不自动同步。** 浏览器 localStorage 中未保存到后端的草稿、主题等不会自动迁移；应从原页面“导出工作空间备份”后通过相应恢复入口处理。

安装包本身不包含本机数据库、备份或模型密钥。复制安装包到其他电脑时使用新的独立工作区，需要的数据通过备份导入。

恢复始终写入新的目录，验证八模块数据库完整性后切换，不覆盖原目录。原生菜单数据库备份不含浏览器草稿；完整网页工作区备份仍使用页面内入口。

## AI 配置与日志

本机迁移配置可引用原项目 `.env`。全新工作区可在数据目录新建 `.env`，按 `.env.example` 设置 `OMNIFORM_AI_BASE_URL`、`OMNIFORM_AI_API_KEY`、`OMNIFORM_AI_MODEL` 后重启。基础编辑与本地数据管理无需模型接口；AI 请求需要网络和有效配置。

配置：`%APPDATA%/OmniFormOS Desktop/workspace.json`。
日志：`%APPDATA%/OmniFormOS Desktop/desktop-service.log`。
卸载保留用户数据目录；重新安装后继续读取已有配置。

## 验收与范围

- 238 项回归测试通过，包含新增工作区配置、路径验证和导航来源边界测试。
- 开发桌面窗口及打包后的 `OmniFormOS.exe` 均启动成功；打包程序从系统临时目录启动，使用包内 Node 运行后台，健康检查通过。
- 窗口配置实测：Node 集成关闭，contextIsolation 和 sandbox 开启；不加载远程页面到特权窗口。
- 新工作区用独立目录验证，不覆盖现有工作区。双次启动复用实例。
- Windows x64 NSIS 安装包生成成功；构建日志 `artifacts/desktop-installer.log`，测试日志 `artifacts/desktop-full-tests.txt`。
- 已安装至 `%LOCALAPPDATA%/Programs/OmniFormOS` 并生成桌面快捷方式；实际安装目录内置 Node 版本为 24.22.0，启动后 3102 健康检查通过，退出后自身后台关闭。
- 未配置代码签名证书，安装包未签名；尚无自动更新服务、云同步或跨电脑实时访问。
- 既有模块的在线 AI 能力仍需用户配置，未宣称本次完成在线模型实测。

## 开发与重新打包

`npm run desktop` 启动开发桌面窗口；`npm run desktop:build` 先构建前端，再生成 Windows 安装包。内置 Node 来自执行构建的 Node 24 路径，构建须在 Windows x64 环境完成。Electron 二进制下载后须通过官方 SHA256 校验。

桌面代码：`desktop/main.cjs`、`desktop/server-entry.mjs`、`desktop/workspace-config.cjs`、`desktop/data-task.mjs`。打包配置：`desktop/builder.cjs`。安装包只包含应用代码与运行依赖。
