(function(){
  const $=s=>document.querySelector(s);
  const now=()=>Date.now();
  const days=n=>n*24*60*60*1000;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toMs=v=>{if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(v);return Number.isFinite(n)?n:0};

  db.automationRuns=db.automationRuns||[];
  db.actionItems=db.actionItems||[];
  db.interactions=db.interactions||[];
  db.sources=db.sources||[];
  db.driveSnapshots=db.driveSnapshots||{};
  db.driveSyncLog=db.driveSyncLog||[];
  save();

  function makeAction(type,title,detail,projectId,priority='보통',source='자동 분석',sourceUrl=''){
    const key=[type,title,projectId||'',sourceUrl||''].join('|');
    if(db.actionItems.some(x=>x.key===key&&x.status!=='완료')) return null;
    const item={id:`act_${now()}_${Math.random().toString(36).slice(2,7)}`,key,type,title,detail,projectId:projectId||null,priority,status:'검토 필요',source,sourceUrl,createdAt:now()};
    db.actionItems.unshift(item);
    return item;
  }

  function detectProjectRisks(){
    db.projects.forEach(p=>{
      const connected=!!(p.driveFolderId||p.driveUrl||p.driveFolderUrl);
      if(['진행 중','개발중','검토 대기','요구사항 협의','물품 구매 및 수령'].includes(p.status)&&!connected){
        makeAction('자료 누락',`${p.name} Drive 연결 확인`,`진행 중인 프로젝트인데 기준 Drive 연결이 없습니다. 원본 문서나 폴더를 연결해 주세요.`,p.id,'높음');
      }
      const facts=(db.facts||[]).filter(f=>f.projectId===p.id&&f.approvalStatus==='후보');
      if(facts.length>=3){
        makeAction('정보 검토',`${p.name} 신규 정보 ${facts.length}건 검토`,`Drive 분석에서 신규/변경 Fact가 누적됐습니다. 승인 또는 제외 후 프로젝트 기준 정보를 갱신하세요.`,p.id,'보통');
      }
    });
  }

  function detectSalesFollowups(){
    (db.companies||[]).forEach(c=>{
      const ints=(db.interactions||[]).filter(i=>i.companyId===c.id).sort((a,b)=>toMs(b.date||b.createdAt)-toMs(a.date||a.createdAt));
      const sales=ints.find(i=>i.type==='Sales Interaction');
      const marketing=ints.find(i=>i.type==='Marketing Mailing');
      const last=toMs(sales?.date||sales?.createdAt);
      const status=c.status||c.salesTemperature||'';
      if(status==='협의중'&&(!last||now()-last>days(14))){
        makeAction('영업 후속',`${c.companyName||c.endCustomer||'고객'} 후속 연락 필요`,last?`마지막 영업 접촉 후 ${Math.floor((now()-last)/days(1))}일 경과했습니다.`:'협의중 상태지만 실제 영업 접촉 기록이 없습니다.',null,'높음','고객 마스터 + Gmail');
      }
      if(marketing&&!sales){
        makeAction('영업 전환 검토',`${c.companyName||c.endCustomer||'고객'} 메일링 후 영업 전환 검토`,`마케팅 메일 발송 기록은 있으나 실제 영업 Interaction이 없습니다. 관심 여부 확인 또는 담당 영업 지정이 필요합니다.`,null,'보통','Gmail',marketing.url||'');
      }
    });
  }

  function detectFactChanges(){
    const approved=(db.facts||[]).filter(f=>f.approvalStatus==='승인');
    (db.facts||[]).filter(f=>f.approvalStatus==='후보').forEach(f=>{
      const old=approved.find(a=>a.projectId===f.projectId&&a.subject===f.subject&&a.fact!==f.fact);
      if(old){
        makeAction('변경 감지',`${f.sourceProjectName||'프로젝트'} 정보 변경 후보`,`기존 승인 정보: “${old.fact}” / 신규 Drive 정보: “${f.fact}”`,f.projectId,'높음','Drive 변경 비교',/^https?:/.test(f.source||'')?f.source:'');
      }
    });
  }

  function snapshotFiles(files=[]){
    return files.map(f=>({id:f.id,name:f.name,mimeType:f.mimeType||'',modifiedTime:f.modifiedTime||'',size:f.size||'',webViewLink:f.webViewLink||''})).sort((a,b)=>a.id.localeCompare(b.id));
  }
  function compareSnapshots(prev=[],next=[]){
    const a=new Map(prev.map(f=>[f.id,f])),b=new Map(next.map(f=>[f.id,f]));
    const added=[],modified=[],removed=[];
    next.forEach(f=>{const old=a.get(f.id);if(!old)added.push(f);else if(old.modifiedTime!==f.modifiedTime||old.name!==f.name||String(old.size)!==String(f.size))modified.push({before:old,after:f})});
    prev.forEach(f=>{if(!b.has(f.id))removed.push(f)});
    return {added,modified,removed};
  }

  async function syncDriveSnapshots(){
    const connected=db.projects.filter(p=>p.driveFolderId||p.driveUrl||p.driveFolderUrl);
    let checked=0,changed=0,baselines=0,errors=0;
    for(const p of connected){
      const folder=p.driveFolderId||p.driveUrl||p.driveFolderUrl;
      try{
        const d=await api('/api/drive/list?folderId='+encodeURIComponent(folder));
        const next=snapshotFiles(d.files||[]),prevRec=db.driveSnapshots[p.id],prev=prevRec?.files||[];
        if(!prevRec){
          db.driveSnapshots[p.id]={projectId:p.id,projectName:p.name,folderId:d.folderId||folder,files:next,capturedAt:now()};
          baselines++;
        }else{
          const diff=compareSnapshots(prev,next);
          const count=diff.added.length+diff.modified.length+diff.removed.length;
          if(count){
            changed+=count;
            diff.added.forEach(f=>makeAction('Drive 신규 자료',`${p.name} · ${f.name} 추가`,`연결된 Drive 폴더에 새 자료가 추가되었습니다. 프로젝트 요구사항·일정·업무에 영향이 있는지 검토하세요.`,p.id,'보통',f.name,f.webViewLink));
            diff.modified.forEach(x=>makeAction('Drive 자료 변경',`${p.name} · ${x.after.name} 변경`,`이전 Snapshot 이후 파일이 수정되었습니다. 변경 내용을 다시 분석해 기존 Fact·업무와 비교해야 합니다.`,p.id,'높음',x.after.name,x.after.webViewLink));
            diff.removed.forEach(f=>makeAction('Drive 자료 삭제',`${p.name} · ${f.name} 삭제`,`이전 Snapshot에는 있었지만 현재 Drive 폴더에서는 확인되지 않습니다. 이동·삭제 여부와 프로젝트 영향도를 확인하세요.`,p.id,'높음',f.name,f.webViewLink));
          }
          db.driveSnapshots[p.id]={projectId:p.id,projectName:p.name,folderId:d.folderId||folder,files:next,capturedAt:now(),previousCapturedAt:prevRec.capturedAt,lastDiff:diff};
        }
        checked++;
      }catch(e){
        errors++;
        db.driveSyncLog.unshift({projectId:p.id,projectName:p.name,at:now(),status:'실패',message:e.message});
      }
    }
    db.driveSyncLog.unshift({at:now(),status:errors?'일부 실패':'완료',checked,changed,baselines,errors});
    return {checked,changed,baselines,errors};
  }

  async function run(trigger='수동 실행'){
    const button=$('#runAutomation');if(button){button.disabled=true;button.textContent='Drive 변경 확인 중...'}
    const before=db.actionItems.length;
    let drive={checked:0,changed:0,baselines:0,errors:0};
    try{drive=await syncDriveSnapshots()}catch(e){drive.errors++;}
    detectProjectRisks();detectSalesFollowups();detectFactChanges();
    const created=db.actionItems.length-before;
    db.automationRuns.unshift({id:`run_${now()}`,trigger,created,at:now(),status:drive.errors?'일부 실패':'완료',drive});
    save();renderAutomation();renderDashAutomation();
    if(button){button.disabled=false;button.textContent='자동화 실행'}
    return created;
  }

  function sourceLink(x){return x.sourceUrl?`<a class="source-link" href="${safe(x.sourceUrl)}" target="_blank" rel="noopener noreferrer">↗ 근거 자료 열기</a>`:''}
  function card(x){return `<div class="knowledge-row"><div><div><span class="tag ${x.priority==='높음'?'amber':'blue'}">${safe(x.type)}</span> <span class="tag">${safe(x.priority)}</span></div><b>${safe(x.title)}</b><div>${safe(x.detail)}</div><div class="muted">출처: ${safe(x.source)} · ${new Date(x.createdAt).toLocaleString()}</div>${sourceLink(x)}</div><div class="taskActions"><button class="btn primary" onclick="approveAction('${x.id}')">업무로 승인</button><button class="btn" onclick="completeAction('${x.id}')">완료 처리</button></div></div>`}

  function renderDashAutomation(){
    if(!$('#automationSummary'))return;const open=db.actionItems.filter(x=>x.status!=='완료');
    $('#automationSummary').innerHTML=`<div class="ph"><b>자동화 제안</b><span class="muted">실제 Drive Snapshot·프로젝트·영업 상태를 기준으로 생성</span></div><div class="pb">${open.length?open.slice(0,5).map(card).join(''):'<div class="empty">현재 자동 제안이 없습니다.</div>'}</div>`;
  }
  function snapshotRows(){
    const rows=Object.values(db.driveSnapshots||{}).sort((a,b)=>(b.capturedAt||0)-(a.capturedAt||0));
    return rows.length?rows.map(s=>{const p=db.projects.find(p=>p.id===s.projectId),diff=s.lastDiff||{added:[],modified:[],removed:[]};const changed=diff.added.length+diff.modified.length+diff.removed.length;return `<div class="file"><div><b>${safe(s.projectName||p?.name||'프로젝트')}</b><div class="muted">${s.files.length}개 파일 · 마지막 확인 ${new Date(s.capturedAt).toLocaleString()}</div><div class="source-link-group">${p?.driveUrl?`<a class="source-link" href="${safe(p.driveUrl)}" target="_blank" rel="noopener noreferrer">↗ Drive 폴더 열기</a>`:''}</div></div><span class="tag ${changed?'amber':'green'}">${changed?`변경 ${changed}건`:'변경 없음'}</span></div>`}).join(''):'<div class="empty">Drive가 연결된 프로젝트에서 자동화 실행을 하면 첫 Snapshot이 저장됩니다.</div>';
  }
  function renderAutomation(){
    if(!$('#automationPanel'))return;const open=db.actionItems.filter(x=>x.status!=='완료'),snapshots=Object.keys(db.driveSnapshots||{}).length;
    $('#automationMetrics').innerHTML=`<div class="metric"><b>${open.length}</b><span class="muted">확인할 자동화 제안</span></div><div class="metric"><b>${open.filter(x=>x.priority==='높음').length}</b><span class="muted">높은 우선순위</span></div><div class="metric"><b>${snapshots}</b><span class="muted">Drive Snapshot 프로젝트</span></div><div class="metric"><b>${db.automationRuns.length}</b><span class="muted">자동화 실행</span></div>`;
    $('#automationList').innerHTML=open.length?open.map(card).join(''):'<div class="empty">자동화 실행 후 필요한 후속 업무가 표시됩니다.</div>';
    if($('#driveSnapshotList'))$('#driveSnapshotList').innerHTML=snapshotRows();
    $('#automationRuns').innerHTML=db.automationRuns.length?db.automationRuns.slice(0,8).map(r=>`<div class="file"><div><b>${safe(r.trigger)}</b><div class="muted">${new Date(r.at).toLocaleString()}${r.drive?` · Drive ${r.drive.checked}개 프로젝트 확인 · 변경 ${r.drive.changed}건 · 최초 기준 ${r.drive.baselines}건`:''}</div></div><span class="tag ${r.status==='완료'?'green':'amber'}">${r.created}건 생성</span></div>`).join(''):'<div class="empty">아직 실행 이력이 없습니다.</div>';
  }

  window.completeAction=id=>{const x=db.actionItems.find(a=>a.id===id);if(!x)return;x.status='완료';x.completedAt=now();save();renderAutomation();renderDashAutomation()};
  window.approveAction=id=>{const x=db.actionItems.find(a=>a.id===id);if(!x)return;x.status='승인됨';x.approvedAt=now();const p=db.projects.find(p=>p.id===x.projectId);if(p){p.generatedTasks=p.generatedTasks||[];p.generatedTasks.unshift({id:`task_${now()}`,title:x.title,status:'예정',source:x.source,sourceUrl:x.sourceUrl||'',createdAt:now()});}save();renderAutomation();renderDashAutomation()};
  window.runOpsAutomation=()=>run('수동 실행');window.renderAutomation=renderAutomation;window.renderDashAutomation=renderDashAutomation;

  const baseRenderDash=renderDash;renderDash=function(){baseRenderDash();renderDashAutomation()};
  if($('#navAutomation'))$('#navAutomation').onclick=()=>{['dashboard','projects','knowledge','sales','projectDetail','automationPanel'].forEach(id=>$('#'+id)?.classList.add('hidden'));document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));$('#automationPanel').classList.remove('hidden');$('#navAutomation').classList.add('active');renderAutomation();authStatus()};
  if($('#runAutomation'))$('#runAutomation').onclick=()=>run('수동 실행');
  setTimeout(renderDashAutomation,0);
})();