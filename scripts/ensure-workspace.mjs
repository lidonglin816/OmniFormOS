import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
try{process.loadEnvFile();}catch(error){if(error.code!=='ENOENT')throw error;}
const port=process.env.PORT||'3100',url=`http://127.0.0.1:${port}`;
const healthy=async()=>{try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(1500)});return r.ok&&(await r.json()).service==='OmniFormOS';}catch{return false;}};
if(!await healthy()){
  mkdirSync('artifacts',{recursive:true});mkdirSync('data',{recursive:true});
  const fd=openSync(`artifacts/workspace-${port}-supervisor.log`,'a');
  const child=spawn(process.execPath,['scripts/workspace-supervisor.mjs'],{detached:true,windowsHide:true,stdio:['ignore',fd,fd]});child.unref();closeSync(fd);
  let ready=false;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,500));if(await healthy()){ready=true;break;}}
  if(!ready){console.error('服务未能启动，请查看 artifacts/workspace-'+port+'.log（端口可能被其他程序占用）。');process.exit(1);}
}
console.log('OmniFormOS 已就绪：'+url+'/#appcanvas');
if(process.argv.includes('--open')){
  const child=spawn('cmd.exe',['/d','/c','start','',url+'/#appcanvas'],{windowsHide:true,stdio:'ignore'});child.unref();
}
