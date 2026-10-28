const {app,BrowserWindow,Menu,dialog,shell,session,ipcMain}=require('electron');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {databasePaths,readConfig,backendEnvironment,localURL}=require('./workspace-config.cjs');
app.setName('OmniFormOS Desktop');
const desktopUserData=process.env.OMNIFORM_DESKTOP_USER_DATA||path.join(app.getPath('appData'),'OmniFormOS Desktop');
app.setPath('userData',desktopUserData);
app.setPath('sessionData',desktopUserData);
const gotLock=app.requestSingleInstanceLock();
if(!gotLock){app.quit();}else{
  let win,child,origin,config,quitting=false,restarts=0,retryTimer;
  const root=path.join(__dirname,'..');
  const userData=desktopUserData;
  app.setPath('userData',userData);
  fs.mkdirSync(userData,{recursive:true});
  const configFile=path.join(userData,'workspace.json');
  const logFile=path.join(userData,'desktop-service.log');
  const node=app.isPackaged?path.join(process.resourcesPath,'runtime','node.exe'):process.env.OMNIFORM_NODE_PATH||path.join(process.env.USERPROFILE,'.ai-manager','runtimes','node','24.22.0','node.exe');
  const port=Number(process.env.OMNIFORM_DESKTOP_PORT||3102);
  origin='http://127.0.0.1:'+port;
  ipcMain.handle('desktop:settings',event=>{if(!localURL(event.senderFrame?.url,origin))throw Error('不受信任的窗口');return shell.openPath(userData);});
  // 无边框窗口控制：红绿灯按钮（最小化 / 最大化切换 / 关闭）
  ipcMain.on('omni-window',(event,cmd)=>{
    const w=BrowserWindow.fromWebContents(event.sender);if(!w)return;
    if(cmd==='minimize')w.minimize();
    else if(cmd==='maximize-toggle')w.isMaximized()?w.unmaximize():w.maximize();
    else if(cmd==='close')w.close();
  });
  const log=message=>fs.appendFileSync(logFile,new Date().toISOString()+' '+message+'\n');
  const task=(args)=>new Promise((resolve,reject)=>{
    const p=spawn(node,args,{cwd:userData,windowsHide:true,env:backendEnvironment(config,port)});let errors='';
    p.stderr.on('data',b=>errors+=b.toString());p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(errors.slice(-2000)||'数据操作失败')));
  });
  const healthy=async()=>{try{const r=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1200)});return r.ok&&(await r.json()).service==='OmniFormOS';}catch{return false;}};
  async function startBackend(){
    const fd=fs.openSync(logFile,'a');
    child=spawn(node,[path.join(root,'desktop','server-entry.mjs')],{cwd:userData,env:backendEnvironment(config,port),windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
    let starting=true;
    child.on('error',e=>log(e.message));
    child.on('exit',code=>{
      log('服务退出：'+code);if(quitting||starting)return;
      retryTimer=setTimeout(async()=>{try{await startBackend();restarts=0;if(win&&!win.isDestroyed())dialog.showMessageBox(win,{message:'本地服务已恢复',detail:'可刷新页面继续使用。刷新前请保留尚未保存的编辑内容。',buttons:['稍后刷新','立即刷新']}).then(({response})=>{if(response===1)win.reload();});}catch(e){log(e.message);showFailure(e);}},Math.min(1000*2**restarts++,30000));
    });
    for(let i=0;i<40;i++){
      await new Promise(r=>setTimeout(r,300));
      if(child.exitCode!==null)throw Error('本地服务启动失败，请查看日志。');
      if(await healthy()){starting=false;return;}
    }
    starting=false;child.kill();throw Error('本地服务启动超时，请检查端口 '+port+' 与日志。');
  }
  function showFailure(e){dialog.showMessageBox(win,{type:'error',title:'本地服务未就绪',message:e.message,detail:'日志：'+logFile,buttons:['重新启动桌面应用','打开日志目录','关闭']}).then(({response})=>{if(response===0){app.relaunch();app.quit();}else if(response===1)shell.openPath(userData);});}
  function configureWindow(w){
    w.webContents.setWindowOpenHandler(({url})=>{
      if(localURL(url,origin)){setImmediate(()=>createWindow(url));}
      else if(/^https?:\/\//i.test(url))dialog.showMessageBox(w,{type:'question',message:'在默认浏览器打开外部链接？',detail:url,buttons:['取消','打开']}).then(({response})=>{if(response===1)shell.openExternal(url);});
      return {action:'deny'};
    });
    w.webContents.on('will-navigate',(event,url)=>{if(!localURL(url,origin))event.preventDefault();});
    w.webContents.on('will-attach-webview',event=>event.preventDefault());
    w.webContents.on('render-process-gone',()=>{if(!quitting)w.reload();});
  }
  function createWindow(url=origin+'/#landing'){
    const w=new BrowserWindow({width:1024,height:768,minWidth:980,minHeight:680,title:'OmniFormOS 桌面版',backgroundColor:'#f5f7f9',frame:false,autoHideMenuBar:true,icon:path.join(__dirname,'icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,partition:'persist:omniform-desktop'}});
    configureWindow(w);w.once('ready-to-show',()=>w.show());w.loadURL(url);if(!win||win.isDestroyed())win=w;return w;
  }
  async function exportBackup(){
    const {filePath,canceled}=await dialog.showSaveDialog(win,{title:'导出八模块数据库备份',defaultPath:'OmniFormOS-'+new Date().toISOString().slice(0,10)+'.ofbackup',filters:[{name:'OmniFormOS 备份',extensions:['ofbackup']}]});
    if(canceled)return;
    try{fs.writeFileSync(configFile,JSON.stringify(config,null,2));await task([path.join(__dirname,'data-task.mjs'),'backup',configFile,filePath]);dialog.showMessageBox(win,{message:'备份已导出',detail:'含八模块数据库；浏览器草稿请使用页面内“导出工作空间备份”。'});}catch(e){showFailure(e);}
  }
  async function importBackup(){
    const {filePaths,canceled}=await dialog.showOpenDialog(win,{title:'恢复备份到新工作区',filters:[{name:'OmniFormOS 备份',extensions:['ofbackup']}],properties:['openFile']});if(canceled)return;
    const target=path.join(userData,'restored-'+Date.now());
    try{await task([path.join(__dirname,'data-task.mjs'),'restore',filePaths[0],target]);config={databases:databasePaths(target),envFile:config.envFile};fs.writeFileSync(configFile,JSON.stringify(config,null,2));dialog.showMessageBoxSync(win,{message:'备份已恢复到新目录，原数据保留。应用将重启。',detail:'浏览器草稿可在恢复后通过页面的恢复入口导入。'});app.relaunch();app.quit();}catch(e){showFailure(e);}
  }
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.on('before-quit',()=>{quitting=true;clearTimeout(retryTimer);if(child?.exitCode===null)child.kill();});
  app.on('window-all-closed',()=>app.quit());
  app.whenReady().then(async()=>{
    config=readConfig(userData);fs.writeFileSync(configFile,JSON.stringify(config,null,2));
    const ses=session.fromPartition('persist:omniform-desktop');ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));ses.setPermissionCheckHandler(()=>false);
    ses.on('will-download',(_event,item)=>item.setSaveDialogOptions({title:'保存导出文件',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))}));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'工作区',submenu:[{label:'返回首页',click:()=>win.loadURL(origin+'/#landing')},{label:'导出数据库备份…',click:exportBackup},{label:'从备份恢复到新工作区…',click:importBackup},{label:'打开数据与设置目录',click:()=>shell.openPath(userData)},{type:'separator'},{role:'quit',label:'退出'}]},
      {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
      {label:'视图',submenu:[{role:'reload',label:'刷新'},{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'全屏'}]},
      {label:'帮助',submenu:[{label:'查看运行日志',click:()=>shell.openPath(logFile)},{label:'关于',click:()=>dialog.showMessageBox(win,{message:'OmniFormOS 桌面版 1.0.0',detail:'八大引擎 · 本地数据 · 独立运行\nAI 功能需要自行配置模型接口。'})}]}]));
    // Do not silently attach to an unrelated server already occupying the desktop port.
    const net=require('node:net');await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(Error('桌面端口 '+port+' 已被占用，请关闭占用程序后重试。')));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
    await startBackend();createWindow();
    if(process.env.OMNIFORM_DESKTOP_SMOKE==='1'){
      win.webContents.once('did-finish-load',async()=>{
        try{const image=await win.webContents.capturePage();fs.writeFileSync(path.join(userData,'desktop-smoke.png'),image.toPNG());fs.writeFileSync(path.join(userData,'desktop-smoke.json'),JSON.stringify({title:win.webContents.getTitle(),url:win.webContents.getURL(),health:await healthy(),node:win.webContents.getLastWebPreferences().nodeIntegration,contextIsolation:win.webContents.getLastWebPreferences().contextIsolation,sandbox:win.webContents.getLastWebPreferences().sandbox}));}catch(e){log(e.message);}
      });
    }
  }).catch(e=>{log(e.stack||e.message);dialog.showErrorBox('OmniFormOS 启动失败',e.message+'\n日志：'+logFile);app.quit();});
}
