(()=>{
  let timer=null,startedAt=0;
  const q=s=>document.querySelector(s);
  const fmt=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
  function ensureBox(){
    let box=q('#syncProgressBox');
    if(box)return box;
    const state=q('#projectSourceState');
    if(!state)return null;
    box=document.createElement('div');
    box.id='syncProgressBox';
    box.style.cssText='margin-top:10px;padding:12px 14px;border:1px solid #d8dee8;border-radius:12px;background:#fff;display:none';
    state.insertAdjacentElement('afterend',box);
    return box;
  }
  function draw(message,detail=''){
    const box=ensureBox();if(!box)return;
    box.style.display='block';
    const elapsed=startedAt?Math.max(0,Math.floor((Date.now()-startedAt)/1000)):0;
    box.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:50%;background:#1967d2;box-shadow:0 0 0 4px rgba(25,103,210,.12)"></span><b>${message}</b><span class="muted">${fmt(elapsed)}</span></div>${detail?`<div class="muted" style="margin-top:6px">${detail}</div>`:''}<div style="height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:10px"><div style="height:100%;width:35%;background:#1967d2;border-radius:999px;animation:tgSync 1.2s ease-in-out infinite alternate"></div></div>`;
    if(!q('#tgSyncStyle')){const st=document.createElement('style');st.id='tgSyncStyle';st.textContent='@keyframes tgSync{from{transform:translateX(-70%)}to{transform:translateX(260%)}}';document.head.appendChild(st)}
  }
  function finish(ok,title,detail=''){
    if(timer){clearInterval(timer);timer=null}
    const box=ensureBox();if(!box)return;
    const elapsed=startedAt?Math.max(0,Math.floor((Date.now()-startedAt)/1000)):0;
    box.style.display='block';
    box.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><span class="tag ${ok?'green':'amber'}">${ok?'완료':'중단'}</span><b>${title}</b><span class="muted">${fmt(elapsed)}</span></div>${detail?`<div class="muted" style="margin-top:6px">${detail}</div>`:''}`;
  }
  function start(){
    if(timer)return;
    startedAt=Date.now();
    draw('최신 원본 전체 동기화 중','Drive 원본을 읽고 프로젝트 정보를 갱신하고 있습니다. 진행 표시 자체는 Google API를 추가 호출하지 않습니다.');
    timer=setInterval(()=>draw('최신 원본 전체 동기화 중','Drive 원본을 읽고 프로젝트 정보를 갱신하고 있습니다. 진행 표시 자체는 Google API를 추가 호출하지 않습니다.'),1000);
  }
  function bind(){
    const b=q('#syncProjects');if(!b||b.dataset.progressBound)return;
    b.dataset.progressBound='1';
    b.addEventListener('click',start,true);
  }
  const originalAlert=window.alert.bind(window);
  window.alert=function(message){
    const text=String(message||'');
    if(text.includes('원본 동기화 실패')) finish(false,'원본 동기화 중단',text.replace(/^원본 동기화 실패:\s*/,''));
    else if(text.includes('원본 동기화 완료')) finish(true,'원본 동기화 완료');
    return originalAlert(message);
  };
  window.addEventListener('tg-sync-failed',e=>finish(false,'원본 동기화 중단',e.detail?.message||''));
  window.addEventListener('tg-sync-complete',e=>finish(true,'원본 동기화 완료',e.detail?.message||''));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();
