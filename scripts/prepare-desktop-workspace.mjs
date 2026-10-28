import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {workspaceBackup,restoreWorkspace} from '../src/workspace-backup.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const userData=process.env.OMNIFORM_DESKTOP_USER_DATA||path.join(process.env.APPDATA,'OmniFormOS Desktop');
const file=path.join(userData,'workspace.json');
if(existsSync(file)){console.log('桌面工作区已存在，未覆盖。');process.exit(0);}
const names={exam:'examcraft',flow:'flowform',doc:'docmorph',adapt:'adaptform',table:'tablemind',lab:'labform',canvas:'appcanvas',pilot:'formpilot'};
const databases=Object.fromEntries(Object.entries(names).map(([key,name])=>[key,path.join(root,key==='exam'&&existsSync(path.join(root,'artifacts/exam-analytics-ui.sqlite'))?'artifacts/exam-analytics-ui.sqlite':'data/'+name+'.sqlite')]));
const target=path.join(userData,'workspace');
const backup=workspaceBackup(databases);
restoreWorkspace(backup,target);
mkdirSync(userData,{recursive:true});
writeFileSync(path.join(userData,'before-desktop-import.ofbackup'),backup);
writeFileSync(file,JSON.stringify({databases:Object.fromEntries(Object.keys(names).map(key=>[key,path.join(target,key+'.sqlite')])),envFile:path.join(root,'.env'),importedFrom:root,importedAt:new Date().toISOString()},null,2));
console.log('当前八模块数据库已复制到桌面工作区，原工作区保留。');
