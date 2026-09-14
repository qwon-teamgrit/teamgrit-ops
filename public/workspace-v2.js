(()=>{
  const ui={projectSearch:'',projectCategory:'전체',projectStatus:'전체',workTab:'open',taskSearch:'',taskProject:'전체',taskOwner:'전체',taskStatus:'전체'};
  const doneStates=['완료','완료됨','폐기됨','드랍'];
  const taskStates=['예정','진행 전','진행 중','검토 대기','보류','완료'];
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/\s+/g,' ');
  const isDone=t=>doneStates.includes(clean(t?.status));
  const needsReview=t=>['', '확인 필요'].includes(clean(t?.owner))||['','확인 필요'].includes(clean(t?.due_date||t?.dueDate))||/검토|확인/.test(clean(t?.status));
  const taskId=t=>clean(t?.task_id||t?.id);
  const taskDue=t=>clean(t?.due_date||t?.dueDate);
  const todayStart=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
  const dueTime=t=>{const v=taskDue(t);if(!v||v==='확인 필요')return Infinity;const n=Date.parse(v);return Number.isFinite(n)?n:Infinity};
  const isOverdue=t=>!isDone(t)&&dueTime(t)<todayStart();
  const fmtShort=v=>{if(!v||v==='확인 필요')return '기한 확인';const n=Date.parse(v);if(!Number.isFinite(n))return v;return new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric'}).format(new Date(n))};
  const statusClass=v=>{const s=clean(v);if(doneStates.includes(s))return 'green';if(/검토|확인/.test(s))return 'purple';if(/보류|지연/.test(s))return 'amber';if(/진행/.test(s))return 'blue';return ''};
  const tag=v=>`<span class="tag ${statusClass(v)}">${esc(v||'확인 필요')}</span>`;
  let toastTimer=null;

  function toast(message){const el=q('#toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
  function unique(values){return [...new Set(values.map(clean).filter(v=>v&&v!=='확인 필요'))].sort((a,b)=>a.localeCompare(b,'ko'))}
  function fillSelect(el,values,allLabel,current){if(!el)return;const selected=current||el.value||'전체';el.innerHTML=`<option value="전체">${esc(allLabel)}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');el.value=values.includes(selected)?selected:'전체'}
  function empty(message){return `<div class="empty">${esc(message)}</div>`}
  function setNavCount(){const count=db.tasks.filter(t=>!isDone(t)).length,el=q('#navWorkCount');if(!el)return;el.textContent=count;el.classList.toggle('hidden',count===0)}

  renderDash=function(){
    const projects=db.projects||[],tasks=db.tasks||[],active=projects.filter(p=>!doneStates.includes(clean(p.status))),open=tasks.filter(t=>!isDone(t)),review=open.filter(needsReview),late=open.filter(isOverdue);
    q('#metrics').innerHTML=`<div class="metric"><b>${active.length}</b><span class="muted">진행 프로젝트</span></div><div class="metric priority"><b>${open.length}</b><span class="muted">처리할 업무</span></div><div class="metric review"><b>${review.length}</b><span class="muted">확인 필요</span></div><div class="metric ${late.length?'priority':'good'}"><b>${late.length}</b><span class="muted">기한 지남</span></div>`;
    q('#dashSources').innerHTML=`${sourceState(connection.data,'운영 데이터')} ${sourceState(connection.tasks,'업무 데이터')} ${syncBadge()}`;
    const attention=[...open].sort((a,b)=>Number(isOverdue(b))-Number(isOverdue(a))||Number(needsReview(b))-Number(needsReview(a))||dueTime(a)-dueTime(b)).slice(0,7);
    q('#dashAttention').innerHTML=attention.length?attention.map(t=>{const state=isOverdue(t)?'late':needsReview(t)?'review':'',reason=isOverdue(t)?'기한 지남':needsReview(t)?'담당자·기한 확인 필요':clean(t.status||'예정');return `<div class="attention-row"><span class="attention-dot ${state}"></span><div><button class="task-title-btn" onclick="openTaskDrawer('${encodeURIComponent(taskId(t))}')">${esc(t.title)}</button><div class="row-meta">${esc(t.project||'프로젝트 확인 필요')} · ${esc(t.owner||'담당자 확인 필요')} · ${esc(fmtShort(taskDue(t)))}</div></div><span class="tag ${state==='late'?'red':state==='review'?'purple':'blue'}">${esc(reason)}</span></div>`}).join(''):empty('지금 바로 확인할 업무가 없습니다.');
    q('#dashProjects').innerHTML=active.length?active.slice(0,6).map(p=>{const pt=tasks.filter(t=>norm(t.project)===norm(p.name)),complete=pt.filter(isDone).length,progress=pt.length?Math.round(complete/pt.length*100):(/완료/.test(clean(p.status))?100:/진행|개발/.test(clean(p.status))?55:20);return `<div class="project-snapshot" data-project="${esc(p.id)}"><div><div class="project-name">${esc(p.name)}</div><div class="project-sub">${esc(p.customer||p.category||'기타')} · 남은 업무 ${pt.length-complete}개</div><div class="project-progress"><span style="width:${Math.max(4,progress)}%"></span></div></div>${tag(p.status||'확인 필요')}</div>`}).join(''):empty('진행 중인 프로젝트가 없습니다.');
    const recent=[...tasks].sort((a,b)=>(Date.parse(b.created_at||b.updated_at||0)||0)-(Date.parse(a.created_at||a.updated_at||0)||0)).slice(0,6);
    q('#dashTasks').innerHTML=recent.length?recent.map(t=>`<div class="recent-task-row"><div><button class="task-title-btn" onclick="openTaskDrawer('${encodeURIComponent(taskId(t))}')">${esc(t.title)}</button><span class="task-source">${esc(t.source||'중앙 업무표')}</span></div><span class="task-cell">${esc(t.project||'확인 필요')}</span><span class="task-cell">${esc(t.owner||'확인 필요')}</span>${tag(t.status||'예정')}</div>`).join(''):empty('최근 등록된 업무가 없습니다.');
    bindProjectRows();setNavCount();
  };

  function projectFilters(){
    fillSelect(q('#projectCategoryFilter'),unique(db.projects.map(p=>p.category)),'모든 분류',ui.projectCategory);
    fillSelect(q('#projectStatusFilter'),unique(db.projects.map(p=>p.status)),'모든 상태',ui.projectStatus);
    ui.projectCategory=q('#projectCategoryFilter')?.value||'전체';ui.projectStatus=q('#projectStatusFilter')?.value||'전체';
  }
  renderProjects=function(){
    projectFilters();
    const all=db.projects||[],search=norm(ui.projectSearch),filtered=all.filter(p=>(ui.projectCategory==='전체'||clean(p.category)===ui.projectCategory)&&(ui.projectStatus==='전체'||clean(p.status)===ui.projectStatus)&&(!search||norm(`${p.name} ${p.customer} ${p.category}`).includes(search)));
    const active=all.filter(p=>!doneStates.includes(clean(p.status))).length,review=all.filter(p=>/검토|확인/.test(clean(p.status))||!clean(p.category)).length,connected=all.filter(p=>p.driveFolderId||p.driveUrl||p.connectionStatus==='연결됨').length;
    q('#projectMetrics').innerHTML=`<div class="metric"><b>${all.length}</b><span class="muted">전체 프로젝트</span></div><div class="metric priority"><b>${active}</b><span class="muted">진행 중</span></div><div class="metric review"><b>${review}</b><span class="muted">검토 필요</span></div><div class="metric good"><b>${connected}</b><span class="muted">Drive 연결</span></div>`;
    q('#projectSourceState').innerHTML=`${sourceState(connection.data,'운영 데이터')} ${syncBadge()}`;
    const cats=['전체',...unique(all.map(p=>p.category)).slice(0,5)];
    q('#catTabs').innerHTML=cats.map(c=>`<button data-cat="${esc(c)}" class="${c===ui.projectCategory?'active':''}">${esc(c==='전체'?'전체':c)}</button>`).join('');
    q('#projectResultCount').textContent=`${filtered.length}개 프로젝트`;
    q('#projectList').innerHTML=connection.data?(filtered.length?`<div class="project-list">${filtered.map(p=>{const sources=(p.sources||[]).length,taskCount=db.tasks.filter(t=>norm(t.project)===norm(p.name)&&!isDone(t)).length;return `<div class="project-row" data-project="${esc(p.id)}"><div><div class="project-name">${esc(p.name)}</div><div class="project-sub">남은 업무 ${taskCount}개 · 원본 ${sources}개</div></div><span class="project-customer">${esc(p.customer||'-')}</span><span>${esc(p.category||'기타')}</span>${tag(p.status||'확인 필요')}<span class="tag ${sources?'green':'amber'}">${sources?'연결됨':'확인 필요'}</span><span class="chevron">›</span></div>`}).join('')}</div>`:empty('검색 조건에 맞는 프로젝트가 없습니다.')):empty('중앙 운영 데이터에 연결하면 프로젝트가 표시됩니다.');
    q('#sourceOverview').innerHTML=connection.data?sourceOverview():empty('원본 데이터가 연결되지 않았습니다.');
    qa('[data-cat]').forEach(b=>b.onclick=()=>{ui.projectCategory=b.dataset.cat;if(q('#projectCategoryFilter'))q('#projectCategoryFilter').value=ui.projectCategory;renderProjects()});
    bindProjectRows();
  };

  function taskMatchesTab(t){if(ui.workTab==='done')return isDone(t);if(ui.workTab==='review')return !isDone(t)&&needsReview(t);return !isDone(t)}
  function taskFilters(){
    fillSelect(q('#taskProjectFilter'),unique(db.tasks.map(t=>t.project)),'모든 프로젝트',ui.taskProject);
    fillSelect(q('#taskOwnerFilter'),unique(db.tasks.map(t=>t.owner)),'모든 담당자',ui.taskOwner);
    fillSelect(q('#taskStatusFilter'),unique(db.tasks.map(t=>t.status)),'모든 상태',ui.taskStatus);
    ui.taskProject=q('#taskProjectFilter')?.value||'전체';ui.taskOwner=q('#taskOwnerFilter')?.value||'전체';ui.taskStatus=q('#taskStatusFilter')?.value||'전체';
  }
  function statusOptions(value){return [...new Set([value,...taskStates].filter(Boolean))].map(v=>`<option ${v===value?'selected':''}>${esc(v)}</option>`).join('')}
  function taskRows(tasks){return tasks.map(t=>`<div class="task-row" data-task-row="${esc(taskId(t))}"><div class="task-main"><button class="task-title-btn" onclick="openTaskDrawer('${encodeURIComponent(taskId(t))}')">${esc(t.title||'이름 없는 업무')}</button><span class="task-source">${esc(t.source||'중앙 업무표')}</span></div><span class="task-cell task-project">${esc(t.project||'확인 필요')}</span><span class="task-cell task-owner">${esc(t.owner||'확인 필요')}</span><span class="task-cell task-due ${isOverdue(t)?'overdue':''}">${esc(fmtShort(taskDue(t)))}</span><span class="task-status"><select class="task-status-select" aria-label="${esc(t.title)} 상태" onchange="updateTaskStatus('${encodeURIComponent(taskId(t))}',this.value)">${statusOptions(clean(t.status)||'예정')}</select></span><button class="task-more" aria-label="업무 상세" onclick="openTaskDrawer('${encodeURIComponent(taskId(t))}')">•••</button></div>`).join('')}
  renderWork=function(){
    const tasks=db.tasks||[],open=tasks.filter(t=>!isDone(t)),review=open.filter(needsReview),done=tasks.filter(isDone),late=open.filter(isOverdue);
    q('#workSourceState').innerHTML=`${sourceState(connection.tasks,'업무 중앙 데이터')} ${syncBadge()}`;
    q('#workMetrics').innerHTML=`<div class="metric priority"><b>${open.length}</b><span class="muted">처리할 업무</span></div><div class="metric review"><b>${review.length}</b><span class="muted">확인 필요</span></div><div class="metric ${late.length?'priority':'good'}"><b>${late.length}</b><span class="muted">기한 지남</span></div><div class="metric good"><b>${done.length}</b><span class="muted">완료</span></div>`;
    q('#openTaskCount').textContent=open.length;q('#reviewTaskCount').textContent=review.length;q('#doneTaskCount').textContent=done.length;
    qa('[data-work-tab]').forEach(b=>b.classList.toggle('active',b.dataset.workTab===ui.workTab));
    taskFilters();const search=norm(ui.taskSearch),filtered=tasks.filter(t=>taskMatchesTab(t)&&(ui.taskProject==='전체'||clean(t.project)===ui.taskProject)&&(ui.taskOwner==='전체'||clean(t.owner)===ui.taskOwner)&&(ui.taskStatus==='전체'||clean(t.status)===ui.taskStatus)&&(!search||norm(`${t.title} ${t.project} ${t.owner} ${t.source}`).includes(search))).sort((a,b)=>Number(isOverdue(b))-Number(isOverdue(a))||dueTime(a)-dueTime(b));
    q('#taskResultCount').textContent=`${filtered.length}개 업무`;
    q('#registeredTasks').innerHTML=connection.tasks?(filtered.length?taskRows(filtered):empty('이 조건에서 처리할 업무가 없습니다.')):empty('업무 중앙 데이터에 연결하면 업무가 표시됩니다.');
    setNavCount();updateCandidateCount();
  };

  window.updateTaskStatus=async(encodedId,status)=>{
    const id=decodeURIComponent(encodedId),task=db.tasks.find(t=>taskId(t)===id);if(!task)return;const previous=task.status;task.status=status;renderWork();
    try{await api('/api/work-tasks?action=update',{method:'POST',body:JSON.stringify({task_id:id,status})});toast(`업무 상태를 ‘${status}’로 변경했습니다.`);renderDash()}catch(e){task.status=previous;renderWork();alert('상태 변경 실패: '+e.message)}
  };
  window.deleteCentralTask=async encodedId=>{
    const id=decodeURIComponent(encodedId),task=db.tasks.find(t=>taskId(t)===id);if(!task||!confirm(`‘${task.title}’ 업무를 삭제할까요?`))return;
    try{await api('/api/work-tasks?action=delete',{method:'POST',body:JSON.stringify({task_id:id})});db.tasks=db.tasks.filter(t=>taskId(t)!==id);closeDrawer();renderWork();toast('업무를 삭제했습니다.')}catch(e){alert('업무 삭제 실패: '+e.message)}
  };
  function closeDrawer(){q('#taskDrawer')?.classList.add('hidden');q('#taskDrawer')?.setAttribute('aria-hidden','true')}
  window.openTaskDrawer=encodedId=>{
    const id=decodeURIComponent(encodedId),t=db.tasks.find(x=>taskId(x)===id);if(!t)return;
    q('#drawerTaskTitle').textContent=t.title||'업무 상세';q('#drawerTaskBody').innerHTML=`<div class="drawer-section"><label>상태</label><select class="task-status-select" onchange="updateTaskStatus('${encodeURIComponent(id)}',this.value)">${statusOptions(clean(t.status)||'예정')}</select></div><div class="drawer-section"><label>프로젝트</label><p>${esc(t.project||'확인 필요')}</p></div><div class="drawer-section"><label>담당자</label><p>${esc(t.owner||'확인 필요')}</p></div><div class="drawer-section"><label>기한</label><p>${esc(taskDue(t)||'확인 필요')}${isOverdue(t)?' · 기한 지남':''}</p></div><div class="drawer-section"><label>근거</label><p>${t.source_url?`<a href="${esc(t.source_url)}" target="_blank" rel="noopener">${esc(t.source||'원문 열기')} →</a>`:esc(t.source||'등록된 근거 없음')}</p></div><div class="drawer-actions"><button class="btn danger" onclick="deleteCentralTask('${encodeURIComponent(id)}')">업무 삭제</button></div>`;q('#taskDrawer').classList.remove('hidden');q('#taskDrawer').setAttribute('aria-hidden','false')
  };

  function reviewStep(step){qa('.review-steps span').forEach((el,i)=>el.classList.toggle('active',i===step-1))}
  function candidateCardV2(t,i){const missing=[];if(!clean(t.project))missing.push('프로젝트');if(!clean(t.owner))missing.push('담당자');if(!clean(t.dueDate))missing.push('기한');return `<div class="candidate-card selected" data-candidate="${i}"><div class="candidate-top"><label class="candidate-check"><input type="checkbox" class="candidateApprove" data-i="${i}" checked> 승인 대상</label><span class="tag ${missing.length?'amber':'green'}">${missing.length?`${missing.join('·')} 확인 필요`:'필수 정보 확인됨'}</span></div><div class="candidate-fields"><div class="field"><label>업무명</label><input class="candidateTitle" data-i="${i}" value="${esc(t.title||'')}"></div><div class="field"><label>프로젝트</label><input class="candidateProject" data-i="${i}" value="${esc(t.project||'')}" placeholder="확인 필요"></div><div class="field"><label>담당자</label><input class="candidateOwner" data-i="${i}" value="${esc(t.owner||'')}" placeholder="확인 필요"></div><div class="field"><label>기한</label><input class="candidateDue" data-i="${i}" value="${esc(t.dueDate||'')}" placeholder="확인 필요"></div></div><div class="candidate-evidence"><b>AI 판단 근거</b> · ${esc(t.sourceEvidence||t.reason||'연결된 중앙 원본 기준')} ${t.sourceIds?.length?`· Source ${esc(t.sourceIds.join(', '))}`:''}</div></div>`}
  function updateCandidateCount(){const footer=q('#candidateFooter');if(!footer)return;const items=window.workCandidates||[],selected=qa('.candidateApprove:checked').length;footer.classList.toggle('hidden',items.length===0);q('#approvedCandidateCount').textContent=`${selected}개 선택`;qa('.candidateApprove').forEach(cb=>cb.closest('.candidate-card')?.classList.toggle('selected',cb.checked))}
  function bindCandidateInputs(){qa('.candidateApprove').forEach(cb=>cb.onchange=updateCandidateCount);updateCandidateCount()}
  analyzeMemo=async function(){
    const memo=clean(q('#workMemo')?.value);if(!memo)return alert('회의 메모나 업무 메모를 입력해 주세요.');const btn=q('#analyzeMemo'),started=new Date().toISOString();btn.disabled=true;btn.textContent='후보 생성 중…';q('#workCandidates').innerHTML='<div class="empty quiet-empty">연결 원본과 대조해 업무 후보를 만들고 있습니다.</div>';
    try{const d=await api('/api/work-tasks?action=analyze',{method:'POST',body:JSON.stringify({memo})});if(d.error&&!(d.tasks||[]).length){q('#workCandidates').innerHTML=`<div class="notice">${esc(d.error)}</div>`;return}window.workCandidates=(d.tasks||[]).map((t,i)=>({...t,_i:i,approved:true}));q('#workCandidates').innerHTML=window.workCandidates.length?window.workCandidates.map(candidateCardV2).join(''):empty('근거가 확인된 업무 후보가 없습니다.');q('#workModel').textContent=d.modelUsed?`사용 모델 ${d.modelUsed} · 확인 원본 ${d.sourceCount||0}개`:'연결 원본 기준';reviewStep(2);bindCandidateInputs();await logExecution({action:'업무 후보 추출',model:d.modelUsed||'',status:'성공',startedAt:started})}catch(e){q('#workCandidates').innerHTML=`<div class="notice">업무 후보 생성 실패: ${esc(e.message)}</div>`;await logExecution({action:'업무 후보 추출',status:'실패',error:e.message,startedAt:started})}finally{btn.disabled=false;btn.textContent='AI 업무 후보 생성'}
  };
  registerApprovedTasks=async function(){
    const items=window.workCandidates||[],tasks=items.map((t,i)=>({...t,approved:q(`.candidateApprove[data-i="${i}"]`)?.checked===true,title:clean(q(`.candidateTitle[data-i="${i}"]`)?.value),project:clean(q(`.candidateProject[data-i="${i}"]`)?.value),owner:clean(q(`.candidateOwner[data-i="${i}"]`)?.value),dueDate:clean(q(`.candidateDue[data-i="${i}"]`)?.value)})).filter(t=>t.approved);if(!tasks.length)return alert('등록할 업무 후보를 선택해 주세요.');const btn=q('#registerApproved');btn.disabled=true;btn.textContent='승인·등록 중…';
    try{const d=await api('/api/work-tasks?action=register',{method:'POST',body:JSON.stringify({tasks})});db.tasks=d.tasks||db.tasks;connection.tasks=true;window.workCandidates=[];q('#workCandidates').innerHTML=`<div class="notice ok"><b>${d.count??tasks.length}개 업무를 승인·등록했습니다.</b>${d.duplicateCount?` 중복 ${d.duplicateCount}개는 제외했습니다.`:''}</div>`;q('#candidateFooter').classList.add('hidden');reviewStep(3);renderWork();toast('선택한 AI 후보를 중앙 업무표에 등록했습니다.')}catch(e){alert('업무 등록 실패: '+e.message)}finally{btn.disabled=false;btn.textContent='선택한 후보 승인·등록'}
  };
  window.analyzeMemo=analyzeMemo;window.registerApprovedTasks=registerApprovedTasks;

  renderAnalysis=function(a){
    const facts=(a?.facts||[]).map(f=>`<div class="fact"><span class="tag ${f.status==='확정'?'green':f.status==='질문'?'amber':''}">${esc(f.status||'확인')}</span><br><b>${esc(f.fact||'')}</b><br><span class="muted">${esc(f.source||'연결 원본')}</span></div>`).join('');
    q('#analysis').innerHTML=`${a?.summary?`<p>${esc(a.summary)}</p>`:''}<div class="facts">${facts||empty('확인된 사실이 없습니다.')}</div>${(a?.missing||[]).length?`<div class="notice"><b>추가 확인 필요</b><br>${a.missing.map(v=>`• ${esc(v)}`).join('<br>')}</div>`:''}${a?.modelUsed?`<div class="muted" style="margin-top:10px">사용 모델 · ${esc(a.modelUsed)}</div>`:''}`;
    q('#taskList').innerHTML=(a?.tasks||[]).length?a.tasks.map((t,i)=>`<div class="task" data-task-index="${i}"><div class="taskHead"><div><span class="tag purple">AI 제안</span><span class="tag">${esc(t.outputType||'Other')}</span><h4>${esc(t.title||'')}</h4></div><span class="tag amber">승인 전</span></div><p>${esc(t.reason||'')}</p><div class="taskActions"><button class="btn primary" onclick="executeTask(${i})">승인하고 실행</button><button class="btn" onclick="skipTask(${i})">제외</button></div></div>`).join(''):empty('제안된 실행 후보가 없습니다.');
  };

  const baseOpenProject=openProject;
  openProject=async function(id){await baseOpenProject(id);renderProjectSummary();setProjectTab('overview')};window.openProject=openProject;
  function renderProjectSummary(){const p=current();if(!p)return;const tasks=db.tasks.filter(t=>norm(t.project)===norm(p.name)),sources=(p.sources||[]).length,files=p.driveFolderId||p.driveUrl?'연결됨':'확인 필요';q('#projectSummaryCards').innerHTML=`<div class="summary-card"><b>${tasks.filter(t=>!isDone(t)).length}</b><span>남은 업무</span></div><div class="summary-card"><b>${sources}</b><span>연결 원본</span></div><div class="summary-card"><b>${files}</b><span>Drive 폴더</span></div>`}
  function setProjectTab(tab){const ids={overview:'projectOverviewPane',files:'projectFilesPane',ai:'projectAiPane'};Object.entries(ids).forEach(([k,id])=>q('#'+id)?.classList.toggle('hidden',k!==tab));qa('[data-project-tab]').forEach(b=>b.classList.toggle('active',b.dataset.projectTab===tab));if(tab==='files')loadFiles()}

  function bindV2(){
    q('#projectSearch')?.addEventListener('input',e=>{ui.projectSearch=e.target.value;renderProjects()});q('#projectCategoryFilter')?.addEventListener('change',e=>{ui.projectCategory=e.target.value;renderProjects()});q('#projectStatusFilter')?.addEventListener('change',e=>{ui.projectStatus=e.target.value;renderProjects()});q('#projectFilterReset')?.addEventListener('click',()=>{ui.projectSearch='';ui.projectCategory='전체';ui.projectStatus='전체';q('#projectSearch').value='';renderProjects()});
    q('#taskSearch')?.addEventListener('input',e=>{ui.taskSearch=e.target.value;renderWork()});q('#taskProjectFilter')?.addEventListener('change',e=>{ui.taskProject=e.target.value;renderWork()});q('#taskOwnerFilter')?.addEventListener('change',e=>{ui.taskOwner=e.target.value;renderWork()});q('#taskStatusFilter')?.addEventListener('change',e=>{ui.taskStatus=e.target.value;renderWork()});q('#taskFilterReset')?.addEventListener('click',()=>{ui.taskSearch='';ui.taskProject='전체';ui.taskOwner='전체';ui.taskStatus='전체';q('#taskSearch').value='';renderWork()});
    qa('[data-work-tab]').forEach(b=>b.addEventListener('click',()=>{ui.workTab=b.dataset.workTab;renderWork()}));qa('[data-project-tab]').forEach(b=>b.addEventListener('click',()=>setProjectTab(b.dataset.projectTab)));
    q('#analyzeMemo').onclick=analyzeMemo;q('#registerApproved').onclick=registerApprovedTasks;
    q('#focusAiComposer').onclick=()=>q('#aiReviewPanel')?.scrollIntoView({behavior:'smooth',block:'start'});q('#dashGoWork').onclick=()=>show('work');q('#dashViewAllTasks').onclick=()=>show('work');q('#dashViewProjects').onclick=()=>show('projects');q('#dashSync').onclick=()=>{show('projects');q('#syncProjects')?.click()};q('#refreshHistory').onclick=()=>bootstrap();
    q('#closeTaskDrawer').onclick=closeDrawer;q('.drawer-backdrop').onclick=closeDrawer;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});
    if(window.TG_PROTOTYPE_ACTIVE){q('#prototypeBanner')?.classList.remove('hidden');document.body.classList.add('prototype-mode')}
  }
  bindV2();window.TG_WORKSPACE_V2_READY=true;
})();
