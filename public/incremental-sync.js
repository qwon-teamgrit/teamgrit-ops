(()=>{
  let running=false;
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
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><span class="tag ${cls}">${label}</span><b>${title}</b></div>${detail?`<div class="muted" style="margin-top:6px">${detail}</div>`:''}${!done&&!error&&!waiting?'<div style="height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:10px"><div style="height:100%;width:35%;background:#1967d2;border-radius:999px;animation:tgSync 1.2s ease-in-out infinite alternate"></div></div>':''}`;
  }
  async function call(action,payload){
    const r=await fetch('/api/live-data?action='+encodeURIComponent(action),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{}),cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }
  async function run(){
    if(running)return;
    running=true;
    let b=q('#syncProjects');
    if(b){b.disabled=true;b.textContent='동기화 중...';}
    let processed=0,total=0,projectUpdates=0,aiDeferred=false,aiModel='';
    try{
      status('변경 원본 확인 중','기존 중앙 원본과 Drive 최신 수정 시각을 비교합니다.');
      const start=await call('sync-start',{});
      let queue=start.queue||[]; total=start.total||queue.length;
      if(!queue.length){
        status('최신 상태입니다','마지막 동기화 이후 변경된 연결 원본이 없습니다.',true,false,false);
        window.dispatchEvent(new CustomEvent('tg-sync-complete',{detail:{message:'변경된 원본 없음'}}));
        return;
      }
      while(queue.length){
        status(`변경 원본 동기화 중 · ${Math.min(processed,total)}/${total}`,`한 번에 최대 20개씩 처리합니다. 이번 동기화 대상은 최대 ${start.limit||400}개입니다.`);
        const step=await call('sync-step',{queue});
        processed+=step.processed||0; projectUpdates+=step.projectUpdates||0; queue=step.remaining||[];
        total=Math.max(total,processed+queue.length);
        if(step.aiDeferred||String(step.modelUsed||'').includes('AI 분석 대기')){aiDeferred=true;aiModel=step.modelUsed||'AI 분석 대기';}
      }
      if(typeof window.loadCentral==='function')await window.loadCentral();
      if(typeof window.renderAll==='function')window.renderAll();
      const sourceMsg=`원본 ${processed}개 처리 완료${projectUpdates?` · 프로젝트 ${projectUpdates}건 갱신`:''}`;
      if(aiDeferred){
        status('원본 동기화 완료 · AI 분석 대기',`${sourceMsg}. Gemini 사용량/일시 장애로 프로젝트 AI 분석만 보류했습니다. 원본은 다시 읽을 필요가 없습니다.`,false,false,true);
        window.dispatchEvent(new CustomEvent('tg-sync-complete',{detail:{message:`${sourceMsg} · ${aiModel}`}}));
      }else{
        status('증분 동기화 완료',sourceMsg,true,false,false);
        window.dispatchEvent(new CustomEvent('tg-sync-complete',{detail:{message:sourceMsg}}));
      }
    }catch(e){
      const raw=e?.message||String(e);
      const isAi=/Gemini 호출 실패|\b429\b|quota|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|high demand|temporar/i.test(raw);
      if(isAi){
        status('원본 동기화 완료 · AI 분석 대기','원본 저장은 유지됩니다. Gemini 사용량 제한 또는 일시적 과부하로 프로젝트 분석만 보류했습니다.',false,false,true);
        window.dispatchEvent(new CustomEvent('tg-sync-complete',{detail:{message:'AI 분석 대기'}}));
      }else{
        status('원본 동기화 중단',raw,false,true,false);
        window.dispatchEvent(new CustomEvent('tg-sync-failed',{detail:{message:raw}}));
      }
      if(typeof window.loadCentral==='function')await window.loadCentral().catch(()=>{});
      if(typeof window.renderAll==='function')window.renderAll();
    }finally{
      running=false;
      b=q('#syncProjects');
      if(b){b.disabled=false;b.textContent='최신 변경분 동기화';}
    }
  }
  function bind(){
    const old=q('#syncProjects');
    if(!old||old.dataset.incrementalV2==='1')return;
    const b=old.cloneNode(true);
    b.dataset.incrementalV2='1';
    b.disabled=false;
    b.textContent='최신 변경분 동기화';
    old.replaceWith(b);
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();run();});
    window.runIncrementalSync=run;
    window.syncProjectSources=run;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
  setTimeout(bind,300);
})();
