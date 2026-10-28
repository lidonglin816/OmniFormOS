import {Resvg} from '@resvg/resvg-js';
import {clone,uid,stamp,createExperiment,evaluateExperiment} from '../public/labform-pro-model.js';
import {reproducibleRecipe,calculationVersion} from '../public/labform-science.js';
const fail=(text,status=422)=>{throw Object.assign(Error(text),{status});};
export function assertLabRevision(project,input){if(input.expectedProjectRevision!=null&&Number(input.expectedProjectRevision)!==Number(project.storageRevision||0))fail('实验已更新，请刷新后重试',409);}
export function validateNotebook(notebook={}){
 for(const key of ['observations','environment','materials','course','team','notes'])if(notebook[key]!=null&&(typeof notebook[key]!=='string'||notebook[key].length>100000))fail('实验记录字段无效或过长');
 if(notebook.attachments!=null&&(!Array.isArray(notebook.attachments)||notebook.attachments.length>12))fail('每项实验最多 12 个附件');
 if((notebook.attachments||[]).reduce((n,f)=>n+String(f.data||'').length,0)>16*1024*1024)fail('附件总量不能超过约 12 MB');
 for(const f of notebook.attachments||[]){if(!f.name||!/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,[A-Za-z0-9+/=]+$/.test(f.data||''))fail('附件仅支持 PNG/JPEG/WebP/PDF/TXT');if(f.data.length>3*1024*1024)fail('单个附件不能超过约 2 MB');}
}
export async function handleLabStudio({req,res,path,body,read,mutate,validate,audit,send}){
 if(!['/api/lab/evidence','/api/lab/reproduce','/api/lab/capture','/api/lab/plot/png'].includes(path)||req.method!=='POST')return false;
 const input=await body(req);
 if(path.endsWith('/reproduce')){const recipe=input.recipe;if(recipe?.format!=='labform-recipe'||recipe.calculationVersion!==calculationVersion)fail('计算配方版本不受支持');const project={...createExperiment(),id:recipe.projectId||uid('replay'),fields:clone(recipe.fields),rows:clone(recipe.sourceRows),parameters:clone(recipe.parameters),plot:clone(recipe.plot),uncertainty:clone(recipe.uncertainty)};validate(project);const result=evaluateExperiment(project);send({result,calculationVersion,persisted:false});return true;}
 const project=read()?.state.projects.find(p=>p.id===input.projectId);if(!project)fail('实验不存在',404);assertLabRevision(project,input);
 if(path.endsWith('/plot/png')){const svg=String(input.svg||'');if(svg.length>2*1024*1024||!svg.startsWith('<svg')||/<(?:script|foreignObject|image|iframe|use)\b|<!DOCTYPE|<!ENTITY|(?:href|src)\s*=|url\s*\(\s*['"]?(?!#)/i.test(svg))fail('图表 SVG 无效或包含外部资源');const root=svg.slice(0,svg.indexOf('>')+1);if(!/\bwidth="1000"/.test(root)||!/\bheight="600"/.test(root)||!/\bviewBox="0 0 1000 600"/.test(root))fail('图表画布必须为 1000 × 600');const buffer=new Resvg(svg,{fitTo:{mode:'width',value:2000},font:{loadSystemFonts:true,defaultFontFamily:'Microsoft YaHei'}}).render().asPng();res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(buffer);return true;}
 if(path.endsWith('/evidence')){const result=evaluateExperiment(project);send({result,recipe:reproducibleRecipe(project,result)});return true;}
 if(!Array.isArray(input.records)||!input.records.length||input.records.length>500)fail('每批接收 1–500 条设备记录');
 const allowed=project.fields.filter(f=>f.type!=='calculated');if(input.records.some(r=>!r||typeof r!=='object'||Object.keys(r).some(k=>!allowed.some(f=>f.id===k))))fail('设备记录包含未知或计算字段，请先确认映射');
 send(mutate(s=>{const p=s.projects.find(p=>p.id===input.projectId);assertLabRevision(p,input);const previous=clone(p);delete previous.versions;delete previous.reports;delete previous.audit;delete previous.result;
  for(const data of input.records)p.rows.push({id:uid('capture'),values:clone(data),original:clone(data),group:String(input.group||'设备导入').slice(0,100),source:String(input.source||'用户提交的设备数据').slice(0,200),at:stamp()});try{validate(p);evaluateExperiment({...p,plot:{...p.plot,model:'none'}});}catch(error){fail(error.message,422);}
  p.versions.unshift({id:uid('version'),name:'设备数据导入前',at:stamp(),snapshot:previous,automatic:true});p.versions=p.versions.slice(0,30);p.storageRevision=Number(p.storageRevision||0)+1;p.updatedAt=stamp();p.result=null;p.analysis=null;audit(s,p,`接收 ${input.records.length} 条设备数据，来源：${String(input.source||'手动确认导入').slice(0,100)}`);return p;
 }));return true;
}
