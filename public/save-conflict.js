export function saveConflict(ctx,draft,module){
 const content=JSON.stringify({module,savedAt:new Date().toISOString(),draft},null,2),key='omniformos.recovery.'+module+'.'+draft.id;let stored=false;
 try{localStorage.setItem(key,content);stored=true;}catch{}
 ctx.modal(`<h2>检测到另一窗口的修改</h2><p>当前草稿未覆盖服务器数据。${stored?'已在本机保留恢复副本。':'浏览器无法保存恢复副本，请先下载当前草稿。'}</p><p>请下载草稿，再加载服务器最新版本并合并修改。</p><div class="modal-actions"><button type="button" id="conflict-download">下载当前草稿</button><button type="button" id="conflict-reload">加载最新版本</button></div>`);
 document.querySelector('#conflict-download').onclick=()=>{const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=module+'-未保存草稿.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 document.querySelector('#conflict-reload').onclick=()=>location.reload();
}
