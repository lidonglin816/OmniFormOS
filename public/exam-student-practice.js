export function mountPractice({root,api,getAttempt,escape:esc,notice}) {
  let items=[],loading=false;
  root.addEventListener('click',async event=>{
    if(event.target.id!=='start-practice'||loading)return;
    loading=true;event.target.disabled=true;
    try{const result=await api(`/attempts/${getAttempt().id}/practice`);items=result.items;
      document.querySelector('#practice-content').innerHTML=items.length?`<form id="practice-form"><p>仅重练本答卷已确认的错题。练习独立记录，不改写考试成绩。简答和计算题仅供对照自评。</p>${items.map((i,n)=>`<article class="question"><small>${n+1}/${items.length} · ${esc(i.question.topic)}</small><h3>${esc(i.question.stem)}</h3>${['fill','short','calculation'].includes(i.question.type)?`<textarea name="${esc(i.id)}" rows="3" aria-label="第 ${n+1} 题答案" maxlength="10000"></textarea>`:i.question.options.map((o,k)=>`<label class="practice-choice"><input name="${esc(i.id)}" type="${i.question.type==='multiple'?'checkbox':'radio'}" value="${k}">${String.fromCharCode(65+k)} · ${esc(o)}</label>`).join('')}<div data-practice-feedback="${esc(i.id)}"></div></article>`).join('')}<button class="primary">检查练习答案</button><div id="practice-summary" role="status"></div></form>`:'<p>本次已评分答卷暂无错题，继续保持！</p>';
    }catch(e){notice(e.message);}finally{loading=false;event.target.disabled=false;}
  });
  root.addEventListener('submit',async event=>{
    if(event.target.id!=='practice-form')return;event.preventDefault();if(loading)return;loading=true;
    const button=event.target.querySelector('button');button.disabled=true;
    try{const form=new FormData(event.target),answers=Object.fromEntries(items.map(i=>[i.id,['fill','short','calculation'].includes(i.question.type)?String(form.get(i.id)||''):form.getAll(i.id).map(Number)]));
      const result=await api(`/attempts/${getAttempt().id}/practice`,{answers});
      for(const feedback of result.feedback){const node=[...root.querySelectorAll('[data-practice-feedback]')].find(n=>n.dataset.practiceFeedback===feedback.id);if(node){node.className='practice-feedback';node.innerHTML=`<strong>${feedback.grade.pending?'请对照解析自评':feedback.grade.score===feedback.grade.max?'✓ 回答正确':'继续复习'}</strong><p>参考答案：${esc(Array.isArray(feedback.answer)?feedback.answer.map(k=>String.fromCharCode(65+k)).join('、'):feedback.answer)}</p><p>${esc(feedback.explanation||'暂无解析，请向教师请教。')}</p>`;}}
      document.querySelector('#practice-summary').textContent=`本轮 ${result.count} 题，${result.correct} 题满分，${result.pending} 题需自评。考试成绩保持不变。`;notice('');
    }catch(e){notice(e.message);}finally{loading=false;button.disabled=false;}
  });
}
