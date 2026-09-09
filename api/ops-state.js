const crypto=require('crypto');

const FILE_NAME='TeamGRIT Ops 운영 데이터';
const APP_KEY='teamgrit-ops-state-v1';
const STATE_SHEET='_State';
const PROJECTS_SHEET='Projects';
const EXECUTIONS_SHEET='Executions';

function parseCookies(req){const out={};for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>-1)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
function cookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
async function body(req){let raw='';for await(const chunk of req)raw+=chunk;try{return JSON.parse(raw||'{}')}catch{return {}}}
async function refresh(refreshToken){const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:refreshToken,grant_type:'refresh_token'});const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params});if(!response.ok)throw new Error('Google token refresh failed');return response.json()}
async function access(req,res){const cookies=parseCookies(req);if(cookies.g_access)return cookies.g_access;if(!cookies.g_refresh)return null;const token=await refresh(cookies.g_refresh);res.setHeader('Set-Cookie',[cookie('g_access',token.access_token,Math.max(300,(token.expires_in||3600)-120)),cookie('g_refresh',cookies.g_refresh,60*60*24*30)]);return token.access_token}
async function google(token,url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,...(options.headers||{})}});if(!response.ok){const detail=await response.text();throw new Error(`Google API ${response.status}: ${detail.slice(0,500)}`)}if(response.status===204)return null;return response.json()}
function q(value){return String(value).replace(/'/g,"\\'")}
async function findStorage(token){const query=encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and appProperties has { key='teamgritOps' and value='${APP_KEY}' } and trashed=false`);const result=await google(token,`https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=1&fields=files(id,name,webViewLink,modifiedTime)`);return result.files?.[0]||null}
async function ensureStorage(token,file){const spreadsheet=await google(token,`https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties`),sheets=spreadsheet.sheets||[],titles=new Set(sheets.map(s=>s.properties?.title)),requests=[];
  if(!titles.has(PROJECTS_SHEET))requests.push({addSheet:{properties:{title:PROJECTS_SHEET}}});
  if(!titles.has(EXECUTIONS_SHEET))requests.push({addSheet:{properties:{title:EXECUTIONS_SHEET}}});
  const state=sheets.find(s=>s.properties?.title===STATE_SHEET),candidate=sheets.find(s=>![PROJECTS_SHEET,EXECUTIONS_SHEET].includes(s.properties?.title));
  if(state)requests.push({updateSheetProperties:{properties:{sheetId:state.properties.sheetId,hidden:true},fields:'hidden'}});
  else if(candidate)requests.push({updateSheetProperties:{properties:{sheetId:candidate.properties.sheetId,title:STATE_SHEET,hidden:true},fields:'title,hidden'}});
  else requests.push({addSheet:{properties:{title:STATE_SHEET,hidden:true}}});
  if(requests.length)await google(token,`https://sheets.googleapis.com/v4/spreadsheets/${file.id}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests})});
  return {...file,webViewLink:file.webViewLink||`https://docs.google.com/spreadsheets/d/${file.id}/edit`};
}
async function createStorage(token){const file=await google(token,'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FILE_NAME,mimeType:'application/vnd.google-apps.spreadsheet',appProperties:{teamgritOps:APP_KEY}})});return ensureStorage(token,file)}
async function readState(token,file){const range=encodeURIComponent(`'${STATE_SHEET}'!A:B`);const values=await google(token,`https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${range}`);const rows=values.values||[];const revision=rows.find(r=>r[0]==='revision')?.[1]||null;const chunks=rows.filter(r=>/^chunk_\d+$/.test(r[0]||'')).sort((a,b)=>Number(a[0].slice(6))-Number(b[0].slice(6))).map(r=>r[1]||'');if(!chunks.length)return {state:null,revision};try{return {state:JSON.parse(chunks.join('')),revision}}catch{throw new Error('central_state_invalid')}
}
function projectRows(state){return [['project_id','name','category','status','drive_url','figma_url','updated_at'],...(state.projects||[]).map(p=>[p.id||'',p.name||'',p.category||'',p.status||'',p.driveUrl||'',p.figmaUrl||'',p.updatedAt||state.updatedAt||''])]}
function executionRows(state){return [['run_id','project_id','project_name','action','output_type','model','status','started_at','finished_at','file_url','error'],...(state.executionLogs||[]).map(x=>[x.id||'',x.projectId||'',x.projectName||'',x.action||'',x.outputType||'',x.model||'',x.status||'',x.startedAt||'',x.finishedAt||'',x.fileUrl||'',x.error||''])]}
async function putValues(token,fileId,range,values){await google(token,`https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({values})})}
async function clearValues(token,fileId,range){await google(token,`https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(range)}:clear`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})}
async function writeState(token,file,state,revision){const serialized=JSON.stringify(state),chunks=[];for(let i=0;i<serialized.length;i+=40000)chunks.push(serialized.slice(i,i+40000));await Promise.all([clearValues(token,file.id,`'${q(STATE_SHEET)}'!A:B`),clearValues(token,file.id,`'${q(PROJECTS_SHEET)}'!A:Z`),clearValues(token,file.id,`'${q(EXECUTIONS_SHEET)}'!A:Z`)]);await Promise.all([putValues(token,file.id,`'${q(STATE_SHEET)}'!A1`,[['schema','teamgrit-ops-state-v1'],['revision',revision],['updated_at',new Date().toISOString()],...chunks.map((value,index)=>[`chunk_${index}`,value])]),putValues(token,file.id,`'${q(PROJECTS_SHEET)}'!A1`,projectRows(state)),putValues(token,file.id,`'${q(EXECUTIONS_SHEET)}'!A1`,executionRows(state))])}

module.exports=async(req,res)=>{try{
  const token=await access(req,res);if(!token)return json(res,401,{error:'google_not_connected'});
  let storage=await findStorage(token);if(storage)storage=await ensureStorage(token,storage);
  if(req.method==='GET'){
    if(!storage)return json(res,200,{state:null,revision:null,storage:null});
    const current=await readState(token,storage);return json(res,200,{...current,storage});
  }
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  const input=await body(req);if(!input.state||!Array.isArray(input.state.projects))return json(res,400,{error:'state_required'});
  if(!storage)storage=await createStorage(token);
  const current=await readState(token,storage);
  if(input.baseRevision&&current.revision&&input.baseRevision!==current.revision)return json(res,409,{error:'central_state_conflict',revision:current.revision});
  const revision=crypto.randomUUID();
  await writeState(token,storage,input.state,revision);
  return json(res,200,{ok:true,revision,storage});
}catch(error){return json(res,500,{error:error.message})}};
