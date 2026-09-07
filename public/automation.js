(function(){
  const $=s=>document.querySelector(s);
  const now=()=>Date.now();
  const days=n=>n*24*60*60*1000;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  db.automationRuns=db.automationRuns||[];
  db.actionItems=db.actionItems||[];
  db.interactions=db.interactions||[];
  db.sources=db.sources||[];
  save();

  function makeAction(type,title,detail,projectId,priority='보통',source='자동 분석'){
    const key=[type,title,projectId||''].join('|');
    if(db.actionItems.some(x=>x.key===key&&x.status!=='완료')) return null;
    const item={id:`act_${now()}_${Math.random().toString(36).slice(2,7)}`,key,type,title,detail,projectId:projectId||null,priority,status:'검토 필요',source,createdAt:now()};
    db.actionItems.unshift(item);
    return item;
  }

  function detectProjectRisks(){
    db.projects.forEach(p=>{
      if(['진행 중','개발중','검토 대기','요구사항 협의','물품 구매 및 수령'].includes(p.status)&&!p.driveUrl&&!p.driveFolderUrl){
        makeAction('자료 누락',`${p.name} Drive 연결 확인`,`진행 중인 프로젝트인데 기준 Drive 연결이 없습니다. 원본 문서나 폴더를 연결해 주세요.`,p.id,'높음');
      }
      const facts=(db.facts||[]).filter(f=>f.projectId===p.id&&f.approvalStatus==='후보');
      if(facts.length>=3){
        makeAction('정보 검토',`${p.name} 신규 정보 ${facts.length}건 검토`,`Drive 분석에서 신규/변경 Fact가 누적됐습니다. 승인 또는 제외 후 프로젝트 기준 정보를 갱신하세요.`,p.id,'보통');
      }
      if(!(db.sources||[]).some(s=>s.projectId===p.id)){
        makeAction('Source 연결',`${p.name} 기준 Source 지정`,`요구사항·회의록·고객 메일 중 기준 원본을 지정해 이후 변경 비교가 가능하도록 하세요.`,p.id,'보통');
      }
    });
  }

  function detectSalesFollowups(){
    (db.companies||[]).forEach(c=>{
      const ints=(db.interactions||[]).filter(i=>i.companyId===c.id).sort((a,b)=>(b.date||b.createdAt||0)-(a.date||a.createdAt||0));
      const sales=ints.find(i=>i.type==='Sales Interaction');
      const marketing=ints.find(i=>i.type==='Marketing Mailing');
      const last=sales?.date||sales?.createdAt||0;
      if(c.status==='협의중'&&(!last||now()-last>days(14))){
        makeAction('영업 후속',`${c.companyName||c.endCustomer||'고객'} 후속 연락 필요`,sales?`마지막 영업 접촉 후 ${Math.floor((now()-last)/days(1))}일 경과했습니다.`:'협의중 상태지만 실제 영업 접촉 기록이 없습니다.',null,'높음','고객 마스터 + Gmail');
      }
      if(marketing&&!sales){
        makeAction('영업 전환 검토',`${c.companyName||c.endCustomer||'고객'} 메일링 후 영업 전환 검토`,`마케팅 메일 발송 기록은 있으나 실제 영업 Interaction이 없습니다. 관심 여부 확인 또는 담당 영업 지정이 필요합니다.`,null,'보통','Gmail');
      }
    });
  }

  function detectFactChanges(){
    const approved=(db.facts||[]).filter(f=>f.approvalStatus==='승인');
    (db.facts||[]).filter(f=>f.approvalStatus==='후보').forEach(f=>{
      const old=approved.find(a=>a.projectId===f.projectId&&a.subject===f.subject&&a.fact!==f.fact);
      if(old){
        makeAction('변경 감지',`${f.sourceProjectName||'프로젝트'} 정보 변경 후보`,`기존 승인 정보: “${old.fact}” / 신규 Drive 정보: “${f.fact}”`,f.projectId,'높음','Drive 변경 비교');
      }
    });
  }

  function run(trigger='수동 실행'){
    const before=db.actionItems.length;
    detectProjectRisks();
    detectSalesFollowups();
    detectFactChanges();
    const created=db.actionItems.length-before;
    db.automationRuns.unshift({id:`run_${now()}`,trigger,created,at:now(),status:'완료'});
    save();
    renderAutomation();
    renderDashAutomation();
    return created;
  }

  function card(x){
    return `<div class="knowledge-row"><div><div><span class="tag ${x.priority==='높음'?'amber':'blue'}">${safe(x.type)}</span> <span class="tag">${safe(x.priority)}</span></div><b>${safe(x.title)}</b><div>${safe(x.detail)}</div><div class="muted">출처: ${safe(x.source)} · ${new Date(x.createdAt).toLocaleString()}</div></div><div class="taskActions"><button class="btn primary" onclick="approveAction('${x.id}')">업무로 승인</button><button class="btn" onclick="completeAction('${x.id}')">완료 처리</button></div></div>`;
  }

  function renderDashAutomation(){
    if(!$('#automationSummary')) return;
    const open=db.actionItems.filter(x=>x.status!=='완료');
    $('#automationSummary').innerHTML=`<div class="ph"><b>자동화 제안</b><span class="muted">Drive·프로젝트·영업 상태를 기준으로 자동 생성</span></div><div class="pb">${open.length?open.slice(0,5).map(card).join(''):'<div class="empty">현재 자동 제안이 없습니다.</div>'}</div>`;
  }

  function renderAutomation(){
    if(!$('#automationPanel')) return;
    const open=db.actionItems.filter(x=>x.status!=='완료');
    $('#automationMetrics').innerHTML=`<div class="metric"><b>${open.length}</b><span class="muted">확인할 자동화 제안</span></div><div class="metric"><b>${open.filter(x=>x.priority==='높음').length}</b><span class="muted">높은 우선순위</span></div><div class="metric"><b>${db.automationRuns.length}</b><span class="muted">자동화 실행</span></div><div class="metric"><b>${(db.facts||[]).filter(x=>x.approvalStatus==='후보').length}</b><span class="muted">검토 대기 Fact</span></div>`;
    $('#automationList').innerHTML=open.length?open.map(card).join(''):'<div class="empty">자동화 실행 후 필요한 후속 업무가 표시됩니다.</div>';
    $('#automationRuns').innerHTML=db.automationRuns.length?db.automationRuns.slice(0,8).map(r=>`<div class="file"><div><b>${safe(r.trigger)}</b><div class="muted">${new Date(r.at).toLocaleString()}</div></div><span class="tag green">${r.created}건 생성</span></div>`).join(''):'<div class="empty">아직 실행 이력이 없습니다.</div>';
  }

  window.completeAction=id=>{
    const x=db.actionItems.find(a=>a.id===id);if(!x)return;
    x.status='완료';x.completedAt=now();save();renderAutomation();renderDashAutomation();
  };
  window.approveAction=id=>{
    const x=db.actionItems.find(a=>a.id===id);if(!x)return;
    x.status='승인됨';x.approvedAt=now();
    const p=db.projects.find(p=>p.id===x.projectId);
    if(p){p.generatedTasks=p.generatedTasks||[];p.generatedTasks.unshift({id:`task_${now()}`,title:x.title,status:'예정',source:x.source,createdAt:now()});}
    save();renderAutomation();renderDashAutomation();
  };
  window.runOpsAutomation=()=>run('수동 실행');
  window.renderAutomation=renderAutomation;
  window.renderDashAutomation=renderDashAutomation;

  const baseRenderDash=renderDash;
  renderDash=function(){baseRenderDash();renderDashAutomation()};

  if($('#navAutomation')) $('#navAutomation').onclick=()=>{
    ['dashboard','projects','knowledge','sales','projectDetail','automationPanel'].forEach(id=>$('#'+id)?.classList.add('hidden'));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
    $('#automationPanel').classList.remove('hidden');$('#navAutomation').classList.add('active');renderAutomation();authStatus();
  };
  if($('#runAutomation')) $('#runAutomation').onclick=()=>run('수동 실행');
  setTimeout(renderDashAutomation,0);
})();