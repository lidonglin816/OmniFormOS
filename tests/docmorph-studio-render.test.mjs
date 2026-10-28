import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocMorph} from '../public/docmorph-pro.js';
import {seedDocMorph} from '../public/docmorph-model.js';

test('DocMorph 3 工作室渲染原文、独立审核与可操作表单；导航可进入批处理',async()=>{
 const previous={document:globalThis.document,fetch:globalThis.fetch,sessionStorage:globalThis.sessionStorage};const clicks=[];const store=seedDocMorph();const state={documents:structuredClone(store.documents),forms:[],records:[],versions:[],documentVersions:[],tasks:[],templates:[],audit:[]};let html='';
 globalThis.document={addEventListener:(type,fn)=>{if(type==='click')clicks.push(fn);},querySelector:()=>null,querySelectorAll:()=>[]};globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
 globalThis.fetch=async path=>({ok:true,json:async()=>path==='/api/workspace/session'?{}:{state,ai:{configured:false},originalIds:[]}});
 let instance;try{instance=createDocMorph({store:()=>store,escape:v=>String(v??'').replaceAll('<','&lt;'),toast:()=>{},commit:()=>{},persist:()=>{},render:()=>{if(instance)html=instance.render();},modal:()=>{},closeModal:()=>{}});await new Promise(r=>setTimeout(r,20));
 const navigate=async tab=>{const button={dataset:{dmpTab:tab}};for(const handler of clicks)await handler({target:{closest:selector=>selector==='button'?button:null}});};
 await navigate('studio');assert.ok(html.includes('dm-source-pane'));assert.ok(html.includes('dm-review-pane'));assert.ok(html.includes('dm-form-pane'));assert.ok(html.includes('data-dm-review-filter="issues"'));
 await navigate('design');assert.ok(html.includes('id="dmp-live-preview"'));assert.ok(html.includes('data-dmp-preview-field'));assert.ok(html.includes('<input'));
 await navigate('batch');assert.ok(html.includes('批量文档处理'));assert.ok(html.includes('队列空闲'));
 }finally{Object.assign(globalThis,previous);}
});
