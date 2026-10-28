import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync,readFileSync,writeFileSync,unlinkSync,statSync,ftruncateSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function supervise({script,lock,log,env=process.env,minDelay=1000,maxDelay=30000}){
  mkdirSync(path.dirname(lock),{recursive:true});
  const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
  try{const fd=openSync(lock,'wx');closeSync(fd);}catch(error){
    if(error.code!=='EEXIST')throw error;
    let old;try{old=JSON.parse(readFileSync(lock,'utf8'));}catch{}
    if(old&&alive(old.pid))return null;
    // A concurrent supervisor may have created its lock but not yet written its PID.
    if(!old&&Date.now()-statSync(lock).mtimeMs<10000)return null;
    unlinkSync(lock);return supervise({script,lock,log,env,minDelay,maxDelay});
  }
  let child,timer,stopping=false,delay=minDelay;
  const state=()=>writeFileSync(lock,JSON.stringify({pid:process.pid,childPid:child?.pid,startedAt:new Date().toISOString()}));
  const out=openSync(log,'a');
  const note=message=>writeFileSync(out,new Date().toISOString()+' '+message+'\n');
  const launch=()=>{
    if(stopping)return;
    // Bound the log between launches; active writes remain on the same file handle.
    if(statSync(log).size>10*1024*1024)ftruncateSync(out,0);
    const started=Date.now();note('Starting workspace server');
    child=spawn(process.execPath,[script],{env,windowsHide:true,stdio:['ignore',out,out]});state();
    child.on('error',error=>note('Spawn error: '+error.message));
    child.on('exit',(code,signal)=>{
      if(stopping){cleanup();return;}
      note('Server exited '+code+' '+(signal||'')+'; restarting');
      if(Date.now()-started>60000)delay=minDelay;
      timer=setTimeout(launch,delay);delay=Math.min(delay*2,maxDelay);
    });
  };
  const cleanup=()=>{try{unlinkSync(lock);}catch{}try{closeSync(out);}catch{}process.exit(0);};
  const stop=()=>{stopping=true;clearTimeout(timer);if(child?.exitCode===null)child.kill();else cleanup();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
  launch();return {stop};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  process.chdir(fileURLToPath(new URL('../',import.meta.url)));
  try{process.loadEnvFile();}catch(error){if(error.code!=='ENOENT')throw error;}
  const port=process.env.PORT||'3100';
  supervise({script:'scripts/start-workspace.mjs',lock:`data/workspace-${port}.pid`,log:`artifacts/workspace-${port}.log`});
}
