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
    d.opportunities=d.opportunities||[];
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
    d.opportunities.forEach(o=>{
      if(!o.reviewStatus){o.reviewStatus=o.convertedProjectId?'프로젝트 전환':'검토 필요';changed=true}
      if(!o.sourceType){o.sourceType='직접 입력';changed=true}
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

  // Shared design-system modal. Uses the same opsModal shell already used elsewhere in TeamGRIT Ops.
  let modalSubmit=null;
  function closeSystemModal(){q('opsModal')?.classList.add('hidden');modalSubmit=null}
  function openSystemModal(title,desc,html,onSubmit){
    q('opsModalTitle').textContent=title;q('opsModalDesc').textContent=desc||'';q('opsModalFields').innerHTML=html;modalSubmit=onSubmit;q('opsModal').classList.remove('hidden');
    document.querySelectorAll('[data-close-modal]').forEach(el=>el.onclick=closeSystemModal);
    q('opsModalForm').onsubmit=e=>{e.preventDefault();modalSubmit?.(new FormData(q('opsModalForm')))};
  }

  function companyName(c){return c?.endCustomer||c?.companyName||c?.partner||'-'}
  function sourceLabel(o){return o.sourceType||o.source||'직접 입력'}
  function companyOptions(selected=''){const d=getDb();return `<option value="">기업 미지정</option>${(d.companies||[]).map(c=>`<option value="${safe(c.id)}" ${c.id===selected?'selected':''}>${safe(companyName(c))}</option>`).join('')}`}

  function openCandidateModal(){
    openSystemModal('영업 후보 직접 추가','자동 수집되지 않은 문의·소개·현장 접점만 직접 보완합니다. 프로젝트로 확정되기 전 필요한 최소 정보만 등록합니다.',`
      <div class="field"><label>후보 제목 *</label><input name="title" required placeholder="예: 조선소 사족보행 로봇 PoC 검토"></div>
      <div class="form-row"><div class="field"><label>관련 기업</label><select name="companyId">${companyOptions()}</select></div><div class="field"><label>출처</label><select name="sourceType"><option>직접 입력</option><option>Gmail</option><option>Google Drive</option><option>Google Chat</option><option>공공 공고</option><option>기업 뉴스</option></select></div></div>
      <div class="field"><label>확인된 내용</label><textarea name="summary" placeholder="실제로 확인된 요구·문의·사업 내용만 입력"></textarea></div>
      <div class="form-row"><div class="field"><label>TeamGRIT 적합 이유</label><input name="fitReason" placeholder="예: 이종 로봇 통합관제 수요"></div><div class="field"><label>제안 후보 상품</label><input name="product" placeholder="예: CoBiz + Spider Runtime"></div></div>
      <div class="form-row"><div class="field"><label>마감 / 예상 시점</label><input name="deadline" type="date"></div><div class="field"><label>근거 링크</label><input name="sourceUrl" type="url" placeholder="https://..."></div></div>
    `,fd=>{
      const d=getDb();d.opportunities.unshift({id:'opp_'+Date.now(),companyId:fd.get('companyId')||null,title:fd.get('title'),summary:fd.get('summary')||'',fitReason:fd.get('fitReason')||'',products:fd.get('product')?[fd.get('product')]:[],sourceType:fd.get('sourceType')||'직접 입력',sourceUrl:fd.get('sourceUrl')||'',deadline:fd.get('deadline')||'',reviewStatus:'검토 필요',createdAt:Date.now()});
      if(typeof save==='function')save();closeSystemModal();renderSalesPipeline();
    });
  }

  function openSourceSettings(){
    const d=getDb();d.salesDiscoveryConfig=d.salesDiscoveryConfig||{cadence:'daily',publicBid:true,companyNews:true,gmail:true,drive:true,chat:true};const c=d.salesDiscoveryConfig;
    openSystemModal('영업 후보 자동 수집 설정','공개 소스와 내부 Google 도구에서 사업 신호를 주기적으로 수집하기 위한 기준입니다. 실제 서버 스케줄러 연결 후 이 설정을 사용합니다.',`
      <div class="field"><label>수집 주기</label><select name="cadence"><option value="daily" ${c.cadence==='daily'?'selected':''}>매일</option><option value="weekdays" ${c.cadence==='weekdays'?'selected':''}>평일만</option><option value="weekly" ${c.cadence==='weekly'?'selected':''}>주 1회</option></select></div>
      <div class="field"><label>수집 소스</label><div class="chip-list" style="display:grid;gap:10px;margin-top:8px"><label><input type="checkbox" name="publicBid" ${c.publicBid?'checked':''}> 공공 공고·R&D·입찰</label><label><input type="checkbox" name="companyNews" ${c.companyNews?'checked':''}> 기업 뉴스·보도자료</label><label><input type="checkbox" name="gmail" ${c.gmail?'checked':''}> Gmail 문의·회신</label><label><input type="checkbox" name="drive" ${c.drive?'checked':''}> Drive 신규 문서·제안요청</label><label><input type="checkbox" name="chat" ${c.chat?'checked':''}> Google Chat 문의·사업 논의</label></div></div>
      <div class="notice">수집된 원문 전체를 저장하지 않고, 기업·후보 제목·확인된 내용·적합 이유·추천 상품·마감·근거 링크만 후보 데이터로 남기는 구조입니다.</div>
    `,fd=>{
      d.salesDiscoveryConfig={cadence:fd.get('cadence'),publicBid:fd.has('publicBid'),companyNews:fd.has('companyNews'),gmail:fd.has('gmail'),drive:fd.has('drive'),chat:fd.has('chat')};if(typeof save==='function')save();closeSystemModal();renderSalesPipeline();
    });
  }

  function convertToProject(id){
    const d=getDb(),o=d.opportunities.find(x=>x.id===id);if(!o||o.convertedProjectId)return;
    const company=d.companies.find(c=>c.id===o.companyId);const defaultName=o.title||'신규 프로젝트';
    openSystemModal('프로젝트로 전환','영업 후보 검토가 끝난 건만 실제 프로젝트로 전환합니다. 후보 기록은 근거 이력으로 남고 활성 목록에서는 분리됩니다.',`
      <div class="field"><label>프로젝트명 *</label><input name="name" required value="${safe(defaultName)}"></div>
      <div class="form-row"><div class="field"><label>분류</label><select name="category"><option>제품·UIUX</option><option>문서·운영</option><option>행사·마케팅</option><option selected>기타</option></select></div><div class="field"><label>상태</label><select name="status"><option>요구사항 협의</option><option>예정</option><option>진행 중</option><option>검토 대기</option></select></div></div>
      <div class="field"><label>고객 / 연관기업</label><input name="customer" value="${safe(companyName(company)==='-'?'':companyName(company))}"></div>
    `,fd=>{
      const p={id:'p_'+Date.now(),name:fd.get('name'),category:fd.get('category'),status:fd.get('status'),customer:fd.get('customer')||'',driveUrl:'',driveFolderId:'',figmaUrl:'',refLinks:[],requests:[],originOpportunityId:o.id};
      d.projects.unshift(p);o.convertedProjectId=p.id;o.reviewStatus='프로젝트 전환';o.convertedAt=Date.now();if(typeof save==='function')save();closeSystemModal();renderSalesPipeline();renderUnifiedProjects();
    });
  }
  window.convertSalesCandidate=convertToProject;
  window.excludeSalesCandidate=id=>{const d=getDb(),o=d.opportunities.find(x=>x.id===id);if(!o)return;o.reviewStatus='제외';if(typeof save==='function')save();renderSalesPipeline()};
  window.openConvertedProject=id=>{const d=getDb(),o=d.opportunities.find(x=>x.id===id);if(o?.convertedProjectId)openProject(o.convertedProjectId)};

  function buildSalesWorkspace(){
    const sales=q('sales'),d=getDb();if(!sales||!d)return;
    d.opportunities=d.opportunities||[];d.companies=d.companies||[];d.contacts=d.contacts||[];d.interactions=d.interactions||[];
    sales.innerHTML=`<div class="head"><div><h1>영업</h1><div class="muted">외부·내부에서 발견한 사업 신호를 후보로 모으고, 필요한 건만 검토 후 프로젝트로 전환합니다.</div></div><div class="taskActions top-actions"><button class="btn" id="salesSourceSettings">자동 수집 설정</button><button class="btn" id="salesSync">고객·Gmail 동기화</button><button class="btn primary" id="salesAddCandidate">후보 직접 추가</button></div></div><div class="metrics" id="salesMetrics"></div><div class="panel"><div class="ph"><b>영업 후보</b><span class="muted">자동 수집 → 필요한 정보만 요약 → 검토 → 프로젝트 전환 또는 제외</span></div><div class="pb" id="opportunityList"></div></div><div class="panel"><div class="ph"><b>기업 / 고객 · Contact</b><span class="muted">기존 관계와 중복 접촉을 확인하기 위한 마스터 정보</span></div><div class="pb" id="companyContactList"></div></div>`;
    q('salesSourceSettings').onclick=openSourceSettings;
    q('salesSync').onclick=()=>{try{q('syncSales')?.click()}catch{}renderSalesPipeline()};
    q('salesAddCandidate').onclick=openCandidateModal;
    renderSalesPipeline();
  }

  function renderSalesPipeline(){
    const d=getDb();if(!d||!q('salesMetrics'))return;
    const review=(d.opportunities||[]).filter(o=>!['제외','프로젝트 전환'].includes(o.reviewStatus));
    const auto=review.filter(o=>['공공 공고','기업 뉴스','Gmail','Google Drive','Google Chat','자동 수집'].includes(sourceLabel(o))).length;
    const converted=(d.opportunities||[]).filter(o=>o.reviewStatus==='프로젝트 전환').length;
    const contactGap=(d.companies||[]).filter(c=>!(d.contacts||[]).some(x=>x.companyId===c.id)).length;
    q('salesMetrics').innerHTML=`<div class="metric"><b>${review.length}</b><span class="muted">검토할 영업 후보</span></div><div class="metric"><b>${auto}</b><span class="muted">자동 수집 후보</span></div><div class="metric"><b>${converted}</b><span class="muted">프로젝트 전환</span></div><div class="metric"><b>${contactGap}</b><span class="muted">Contact 보완 필요</span></div>`;
    q('opportunityList').innerHTML=review.length?`<table class="table"><thead><tr><th>출처</th><th>영업 후보</th><th>기업</th><th>확인된 내용 / 적합 이유</th><th>제안 후보</th><th>시점</th><th></th></tr></thead><tbody>${review.map(o=>{const c=d.companies.find(x=>x.id===o.companyId);return `<tr><td><span class="tag">${safe(sourceLabel(o))}</span></td><td><b>${safe(o.title||o.signal||'-')}</b>${o.sourceUrl?`<div><a target="_blank" href="${safe(o.sourceUrl)}">근거 보기 ↗</a></div>`:''}</td><td>${safe(companyName(c))}</td><td>${safe(o.summary||o.problem||'-')}${o.fitReason?`<div class="muted" style="margin-top:4px">적합: ${safe(o.fitReason)}</div>`:''}</td><td>${safe(Array.isArray(o.products)?o.products.join(', '):(o.product||'-'))}</td><td>${safe(o.deadline||'-')}</td><td><div class="taskActions"><button class="btn primary" onclick="convertSalesCandidate('${o.id}')">프로젝트로 전환</button><button class="btn" onclick="excludeSalesCandidate('${o.id}')">제외</button></div></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">현재 검토할 영업 후보가 없습니다. 자동 수집 또는 직접 추가로 후보가 들어오면 여기에서 프로젝트 전환 여부만 판단합니다.</div>';
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
