import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createFillableDocPDF} from '../src/doc-fillable-pdf.mjs';

test('原 PDF 回填保留页面并使用人工确认区域，缺少确认时拒绝导出',async()=>{
 const original=await PDFDocument.create();original.addPage([400,600]);
 const bytes=await original.save();
 const document={name:'区域验收',fields:[{id:'field1',label:'姓名',type:'text',required:true,source:{page:1,bbox:{x:.1,y:.2,width:.5,height:.06},regionConfirmed:true}}]};
 const result=await PDFDocument.load(await createFillableDocPDF(document,bytes));
 assert.equal(result.getPageCount(),1);assert.equal(result.getPages()[0].getWidth(),400);
 const field=result.getForm().getTextField('docmorph_field1');assert.equal(field.isRequired(),true);
 const box=field.acroField.getWidgets()[0].getRectangle();assert.ok(Math.abs(box.x-40)<2);assert.ok(Math.abs(box.y-444)<2);
 document.fields[0].source.regionConfirmed=false;
 await assert.rejects(()=>createFillableDocPDF(document,bytes),/逐字段确认/);
});
