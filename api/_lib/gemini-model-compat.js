module.exports=function installGeminiModelCompat(){
  process.env.PROJECT_SYNC_GEMINI_MODEL=process.env.PROJECT_SYNC_GEMINI_MODEL||'gemini-3.5-flash-lite';
  process.env.TASK_GEMINI_MODEL=process.env.TASK_GEMINI_MODEL||'gemini-3.5-flash-lite';
  if(global.__teamgritGeminiModelCompat)return;
  const originalFetch=global.fetch;
  if(typeof originalFetch!=='function')return;
  global.fetch=async function(input,init){
    let url=typeof input==='string'?input:input?.url;
    if(typeof url==='string'&&url.includes('generativelanguage.googleapis.com')){
      url=url.replace('/models/gemini-2.5-flash-lite:','/models/gemini-3.5-flash-lite:')
             .replace('/models/gemini-2.5-flash:','/models/gemini-3.6-flash:');
      if(typeof input==='string')input=url;
      else if(input instanceof Request)input=new Request(url,input);
    }
    return originalFetch(input,init);
  };
  global.__teamgritGeminiModelCompat=true;
};
