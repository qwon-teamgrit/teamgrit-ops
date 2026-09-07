(function(){
  const uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=ts=>{if(!ts)return '-';try{return new Date(ts).toLocaleString()}catch{return '-'}};
  function ensure(){
    ['technologies','companies','contacts','facts','interactions','opportunities'].forEach(k=>db[k]=db[k]||[]);
    db.projects.forEach(p=>{p.relatedTechnologyIds=p.relatedTechnologyIds||[];p.relatedCompanyIds=p.relatedCompanyIds||[]});
    save();
  }
  ensure();

  const originalRenderDash=renderDash;
  renderDash=function(){
    originalRenderDash();
    const pending=db.facts.filter(f=>f.approvalStatus==='후보');
    const unowned=db.companies.filter(c=>!c.accountOwner).length;
    if($('#metrics')) $('#metrics').innerHTML=`<div class="metric"><b>${db.projects.filter(p=>p.status==='진행 중').length}</b><span class="muted">진행 중 프로젝트</span></div><div class="metric"><b>${pending.length}</b><span class="muted">확인 필요한 Fact</span></div><div class="metric"><b>${db.companies.length}</b><span class="muted">등록 기업</span></div><div class="metric"><b>${unowned}</b><span class="muted">담당자 미지정 기업</span></div>`;
    if($('#dashFacts')) $('#dashFacts').innerHTML=pending.length?pending.slice(0,8).map(f=>`<div class="knowledge-row"><div><span class="tag amber">후보</span><b>${esc2(f.subject||'프로젝트 정보')}</b><div>${esc2(f.fact)}</div><div class="muted">${esc2(f.sourceProjectName||'')} ${f.source?'· '+esc2(f.source):''}</div></div><div class="taskActions"><button class="btn primary" onclick="approveFact2('${f.id}')">승인</button><button class="btn" onclick="rejectFact2('${f.id}')">제외</button></div></div>`).join(''):'<div class="empty">확인할 신규 Fact가 없습니다.</div>';
  };

  function hideAll2(){['dashboard','projects','knowledge','sales','projectDetail'].forEach(id=>$('#'+id)?.classList.add('hidden'));document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'))}
  function showExtra(view){
    hideAll2();
    if(view==='knowledge'){ $('#knowledge').classList.remove('hidden');$('#navKnowledge').classList.add('active');renderKnowledge2(); }
    if(view==='sales'){ $('#sales').classList.remove('hidden');$('#navSales').classList.add('active');renderSales2(); }
    authStatus();
  }

  function renderKnowledge2(){
    const approved=db.facts.filter(f=>f.approvalStatus==='승인').length,pending=db.facts.filter(f=>f.approvalStatus==='후보').length;
    $('#knowledgeMetrics').innerHTML=`<div class="metric"><b>${db.technologies.length}</b><span class="muted">기술·제품</span></div><div class="metric"><b>${approved}</b><span class="muted">승인 Fact</span></div><div class="metric"><b>${pending}</b><span class="muted">검토 대기 Fact</span></div><div class="metric"><b>${db.projects.filter(p=>p.relatedTechnologyIds.length).length}</b><span class="muted">기술 연결 프로젝트</span></div>`;
    $('#technologyList').innerHTML=db.technologies.length?`<table class="table"><thead><tr><th>기술·제품</th><th>분류</th><th>현재 기능</th><th>제약 사항</th><th>연결 프로젝트</th></tr></thead><tbody>${db.technologies.map(t=>`<tr><td><b>${esc2(t.name)}</b></td><td>${esc2(t.category||'-')}</td><td>${esc2(t.capabilities||'-')}</td><td>${esc2(t.limitations||'-')}</td><td>${db.projects.filter(p=>p.relatedTechnologyIds.includes(t.id)).length}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">아직 등록된 기술·제품이 없습니다.</div>';
    const facts=[...db.facts].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    $('#factList').innerHTML=facts.length?facts.map(f=>`<div class="knowledge-row"><div><span class="tag ${f.approvalStatus==='승인'?'green':f.approvalStatus==='후보'?'amber':''}">${esc2(f.approvalStatus||'후보')}</span><b>${esc2(f.subject||'프로젝트 정보')}</b><div>${esc2(f.fact)}</div><div class="muted">출처: ${esc2(f.sourceProjectName||'')} ${f.source?'· '+esc2(f.source):''} · ${fmt(f.createdAt)}</div></div>${f.approvalStatus==='후보'?`<div class="taskActions"><button class="btn primary" onclick="approveFact2('${f.id}')">승인</button><button class="btn" onclick="rejectFact2('${f.id}')">제외</button></div>`:''}</div>`).join(''):'<div class="empty">Drive 분석을 실행하면 추출된 사실이 후보 Fact로 쌓입니다.</div>';
  }

  function renderSales2(){
    const unowned=db.companies.filter(c=>!c.accountOwner).length;
    $('#salesMetrics').innerHTML=`<div class="metric"><b>${db.companies.length}</b><span class="muted">기업</span></div><div class="metric"><b>${db.contacts.length}</b><span class="muted">Contact</span></div><div class="metric"><b>${unowned}</b><span class="muted">내부 담당자 미지정</span></div><div class="metric"><b>${db.opportunities.length}</b><span class="muted">Opportunity</span></div>`;
    $('#companyList').innerHTML=db.companies.length?`<table class="table"><thead><tr><th>기업</th><th>산업</th><th>내부 담당자</th><th>Contact</th><th>연결 프로젝트</th></tr></thead><tbody>${db.companies.map(c=>{const contacts=db.contacts.filter(x=>x.companyId===c.id);return `<tr><td><b>${esc2(c.companyName)}</b></td><td>${esc2(c.industry||'-')}</td><td>${c.accountOwner?esc2(c.accountOwner):'<span class="tag amber">미지정</span>'}</td><td>${contacts.length?contacts.map(x=>esc2(x.name)).join(', '):'-'}</td><td>${db.projects.filter(p=>p.relatedCompanyIds.includes(c.id)).length}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">아직 등록된 기업이 없습니다. 영업 또는 파트너 접점이 있는 기업을 Account 단위로 등록하세요.</div>';
  }

  function subjectOf(text=''){
    const low=text.toLowerCase();
    const t=db.technologies.find(x=>low.includes((x.name||'').toLowerCase())); if(t) return t.name;
    const c=db.companies.find(x=>low.includes((x.companyName||'').toLowerCase())); if(c) return c.companyName;
    return '프로젝트 정보';
  }
  function persistFacts(a){
    const p=current(); if(!p)return;
    (a?.facts||[]).forEach(f=>{const fact=String(f.fact||'').trim();if(!fact)return;if(db.facts.some(x=>x.projectId===p.id&&x.fact===fact&&x.approvalStatus!=='제외'))return;db.facts.unshift({id:uid('fact'),subject:subjectOf(fact),fact,source:f.source||'',projectId:p.id,sourceProjectName:p.name,createdAt:Date.now(),approvalStatus:'후보'})});
    save();
  }
  const originalRenderAnalysis=renderAnalysis;
  renderAnalysis=function(a,meta){persistFacts(a);originalRenderAnalysis(a,meta)};

  window.approveFact2=id=>{const f=db.facts.find(x=>x.id===id);if(!f)return;f.approvalStatus='승인';f.approvedAt=Date.now();save();$('#knowledge')&&!$('#knowledge').classList.contains('hidden')?renderKnowledge2():renderDash()};
  window.rejectFact2=id=>{const f=db.facts.find(x=>x.id===id);if(!f)return;f.approvalStatus='제외';save();$('#knowledge')&&!$('#knowledge').classList.contains('hidden')?renderKnowledge2():renderDash()};

  function renderRelations(){
    const p=current();if(!p||!$('#projectRelations'))return;
    const ts=p.relatedTechnologyIds.map(id=>db.technologies.find(t=>t.id===id)).filter(Boolean),cs=p.relatedCompanyIds.map(id=>db.companies.find(c=>c.id===id)).filter(Boolean);
    $('#projectRelations').innerHTML=`<div class="relation-block"><label>기술·제품</label><div class="chip-list">${ts.length?ts.map(t=>`<span class="tag blue">${esc2(t.name)} <button onclick="unlinkTech2('${t.id}')">×</button></span>`).join(''):'<span class="muted">연결 없음</span>'}</div>${db.technologies.length?`<div class="inline-control"><select id="relationTechnology"><option value="">기술 선택</option>${db.technologies.filter(t=>!p.relatedTechnologyIds.includes(t.id)).map(t=>`<option value="${t.id}">${esc2(t.name)}</option>`).join('')}</select><button class="btn" onclick="linkTech2()">연결</button></div>`:'<div class="muted">지식 메뉴에서 기술·제품을 먼저 등록하세요.</div>'}</div><div class="relation-block"><label>기업</label><div class="chip-list">${cs.length?cs.map(c=>`<span class="tag">${esc2(c.companyName)} <button onclick="unlinkCompany2('${c.id}')">×</button></span>`).join(''):'<span class="muted">연결 없음</span>'}</div>${db.companies.length?`<div class="inline-control"><select id="relationCompany"><option value="">기업 선택</option>${db.companies.filter(c=>!p.relatedCompanyIds.includes(c.id)).map(c=>`<option value="${c.id}">${esc2(c.companyName)}</option>`).join('')}</select><button class="btn" onclick="linkCompany2()">연결</button></div>`:'<div class="muted">영업 메뉴에서 기업을 먼저 등록하세요.</div>'}</div>`;
  }
  const originalOpenProject=openProject;
  openProject=async function(id){await originalOpenProject(id);renderRelations()};
  window.linkTech2=()=>{const id=$('#relationTechnology')?.value,p=current();if(!id||!p)return;p.relatedTechnologyIds.push(id);save();renderRelations()};
  window.unlinkTech2=id=>{const p=current();p.relatedTechnologyIds=p.relatedTechnologyIds.filter(x=>x!==id);save();renderRelations()};
  window.linkCompany2=()=>{const id=$('#relationCompany')?.value,p=current();if(!id||!p)return;p.relatedCompanyIds.push(id);save();renderRelations()};
  window.unlinkCompany2=id=>{const p=current();p.relatedCompanyIds=p.relatedCompanyIds.filter(x=>x!==id);save();renderRelations()};

  $('#navKnowledge').onclick=()=>showExtra('knowledge');
  $('#navSales').onclick=()=>showExtra('sales');
  $('#newTechnology').onclick=()=>{const name=prompt('기술·제품명');if(!name)return;const category=prompt('분류','로봇·플랫폼')||'';const capabilities=prompt('현재 가능한 기능','')||'';const limitations=prompt('현재 제약 사항','')||'';db.technologies.unshift({id:uid('tech'),name:name.trim(),category,capabilities,limitations,createdAt:Date.now()});save();renderKnowledge2()};
  $('#newCompany').onclick=()=>{const name=prompt('기업명');if(!name)return;if(db.companies.some(c=>c.companyName.trim().toLowerCase()===name.trim().toLowerCase()))return alert('이미 등록된 기업입니다. 기존 기업에 Contact를 추가해 주세요.');const industry=prompt('산업/분야','')||'';const accountOwner=prompt('TeamGRIT 내부 담당자','')||'';db.companies.unshift({id:uid('company'),companyName:name.trim(),industry,accountOwner,status:'관리 중',createdAt:Date.now()});save();renderSales2()};
  $('#newContact').onclick=()=>{if(!db.companies.length)return alert('먼저 기업을 등록해 주세요.');const options=db.companies.map((c,i)=>`${i+1}. ${c.companyName}`).join('\n');const pick=Number(prompt(`Contact가 속한 기업 번호를 입력하세요.\n${options}`));const company=db.companies[pick-1];if(!company)return;const name=prompt('담당자명');if(!name)return;const department=prompt('부서','')||'';const role=prompt('직책/역할','')||'';const email=prompt('이메일','')||'';db.contacts.unshift({id:uid('contact'),companyId:company.id,name:name.trim(),department,role,email,createdAt:Date.now()});save();renderSales2()};

  renderDash();
})();