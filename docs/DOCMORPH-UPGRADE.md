# DocMorph 升级说明

DocMorph 现在按“文档工作台 → 文档解析 → 字段审核 → 数字表单设计 → 发布与数据”运行。

- 原件和 OCR 在浏览器本地处理，支持 PDF、DOCX、XLSX、图片和文本。
- 字段保留原文片段、页码、行号或单元格来源，AI 只产生候选结果，人工确认后才生效。
- 数字表单支持拖拽排序、多步骤、字段类型、必填、默认值、占位符、长度、范围、正则、选项和条件显示。
- 发布生成真实公开链接，提交记录和表单版本保存在 `data/docmorph.sqlite`，支持停用、回滚、搜索和 CSV 导出。
- 统一文档 ID、表单 ID、字段 Schema 和来源信息可传递到 FormPilot、AdaptForm、FlowForm、TableMind、LabForm 和 AppCanvas。ExamCraft 可直接读取 DocMorph 文档作为试题来源。

AI 服务使用 `OMNIFORM_AI_BASE_URL`、`OMNIFORM_AI_API_KEY` 和 `OMNIFORM_AI_MODEL`。未配置时界面会明确提示，不返回伪造结果。

验收命令：

```powershell
npm run check
npm test
npm run build
```
