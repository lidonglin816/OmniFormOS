// =====================================================================
// Central AI model configuration (runtime-switchable, Modex-style).
// All module services read process.env.OMNIFORM_AI_* per request, so we
// simply re-apply the stored config into process.env on every read.
// Persisted to a JSON file next to the desktop env file (or ./data).
// Routes:
//   GET  /api/ai/config  -> current provider state (key masked)
//   POST /api/ai/config  -> switch provider / edit key, effective at once
// =====================================================================
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const configPath = process.env.OMNIFORM_AI_CONFIG_PATH
  || (process.env.OMNIFORM_DESKTOP_ENV_FILE
    ? path.join(path.dirname(process.env.OMNIFORM_DESKTOP_ENV_FILE), 'ai-config.json')
    : fileURLToPath(new URL('../data/ai-config.json', import.meta.url)));

function applyStored(){
  try{
    if(!existsSync(configPath))return;
    const cfg=JSON.parse(readFileSync(configPath,'utf8'));
    if(cfg.baseUrl)process.env.OMNIFORM_AI_BASE_URL=cfg.baseUrl;
    if(cfg.apiKey)process.env.OMNIFORM_AI_API_KEY=cfg.apiKey;
    if(cfg.model)process.env.OMNIFORM_AI_MODEL=cfg.model;
  }catch{/* ignore malformed config; env values remain active */}
}
applyStored();

const maskKey=k=>!k?'':(k.length>14?k.slice(0,8)+'…'+k.slice(-4):k.slice(0,4)+'…');
const state=()=>({
  configured:!!(process.env.OMNIFORM_AI_BASE_URL&&process.env.OMNIFORM_AI_API_KEY&&process.env.OMNIFORM_AI_MODEL),
  baseUrl:process.env.OMNIFORM_AI_BASE_URL||'',
  model:process.env.OMNIFORM_AI_MODEL||'',
  keyMasked:maskKey(process.env.OMNIFORM_AI_API_KEY),
  configFile:configPath
});

async function readBody(req){
  let raw='';
  for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>64*1024)throw Object.assign(Error('请求体过大'),{status:413});}
  return JSON.parse(raw||'{}');
}

export async function handleAiConfig(req,res,pathname){
  if(pathname!=='/api/ai/config')return false;
  const send=(code,payload)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(payload));};
  if(req.method==='GET'){applyStored();send(200,state());return true;}
  if(req.method==='POST'){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){send(403,{error:'禁止跨站修改 AI 配置'});return true;}
    if(!req.headers['content-type']?.startsWith('application/json')){send(400,{error:'请使用 JSON 请求'});return true;}
    let input;
    try{input=await readBody(req);}catch(e){send(e.status||400,{error:e.message});return true;}
    const baseUrl=String(input.baseUrl||'').trim().replace(/\/+$/,'');
    const model=String(input.model||'').trim();
    const apiKey=String(input.apiKey||'').trim();
    if(!/^https?:\/\//.test(baseUrl)){send(400,{error:'Base URL 必须以 http(s):// 开头'});return true;}
    if(!model){send(400,{error:'模型名称不能为空'});return true;}
    // keep existing key when blank (avoid re-typing secrets)
    const prev=(()=>{try{return JSON.parse(readFileSync(configPath,'utf8'));}catch{return{};}})();
    const key=apiKey||prev.apiKey||process.env.OMNIFORM_AI_API_KEY||'';
    if(!key){send(400,{error:'API Key 不能为空'});return true;}
    try{
      mkdirSync(path.dirname(configPath),{recursive:true});
      writeFileSync(configPath,JSON.stringify({baseUrl,apiKey:key,model},null,2));
    }catch(e){send(500,{error:'配置写入失败：'+e.message});return true;}
    process.env.OMNIFORM_AI_BASE_URL=baseUrl;
    process.env.OMNIFORM_AI_API_KEY=key;
    process.env.OMNIFORM_AI_MODEL=model;
    send(200,state());
    return true;
  }
  send(405,{error:'不支持的请求方法'});return true;
}
