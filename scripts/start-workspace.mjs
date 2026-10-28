import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
try{process.loadEnvFile();}catch(error){if(error.code!=='ENOENT')throw error;}
process.env.PORT||='3100';
const names={flow:'flowform',doc:'docmorph',adapt:'adaptform',table:'tablemind',lab:'labform',canvas:'appcanvas',pilot:'formpilot'};
if(!process.env.EXAM_DB_PATH&&existsSync('artifacts/exam-analytics-ui.sqlite'))process.env.EXAM_DB_PATH='artifacts/exam-analytics-ui.sqlite';
for(const[key,name]of Object.entries(names))process.env[key.toUpperCase()+'_DB_PATH']||='data/'+name+'.sqlite';
console.log('本机工作区服务启动后，请保持此进程运行。入口：http://127.0.0.1:'+process.env.PORT+'/#appcanvas');
await import('../server.mjs');
