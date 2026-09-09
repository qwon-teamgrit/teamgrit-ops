(()=>{
  const original=window.sourceOverview;
  window.sourceOverview=function(){
    const roots=['2026년 팀그릿 업무진행','시스템개발팀'];
    const counts=(items)=>({full:items.filter(s=>s.read_status==='전체 읽음').length,partial:items.filter(s=>s.read_status==='일부 읽음').length,bad:items.filter(s=>s.read_status==='연결 안 됨'||s.status==='연결 안 됨').length});
    const badges=roots.map(r=>{const n=db.sources.filter(s=>s.root_source===r),c=counts(n),root=n.find(s=>s.title===r)||n[0],rootState=root?.read_status||root?.status||'연결 안 됨',cls=rootState==='전체 읽음'?'green':rootState==='일부 읽음'?'amber':'amber';return `<span class="tag ${cls}">${esc(r)} · ${esc(rootState)}</span> <span class="muted">원본 ${n.length}개 · 전체 읽음 ${c.full} · 일부 읽음 ${c.partial} · 연결 안 됨 ${c.bad}</span>`}).join(' ');
    if(!db.sources.length)return `${badges}<div class="empty" style="margin-top:12px">아직 수집된 원본이 없습니다.</div>`;
    const rows=db.sources.map(s=>`<tr><td>${s.url?`<a target="_blank" href="${esc(s.url)}">${esc(s.title)}</a>`:esc(s.title)}</td><td>${esc(s.root_source||'-')}</td><td>${esc(s.read_status||s.status||'연결 안 됨')}</td><td>${esc(s.read_detail||'')}</td><td>${esc(s.content_chars||0)}</td><td>${esc(s.discovered_links||0)}</td><td>${esc(fmtDate(s.modified_time))}</td></tr>`).join('');
    return `<div class="taskActions" style="margin-bottom:10px">${badges}</div><table class="table"><thead><tr><th>원본</th><th>루트</th><th>읽기 상태</th><th>상세</th><th>본문 문자</th><th>발견 링크</th><th>최종 수정</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
})();
