(function(){
  const q=id=>document.getElementById(id);
  const hide=id=>q(id)?.classList.add('hidden');
  const show=id=>q(id)?.classList.remove('hidden');
  const safe=v=>typeof esc==='function'?esc(v??''):String(v??'');
  const getDb=()=>{try{return db}catch{return null}};
  const now=()=>Date.now();
  const statusOptions=['진행 전','진행 중','보류','드랍','프로젝트 전환'];
  const stageOptions=['발견','1차 연락','회신 확인','미팅','제안서 전달','견적 협의','MOU 검토','방문 일정','PoC 협의','PoC 진행','프로젝트 전환'];

  function hideAll(){
    ['dashboard','projects','knowledge','sales','automationPanel','projectDetail'].forEach(hide);
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  }

  function normalizeName(v=''){
    return String(v).toLowerCase().replace(/\[[^\]]+\]/g,'').replace(/\s+/g,'').replace(/[·\-_/()]/g,'');
  }

  function ensureData(){
    const d=getDb();if(!d)return;
    ['projects','projectInfo','features','devices','sources','facts','companies','contacts','interactions','opportunities'].forEach(k=>d[k]=d[k]||[]);
    d.salesActivities=d.salesActivities||[];
    d.salesDiscoveryConfig=d.salesDiscoveryConfig||{cadence:'daily',publicBid:true,companyNews:true,gmail:true,drive:true,chat:true};
    let changed=false;
    d.projectInfo.forEach(pi=>{
      let p=d.projects.find(x=>x.projectInfoId===pi.id)||d.projects.find(x=>normalizeName(x.name)===normalizeName(pi.name));
      if(!p){p={id:'project_'+pi.id,name:pi.name,category:'기타',status:pi.status||'예정',customer:pi.customer||'',driveUrl:'',driveFolderId:'',figmaUrl:'',refLinks:[],requests:[],projectInfoId:pi.id,sourceType:pi.sourceType||'Drive'};d.projects.push(p);changed=true}
      else{if(!p.projectInfoId){p.projectInfoId=pi.id;changed=true}if(!p.customer&&pi.customer){p.customer=pi.customer;changed=true}}
    });
    d.opportunities.forEach(o=>{
      if(!o.lifecycleStatus){o.lifecycleStatus=o.convertedProjectId?'프로젝트 전환':'진행 전';changed=true}
      if(!o.stage){o.stage=o.convertedProjectId?'프로젝트 전환':'발견';changed=true}
      if(!o.reviewStatus){o.reviewStatus=o.convertedProjectId?'프로젝트 전환':'검토 필요';changed=true}
      if(!o.sourceType){o.sourceType='직접 입력';changed=true}
      o.activityIds=o.activityIds||[];
    });
    if(changed&&typeof save==='function')save();
  }

  function projectInfoFor(p){const d=getDb();return (d?.projectInfo||[]).find(x=>x.id===p.projectInfoId)||(d?.projectInfo||[]).find(x=>normalizeName(x.name)===normalizeName(p.name))||null}
  function projectFacts(p){const d=getDb(),pi=projectInfoFor(p);if(!d||!pi)return {features:[],devices:[],sources:[]};return {features:d.features.filter(x=>x.projectInfoId===pi.id),devices:d.devices.filter(x=>x.projectInfoId===pi.id),sources:d.sources.filter(x=>x.projectInfoId===pi.id)}}

  function installProjectLayout(){
    const projects=q('projects');if(!projects)return;
    q('projectInfoIntegrated')?.remove();
    if(!q('unifiedProjectMetrics')){const panel=q('projectList')?.closest('.panel');if(panel){const metrics=document.createElement('div');metrics.id='unifiedProjectMetrics';metrics.className='metrics';panel.parentElement.insertBefore(metrics,panel)}}
    const desc=projects.querySelector('.head .muted');if(desc)desc.textContent='프로젝트 하나에서 기본 정보·Drive·Feature·Device·업무·AI 실행 결과까지 함께 관리합니다.';
  }

  function renderUnifiedProjects(){
    const d=getDb();if(!d)return;ensureData();installProjectLayout();
    const filter=typeof activeCat!=='undefined'?activeCat:'전체',categories=typeof cats!=='undefined'?cats:['전체','행사·마케팅','제품·UIUX','문서·운영','기타'];
    if(q('catTabs')){q('catTabs').innerHTML=categories.map(c=>`<button data-cat="${safe(c)}" class="${c===filter?'active':''}">${safe(c)}</button>`).join('');q('catTabs').querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCat=b.dataset.cat;renderUnifiedProjects()})}
    const list=d.projects||[],filtered=list.filter(p=>filter==='전체'||p.category===filter),active=list.filter(p=>!['완료','완료됨','폐기됨'].includes(p.status)).length;
    if(q('unifiedProjectMetrics'))q('unifiedProjectMetrics').innerHTML=`<div class="metric"><b>${list.length}</b><span class="muted">전체 프로젝트</span></div><div class="metric"><b>${active}</b><span class="muted">진행·검토 중</span></div><div class="metric"><b>${list.filter(p=>p.driveFolderId).length}</b><span class="muted">Drive 연결</span></div><div class="metric"><b>${d.facts.filter(f=>f.approvalStatus==='후보').length}</b><span class="muted">검토 대기 Fact</span></div>`;
    if(q('projectList'))q('projectList').innerHTML=`<table class="table"><thead><tr><th>프로젝트</th><th>고객 / 연관기업</th><th>분류</th><th>상태</th><th>Drive</th><th>주요 정보</th><th>업무</th></tr></thead><tbody>${filtered.map(p=>{const info=projectInfoFor(p),f=projectFacts(p);return `<tr data-project="${safe(p.id)}"><td><b>${safe(p.name)}</b></td><td>${safe(p.customer||info?.customer||'-')}</td><td>${safe(p.category||'기타')}</td><td>${safe(p.status||'-')}</td><td>${p.driveFolderId?'연결됨':'미연결'}</td><td><span class="tag">Feature ${f.features.length}</span> <span class="tag">Device ${f.devices.length}</span> <span class="tag">Source ${f.sources.length}</span></td><td>${(p.requests||[]).length?`요청 ${(p.requests||[]).length}건`:'상세에서 업무 실행'}</td></tr>`}).join('')}</tbody></table>`;
    q('projectList')?.querySelectorAll('[data-project]').forEach(row=>row.onclick=()=>openProject(row.dataset.project));
  }

  function renderProjectMetadata(){
    const p=typeof current==='function'?current():null;if(!p)return;const info=projectInfoFor(p),f=projectFacts(p);
    let box=q('unifiedProjectMeta');if(!box){box=document.createElement('div');box.id='unifiedProjectMeta';box.className='section';const side=q('projectRelations')?.closest('.section')||q('driveFiles')?.closest('.section');if(side)side.parentElement.insertBefore(box,side)}if(!box)return;
    box.innerHTML=`<h3>프로젝트 정보</h3><div class="muted">영업에서 전환된 정보와 Drive에서 확인된 Feature·Device·Source를 함께 표시합니다.</div><div style="margin-top:12px"><b>고객 / 연관기업</b><div>${safe(p.customer||info?.customer||'-')}</div></div><div style="margin-top:12px"><b>Feature</b><div class="chip-list">${f.features.length?f.features.map(x=>`<span class="tag">${safe(x.name)}</span>`).join(''):'<span class="muted">없음</span>'}</div></div><div style="margin-top:12px"><b>Device / Asset</b><div class="chip-list">${f.devices.length?f.devices.map(x=>`<span class="tag">${safe(x.name)}</span>`).join(''):'<span class="muted">없음</span>'}</div></div><div style="margin-top:12px"><b>Source</b>${f.sources.length?f.sources.map(x=>`<div class="muted">↗ ${safe(x.name)}</div>`).join(''):'<div class="muted">없음</div>'}</div>`;
  }

  let modalSubmit=null;
  function closeSystemModal(){q('opsModal')?.classList.add('hidden');modalSubmit=null}
  function openSystemModal(title,desc,html,onSubmit){q('opsModalTitle').textContent=title;q('opsModalDesc').textContent=desc||'';q('opsModalFields').innerHTML=html;modalSubmit=onSubmit;q('opsModal').classList.remove('hidden');document.querySelectorAll('[data-close-modal]').forEach(el=>el.onclick=closeSystemModal);q('opsModalForm').onsubmit=e=>{e.preventDefault();modalSubmit?.(new FormData(q('opsModalForm')))}}

  function openProjectCreateModal(prefill={}){
    openSystemModal(prefill.originOpportunityId?'프로젝트로 전환':'프로젝트 생성',prefill.originOpportunityId?'PoC 또는 실제 추진 단계로 확정된 영업 건을 프로젝트로 전환합니다. 이후 업무·Drive·AI 실행은 프로젝트 탭에서 관리합니다.':'프로젝트 기본 정보와 연결 자료를 한 번에 입력합니다.',`
      <div class="field"><label>프로젝트명 *</label><input name="name" required value="${safe(prefill.name||'')}"></div>
      <div class="form-row"><div class="field"><label>분류</label><select name="category"><option>행사·마케팅</option><option>제품·UIUX</option><option>문서·운영</option><option ${!prefill.category||prefill.category==='기타'?'selected':''}>기타</option></select></div><div class="field"><label>상태</label><select name="status"><option>요구사항 협의</option><option>예정</option><option>진행 중</option><option>검토 대기</option><option>개발중</option></select></div></div>
      <div class="field"><label>고객 / 연관기업</label><input name="customer" value="${safe(prefill.customer||'')}" placeholder="예: 한화오션 / LG전자"></div>
      <div class="form-row"><div class="field"><label>Drive 폴더 URL</label><input name="driveUrl" placeholder="https://drive.google.com/drive/folders/..."></div><div class="field"><label>Figma URL</label><input name="figmaUrl" placeholder="https://www.figma.com/..."></div></div>
      <div class="field"><label>설명 / 인수 정보</label><textarea name="description" placeholder="영업 단계에서 확인된 요구사항, PoC 범위, 다음 업무 등">${safe(prefill.description||'')}</textarea></div>
    `,fd=>{const d=getDb(),driveUrl=String(fd.get('driveUrl')||'');const p={id:'p'+now(),name:fd.get('name'),category:fd.get('category'),status:fd.get('status'),customer:fd.get('customer')||'',driveUrl,driveFolderId:typeof folderId==='function'?folderId(driveUrl):'',figmaUrl:fd.get('figmaUrl')||'',description:fd.get('description')||'',refLinks:[],requests:[],originOpportunityId:prefill.originOpportunityId||null};d.projects.unshift(p);if(prefill.originOpportunityId){const o=d.opportunities.find(x=>x.id===prefill.originOpportunityId);if(o){o.convertedProjectId=p.id;o.lifecycleStatus='프로젝트 전환';o.stage='프로젝트 전환';o.reviewStatus='프로젝트 전환';o.convertedAt=now()}}if(typeof save==='function')save();closeSystemModal();renderUnifiedProjects();openProject(p.id)});
  }

  function companyName(c){return c?.endCustomer||c?.companyName||c?.partner||'-'}
  function companyOptions(selected=''){const d=getDb();return `<option value="">기업 미지정</option>${d.companies.map(c=>`<option value="${safe(c.id)}" ${c.id===selected?'selected':''}>${safe(companyName(c))}</option>`).join('')}`}
  function sourceLabel(o){return o.sourceType||o.source||'직접 입력'}
  function activitiesFor(o){const d=getDb();const local=d.salesActivities.filter(a=>a.opportunityId===o.id),gmail=d.interactions.filter(i=>i.opportunityId===o.id||(o.companyId&&i.companyId===o.companyId));return [...local,...gmail.map(i=>({id:i.id,type:i.type||'Gmail',title:i.subject||'Gmail 접점',date:i.date||i.createdAt,detail:i.snippet||i.status||'',url:i.url||'',source:'Gmail'}))].sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))}

  function inferStage(o){
    const acts=activitiesFor(o),txt=acts.map(a=>`${a.type||''} ${a.title||''} ${a.detail||''}`).join(' ').toLowerCase();
    if(/poc/.test(txt))return 'PoC 협의';if(/mou/.test(txt))return 'MOU 검토';if(/견적|quotation|quote/.test(txt))return '견적 협의';if(/방문|visit/.test(txt))return '방문 일정';if(/미팅|회의|meeting/.test(txt))return '미팅';if(/제안|proposal/.test(txt))return '제안서 전달';if(/회신|reply|re:/.test(txt))return '회신 확인';if(/gmail|메일|mail/.test(txt))return '1차 연락';return o.stage||'발견';
  }

  function openCandidateModal(){
    openSystemModal('영업 후보 직접 추가','자동 수집되지 않은 문의·소개·현장 접점만 보완합니다. 실제 추진 확정 전에는 프로젝트를 만들지 않습니다.',`<div class="field"><label>후보 제목 *</label><input name="title" required placeholder="예: 조선소 사족보행 로봇 PoC 문의"></div><div class="form-row"><div class="field"><label>관련 기업</label><select name="companyId">${companyOptions()}</select></div><div class="field"><label>출처</label><select name="sourceType"><option>직접 입력</option><option>Gmail</option><option>Google Drive</option><option>Google Chat</option><option>공공 공고</option><option>기업 뉴스</option></select></div></div><div class="field"><label>확인된 내용</label><textarea name="summary"></textarea></div><div class="form-row"><div class="field"><label>제안 후보 상품</label><input name="product" placeholder="CoBiz + Spider Runtime"></div><div class="field"><label>근거 링크</label><input name="sourceUrl" type="url"></div></div>`,fd=>{const d=getDb();d.opportunities.unshift({id:'opp_'+now(),companyId:fd.get('companyId')||null,title:fd.get('title'),summary:fd.get('summary')||'',products:fd.get('product')?[fd.get('product')]:[],sourceType:fd.get('sourceType')||'직접 입력',sourceUrl:fd.get('sourceUrl')||'',lifecycleStatus:'진행 전',stage:'발견',reviewStatus:'검토 필요',createdAt:now(),activityIds:[]});if(typeof save==='function')save();closeSystemModal();renderSalesPipeline()})
  }

  function openSourceSettings(){const d=getDb(),c=d.salesDiscoveryConfig;openSystemModal('영업처 자동 발견 설정','공개 소스와 내부 Google 도구에서 후보를 주기적으로 발견하기 위한 기준입니다. 브라우저가 닫혀도 도는 실제 스케줄러/크롤러는 별도 백엔드 연결이 필요합니다.',`<div class="field"><label>수집 주기</label><select name="cadence"><option value="daily" ${c.cadence==='daily'?'selected':''}>매일</option><option value="weekdays" ${c.cadence==='weekdays'?'selected':''}>평일</option><option value="weekly" ${c.cadence==='weekly'?'selected':''}>주 1회</option></select></div><div class="field"><label>수집 소스</label><div style="display:grid;gap:10px;margin-top:8px"><label><input type="checkbox" name="publicBid" ${c.publicBid?'checked':''}> 공공 공고·R&D·입찰</label><label><input type="checkbox" name="companyNews" ${c.companyNews?'checked':''}> 기업 뉴스·보도자료</label><label><input type="checkbox" name="gmail" ${c.gmail?'checked':''}> Gmail 발신·수신</label><label><input type="checkbox" name="drive" ${c.drive?'checked':''}> Drive 신규 문서</label><label><input type="checkbox" name="chat" ${c.chat?'checked':''}> Google Chat</label></div></div><div class="notice">후보에는 원문 전체가 아니라 기업, 핵심 내용, 출처, 추천 상품, 진행 상태만 남기도록 설계합니다.</div>`,fd=>{d.salesDiscoveryConfig={cadence:fd.get('cadence'),publicBid:fd.has('publicBid'),companyNews:fd.has('companyNews'),gmail:fd.has('gmail'),drive:fd.has('drive'),chat:fd.has('chat')};save();closeSystemModal()})}

  function importGmailTouches(){
    const d=getDb();let created=0;
    d.interactions.filter(i=>/mail|gmail|메일/i.test(`${i.type||''} ${i.sourceType||''}`)).forEach(i=>{
      if(d.opportunities.some(o=>o.gmailInteractionId===i.id))return;
      let company=d.companies.find(c=>c.id===i.companyId);
      if(!company&&i.email){const contact=d.contacts.find(c=>c.email===i.email);company=contact?d.companies.find(c=>c.id===contact.companyId):null}
      const o={id:'opp_'+now()+'_'+created,companyId:company?.id||null,title:i.subject||`Gmail 접점 ${i.email||''}`.trim(),summary:i.snippet||i.status||'Gmail 발신/수신 기록에서 발견',products:[],sourceType:'Gmail',sourceUrl:i.url||'',lifecycleStatus:'진행 중',stage:/reply|회신|re:/i.test(i.subject||'')?'회신 확인':'1차 연락',reviewStatus:'검토 필요',gmailInteractionId:i.id,createdAt:now(),activityIds:[]};d.opportunities.unshift(o);i.opportunityId=o.id;created++;
    });
    save();renderSalesPipeline();alert(created?`Gmail 접점 ${created}건을 영업 후보로 가져왔습니다.`:'새로 가져올 Gmail 접점이 없습니다.')
  }

  function discoverFromExistingSources(){
    const d=getDb();let created=0;
    (d.actionItems||[]).filter(a=>/영업|문의|제안|공고|입찰/i.test(`${a.type||''} ${a.title||''} ${a.detail||''}`)).forEach(a=>{if(d.opportunities.some(o=>o.sourceActionId===a.id))return;d.opportunities.unshift({id:'opp_'+now()+'_'+created,title:a.title,summary:a.detail||'',sourceType:a.source||'자동 수집',sourceUrl:a.sourceUrl||'',lifecycleStatus:'진행 전',stage:'발견',reviewStatus:'검토 필요',sourceActionId:a.id,createdAt:now(),activityIds:[]});created++});
    save();renderSalesPipeline();alert(created?`기존 자동화/소스에서 영업 후보 ${created}건을 발견했습니다.`:'현재 연결된 소스에서 새 영업 후보가 없습니다.')
  }

  function addActivity(id){
    const d=getDb(),o=d.opportunities.find(x=>x.id===id);if(!o)return;
    openSystemModal('영업 활동 추가','회의, 방문, MOU, PoC, 메모, 자료 링크를 한 타임라인에서 관리합니다.',`<div class="form-row"><div class="field"><label>활동 유형</label><select name="type"><option>회의</option><option>방문</option><option>MOU</option><option>PoC</option><option>전화</option><option>메모</option><option>자료/이미지 링크</option></select></div><div class="field"><label>일자</label><input name="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div><div class="field"><label>제목 *</label><input name="title" required></div><div class="field"><label>내용</label><textarea name="detail"></textarea></div><div class="field"><label>자료 / 이미지 링크</label><input name="url" type="url" placeholder="Drive, Docs, 이미지, 회의록 링크"></div>`,fd=>{d.salesActivities.unshift({id:'sa_'+now(),opportunityId:o.id,type:fd.get('type'),date:fd.get('date'),title:fd.get('title'),detail:fd.get('detail')||'',url:fd.get('url')||'',createdAt:now()});save();closeSystemModal();openCandidateDetail(id)})
  }

  function composeGmail(id){
    const d=getDb(),o=d.opportunities.find(x=>x.id===id);if(!o)return;const company=d.companies.find(c=>c.id===o.companyId),contact=d.contacts.find(c=>c.companyId===company?.id);
    openSystemModal('Gmail 작성','현재 영업 후보와 Contact를 기준으로 Gmail 작성 화면을 엽니다. 전송 후 Gmail 동기화 시 해당 접점이 다시 타임라인에 반영되도록 연결할 수 있습니다.',`<div class="field"><label>받는 사람 *</label><input name="to" type="email" required value="${safe(contact?.email||'')}"></div><div class="field"><label>제목 *</label><input name="subject" required value="${safe(`[TeamGRIT] ${o.title||''}`)}"></div><div class="field"><label>내용</label><textarea name="body" rows="8">${safe(`안녕하세요. TeamGRIT입니다.\n\n${o.summary||''}\n\n관련하여 논의 가능하신 일정이 있으실지 확인 부탁드립니다.`)}</textarea></div>`,fd=>{const to=fd.get('to'),subject=fd.get('subject'),body=fd.get('body');d.salesActivities.unshift({id:'sa_'+now(),opportunityId:o.id,type:'Gmail 작성',date:new Date().toISOString().slice(0,10),title:subject,detail:`수신: ${to}`,createdAt:now()});o.lifecycleStatus='진행 중';if(o.stage==='발견')o.stage='1차 연락';save();const url=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;closeSystemModal();window.open(url,'_blank');renderSalesPipeline()})
  }

  function openCandidateDetail(id){
    const d=getDb(),o=d.opportunities.find(x=>x.id===id);if(!o)return;const c=d.companies.find(x=>x.id===o.companyId),acts=activitiesFor(o),gmailStage=inferStage(o);
    openSystemModal(o.title||'영업 후보 상세','PoC까지의 영업 진행, Gmail 접점, 회의·MOU·방문·자료를 한 곳에서 관리합니다. 실제 수행 프로젝트로 확정되면 프로젝트 탭으로 전환합니다.',`<div class="form-row"><div class="field"><label>전체 상태</label><select name="lifecycleStatus">${statusOptions.map(x=>`<option ${x===o.lifecycleStatus?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>현재 단계</label><select name="stage">${stageOptions.map(x=>`<option ${x===o.stage?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="notice"><b>Gmail/활동 기준 추정 단계</b><br>${safe(gmailStage)}${gmailStage!==o.stage?' · 현재 선택값과 다름':''}</div><div class="form-row"><div class="field"><label>관련 기업</label><select name="companyId">${companyOptions(o.companyId)}</select></div><div class="field"><label>제안 후보 상품</label><input name="product" value="${safe((o.products||[]).join(', '))}"></div></div><div class="field"><label>확인된 내용</label><textarea name="summary">${safe(o.summary||'')}</textarea></div><div class="taskActions" style="margin:12px 0"><button class="btn" type="button" id="detailGmail">Gmail 작성</button><button class="btn" type="button" id="detailActivity">회의·방문·MOU·자료 추가</button>${['PoC 진행','프로젝트 전환'].includes(o.stage)||o.lifecycleStatus==='프로젝트 전환'?`<button class="btn primary" type="button" id="detailProject">프로젝트로 전환</button>`:''}</div><div class="field"><label>진행 이력</label><div style="display:grid;gap:8px;margin-top:8px">${acts.length?acts.map(a=>`<div class="file"><div><b>${safe(a.type||'활동')} · ${safe(a.title||'')}</b><div class="muted">${safe(a.date||'')} ${safe(a.detail||'')}</div>${a.url?`<a target="_blank" href="${safe(a.url)}">자료 열기 ↗</a>`:''}</div></div>`).join(''):'<div class="empty">아직 진행 이력이 없습니다.</div>'}</div></div>`,fd=>{o.lifecycleStatus=fd.get('lifecycleStatus');o.stage=fd.get('stage');o.companyId=fd.get('companyId')||null;o.products=fd.get('product')?[fd.get('product')]:[];o.summary=fd.get('summary')||'';save();closeSystemModal();renderSalesPipeline()});
    setTimeout(()=>{if(q('detailGmail'))q('detailGmail').onclick=()=>composeGmail(id);if(q('detailActivity'))q('detailActivity').onclick=()=>addActivity(id);if(q('detailProject'))q('detailProject').onclick=()=>{closeSystemModal();openProjectCreateModal({originOpportunityId:o.id,name:o.title,customer:companyName(c)==='-'?'':companyName(c),description:o.summary||''})}},0)
  }
  window.openCandidateDetail=openCandidateDetail;

  function buildSalesWorkspace(){
    const sales=q('sales');if(!sales)return;ensureData();
    sales.innerHTML=`<div class="head"><div><h1>영업</h1><div class="muted">영업처 발견 → Gmail 접촉 → 미팅·제안·MOU·방문 → PoC까지 관리하고, 실제 프로젝트가 되면 프로젝트 탭으로 전환합니다.</div></div><div class="taskActions top-actions"><button class="btn" id="salesDiscover">영업처 발견</button><button class="btn" id="salesImportGmail">Gmail 접점 가져오기</button><button class="btn" id="salesSourceSettings">자동 수집 설정</button><button class="btn primary" id="salesAddCandidate">후보 직접 추가</button></div></div><div class="metrics" id="salesMetrics"></div><div class="panel"><div class="ph"><b>영업 후보 / 진행 건</b><span class="muted">행을 누르면 Gmail·회의·MOU·방문·PoC 진행 이력을 확인</span></div><div class="pb" id="opportunityList"></div></div><div class="panel"><div class="ph"><b>기업 / 고객 · Contact</b><span class="muted">기존 관계와 중복 접촉 확인용 마스터</span></div><div class="pb" id="companyContactList"></div></div>`;
    q('salesDiscover').onclick=discoverFromExistingSources;q('salesImportGmail').onclick=importGmailTouches;q('salesSourceSettings').onclick=openSourceSettings;q('salesAddCandidate').onclick=openCandidateModal;renderSalesPipeline();
  }

  function renderSalesPipeline(){
    const d=getDb();if(!d||!q('salesMetrics'))return;ensureData();const active=d.opportunities.filter(o=>o.lifecycleStatus!=='드랍'&&o.lifecycleStatus!=='프로젝트 전환'),converted=d.opportunities.filter(o=>o.lifecycleStatus==='프로젝트 전환');
    q('salesMetrics').innerHTML=`<div class="metric"><b>${active.filter(o=>o.lifecycleStatus==='진행 전').length}</b><span class="muted">진행 전</span></div><div class="metric"><b>${active.filter(o=>o.lifecycleStatus==='진행 중').length}</b><span class="muted">진행 중</span></div><div class="metric"><b>${active.filter(o=>o.lifecycleStatus==='보류').length}</b><span class="muted">보류</span></div><div class="metric"><b>${converted.length}</b><span class="muted">프로젝트 전환</span></div>`;
    q('opportunityList').innerHTML=active.length?`<table class="table"><thead><tr><th>영업 건</th><th>기업</th><th>상태</th><th>현재 단계</th><th>Gmail/활동 추정</th><th>최근 접점</th><th>출처</th></tr></thead><tbody>${active.map(o=>{const c=d.companies.find(x=>x.id===o.companyId),acts=activitiesFor(o),last=acts[0];return `<tr data-opp="${safe(o.id)}"><td><b>${safe(o.title||'-')}</b><div class="muted">${safe((o.products||[]).join(', '))}</div></td><td>${safe(companyName(c))}</td><td><span class="tag ${o.lifecycleStatus==='진행 중'?'blue':''}">${safe(o.lifecycleStatus)}</span></td><td>${safe(o.stage)}</td><td>${safe(inferStage(o))}</td><td>${last?`${safe(last.date||'')}<div class="muted">${safe(last.title||last.type||'')}</div>`:'-'}</td><td>${safe(sourceLabel(o))}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">현재 진행 중인 영업 건이 없습니다.</div>';
    q('opportunityList')?.querySelectorAll('[data-opp]').forEach(row=>row.onclick=()=>openCandidateDetail(row.dataset.opp));
    q('companyContactList').innerHTML=d.companies.length?`<table class="table"><thead><tr><th>기업 / 고객</th><th>유형</th><th>산업</th><th>내부 담당</th><th>Contact</th></tr></thead><tbody>${d.companies.map(c=>{const cs=d.contacts.filter(x=>x.companyId===c.id);return `<tr><td><b>${safe(companyName(c))}</b></td><td>${safe(c.customerType||'-')}</td><td>${safe(c.industry||'-')}</td><td>${safe(c.accountOwner||'미지정')}</td><td>${cs.length?cs.map(x=>safe(x.name)).join(', '):'보완 필요'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">등록된 기업이 없습니다.</div>';
  }

  function go(view){hideAll();if(view==='dash'){show('dashboard');q('navDash')?.classList.add('active');if(typeof renderDash==='function')renderDash()}if(view==='projects'){show('projects');q('navProjects')?.classList.add('active');renderUnifiedProjects()}if(view==='sales'){show('sales');q('navSales')?.classList.add('active');buildSalesWorkspace()}if(view==='automation'){show('automationPanel');q('navAutomation')?.classList.add('active')}if(typeof authStatus==='function')authStatus();window.scrollTo(0,0)}

  function bindAutomation(){const btn=q('runAutomation');if(!btn)return;btn.onclick=async()=>{btn.disabled=true;const old=btn.textContent;try{btn.textContent='Drive·Chat 확인 중...';if(typeof window.runOpsAutomation==='function')await window.runOpsAutomation();if(typeof window.syncGoogleChatSources==='function')await window.syncGoogleChatSources()}finally{btn.disabled=false;btn.textContent=old||'자동화 실행'}}}

  function init(){
    ensureData();installProjectLayout();const nk=q('navKnowledge');if(nk)nk.style.display='none';renderProjects=renderUnifiedProjects;
    const baseOpen=typeof openProject==='function'?openProject:null;if(baseOpen){openProject=async id=>{hideAll();await baseOpen(id);show('projectDetail');renderProjectMetadata()}}
    q('newProject').onclick=()=>openProjectCreateModal();
    q('navDash').onclick=()=>go('dash');q('navProjects').onclick=()=>go('projects');q('navSales').onclick=()=>go('sales');q('navAutomation').onclick=()=>go('automation');q('backProjects').onclick=()=>go('projects');bindAutomation();go('dash');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
