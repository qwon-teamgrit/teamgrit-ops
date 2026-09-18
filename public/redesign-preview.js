(()=>{
  const h=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const s=v=>String(v??'').trim();
  const n=v=>s(v).toLowerCase().replace(/\s+/g,' ');
  const q=sel=>document.querySelector(sel);
  const qa=sel=>[...document.querySelectorAll(sel)];
  const done=t=>['완료','완료됨'].includes(s(t?.status));
  const review=t=>/검토|승인|확인 필요/.test(s(t?.status))||!s(t?.owner)||!s(t?.project);
  const due=t=>s(t?.due_date||t?.dueDate);
  const dueTime=t=>{const d=Date.parse(due(t));return Number.isFinite(d)?d:Infinity};
  const overdue=t=>!done(t)&&Number.isFinite(dueTime(t))&&dueTime(t)<Date.now();
  const tid=t=>s(t?.task_id||t?.id);
  const formatDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?s(v):d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})};
  const statusTag=v=>{const x=s(v)||'확인 필요',cls=/완료/.test(x)?'green':/검토|승인/.test(x)?'amber':/보류|오류/.test(x)?'red':'blue';return `<span class="tag ${cls}">${h(x)}</span>`};

  function installTopbar(){
    if(q('#redesignTopbar'))return;
    const main=q('.main');if(!main)return;
    const bar=document.createElement('div');bar.id='redesignTopbar';bar.className='redesign-topbar';
    bar.innerHTML=`<div class="rtb-context"><span>TeamGRIT Ops</span><span class="rtb-sep">/</span><b id="rtbPage">대시보드</b></div><div class="rtb-right"><span class="rtb-state"><span class="rtb-dot"></span>Google 연결 상태는 각 화면에서 확인</span></div>`;
    main.prepend(bar);
  }
  function pageName(view){
    return {dash:'대시보드',projects:'프로젝트',work:'업무',sales:'영업',evidence:'제품 근거 · 마케팅',automation:'실행 이력'}[view]||'프로젝트';
  }
  function updateTopbar(name){const el=q('#rtbPage');if(el)el.textContent=name||pageName(typeof currentView!=='undefined'?currentView:'dash')}

  const baseShow=show;
  show=function(view){baseShow(view);updateTopbar(pageName(view))};
  window.show=show;

  function ensureDashboardShell(){
    const dashboard=q('#dashboard');if(!dashboard)return null;
    let root=q('#redesignDashboard');
    if(root)return root;
    root=document.createElement('div');root.id='redesignDashboard';root.className='dashboard-redesign';
    const head=dashboard.querySelector('.page-head');head?.after(root);
    ['#dashSources','#metrics','.dashboard-grid'].forEach(sel=>dashboard.querySelector(sel)?.classList.add('redesign-legacy-hidden'));
    const recentPanel=q('#dashTasks')?.closest('.panel');recentPanel?.classList.add('redesign-legacy-hidden');
    return root;
  }

  const baseRenderDash=renderDash;
  renderDash=function(){
    try{baseRenderDash()}catch{}
    const root=ensureDashboardShell();if(!root)return;
    const tasks=(db.tasks||[]).filter(t=>!done(t));
    const attention=[...tasks].sort((a,b)=>Number(overdue(b))-Number(overdue(a))||Number(review(b))-Number(review(a))||dueTime(a)-dueTime(b)).slice(0,12);
    const overdueN=tasks.filter(overdue).length,reviewN=tasks.filter(t=>/검토/.test(s(t.status))).length,approvalN=tasks.filter(t=>/승인/.test(s(t.status))).length;
    const todayN=tasks.filter(t=>{const d=Date.parse(due(t));if(!Number.isFinite(d))return false;const x=new Date(d),now=new Date();return x.toDateString()===now.toDateString()}).length;
    const recentExec=[...(db.executions||[])].sort((a,b)=>(Date.parse(b.finished_at||b.started_at||0)||0)-(Date.parse(a.finished_at||a.started_at||0)||0)).slice(0,7);
    root.innerHTML=`
      <section class="action-surface">
        <div class="surface-head"><div><h2>지금 처리할 업무</h2><p>지연 → 검토·승인 → 가까운 기한 순으로 정렬됩니다.</p></div><button class="text-btn" onclick="show('work')">전체 업무 보기 →</button></div>
        <div class="action-list">${attention.length?attention.map(t=>`<div class="action-row ${overdue(t)?'overdue':''}" onclick="openTaskDrawer('${encodeURIComponent(tid(t))}')"><span class="kind">${overdue(t)?'지연':/승인/.test(s(t.status))?'승인':/검토/.test(s(t.status))?'검토':'업무'}</span><div class="title"><b>${h(t.title||'이름 없는 업무')}</b><span>${h(t.project||'프로젝트 확인 필요')}</span></div><span class="owner">${h(t.owner||'담당자 확인 필요')}</span><span class="due">${h(due(t)||'기한 확인 필요')}</span></div>`).join(''):'<div class="empty">지금 바로 처리할 업무가 없습니다.</div>'}</div>
      </section>
      <aside>
        <section class="summary-surface"><div class="surface-head"><div><h2>처리 요약</h2><p>숫자보다 다음 행동을 우선합니다.</p></div></div><div class="summary-list">
          <button class="summary-line" onclick="show('work')"><span>기한 지남</span><b>${overdueN}</b></button>
          <button class="summary-line" onclick="show('work')"><span>오늘 기한</span><b>${todayN}</b></button>
          <button class="summary-line" onclick="show('work')"><span>검토 대기</span><b>${reviewN}</b></button>
          <button class="summary-line" onclick="show('work')"><span>승인 대기</span><b>${approvalN}</b></button>
        </div></section>
        <section class="summary-surface" style="margin-top:16px"><div class="surface-head"><div><h2>최근 자동화</h2><p>최근 실행 상태</p></div><button class="text-btn" onclick="show('automation')">전체 보기 →</button></div><div class="activity-list">${recentExec.length?recentExec.map(e=>`<div class="activity-line"><b>${h(e.action||'자동화 실행')}</b><span>${h(e.status||'상태 확인 필요')} · ${h(fmtDate(e.finished_at||e.started_at||''))}</span></div>`).join(''):'<div class="empty">최근 자동화 실행이 없습니다.</div>'}</div></section>
      </aside>`;
  };

  const baseRenderProjects=renderProjects;
  renderProjects=function(){
    baseRenderProjects();
    const list=q('#projectList');if(!list)return;
    const ids=qa('#projectList [data-project]').map(el=>el.dataset.project);
    const pagination=q('#projectList .project-pagination');
    const projects=ids.map(id=>window.TG_WORKLOG_PROJECTS?.[id]||(db.projects||[]).find(p=>s(p.id)===s(id))).filter(Boolean);
    const rows=projects.map(p=>{
      const tasks=p._worklogTasks||[];
      const open=tasks.filter(t=>!done(t)),owners=[...new Set(tasks.flatMap(t=>s(t.owner).split(/[,/·]/).map(s).filter(Boolean)))];
      const next=[...open].filter(t=>Number.isFinite(dueTime(t))).sort((a,b)=>dueTime(a)-dueTime(b))[0],reviewCount=open.filter(review).length;
      return `<tr data-project="${h(p.id)}"><td><div class="pname">${h(p.name)}</div><span class="psub">${h(p.customer||p.category||'업무일지')}</span></td><td>${statusTag(p.status||'진행 중')}</td><td><div class="owner-stack">${owners.slice(0,4).map(o=>`<span class="owner-dot" title="${h(o)}">${h(o.slice(0,1))}</span>`).join('')}${owners.length>4?`<span class="owner-more">+${owners.length-4}</span>`:''}</div></td><td class="num">${open.length}</td><td class="num ${reviewCount?'review-count':'muted-zero'}">${reviewCount}</td><td class="deadline">${h(next?due(next):'—')}</td><td class="deadline">${h(formatDate(p.updatedAt||p.updated_at))}</td></tr>`;
    }).join('');
    list.innerHTML=`<div class="project-index-wrap"><table class="project-index"><colgroup><col style="width:31%"><col style="width:12%"><col style="width:17%"><col style="width:10%"><col style="width:10%"><col style="width:11%"><col style="width:9%"></colgroup><thead><tr><th>프로젝트</th><th>상태</th><th>담당자</th><th class="num">남은 업무</th><th class="num">검토·승인</th><th>다음 기한</th><th>업데이트</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    if(pagination){pagination.className='project-page-foot';list.appendChild(pagination)}
    bindProjectRows();
  };

  const baseRenderWork=renderWork;
  renderWork=function(){
    baseRenderWork();
    const box=q('#registeredTasks');if(!box)return;
    const ids=qa('#registeredTasks [data-task-row]').map(el=>el.dataset.taskRow);
    if(!ids.length){return}
    const rows=ids.map(id=>(db.tasks||[]).find(t=>tid(t)===id)).filter(Boolean).map(t=>`<tr><td><button class="task-name" onclick="openTaskDrawer('${encodeURIComponent(tid(t))}')">${h(t.title||'이름 없는 업무')}</button><span class="source-line">${h(t.origin_detail||t.source||'중앙 업무표')}</span></td><td>${h(t.project||'확인 필요')}</td><td>${h(t.owner||'확인 필요')}</td><td class="${overdue(t)?'late':''}">${h(due(t)||'확인 필요')}</td><td><select onchange="updateTaskStatus('${encodeURIComponent(tid(t))}',this.value)">${['예정','진행 중','검토 필요','승인 대기','보류','완료'].map(v=>`<option ${s(t.status)===v?'selected':''}>${v}</option>`).join('')}</select></td></tr>`).join('');
    box.innerHTML=`<table class="task-index"><colgroup><col style="width:44%"><col style="width:18%"><col style="width:14%"><col style="width:12%"><col style="width:12%"></colgroup><thead><tr><th>업무</th><th>프로젝트</th><th>담당자</th><th>기한</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  function projectActivity(p){
    const aliases=[p.name,...(p._aliases||[])].map(n);
    const relatedTasks=(db.tasks||[]).filter(t=>aliases.some(a=>n(t.project)===a||n(t.project).includes(a)||a.includes(n(t.project))));
    const relatedExec=(db.executions||[]).filter(e=>aliases.some(a=>n(e.project_name||e.project)===a));
    const items=[
      ...relatedTasks.map(t=>({at:t.updated_at||t.created_at,type:'업무',title:t.title,meta:`${t.owner||'담당자 확인 필요'} · ${t.status||'상태 확인 필요'}`})),
      ...relatedExec.map(e=>({at:e.finished_at||e.started_at,type:'AI 실행',title:e.action||'자동화 실행',meta:`${e.status||'상태 확인 필요'}${e.model?' · '+e.model:''}`}))
    ].sort((a,b)=>(Date.parse(b.at||0)||0)-(Date.parse(a.at||0)||0)).slice(0,40);
    return items;
  }
  function ensureDetailPanes(p){
    const detail=q('#projectDetail'),overview=q('#projectOverviewPane'),files=q('#projectFilesPane'),ai=q('#projectAiPane'),tabs=q('#projectTabs');if(!detail||!overview||!files||!ai||!tabs)return;
    let work=q('#projectWorkPane');if(!work){work=document.createElement('div');work.id='projectWorkPane';work.className='project-pane redesign-pane';files.before(work)}
    let activity=q('#projectActivityPane');if(!activity){activity=document.createElement('div');activity.id='projectActivityPane';activity.className='project-pane redesign-pane';ai.after(activity)}
    const historyHtml=q('#projectMemberTasks')?.innerHTML||'<div class="empty">업무 이력을 불러오지 못했습니다.</div>';
    work.innerHTML=`<section class="workspace"><div class="section"><div class="section-title"><div><h3>전체 업무</h3><span class="muted">업무진행 문서 전체 기간에서 이 프로젝트에 참여한 담당자별 업무 이력입니다.</span></div></div><div class="project-history-preview">${historyHtml}</div></div></section>`;
    const src=q('#projectSources')?.innerHTML||'';
    let evidence=q('#projectEvidencePreview');if(!evidence){evidence=document.createElement('div');evidence.id='projectEvidencePreview';evidence.className='panel';files.prepend(evidence)}
    evidence.innerHTML=`<div class="ph"><div><b>연결 근거</b><span class="muted">프로젝트에 연결된 원본 문서와 링크</span></div></div><div class="pb">${src||'<div class="empty">연결된 원본 근거가 없습니다.</div>'}</div>`;
    const acts=projectActivity(p);
    activity.innerHTML=`<section class="workspace"><div class="section"><div class="section-title"><div><h3>활동 이력</h3><span class="muted">업무 상태 변경과 AI 실행 기록을 시간순으로 확인합니다.</span></div></div><div class="activity-index">${acts.length?acts.map(x=>`<div class="activity-item"><time>${h(formatDate(x.at))}</time><b>${h(x.title||x.type)}</b><span>${h(x.type)} · ${h(x.meta||'')}</span></div>`).join(''):'<div class="empty">이 프로젝트의 활동 이력이 없습니다.</div>'}</div></div></section>`;
    const historySection=q('#projectMemberTasks')?.closest('.section');if(historySection)historySection.style.display='none';
    tabs.innerHTML=`<button class="active" data-r-tab="overview">개요</button><button data-r-tab="work">업무</button><button data-r-tab="files">자료</button><button data-r-tab="ai">AI 결과</button><button data-r-tab="activity">활동 이력</button>`;
    const panes={overview,work,files,ai,activity};
    const select=key=>{Object.entries(panes).forEach(([k,node])=>{if(node)node.classList.toggle('hidden',k!==key)});qa('#projectTabs [data-r-tab]').forEach(b=>b.classList.toggle('active',b.dataset.rTab===key));if(key==='files'&&typeof loadFiles==='function')loadFiles()};
    qa('#projectTabs [data-r-tab]').forEach(b=>b.onclick=()=>select(b.dataset.rTab));select('overview');
  }

  const baseOpenProject=openProject;
  openProject=async function(id){await baseOpenProject(id);const p=current();if(p){ensureDetailPanes(p);updateTopbar(p.name)}};
  window.openProject=openProject;

  function installCopy(){
    const dash=q('#dashboard .page-head');if(dash){dash.querySelector('.eyebrow').textContent='TODAY';dash.querySelector('h1').textContent='오늘 처리할 업무';dash.querySelector('.muted').textContent='지연, 검토와 승인을 먼저 처리하고 다음 행동으로 바로 이동합니다.'}
    const proj=q('#projects .page-head');if(proj){proj.querySelector('.eyebrow').textContent='PROJECTS';proj.querySelector('h1').textContent='프로젝트';proj.querySelector('.muted').textContent='상태, 담당자, 다음 기한과 검토 대기를 한 화면에서 비교합니다.'}
    const work=q('#work .page-head');if(work){work.querySelector('.eyebrow').textContent='TASKS';work.querySelector('h1').textContent='업무';work.querySelector('.muted').textContent='처리 우선순위에 따라 업무를 찾고 상태를 변경하거나 AI 결과를 검토합니다.'}
    const aiHead=q('#aiReviewPanel .ph .ai-panel-head')||q('#aiReviewPanel .ph');if(aiHead){}
  }

  installTopbar();installCopy();
  const currentSection=qa('.main>section:not(.hidden)')[0]?.id||'dashboard';
  updateTopbar(currentSection==='dashboard'?'대시보드':currentSection==='projects'?'프로젝트':currentSection==='work'?'업무':'TeamGRIT Ops');
  try{renderAll()}catch{}
  window.TG_REDESIGN_PREVIEW=true;
})();