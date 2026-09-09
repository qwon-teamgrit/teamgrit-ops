(()=>{
  let running=false;
  const q=s=>document.querySelector(s);
  function box(){return q('#syncProgressBox')}
  function status(title,detail,done=false,error=false){
    const el=box();if(!el)return;
    el.style.display='block';
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><span class="tag ${error?'amber':done?'green':'blue'}">${error?'중단':done?'완료':'진행 중'}</span><b>${title}</b></div>${detail?`<div class="muted" style="margin-top:6px">${detail}</div>`:''}${!done&&!error?'<div style="height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:10px"><div style="height:100%;width:35%;background:#1967d2;border-radius:999px;animation:tgSync 1.2s ease-in-out infinite alternate"></div></div>':''}`;
  }
  async function call(url,payload){
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{}),cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }
  async function run(){
    if(running)return;
    running=true;
    const b=q('#syncProjects');if(b)b.disabled=true;
    let processed=0,total=0,projectUpdates=0;
    try{
      status('변경 원본 확인 중','기존 중앙 원본과 Drive 최신 수정 시각을 비교합니다.');
      const start=await call('/api/live-sync?action=start',{});
      let queue=start.queue||[];total=start.total||queue.length;
      if(!queue.length){
        status('최신 상태입니다','마지막 동기화 이후 변경된 연결 원본이 없습니다.',true,false);
        window.dispatchEvent(new CustomEvent('tg-sync-complete',{detail:{message:'변경된 원본 없음'}}));
        return;
      }
      while(queue.length){
        status(`변경 원본 동기화 중 · ${Math.min(processed,total)}/${total}`,`한 번에 최대 20개씩 처리합니다. 이번 동기화 대상은 최대 ${start.limit||400}개입니다.`);
        const step=await call('/api/live-sync?action=step',{queue});
        processed+=step.processed||0;projectUpdates+=step.projectUpdates||0;queue=step.remaining||[];
        total=Math.max(total,processed+queue.length);
      }
      if(typeof window.loadCentral==='function')await window.loadCentral();
      if(typeof window.renderAll==='function')window.renderAll();
      const msg=`처리 ${processed}개 · 갱신 프로젝트 ${projectUpdates}건`;
      status('증분 동기화 완료',msg,true,false);
      window.dispatchEvent(new CustomEvent('tg-sync-complete',{detail:{message:msg}}));
    }catch(e){
      const msg=e?.message||String(e);
      status('원본 동기화 중단',msg,false,true);
      window.dispatchEvent(new CustomEvent('tg-sync-failed',{detail:{message:msg}}));
      if(typeof window.loadCentral==='function')await window.loadCentral().catch(()=>{});
      if(typeof window.renderAll==='function')window.renderAll();
      alert('원본 동기화 실패: '+msg);
    }finally{
      running=false;if(b)b.disabled=false;
    }
  }
  function bind(){
    const b=q('#syncProjects');if(!b||b.dataset.incrementalBound)return;
    b.dataset.incrementalBound='1';
    b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();run()},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();
