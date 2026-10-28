const {contextBridge,ipcRenderer}=require('electron');
// 读取随包发布的 package.json 版本，供界面显示真实版本号，避免各处手写版本不一致
let appVersion='';
try{appVersion=require('../package.json').version||'';}catch{}
contextBridge.exposeInMainWorld('omniDesktop',{isDesktop:true,appVersion,openSettings:()=>ipcRenderer.invoke('desktop:settings')});
contextBridge.exposeInMainWorld('omniWindow',{minimize:()=>ipcRenderer.send('omni-window','minimize'),toggleMaximize:()=>ipcRenderer.send('omni-window','maximize-toggle'),close:()=>ipcRenderer.send('omni-window','close')});
// 桌面模式类必须尽早、且在页面任何加载路径下都生效（页面从缓存/BFCache 恢复时 DOMContentLoaded 可能不再触发）。
try{if(document.documentElement&&!document.documentElement.classList.contains('omni-desktop'))document.documentElement.classList.add('omni-desktop');}catch{}
window.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.add('omni-desktop'));
window.addEventListener('pageshow',()=>document.documentElement.classList.add('omni-desktop'));
