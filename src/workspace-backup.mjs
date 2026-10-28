import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const names=['exam','flow','doc','adapt','table','lab','canvas','pilot'];
const digest=b=>createHash('sha256').update(b).digest('hex');
export function workspaceBackup(databases,browserStorage={}){
 const folder=mkdtempSync(join(tmpdir(),'omniform-backup-'));
 try{const files=[];for(const key of names){const source=databases[key];if(!source||!existsSync(source))throw Error('数据库不存在：'+key);const target=join(folder,key+'.sqlite'),db=new DatabaseSync(source);try{db.exec('PRAGMA busy_timeout=5000');db.prepare('VACUUM INTO ?').run(target);}finally{db.close();}const content=readFileSync(target);files.push({key,name:key+'.sqlite',sha256:digest(content),data:content.toString('base64')});}
 return gzipSync(JSON.stringify({format:'omniformos-workspace',version:1,createdAt:new Date().toISOString(),scope:'八模块 SQLite（含数据库内附件、版本、记录）及当前浏览器存储；不含环境凭据',files,browserStorage}));
 }finally{rmSync(folder,{recursive:true,force:true});}
}
export function restoreWorkspace(buffer,destination){
 // Restore into a new directory only. Running databases and existing workspaces
 // are never overwritten; switching the server to this directory is explicit.
 if(existsSync(destination))throw Error('恢复目录必须不存在，禁止覆盖现有工作区');
 const archive=JSON.parse(gunzipSync(buffer,{maxOutputLength:1024*1024*1024}));
 if(archive.format!=='omniformos-workspace'||archive.version!==1||!Array.isArray(archive.files)||archive.files.length!==names.length)throw Error('备份格式或模块数量无效');
 const decoded=new Map();for(const f of archive.files){if(!names.includes(f.key)||decoded.has(f.key))throw Error('备份模块无效或重复');const bytes=Buffer.from(f.data,'base64');if(digest(bytes)!==f.sha256)throw Error('备份校验失败：'+f.key);decoded.set(f.key,bytes);}
 mkdirSync(dirname(destination),{recursive:true});const staging=mkdtempSync(join(dirname(destination),'.omniform-restore-'));
 try{for(const[key,bytes]of decoded){const filename=join(staging,key+'.sqlite');writeFileSync(filename,bytes);const db=new DatabaseSync(filename);try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('数据库完整性检查失败：'+key);}finally{db.close();}}
 writeFileSync(join(staging,'browser-storage.json'),JSON.stringify(archive.browserStorage||{},null,2));
 writeFileSync(join(staging,'RESTORE.json'),JSON.stringify({createdAt:archive.createdAt,restoredAt:new Date().toISOString(),modules:names},null,2));
 renameSync(staging,destination);return{directory:destination,modules:names.length};
 }catch(error){rmSync(staging,{recursive:true,force:true});throw error;}
}
