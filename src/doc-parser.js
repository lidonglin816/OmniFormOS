import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth/mammoth.browser.js';
import ExcelJS from 'exceljs';
import { createWorker } from 'tesseract.js';
import {verifyDocumentBytes} from '../public/docmorph-file-validation.js';
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/docmorph/pdf.worker.min.mjs';
const uid = () => crypto.randomUUID();
const viewportRect=(viewport,r)=>{const [a,b,c,d,e,f]=viewport.transform;return [a*r[0]+c*r[1]+e,b*r[0]+d*r[1]+f,a*r[2]+c*r[3]+e,b*r[2]+d*r[3]+f];};
function lines(text, page = 1, prefix = '') { return text.split(/\r?\n/).map((t, i) => ({ id: uid(), text: t.trim(), page, line: i + 1, location: `${prefix ? prefix + ' · ' : ''}第 ${i + 1} 行` })).filter(s => s.text); }
function cellText(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return value.richText ? value.richText.map(t => t.text).join('') : value.text || String(value.result ?? '');
  return String(value);
}
export async function openPDF(blob) {
  return pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, cMapUrl: '/vendor/docmorph/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/docmorph/standard_fonts/', wasmUrl: '/vendor/docmorph/wasm/', useWorkerFetch: true }).promise;
}
export async function parseFile(file, progress = () => {}) {
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error('文件需为 1 字节到 15 MB');
  verifyDocumentBytes(file.name,new Uint8Array(await file.arrayBuffer()));
  const extension = file.name.split('.').at(-1).toLowerCase(); progress('正在读取文档…');
  if (extension === 'txt') return { kind: 'text', segments: lines(await file.text()), warnings: [] };
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { kind: 'word', segments: lines(result.value), warnings: ['Word 展示提取原文，不还原分页和原始版式。', ...result.messages.map(m => m.message).slice(0, 5)] };
  }
  if (extension === 'xlsx') {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer()); const segments = [],tables=[];
    if (workbook.worksheets.length > 12) throw new Error('最多支持 12 个工作表，请拆分后导入');
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount > 2000 || sheet.columnCount > 100) throw new Error('工作表最多 2000 行、100 列，请缩小导入范围');
      const table={sheet:sheet.name,rows:sheet.rowCount,columns:sheet.columnCount,cells:[]};sheet.eachRow(row=>row.eachCell(cell=>{if(cell.isMerged&&cell.master.address!==cell.address)return;const text=cellText(cell);if(text)table.cells.push({row:row.number,column:cell.col,address:cell.address,text});}));tables.push(table);
      sheet.eachRow(row => {
        const cells = []; row.eachCell(cell => { if (cell.isMerged && cell.master.address !== cell.address) return; const text = cellText(cell).trim(); if (text) cells.push({ text, address: cell.address }); });
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i]; let text = c.text;
          if (/^(字段|字段名称|项目|表头)$/i.test(text)) continue;
          if (cells.length >= 2 && i === 0 && !/[：:]/.test(text) && text.length < 35) text = `${text}：${cells.slice(1).map(c => c.text).join(' / ')}`;
          segments.push({ id: uid(), text, page: 1, sheet: sheet.name, cell: c.address, line: row.number, location: `${sheet.name}!${c.address}` });
          if (i === 0 && cells.length >= 2 && text !== c.text) break;
        }
      });
    }
    return { kind: 'excel', segments,tables, warnings: ['Excel 以工作表 / 单元格原文展示，公式只读取缓存结果，不执行公式；复杂合并表格请人工校对。'] };
  }
  if (extension === 'pdf') {
    const pdf = await openPDF(file); const segments = [], warnings = [];
    try {
      if (pdf.numPages > 30) throw new Error('最多导入 30 页 PDF，请拆分文档');
      for (let p = 1; p <= pdf.numPages; p++) {
        progress(`正在提取 PDF 第 ${p}/${pdf.numPages} 页…`); const page = await pdf.getPage(p), content = await page.getTextContent(), groups = [],viewport=page.getViewport({scale:1});
        for (const item of content.items.filter(item => 'str' in item && item.str.trim())) {
          let group = groups.find(g => Math.abs(g.y - item.transform[5]) < 3);
          if (!group) { group = { y: item.transform[5], items: [] }; groups.push(group); }
          group.items.push(item);
        }
        groups.sort((a, b) => b.y - a.y).forEach((g, i) => {const rects=g.items.map(item=>viewportRect(viewport,[item.transform[4],item.transform[5],item.transform[4]+item.width,item.transform[5]+Math.abs(item.height||item.transform[3]||12)]));const left=Math.min(...rects.map(r=>Math.min(r[0],r[2]))),top=Math.min(...rects.map(r=>Math.min(r[1],r[3]))),right=Math.max(...rects.map(r=>Math.max(r[0],r[2]))),bottom=Math.max(...rects.map(r=>Math.max(r[1],r[3])));segments.push({id:uid(),text:g.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(x=>x.str).join(' '),page:p,line:i+1,location:`第 ${p} 页 · 第 ${i+1} 行`,bbox:{x:Math.max(0,left/viewport.width),y:Math.max(0,top/viewport.height),width:Math.min(1,(right-left)/viewport.width),height:Math.min(1,(bottom-top)/viewport.height)},engine:'pdf-native',confidence:null});});
        for(const widget of (await page.getAnnotations()).filter(a=>a.subtype==='Widget'&&a.rect)){
          const r=viewportRect(viewport,widget.rect),top=Math.min(r[1],r[3])/viewport.height,left=Math.min(r[0],r[2])/viewport.width;
          const label=segments.filter(s=>s.page===p&&s.bbox&&s.bbox.y<top&&top-s.bbox.y<.08&&Math.abs(s.bbox.x-left)<.15).sort((a,b)=>b.bbox.y-a.bbox.y)[0];
          if(label){label.widget={fieldName:widget.fieldName,type:widget.fieldType,options:widget.options||[],required:!!widget.required};if(widget.fieldType==='Ch'&&widget.options?.length)label.text=label.text.replace(/[：:]\s*$/,'')+`（${widget.multiSelect?'多选':'单选'}）：`+widget.options.map(o=>o.displayValue||o.exportValue).join(' / ');}
        }
        if (!groups.length) warnings.push(`第 ${p} 页未提取到文本，可能是扫描页，可切到原版式后对该页运行 OCR。`);
      }
      return { kind: 'pdf', segments, pages: pdf.numPages, warnings };
    } finally { await pdf.loadingTask.destroy(); }
  }
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return { kind: 'image', segments: [], pages: 1, warnings: ['扫描图已保存，请运行本地 OCR 或手动录入原文；手写内容与复杂表格可能无法准确识别。'] };
  throw new Error('支持 PDF、DOCX、XLSX、PNG、JPG、WEBP、TXT；旧版 DOC / XLS 请另存为新格式。');
}
export async function renderPDF(blob, pageNumber, canvas, scale = 1.3) {
  const pdf = await openPDF(blob);
  try {
    const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale }); canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  } finally { await pdf.loadingTask.destroy(); }
}
export async function recognizeImage(blob, progress = () => {}, page = 1) {
  const worker = await createWorker(['chi_sim', 'eng'], 1, { workerPath: '/vendor/docmorph/ocr/worker.min.js', corePath: '/vendor/docmorph/ocr', langPath: '/vendor/docmorph/ocr/lang', workerBlobURL: false, gzip: true, logger: m => progress(`${m.status}${Number.isFinite(m.progress) ? ` ${Math.round(m.progress * 100)}%` : ''}`) });
  try {
    const { data } = await worker.recognize(blob, {}, { text: true, blocks: true });
    const image=await createImageBitmap(blob);const width=image.width,height=image.height;image.close();
    const detected=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    const segments=detected.length?detected.filter(l=>l.text?.trim()).map((l,i)=>({id:uid(),text:l.text.trim(),page,line:i+1,location:`OCR 第 ${page} 页 · 第 ${i+1} 行`,bbox:{x:l.bbox.x0/width,y:l.bbox.y0/height,width:(l.bbox.x1-l.bbox.x0)/width,height:(l.bbox.y1-l.bbox.y0)/height},confidence:l.confidence,engine:'tesseract-local'})):lines(data.text,page,`OCR 第 ${page} 页`);
    return { segments, confidence: data.confidence, warnings: ['OCR 置信度只描述文字识别，不代表字段或规则正确；请逐项对照原件复核。'] };
  } finally { await worker.terminate(); }
}
