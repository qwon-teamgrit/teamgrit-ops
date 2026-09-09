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
  function render(message,detail=''){
    const box=ensureBox();if(!box)return;
    box.style.display='block';
    const elapsed=startedAt?Math.max(0,Math.floor((Date.now()-startedAt)/1000)):0;
    box.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:50%;background:#1967d2;box-shadow:0 0 0 4px rgba(25,103,210,.12)"></span><b>${message}</b><span class="muted">${fmt(elapsed)}</span></div>${detail?`<div class="muted" style="margin-top:6px">${detail}</div>`:''}<div style="height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:10px"><div id="syncProgressBar" style="height:100%;width:35%;background:#1967d2;border-radius:999px;animation:tgSync 1.2s ease-in-out infinite alternate"></div></div>`;
    if(!q('#tgSyncStyle')){const st=document.createElement('style');st.id='tgSyncStyle';st.textContent='@keyframes tgSync{from{transform:translateX(-70%)}to{transform:translateX(260%)}}';document.head.appendChild(st)}
  }
  async function poll(){
    try{
      const r=await fetch('/api/live-data?action=bootstrap',{cache:'no-store'});const d=await r.json();
      const s=d?.syncState;
      if(!s)return;
      if(s.status==='진행 중')render(s.value||'원본 동기화 진행 중','Drive 원본을 읽고 프로젝트 정보를 갱신하고 있습니다.');
      else if(['성공','부분 성공'].includes(s.status)){finish(true,`${s.status}: ${s.value||''}`,s.error||'');}
      else if(s.status==='실패'){finish(false,'동기화 실패',s.error||s.value||'');}
    }catch{}
  }
  function finish(ok,title,detail){
    clearInterval(timer);timer=null;
    const box=ensureBox();if(!box)return;
    const elapsed=startedAt?Math.max(0,Math.floor((Date.now()-startedAt)/1000)):0;
    box.style.display='block';
    box.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><span class="tag ${ok?'green':'amber'}">${ok?'완료':'확인 필요'}</span><b>${title}</b><span class="muted">${fmt(elapsed)}</span></div>${detail?`<div class="muted" style="margin-top:6px">${detail}</div>`:''}`;
  }
  function start(){
    if(timer)return;
    startedAt=Date.now();
    render('최신 원본 전체 동기화 시작','2026년 팀그릿 업무진행 · 시스템개발팀 · 연결 Drive 자료를 최신 수정본 기준으로 다시 읽습니다.');
    timer=setInterval(poll,2000);
    poll();
  }
  function bind(){
    const b=q('#syncProjects');if(!b||b.dataset.progressBound)return;
    b.dataset.progressBound='1';
    b.addEventListener('click',()=>start(),true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();
