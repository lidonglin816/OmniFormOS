// A legacy draft without an app identity must never overwrite a server app.
export function resolveCanvasLaunch(apps,legacy={},requested=''){
 const explicit=requested?apps.find(app=>app.id===requested):null;if(requested&&!explicit)throw Error('关联的页面应用不存在，请重新构建或选择有效应用');const app=explicit||apps.find(app=>app.id===legacy.id)||apps[0]||null;
 const draft=!!(app&&legacy.id&&legacy.id===app.id&&legacy.dirty),recoveryConflict=draft&&Number(legacy.revision||0)!==Number(app.revision||0);return{app,recoverLegacy:!!(!requested&&draft&&!recoveryConflict),recoveryConflict};
}
