(()=>{
  const RUN_LIMIT=400;
  let running=false,cancelled=false,currentController=null;
  const q=s=>document.querySelector(s);
  function ensureBox(){
    let el=q('#syncProgressBox');
    if(el)return el;
    const anchor=q('#projectSourceState');
    if(!anchor)return null;
    el=document.createElement('div');
    el.id='syncProgressBox';
    el.style.cssText='margin-top:10px;padding:12px 14px;border:1px solid #d8dee8;border-radius:12px;background:#fff;display:none';
    anchor.insertAdjacentElement('afterend',el);
    return el;
  }
  function status(title,detail,done=false,error=false,waiting=false){
    const el=ensureBox();if(!el)return;
    el.style.display='block';
    const cls=error?'amber':waiting?'amber':done?'green':'blue';
    const label=error?'중단':waiting?'AI 분석 대기':done?'완료':'진행 중';
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="tag ${cls}">${label}</span><b>${title}</b></div>${detail?`<div class="muted" style="margin-top:6px">${detail}</div>`:''}${!done&&!error&&!waiting?'<div style="height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:10px"><div style="height:100%;width:35%;background:#1967d2;border-radius:999px;animation:tgSync 1.2s ease-in-out infinite alternate"></div></div>':''}`;
  }
  function ensureCancel(){
    const sync=q('#syncProjects');if(!sync)return null;
    let btn=q('#cancelSync');
    if(!btn){btn=document.createElement('button');btn.id='cancelSync';btn.className='btn';btn.textContent='동기화 중단';btn.style.display='none';sync.insertAdjacentElement('afterend',btn);btn.addEventListener('click',async e=>{e.preventDefault();cancelled=true;currentController?.abort();status('사용자가 동기화를 중단했습니다','현재 처리 중이던 20개 묶음 이후 추가 원본은 처리하지 않습니다.',false,true,false);try{await fetch('/api/live-data?action=sync-cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'})}catch{}})}
    return btn;
  }
  async function call(action,payload){
    currentController=new AbortController();
    const r=await fetch('/api/live-data?action='+encodeURIComponent(action),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{}),cache:'no-store',signal:currentController.signal});
    const d=await r.json().catch(()=>({}));
    currentController=null;
    if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }
  async function run(){
    if(running)return;
    running=true;cancelled=false;
    let b=q('#syncProjects'),cancel=ensureCancel();
    if(b){b.disabled=true;b.textContent='동기화 중...';}
    if(cancel)cancel.style.display='inline-flex';
    let processed=0,total=0,projectUpdates=0,aiDeferred=false,aiModel='';
    try{
      status('변경 원본 확인 중','최초 연동은 최대 400개까지만 처리하고, 이후에는 마지막 동기화 이후 변경된 원본만 확인합니다.');
      const start=await call('sync-start',{});
      let queue=(start.queue||[]).slice(0,RUN_LIMIT);
      total=Math.min(RUN_LIMIT,start.total||queue.length);
      if(!queue.length){status('최신 상태입니다','마지막 동기화 이후 변경된 연결 원본이 없습니다.',true,false,false);return;}
      while(queue.length&&processed<RUN_LIMIT&&!cancelled){
        const remainingBudget=RUN_LIMIT-processed;
        queue=queue.slice(0,remainingBudget);
        total=Math.min(RUN_LIMIT,Math.max(total,processed+queue.length));
        status(`원본 동기화 중 · ${processed}/${total}`,`20개씩 처리합니다. 이 실행에서는 최대 ${RUN_LIMIT}개까지만 처리합니다.`);
        const step=await call('sync-step',{queue});
        if(cancelled)break;
        processed+=Math.min(step.processed||0,remainingBudget);
        projectUpdates+=step.projectUpdates||0;
        queue=(step.remaining||[]).slice(0,Math.max(0,RUN_LIMIT-processed));
        if(step.aiDeferred||String(step.modelUsed||'').includes('AI 분석 대기')){aiDeferred=true;aiModel=step.modelUsed||'AI 분석 대기';}
      }
      if(cancelled){status('사용자가 동기화를 중단했습니다',`이번 실행에서 ${processed}개까지 처리했습니다.`,false,true,false);return;}
      if(typeof window.loadCentral==='function')await window.loadCentral();
      if(typeof window.renderAll==='function')window.renderAll();
      const hitLimit=processed>=RUN_LIMIT;
      const sourceMsg=`원본 ${processed}개 처리 완료${projectUpdates?` · 프로젝트 ${projectUpdates}건 갱신`:''}`;
      if(aiDeferred){status('원본 동기화 완료 · AI 분석 대기',`${sourceMsg}. Gemini 분석만 보류했습니다.`,false,false,true);}
      else status(hitLimit?'이번 동기화 400개 완료':'증분 동기화 완료',`${sourceMsg}${hitLimit?' · 추가 연결 자료는 다음 동기화에서 이어서 확인합니다.':''}`,true,false,false);
    }catch(e){
      if(cancelled||e?.name==='AbortError'){status('사용자가 동기화를 중단했습니다',`이번 실행에서 ${processed}개까지 처리했습니다.`,false,true,false);return;}
      const raw=e?.message||String(e),isAi=/Gemini 호출 실패|\b429\b|quota|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|high demand|temporar/i.test(raw);
      if(isAi)status('원본 동기화 완료 · AI 분석 대기','원본 저장은 유지됩니다. 프로젝트 AI 분석만 보류했습니다.',false,false,true);
      else status('원본 동기화 중단',raw,false,true,false);
    }finally{
      running=false;currentController=null;
      b=q('#syncProjects');cancel=q('#cancelSync');
      if(b){b.disabled=false;b.textContent='최신 변경분 동기화';}
      if(cancel)cancel.style.display='none';
    }
  }
  function bind(){
    const old=q('#syncProjects');if(!old||old.dataset.incrementalV3==='1')return;
    const b=old.cloneNode(true);b.dataset.incrementalV3='1';b.disabled=false;b.textContent='최신 변경분 동기화';old.replaceWith(b);
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();run();});
    ensureCancel();window.runIncrementalSync=run;window.syncProjectSources=run;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  setTimeout(bind,300);
})();
