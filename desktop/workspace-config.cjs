const path=require('node:path');
const fs=require('node:fs');
const modules={exam:'examcraft',flow:'flowform',doc:'docmorph',adapt:'adaptform',table:'tablemind',lab:'labform',canvas:'appcanvas',pilot:'formpilot'};
function databasePaths(directory){return Object.fromEntries(Object.keys(modules).map(key=>[key,path.join(directory,key+'.sqlite')]));}
function readConfig(userData){
  const file=path.join(userData,'workspace.json');
  if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file,'utf8'));
  return {databases:databasePaths(path.join(userData,'workspace'))};
}
function backendEnvironment(config,port){
  const env={...process.env,PORT:String(port)};
  for(const key of Object.keys(modules)){
    if(!path.isAbsolute(config.databases?.[key]||''))throw Error('工作区数据库路径无效：'+key);
    env[key.toUpperCase()+'_DB_PATH']=config.databases[key];
  }
  // Desktop settings are read only from the user's selected local configuration.
  delete env.ELECTRON_RUN_AS_NODE;
  if(config.envFile)env.OMNIFORM_DESKTOP_ENV_FILE=config.envFile;
  return env;
}
function localURL(value,origin){try{return new URL(value).origin===origin;}catch{return false;}}
module.exports={modules,databasePaths,readConfig,backendEnvironment,localURL};
