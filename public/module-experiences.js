// Display preferences only; existing module actions and data remain authoritative.
export function installModuleExperiences({root,getRoute}){
  const configs={
    exam:{host:'.ec-assessment-home',anchor:'.ec-paper-desk .ec-section-head',label:'试卷呈现',choices:[['shelf','卡架'],['list','清单']]},
    flowform:{host:'.ffp-command-home',anchor:'.ffp-hero>div:first-child',label:'运行视角',choices:[['operations','运行总览'],['inbox','待办优先']]},
    docmorph:{host:'.dmp-document-inbox',anchor:'.dmp-processing-column .dmp-section-head',label:'队列视图',choices:[['queue','处理队列'],['files','文档卡片']]},
    adaptform:{host:'.afp-adaptive-home',anchor:'.afp-home-logic',label:'工作重心',choices:[['logic','规则优先'],['response','填写优先']]},
    tablemind:{host:'.tmp-data-home',anchor:'.tmp-home-sheet>header',label:'表格空间',choices:[['catalog','显示目录'],['sheet','展开表格']]},
    labform:{host:'.lfp-research-home',anchor:'.lfp-science-preview>header',label:'研究视角',choices:[['chart','曲线优先'],['notebook','记录优先']]}
  };
  const preferences=new Map();let frame=0;
  function sync(){
    frame=0;const key=getRoute(),config=configs[key];if(!config)return;
    const host=root.querySelector(config.host);if(!host)return;
    const value=preferences.get(key)||config.choices[0][0];host.dataset.experience=value;
    let tools=host.querySelector('[data-experience-tools]');
    if(!tools){
      const anchor=host.querySelector(config.anchor);if(!anchor)return;
      tools=document.createElement('div');tools.className='module-view-control';tools.dataset.experienceTools=key;
      tools.setAttribute('role','group');tools.setAttribute('aria-label',config.label);
      for(const [id,label] of config.choices){const button=document.createElement('button');button.type='button';button.dataset.experience=id;button.textContent=label;tools.append(button);}
      if(key==='adaptform')anchor.prepend(tools);else anchor.append(tools);
    }
    tools.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.experience===value)));
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button[data-experience]');if(!button)return;
    const config=configs[getRoute()];if(!config||!config.choices.some(([id])=>id===button.dataset.experience))return;
    preferences.set(getRoute(),button.dataset.experience);sync();window.dispatchEvent(new Event('resize'));
  });
  new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(sync);}).observe(root,{subtree:true,childList:true});sync();
}
