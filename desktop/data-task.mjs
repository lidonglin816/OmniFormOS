import {readFileSync,writeFileSync} from 'node:fs';
import {workspaceBackup,restoreWorkspace} from '../src/workspace-backup.mjs';
const [action,configFile,target]=process.argv.slice(2);
if(action==='backup')writeFileSync(target,workspaceBackup(JSON.parse(readFileSync(configFile,'utf8')).databases));
else if(action==='restore')restoreWorkspace(readFileSync(configFile),target);
else throw Error('未知数据任务');
