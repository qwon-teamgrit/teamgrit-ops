(()=>{
  function uniqueSources(list){
    const map=new Map();
    for(const s of list||[]){
      const key=s.file_id||s.source_id||s.url||s.title;
      const prev=map.get(key);
      if(!prev){map.set(key,s);continue}
      const a=Date.parse(prev.last_synced_at||prev.modified_time||0)||0;
      const b=Date.parse(s.last_synced_at||s.modified_time||0)||0;
      if(b>=a)map.set(key,s);
    }
    return [...map.values()];
  }
  function installLayout(){
    const projects=document.querySelector('#projects');
    if(!projects||projects.dataset.splitLayout==='1')return;
    const panels=[...projects.children].filter(el=>el.classList?.contains('panel'));
    if(panels.length<2)return;
    const grid=document.createElement('div');
    grid.className='project-split-grid';
    panels[0].parentNode.insertBefore(grid,panels[0]);
    grid.appendChild(panels[0]);
    grid.appendChild(panels[1]);
    panels[0].classList.add('project-source-panel');
    panels[1].classList.add('project-list-panel');
    const sourceBody=panels[0].querySelector('.pb');
    const projectBody=panels[1].querySelector('.pb');
    if(sourceBody)sourceBody.classList.add('project-panel-scroll');
    if(projectBody)projectBody.classList.add('project-panel-scroll');
    projects.dataset.splitLayout='1';
    if(!document.querySelector('#projectSplitStyle')){
      const style=document.createElement('style');
      style.id='projectSplitStyle';
      style.textContent=`
        .project-split-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:16px;align-items:start}
        .project-split-grid>.panel{margin:0;min-width:0}
        .project-panel-scroll{height:560px;max-height:560px;overflow:auto;overscroll-behavior:contain}
        .project-panel-scroll .table{min-width:720px}
        .project-panel-scroll .table thead th{position:sticky;top:0;z-index:2;background:#fff}
        #sourceOverview .source-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
        #sourceOverview .source-root-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
        @media(max-width:1180px){.project-split-grid{grid-template-columns:1fr}.project-panel-scroll{height:480px;max-height:480px}}
      `;
      document.head.appendChild(style);
    }
  }
  window.sourceOverview=function(){
    installLayout();
    const sources=uniqueSources(db.sources||[]).sort((a,b)=>(Date.parse(b.modified_time||0)||0)-(Date.parse(a.modified_time||0)||0));
    const roots=['2026년 팀그릿 업무진행','시스템개발팀'];
    const counts=items=>({full:items.filter(s=>s.read_status==='전체 읽음').length,partial:items.filter(s=>s.read_status==='일부 읽음').length,bad:items.filter(s=>s.read_status==='연결 안 됨'||s.status==='연결 안 됨').length});
    const total=counts(sources);
    const rootRows=roots.map(r=>{
      const n=sources.filter(s=>s.root_source===r),c=counts(n),root=n.find(s=>s.title===r)||n[0];
      const state=root?.read_status||root?.status||'연결 안 됨';
      const cls=state==='전체 읽음'?'green':'amber';
      return `<div class="source-root-row"><span class="tag ${cls}">${esc(r)} · ${esc(state)}</span><span class="muted">${n.length}개 · 전체 ${c.full} · 일부 ${c.partial} · 연결 안 됨 ${c.bad}</span></div>`;
    }).join('');
    const summary=`<div class="source-summary"><span class="tag green">전체 읽음 ${total.full}</span><span class="tag amber">일부 읽음 ${total.partial}</span><span class="tag amber">연결 안 됨 ${total.bad}</span><span class="muted">중복 제거 기준 원본 ${sources.length}개</span></div>${rootRows}`;
    if(!sources.length)return `${summary}<div class="empty" style="margin-top:12px">아직 수집된 원본이 없습니다.</div>`;
    const rows=sources.map(s=>`<tr><td>${s.url?`<a target="_blank" href="${esc(s.url)}">${esc(s.title)}</a>`:esc(s.title)}</td><td>${esc(s.root_source||'-')}</td><td>${esc(s.read_status||s.status||'연결 안 됨')}</td><td>${esc(fmtDate(s.modified_time))}</td><td>${esc(fmtDate(s.last_synced_at))}</td></tr>`).join('');
    return `${summary}<table class="table"><thead><tr><th>원본</th><th>루트</th><th>읽기 상태</th><th>원본 수정</th><th>마지막 동기화</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
  function refreshLayout(){installLayout();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshLayout);else refreshLayout();
  new MutationObserver(refreshLayout).observe(document.documentElement,{childList:true,subtree:true});
})();
