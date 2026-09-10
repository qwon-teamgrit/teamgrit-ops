module.exports=function installAiDeferredCompat(){
  const mod=require('./source-corpus-all');
  if(mod.__teamgritAiDeferredCompat)return;
  const original=mod.extractProjects;
  mod.extractProjects=async function(corpus){
    try{
      return await original(corpus);
    }catch(e){
      const message=String(e?.message||e||'');
      const temporary=/Gemini 호출 실패|\b429\b|quota|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|high demand|temporar/i.test(message);
      if(!temporary)throw e;
      const code=/\b429\b/.test(message)&&/\b503\b/.test(message)?'429/503':/\b429\b/.test(message)?'429':/\b503\b/.test(message)?'503':'일시 오류';
      console.error('[project-ai-deferred]',message);
      return {
        projects:[],
        modelUsed:`AI 분석 대기 (${code})`,
        truncated:!!corpus?.partial,
        aiDeferred:true,
        aiError:message
      };
    }
  };
  mod.__teamgritAiDeferredCompat=true;
};
