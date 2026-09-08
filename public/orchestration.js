(function(){
  const q=id=>document.getElementById(id);
  const hide=id=>q(id)?.classList.add('hidden');
  const show=id=>q(id)?.classList.remove('hidden');
  const safe=v=>typeof esc==='function'?esc(v??''):String(v??'');
  const getDb=()=>{try{return db}catch{return null}};

  function hideAll(){
    ['dashboard','projects','knowledge','sales','automationPanel','projectDetail'].forEach(hide);
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  }

  function normalizeName(v=''){
    return String(v).toLowerCase().replace(/\[[^\]]+\]/g,'').replace(/\s+/g,'').replace(/[·\-_/()]/g,'');
  }

  function migrateUnifiedProjects(){
    const d=getDb();if(!d)return;
    d.projects=d.projects||[];d.projectInfo=d.projectInfo||[];
    d.features=d.features||[];d.devices=d.devices||[];d.sources=d.sources||[];
    let changed=false;
    d.projectInfo.forEach(pi=>{
      let p=d.projects.find(x=>x.projectInfoId===pi.id);
      if(!p)p=d.projects.find(x=>normalizeName(x.name)===normalizeName(pi.name));
      if(!p){
        p={id:'project_'+pi.id,name:pi.name,category:'기타',status:pi.status||'예정',driveUrl:'',driveFolderId:'',figmaUrl:'',refLinks:[],requests:[],projectInfoId:pi.id,customer:pi.customer||'',sourceType:pi.sourceType||'Drive'};
        d.projects.push(p);changed=true;
      }else{
        if(!p.projectInfoId){p.projectInfoId=pi.id;changed=true}
        if(!p.customer&&pi.customer){p.customer=pi.customer;changed=true}
      }
    });
    if(changed&&typeof save==='function')save();
  }

  function projectInfoFor(p){
    const d=getDb();if(!d)return null;
    return (d.projectInfo||[]).find(x=>x.id===p.projectInfoId)||
      (d.projectInfo||[]).find(x=>normalizeName(x.name)===normalizeName(p.name))||null;
  }

  function projectFacts(p){
    const d=getDb(),pi=projectInfoFor(p);if(!d||!pi)return {features:[],devices:[],sources:[]};
    return {
      features:(d.features||[]).filter(x=>x.projectInfoId===pi.id),
      devices:(d.devices||[]).filter(x=>x.projectInfoId===pi.id),
      sources:(d.sources||[]).filter(x=>x.projectInfoId===pi.id)
    };
  }

  function installProjectLayout(){
    const projects=q('projects');if(!projects)return;
    q('projectInfoIntegrated')?.remove();
    if(q('unifiedProjectMetrics'))return;
    const panel=q('projectList')?.closest('.panel');
    if(!panel)return;
    const metrics=document.createElement('div');metrics.id='unifiedProjectMetrics';metrics.className='metrics';
    panel.parentElement.insertBefore(metrics,panel);
    const desc=projects.querySelector('.head .muted');
    if(desc)desc.textContent='프로젝트 하나에서 기본 정보·Drive·Feature·Device·업무·AI 실행 결과까지 함께 관리합니다.';
  }

  function renderUnifiedProjects(){
    const d=getDb();if(!d)return;
    migrateUnifiedProjects();installProjectLayout();
    const list=d.projects||[];
    const filter=typeof activeCat!=='undefined'?activeCat:'전체';
    const filtered=list.filter(p=>filter==='전체'||p.category===filter);
    const categories=typeof cats!=='undefined'?cats:['전체','행사·마케팅','제품·UIUX','문서·운영','기타'];
    if(q('catTabs')){
      q('catTabs').innerHTML=categories.map(c=>`<button data-cat="${safe(c)}" class="${c===filter?'active':''}">${safe(c)}</button>`).join('');
      q('catTabs').querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCat=b.dataset.cat;renderUnifiedProjects()});
    }
    const driveCount=list.filter(p=>p.driveFolderId).length;
    const activeCount=list.filter(p=>!['완료','완료됨','폐기됨'].includes(p.status)).length;
    const featureCount=list.reduce((n,p)=>n+projectFacts(p).features.length,0);
    const pendingFacts=(d.facts||[]).filter(f=>f.approvalStatus==='후보').length;
    if(q('unifiedProjectMetrics'))q('unifiedProjectMetrics').innerHTML=`<div class="metric"><b>${list.length}</b><span class="muted">전체 프로젝트</span></div><div class="metric"><b>${activeCount}</b><span class="muted">진행·검토 중</span></div><div class="metric"><b>${driveCount}</b><span class="muted">Drive 연결</span></div><div class="metric"><b>${pendingFacts}</b><span class="muted">검토 대기 Fact</span></div>`;
    if(q('projectList'))q('projectList').innerHTML=`<table class="table"><thead><tr><th>프로젝트</th><th>고객 / 연관기업</th><th>분류</th><th>상태</th><th>Drive</th><th>주요 정보</th><th>업무</th></tr></thead><tbody>${filtered.map(p=>{const info=projectInfoFor(p),f=projectFacts(p),req=(p.requests||[]).length;return `<tr data-project="${safe(p.id)}"><td><b>${safe(p.name)}</b></td><td>${safe(p.customer||info?.customer||'-')}</td><td>${safe(p.category||'기타')}</td><td>${safe(p.status||'-')}</td><td>${p.driveFolderId?'연결됨':'미연결'}</td><td><span class="tag">Feature ${f.features.length}</span> <span class="tag">Device ${f.devices.length}</span> <span class="tag">Source ${f.sources.length}</span></td><td>${req?`요청 ${req}건`:'상세에서 업무 실행'}</td></tr>`}).join('')}</tbody></table>`;
    q('projectList')?.querySelectorAll('[data-project]').forEach(row=>row.onclick=()=>openProject(row.dataset.project));
  }

  function renderProjectMetadata(){
    const d=getDb();if(!d||typeof current!=='function')return;
    const p=current();if(!p)return;
    const info=projectInfoFor(p),facts=projectFacts(p);
    let box=q('unifiedProjectMeta');
    if(!box){
      box=document.createElement('div');box.id='unifiedProjectMeta';box.className='section';
      const side=q('projectRelations')?.closest('.section')||q('driveFiles')?.closest('.section');
      if(side)side.parentElement.insertBefore(box,side);
    }
    if(!box)return;
    box.innerHTML=`<h3>프로젝트 정보</h3><div class="muted">프로젝트 기본 정보와 Drive에서 확인된 Feature·Device·Source를 함께 표시합니다.</div><div style="margin-top:12px"><b>고객 / 연관기업</b><div style="margin-top:4px">${safe(p.customer||info?.customer||'-')}</div></div><div style="margin-top:12px"><b>Feature</b><div class="chip-list" style="margin-top:6px">${facts.features.length?facts.features.map(x=>`<span class="tag">${safe(x.name)}</span>`).join(''):'<span class="muted">등록된 Feature 없음</span>'}</div></div><div style="margin-top:12px"><b>Device / Asset</b><div class="chip-list" style="margin-top:6px">${facts.devices.length?facts.devices.map(x=>`<span class="tag">${safe(x.name)}</span>`).join(''):'<span class="muted">등록된 Device 없음</span>'}</div></div><div style="margin-top:12px"><b>Source</b>${facts.sources.length?facts.sources.map(x=>`<div class="muted" style="margin-top:4px">↗ ${safe(x.name)}</div>`).join(''):'<div class="muted" style="margin-top:4px">등록된 Source 없음</div>'}</div>`;
  }

  function buildSalesWorkspace(){
    const sales=q('sales'),d=getDb();if(!sales||!d||sales.dataset.pipeline==='1')return;
    sales.dataset.pipeline='1';
    d.opportunities=d.opportunities||[];d.companies=d.companies||[];d.contacts=d.contacts||[];d.interactions=d.interactions||[];
    sales.innerHTML=`<div class="head"><div><h1>영업</h1><div class="muted">사업 신호 → 고객 문제 → TeamGRIT 상품 → Contact → 제안·미팅 → 다음 행동을 한 흐름으로 관리합니다.</div></div><div class="taskActions top-actions"><button class="btn" id="salesSync">시트·Gmail 동기화</button><button class="btn primary" id="salesAddOpp">영업 기회 추가</button></div></div><div class="metrics" id="salesMetrics"></div><div class="panel"><div class="ph"><b>영업 기회</b><span class="muted">고객 문제와 제안 상품, 다음 행동 중심</span></div><div class="pb" id="opportunityList"></div></div><div class="panel"><div class="ph"><b>기업 / 고객 · Contact</b><span class="muted">중복 접촉을 막기 위해 기업과 담당자를 함께 관리</span></div><div class="pb" id="companyContactList"></div></div>`;
    q('salesSync').onclick=()=>{try{q('syncSales')?.click()}catch{}renderSalesPipeline()};
    q('salesAddOpp').onclick=()=>addOpportunity();
    renderSalesPipeline();
  }

  function companyName(c){return c?.endCustomer||c?.companyName||c?.partner||'-'}
  function addOpportunity(){
    const d=getDb();if(!d?.companies?.length)return alert('먼저 기업/고객 정보를 등록해 주세요.');
    const idx=Number(prompt(d.companies.map((c,i)=>`${i+1}. ${companyName(c)}`).join('\n')));const c=d.companies[idx-1];if(!c)return;
    const signal=prompt('사업 신호 / 영업 기회');if(!signal)return;
    const problem=prompt('고객 문제','')||'';const product=prompt('제안 상품','CoBiz')||'CoBiz';const next=prompt('다음 행동','')||'';
    d.opportunities.unshift({id:'opp_'+Date.now(),companyId:c.id,title:signal,signal,problem,products:[product],stage:'신규',nextAction:next,createdAt:Date.now()});if(typeof save==='function')save();renderSalesPipeline();
  }
  function renderSalesPipeline(){
    const d=getDb();if(!d||!q('salesMetrics'))return;
    const open=(d.opportunities||[]).filter(o=>!['수주','보류'].includes(o.stage)).length;
    const contactGap=(d.companies||[]).filter(c=>!(d.contacts||[]).some(x=>x.companyId===c.id)).length;
    const next=(d.opportunities||[]).filter(o=>o.nextAction&&!['수주','보류'].includes(o.stage)).length;
    q('salesMetrics').innerHTML=`<div class="metric"><b>${open}</b><span class="muted">진행 중 영업 기회</span></div><div class="metric"><b>${d.companies.length}</b><span class="muted">기업 / 고객</span></div><div class="metric"><b>${contactGap}</b><span class="muted">Contact 보완 필요</span></div><div class="metric"><b>${next}</b><span class="muted">다음 행동 지정</span></div>`;
    q('opportunityList').innerHTML=d.opportunities.length?`<table class="table"><thead><tr><th>사업 신호</th><th>기업</th><th>고객 문제</th><th>제안 상품</th><th>단계</th><th>다음 행동</th></tr></thead><tbody>${d.opportunities.map(o=>{const c=d.companies.find(x=>x.id===o.companyId);return `<tr><td><b>${safe(o.title||o.signal)}</b></td><td>${safe(companyName(c))}</td><td>${safe(o.problem||'-')}</td><td>${safe(Array.isArray(o.products)?o.products.join(', '):o.product||'-')}</td><td>${safe(o.stage||'신규')}</td><td><b>${safe(o.nextAction||'-')}</b></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">아직 등록된 영업 기회가 없습니다.</div>';
    q('companyContactList').innerHTML=d.companies.length?`<table class="table"><thead><tr><th>기업 / 고객</th><th>유형</th><th>산업</th><th>내부 담당</th><th>Contact</th></tr></thead><tbody>${d.companies.map(c=>{const cs=d.contacts.filter(x=>x.companyId===c.id);return `<tr><td><b>${safe(companyName(c))}</b></td><td>${safe(c.customerType||'-')}</td><td>${safe(c.industry||'-')}</td><td>${safe(c.accountOwner||'미지정')}</td><td>${cs.length?cs.map(x=>safe(x.name)).join(', '):'보완 필요'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">등록된 기업이 없습니다.</div>';
  }

  function go(view){
    hideAll();
    if(view==='dash'){show('dashboard');q('navDash')?.classList.add('active');if(typeof renderDash==='function')renderDash()}
    if(view==='projects'){show('projects');q('navProjects')?.classList.add('active');renderUnifiedProjects()}
    if(view==='sales'){show('sales');q('navSales')?.classList.add('active');buildSalesWorkspace();renderSalesPipeline()}
    if(view==='automation'){show('automationPanel');q('navAutomation')?.classList.add('active')}
    if(typeof authStatus==='function')authStatus();window.scrollTo(0,0);
  }

  function bindAutomation(){
    const btn=q('runAutomation');if(!btn)return;
    btn.onclick=async()=>{btn.disabled=true;const old=btn.textContent;try{btn.textContent='Drive·Chat 확인 중...';if(typeof window.runOpsAutomation==='function')await window.runOpsAutomation();if(typeof window.syncGoogleChatSources==='function')await window.syncGoogleChatSources()}finally{btn.disabled=false;btn.textContent=old||'자동화 실행'}};
  }

  function init(){
    migrateUnifiedProjects();installProjectLayout();
    const nk=q('navKnowledge');if(nk)nk.style.display='none';
    renderProjects=renderUnifiedProjects;
    const baseOpen=typeof openProject==='function'?openProject:null;
    if(baseOpen){openProject=async id=>{hideAll();await baseOpen(id);show('projectDetail');renderProjectMetadata()}}
    q('navDash').onclick=()=>go('dash');q('navProjects').onclick=()=>go('projects');q('navSales').onclick=()=>go('sales');q('navAutomation').onclick=()=>go('automation');q('backProjects').onclick=()=>go('projects');
    bindAutomation();buildSalesWorkspace();go('dash');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
