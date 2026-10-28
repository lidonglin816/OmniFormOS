import {createWorkspaceRecords} from './src/workspace-records.mjs';
import {handleAiConfig} from './src/ai-config.mjs';
import {createAuthService} from './src/auth-service.mjs';
import {createWorkspaceAccess} from './src/workspace-access.mjs';
import {workspaceBackup} from './src/workspace-backup.mjs';
import {createFlowCampusService} from './src/flow-campus-service.mjs';
import http from 'node:http';
import {createPilotService} from './src/pilot-service.mjs';
import {createCanvasService} from './src/canvas-service.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createExamService } from './src/exam-service.mjs';
import { createFlowService } from './src/flow-service.mjs';
import { createDocService } from './src/doc-service.mjs';
import { createAdaptService } from './src/adapt-service.mjs';
import { createLabService } from './src/lab-service.mjs';
import { createTableService } from './src/table-service.mjs';
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const examService = createExamService(process.env.EXAM_DB_PATH || fileURLToPath(new URL('./data/examcraft.sqlite', import.meta.url)));
const flowService = createFlowService(process.env.FLOW_DB_PATH || fileURLToPath(new URL('./data/flowform.sqlite', import.meta.url)));
const docService = createDocService(process.env.DOC_DB_PATH || fileURLToPath(new URL('./data/docmorph.sqlite', import.meta.url)));
const adaptService = createAdaptService(process.env.ADAPT_DB_PATH || fileURLToPath(new URL('./data/adaptform.sqlite', import.meta.url)),{onSubmitted:()=>flowCampusService.syncEvents()});
const flowCampusService=createFlowCampusService(flowService,{adapt:adaptService,doc:docService,exam:examService,get lab(){return labService;}});
const tableService = createTableService(process.env.TABLE_DB_PATH || fileURLToPath(new URL('./data/tablemind.sqlite', import.meta.url)), (req,ids)=>[(!req||!ids||ids.includes('examcraft_live'))?examService.linkedTable(req):null,(!req||!ids||ids.includes('flowform_live'))?flowCampusService.linkedTable(req):null].filter(Boolean));
const labService = createLabService(process.env.LAB_DB_PATH || fileURLToPath(new URL('./data/labform.sqlite', import.meta.url)));
const canvasService=createCanvasService(process.env.CANVAS_DB_PATH || fileURLToPath(new URL('./data/appcanvas.sqlite',import.meta.url)),{table:tableService,lab:labService,flow:flowService,doc:docService,adapt:adaptService});
const pilotService=createPilotService(process.env.PILOT_DB_PATH || fileURLToPath(new URL('./data/formpilot.sqlite',import.meta.url)),{table:tableService,canvas:canvasService,flow:flowService,doc:docService,adapt:adaptService,exam:examService,lab:labService});
const backupDatabases=Object.fromEntries([['exam','EXAM_DB_PATH','examcraft'],['flow','FLOW_DB_PATH','flowform'],['doc','DOC_DB_PATH','docmorph'],['adapt','ADAPT_DB_PATH','adaptform'],['table','TABLE_DB_PATH','tablemind'],['lab','LAB_DB_PATH','labform'],['canvas','CANVAS_DB_PATH','appcanvas'],['pilot','PILOT_DB_PATH','formpilot']].map(([key,env,name])=>[key,process.env[env]||fileURLToPath(new URL('./data/'+name+'.sqlite',import.meta.url))]));
const workspaceAccess=createWorkspaceAccess();
const authService=createAuthService({directory:process.env.OMNIFORM_AUTH_DATA_PATH||path.join(path.dirname(backupDatabases.exam),'auth')});
const workspaceRecords=createWorkspaceRecords(backupDatabases);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(await authService.handle(req,res,pathname))return;
    if(await authService.guard(req,res,pathname))return;
    if(['/login','/signup','/verify-email','/forgot-password','/reset-password','/auth/callback','/dashboard'].includes(pathname)){
      if(pathname==='/dashboard'&&authService.configuration.configured&&!await authService.authenticated(req)){res.writeHead(303,{Location:'/login?next=/dashboard','Cache-Control':'no-store'}).end();return;}
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}).end(await readFile(path.join(root,'auth.html')));return;
    }
    if(pathname==='/api/health'&&req.method==='GET'){
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({service:'OmniFormOS',ok:true}));return;
    }
    if(await handleAiConfig(req,res,pathname))return;
    if(pathname==='/api/workspace/session'&&req.method==='POST'){
      try{const cookie=workspaceAccess.open(req);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie}).end('{"ok":true}');}catch(error){res.writeHead(403,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}return;
    }
    req.workspaceAuthorized=workspaceAccess.authorized(req);
    if((pathname.startsWith('/api/canvas/')&&!pathname.startsWith('/api/canvas/public/')||/^\/api\/pilot\/preview(?:\/|$)/.test(pathname)||pathname.startsWith('/api/workspace/records')||pathname==='/api/workspace/backup'||pathname.startsWith('/api/doc/')&&!pathname.startsWith('/api/doc/public/')||pathname.startsWith('/api/adapt/')&&!pathname.startsWith('/api/adapt/public/')&&pathname!=='/api/adapt/event'||pathname.startsWith('/api/lab/')||pathname.startsWith('/api/tablemind/')&&!pathname.startsWith('/api/tablemind/public/'))&&!workspaceAccess.authorized(req)){
      res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'请先打开本机工作区，工作区会话缺失或已过期'}));return;
    }
    if(pathname==='/api/workspace/records'){
      try{const url=new URL(req.url,'http://localhost'),module=url.searchParams.get('module');let result;
        if(req.method==='GET')result={items:workspaceRecords.list(module,req,url.searchParams.get('trash')==='1')};
        else if(req.method==='POST'){
          if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Object.assign(Error('禁止跨站操作'),{status:403});
          if(!req.headers['content-type']?.startsWith('application/json'))throw Error('请使用JSON');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>512000)throw Error('选择数据过大');}const input=JSON.parse(raw||'{}');result=workspaceRecords.change(module,req,input.action,input.items);
        }else throw Object.assign(Error('不支持的请求方法'),{status:405});
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(result));
      }catch(error){res.writeHead(error.status||400,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify({error:error.message}));}return;
    }
    if(pathname==='/api/workspace/backup'){
      try{
        if(req.method!=='POST'){res.writeHead(405).end();return;}
        if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('禁止跨站备份请求');
        if(!req.headers['content-type']?.startsWith('application/json'))throw Error('请使用 JSON 请求');
        let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>32*1024*1024)throw Error('浏览器备份超过 32 MB');}
        const input=JSON.parse(raw||'{}');const bundle=workspaceBackup(backupDatabases,input.browserStorage||{});
        res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':'attachment; filename="OmniFormOS-workspace.ofbackup"'}).end(bundle);
      }catch(error){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}return;
    }
    if (await pilotService.handle(req,res,pathname)) return;
    if (await examService.handle(req, res, pathname)) return;
    if (await flowCampusService.handle(req,res,pathname)) return;
    if (await flowService.handle(req, res, pathname)) return;
    if (await docService.handle(req, res, pathname)) return;
    if (await adaptService.handle(req, res, pathname)) return;
    if (await tableService.handle(req, res, pathname)) return;
    if (await labService.handle(req, res, pathname)) return;
    if (await canvasService.handle(req,res,pathname)) return;
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('页面不存在'); }
}).listen(port, '127.0.0.1', () => console.log(`OmniFormOS ready: http://127.0.0.1:${port}`));
