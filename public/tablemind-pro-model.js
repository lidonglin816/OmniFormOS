export const uid=(prefix='id')=>`${prefix}_${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
export const clone=value=>JSON.parse(JSON.stringify(value));
export const now=()=>new Date().toISOString();

export function inferField(name,values=[]){
  const present=values.filter(v=>v!==''&&v!=null),text=present.map(String),numbers=present.map(Number);
  let type='text';
  if(present.length&&text.every(v=>/^(true|false|是|否)$/i.test(v)))type='boolean';
  else if(present.length&&numbers.every(Number.isFinite)&&!text.some(v=>/^0\d+/.test(v)))type='number';
  else if(present.length&&text.every(v=>/^\d{4}-\d{1,2}-\d{1,2}/.test(v)&&!Number.isNaN(Date.parse(v))))type='date';
  else if(present.length&&text.every(v=>/^(true|false|是|否|0|1)$/i.test(v)))type='boolean';
  else if(present.length&&new Set(text).size<=Math.min(12,Math.ceil(present.length*.35)))type='select';
  return{id:uid('fld'),name:String(name||'未命名字段'),type,required:false,unique:false,defaultValue:'',options:type==='select'?[...new Set(text)]:[]};
}

export function normalizeTable(input={}){
  const table=clone(input);table.id=table.id||uid('tbl');table.name=String(table.name||'未命名数据表');table.description=String(table.description||'');
  table.fields=(table.fields||[]).map((f,index)=>({...f,id:f.id||uid('fld'),name:String(f.name||f.label||`字段 ${index+1}`),type:f.type||'text',required:!!f.required,unique:!!f.unique,defaultValue:f.defaultValue??'',options:Array.isArray(f.options)?f.options:[],relation:f.relation||null}));
  table.records=(table.records||[]).map(row=>({id:row.id||uid('row'),...row,updatedAt:row.updatedAt||now()}));for(const row of table.records)for(const f of table.fields)if(f.type==='boolean'&&['是','否','true','false'].includes(row[f.id]))row[f.id]=['是','true'].includes(row[f.id]);table.createdAt=table.createdAt||now();table.updatedAt=table.updatedAt||now();table.source=table.source||{module:'TableMind'};return table;
}

export function normalizeState(input={}){
  const s=clone(input||{});s.workspace=s.workspace||{id:'default',name:'OmniForm OS 数据工作区'};s.tables=(s.tables||[]).map(normalizeTable);s.views=Array.isArray(s.views)?s.views:[];s.dashboards=Array.isArray(s.dashboards)?s.dashboards:[];s.queries=Array.isArray(s.queries)?s.queries:[];s.cleaningRuns=Array.isArray(s.cleaningRuns)?s.cleaningRuns:[];s.publications=Array.isArray(s.publications)?s.publications:[];s.versions=Array.isArray(s.versions)?s.versions:[];s.audit=Array.isArray(s.audit)?s.audit:[];s.activeTableId=s.activeTableId||s.tables[0]?.id||null;return s;
}

export {recordErrors as validateRecord} from './tablemind-data-engine.js';

const cmp=(a,op,b)=>{if(op==='empty')return a==null||a==='';if(op==='notEmpty')return a!=null&&a!=='';if(op==='in')return Array.isArray(b)&&b.map(String).includes(String(a));if(op==='contains')return String(a??'').toLowerCase().includes(String(b??'').toLowerCase());if(op==='eq')return String(a??'')===String(b??'');if(op==='neq')return String(a??'')!==String(b??'');const isDate=typeof a==='string'&&/^\d{4}-\d{2}-\d{2}/.test(a);const av=isDate?Date.parse(a):Number(a),bv=isDate?Date.parse(b):Number(b);if(op==='gt')return av>bv;if(op==='gte')return av>=bv;if(op==='lt')return av<bv;if(op==='lte')return av<=bv;return true;};
export function applyView(table,view={}){let rows=[...table.records];if(Array.isArray(view.recordIds))rows=rows.filter(r=>view.recordIds.includes(r.id));if(view.search)rows=rows.filter(r=>table.fields.some(f=>String(r[f.id]??'').toLowerCase().includes(view.search.toLowerCase())));for(const f of view.filters||[])rows=rows.filter(row=>cmp(row[f.fieldId],f.op||'contains',f.value));for(const s of [...(view.sorts||[])].reverse())rows.sort((a,b)=>{const x=a[s.fieldId],y=b[s.fieldId],n=typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'zh-CN',{numeric:true});return s.direction==='desc'?-n:n;});return rows;}

export function parseDelimited(text,delimiter=','){
  const rows=[];let row=[],cell='',quoted=false,wasQuoted=false;for(let i=0;i<=text.length;i++){const ch=text[i]??'\n';if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"'){quoted=!quoted;wasQuoted=true;}else if(!quoted&&(ch===delimiter||ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(wasQuoted?cell:cell.trim());cell='';wasQuoted=false;if(ch!==delimiter){if(row.some(Boolean))rows.push(row);row=[];}}else cell+=ch;}if(quoted)throw new Error('CSV 引号未闭合，请检查文件格式');return rows;
}

export function rowsToTable(name,rows){const headers=rows[0]||[],body=rows.slice(1),fields=headers.map((h,i)=>inferField(h,body.map(r=>r[i])));return normalizeTable({name,fields,records:body.map(values=>Object.fromEntries([['id',uid('row')],...fields.map((f,i)=>[f.id,values[i]??''])]))});}

export function cleanPreview(table,operations=[]){
 const before=clone(table.records),after=clone(before),fields=clone(table.fields),changes=[];
 for(const op of operations){
  if(!['trim','fill','normalize-case','remove-duplicates','convert-number','normalize-date','split','calculate'].includes(op.type))throw new Error('不支持的清洗操作');
  if(op.type==='remove-duplicates'){const seen=new Set(),ids=op.fieldIds?.length?op.fieldIds:table.fields.map(f=>f.id);for(let i=0;i<after.length;i++){const key=JSON.stringify(ids.map(id=>after[i][id]??''));if(seen.has(key)){changes.push({rowId:after[i].id,type:'remove',before:clone(after[i]),after:null});after.splice(i--,1);}else seen.add(key);}continue;}
  if(!fields.some(f=>f.id===op.fieldId))throw new Error('清洗字段不存在');
  let target=op.fieldId;if(['split','calculate'].includes(op.type)){if(!String(op.targetName||'').trim())throw new Error('请填写新字段名称');target=op.targetId||'derived_'+op.fieldId+'_'+op.type;const existing=fields.find(f=>f.id===target);if(!existing)fields.push({id:target,name:op.targetName,type:op.type==='calculate'?'number':'text',required:false,unique:false,defaultValue:''});}
  if(op.type==='convert-number')fields.find(f=>f.id===op.fieldId).type='number';if(op.type==='normalize-date')fields.find(f=>f.id===op.fieldId).type='date';
  for(const r of after){const old=r[op.fieldId];let value=old;if(op.type==='trim'&&typeof old==='string')value=old.trim();if(op.type==='fill'&&(old==null||old===''))value=op.value;if(op.type==='normalize-case'&&typeof old==='string')value=op.mode==='upper'?old.toUpperCase():old.toLowerCase();if(op.type==='convert-number'&&old!==''&&old!=null){if(!Number.isFinite(Number(old)))throw new Error('存在无法转换的数字，请先修正记录');value=Number(old);}if(op.type==='normalize-date'&&old){if(Number.isNaN(Date.parse(old)))throw new Error('存在无效日期，请先修正记录');value=new Date(old).toISOString().slice(0,10);}if(op.type==='split')value=String(old??'').split(String(op.value||','))[0];if(op.type==='calculate'){if(!Number.isFinite(Number(op.value)))throw new Error('计算系数必须是数字');value=old===''||old==null?'':Number(old)*Number(op.value);if(value!==''&&!Number.isFinite(value))throw new Error('原字段包含非数字内容');}if(value!==r[target]){changes.push({rowId:r.id,fieldId:target,before:r[target],after:value});r[target]=value;}}
 }
 return{before,after,fields,changes};
}

export function seedTableMind(){const fields=[{id:'department',name:'部门',type:'select',options:['产品','研发','市场','运营']},{id:'participant',name:'参与人',type:'text'},{id:'activity',name:'活动',type:'text'},{id:'date',name:'日期',type:'date'},{id:'hours',name:'投入时长',type:'number'}];const records=[['产品','陈曦','用户访谈','2026-10-03',6],['研发','林浩','技术分享','2026-10-05',4],['市场','许妍','品牌活动','2026-10-08',7],['产品','周乔','原型评审','2026-10-11',5],['研发','赵诚','开源共建','2026-10-14',8],['运营','唐玥','用户社群','2026-10-16',6]].map((v,i)=>({id:`demo_${i+1}`,department:v[0],participant:v[1],activity:v[2],date:v[3],hours:v[4],updatedAt:now()}));const table=normalizeTable({id:'activity_data',name:'本月活动参与',description:'内置示例数据，可清空或替换；并非实际校园业务记录',source:{module:'内置示例',demo:true},fields,records});return normalizeState({tables:[table],views:[{id:'view_grid',tableId:table.id,name:'全部记录',type:'grid',filters:[],sorts:[],config:{}},{id:'view_chart',tableId:table.id,name:'部门投入',type:'chart',config:{chartType:'bar',dimension:'department',metric:'hours',aggregation:'sum'}}],dashboards:[{id:'dash_overview',name:'活动数据概览',tableId:table.id,widgets:[{id:'widget_chart',title:'部门投入时长',type:'chart',viewId:'view_chart',x:0,y:0,w:8,h:5},{id:'widget_kpi',title:'参与记录',type:'kpi',metric:'count',x:8,y:0,w:4,h:2}]}]});}
