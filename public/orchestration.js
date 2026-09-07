(function(){
  function bindUnifiedAutomation(){
    const btn=document.querySelector('#runAutomation');
    if(!btn||btn.dataset.unifiedBound==='1')return;
    btn.dataset.unifiedBound='1';
    btn.onclick=async()=>{
      btn.disabled=true;
      const original=btn.textContent;
      try{
        btn.textContent='Drive·Chat 확인 중...';
        if(typeof window.runOpsAutomation==='function')await window.runOpsAutomation();
        if(typeof window.syncGoogleChatSources==='function')await window.syncGoogleChatSources();
      }finally{
        btn.disabled=false;
        btn.textContent=original||'자동화 실행';
      }
    };
  }
  new MutationObserver(bindUnifiedAutomation).observe(document.body,{childList:true,subtree:true});
  setTimeout(bindUnifiedAutomation,0);
})();