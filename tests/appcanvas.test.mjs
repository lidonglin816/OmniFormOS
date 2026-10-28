import test from 'node:test';
import assert from 'node:assert/strict';
import { seedAppCanvas,activePage,addPage,addComponent,moveComponent,updateComponent,validateCanvas,publishCanvas,rollbackCanvas } from '../public/appcanvas-model.js';

test('初始多页面应用包含组件、绑定和权限',()=>{const s=seedAppCanvas();assert.equal(s.pages.length,3);assert.equal(s.pages[1].access,'管理员与编辑者');assert.match(s.pages[1].components[0].props.binding,/TableMind/);});
test('新增页面与组件使用独立 ID 并可排序',()=>{const s=seedAppCanvas(),p=addPage(s,'知识库');const a=addComponent(s,'hero'),b=addComponent(s,'table');assert.equal(p.components.length,2);assert.notEqual(a.id,b.id);moveComponent(s,b.id,'up');assert.equal(p.components[0].id,b.id);});
test('组件属性更新保留原属性并拒绝空标题',()=>{const s=seedAppCanvas(),c=activePage(s).components[0];updateComponent(s,c.id,{title:'门户欢迎',props:{headline:'欢迎回来'}});assert.equal(c.props.button,'开始使用');assert.throws(()=>updateComponent(s,c.id,{title:' '}),/不能为空/);});
test('空页面阻止发布，完整应用生成不可变版本快照',()=>{const s=seedAppCanvas();addPage(s,'空白页');assert.match(validateCanvas(s),/还没有组件/);addComponent(s,'hero');const v=publishCanvas(s,'首版');s.pages[0].name='已修改';assert.notEqual(v.snapshot.pages[0].name,'已修改');assert.equal(s.publishedVersion,1);});
test('回滚恢复页面、主题和已发布状态',()=>{const s=seedAppCanvas();publishCanvas(s,'v1');s.theme='ocean';s.pages[0].name='新版首页';publishCanvas(s,'v2');rollbackCanvas(s,1);assert.equal(s.theme,'violet');assert.equal(s.pages[0].name,'首页');assert.equal(s.dirty,false);});
