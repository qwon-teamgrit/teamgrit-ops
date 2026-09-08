(function(){
  function q(id){return document.getElementById(id)}
  function safe(v){return typeof esc==='function'?esc(v||'-'):String(v||'-')}
  function data(){try{return typeof db!=='undefined'?db:null}catch{return null}}

  function bindAutomation(){
    const btn=q('runAutomation');
    if(!btn)return;
    btn.onclick=async()=>{
      btn.disabled=true;const label=btn.textContent;
      try{
        btn.textContent='Drive·Chat 확인 중...';
        if(typeof window.runOpsAutomation==='function')await window.runOpsAutomation();
        if(typeof window.syncGoogleChatSources==='function')await window.syncGoogleChatSources();
      }finally{btn.disabled=false;btn.textContent=label||'자동화 실행'}
    };
  }

  function installStyles(){
    if(q('finalUiFixStyle'))return;
    const s=document.createElement('style');s.id='finalUiFixStyle';s.textContent=`
      #navKnowledge{display:none!important}
      #knowledge{display:none!important}
      .sales-flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0;padding:14px 16px;border:1px solid var(--md-sys-color-outline-variant);border-radius:14px;background:#fff}
      .sales-flow span{padding:8px 12px;border-radius:18px;background:var(--md-sys-color-surface-container-low);font-size:12px;font-weight:700}.sales-flow b{color:var(--md-sys-color-outline)}
      .sales-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.sales-tabs button{border:1px solid var(--md-sys-color-outline);background:#fff;border-radius:18px;padding:9px 13px;cursor:pointer}.sales-tabs button.active{background:var(--md-sys-color-primary-container);border-color:transparent}
      .project-info-integrated{margin-top:18px}.project-info-integrated .metrics{margin-top:0}.sales-view.hidden{display:none!important}
    `;document.head.appendChild(s);
  }

  function prepareProjectInfo(){
    const hidden=q('knowledge'),projects=q('projects');if(!hidden||!projects)return;
    const old=q('navKnowledge')?.onclick;
    try{if(typeof old==='function')old()}catch{}
    let wrap=q('projectInfoIntegrated');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='projectInfoIntegrated';wrap.className='project-info-integrated';
      wrap.innerHTML='<div class="panel"><div class="ph"><b>프로젝트 정보</b><span class="muted">Drive에서 발견한 프로젝트·Feature·Device·Source와 변경 Fact를 목록과 함께 확인합니다.</span></div><div class="pb" id="projectInfoIntegratedBody"></div></div>';
      projects.appendChild(wrap);
    }
    const body=q('projectInfoIntegratedBody');
    const metrics=q('knowledgeMetrics'),info=q('projectInfoList'),facts=q('factList');
    if(metrics&&!q('piMetricsWrap')){const d=document.createElement('div');d.id='piMetricsWrap';d.appendChild(metrics);body.appendChild(d)}
    if(info&&!q('piListWrap')){const d=document.createElement('div');d.id='piListWrap';d.innerHTML='<h3 style="margin:18px 0 10px">Drive 기준 프로젝트 정보</h3>';d.appendChild(info);body.appendChild(d)}
    if(facts&&!q('piFactWrap')){const d=document.createElement('div');d.id='piFactWrap';d.innerHTML='<h3 style="margin:18px 0 10px">Drive 변경·Fact</h3>';d.appendChild(facts);body.appendChild(d)}
    hidden.classList.add('hidden');hidden.style.display='none';
  }

  function companyName(c){return c?.endCustomer||c?.companyName||c?.partner||'-'}
  function latest(companyId){const d=data();return (d?.interactions||[]).filter(x=>x.companyId===companyId).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]}

  function buildSales(){
    const sales=q('sales'),d=data();if(!sales||!d)return;
    d.companies=d.companies||[];d.contacts=d.contacts||[];d.interactions=d.interactions||[];d.opportunities=d.opportunities||[];
    sales.innerHTML=`<div class="head"><div><h1>영업</h1><div class="muted">사업 신호 → 고객 문제 → TeamGRIT 상품 → Contact → 제안·미팅 → 다음 행동을 한 흐름으로 관리합니다.</div></div><div class="taskActions top-actions"><button class="btn" id="salesAddCompany">기업 추가</button><button class="btn primary" id="salesAddOpp">영업 기회 추가</button></div></div><div class="metrics" id="salesMetrics"></div><div class="sales-flow"><span>사업 신호</span><b>→</b><span>고객 문제</span><b>→</b><span>TeamGRIT 상품</span><b>→</b><span>Contact</span><b>→</b><span>제안·미팅</span><b>→</b><span>다음 행동</span></div><div class="sales-tabs"><button class="active" data-sv="opp">영업 기회</button><button data-sv="company">기업 / 고객</button><button data-sv="contact">Contact / 접촉</button><button data-sv="proposal">제안 / 진행 상태</button></div><div id="svOpp" class="panel sales-view"><div class="ph"><b>영업 기회</b><span class="muted">왜 지금 접촉해야 하는지와 다음 행동</span></div><div class="pb" id="opportunityList"></div></div><div id="svCompany" class="panel sales-view hidden"><div class="ph"><b>기업 / 고객</b><span class="muted">기업 유형, 관계, 담당자</span></div><div class="pb" id="companyList"></div></div><div id="svContact" class="panel sales-view hidden"><div class="ph"><b>Contact / 접촉 이력</b><span class="muted">중복 접촉 방지와 최근 접점</span></div><div class="pb" id="contactList"></div></div><div id="svProposal" class="panel sales-view hidden"><div class="ph"><b>제안 / 진행 상태</b><span class="muted">제안 상품, 단계, 다음 액션</span></div><div class="pb" id="proposalList"></div></div>`;
    renderSales();
    sales.querySelectorAll('[data-sv]').forEach(b=>b.onclick=()=>{sales.querySelectorAll('[data-sv]').forEach(x=>x.classList.toggle('active',x===b));['opp','company','contact','proposal'].forEach(k=>q('sv'+k[0].toUpperCase()+k.slice(1))?.classList.toggle('hidden',k!==b.dataset.sv))});
    q('salesAddCompany').onclick=()=>{const name=prompt('기업명');if(!name)return;d.companies.unshift({id:'company_'+Date.now(),companyName:name,endCustomer:name,customerType:'잠재고객',createdAt:Date.now()});if(typeof save==='function')save();renderSales()};
    q('salesAddOpp').onclick=()=>{if(!d.companies.length)return alert('먼저 기업을 추가해 주세요.');const idx=Number(prompt(d.companies.map((c,i)=>`${i+1}. ${companyName(c)}`).join('\n')));const c=d.companies[idx-1];if(!c)return;const title=prompt('영업 기회 / 사업 신호');if(!title)return;const problem=prompt('고객 문제','')||'';const product=prompt('제안 상품','CoBiz')||'CoBiz';const next=prompt('다음 행동','')||'';d.opportunities.unshift({id:'opp_'+Date.now(),companyId:c.id,title,signal:title,problem,products:[product],stage:'신규',priority:'보통',nextAction:next,createdAt:Date.now()});if(typeof save==='function')save();renderSales()};
  }

  function renderSales(){
    const d=data();if(!d||!q('salesMetrics'))return;
    const open=(d.opportunities||[]).filter(o=>!['수주','보류'].includes(o.stage)).length, contactGap=(d.companies||[]).filter(c=>!(d.contacts||[]).some(x=>x.companyId===c.id)).length, next=(d.opportunities||[]).filter(o=>o.nextAction&&!['수주','보류'].includes(o.stage)).length;
    q('salesMetrics').innerHTML=`<div class="metric"><b>${open}</b><span class="muted">진행 중 영업 기회</span></div><div class="metric"><b>${d.companies.length}</b><span class="muted">기업 / 고객</span></div><div class="metric"><b>${contactGap}</b><span class="muted">Contact 보완 필요</span></div><div class="metric"><b>${next}</b><span class="muted">다음 행동 지정</span></div>`;
    q('opportunityList').innerHTML=d.opportunities.length?`<table class="table"><thead><tr><th>사업 신호</th><th>기업</th><th>고객 문제</th><th>제안 상품</th><th>단계</th><th>다음 행동</th></tr></thead><tbody>${d.opportunities.map(o=>{const c=d.companies.find(x=>x.id===o.companyId);return `<tr><td><b>${safe(o.title||o.signal)}</b></td><td>${safe(companyName(c))}</td><td>${safe(o.problem)}</td><td>${safe(Array.isArray(o.products)?o.products.join(', '):o.product)}</td><td>${safe(o.stage||'신규')}</td><td><b>${safe(o.nextAction)}</b></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">아직 등록된 영업 기회가 없습니다.</div>';
    q('companyList').innerHTML=d.companies.length?`<table class="table"><thead><tr><th>기업 / 고객</th><th>유형</th><th>산업</th><th>내부 담당</th><th>Contact</th><th>최근 접촉</th></tr></thead><tbody>${d.companies.map(c=>{const cs=d.contacts.filter(x=>x.companyId===c.id),i=latest(c.id);return `<tr><td><b>${safe(companyName(c))}</b><div class="muted">${safe(c.partner?`파트너 ${c.partner}`:'직접')}</div></td><td>${safe(c.customerType||c.companyType)}</td><td>${safe(c.industry)}</td><td>${safe(c.accountOwner||'미지정')}</td><td>${cs.length?cs.map(x=>safe(x.name)).join(', '):'보완 필요'}</td><td>${i?safe(i.subject||i.type):'-'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">등록된 기업이 없습니다.</div>';
    q('contactList').innerHTML=d.contacts.length?`<table class="table"><thead><tr><th>기업</th><th>Contact</th><th>이메일</th><th>전화</th><th>최근 접촉</th></tr></thead><tbody>${d.contacts.map(c=>{const co=d.companies.find(x=>x.id===c.companyId),i=latest(c.companyId);return `<tr><td>${safe(companyName(co))}</td><td><b>${safe(c.name)}</b></td><td>${safe(c.email)}</td><td>${safe(c.phone)}</td><td>${i?safe(i.subject||i.type):'-'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">등록된 Contact가 없습니다.</div>';
    q('proposalList').innerHTML=d.opportunities.length?`<table class="table"><thead><tr><th>기업</th><th>제안 상품</th><th>진행 단계</th><th>다음 행동</th></tr></thead><tbody>${d.opportunities.map(o=>{const c=d.companies.find(x=>x.id===o.companyId);return `<tr><td>${safe(companyName(c))}</td><td><b>${safe(Array.isArray(o.products)?o.products.join(', '):o.product)}</b></td><td>${safe(o.stage||'신규')}</td><td>${safe(o.nextAction)}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">제안 진행 건이 없습니다.</div>';
  }

  function hidePages(){['dashboard','projects','knowledge','sales','automationPanel','projectDetail'].forEach(id=>q(id)?.classList.add('hidden'));document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'))}
  function go(view){hidePages();const map={dash:['dashboard','navDash'],projects:['projects','navProjects'],sales:['sales','navSales'],automation:['automationPanel','navAutomation']},m=map[view];if(!m)return;q(m[0])?.classList.remove('hidden');q(m[1])?.classList.add('active');if(view==='dash'&&typeof renderDash==='function')renderDash();if(view==='projects'){if(typeof renderProjects==='function')renderProjects();prepareProjectInfo()}if(view==='sales')renderSales();if(typeof authStatus==='function')authStatus();window.scrollTo(0,0)}

  function init(){
    installStyles();prepareProjectInfo();buildSales();bindAutomation();
    q('navDash').onclick=()=>go('dash');q('navProjects').onclick=()=>go('projects');q('navSales').onclick=()=>go('sales');q('navAutomation').onclick=()=>go('automation');
    const originalOpen=typeof openProject==='function'?openProject:null;if(originalOpen){openProject=async id=>{hidePages();await originalOpen(id);q('projectDetail')?.classList.remove('hidden')}}
    q('backProjects').onclick=()=>go('projects');
    go('dash');
  }
  setTimeout(init,0);
})();
