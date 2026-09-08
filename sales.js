/* Sales workspace overlay: preserves existing company/contact data and extends the flow around opportunities. */
(function(){
  const stages=['신규','검토 중','접촉 예정','미팅','제안','PoC','견적','협의 중','수주','보류'];
  const companyTypes=['로봇 제조사','SI','대학·연구기관','최종 수요기업','AI·로봇모델 기업','파트너','기타'];
  const relations=['잠재고객','기존고객','파트너','경쟁·협력 경계','경쟁','기타'];
  const products=['이종 로봇 통합운영','Robot Black Box','통신 취약환경 로봇 운영','Difficult-Site Navigation','AI Task Automation','Spider Runtime','CoBiz','GRIT SLAM','Vision Skill Pack'];

  function companyById(id){return db.companies.find(c=>c.id===id)}
  function contactById(id){return db.contacts.find(c=>c.id===id)}
  function oppCompany(o){return companyById(o.companyId)}
  function safe(v){return esc(v||'-')}
  function productLabel(o){return Array.isArray(o.products)?o.products.join(', '):(o.product||'-')}
  function nextAction(o){return o.nextAction||'다음 행동 미정'}
  function interactionFor(companyId){return db.interactions.filter(x=>x.companyId===companyId).sort((a,b)=>(b.date||0)-(a.date||0))[0]}

  renderSales=function(){
    db.opportunities=db.opportunities||[];
    db.companies=db.companies||[];
    db.contacts=db.contacts||[];
    db.interactions=db.interactions||[];
    const open=db.opportunities.filter(o=>!['수주','보류'].includes(o.stage)).length;
    const high=db.opportunities.filter(o=>o.priority==='높음').length;
    const missingContact=db.companies.filter(c=>!db.contacts.some(x=>x.companyId===c.id)).length;
    const nextDue=db.opportunities.filter(o=>o.nextAction && !['수주','보류'].includes(o.stage)).length;
    $('#salesMetrics').innerHTML=`<div class="metric"><b>${open}</b><span class="muted">진행 중 영업 기회</span></div><div class="metric"><b>${high}</b><span class="muted">높은 우선순위</span></div><div class="metric"><b>${missingContact}</b><span class="muted">Contact 보완 필요</span></div><div class="metric"><b>${nextDue}</b><span class="muted">다음 행동 지정</span></div>`;

    $('#opportunityList').innerHTML=db.opportunities.length?`<table class="table"><thead><tr><th>기회 / 사업 신호</th><th>관련 기업</th><th>고객 문제</th><th>제안 상품</th><th>우선순위</th><th>단계</th><th>다음 행동</th></tr></thead><tbody>${db.opportunities.map(o=>{const c=oppCompany(o);return `<tr><td><b>${safe(o.title)}</b><div class="muted">${safe(o.signal||o.source||'직접 등록')}</div></td><td>${c?`<b>${safe(c.companyName)}</b><div class="muted">${safe(c.companyType||c.industry)}</div>`:'-'}</td><td>${safe(o.problem)}</td><td>${safe(productLabel(o))}</td><td><span class="tag ${o.priority==='높음'?'amber':o.priority==='낮음'?'':'blue'}">${safe(o.priority||'보통')}</span></td><td>${safe(o.stage||'신규')}</td><td><b>${safe(nextAction(o))}</b>${o.nextActionDate?`<div class="muted">${safe(o.nextActionDate)}</div>`:''}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">아직 영업 기회가 없습니다. 공고·사업·고객 요구·파트너 제안처럼 “왜 지금 접촉해야 하는지”가 생겼을 때 영업 기회로 등록하세요.</div>';

    $('#companyList').innerHTML=db.companies.length?`<table class="table"><thead><tr><th>기업 / 고객</th><th>유형</th><th>TeamGRIT과 관계</th><th>산업</th><th>내부 담당자</th><th>Contact</th><th>관련 기회</th></tr></thead><tbody>${db.companies.map(c=>{const contacts=db.contacts.filter(x=>x.companyId===c.id);const opps=db.opportunities.filter(o=>o.companyId===c.id);return `<tr><td><b>${safe(c.companyName)}</b><div class="muted">${safe(c.status||'관리 중')}</div></td><td>${safe(c.companyType||'-')}</td><td>${safe(c.relationship||'-')}</td><td>${safe(c.industry||'-')}</td><td>${c.accountOwner?safe(c.accountOwner):'<span class="tag amber">미지정</span>'}</td><td>${contacts.length?contacts.map(x=>safe(x.name)).join(', '):'<span class="tag amber">보완 필요</span>'}</td><td>${opps.length}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">등록된 기업이 없습니다. 기업은 단순 주소록이 아니라 제조사·SI·연구기관·수요기업 등 영업 유형과 TeamGRIT과의 관계를 함께 관리합니다.</div>';

    $('#contactList').innerHTML=db.contacts.length?`<table class="table"><thead><tr><th>기업</th><th>Contact</th><th>부서 / 역할</th><th>이메일</th><th>TeamGRIT 담당</th><th>최근 접촉</th></tr></thead><tbody>${db.contacts.map(c=>{const company=companyById(c.companyId),last=interactionFor(c.companyId);return `<tr><td>${company?`<b>${safe(company.companyName)}</b>`:'-'}</td><td><b>${safe(c.name)}</b></td><td>${safe([c.department,c.role].filter(Boolean).join(' · '))}</td><td>${safe(c.email)}</td><td>${company&&company.accountOwner?safe(company.accountOwner):'<span class="tag amber">미지정</span>'}</td><td>${last?`<b>${safe(last.type||'접촉')}</b><div class="muted">${fmtDate(last.date)}</div>`:'-'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">아직 Contact가 없습니다. 같은 기업을 여러 명이 따로 접촉하지 않도록 기업 Account 아래에 Contact를 연결하세요.</div>';

    $('#proposalList').innerHTML=db.opportunities.length?`<table class="table"><thead><tr><th>기업</th><th>제안 상품</th><th>진행 단계</th><th>최근 / 예정 행동</th><th>근거</th></tr></thead><tbody>${db.opportunities.map(o=>{const c=oppCompany(o);return `<tr><td>${c?`<b>${safe(c.companyName)}</b>`:'-'}</td><td><b>${safe(productLabel(o))}</b><div class="muted">${safe(o.problem)}</div></td><td><span class="tag blue">${safe(o.stage||'신규')}</span></td><td>${safe(nextAction(o))}${o.nextActionDate?`<div class="muted">${safe(o.nextActionDate)}</div>`:''}</td><td>${safe(o.evidence||o.source||o.signal||'-')}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">영업 기회를 등록하면 어떤 문제에 어떤 상품을 제안하고 다음에 무엇을 해야 하는지 이곳에서 이어서 관리할 수 있습니다.</div>';
  };

  const oldCompany=$('#newCompany')?.onclick;
  if($('#newCompany')) $('#newCompany').onclick=()=>{
    const companyName=prompt('기업명');if(!companyName)return;
    if(db.companies.some(c=>(c.companyName||'').trim().toLowerCase()===companyName.trim().toLowerCase()))return alert('이미 등록된 기업입니다. 기존 기업에 Contact나 영업 기회를 추가하세요.');
    const typeIdx=Number(prompt(`기업 유형 번호를 입력하세요.\n${companyTypes.map((x,i)=>`${i+1}. ${x}`).join('\n')}`));
    const relationIdx=Number(prompt(`TeamGRIT과 관계 번호를 입력하세요.\n${relations.map((x,i)=>`${i+1}. ${x}`).join('\n')}`));
    const industry=prompt('산업/분야','')||'';
    const accountOwner=prompt('TeamGRIT 내부 담당자 (미정이면 비워두세요)','')||'';
    db.companies.unshift({id:uid('company'),companyName:companyName.trim(),companyType:companyTypes[typeIdx-1]||'기타',relationship:relations[relationIdx-1]||'기타',industry,accountOwner,status:'관리 중',createdAt:Date.now()});save();renderSales();
  };

  if($('#newOpportunity')) $('#newOpportunity').onclick=()=>{
    if(!db.companies.length)return alert('먼저 관련 기업을 등록해 주세요.');
    const companyOptions=db.companies.map((c,i)=>`${i+1}. ${c.companyName}`).join('\n');
    const companyIdx=Number(prompt(`관련 기업 번호를 입력하세요.\n${companyOptions}`));
    const company=db.companies[companyIdx-1];if(!company)return alert('올바른 기업 번호를 입력해 주세요.');
    const title=prompt('영업 기회명 / 사업 신호','');if(!title)return;
    const signal=prompt('어떤 사업·공고·고객 요구에서 생긴 기회인가요?','')||'';
    const problem=prompt('고객의 핵심 문제는 무엇인가요?','')||'';
    const pIdx=Number(prompt(`우선 제안할 TeamGRIT 상품 번호를 입력하세요.\n${products.map((x,i)=>`${i+1}. ${x}`).join('\n')}`));
    const priority=prompt('우선순위 (높음/보통/낮음)','보통')||'보통';
    const stageIdx=Number(prompt(`현재 단계 번호를 입력하세요.\n${stages.map((x,i)=>`${i+1}. ${x}`).join('\n')}`));
    const next=prompt('다음 행동','')||'';
    const nextDate=prompt('다음 행동 예정일 (예: 2026-09-15)','')||'';
    const evidence=prompt('근거 자료 / 출처','')||'';
    db.opportunities.unshift({id:uid('opp'),companyId:company.id,title:title.trim(),signal,problem,products:[products[pIdx-1]||'CoBiz'],priority,stage:stages[stageIdx-1]||'신규',nextAction:next,nextActionDate:nextDate,evidence,createdAt:Date.now()});save();renderSales();
  };
})();
