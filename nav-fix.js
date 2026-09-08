(function(){
  const pageIds=['dashboard','projects','knowledge','sales','automation','projectDetail'];
  const navMap={dash:'navDash',projects:'navProjects',sales:'navSales',automation:'navAutomation'};

  function hideAllViews(){
    pageIds.forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  }

  function renderAutomation(){
    const projects=(window.db&&db.projects)||[];
    const opportunities=(window.db&&db.opportunities)||[];
    const results=projects.flatMap(p=>p.results||[]);
    const pending=opportunities.filter(o=>o.nextAction&&!['수주','보류'].includes(o.stage)).length;
    const high=opportunities.filter(o=>o.priority==='높음').length;
    const connected=projects.filter(p=>p.driveFolderId).length;
    const m=document.getElementById('automationMetrics');
    if(m)m.innerHTML=`<div class="metric"><b>${pending}</b><span class="muted">확인할 자동화 제안</span></div><div class="metric"><b>${high}</b><span class="muted">높은 우선순위</span></div><div class="metric"><b>${connected}</b><span class="muted">Drive 기준 프로젝트</span></div><div class="metric"><b>${results.length}</b><span class="muted">자동화 실행</span></div>`;
    const d=document.getElementById('automationDrive');
    if(d)d.innerHTML=connected?projects.filter(p=>p.driveFolderId).map(p=>`<div class="file"><b>${esc(p.name)}</b><br><span class="muted">Drive 연결됨 · 요청 ${(p.requests||[]).length}건 · 결과 ${(p.results||[]).length}건</span></div>`).join(''):'<div class="empty">Drive가 연결된 프로젝트에서 자동화 실행을 하면 기준이 저장됩니다.</div>';
    const n=document.getElementById('automationNext');
    if(n)n.innerHTML=pending?opportunities.filter(o=>o.nextAction&&!['수주','보류'].includes(o.stage)).map(o=>`<div class="knowledge-row"><div><b>${esc(o.title||'영업 기회')}</b><div>${esc(o.nextAction)}</div><div class="muted">${esc(o.stage||'신규')} · ${esc(o.nextActionDate||'일정 미정')}</div></div></div>`).join(''):'<div class="empty">자동화 실행 후 필요한 후속 업무가 표시됩니다.</div>';
    const h=document.getElementById('automationHistory');
    if(h)h.innerHTML=results.length?results.slice(0,20).map(r=>`<div class="result"><span class="tag green">실행 완료</span><br><b>${esc(r.title||'결과물')}</b><br><span class="muted">${esc(r.type||'')} · ${fmtDate(r.createdAt)}</span></div>`).join(''):'<div class="empty">아직 실행 이력이 없습니다.</div>';
  }

  function switchView(view){
    hideAllViews();
    currentView=view;
    if(view==='dash'){
      document.getElementById('dashboard')?.classList.remove('hidden');
      document.getElementById('navDash')?.classList.add('active');
      renderDash();
    }else if(view==='projects'){
      document.getElementById('projects')?.classList.remove('hidden');
      document.getElementById('navProjects')?.classList.add('active');
      renderProjects();
    }else if(view==='sales'){
      document.getElementById('sales')?.classList.remove('hidden');
      document.getElementById('navSales')?.classList.add('active');
      renderSales();
    }else if(view==='automation'){
      document.getElementById('automation')?.classList.remove('hidden');
      document.getElementById('navAutomation')?.classList.add('active');
      renderAutomation();
    }
    authStatus();
    window.scrollTo({top:0,left:0,behavior:'auto'});
  }

  window.hideAll=hideAllViews;
  window.show=switchView;
  window.renderAutomation=renderAutomation;

  const navDash=document.getElementById('navDash');
  const navProjects=document.getElementById('navProjects');
  const navSales=document.getElementById('navSales');
  const navAutomation=document.getElementById('navAutomation');
  if(navDash)navDash.onclick=()=>switchView('dash');
  if(navProjects)navProjects.onclick=()=>switchView('projects');
  if(navSales)navSales.onclick=()=>switchView('sales');
  if(navAutomation)navAutomation.onclick=()=>switchView('automation');
  const back=document.getElementById('backProjects');
  if(back)back.onclick=()=>switchView('projects');

  // Always start from exactly one visible page so stale sections never stack.
  switchView('dash');
})();
