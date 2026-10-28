// Versioned, deterministic tools. No user code or model generated code is executed.
export const calculationVersion='lab-science-3.0.0';
const number=(v,label)=>{if(v==null||String(v).trim()===''||!Number.isFinite(Number(v)))throw Error(label+'必须是有限数值');return Number(v);};
export function uncertaintyBudget(values,config={}){
 const a=values.filter(v=>v!=null&&String(v).trim()!=='').map(v=>number(v,'测量值'));
 if(!a.length)throw Error('没有可用于不确定度计算的测量值');
 const n=a.length,mean=a.reduce((s,v)=>s+v,0)/n,sumSquares=a.reduce((s,v)=>s+(v-mean)**2,0),std=n>1?Math.sqrt(sumSquares/(n-1)):null,uA=std==null?null:std/Math.sqrt(n);
 const halfWidth=number(config.halfWidth??0,'仪器误差限'),k=number(config.k??2,'覆盖因子');
 if(halfWidth<0||k<=0)throw Error('误差限不得为负，覆盖因子必须大于零');
 const divisor={rectangular:Math.sqrt(3),triangular:Math.sqrt(6),normal:1}[config.distribution||'rectangular'];if(!divisor)throw Error('未知 B 类分布');
 const uB=halfWidth/divisor,combined=uA==null?null:Math.hypot(uA,uB);
 return{n,mean,range:Math.max(...a)-Math.min(...a),std,sem:uA,uA,uB,combined,expanded:combined==null?null:k*combined,k,halfWidth,distribution:config.distribution||'rectangular',sumSquares,formula:'uA=s/√n; uB=a/divisor; uc=√(uA²+uB²); U=k·uc',assumptions:'所选值必须是同一条件下同一被测量的独立重复测量；A/B 类输入不相关。单次测量的 A 类与合成不确定度不可估计。覆盖概率取决于分布及有效自由度，k=2 不自动保证 95%。',calculationVersion};
}
export function groupComparison(project,result){
 const id=project.plot.ys[0];return [...new Set(result.rows.map(r=>r.group||'默认组'))].map(group=>{const rows=result.rows.filter(r=>(r.group||'默认组')===group),v=rows.map(r=>r.values[id]).filter(v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))).map(Number);return{group,fieldId:id,n:v.length,mean:v.length?v.reduce((s,x)=>s+x,0)/v.length:null,rowIds:rows.map(r=>r.id),note:'描述性分组统计；不同 X 或实验条件的均值不能直接解释为显著差异。'};});
}
export function reproducibleRecipe(project,result){
 return{format:'labform-recipe',version:1,calculationVersion,projectId:project.id,storageRevision:project.storageRevision||0,sourceRows:project.rows.map(r=>({id:r.id,values:r.values,original:r.original||r.values,group:r.group,source:r.source})),fields:project.fields,parameters:project.parameters,plot:project.plot,uncertainty:project.uncertainty||null,steps:[{tool:'validate',inputs:'fields, rows, confirmed formulas'},{tool:'calculate-columns',order:'topological dependency order; safe expression parser'},{tool:'describe',formula:'mean=Σx/n; s²=Σ(x−mean)²/(n−1)'},{tool:'fit',model:project.plot.model,scope:{group:project.plot.group||'全部分组',rowIds:result.points.map(p=>p.id)}},{tool:'residual',formula:'observed − predicted'},{tool:'uncertainty',assumption:result.uncertainty?.assumptions||'未配置'}],results:{stats:result.stats,fit:result.fit,hall:result.hall,derived:result.derived,uncertainty:result.uncertainty},warning:'此配方含原始数据，只应分享给有权访问的人员。算法以 calculationVersion 标识；不执行任意脚本。'};
}
