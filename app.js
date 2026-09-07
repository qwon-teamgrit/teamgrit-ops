const LS='tg_ops_backend_projects_v2';
const LEGACY_LS='tg_ops_backend_projects_v1';
const $=s=>document.querySelector(s);
const cats=['전체','행사·마케팅','제품·UIUX','문서·운영','기타'];
let currentId=null,activeCat='전체',lastAnalysis=null,currentView='dash';

function uid(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}
function migrate(){
  const stored=localStorage.getItem(LS);
  if(stored) return JSON.parse(stored);
  const legacy=JSON.parse(localStorage.getItem(LEGACY_LS)||'{"projects":[]}');
  const projects=(legacy.projects||[]).map(p=>({...p,relatedTechnologyIds:p.relatedTechnologyIds||[],relatedCompanyIds:p.relatedCompanyIds||[]}));
  if(!projects.length){
    projects.push(
      {id:'p1',name:'서울 AI 로봇쇼',category:'행사·마케팅',status:'진행 중',driveUrl:'',driveFolderId:'',requests:[],results:[],relatedTechnologyIds:[],relatedCompanyIds:[]},
      {id:'p2',name:'CoBiz 소개 페이지 개편',category:'제품·UIUX',status:'진행 중',driveUrl:'',driveFolderId:'',requests:[],results:[],relatedTechnologyIds:[],relatedCompanyIds:[]}
    );
  }
  const next={projects,technologies:[],companies:[],contacts:[],facts:[],interactions:[],opportunities:[]};
  localStorage.setItem(LS,JSON.stringify(next));return next;
}
let db=migrate();
function normalizeDb(){['projects','technologies','companies','contacts','facts','interactions','opportunities'].forEach(k=>db[k]=db[k]||[]);db.projects.forEach(p=>{p.relatedTechnologyIds=p.relatedTechnologyIds||[];p.relatedCompanyIds=p.relatedCompanyIds||[];p.requests=p.requests||[];p.results=p.results||[]})}
normalizeDb();
function save(){localStorage.setItem(LS,JSON.stringify(db))}
function current(){return db.projects.find(p=>p.id===currentId)}
function folderId(v=''){const m=v.match(/\/folders\/([A-Za-z0-9_-]+)/);return m?m[1]:v.trim()}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtDate(ts){if(!ts)return '-';try{return new Date(ts).toLocaleString()}catch{return '-'}}
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
async function authStatus(){const s=await api('/api/auth/status').catch(e=>({connected:false,error:e.message}));const html=s.connected?`<span class="tag green">Google 연결됨 · ${esc(s.user?.email||'')}</span> <button class="btn" onclick="logoutGoogle()">연결 해제</button>`:`<a class="btn primary" href="/api/auth/google">Google Drive 연결</a>${s.configured===false?'<div class="muted" style="margin-top:6px">OAuth 환경변수 설정 필요</div>':''}`;if($('#authTop'))$('#authTop').innerHTML=html;if($('#authBox'))$('#authBox').innerHTML=html;return s}
async function logoutGoogle(){await api('/api/auth/logout',{method:'POST'});location.reload()}

function hideAll(){['dashboard','projects','knowledge','sales','projectDetail'].forEach(id=>$('#'+id)?.classList.add('hidden'));document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'))}
function show(view){currentView=view;hideAll();if(view==='dash'){ $('#dashboard').classList.remove('hidden');$('#navDash').classList.add('active');renderDash() }if(view==='projects'){ $('#projects').classList.remove('hidden');$('#navProjects').classList.add('active');renderProjects() }if(view==='knowledge'){ $('#knowledge').classList.remove('hidden');$('#navKnowledge').classList.add('active');renderKnowledge() }if(view==='sales'){ $('#sales').classList.remove('hidden');$('#navSales').classList.add('active');renderSales() }authStatus()}

function renderDash(){
  const pendingFacts=db.facts.filter(f=>f.approvalStatus==='후보');
  const contactRisk=db.companies.filter(c=>db.contacts.filter(x=>x.companyId===c.id).length>0 && !c.accountOwner).length;
  $('#metrics').innerHTML=`<div class="metric"><b>${db.projects.filter(p=>p.status==='진행 중').length}</b><span class="muted">진행 중 프로젝트</span></div><div class="metric"><b>${pendingFacts.length}</b><span class="muted">확인 필요한 Fact</span></div><div class="metric"><b>${db.companies.length}</b><span class="muted">등록 기업</span></div><div class="metric"><b>${contactRisk}</b><span class="muted">담당자 미지정 기업</span></div>`;
  $('#dashProjects').innerHTML=`<table class="table"><thead><tr><th>프로젝트</th><th>대분류</th><th>상태</th><th>Drive</th><th>연결 정보</th></tr></thead><tbody>${db.projects.map(p=>`<tr data-project="${p.id}"><td><b>${esc(p.name)}</b></td><td>${esc(p.category)}</td><td>${esc(p.status)}</td><td>${p.driveFolderId?'연결됨':'미연결'}</td><td>기술 ${p.relatedTechnologyIds.length} · 기업 ${p.relatedCompanyIds.length}</td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-project]').forEach(x=>x.onclick=()=>openProject(x.dataset.project));
  $('#dashFacts').innerHTML=pendingFacts.length?pendingFacts.slice(0,8).map(f=>`<div class="knowledge-row"><div><span class="tag amber">후보</span> <b>${esc(f.subject||'미분류')}</b><div>${esc(f.fact)}</div><div class="muted">${esc(f.sourceProjectName||'')} · ${esc(f.source||'Drive 분석')}</div></div><div class="taskActions"><button class="btn primary" onclick="approveFact('${f.id}')">승인</button><button class="btn" onclick="rejectFact('${f.id}')">제외</button></div></div>`).join(''):'<div class="empty">확인할 신규 Fact가 없습니다.</div>';
}

function renderProjects(){
  const ps=db.projects.filter(p=>activeCat==='전체'||p.category===activeCat);
  $('#catTabs').innerHTML=cats.map(c=>`<button data-cat="${c}" class="${c===activeCat?'active':''}">${c}</button>`).join('');
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCat=b.dataset.cat;renderProjects()});
  $('#projectList').innerHTML=`<table class="table"><thead><tr><th>프로젝트</th><th>대분류</th><th>상태</th><th>Drive</th><th>연결 정보</th></tr></thead><tbody>${ps.map(p=>`<tr data-project="${p.id}"><td><b>${esc(p.name)}</b></td><td>${esc(p.category)}</td><td>${esc(p.status)}</td><td>${p.driveFolderId?'연결됨':'미연결'}</td><td>기술 ${p.relatedTechnologyIds.length} · 기업 ${p.relatedCompanyIds.length}</td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-project]').forEach(x=>x.onclick=()=>openProject(x.dataset.project));
}

function renderKnowledge(){
  const approved=db.facts.filter(f=>f.approvalStatus==='승인').length,pending=db.facts.filter(f=>f.approvalStatus==='후보').length;
  $('#knowledgeMetrics').innerHTML=`<div class="metric"><b>${db.technologies.length}</b><span class="muted">기술·제품</span></div><div class="metric"><b>${approved}</b><span class="muted">승인 Fact</span></div><div class="metric"><b>${pending}</b><span class="muted">검토 대기 Fact</span></div><div class="metric"><b>${db.projects.filter(p=>p.relatedTechnologyIds.length).length}</b><span class="muted">기술 연결 프로젝트</span></div>`;
  $('#technologyList').innerHTML=db.technologies.length?`<table class="table"><thead><tr><th>기술·제품</th><th>분류</th><th>현재 기능</th><th>제약 사항</th><th>연결 프로젝트</th></tr></thead><tbody>${db.technologies.map(t=>`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.category||'-')}</td><td>${esc(t.capabilities||'-')}</td><td>${esc(t.limitations||'-')}</td><td>${db.projects.filter(p=>p.relatedTechnologyIds.includes(t.id)).length}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">아직 등록된 기술·제품이 없습니다. 먼저 실제 업무에서 반복적으로 참조하는 기술부터 등록하세요.</div>';
  const facts=[...db.facts].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $('#factList').innerHTML=facts.length?facts.map(f=>`<div class="knowledge-row"><div><span class="tag ${f.approvalStatus==='승인'?'green':f.approvalStatus==='제외'?'':'amber'}">${esc(f.approvalStatus)}</span> <b>${esc(f.subject||'미분류')}</b><div>${esc(f.fact)}</div><div class="muted">출처: ${esc(f.sourceProjectName||'')} ${f.source?'· '+esc(f.source):''} · ${fmtDate(f.createdAt)}</div></div>${f.approvalStatus==='후보'?`<div class="taskActions"><button class="btn primary" onclick="approveFact('${f.id}')">승인</button><button class="btn" onclick="rejectFact('${f.id}')">제외</button></div>`:''}</div>`).join(''):'<div class="empty">Drive 분석을 실행하면 추출된 사실이 후보 Fact로 이곳에 쌓입니다.</div>';
}

function renderSales(){
  const unowned=db.companies.filter(c=>!c.accountOwner).length;
  $('#salesMetrics').innerHTML=`<div class="metric"><b>${db.companies.length}</b><span class="muted">기업</span></div><div class="metric"><b>${db.contacts.length}</b><span class="muted">Contact</span></div><div class="metric"><b>${unowned}</b><span class="muted">내부 담당자 미지정</span></div><div class="metric"><b>${db.opportunities.length}</b><span class="muted">Opportunity</span></div>`;
  $('#companyList').innerHTML=db.companies.length?`<table class="table"><thead><tr><th>기업</th><th>산업</th><th>내부 담당자</th><th>Contact</th><th>연결 프로젝트</th><th>최근 접촉</th></tr></thead><tbody>${db.companies.map(c=>{const contacts=db.contacts.filter(x=>x.companyId===c.id);const its=db.interactions.filter(x=>x.companyId===c.id).sort((a,b)=>(b.date||0)-(a.date||0));return `<tr><td><b>${esc(c.companyName)}</b><div class="muted">${esc(c.status||'관리 중')}</div></td><td>${esc(c.industry||'-')}</td><td>${c.accountOwner?esc(c.accountOwner):'<span class="tag amber">미지정</span>'}</td><td>${contacts.length?contacts.map(x=>esc(x.name)).join(', '):'-'}</td><td>${db.projects.filter(p=>p.relatedCompanyIds.includes(c.id)).length}</td><td>${its[0]?fmtDate(its[0].date):'-'}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty">아직 등록된 기업이 없습니다. 영업 또는 파트너 접점이 있는 기업을 Account 단위로 등록하세요.</div>';
}

function detectSubject(text=''){
  const lower=text.toLowerCase();
  const tech=db.technologies.find(t=>lower.includes((t.name||'').toLowerCase()));if(tech)return tech.name;
  const company=db.companies.find(c=>lower.includes((c.companyName||'').toLowerCase()));if(company)return company.companyName;
  return '프로젝트 정보';
}
function persistAnalysisFacts(a,p){
  (a?.facts||[]).forEach(f=>{
    const fact=String(f.fact||'').trim();if(!fact)return;
    const duplicate=db.facts.some(x=>x.projectId===p.id&&x.fact===fact&&x.approvalStatus!=='제외');if(duplicate)return;
    db.facts.unshift({id:uid('fact'),subject:detectSubject(fact),fact,status:f.status||'추출',source:f.source||'',projectId:p.id,sourceProjectName:p.name,createdAt:Date.now(),approvalStatus:'후보'});
  });save();
}
function approveFact(id){const f=db.facts.find(x=>x.id===id);if(!f)return;f.approvalStatus='승인';f.approvedAt=Date.now();save();currentView==='knowledge'?renderKnowledge():renderDash()}
function rejectFact(id){const f=db.facts.find(x=>x.id===id);if(!f)return;f.approvalStatus='제외';save();currentView==='knowledge'?renderKnowledge():renderDash()}

function renderProjectRelations(){
  const p=current();if(!p||!$('#projectRelations'))return;
  const techs=p.relatedTechnologyIds.map(id=>db.technologies.find(t=>t.id===id)).filter(Boolean);
  const companies=p.relatedCompanyIds.map(id=>db.companies.find(c=>c.id===id)).filter(Boolean);
  $('#projectRelations').innerHTML=`<div class="relation-block"><label>기술·제품</label><div class="chip-list">${techs.length?techs.map(t=>`<span class="tag blue">${esc(t.name)} <button onclick="unlinkTechnology('${t.id}')">×</button></span>`).join(''):'<span class="muted">연결 없음</span>'}</div>${db.technologies.length?`<div class="inline-control"><select id="relationTechnology"><option value="">기술 선택</option>${db.technologies.filter(t=>!p.relatedTechnologyIds.includes(t.id)).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select><button class="btn" onclick="linkTechnology()">연결</button></div>`:'<div class="muted">지식 메뉴에서 기술·제품을 먼저 등록하세요.</div>'}</div><div class="relation-block"><label>기업</label><div class="chip-list">${companies.length?companies.map(c=>`<span class="tag">${esc(c.companyName)} <button onclick="unlinkCompany('${c.id}')">×</button></span>`).join(''):'<span class="muted">연결 없음</span>'}</div>${db.companies.length?`<div class="inline-control"><select id="relationCompany"><option value="">기업 선택</option>${db.companies.filter(c=>!p.relatedCompanyIds.includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.companyName)}</option>`).join('')}</select><button class="btn" onclick="linkCompany()">연결</button></div>`:'<div class="muted">영업 메뉴에서 기업을 먼저 등록하세요.</div>'}</div>`;
}
function linkTechnology(){const id=$('#relationTechnology')?.value,p=current();if(id&&!p.relatedTechnologyIds.includes(id)){p.relatedTechnologyIds.push(id);save();renderProjectRelations()}}
function unlinkTechnology(id){const p=current();p.relatedTechnologyIds=p.relatedTechnologyIds.filter(x=>x!==id);save();renderProjectRelations()}
function linkCompany(){const id=$('#relationCompany')?.value,p=current();if(id&&!p.relatedCompanyIds.includes(id)){p.relatedCompanyIds.push(id);save();renderProjectRelations()}}
function unlinkCompany(id){const p=current();p.relatedCompanyIds=p.relatedCompanyIds.filter(x=>x!==id);save();renderProjectRelations()}

async function openProject(id){currentId=id;lastAnalysis=null;const p=current();hideAll();$('#projectDetail').classList.remove('hidden');$('#navProjects').classList.add('active');$('#pCat').textContent=p.category;$('#pName').textContent=p.name;$('#pStatus').value=p.status;$('#pCategory').value=p.category;$('#driveUrl').value=p.driveUrl||'';renderProjectRelations();renderResults();await authStatus();if(p.driveFolderId)loadFiles()}
async function loadFiles(){const p=current();if(!p.driveFolderId)return;$('#driveFiles').innerHTML='<div class="muted">불러오는 중...</div>';try{const d=await api('/api/drive/list?folderId='+encodeURIComponent(p.driveFolderId));$('#driveFiles').innerHTML=d.files.length?d.files.map(f=>`<div class="file"><b>${esc(f.name)}</b><br><span class="muted">${esc(f.mimeType.replace('application/vnd.google-apps.','Google '))}</span>${f.webViewLink?` · <a target="_blank" href="${f.webViewLink}">열기</a>`:''}</div>`).join(''):'<div class="empty">폴더가 비어 있습니다.</div>';$('#driveState').innerHTML='<div class="notice ok">Drive 폴더 연결됨 · '+d.files.length+'개 파일</div>'}catch(e){$('#driveFiles').innerHTML='<div class="notice">'+esc(e.message)+'</div>'}}
function renderAnalysis(a){if(!a)return;const facts=(a.facts||[]).map(f=>`<div class="fact"><span class="tag ${f.status==='확정'?'green':f.status==='질문'?'amber':''}">${esc(f.status)}</span><br><b>${esc(f.fact)}</b><br><span class="muted">${esc(f.source||'')}</span></div>`).join('');$('#analysis').innerHTML=`<div class="muted" style="margin-bottom:10px">${esc(a.summary||'')}</div><div class="facts">${facts||'<div class="empty">추출된 사실 없음</div>'}</div>${(a.missing||[]).length?`<div class="notice" style="margin-top:10px"><b>추가 확인 필요</b><br>${a.missing.map(esc).join('<br>')}</div>`:''}<div class="notice ok" style="margin-top:10px">분석에서 추출된 사실은 지식 메뉴에 ‘후보 Fact’로 저장되며 승인 전까지 공식 정보로 취급하지 않습니다.</div>`;$('#taskList').innerHTML=(a.tasks||[]).length?(a.tasks||[]).map((t,i)=>`<div class="task" data-task-index="${i}"><div class="taskHead"><div><span class="tag blue">${esc(t.outputType)}</span><h4>${esc(t.title)}</h4></div><span class="tag">제안</span></div><p>${esc(t.reason||'')}</p><div class="taskActions"><button class="btn primary" onclick="executeTask(${i})">승인하고 자동 실행</button><button class="btn" onclick="skipTask(${i})">제외</button></div></div>`).join(''):'<div class="empty">제안된 업무가 없습니다.</div>'}
function renderResults(){const p=current();$('#results').innerHTML=(p.results||[]).length?p.results.map(r=>`<div class="result"><span class="tag green">실행 완료</span><br><b>${esc(r.title)}</b><br><span class="muted">${esc(r.type)} · ${fmtDate(r.createdAt)}</span><br><a target="_blank" href="${r.url}">실제 Drive 파일 열기 →</a></div>`).join(''):'<div class="empty">승인한 업무가 실행되면 실제 Drive 파일 링크가 여기에 표시됩니다.</div>'}
async function executeTask(i){const p=current(),t=lastAnalysis.tasks[i];if(!confirm(`'${t.title}' 업무를 승인하고 실제 ${t.outputType} 파일을 생성할까요?`))return;const el=document.querySelector(`[data-task-index="${i}"]`);el.querySelector('.taskActions').innerHTML='<span class="muted">실행 중...</span>';try{const d=await api('/api/tasks/execute',{method:'POST',body:JSON.stringify({approved:true,task:t,project:{name:p.name,driveFolderId:p.driveFolderId},context:{analysis:lastAnalysis}})});p.results=p.results||[];p.results.unshift({title:t.title,type:t.outputType,url:d.file.url,createdAt:Date.now()});save();renderResults();el.querySelector('.taskActions').innerHTML=`<span class="tag green">완료</span> <a class="btn" target="_blank" href="${d.file.url}">파일 열기</a>`;syncProjectState()}catch(e){el.querySelector('.taskActions').innerHTML=`<span class="notice">${esc(e.message)}</span>`}}
function skipTask(i){document.querySelector(`[data-task-index="${i}"]`)?.remove()}
async function syncProjectState(){const p=current();if(!p.driveFolderId)return;try{await api('/api/projects/state',{method:'POST',body:JSON.stringify({folderId:p.driveFolderId,state:p})});$('#driveState').innerHTML='<div class="notice ok">프로젝트 상태를 Drive와 동기화했습니다.</div>'}catch(e){$('#driveState').innerHTML='<div class="notice">상태 동기화 실패: '+esc(e.message)+'</div>'}}

$('#saveDrive').onclick=async()=>{const p=current(),url=$('#driveUrl').value.trim(),id=folderId(url);if(!id)return alert('Drive 폴더 URL을 입력해 주세요.');p.driveUrl=url;p.driveFolderId=id;save();await loadFiles();await syncProjectState()};
$('#refreshDrive').onclick=loadFiles;$('#syncState').onclick=syncProjectState;
$('#analyzeDrive').onclick=async()=>{const p=current(),req=$('#requestText').value.trim();if(!p.driveFolderId)return alert('먼저 프로젝트 Drive 폴더를 연결해 주세요.');if(!req)return alert('업무 요청을 입력해 주세요.');$('#analysis').innerHTML='<div class="muted">기존 Drive 문서를 읽고 분석하는 중...</div>';$('#taskList').innerHTML='<div class="muted">업무를 도출하는 중...</div>';try{const d=await api('/api/drive/analyze',{method:'POST',body:JSON.stringify({folderId:p.driveFolderId,projectName:p.name,request:req})});lastAnalysis=d.analysis;p.requests.unshift({request:req,createdAt:Date.now(),analysis:d.analysis});persistAnalysisFacts(d.analysis,p);save();renderAnalysis(d.analysis);await loadFiles();await syncProjectState()}catch(e){$('#analysis').innerHTML='<div class="notice">'+esc(e.message)+'</div>';$('#taskList').innerHTML='<div class="empty">분석 실패</div>'}};
$('#pStatus').onchange=e=>{current().status=e.target.value;save();syncProjectState()};
$('#pCategory').onchange=e=>{current().category=e.target.value;$('#pCat').textContent=e.target.value;save();syncProjectState()};
$('#navDash').onclick=()=>show('dash');$('#navProjects').onclick=()=>show('projects');$('#navKnowledge').onclick=()=>show('knowledge');$('#navSales').onclick=()=>show('sales');$('#backProjects').onclick=()=>show('projects');
$('#newProject').onclick=()=>{const name=prompt('프로젝트명');if(!name)return;const category=prompt('대분류','기타')||'기타';const p={id:uid('project'),name,category,status:'예정',driveUrl:'',driveFolderId:'',requests:[],results:[],relatedTechnologyIds:[],relatedCompanyIds:[]};db.projects.unshift(p);save();renderProjects();openProject(p.id)};
$('#newTechnology').onclick=()=>{const name=prompt('기술·제품명');if(!name)return;if(db.technologies.some(t=>t.name.trim().toLowerCase()===name.trim().toLowerCase()))return alert('이미 등록된 기술·제품입니다.');const category=prompt('분류 (예: 로봇, 통신, 플랫폼)','')||'';const capabilities=prompt('현재 가능한 기능을 간단히 입력하세요.','')||'';const limitations=prompt('현재 제약 사항이 있으면 입력하세요.','')||'';db.technologies.unshift({id:uid('tech'),name:name.trim(),category,capabilities,limitations,createdAt:Date.now(),updatedAt:Date.now()});save();renderKnowledge()};
$('#newCompany').onclick=()=>{const companyName=prompt('기업명');if(!companyName)return;if(db.companies.some(c=>c.companyName.trim().toLowerCase()===companyName.trim().toLowerCase()))return alert('이미 등록된 기업입니다. 기존 Account에 Contact를 추가하세요.');const industry=prompt('산업/분야','')||'';const accountOwner=prompt('TeamGRIT 내부 담당자 (미정이면 비워두세요)','')||'';db.companies.unshift({id:uid('company'),companyName:companyName.trim(),industry,accountOwner,status:'관리 중',createdAt:Date.now()});save();renderSales()};
$('#newContact').onclick=()=>{if(!db.companies.length)return alert('먼저 기업을 등록해 주세요.');const options=db.companies.map((c,i)=>`${i+1}. ${c.companyName}`).join('\n');const idx=Number(prompt(`Contact를 연결할 기업 번호를 입력하세요.\n${options}`));const company=db.companies[idx-1];if(!company)return alert('올바른 기업 번호를 입력해 주세요.');const name=prompt('Contact 이름');if(!name)return;const department=prompt('부서','')||'';const role=prompt('직책/역할','')||'';const email=prompt('이메일','')||'';db.contacts.unshift({id:uid('contact'),companyId:company.id,name:name.trim(),department,role,email,createdAt:Date.now()});save();renderSales()};

show('dash');
window.logoutGoogle=logoutGoogle;window.executeTask=executeTask;window.skipTask=skipTask;window.approveFact=approveFact;window.rejectFact=rejectFact;window.linkTechnology=linkTechnology;window.unlinkTechnology=unlinkTechnology;window.linkCompany=linkCompany;window.unlinkCompany=unlinkCompany;
