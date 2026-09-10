module.exports=function installDrive404Compat(){
  if(global.__teamgritDrive404Compat)return;
  const originalFetch=global.fetch;
  if(typeof originalFetch!=='function')return;
  global.fetch=async function(input,init){
    let url=typeof input==='string'?input:input?.url;
    if(typeof url==='string'&&url.includes('https://www.googleapis.com/drive/v3/files?')&&/fields=files\([^)]*$/.test(url)){
      url+=')';
      if(typeof input==='string')input=url;
      else if(input instanceof Request)input=new Request(url,input);
    }
    const r=await originalFetch(input,init);
    if(r.status===404 && typeof url==='string' && /https:\/\/www\.googleapis\.com\/drive\/v3\/files\/[^?]+\?fields=/.test(url)){
      const m=url.match(/\/drive\/v3\/files\/([^?]+)/);
      const id=m?decodeURIComponent(m[1]):'';
      const body=JSON.stringify({id,name:`접근 불가 원본 (${id})`,mimeType:'application/x-teamgrit-missing-drive-source',modifiedTime:'',webViewLink:id?`https://drive.google.com/open?id=${id}`:'',parents:[],teamgritMissing:true});
      return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
    }
    return r;
  };
  global.__teamgritDrive404Compat=true;
};
