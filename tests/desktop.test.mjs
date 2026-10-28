import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {databasePaths,readConfig,backendEnvironment,localURL}=require('../desktop/workspace-config.cjs');
test('桌面工作区默认八模块数据库位于用户目录，显式配置可恢复独立工作区',()=>{
  const folder=mkdtempSync(path.join(tmpdir(),'omni-desktop-test-'));
  try{const initial=readConfig(folder);assert.equal(Object.keys(initial.databases).length,8);for(const value of Object.values(initial.databases))assert.ok(value.startsWith(folder+path.sep));const migrated={databases:databasePaths(path.join(folder,'restored'))};writeFileSync(path.join(folder,'workspace.json'),JSON.stringify(migrated));assert.deepEqual(readConfig(folder),migrated);}finally{rmSync(folder,{recursive:true,force:true});}
});
test('桌面后台拒绝缺失或相对数据库路径，所有模块路径显式传入',()=>{
  assert.throws(()=>backendEnvironment({databases:{}},3102),/路径无效/);
  const databases=databasePaths(path.resolve('data'));const env=backendEnvironment({databases},3102);assert.equal(env.PORT,'3102');assert.equal(env.EXAM_DB_PATH,databases.exam);assert.equal(env.PILOT_DB_PATH,databases.pilot);assert.equal(env.ELECTRON_RUN_AS_NODE,undefined);
});
test('桌面导航只认可完全相同的来源，防止伪装本机域名及跨端口',()=>{
  const origin='http://127.0.0.1:3102';assert.ok(localURL(origin+'/#labform',origin));for(const url of ['http://127.0.0.1:3100/','http://127.0.0.1.evil.test:3102/','javascript:alert(1)','file:///C:/secret'])assert.equal(localURL(url,origin),false);
});
