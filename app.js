const LS='tg_ops_backend_projects_v1';
let db=JSON.parse(localStorage.getItem(LS)||'{"projects":[]}');
if(!db.projects.length){
  db.projects=[
    {id:'p1',name:'서울 AI 로봇쇼',category:'행사·마케팅',status:'진행 중',driveUrl:'',driveFolderId:'',requests:[],results:[]},
    {id:'p2',name:'CoBiz 소개 페이지 개편',category:'제품·UIUX',status:'진행 중',driveUrl:'',driveFolderId:'',requests:[],results:[]}
  ];
  localStorage.setItem(LS,JSON.stringify(db));
}

let currentId=null;
let activeCat='전체';
let lastAnalysis=null;
let currentView='dash';
const $=s=>document.querySelector(s);
const cats=['전체','행사·마케팅','제품·UIUX','문서·운영','기타'];

function save(){localStorage.setItem(LS,JSON.stringify(db));}
function current(){return db.projects.find(p=>p.id===currentId);}
function folderId(v=''){const m=v.match(/\/folders\/([A-Za-z0-9_-]+)/);return m?m[1]:v.trim();}

async function api(url,opts={}){
  const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);
  return d;
}

function setView(view){
  currentView=view;
  const views={dash:$('#dashboard'),projects:$('#projects'),detail:$('#projectDetail')};
  Object.entries(views).forEach(([key,el])=>el.classList.toggle('hidden',key!==view));
  $('#navDash').classList.toggle('active',view==='dash');
  $('#navProjects').classList.toggle('active',view==='projects'||view==='detail');
}

async function authStatus(){
  const s=await api('/api/auth/status').catch(e=>({connected:false,error:e.message}));
  const html=s.connected
    ? `<span class="tag green">Google 연결됨 · ${s.user?.email||''}</span> <button class="btn" data-action="logout-google">연결 해제</button>`
    : `<a class="btn primary" href="/api/auth/google">Google Drive 연결</a>${s.configured===false?'<div class="muted" style="margin-top:6px">OAuth 환경변수 설정 필요</div>':''}`;
  if($('#authTop'))$('#authTop').innerHTML=html;
  if($('#authBox'))$('#authBox').innerHTML=html;
  document.querySelectorAll('[data-action="logout-google"]').forEach(btn=>btn.onclick=logoutGoogle);
  return s;
}

async function logoutGoogle(){await api('/api/auth/logout',{method:'POST'});location.reload();}

function projectRows(projects){
  return projects.map(p=>`
    <tr data-project="${p.id}">
      <td><b>${p.name}</b><br><span class="muted">${(p.requests||[]).length}개 요청 · ${(p.results||[]).length}개 결과물</span></td>
      <td>${p.category}</td>
      <td><span class="tag ${p.status==='완료'?'green':p.status==='검토 대기'?'amber':'blue'}">${p.status}</span></td>
      <td>${p.driveFolderId?'<span class="tag green">연결됨</span>':'<span class="muted">미연결</span>'}</td>
      <td>${(p.results||[]).length}</td>
      <td><button class="btn" data-open-project="${p.id}">상세 / 업무 실행</button></td>
    </tr>`).join('');
}

function bindProjectOpeners(){
  document.querySelectorAll('[data-open-project]').forEach(btn=>{
    btn.onclick=e=>{e.stopPropagation();openProject(btn.dataset.openProject);};
  });
  document.querySelectorAll('tr[data-project]').forEach(row=>{
    row.onclick=()=>openProject(row.dataset.project);
  });
}

function renderDash(){
  const all=db.projects.flatMap(p=>p.results||[]);
  $('#metrics').innerHTML=`
    <div class="metric"><b>${db.projects.length}</b><span class="muted">전체 프로젝트</span></div>
    <div class="metric"><b>${db.projects.filter(p=>p.status==='진행 중').length}</b><span class="muted">진행 중</span></div>
    <div class="metric"><b>${db.projects.filter(p=>p.driveFolderId).length}</b><span class="muted">Drive 연결</span></div>
    <div class="metric"><b>${all.length}</b><span class="muted">실행 결과물</span></div>`;
  $('#dashProjects').innerHTML=`<table class="table"><thead><tr><th>프로젝트</th><th>대분류</th><th>상태</th><th>Drive</th><th>결과물</th><th></th></tr></thead><tbody>${projectRows(db.projects)}</tbody></table>`;
  bindProjectOpeners();
}

function renderProjects(){
  const ps=db.projects.filter(p=>activeCat==='전체'||p.category===activeCat);
  $('#catTabs').innerHTML=cats.map(c=>`<button data-cat="${c}" class="${c===activeCat?'active':''}">${c}</button>`).join('');
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCat=b.dataset.cat;renderProjects();});
  $('#projectList').innerHTML=`
    <table class="table">
      <thead><tr><th>프로젝트</th><th>대분류</th><th>상태</th><th>Drive</th><th>결과물</th><th></th></tr></thead>
      <tbody>${projectRows(ps)}</tbody>
    </table>`;
  bindProjectOpeners();
}

function renderProjectSummary(){
  const p=current();
  if(!p)return;
  $('#projectSummary').innerHTML=`
    <div class="metric"><b>${p.status}</b><span class="muted">현재 상태</span></div>
    <div class="metric"><b>${p.driveFolderId?'연결됨':'미연결'}</b><span class="muted">Google Drive</span></div>
    <div class="metric"><b>${(p.requests||[]).length}</b><span class="muted">업무 요청</span></div>
    <div class="metric"><b>${(p.results||[]).length}</b><span class="muted">실행 결과물</span></div>`;
  $('#projectStatusText').innerHTML=`<b>${p.status}</b><br><span class="muted">${p.category} · 요청 ${(p.requests||[]).length}건 · 결과물 ${(p.results||[]).length}건</span>`;
}

function resetDetailTransientState(){
  lastAnalysis=null;
  $('#requestText').value='';
  $('#analysis').innerHTML='<div class="empty">요청을 입력하고 Drive를 분석하면 확정 정보·부족한 정보·추천 업무가 표시됩니다.</div>';
  $('#taskList').innerHTML='<div class="empty">아직 제안된 업무가 없습니다.</div>';
  $('#driveState').innerHTML='';
}

async function show(view){
  setView(view);
  if(view==='dash')renderDash();
  if(view==='projects')renderProjects();
  await authStatus();
}

async function openProject(id){
  const p=db.projects.find(x=>x.id===id);
  if(!p)return;
  currentId=id;
  resetDetailTransientState();
  setView('detail');
  $('#pCat').textContent=p.category;
  $('#pName').textContent=p.name;
  $('#pStatus').value=p.status;
  $('#pCategory').value=p.category;
  $('#driveUrl').value=p.driveUrl||'';
  renderProjectSummary();
  renderResults();
  await authStatus();
  if(p.driveFolderId)await loadFiles();
  else $('#driveFiles').innerHTML='<div class="empty">Drive를 연결하면 파일이 표시됩니다.</div>';
}

async function loadFiles(){
  const p=current();
  if(!p?.driveFolderId)return;
  $('#driveFiles').innerHTML='<div class="muted">불러오는 중...</div>';
  try{
    const d=await api('/api/drive/list?folderId='+encodeURIComponent(p.driveFolderId));
    $('#driveFiles').innerHTML=d.files.length?d.files.map(f=>`<div class="file"><b>${f.name}</b><br><span class="muted">${f.mimeType.replace('application/vnd.google-apps.','Google ')}</span>${f.webViewLink?` · <a target="_blank" href="${f.webViewLink}">열기</a>`:''}</div>`).join(''):'<div class="empty">폴더가 비어 있습니다.</div>';
    $('#driveState').innerHTML='<div class="notice ok">Drive 폴더 연결됨 · '+d.files.length+'개 파일</div>';
  }catch(e){
    $('#driveFiles').innerHTML='<div class="notice">'+e.message+'</div>';
  }
}

function renderAnalysis(a){
  if(!a)return;
  const facts=(a.facts||[]).map(f=>`<div class="fact"><span class="tag ${f.status==='확정'?'green':f.status==='질문'?'amber':''}">${f.status}</span><br><b>${f.fact}</b><br><span class="muted">${f.source||''}</span></div>`).join('');
  $('#analysis').innerHTML=`<div class="muted" style="margin-bottom:10px">${a.summary||''}</div><div class="facts">${facts||'<div class="empty">추출된 사실 없음</div>'}</div>${(a.missing||[]).length?`<div class="notice" style="margin-top:10px"><b>추가 확인 필요</b><br>${a.missing.join('<br>')}</div>`:''}`;
  $('#taskList').innerHTML=(a.tasks||[]).length?(a.tasks||[]).map((t,i)=>`<div class="task" data-task-index="${i}"><div class="taskHead"><div><span class="tag blue">${t.outputType}</span><h4>${t.title}</h4></div><span class="tag">제안</span></div><p>${t.reason||''}</p><div class="taskActions"><button class="btn primary" data-execute-task="${i}">승인하고 자동 실행</button><button class="btn" data-skip-task="${i}">제외</button></div></div>`).join(''):'<div class="empty">제안된 업무가 없습니다.</div>';
  document.querySelectorAll('[data-execute-task]').forEach(btn=>btn.onclick=()=>executeTask(Number(btn.dataset.executeTask)));
  document.querySelectorAll('[data-skip-task]').forEach(btn=>btn.onclick=()=>skipTask(Number(btn.dataset.skipTask)));
}

function renderResults(){
  const p=current();
  if(!p)return;
  $('#results').innerHTML=(p.results||[]).length?p.results.map(r=>`<div class="result"><span class="tag green">실행 완료</span><br><b>${r.title}</b><br><span class="muted">${r.type} · ${new Date(r.createdAt).toLocaleString()}</span><br><a target="_blank" href="${r.url}">실제 Drive 파일 열기 →</a></div>`).join(''):'<div class="empty">승인한 업무가 실행되면 실제 Drive 파일 링크가 여기에 표시됩니다.</div>';
}

async function executeTask(i){
  const p=current();
  const t=lastAnalysis?.tasks?.[i];
  if(!p||!t)return;
  if(!confirm(`'${t.title}' 업무를 승인하고 실제 ${t.outputType} 파일을 생성할까요?`))return;
  const el=document.querySelector(`[data-task-index="${i}"]`);
  if(!el)return;
  el.querySelector('.taskActions').innerHTML='<span class="muted">실행 중...</span>';
  try{
    const d=await api('/api/tasks/execute',{method:'POST',body:JSON.stringify({approved:true,task:t,project:{name:p.name,driveFolderId:p.driveFolderId},context:{analysis:lastAnalysis}})});
    p.results=p.results||[];
    p.results.unshift({title:t.title,type:t.outputType,url:d.file.url,createdAt:Date.now()});
    save();
    renderResults();
    renderProjectSummary();
    el.querySelector('.taskActions').innerHTML=`<span class="tag green">완료</span> <a class="btn" target="_blank" href="${d.file.url}">파일 열기</a>`;
    await syncProjectState();
  }catch(e){
    el.querySelector('.taskActions').innerHTML=`<span class="notice">${e.message}</span>`;
  }
}

function skipTask(i){const el=document.querySelector(`[data-task-index="${i}"]`);if(el)el.remove();}

async function syncProjectState(){
  const p=current();
  if(!p?.driveFolderId)return;
  try{
    await api('/api/projects/state',{method:'POST',body:JSON.stringify({folderId:p.driveFolderId,state:p})});
    $('#driveState').innerHTML='<div class="notice ok">프로젝트 상태를 Drive와 동기화했습니다.</div>';
  }catch(e){
    $('#driveState').innerHTML='<div class="notice">상태 동기화 실패: '+e.message+'</div>';
  }
}

$('#saveDrive').onclick=async()=>{
  const p=current();
  if(!p)return;
  const url=$('#driveUrl').value.trim(),id=folderId(url);
  if(!id)return alert('Drive 폴더 URL을 입력해 주세요.');
  p.driveUrl=url;p.driveFolderId=id;save();renderProjectSummary();
  await loadFiles();await syncProjectState();
};
$('#refreshDrive').onclick=loadFiles;
$('#syncState').onclick=syncProjectState;

$('#analyzeDrive').onclick=async()=>{
  const p=current(),req=$('#requestText').value.trim();
  if(!p)return;
  if(!p.driveFolderId)return alert('먼저 프로젝트 Drive 폴더를 연결해 주세요.');
  if(!req)return alert('업무 요청을 입력해 주세요.');
  $('#analysis').innerHTML='<div class="muted">기존 Drive 문서를 읽고 분석하는 중...</div>';
  $('#taskList').innerHTML='<div class="muted">업무를 도출하는 중...</div>';
  try{
    const d=await api('/api/drive/analyze',{method:'POST',body:JSON.stringify({folderId:p.driveFolderId,projectName:p.name,request:req})});
    lastAnalysis=d.analysis;
    p.requests=p.requests||[];
    p.requests.unshift({request:req,createdAt:Date.now(),analysis:d.analysis});
    save();renderAnalysis(d.analysis);renderProjectSummary();
    await loadFiles();await syncProjectState();
  }catch(e){
    $('#analysis').innerHTML='<div class="notice">'+e.message+'</div>';
    $('#taskList').innerHTML='<div class="empty">분석 실패</div>';
  }
};

$('#pStatus').onchange=e=>{
  const p=current();if(!p)return;
  p.status=e.target.value;save();renderProjectSummary();syncProjectState();
};
$('#pCategory').onchange=e=>{
  const p=current();if(!p)return;
  p.category=e.target.value;$('#pCat').textContent=e.target.value;save();renderProjectSummary();syncProjectState();
};

$('#navDash').onclick=()=>show('dash');
$('#navProjects').onclick=()=>show('projects');
$('#backProjects').onclick=()=>show('projects');
$('#newProject').onclick=()=>{
  const name=prompt('프로젝트명');if(!name)return;
  const category=prompt('대분류','기타')||'기타';
  const p={id:'p'+Date.now(),name,category,status:'예정',driveUrl:'',driveFolderId:'',requests:[],results:[]};
  db.projects.unshift(p);save();openProject(p.id);
};

show('dash');
