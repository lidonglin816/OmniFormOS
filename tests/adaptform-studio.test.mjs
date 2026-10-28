import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCampusForm} from '../public/adaptform-templates.js';

test('编辑自动保存保留请求过程中继续修改的字段，重新保存使用最新存储版本',async()=>{
 const previous={document:globalThis.document};globalThis.document={activeElement:null,querySelector:()=>null,addEventListener:()=>{}};
 const{createAdaptStudio}=await import('../public/adaptform-studio.js');const form=makeCampusForm('competition3');form.storageRevision=1;let state={forms:[form],records:[],visits:[]},release,requests=[],store={};
 const api=async(path,options)=>{const snapshot=JSON.parse(options.body).form;requests.push(snapshot);if(requests.length===1)await new Promise(r=>release=r);const result={...snapshot,storageRevision:snapshot.storageRevision+1};return{result,state:{...state,forms:[structuredClone(result)]}};};
 const studio=createAdaptStudio({ctx:{toast:()=>{},store:()=>store,persist:()=>{}},api,current:()=>state.forms[0],paint:()=>{},getRemote:()=>state,setRemote:s=>state=s,setActive:()=>{},getTab:()=>'',setTab:()=>{},getValues:()=>({}),setValues:()=>{},ruleModal:()=>{}});
 try{studio.saved();state.forms[0].name='第一次编辑';const saving=studio.flush();await new Promise(r=>setTimeout(r,5));state.forms[0].name='请求中的后续编辑';release();await saving;assert.equal(state.forms[0].name,'请求中的后续编辑');assert.equal(state.forms[0].storageRevision,2);await studio.flush();assert.equal(requests[1].storageRevision,2);assert.equal(requests[1].name,'请求中的后续编辑');assert.equal(store.activeFormId,form.id);studio.select('members');assert.match(studio.designer(),/name="fieldId"/);assert.ok(!studio.designer().includes('name="id"'));}
 finally{studio.dispose();Object.assign(globalThis,previous);}
});
