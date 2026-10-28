#!/usr/bin/env node
// 将本项目（唯一源码）同步到本机已安装的桌面版，避免两处手改产生漂移。
// 用法：npm run desktop:sync
import {cp,readdir,stat,access} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=join(homedir(),'AppData','Local','Programs','OmniFormOS','resources','app');
const entries=['public','src','desktop','server.mjs','package.json'];

const exists=async p=>{try{await access(p);return true;}catch{return false;}};

async function copyDir(from,to){
  await cp(from,to,{recursive:true,force:true,filter:src=>!src.includes('node_modules')&&!src.includes('.git')});
}

if(!await exists(target)){
  console.error(`未找到已安装的桌面版：${target}`);
  console.error('请先安装 output/desktop 下的安装包，或改用 npm run desktop 直接运行开发版。');
  process.exit(1);
}

let count=0;
const changed=[];
for(const entry of entries){
  const from=join(root,entry),to=join(target,entry);
  const info=await stat(from).catch(()=>null);
  if(!info)continue;
  if(info.isDirectory())await copyDir(from,to);
  else await cp(from,to,{force:true});
  count++;
  changed.push(entry);
}

console.log(`已同步 ${count} 项到安装版：${changed.join(', ')}`);
console.log('显示层改动：在应用窗口按 Ctrl+R 生效。');
console.log('主进程/preload 改动（desktop/*.cjs）：需完全退出应用后重新启动。');
