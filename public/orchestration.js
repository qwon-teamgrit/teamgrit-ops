(function(){
  const q=id=>document.getElementById(id);
  const hide=id=>q(id)?.classList.add('hidden');
  const show=id=>q(id)?.classList.remove('hidden');

  function hideAll(){
    ['dashboard','projects','knowledge','sales','automationPanel','projectDetail'].forEach(hide);
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  }

  function integrateProjectInfo(){
    const projects=q('projects');
    if(!projects)return;
    try{q('syncProjectInfo')?.click()}catch{}
    let wrap=q('projectInfoIntegrated');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='projectInfoIntegrated';
      wrap.className='panel';
      wrap.style.marginTop='18px';
      wrap.innerHTML='<div class="ph"><b>프로젝트 정보</b><span class="muted">Drive 기준 프로젝트 정보와 변경 Fact를 프로젝트 목록에서 함께 확인합니다.</span></div><div class="pb" id="projectInfoIntegratedBody"></div>';
      projects.appendChild(wrap);
    }
    const body=q('projectInfoIntegratedBody');
    ['knowledgeMetrics','projectInfoList','factList'].forEach(id=>{
      const el=q(id);
      if(el && el.parentElement!==body){
        if(id==='projectInfoList') body.insertAdjacentHTML('beforeend','<h3 style="margin:18px 0 10px">Drive 기준 프로젝트 정보</h3>');
        if(id==='factList') body.insertAdjacentHTML('beforeend','<h3 style="margin:18px 0 10px">Drive 변경·Fact</h3>');
        body.appendChild(el);
      }
    });
  }

  function go(view){
    hideAll();
    if(view==='dash'){
      show('dashboard');q('navDash')?.classList.add('active');
      if(typeof renderDash==='function')renderDash();
    }
    if(view==='projects'){
      show('projects');q('navProjects')?.classList.add('active');
      if(typeof renderProjects==='function')renderProjects();
      integrateProjectInfo();
    }
    if(view==='sales'){
      show('sales');q('navSales')?.classList.add('active');
      try{q('syncSales')?.click()}catch{}
    }
    if(view==='automation'){
      show('automationPanel');q('navAutomation')?.classList.add('active');
    }
    if(typeof authStatus==='function')authStatus();
    window.scrollTo(0,0);
  }

  function bindAutomation(){
    const btn=q('runAutomation');
    if(!btn)return;
    btn.onclick=async()=>{
      btn.disabled=true;const old=btn.textContent;
      try{
        btn.textContent='Drive·Chat 확인 중...';
        if(typeof window.runOpsAutomation==='function')await window.runOpsAutomation();
        if(typeof window.syncGoogleChatSources==='function')await window.syncGoogleChatSources();
      }finally{btn.disabled=false;btn.textContent=old||'자동화 실행'}
    };
  }

  function init(){
    // Keep the legacy element for its data/render hooks, but remove it from navigation.
    const nk=q('navKnowledge');if(nk)nk.style.display='none';
    q('navDash').onclick=()=>go('dash');
    q('navProjects').onclick=()=>go('projects');
    q('navSales').onclick=()=>go('sales');
    q('navAutomation').onclick=()=>go('automation');
    q('backProjects').onclick=()=>go('projects');
    bindAutomation();
    go('dash');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
