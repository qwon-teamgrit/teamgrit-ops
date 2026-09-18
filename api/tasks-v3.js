require('./_lib/gemini-model-compat')();
const base=require('./tasks-v2');
const central=require('./_lib/central-entities');
const phase2=require('./_lib/task-phase2');
const {gemini,clean,arr,readFile,WORK_DOC_ID}=require('./_lib/source-corpus-all');

const OPS=process.env.OPS_DATA_SHEET_ID||'1Gfs2mC9_b7_u7sGIDC74WD-GUTLJy8JqBhSXwlzN_Uk';

function cookies(req){const o={};String(req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)o[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return o}
async function access(req){const c=cookies(req);if(c.g_access)return c.g_access;if(!c.g_refresh)return null;const p=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:c.g_refresh,grant_type:'refresh_token'}),r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p});if(!r.ok)throw new Error('Google token refresh failed');return (await r.json()).access_token}
async function gf(token,url,opts={}){const r=await fetch(url,{...opts,headers:{Authorization:`Bearer ${token}`,...(opts.headers||{})}});if(!r.ok)throw new Error(`Google API ${r.status}: ${(await r.text()).slice(0,500)}`);return (r.headers.get('content-type')||'').includes('json')?r.json():r.text()}
async function readBody(req){let s='';for await(const c of req)s+=c;try{return JSON.parse(s||'{}')}catch{return {}}}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data))}
async function sheetRows(token,name,range){const d=await gf(token,`https://sheets.googleapis.com/v4/spreadsheets/${OPS}/values/${encodeURIComponent(`${name}!${range}`)}`).catch(()=>({values:[]})),rows=d.values||[];if(rows.length<2)return[];const head=rows[0];return rows.slice(1).filter(r=>r.some(v=>String(v||'').trim())).map(r=>{const o={};head.forEach((h,i)=>o[h]=r[i]??'');return o})}
function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9가-힣]+/g,' ').replace(/\s+/g,' ').trim()}
function toks(v){return [...new Set(norm(v).split(' ').filter(x=>x.length>=2))]}
function overlap(a,b){const A=toks(a),B=new Set(toks(b));if(!A.length||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.length,B.size)}
function taskSimilarity(a,b){const A=norm(a),B=norm(b);if(!A||!B)return 0;if(A===B)return 1;if((A.includes(B)||B.includes(A))&&Math.min(A.length,B.length)>=7)return .9;return overlap(A,B)}
function ids(v){return [...new Set(String(v||'').split(/[\s,;|]+/).map(clean).filter(Boolean))]}
function sourceId(s){return clean(s.source_id||s.sourceId||s.id)}
function sourceTitle(s){return clean(s.title||s.name||s.file_name||s.fileName||sourceId(s))}
function sourceText(s){return Object.values(s||{}).map(clean).filter(Boolean).join(' ')}
function projectText(p){return [p.name,p.customer,p.manual_category,p.source_category,p.summary,p.source_evidence,p.evidence].map(clean).join(' ')}
function projectSourceIds(p){return ids(p.source_ids||p.sourceIds)}
function factText(f){return [f.subject,f.fact,f.evidence].map(clean).join(' ')}
function factSourceIds(f){return ids(f.source_ids||f.sourceIds)}
function score(query,text){const q=norm(query),t=norm(text);if(!q||!t)return 0;let s=overlap(q,t);for(const token of toks(q)){if(token.length>=4&&t.includes(token))s+=.035}return s}
function rank(query,items,textFn,limit=20,min=.03){return items.map(item=>({item,score:score(query,textFn(item))})).filter(x=>x.score>=min).sort((a,b)=>b.score-a.score).slice(0,limit)}
function sourceMap(sources){const m=new Map();for(const s of sources){const id=sourceId(s);if(id)m.set(id,s)}return m}
function exactProject(projects,name){const n=norm(name);return projects.find(p=>norm(p.name)===n)||null}
function buildFocusedContext(memo,projects,facts,sources,tasks){
  const rankedProjects=rank(memo,projects,projectText,8,.025);
  const rankedFacts=rank(memo,facts,factText,40,.025);
  const wanted=new Set();
  for(const x of rankedProjects)for(const id of projectSourceIds(x.item))wanted.add(id);
  for(const x of rankedFacts)for(const id of factSourceIds(x.item))wanted.add(id);
  const rankedSources=rank(memo,sources,sourceText,40,.015).sort((a,b)=>{const ar=clean(a.item.root_source||a.item.rootSource)==='2026년 팀그릿 업무진행'?0:1,br=clean(b.item.root_source||b.item.rootSource)==='2026년 팀그릿 업무진행'?0:1;return ar-br||b.score-a.score});
  for(const x of rankedSources)wanted.add(sourceId(x.item));
  const relatedSources=sources.filter(s=>wanted.has(sourceId(s))).sort((a,b)=>{const ar=clean(a.root_source||a.rootSource)==='2026년 팀그릿 업무진행'?0:1,br=clean(b.root_source||b.rootSource)==='2026년 팀그릿 업무진행'?0:1;return ar-br}).slice(0,60);
  const relatedTasks=rank(memo,tasks,t=>[t.title,t.project,t.owner,t.source].map(clean).join(' '),60,.015).map(x=>x.item);
  const lines=[];
  for(const x of rankedProjects)lines.push(`[PROJECT] ${clean(x.item.name)} | score:${x.score.toFixed(3)} | 고객:${clean(x.item.customer)} | 상태:${clean(x.item.manual_status||x.item.source_status)} | 분류:${clean(x.item.manual_category||x.item.source_category)} | 요약:${clean(x.item.summary)} | 근거:${clean(x.item.source_evidence||x.item.evidence)} | sourceIds:${projectSourceIds(x.item).join(',')}`);
  for(const x of rankedFacts)lines.push(`[FACT] ${clean(x.item.subject)} | ${clean(x.item.fact)} | score:${x.score.toFixed(3)} | 근거:${clean(x.item.evidence)} | sourceIds:${factSourceIds(x.item).join(',')}`);
  for(const s of relatedSources)lines.push(`[SOURCE] ${sourceId(s)} | ${sourceTitle(s)} | ${clean(s.root_source||s.rootSource)} | ${clean(s.url||s.source_url||s.webViewLink)}`);
  for(const t of relatedTasks)lines.push(`[EXISTING_TASK] ${clean(t.title)} | 프로젝트:${clean(t.project)} | 담당자:${clean(t.owner)} | 기한:${clean(t.due_date)} | 상태:${clean(t.status)} | sourceIds:${clean(t.source_ids)}`);
  return {text:lines.join('\n').slice(0,120000),rankedProjects,rankedFacts,relatedSources,relatedTasks};
}
async function context(token,memo){const [projects,facts,sources,tasks]=await Promise.all([central.list(token,'Projects').catch(()=>[]),central.list(token,'ProductFacts').catch(()=>[]),sheetRows(token,'Sources','A1:O5000'),sheetRows(token,'Tasks','A1:U5000')]);const validIds=new Set(sources.map(sourceId).filter(Boolean)),focused=buildFocusedContext(memo,projects,facts,sources,tasks);return {projects,facts,sources,tasks,validIds,sourceById:sourceMap(sources),focused,totalSourceCount:sources.length,existingTaskCount:tasks.length}}
async function detailedSourceContext(token,task,ctx){
  const preferred=new Set(ids(task.source_ids||task.sourceIds));
  const ordered=[...ctx.focused.relatedSources].sort((a,b)=>{const ap=preferred.has(sourceId(a))?0:1,bp=preferred.has(sourceId(b))?0:1;if(ap!==bp)return ap-bp;const ar=clean(a.root_source||a.rootSource)==='2026년 팀그릿 업무진행'?0:1,br=clean(b.root_source||b.rootSource)==='2026년 팀그릿 업무진행'?0:1;return ar-br});
  const chunks=[];let used=0;
  for(const s of ordered.slice(0,12)){
    const fileId=clean(s.file_id||s.fileId),mimeType=clean(s.mime_type||s.mimeType);
    if(!fileId||!mimeType||mimeType==='application/vnd.google-apps.folder')continue;
    try{
      const r=await readFile(token,{id:fileId,mimeType,name:sourceTitle(s)});
      const body=clean(r?.text).slice(0,30000);
      if(!body)continue;
      chunks.push(`<SOURCE_BODY id="${sourceId(s)}" title="${sourceTitle(s)}">
${body}
</SOURCE_BODY>`);
      used++;
      if(chunks.join('\n').length>100000)break;
    }catch{}
  }
  return {text:chunks.join('\n').slice(0,100000),used};
}
function normalizeTasks(data,ctx){return arr(data?.tasks).map(t=>({title:clean(t.title),project:clean(t.project),owner:clean(t.owner),dueDate:clean(t.dueDate),status:clean(t.status)||'예정',reason:clean(t.reason),sourceEvidence:clean(t.sourceEvidence),sourceIds:arr(t.sourceIds).map(clean).filter(id=>ctx.validIds.has(id)),duplicateStatus:clean(t.duplicateStatus)||'new'})).filter(t=>t.title)}
function resolveProject(task,ctx,memo){const knownAi=exactProject(ctx.projects,task.project);let best=null,bestScore=0,bestReason='';const taskQuery=[task.title,task.reason,task.sourceEvidence].join(' '),taskIds=new Set(task.sourceIds||[]);for(const p of ctx.projects){const pIds=projectSourceIds(p),shared=pIds.filter(id=>taskIds.has(id));let s=score(taskQuery,projectText(p));if(shared.length)s+=2+Math.min(1,shared.length*.25);if(knownAi&&norm(knownAi.name)===norm(p.name))s+=.35;if(norm(memo).includes(norm(p.name))&&norm(p.name).length>=4)s+=.4;if(s>bestScore){best=p;bestScore=s;bestReason=shared.length?`후보 근거 Source ${shared.slice(0,3).join(', ')}가 프로젝트 근거와 연결됨`:`업무 문맥과 프로젝트 근거 유사도 ${s.toFixed(2)}`}}
  if(!best||bestScore<.16)return {project:'',projectEvidence:'명확한 프로젝트 근거를 찾지 못해 확인 필요',projectScore:bestScore};
  return {project:clean(best.name),projectEvidence:bestReason,projectScore:bestScore};
}
function enrichTask(task,ctx,memo){const rp=resolveProject(task,ctx,memo),titles=(task.sourceIds||[]).map(id=>({id,title:sourceTitle(ctx.sourceById.get(id)||{}),url:clean((ctx.sourceById.get(id)||{}).url||(ctx.sourceById.get(id)||{}).source_url)}));return {...task,...rp,sourceTitles:titles,decisionSummary:`${rp.project?`프로젝트 '${rp.project}' 근거 확인`:'프로젝트 확인 필요'} · Source ${titles.length}개 근거 사용`}}
function duplicateCheck(tasks,ctx){const kept=[],checks=[],suppressed=[];for(const t of tasks){let best=null,bestScore=0;for(const e of ctx.tasks){const s=taskSimilarity(t.title,e.title),sameProject=!t.project||!e.project||norm(t.project)===norm(e.project);if(sameProject&&s>bestScore){best=e;bestScore=s}}if(best&&bestScore>=.72){suppressed.push(t);checks.push({title:t.title,result:'duplicate',matchedTask:clean(best.title),score:bestScore})}else{kept.push({...t,duplicateStatus:'new'});checks.push({title:t.title,result:'new',matchedTask:'',score:bestScore})}}return {kept,checks,suppressed}}
async function callAdk(memo,ctx){const baseUrl=String(process.env.TEAMGRIT_AGENT_URL||'').replace(/\/$/,'');if(!baseUrl)throw new Error('agent_runtime_not_configured');const headers={'Content-Type':'application/json'};if(process.env.TEAMGRIT_AGENT_TOKEN)headers.Authorization=`Bearer ${process.env.TEAMGRIT_AGENT_TOKEN}`;const r=await fetch(`${baseUrl}/teamgrit/analyze`,{method:'POST',headers,body:JSON.stringify({memo,centralContext:ctx.focused.text,validSourceIds:[...ctx.validIds]})});if(!r.ok)throw new Error(`ADK runtime ${r.status}: ${(await r.text()).slice(0,400)}`);return r.json()}
async function runBuiltIn(memo,ctx){const projectNames=ctx.focused.rankedProjects.map(x=>clean(x.item.name));const prompt=`너는 TeamGRIT 업무 에이전트다. 아래는 전체 회사 자료가 아니라 사용자 메모와 관련도가 높은 중앙 근거만 선별한 컨텍스트다. 반드시 이 근거 안에서만 판단한다.\n1) 메모를 실행 가능한 업무로 분해한다.\n2) 관련 PROJECT/FACT/SOURCE를 근거로 연결한다.\n3) project는 반드시 제공된 PROJECT의 정확한 이름만 사용하거나, 불명확하면 빈 문자열로 둔다.\n4) 담당자/기한도 메모 또는 근거에 명시되지 않으면 빈 문자열로 둔다.\n5) sourceIds는 제공된 SOURCE/PROJECT/FACT에 실제 등장한 ID만 사용한다.\n6) 기존 업무와 겹치면 duplicateStatus=duplicate.\nJSON만 반환한다. 형식: {"tasks":[{"title":string,"project":string,"owner":string,"dueDate":string,"status":string,"reason":string,"sourceEvidence":string,"sourceIds":[string],"duplicateStatus":"new"|"duplicate"}],"trace":{"reasoningSummary":string}}.\n\n[사용자 메모]\n${memo}\n\n[사용 가능한 프로젝트명]\n${projectNames.join('\n')||'없음'}\n\n[관련 중앙 근거]\n${ctx.focused.text}`;const ai=await gemini(prompt);return {...ai.data,modelUsed:ai.modelUsed}}
async function analyze(req,res){const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected',connection:'연결 안 됨'});const b=await readBody(req),memo=clean(b.memo);if(!memo)return json(res,400,{error:'memo_required'});const ctx=await context(token,memo);if(!ctx.focused.text)return json(res,200,{tasks:[],modelUsed:null,error:'관련 중앙 근거를 찾지 못했습니다. 먼저 원본을 동기화하거나 메모를 더 구체적으로 작성해주세요.'});let data,runtime='google-adk',fallbackReason='';try{data=await callAdk(memo,ctx)}catch(e){runtime='teamgrit-agent';fallbackReason=String(e?.message||e);data=await runBuiltIn(memo,ctx)}const normalized=normalizeTasks(data,ctx).map(t=>enrichTask(t,ctx,memo)),aiDup=normalized.filter(t=>t.duplicateStatus==='duplicate'),candidates=normalized.filter(t=>t.duplicateStatus!=='duplicate'),dup=duplicateCheck(candidates,ctx),tasks=dup.kept,suppressed=aiDup.length+dup.suppressed.length,usedIds=[...new Set(tasks.flatMap(t=>t.sourceIds||[]))],matchedProjects=[...new Set(tasks.map(t=>t.project).filter(Boolean))];const trace={matchedProjects,relevantSourceCount:ctx.focused.relatedSources.length,usedSourceCount:usedIds.length,totalSourceCount:ctx.totalSourceCount,existingTaskChecks:dup.checks,proposedCount:tasks.length,suppressedDuplicateCount:suppressed,existingTaskCount:ctx.existingTaskCount,reasoningSummary:clean(data?.trace?.reasoningSummary),relevantSources:ctx.focused.relatedSources.slice(0,12).map(s=>({id:sourceId(s),title:sourceTitle(s),url:clean(s.url||s.source_url)})),steps:[{name:'관련 근거 검색',status:'완료',detail:`전체 Source ${ctx.totalSourceCount}개 중 관련 Source ${ctx.focused.relatedSources.length}개 선별`},{name:'프로젝트 확정',status:'완료',detail:`근거 연결로 프로젝트 ${matchedProjects.length}개 확정`},{name:'기존 업무 비교',status:'완료',detail:`기존 Tasks ${ctx.existingTaskCount}개와 비교 · 중복 ${suppressed}개 제외`},{name:'신규 업무 제안',status:'완료',detail:`실제 판단에 Source ${usedIds.length}개 사용 · 신규 ${tasks.length}개 제안`} ]};return json(res,200,{tasks,trace,modelUsed:data?.modelUsed||process.env.TEAMGRIT_AGENT_MODEL||'gemini-3.8-flash',runtime,agentRuntime:true,externalAdk:runtime==='google-adk',fallbackReason:runtime==='teamgrit-agent'?fallbackReason:'',sourceCount:ctx.totalSourceCount,relevantSourceCount:ctx.focused.relatedSources.length,usedSourceCount:usedIds.length,existingTaskCount:ctx.existingTaskCount,usingCentralCache:true})}

async function taskById(token,id){const rows=await sheetRows(token,'Tasks','A1:U5000');return rows.find(t=>clean(t.task_id)===clean(id))||null}

function recentMonthSection(text=''){
  const s=String(text||''),lines=s.split(/\r?\n/),starts=[],now=new Date(),cutoff=new Date(now.getTime()-30*24*60*60*1000);
  function dates(line){
    const m=clean(line).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}).*?-\s*(\d{1,2})\/(\d{1,2})/);
    if(!m)return null;
    const y=Number(m[1]),sm=Number(m[2]),sd=Number(m[3]),em=Number(m[4]),ed=Number(m[5]);
    return {start:new Date(y,sm-1,sd),end:new Date(y,em-1,ed)};
  }
  for(let i=0;i<lines.length;i++){const d=dates(lines[i]);if(d)starts.push({i,header:clean(lines[i]),...d})}
  if(!starts.length)return {key:'최근 30일',text:s.slice(0,220000),from:cutoff.toISOString(),to:now.toISOString()};
  const chosen=starts.filter(x=>x.end>=cutoff).slice(0,6),sections=[];
  for(const x of chosen){const pos=starts.findIndex(y=>y.i===x.i),b=pos+1<starts.length?starts[pos+1].i:lines.length;sections.push(lines.slice(x.i,b).join('\n'))}
  const from=chosen.length?chosen[chosen.length-1].start:cutoff;
  return {key:`최근 30일 · ${from.toISOString().slice(0,10)}~${now.toISOString().slice(0,10)}`,text:sections.join('\n\n').slice(0,260000),from:from.toISOString(),to:now.toISOString()};
}
function taskStableId(_windowKey,owner,project,title){return central.id('task',`${owner}|${project}|${norm(title)}`)}
async function primaryLinkedContext(token,section){
  const rows=await sheetRows(token,'Sources','A1:O5000'),mainRows=rows.filter(s=>clean(s.root_source)==='2026년 팀그릿 업무진행'&&clean(s.file_id)!==WORK_DOC_ID);
  const ranked=rank(section,mainRows,s=>[s.title,s.read_detail,s.url].map(clean).join(' '),18,.005);
  const chunks=[],used=[];
  for(const x of ranked){
    const s=x.item,fileId=clean(s.file_id),mimeType=clean(s.mime_type);
    if(!fileId||!mimeType||mimeType==='application/vnd.google-apps.folder')continue;
    try{
      const r=await readFile(token,{id:fileId,mimeType,name:sourceTitle(s)}),body=clean(r?.text).slice(0,18000);
      if(!body)continue;
      used.push({id:sourceId(s),title:sourceTitle(s),url:clean(s.url),fileId});
      chunks.push(`[LINKED_DRIVE id="${sourceId(s)}" title="${sourceTitle(s)}"]\\n${body}\\n[/LINKED_DRIVE]`);
      if(chunks.join('\\n').length>120000)break;
    }catch{}
  }
  return {text:chunks.join('\\n').slice(0,120000),sources:used};
}

function parseWorklogStructure(sectionText,{dedupe=true,includeCompleted=false}={}){
  const personNames=new Set(['김기령','강성일','임양성','김규원','백승윤','유하은','정해수','이재원','장재훈','박종현','김태성','태성','강민우','김승종']);
  const rows=String(sectionText||'').split(/\r?\n/).map((line,i)=>{const m=line.match(/^(\s*)\*\s+(.*)$/);return m?{i,indent:m[1].length,text:clean(m[2])}:null}).filter(Boolean);
  const tasks=[],pairs=new Set();let owner='',ownerIndent=-1,ignoredIndent=-1;const stack=[];
  const doneRe=/(완료됨|완료\.?$|확인 완료|전달 완료|발송 완료|송부 완료|주문 완료|수령 완료)/;
  const globalSkip=/^(주간 업무내용|사업본부|개발본부|시스템 개발팀|서비스 개발팀|컨텐츠 개발팀|선행기술 개발팀|공지사항|회의실|출장\/외근|휴가)/;
  const modeRe=/^(진행사항|계획사항)$/;
  for(let i=0;i<rows.length;i++){
    const r=rows[i],next=rows[i+1],nextIndent=next?next.indent:-1;
    if(ignoredIndent>=0){
      if(r.indent>ignoredIndent)continue;
      ignoredIndent=-1;
    }
    while(stack.length&&stack[stack.length-1].indent>=r.indent)stack.pop();
    const base=clean(r.text.split(/[\[(]/)[0]);
    if(personNames.has(base)){owner=base;ownerIndent=r.indent;stack.length=0;continue}
    if(!owner||r.indent<=ownerIndent)continue;
    if(globalSkip.test(r.text)){if(nextIndent>r.indent)ignoredIndent=r.indent;continue}
    const path=[...stack.map(x=>x.text),r.text],meaningful=path.filter(x=>!modeRe.test(x));
    const project=clean((meaningful[0]||'').replace(/^\((.*?)\)$/,'$1').replace(/\s*\(.*?\)\s*/g,' '))||'확인 필요';
    if(project!=='확인 필요')pairs.add(norm(owner)+'|'+norm(project));
    const hasChild=nextIndent>r.indent;
    if(hasChild){stack.push({indent:r.indent,text:r.text});continue}
    if(modeRe.test(r.text)||r.text.length<3)continue;
    const mode=path.find(x=>modeRe.test(x))||'';
    const completed=doneRe.test(r.text)&&mode==='진행사항';
    if(completed&&!includeCompleted)continue;
    tasks.push({title:r.text,project,owner,dueDate:'',status:completed?'완료':(mode==='계획사항'?'예정':'진행 중'),evidence:`${owner} > ${path.join(' > ')}`,sourceIds:[]});
  }
  return {tasks:dedupe?dedupePrimaryTasks(tasks):tasks,pairs};
}
function parsePrimaryTasksDeterministic(sectionText){return parseWorklogStructure(sectionText).tasks}
function worklogPeriods(text=''){
  const lines=String(text||'').split(/\r?\n/),out=[];let current=null,buf=[];
  const isHeader=line=>/^\d{4}\/\d{1,2}\/\d{1,2}.*?-\s*\d{1,2}\/\d{1,2}/.test(clean(line));
  const flush=()=>{if(current&&buf.length)out.push({period:current,text:buf.join('\n')});buf=[]};
  for(const line of lines){if(isHeader(line)){flush();current=clean(line);buf=[line]}else if(current)buf.push(line)}
  flush();return out;
}
function parseAllWorklogHistory(text=''){
  const out=[];
  for(const part of worklogPeriods(text)){for(const t of parseWorklogStructure(part.text,{dedupe:false,includeCompleted:true}).tasks)out.push({...t,period:part.period})}
  return out;
}
function projectEquivalent(a,b){
  const na=norm(a),nb=norm(b);if(!na||!nb)return false;if(na===nb)return true;
  const ta=projectTokens(a),tb=projectTokens(b);if(!ta.length||!tb.length)return false;
  const exact=ta.filter(x=>tb.includes(x)).length,coverage=exact/Math.min(ta.length,tb.length);
  return exact>=1&&coverage>=0.75;
}

function projectTokens(v=''){return [...new Set(norm(v).split(/[^0-9a-z가-힣]+/).filter(x=>x.length>=2&&!['프로젝트','사업','업무','개발','진행','운영','관련','기타'].includes(x)))]}
function canonicalProjectName(raw,_title,projects){
  const a=norm(raw);if(!a||a==='확인 필요')return '확인 필요';
  const rt=projectTokens(raw);
  for(const p of projects||[]){const name=clean(p.name),n=norm(name);if(name&&a===n)return name}
  let best='',bestScore=0;
  for(const p of projects||[]){
    const name=clean(p.name);if(!name)continue;
    const pt=projectTokens(name);
    const exact=rt.filter(t=>pt.includes(t)).length;
    const coverage=rt.length?exact/rt.length:0;
    const containment=(a.includes(norm(name))||norm(name).includes(a))?2:0;
    const score=exact*2+containment;
    if(exact>=1&&coverage>=0.6&&score>bestScore){best=name;bestScore=score}
  }
  return best||clean(raw)||'확인 필요';
}
function dedupePrimaryTasks(tasks){
  const out=[];
  for(const t of tasks){
    if(!clean(t.title)||!clean(t.owner))continue;
    let merged=null;
    for(const e of out){
      const sameProject=!clean(e.project)||!clean(t.project)||norm(e.project)===norm(t.project);
      if(sameProject&&taskSimilarity(e.title,t.title)>=.72){merged=e;break}
    }
    if(!merged){out.push({...t});continue}
    const owners=[...new Set([...(clean(merged.owner).split(/[,/·]/).map(clean).filter(Boolean)),...(clean(t.owner).split(/[,/·]/).map(clean).filter(Boolean))])];
    merged.owner=owners.join(', ');
    merged.evidence=[clean(merged.evidence),clean(t.evidence)].filter(Boolean).join(' | ');
    merged.sourceIds=[...new Set([...(merged.sourceIds||[]),...(t.sourceIds||[])])];
    if(!clean(merged.dueDate)&&clean(t.dueDate))merged.dueDate=t.dueDate;
  }
  return out;
}
async function syncPrimaryTasks(req,res){
  const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected'});
  const main=await readFile(token,{id:WORK_DOC_ID,mimeType:'application/vnd.google-apps.document',name:'2026년 팀그릿 업무진행'});
  const week=recentMonthSection(main.text||'');
  if(!clean(week.text))return json(res,500,{error:'primary_work_section_not_found'});
  const linked=await primaryLinkedContext(token,week.text);
  const sources=await sheetRows(token,'Sources','A1:O5000'),mainSource=sources.find(s=>clean(s.file_id)===WORK_DOC_ID)||{},validIds=new Set(sources.map(sourceId).filter(Boolean));
  const prompt=`너는 TeamGRIT의 최근 30일 업무를 중앙 Tasks로 동기화하는 에이전트다.
가장 중요한 원칙:
1. 1차 사실 원본은 반드시 "2026년 팀그릿 업무진행"의 최근 30일 구간이다.
2. 문서 구조는 보통 "담당자명 → 프로젝트/대분류 → 그 아래 세부 업무"다. 담당자는 반드시 해당 업무가 실제로 적혀 있는 가장 가까운 담당자명으로 지정한다. 다른 사람의 업무를 섞지 않는다.
3. 연결 Drive 본문은 업무의 세부 내용/프로젝트/근거를 보강하는 용도다. Drive 내용만으로 새로운 담당자를 만들지 않는다.
4. "진행사항" 중 이미 끝났다고 명시된 항목은 새 처리 업무로 만들지 않는다. 아직 진행 중, 추가 확인, 반영, 테스트, 작성, 전달, 검토 등이 남은 경우만 포함한다.
5. "계획사항"은 실행 가능한 단위로 포함한다.
6. 회의/출장 일정은 그 자체를 업무로 만들지 말고, 명시된 준비·확인·후속 조치가 있을 때만 업무로 만든다.
7. 같은 사람이 같은 프로젝트에서 최근 30일 동안 반복해 적은 사실상 동일한 작업은 하나로 합치되, 서로 다른 담당자가 적은 같은 업무는 담당자를 모두 보존한다.
8. 프로젝트는 반드시 해당 담당자 아래의 프로젝트/대분류 소제목을 사용한다. 프로젝트명이 없는 일반 업무는 억지로 기존 프로젝트에 넣지 말고 "확인 필요"로 둔다.
9. 기한은 원문에 명시된 경우만 넣고, 없으면 빈 문자열.
10. sourceIds는 제공된 MAIN_SOURCE 또는 LINKED_DRIVE id만 사용한다.
JSON만 반환: {"tasks":[{"title":string,"project":string,"owner":string,"dueDate":string,"status":"예정"|"진행 중"|"검토 필요"|"승인 대기"|"보류","evidence":string,"sourceIds":[string]}]}.

[RECENT_30_DAY_WORKLOG]
${week.text}

[MAIN_SOURCE]
id=${sourceId(mainSource)||'main_work_doc'}
title=2026년 팀그릿 업무진행
url=https://docs.google.com/document/d/${WORK_DOC_ID}/edit

[LINKED_DRIVE_CONTEXT]
${linked.text||'연결 Drive 본문 없음'}`;
  const canonicalProjects=await central.list(token,'Projects').catch(()=>[]);
  let ai=null,extracted=[],fallbackUsed=false,fallbackReason='';
  const structure=parseWorklogStructure(week.text),deterministic=structure.tasks;
  try{
    ai=await gemini(prompt);
    extracted=arr(ai.data?.tasks).map(t=>({title:clean(t.title),project:clean(t.project),owner:clean(t.owner),dueDate:clean(t.dueDate),status:clean(t.status)||'예정',evidence:clean(t.evidence),sourceIds:arr(t.sourceIds).map(clean).filter(x=>x==='main_work_doc'||validIds.has(x))})).filter(t=>t.title&&t.owner);
  }catch(e){fallbackUsed=true;fallbackReason=String(e?.message||e)}
  const safeAi=extracted.filter(t=>structure.pairs.has(norm(t.owner)+'|'+norm(t.project)));
  if(deterministic.length||safeAi.length){
    extracted=dedupePrimaryTasks([...deterministic,...safeAi]);
  } else {
    fallbackUsed=true;
    extracted=[];
  }
  extracted=extracted.map(t=>({...t,project:canonicalProjectName(t.project,t.title,canonicalProjects)}));
  extracted=dedupePrimaryTasks(extracted);
  if(!extracted.length)return json(res,502,{error:'primary_work_task_extract_empty',week:week.key,fallbackReason});
  const raw=await sheetRows(token,'Tasks','A1:U5000'),existingById=new Map(raw.map(t=>[clean(t.task_id),t])),preserved=raw.filter(t=>clean(t.origin_type)!=='2026년 팀그릿 업무진행'),now=new Date().toISOString(),mainId=sourceId(mainSource)||'main_work_doc';
  const managed=extracted.map(t=>{
    const taskId=taskStableId(week.key,t.owner,t.project,t.title),old=existingById.get(taskId)||{},srcIds=[...new Set([mainId,...t.sourceIds].filter(Boolean))];
    return {task_id:taskId,title:t.title,project:t.project||'확인 필요',owner:t.owner,due_date:t.dueDate||'확인 필요',status:old.status?old.status:phase2.normalizeStatus(t.status),source:'2026년 팀그릿 업무진행 + 연결 Drive',source_url:`https://docs.google.com/document/d/${WORK_DOC_ID}/edit`,source_ids:srcIds.join(','),created_at:old.created_at||now,approved_at:old.approved_at||now,updated_at:now,predecessor_task_ids:old.predecessor_task_ids||'',result_url:old.result_url||'',result_title:old.result_title||'',followup_source_task_id:old.followup_source_task_id||'',followup_generated_statuses:old.followup_generated_statuses||'',review_notification_at:old.review_notification_at||'',origin_type:'2026년 팀그릿 업무진행',origin_detail:`${week.key} · ${t.evidence||'주간 업무내용'}`,origin_id:week.key};
  });
  const all=[...managed,...preserved],headers=phase2.TASK_HEADERS,last=phase2.TASK_LAST_COL;
  await gf(token,`https://sheets.googleapis.com/v4/spreadsheets/${OPS}/values/${encodeURIComponent(`Tasks!A2:${last}5000`)}:clear`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(all.length)await gf(token,`https://sheets.googleapis.com/v4/spreadsheets/${OPS}/values/${encodeURIComponent(`Tasks!A2:${last}${all.length+1}`)}?valueInputOption=RAW`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:all.map(t=>headers.map(h=>t[h]??''))})});
  return json(res,200,{ok:true,week:week.key,count:managed.length,linkedSourceCount:linked.sources.length,modelUsed:ai?.modelUsed||'',fallbackUsed,fallbackReason,tasks:managed});
}

const RESULT_KINDS=new Set(['auto','email','message','document','spreadsheet','presentation','pdf','research','code','image','design','execution']);
function normalizeResultKind(v){const k=clean(v).toLowerCase();return RESULT_KINDS.has(k)?k:'auto'}
function artifactData(v){try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{})}catch{return {}}}
function driveFolderId(v=''){const m=String(v).match(/\/folders\/([A-Za-z0-9_-]+)/);return m?m[1]:''}
async function projectFolderId(token,projectName){if(!clean(projectName))return '';const projects=await central.list(token,'Projects').catch(()=>[]),p=projects.find(x=>norm(x.name)===norm(projectName));return driveFolderId(p?.drive_url||p?.driveUrl||'')}
async function moveToFolder(token,fileId,folderId){if(!fileId||!folderId)return;const meta=await gf(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents`).catch(()=>null),parents=(meta?.parents||[]).join(',');let url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(folderId)}&fields=id,parents`;if(parents)url+=`&removeParents=${encodeURIComponent(parents)}`;await gf(token,url,{method:'PATCH'}).catch(()=>{})}
async function createDoc(token,title,content,folderId=''){const d=await gf(token,'https://docs.googleapis.com/v1/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title||'TeamGRIT 결과물'})});if(content)await gf(token,`https://docs.googleapis.com/v1/documents/${d.documentId}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:[{insertText:{location:{index:1},text:String(content)}}]})});await moveToFolder(token,d.documentId,folderId);return {id:d.documentId,url:`https://docs.google.com/document/d/${d.documentId}/edit`,kind:'document'}}
async function createSheet(token,title,data,folderId=''){const rows=(Array.isArray(data.rows)?data.rows:[]).map(r=>(Array.isArray(r)?r:[r]).map(v=>v==null?'':(typeof v==='object'?JSON.stringify(v):String(v)))),s=await gf(token,'https://sheets.googleapis.com/v4/spreadsheets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({properties:{title:title||'TeamGRIT 결과물'},sheets:[{properties:{title:'결과'}}]})});if(rows.length)await gf(token,`https://sheets.googleapis.com/v4/spreadsheets/${s.spreadsheetId}/values/${encodeURIComponent('결과!A1')}?valueInputOption=RAW`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:rows.map(r=>Array.isArray(r)?r:[r])})});await moveToFolder(token,s.spreadsheetId,folderId);return {id:s.spreadsheetId,url:`https://docs.google.com/spreadsheets/d/${s.spreadsheetId}/edit`,kind:'spreadsheet'}}
function safeObjectId(prefix,i){return (prefix+String(i)+'_'+Date.now().toString(36)).replace(/[^A-Za-z0-9_]/g,'').slice(0,40)}
async function createSlides(token,title,data,folderId=''){const p=await gf(token,'https://slides.googleapis.com/v1/presentations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title||'TeamGRIT 결과물'})}),pid=p.presentationId,existing=(p.slides||[]).map(s=>s.objectId),slides=Array.isArray(data.slides)&&data.slides.length?data.slides:[{title,body:data.content||''}],requests=[];slides.slice(0,20).forEach((s,i)=>{const slideId=safeObjectId('slide',i),titleId=safeObjectId('title',i),bodyId=safeObjectId('body',i);requests.push({createSlide:{objectId:slideId,slideLayoutReference:{predefinedLayout:'BLANK'}}},{createShape:{objectId:titleId,shapeType:'TEXT_BOX',elementProperties:{pageObjectId:slideId,size:{width:{magnitude:640,unit:'PT'},height:{magnitude:60,unit:'PT'}},transform:{scaleX:1,scaleY:1,translateX:40,translateY:35,unit:'PT'}}}},{insertText:{objectId:titleId,text:clean(s.title)||`Slide ${i+1}`}},{createShape:{objectId:bodyId,shapeType:'TEXT_BOX',elementProperties:{pageObjectId:slideId,size:{width:{magnitude:640,unit:'PT'},height:{magnitude:360,unit:'PT'}},transform:{scaleX:1,scaleY:1,translateX:40,translateY:115,unit:'PT'}}}},{insertText:{objectId:bodyId,text:clean(s.body||s.content)}})});for(const id of existing)requests.push({deleteObject:{objectId:id}});if(requests.length)await gf(token,`https://slides.googleapis.com/v1/presentations/${pid}:batchUpdate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests})});await moveToFolder(token,pid,folderId);return {id:pid,url:`https://docs.google.com/presentation/d/${pid}/edit`,kind:'presentation'}}
async function materializeResult(token,r){const kind=normalizeResultKind(r.artifact_kind),data=artifactData(r.artifact_data),folderId=await projectFolderId(token,r.project_id),title=clean(r.title)||'TeamGRIT 결과물';if(kind==='document'||kind==='research'){const f=await createDoc(token,title,r.content,folderId);return {...f,status:'파일 생성 완료'}}if(kind==='spreadsheet'){const f=await createSheet(token,title,data,folderId);return {...f,status:'파일 생성 완료'}}if(kind==='presentation'){const f=await createSlides(token,title,{...data,content:r.content},folderId);return {...f,status:'파일 생성 완료'}}if(kind==='pdf'){const f=await createDoc(token,title,r.content,folderId);return {...f,url:`https://docs.google.com/document/d/${f.id}/export?format=pdf`,kind:'pdf',status:'PDF 링크 생성 완료'}}if(kind==='email'||kind==='message')return {kind,status:'발송 전 확정 초안'};if(kind==='code')return {kind,status:'코드 초안 확정 · GitHub 실행 연결 필요'};if(kind==='image'||kind==='design')return {kind,status:'이미지/디자인 브리프 확정 · 생성 실행 연결 필요'};if(kind==='execution')return {kind,status:'실행 결과 형식 확정 · 별도 실행 필요'};return {kind:kind||'document',status:'초안 확정'}}
function resultPrompt(task,ctx,preferredKind='auto',sourceBodies='',instruction='',priorResults=''){return `너는 TeamGRIT 실무 결과물 에이전트다. 업무를 보고 결과물 유형을 판단하고 실제 업무에서 바로 검토·사용할 수 있는 수준으로 완성도 높은 초안을 만든다. preferredKind가 auto가 아니면 그 유형을 우선한다.
허용 kind: email, message, document, spreadsheet, presentation, pdf, research, code, image, design, execution.
- email/message: 바로 보낼 수 있는 본문. 수신자/사실이 없으면 [확인 필요].
- document/research/pdf: 제목과 완성된 본문을 작성한다. 개요만 쓰지 말고 실제 전달 가능한 문장과 표/체크 항목까지 포함한다.
- spreadsheet: content에는 이 표의 목적과 사용법을 짧게 설명하고, artifactData.rows에는 반드시 헤더 행을 포함한 2차원 배열을 넣는다. 컬럼은 실제 업무 수행에 필요한 필드로 구성하고 빈 정보는 [확인 필요]로 둔다.
- presentation: content에는 발표 목적과 흐름을 정리하고, artifactData.slides에는 최소 5장 이상 [{"title":string,"body":string}] 배열을 넣는다. 각 슬라이드는 제목+핵심 bullet 3~5개 수준으로 작성한다.
- code: content에는 변경 목적·영향·검증 방법을 포함하고 artifactData에는 {"language":string,"filename":string,"code":string}.
- image/design: content에는 실제 제작 가능한 디자인 브리프를 작성하고 artifactData에는 {"prompt":string,"aspectRatio":string,"requirements":[string]}. 현재 시스템에서는 이미지 파일 자체를 생성하지 않으므로 반드시 executorStatus가 '이미지 생성기 연결 필요'로 이해될 수 있게 구체적으로 작성한다.
- execution: content에는 실행 결과로 확인해야 할 체크리스트와 성공 기준.
원문과 중앙 근거에 없는 사실, 일정, 담당자, 수치, 확정사항은 만들지 말고 [확인 필요]로 표시한다.
JSON만 반환한다. 형식: {"kind":string,"type":string,"title":string,"content":string,"summary":string,"artifactData":object}.

[선호 유형]
${preferredKind}

[사용자 추가 지시]
${instruction||'추가 지시 없음'}

[업무]
업무명: ${clean(task.title)}
프로젝트: ${clean(task.project)}
담당자: ${clean(task.owner)}
기한: ${clean(task.due_date)}
상태: ${clean(task.status)}
출처: ${clean(task.source)}
출처 링크: ${clean(task.source_url)}
선행 업무: ${clean(task.predecessor_task_ids)}

[관련 중앙 근거]
${ctx.focused.text}

[관련 Drive 원문 본문]
${sourceBodies||'직접 읽은 원문 본문 없음'}

[기존 관련 결과물]
${priorResults||'기존 관련 결과물 없음'}`}
async function generateResult(req,res){const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected'});const b=await readBody(req),taskId=clean(b.task_id||b.id),preferredKind=normalizeResultKind(b.kind||'auto');if(!taskId)return json(res,400,{error:'task_id_required'});const task=await taskById(token,taskId);if(!task)return json(res,404,{error:'task_not_found'});const instruction=clean(b.instruction),ctx=await context(token,[task.title,task.project,task.source,instruction].join(' ')),detail=await detailedSourceContext(token,task,ctx),prior=(await central.list(token,'Results').catch(()=>[])).filter(r=>clean(r.project_id)===clean(task.project)||clean(r.task_id)===taskId).slice(-6).map(r=>`[RESULT] ${clean(r.title)} | ${clean(r.type)}\n${clean(r.content).slice(0,5000)}`).join('\n\n');const ai=await gemini(resultPrompt(task,ctx,preferredKind,detail.text,instruction,prior));const d=ai.data||{},kind=normalizeResultKind(d.kind||preferredKind)==='auto'?'document':normalizeResultKind(d.kind||preferredKind),type=clean(d.type)||kind,title=clean(d.title)||`${clean(task.title)} 결과물 초안`,content=clean(d.content),summary=clean(d.summary),artifact=d.artifactData||{};if(!content&&!Object.keys(artifact).length)return json(res,500,{error:'result_generation_empty'});let result=central.result({projectId:clean(task.project),taskId,type,title,fileUrl:'',status:'초안',content,reviewStatus:'검토 대기',sourceTaskId:taskId,artifactKind:kind,artifactData:artifact,executorStatus:'검토 대기'});const fileKinds=new Set(['document','research','spreadsheet','presentation','pdf']);if(fileKinds.has(kind)){try{const materialized=await materializeResult(token,result);result={...result,file_url:materialized.url||'',executor_status:materialized.status||'초안 파일 생성 완료'};}catch(e){const msg=String(e?.message||e).slice(0,300);result={...result,executor_status:'파일 생성 실패: '+msg};}}else if(kind==='image'||kind==='design'){result={...result,executor_status:'이미지 생성기 연결 필요'};}else if(kind==='code'){result={...result,executor_status:'코드 실행기 연결 필요'};}await central.append(token,'Results',[result]);const requestedBy=await central.userEmail(token),review=central.reviewRequest({targetType:'Result',targetId:result.result_id,taskId,project:clean(task.project),title,status:'검토 대기',requestedBy,note:summary});await central.append(token,'ReviewRequests',[review]);return json(res,200,{ok:true,result,review,modelUsed:ai.modelUsed,kind,sourceBodyCount:detail.used,fileError:/^파일 생성 실패/.test(result.executor_status||'')?result.executor_status:''});}
async function projectHistory(req,res){
  const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected'});
  const u=new URL(req.url,`https://${req.headers.host}`),project=clean(u.searchParams.get('project'));if(!project)return json(res,400,{error:'project_required'});
  const main=await readFile(token,{id:WORK_DOC_ID,mimeType:'application/vnd.google-apps.document',name:'2026년 팀그릿 업무진행'});
  const all=parseAllWorklogHistory(main.text||'').filter(t=>projectEquivalent(t.project,project));
  const [stored,sources]=await Promise.all([central.list(token,'Tasks').catch(()=>[]),sheetRows(token,'Sources','A1:O5000').catch(()=>[])]);
  const sourceMap=new Map(sources.map(s=>[sourceId(s),{title:sourceTitle(s),url:clean(s.url)}]));
  const enriched=all.map((t,idx)=>{
    const match=stored.find(x=>projectEquivalent(x.project,t.project)&&norm(x.owner)===norm(t.owner)&&taskSimilarity(x.title,t.title)>=.72);
    const links=[{label:'업무 진행 원문',url:`https://docs.google.com/document/d/${WORK_DOC_ID}/edit`,kind:'source'}];
    if(match?.source_url)links.push({label:'연결 원본',url:clean(match.source_url),kind:'source'});
    if(match?.result_url)links.push({label:clean(match.result_title)||'결과물',url:clean(match.result_url),kind:'result'});
    for(const id of String(match?.source_ids||'').split(/[\s,;|]+/).filter(Boolean)){const s=sourceMap.get(id);if(s?.url)links.push({label:s.title||'연결 자료',url:s.url,kind:'source'})}
    const uniq=[...new Map(links.filter(x=>x.url).map(x=>[x.url,x])).values()];
    return {...t,id:`hist_${idx}_${central.id('h',t.period+'|'+t.owner+'|'+t.project+'|'+t.title)}`,links:uniq};
  });
  return json(res,200,{project,count:enriched.length,tasks:enriched});
}
async function listReviews(req,res){const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected'});const [results,reviews]=await Promise.all([central.list(token,'Results'),central.list(token,'ReviewRequests')]);const visible=results.filter(r=>['검토 대기','수정 필요'].includes(clean(r.review_status))||((clean(r.artifact_kind)==='image'||clean(r.artifact_kind)==='design')&&clean(r.review_status)==='승인됨')).sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));return json(res,200,{results:visible,reviews,allResults:results});}

function driveFileIdFromUrl(v=''){for(const re of [/\/document\/d\/([A-Za-z0-9_-]+)/,/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/,/\/presentation\/d\/([A-Za-z0-9_-]+)/,/\/file\/d\/([A-Za-z0-9_-]+)/,/id=([A-Za-z0-9_-]+)/]){const m=String(v).match(re);if(m)return m[1]}return ''}
async function deleteResult(req,res){
  const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected'});
  const b=await readBody(req),resultId=clean(b.result_id||b.id);if(!resultId)return json(res,400,{error:'result_id_required'});
  const results=await central.list(token,'Results'),idx=results.findIndex(r=>clean(r.result_id)===resultId);if(idx<0)return json(res,404,{error:'result_not_found'});
  const r=results[idx];if(clean(r.review_status)==='승인됨'||clean(r.status)==='완료')return json(res,409,{error:'approved_result_cannot_be_deleted'});
  const fileId=driveFileIdFromUrl(r.file_url);if(fileId)await gf(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,{method:'DELETE'}).catch(()=>{});
  results.splice(idx,1);await central.replace(token,'Results',results);
  const reviews=await central.list(token,'ReviewRequests'),kept=reviews.filter(x=>clean(x.target_id)!==resultId);if(kept.length!==reviews.length)await central.replace(token,'ReviewRequests',kept);
  return json(res,200,{ok:true,deleted:resultId});
}
async function reviewResult(req,res){const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected'});const b=await readBody(req),resultId=clean(b.result_id||b.id),action=clean(b.action);if(!resultId)return json(res,400,{error:'result_id_required'});const results=await central.list(token,'Results'),idx=results.findIndex(r=>clean(r.result_id)===resultId);if(idx<0)return json(res,404,{error:'result_not_found'});const now=new Date().toISOString(),reviewer=await central.userEmail(token),r={...results[idx]};if(b.content!==undefined)r.content=String(b.content);if(b.title!==undefined)r.title=clean(b.title);if(b.artifactData!==undefined)r.artifact_data=typeof b.artifactData==='string'?b.artifactData:JSON.stringify(b.artifactData||{});r.updated_at=now;let materialized=null;if(action==='approve'){materialized=clean(r.file_url)?{kind:clean(r.artifact_kind),url:clean(r.file_url),status:'초안 파일 승인·확정'}:await materializeResult(token,r);r.review_status='승인됨';r.status='완료';r.approved_by=reviewer;r.approved_at=now;r.executor_status=materialized.status||'확정';if(materialized.url)r.file_url=materialized.url}else if(action==='request_changes'){r.review_status='수정 필요';r.status='초안';r.executor_status='수정 대기'}else return json(res,400,{error:'invalid_review_action'});results[idx]=r;await central.replace(token,'Results',results);const reviews=await central.list(token,'ReviewRequests'),ri=reviews.findIndex(x=>clean(x.target_id)===resultId&&['검토 대기','수정 필요'].includes(clean(x.status)));if(ri>=0){reviews[ri]={...reviews[ri],status:action==='approve'?'승인됨':'수정 필요',reviewed_by:reviewer,reviewed_at:now,note:clean(b.note)||reviews[ri].note};await central.replace(token,'ReviewRequests',reviews)}if(action==='approve'){const approval=central.approval({targetType:'Result',targetId:resultId,action:'결과물 승인·확정',approvedBy:reviewer,source:'앱 내부 검토함',note:`${clean(r.title)} · ${clean(r.artifact_kind)}`});await central.append(token,'Approvals',[approval])}return json(res,200,{ok:true,result:r,materialized});}

module.exports=async(req,res)=>{try{const u=new URL(req.url,`https://${req.headers.host}`),action=u.searchParams.get('action');if(req.method==='POST'&&action==='analyze')return await analyze(req,res);if(req.method==='POST'&&action==='sync-primary')return await syncPrimaryTasks(req,res);if(req.method==='POST'&&action==='generate-result')return await generateResult(req,res);if(req.method==='GET'&&action==='project-history')return await projectHistory(req,res);if(req.method==='GET'&&action==='reviews')return await listReviews(req,res);if(req.method==='POST'&&action==='review-result')return await reviewResult(req,res);if(req.method==='POST'&&action==='delete-result')return await deleteResult(req,res);return base(req,res)}catch(e){return json(res,500,{error:e.message,connection:'연결 안 됨'})}};
