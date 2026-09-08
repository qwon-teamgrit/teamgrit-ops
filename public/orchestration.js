(function(){
  function bindUnifiedAutomation(){
    const btn=document.querySelector('#runAutomation');
    if(!btn||btn.dataset.unifiedBound==='1')return;
    btn.dataset.unifiedBound='1';
    btn.onclick=async()=>{
      btn.disabled=true;
      const original=btn.textContent;
      try{
        btn.textContent='Drive·Chat 확인 중...';
        if(typeof window.runOpsAutomation==='function')await window.runOpsAutomation();
        if(typeof window.syncGoogleChatSources==='function')await window.syncGoogleChatSources();
      }finally{
        btn.disabled=false;
        btn.textContent=original||'자동화 실행';
      }
    };
  }

  function addUpgradeStyles(){
    if(document.getElementById('tgOpsUpgradeStyle'))return;
    const style=document.createElement('style');
    style.id='tgOpsUpgradeStyle';
    style.textContent=`
      #knowledge{display:none!important}
      .sales-flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:18px;padding:14px 16px;border:1px solid var(--md-sys-color-outline-variant);border-radius:14px;background:#fff}
      .sales-flow span{display:inline-flex;align-items:center;min-height:32px;padding:0 11px;border-radius:16px;background:var(--md-sys-color-surface-container-low);font-size:12px;font-weight:700;color:var(--md-sys-color-on-surface-variant)}
      .sales-flow b{color:var(--md-sys-color-outline);font-size:12px}
      .project-intel-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
      .project-intel-stat{border:1px solid var(--md-sys-color-outline-variant);border-radius:12px;padding:14px;background:var(--md-sys-color-surface-container-low)}
      .project-intel-stat b{display:block;font-size:20px;margin-bottom:3px}
      .project-info-card{border:1px solid var(--md-sys-color-outline-variant);border-radius:14px;padding:16px;margin-bottom:12px;background:#fff}
      .project-info-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .project-info-head>div{display:grid;gap:6px}
      .project-info-head b{font-size:14px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px}
      .info-grid label{display:block;font-size:11px;font-weight:700;color:var(--md-sys-color-on-surface-variant);margin-bottom:6px}
      .sales-section-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
      .sales-section-tabs button{min-height:38px;border:1px solid var(--md-sys-color-outline);background:#fff;padding:0 14px;border-radius:19px;cursor:pointer;color:var(--md-sys-color-on-surface-variant);font-weight:600}
      .sales-section-tabs button.active{background:var(--md-sys-color-primary-container);border-color:transparent;color:var(--md-sys-color-on-primary-container)}
      .sales-subsection.hidden{display:none!important}
      @media(max-width:900px){.project-intel-grid{grid-template-columns:1fr 1fr}.info-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureFourTabs(){
    document.getElementById('navKnowledge')?.remove();
    const nav=document.querySelector('.nav');
    if(!nav)return;
    let auto=document.getElementById('navAutomation');
    if(!auto){auto=document.createElement('button');auto.id='navAutomation';auto.textContent='자동화';nav.appendChild(auto)}
    const wanted=['navDash','navProjects','navSales','navAutomation'];
    wanted.forEach(id=>{const el=document.getElementById(id);if(el)nav.appendChild(el)});
  }

  function hideAllPages(){
    ['dashboard','projects','knowledge','sales','automationPanel','projectDetail'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  }

  function showPage(view){
    hideAllPages();
    if(view==='dash'){
      document.getElementById('dashboard')?.classList.remove('hidden');
      document.getElementById('navDash')?.classList.add('active');
      if(typeof renderDash==='function')renderDash();
    }else if(view==='projects'){
      document.getElementById('projects')?.classList.remove('hidden');
      document.getElementById('navProjects')?.classList.add('active');
      if(typeof renderProjects==='function')renderProjects();
      renderIntegratedProjectInfo();
    }else if(view==='sales'){
      document.getElementById('sales')?.classList.remove('hidden');
      document.getElementById('navSales')?.classList.add('active');
      renderSalesPipeline();
    }else if(view==='automation'){
      document.getElementById('automationPanel')?.classList.remove('hidden');
      document.getElementById('navAutomation')?.classList.add('active');
      if(typeof window.renderAutomationPanel==='function')window.renderAutomationPanel();
    }
    if(typeof authStatus==='function')authStatus();
    window.scrollTo(0,0);
  }

  function renderIntegratedProjectInfo(){
    const projectsSection=document.getElementById('projects');
    if(!projectsSection||!window.db)return;
    let panel=document.getElementById('integratedProjectInfo');
    if(!panel){
      panel=document.createElement('div');
      panel.id='integratedProjectInfo';
      panel.className='panel';
      panel.innerHTML='<div class="ph"><b>프로젝트 상세 정보</b><span class="muted">별도 메뉴 없이 프로젝트 목록과 Drive 기준 정보를 함께 확인</span></div><div class="pb"><div id="integratedProjectMetrics" class="project-intel-grid"></div><div id="integratedProjectInfoList"></div></div>';
      projectsSection.appendChild(panel);
    }
    const pis=db.projectInfo||[], features=db.features||[], devices=db.devices||[], facts=db.facts||[];
    const active=pis.filter(p=>!['완료됨','폐기됨'].includes(p.status)).length;
    const pending=facts.filter(f=>f.approvalStatus==='후보').length;
    const metrics=document.getElementById('integratedProjectMetrics');
    if(metrics)metrics.innerHTML=`<div class="project-intel-stat"><b>${pis.length}</b><span class="muted">Drive 기준 프로젝트</span></div><div class="project-intel-stat"><b>${active}</b><span class="muted">진행·검토 중</span></div><div class="project-intel-stat"><b>${features.length}</b><span class="muted">Feature</span></div><div class="project-intel-stat"><b>${pending}</b><span class="muted">검토 대기 Fact</span></div>`;
    const list=document.getElementById('integratedProjectInfoList');
    if(!list)return;
    list.innerHTML=pis.length?pis.map(p=>{
      const fs=features.filter(x=>x.projectInfoId===p.id), ds=devices.filter(x=>x.projectInfoId===p.id), ss=(db.sources||[]).filter(x=>x.projectInfoId===p.id);
      return `<div class="project-info-card"><div class="project-info-head"><div><span class="tag blue">${esc(p.status||'-')}</span><b>${esc(p.name||'-')}</b><div class="muted">${esc(p.customer||'-')}</div></div><span class="tag">${esc(p.sourceType||'Drive')}</span></div><div class="info-grid"><div><label>Feature</label><div class="chip-list">${fs.slice(0,6).map(x=>`<span class="tag">${esc(x.name)}</span>`).join('')||'<span class="muted">없음</span>'}</div></div><div><label>Device / Asset</label><div class="chip-list">${ds.slice(0,6).map(x=>`<span class="tag">${esc(x.name)}</span>`).join('')||'<span class="muted">없음</span>'}</div></div><div><label>Source</label>${ss.slice(0,4).map(x=>`<div class="muted">↗ ${esc(x.name)}</div>`).join('')||'<span class="muted">없음</span>'}</div></div></div>`;
    }).join(''):'<div class="empty">Drive 기준 프로젝트 정보가 없습니다.</div>';
  }

  function ensureSalesStructure(){
    const sales=document.getElementById('sales');
    if(!sales||sales.dataset.pipelineReady==='1')return;
    sales.dataset.pipelineReady='1';
    sales.innerHTML=`<div class="head"><div><h1>영업</h1><div class="muted">사업 신호를 고객 문제와 TeamGRIT 상품에 연결하고, Contact·제안·다음 행동까지 한 흐름으로 관리합니다.</div></div><div class="taskActions top-actions"><button class="btn" id="syncSales">시트·Gmail 동기화</button><button class="btn" id="newCompany">기업 추가</button><button class="btn primary" id="newOpportunity">영업 기회 추가</button></div></div><div class="metrics" id="salesMetrics"></div><div class="sales-flow"><span>사업 신호</span><b>→</b><span>고객 문제</span><b>→</b><span>TeamGRIT 상품</span><b>→</b><span>Contact</span><b>→</b><span>제안·미팅</span><b>→</b><span>다음 행동</span></div><div class="sales-section-tabs"><button class="active" data-sales-tab="opportunities">영업 기회</button><button data-sales-tab="companies">기업 / 고객</button><button data-sales-tab="contacts">Contact / 접촉</button><button data-sales-tab="proposals">제안 / 진행 상태</button></div><div id="salesOppSection" class="panel sales-subsection"><div class="ph"><b>영업 기회</b><span class="muted">왜 지금 접촉해야 하는지와 다음 행동을 관리</span></div><div class="pb" id="opportunityList"></div></div><div id="salesCompanySection" class="panel sales-subsection hidden"><div class="ph"><b>기업 / 고객</b><span class="muted">기업 유형과 TeamGRIT과의 관계를 함께 관리</span></div><div class="pb" id="companyList"></div></div><div id="salesContactSection" class="panel sales-subsection hidden"><div class="ph"><b>Contact / 접촉 이력</b><span class="muted">중복 접촉을 방지하고 내부 담당자를 명확히 관리</span></div><div class="pb" id="contactList"></div></div><div id="salesProposalSection" class="panel sales-subsection hidden"><div class="ph"><b>제안 / 진행 상태</b><span class="muted">문제 해결 상품, PoC·견적·협의와 다음 액션을 관리</span></div><div class="pb" id="proposalList"></div></div>`;
    sales.querySelectorAll('[data-sales-tab]').forEach(btn=>btn.onclick=()=>{
      sales.querySelectorAll('[data-sales-tab]').forEach(x=>x.classList.toggle('active',x===btn));
      const key=btn.dataset.salesTab;
      ['opportunities','companies','contacts','proposals'].forEach(k=>document.getElementById('sales'+({opportunities:'Opp',companies:'Company',contacts:'Contact',proposals:'Proposal'}[k])+'Section')?.classList.toggle('hidden',k!==key));
    });
    document.getElementById('syncSales').onclick=()=>{if(typeof window.syncSalesWorkspace==='function')window.syncSalesWorkspace();renderSalesPipeline()};
    document.getElementById('newCompany').onclick=()=>{const name=prompt('기업명');if(!name)return;db.companies=db.companies||[];db.companies.unshift({id:'company_'+Date.now(),companyName:name,endCustomer:name,customerType:'잠재고객',industry:'',accountOwner:'',createdAt:Date.now()});save();renderSalesPipeline()};
    document.getElementById('newOpportunity').onclick=()=>addOpportunity();
  }

  function companyName(c){return c?.endCustomer||c?.companyName||c?.partner||'-'}
  function latestInteraction(companyId){return (db.interactions||[]).filter(x=>x.companyId===companyId).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]}
  function addOpportunity(){
    db.opportunities=db.opportunities||[];db.companies=db.companies||[];
    if(!db.companies.length)return alert('먼저 기업을 추가해 주세요.');
    const opts=db.companies.map((c,i)=>`${i+1}. ${companyName(c)}`).join('\n');
    const idx=Number(prompt(`관련 기업 번호를 입력하세요.\n${opts}`));const c=db.companies[idx-1];if(!c)return;
    const title=prompt('영업 기회 / 사업 신호');if(!title)return;
    const problem=prompt('고객 문제','')||'';const product=prompt('제안 상품 (예: CoBiz, Spider Runtime, Robot Black Box)','CoBiz')||'CoBiz';
    const stage=prompt('단계 (신규/접촉 예정/미팅/제안/PoC/견적/협의 중/수주)','신규')||'신규';
    const nextAction=prompt('다음 행동','')||'';
    db.opportunities.unshift({id:'opp_'+Date.now(),companyId:c.id,title,signal:title,problem,products:[product],priority:'보통',stage,nextAction,createdAt:Date.now()});save();renderSalesPipeline();
  }

  function renderSalesPipeline(){
    ensureSalesStructure();if(!window.db)return;
    db.companies=db.companies||[];db.contacts=db.contacts||[];db.interactions=db.interactions||[];db.opportunities=db.opportunities||[];
    const open=db.opportunities.filter(o=>!['수주','보류'].includes(o.stage)).length;
    const high=db.opportunities.filter(o=>o.priority==='높음').length;
    const contactGap=db.companies.filter(c=>!db.contacts.some(x=>x.companyId===c.id)).length;
    const next=db.opportunities.filter(o=>o.nextAction&&!['수주','보류'].includes(o.stage)).length;
    document.getElementById('salesMetrics').innerHTML=`<div class="metric"><b>${open}</b><span class="muted">진행 중 영업 기회</span></div><div class="metric"><b>${high}</b><span class="muted">높은 우선순위</span></div><div class="metric"><b>${contactGap}</b><span class="muted">Contact 보완 필요</span></div><div class="metric"><b>${next}</b><span class="muted">다음 행동 지정</span></div>`;
    document.getElementById('opportunityList').innerHTML=db.opportunities.length?`<table class="table"><thead><tr><th>기회 / 사업 신호</th><th>관련 기업</th><th>고객 문제</th><th>제안 상품</th><th>단계</th><th>다음 행동</th></tr></thead><tbody>${db.opportunities.map(o=>{const c=db.companies.find(x=>x.id===o.companyId);return `<tr><td><b>${esc(o.title||'-')}</b><div class="muted">${esc(o.signal||'직접 등록')}</div></td><td>${esc(companyName(c))}</td><td>${esc(o.problem||'-')}</td><td>${esc(Array.isArray(o.products)?o.products.join(', '):(o.product||'-'))}</td><td><span class="tag blue">${esc(o.stage||'신규')}</span></td><td><b>${esc(o.nextAction||'다음 행동 미정')}</b></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">아직 영업 기회가 없습니다. 공고·사업·고객 요구처럼 “왜 지금 접촉해야 하는지”가 생기면 영업 기회로 등록하세요.</div>';
    document.getElementById('companyList').innerHTML=db.companies.length?`<table class="table"><thead><tr><th>기업 / 고객</th><th>유형</th><th>산업</th><th>TeamGRIT 담당</th><th>Contact</th><th>최근 접촉</th></tr></thead><tbody>${db.companies.map(c=>{const contacts=db.contacts.filter(x=>x.companyId===c.id),last=latestInteraction(c.id);return `<tr><td><b>${esc(companyName(c))}</b><div class="muted">${esc(c.partner?`파트너 ${c.partner}`:(c.relationship||c.sourceType||''))}</div></td><td>${esc(c.customerType||c.companyType||'-')}</td><td>${esc(c.industry||'-')}</td><td>${c.accountOwner?esc(c.accountOwner):'<span class="tag amber">미지정</span>'}</td><td>${contacts.length?contacts.map(x=>esc(x.name)).join(', '):'<span class="tag amber">보완 필요</span>'}</td><td>${last?`${esc(last.type||'접촉')}<div class="muted">${esc(last.date||'')}</div>`:'-'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">등록된 기업이 없습니다.</div>';
    document.getElementById('contactList').innerHTML=db.contacts.length?`<table class="table"><thead><tr><th>기업</th><th>Contact</th><th>이메일</th><th>전화</th><th>최근 접촉</th></tr></thead><tbody>${db.contacts.map(c=>{const company=db.companies.find(x=>x.id===c.companyId),last=latestInteraction(c.companyId);return `<tr><td>${esc(companyName(company))}</td><td><b>${esc(c.name||'-')}</b></td><td>${esc(c.email||'-')}</td><td>${esc(c.phone||'-')}</td><td>${last?`${esc(last.type||'접촉')}<div class="muted">${esc(last.date||'')}</div>`:'-'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">Contact가 없습니다.</div>';
    document.getElementById('proposalList').innerHTML=db.opportunities.length?`<table class="table"><thead><tr><th>기업</th><th>제안 상품</th><th>고객 문제</th><th>진행 단계</th><th>다음 행동</th></tr></thead><tbody>${db.opportunities.map(o=>{const c=db.companies.find(x=>x.id===o.companyId);return `<tr><td><b>${esc(companyName(c))}</b></td><td>${esc(Array.isArray(o.products)?o.products.join(', '):(o.product||'-'))}</td><td>${esc(o.problem||'-')}</td><td><span class="tag blue">${esc(o.stage||'신규')}</span></td><td>${esc(o.nextAction||'다음 행동 미정')}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">영업 기회를 등록하면 제안·진행 상태가 표시됩니다.</div>';
  }

  function bindNavigation(){
    ensureFourTabs();
    const bind=(id,view)=>{const b=document.getElementById(id);if(b)b.onclick=()=>showPage(view)};
    bind('navDash','dash');bind('navProjects','projects');bind('navSales','sales');bind('navAutomation','automation');
    const back=document.getElementById('backProjects');if(back)back.onclick=()=>showPage('projects');
    if(typeof window.show==='function')window.show=showPage;
    if(typeof window.openProject==='function'&&!window.openProject.__tgWrapped){
      const original=window.openProject;
      const wrapped=async function(id){hideAllPages();document.getElementById('navProjects')?.classList.add('active');return original(id)};
      wrapped.__tgWrapped=true;window.openProject=wrapped;
    }
  }

  addUpgradeStyles();
  bindUnifiedAutomation();
  ensureSalesStructure();
  bindNavigation();
  renderIntegratedProjectInfo();
  renderSalesPipeline();
  new MutationObserver(()=>{bindUnifiedAutomation();ensureFourTabs()}).observe(document.body,{childList:true,subtree:true});
})();
