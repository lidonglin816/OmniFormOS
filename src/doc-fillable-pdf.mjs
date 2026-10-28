import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
let fontBytes;
export async function createFillableDocPDF(document,originalBytes){
 const pdf=originalBytes?await PDFDocument.load(originalBytes):await PDFDocument.create();pdf.registerFontkit(fontkit);
 fontBytes ||= await readFile(process.env.DOCMORPH_PDF_FONT||join(process.env.WINDIR||'C:/Windows','Fonts','simhei.ttf'));
 const font=await pdf.embedFont(fontBytes),form=pdf.getForm();let page,y;
 if(originalBytes){for(const f of document.fields){const box=f.source?.bbox,page=pdf.getPages()[Number(f.source?.page)-1];if(!f.source?.regionConfirmed||!box||!page||page.getRotation().angle!==0)throw Error('原 PDF 回填需要逐字段确认填写区域，暂不支持旋转页面');if(![box.x,box.y,box.width,box.height].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||box.width<=0||box.height<=0||box.x+box.width>1.001||box.y+box.height>1.001)throw Error('填写区域坐标无效');const {width,height}=page.getSize(),position={x:box.x*width,y:(1-box.y-box.height)*height,width:box.width*width,height:box.height*height,font};let field;const key='docmorph_'+f.id;if(f.type==='checkbox'){field=form.createCheckBox(key);field.addToPage(page,position);}else if(f.type==='select'||f.type==='multiselect'){field=f.type==='select'?form.createDropdown(key):form.createOptionList(key);field.addOptions(f.options);if(f.type==='multiselect')field.enableMultiselect();field.addToPage(page,position);}else{field=form.createTextField(key);if(f.type==='textarea')field.enableMultiline();field.addToPage(page,position);field.setFontSize(Math.max(6,Math.min(12,position.height*.6)));}if(f.required)field.enableRequired();}form.updateFieldAppearances(font);return pdf.save();}
 const nextPage=()=>{page=pdf.addPage([595,842]);page.drawText(document.name.slice(0,30),{x:44,y:790,font,size:18,color:rgb(.35,.23,.55)});page.drawText('重新排版的可填写 PDF - 非原件原位回填',{x:44,y:764,font,size:10});page.drawText('离线填写不会自动提交；条件与格式验证请使用在线表单。',{x:44,y:746,font,size:9});y=714;};nextPage();
 for(const f of document.fields){const h=f.type==='textarea'?66:f.type==='multiselect'?66:32;if(y-h<75)nextPage();
  const label=f.label+(f.required?'（必填）':'')+'：';for(let i=0;i<label.length;i+=40){page.drawText(label.slice(i,i+40),{x:44,y,font,size:11});y-=15;}
  let field;if(f.type==='checkbox'){field=form.createCheckBox(f.id);field.addToPage(page,{x:46,y:y-24,width:20,height:20});}
  else if(f.type==='select'){field=form.createDropdown(f.id);field.addOptions(f.options);field.addToPage(page,{x:45,y:y-h,width:505,height:h,font});}
  else if(f.type==='multiselect'){field=form.createOptionList(f.id);field.addOptions(f.options);field.enableMultiselect();field.addToPage(page,{x:45,y:y-h,width:505,height:h,font});}
  else{field=form.createTextField(f.id);if(f.type==='textarea')field.enableMultiline();if(f.rules?.maxLength)field.setMaxLength(f.rules.maxLength);field.addToPage(page,{x:45,y:y-h,width:505,height:h,font});field.setFontSize(11);}
  if(f.required)field.enableRequired();if(f.type==='file')page.drawText('附件请在在线表单上传；此处可填写文件名。',{x:46,y:y-h-13,font,size:8});y-=h+20;
 }
 form.updateFieldAppearances(font);pdf.setTitle(document.name);pdf.setProducer('OmniForm OS DocMorph 3.0');return pdf.save();
}
