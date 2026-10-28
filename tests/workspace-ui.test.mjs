import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCommands,nextCommandIndex} from '../public/workspace-ui-model.js';

test('命令搜索保留真实操作引用，支持中文及不区分大小写的模块名称',()=>{
  const a={label:'实验数据',keywords:'LabForm 测量',run:()=>42},b={label:'数据模型',keywords:'FormPilot'},c={label:'发布管理',keywords:'deploy'};
  assert.deepEqual(rankCommands([a,b,c],'实验'),[a]);
  assert.equal(rankCommands([a,b,c],'labform 测量')[0].run(),42);
  assert.deepEqual(rankCommands([a,b,c],'不存在的项目'),[]);
  assert.deepEqual(rankCommands([a,b,c],'   '),[a,b,c]);
});
test('命令方向键循环与空列表不会选择不存在的命令',()=>{
  assert.equal(nextCommandIndex(0,-1,3),2);
  assert.equal(nextCommandIndex(2,1,3),0);
  assert.equal(nextCommandIndex(-1,1,0),-1);
  assert.equal(nextCommandIndex(-1,1,2),0);
});
