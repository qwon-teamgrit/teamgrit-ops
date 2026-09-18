require('./_lib/gemini-model-compat')();
const original=require('./data-all');
const central=require('./_lib/central-entities');
const {gemini,clean,arr}=require('./_lib/source-corpus-all');

const OPS=central.OPS_SHEET_ID;
function parseCookies(req){const out={};String(req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>-1)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return out}
async function refresh(rt){const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:rt,grant_type:'refresh_token'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params});if(!r.ok)throw new Error('Google token refresh failed');return r.json()}
async function access(req){const c=parseCookies(req);if(c.g_access)return c.g_access;if(!c.g_refresh)return null;return (await refresh(c.g_refresh)).access_token}
async function body(req){let s='';for await(const c of req)s+=c;try{return JSON.parse(s||'{}')}catch{return {}}}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data))}
function fakeResponse(){const headers={};return {statusCode:200,body:'',headers,setHeader(k,v){headers[k]=v},end(v){this.body=v==null?'':String(v)}}}
async function gf(token,url,opts={}){const r=await fetch(url,{...opts,headers:{Authorization:'Bearer '+token,...(opts.headers||{})}});if(!r.ok)throw new Error('Google API '+r.status+': '+(await r.text()).slice(0,400));if(r.status===204)return null;return (r.headers.get('content-type')||'').includes('json')?r.json():r.text()}
async function sheetRows(token,name,range='A1:Z5000'){const d=await gf(token,'https://sheets.googleapis.com/v4/spreadsheets/'+OPS+'/values/'+encodeURIComponent(name+'!'+range)).catch(()=>({values:[]})),rows=d.values||[];if(rows.length<2)return[];const h=rows[0];return rows.slice(1).filter(r=>r.some(v=>clean(v))).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]??'');return o})}
function norm(v=''){return clean(v).toLowerCase().replace(/[^a-z0-9가-힣]+/g,' ').replace(/\s+/g,' ').trim()}
function ids(v){return [...new Set(String(v||'').split(/[\s,;|]+/).map(clean).filter(Boolean))]}
function sourceDocs(sourceIds,sources){const set=new Set(ids(sourceIds));return sources.filter(s=>set.has(clean(s.source_id))).map(s=>clean(s.title)+(clean(s.url)?' · '+clean(s.url):'')).join(' | ')}
function factKey(projectId,featureName){return clean(projectId)+'|'+norm(featureName)}
function changed(candidate,fact){if(!fact)return true;return norm(candidate.description)!==norm(fact.description||fact.fact)||norm(candidate.development_status)!==norm(fact.development_status)||norm(candidate.applied_entities)!==norm(fact.applied_entities)||norm(candidate.evidence_docs)!==norm(fact.evidence_docs)}
async function devSiteSnapshot(){const url=process.env.COBIZ_DEV_SITE_URL||'https://dev.cobiz.kr/';try{const r=await fetch(url,{headers:{'User-Agent':'TeamGRIT-Ops/1.0'}});if(!r.ok)throw new Error('HTTP '+r.status);const html=await r.text(),text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,250000);return {ok:true,url,text}}catch(e){return {ok:false,url,text:'',error:String(e?.message||e)}}}
function devSiteCheck(featureName,s){if(!s.ok)return {status:'확인 필요',evidence:'개발 사이트 확인 실패: '+s.error};const name=norm(featureName),hay=norm(s.text);if(name&&hay.includes(name))return {status:'일치',evidence:s.url+'에서 기능명 확인'};const ts=name.split(' ').filter(x=>x.length>=2),hits=ts.filter(t=>hay.includes(t));if(ts.length&&hits.length>=Math.min(2,ts.length))return {status:'일치 가능',evidence:s.url+'에서 관련 키워드 확인: '+hits.join(', ')};return {status:'확인 필요',evidence:s.url+'에서 기능명/관련 키워드를 충분히 확인하지 못함'}}
async function phase3List(token){const x=await central.listMany(token,['ProductFacts','FactCandidates','MarketingCandidates','MarketingDrafts']);return {facts:x.ProductFacts||[],candidates:x.FactCandidates||[],marketing:x.MarketingCandidates||[],drafts:x.MarketingDrafts||[]}}
async function scanFacts(token){
  const [projects,features,sources,facts,existingCandidates]=await Promise.all([sheetRows(token,'Projects'),sheetRows(token,'Features'),sheetRows(token,'Sources'),central.list(token,'ProductFacts'),central.list(token,'FactCandidates')]);
  const cobizProjects=projects.filter(p=>/cobiz/i.test(clean(p.name))),pids=new Set(cobizProjects.map(p=>clean(p.project_id))),pmap=new Map(cobizProjects.map(p=>[clean(p.project_id),p]));
  const approved=new Map(facts.filter(f=>clean(f.verification_status)==='승인됨').map(f=>[factKey(f.project_id,f.feature_name||String(f.subject||'').replace(/^기능\s*·\s*/,'')),f]));
  const old=new Map(existingCandidates.map(c=>[clean(c.candidate_id),c])),site=await devSiteSnapshot(),now=new Date().toISOString(),next=[];
  for(const f of features.filter(x=>pids.has(clean(x.project_id)))){
    const p=pmap.get(clean(f.project_id)),name=clean(f.name);if(!name)continue;
    const fid=central.id('fact',clean(f.project_id)+'|feature|'+name),cid=central.id('factcand',clean(f.project_id)+'|'+name+'|'+clean(f.last_synced_at||f.description)),prev=approved.get(factKey(f.project_id,name)),check=devSiteCheck(name,site);
    const cand={candidate_id:cid,fact_id:fid,project_id:clean(f.project_id),feature_name:name,description:clean(f.description)||name,applied_entities:[clean(p?.name),clean(p?.customer)].filter(Boolean).join(' · '),development_status:clean(f.status)||'확인 필요',evidence_docs:sourceDocs(f.source_ids,sources),source_ids:clean(f.source_ids),evidence:clean(p?.source_evidence)||clean(f.description),change_type:prev?(changed({description:f.description,development_status:f.status,applied_entities:[p?.name,p?.customer].filter(Boolean).join(' · '),evidence_docs:sourceDocs(f.source_ids,sources)},prev)?'변경':'동일'):'신규',dev_site_status:check.status,dev_site_evidence:check.evidence,status:check.status==='확인 필요'?'확인 필요':'검토 대기',created_at:old.get(cid)?.created_at||now,reviewed_by:old.get(cid)?.reviewed_by||'',reviewed_at:old.get(cid)?.reviewed_at||'',public_status:old.get(cid)?.public_status||'검토 필요'};
    if(cand.change_type!=='동일'&&clean(old.get(cid)?.status)!=='승인됨')next.push(cand);
  }
  const keep=existingCandidates.filter(c=>clean(c.status)==='승인됨'||!next.some(n=>n.candidate_id===c.candidate_id));await central.replace(token,'FactCandidates',[...keep,...next]);
  return {candidates:next,cobizProjectCount:cobizProjects.length,devSite:site.ok?{url:site.url,status:'확인됨'}:{url:site.url,status:'확인 필요',error:site.error}};
}
async function approveFact(token,b){
  const rows=await central.list(token,'FactCandidates'),i=rows.findIndex(x=>clean(x.candidate_id)===clean(b.candidate_id));if(i<0)throw new Error('fact_candidate_not_found');
  const c=rows[i],reviewer=await central.userEmail(token),now=new Date().toISOString(),publicStatus=clean(b.public_status)||clean(c.public_status)||'검토 필요',fact={fact_id:clean(c.fact_id)||central.id('fact',clean(c.project_id)+'|feature|'+clean(c.feature_name)),project_id:clean(c.project_id),subject:'기능 · '+clean(c.feature_name),fact:clean(c.description),source_ids:clean(c.source_ids),evidence:clean(c.evidence),verification_status:'승인됨',last_synced_at:now,feature_name:clean(c.feature_name),description:clean(c.description),applied_entities:clean(c.applied_entities),development_status:clean(c.development_status),evidence_docs:clean(c.evidence_docs),verified_by:reviewer,verified_at:now,public_status:publicStatus};
  const facts=await central.list(token,'ProductFacts'),fi=facts.findIndex(f=>clean(f.fact_id)===fact.fact_id);if(fi>=0)facts[fi]=fact;else facts.push(fact);await central.replace(token,'ProductFacts',facts);
  rows[i]={...c,status:'승인됨',reviewed_by:reviewer,reviewed_at:now,public_status:publicStatus};await central.replace(token,'FactCandidates',rows);await central.append(token,'Approvals',[central.approval({targetType:'ProductFact',targetId:fact.fact_id,action:'제품 근거 승인',approvedBy:reviewer,source:'3차 제품 근거 검토',note:fact.feature_name+' · '+publicStatus})]);return {fact,candidate:rows[i]}
}
function weekKey(){const d=new Date(),a=new Date(d.getFullYear(),0,1),w=Math.ceil((((d-a)/86400000)+a.getDay()+1)/7);return d.getFullYear()+'-W'+String(w).padStart(2,'0')}
async function generateMarketing(token){
  const [facts,projects,sources,existing]=await Promise.all([
    central.list(token,'ProductFacts'),
    sheetRows(token,'Projects'),
    sheetRows(token,'Sources'),
    central.list(token,'MarketingCandidates')
  ]);
  const cutoff=Date.now()-30*24*60*60*1000;
  const sourceModified=new Map(sources.map(s=>[clean(s.source_id),Date.parse(clean(s.modified_time))||0]));
  const recentSourceIds=raw=>ids(raw).filter(id=>(sourceModified.get(id)||0)>=cutoff);
  const hasRecentSource=raw=>recentSourceIds(raw).length>0;

  const approved=facts.filter(f=>clean(f.verification_status)==='승인됨'&&clean(f.public_status)!=='비공개'&&hasRecentSource(f.source_ids));
  const recentProjects=projects.filter(p=>hasRecentSource(p.source_ids));
  const completed=recentProjects.filter(p=>/완료|납품|검수 완료|종료/i.test(clean(p.manual_status||p.source_status)));
  const eventProjects=recentProjects.filter(p=>{
    const category=clean(p.manual_category||p.source_category),name=clean(p.name),status=clean(p.manual_status||p.source_status);
    return /행사|마케팅|전시|워크숍|세미나|챌린지|로봇쇼|컨퍼런스|박람회|시연|방문|poc/i.test(category+' '+name)
      && !/취소|폐기|중단/i.test(status)
      && clean(p.source_ids||p.source_evidence);
  });
  const eligibleProjects=[...new Map([...completed,...eventProjects].map(p=>[clean(p.project_id),p])).values()];
  if(!approved.length&&!eligibleProjects.length)throw new Error('recent_30d_approved_facts_or_marketing_projects_required');

  const prompt=[
    '너는 TeamGRIT B2B 로봇/AI 마케팅 기획자다.',
    '검토 범위는 최근 30일 이내에 실제로 수정된 원본 자료로 제한한다. 아래 목록은 이미 최근 30일 필터를 통과한 자료만 제공된다.',
    '이번 주 홍보 소재는 기술/제품 업데이트뿐 아니라 행사·전시·워크숍·시연·고객 방문·PoC 진행·프로젝트 완료 같은 이벤트성 소식도 포함할 수 있다.',
    '행사/프로젝트가 예정 또는 진행 중이면 완료 성과처럼 표현하지 말고 현재 상태를 그대로 쓴다.',
    '제공되지 않은 성능 수치, 고객 성과, 일정, 참가 확정, 인용문은 만들지 않는다.',
    '사진, 행사 일정 최종 확인, 고객명 공개 동의, 수치 등이 필요하면 requiredAssets 또는 missingChecks에 명시한다.',
    '기술 소재와 이벤트 소재가 한쪽으로 치우치지 않도록 최대 8개 제안한다.',
    'factIds/projectIds에는 제공된 ID만 사용한다.',
    'JSON만 반환: {"candidates":[{"title":string,"angle":string,"factIds":[string],"projectIds":[string],"rationale":string,"requiredAssets":[string],"missingChecks":[string]}]}.',
    '',
    '[최근 30일 내 승인된 제품 사실]',
    ...approved.slice(0,80).map(f=>'[FACT '+f.fact_id+'] '+(f.feature_name||f.subject)+' | '+(f.description||f.fact)+' | 적용:'+f.applied_entities+' | 개발:'+f.development_status+' | 공개:'+f.public_status),
    '',
    '[최근 30일 내 홍보 가능한 프로젝트·이벤트]',
    ...eligibleProjects.slice(0,80).map(p=>'[PROJECT '+p.project_id+'] '+p.name+' | 분류:'+(p.manual_category||p.source_category)+' | 대상:'+p.customer+' | '+p.summary+' | 상태:'+(p.manual_status||p.source_status)+' | 근거:'+p.source_evidence)
  ].join('\n');

  const ai=await gemini(prompt),vf=new Set(approved.map(f=>clean(f.fact_id))),vp=new Set(eligibleProjects.map(p=>clean(p.project_id))),now=new Date().toISOString(),wk=weekKey(),
    rows=arr(ai.data?.candidates).map(x=>{const fs=arr(x.factIds).map(clean).filter(id=>vf.has(id)),ps=arr(x.projectIds).map(clean).filter(id=>vp.has(id));return {content_id:central.id('content',wk+'|'+clean(x.title)+'|'+fs.join(',')+'|'+ps.join(',')),week_key:wk,title:clean(x.title),angle:clean(x.angle),source_fact_ids:fs.join(','),source_project_ids:ps.join(','),rationale:clean(x.rationale),required_assets:arr(x.requiredAssets).map(clean).filter(Boolean).join(' | '),missing_checks:arr(x.missingChecks).map(clean).filter(Boolean).join(' | '),status:'후보',created_at:now,approved_by:'',approved_at:''}}).filter(x=>x.title&&(x.source_fact_ids||x.source_project_ids));
  await central.replace(token,'MarketingCandidates',[...existing.filter(e=>clean(e.week_key)!==wk||clean(e.status)==='승인됨'),...rows]);
  return {week:wk,candidates:rows,modelUsed:ai.modelUsed,approvedFacts:approved.length,completedProjects:completed.length,eventProjects:eventProjects.length,windowDays:30}
}
async function approveMarketing(token,b){const rows=await central.list(token,'MarketingCandidates'),i=rows.findIndex(x=>clean(x.content_id)===clean(b.content_id));if(i<0)throw new Error('marketing_candidate_not_found');const reviewer=await central.userEmail(token),now=new Date().toISOString();rows[i]={...rows[i],status:'승인됨',approved_by:reviewer,approved_at:now};await central.replace(token,'MarketingCandidates',rows);await central.append(token,'Approvals',[central.approval({targetType:'MarketingCandidate',targetId:rows[i].content_id,action:'홍보 소재 승인',approvedBy:reviewer,source:'3차 마케팅 검토',note:rows[i].title})]);return rows[i]}
async function generateDrafts(token,b){
  const [candidates,facts,projects,sources,existing]=await Promise.all([
    central.list(token,'MarketingCandidates'),
    central.list(token,'ProductFacts'),
    sheetRows(token,'Projects'),
    sheetRows(token,'Sources'),
    central.list(token,'MarketingDrafts')
  ]);
  const c=candidates.find(x=>clean(x.content_id)===clean(b.content_id));if(!c||clean(c.status)!=='승인됨')throw new Error('approved_marketing_candidate_required');
  const cutoff=Date.now()-30*24*60*60*1000,sourceModified=new Map(sources.map(s=>[clean(s.source_id),Date.parse(clean(s.modified_time))||0])),hasRecentSource=raw=>ids(raw).some(id=>(sourceModified.get(id)||0)>=cutoff);
  const fs=new Set(ids(c.source_fact_ids)),ps=new Set(ids(c.source_project_ids)),
    selectedFacts=facts.filter(f=>fs.has(clean(f.fact_id))&&clean(f.verification_status)==='승인됨'&&hasRecentSource(f.source_ids)),
    selectedProjects=projects.filter(p=>ps.has(clean(p.project_id))&&hasRecentSource(p.source_ids));
  if(!selectedFacts.length&&!selectedProjects.length)throw new Error('selected_sources_are_older_than_30_days');

  const channels=arr(b.channels).length?arr(b.channels):[
    '홈페이지',
    'SNS 짧은글 KR',
    'SNS 짧은글 EN',
    '블로그/Medium KR',
    '블로그/Medium EN',
    '보도자료'
  ];

  const prompt=[
    '너는 TeamGRIT의 시니어 B2B 테크 마케터이자 편집자다.',
    '목표는 초안 수준이 아니라, 사실 확인 항목만 채우면 바로 게시 가능한 완성도 높은 원고를 만드는 것이다.',
    '아래 소재와 최근 30일 내 승인된 사실/프로젝트·이벤트만 사용한다. 예정/진행 중 이벤트를 완료된 성과처럼 표현하지 않는다.',
    '없는 숫자, 고객 코멘트, 성능, 일정, 파트너 발언, 계약/수주 사실을 절대 만들지 않는다.',
    '문장은 자연스럽고 전문적이어야 하며, 반복적인 AI 문구와 과장 표현을 피한다. TeamGRIT의 제품/프로젝트 맥락이 독자가 이해할 수 있도록 배경-핵심 내용-의미-다음 단계가 연결되게 작성한다.',
    '',
    '[채널별 작성 기준]',
    '- 홈페이지: 한국어 1,200~1,800자. 제목 + 2~4문장 리드 + 본문 3~5개 단락 + 핵심 포인트 3개 + CTA 1개. 기업 홈페이지 뉴스/인사이트에 바로 게시 가능한 톤.',
    '- SNS 짧은글 KR: 한국어 500~900자. Instagram/Facebook/LinkedIn 공용. 첫 2문장에 훅, 본문 3~5개 짧은 단락, 마지막 CTA, 해시태그 5~8개 포함.',
    '- SNS 짧은글 EN: 영어 180~300 words. Instagram/Facebook/LinkedIn 공용. 자연스러운 B2B English, hook + concise body + CTA + 5~8 hashtags.',
    '- 블로그/Medium KR: 한국어 1,800~3,000자. 제목, 리드, 소제목 3~5개, 맥락/기술 또는 현장 의미/적용 사례/다음 단계까지 포함. 단순 보도문이 아니라 읽을 가치가 있는 장문 아티클.',
    '- 블로그/Medium EN: 영어 900~1,400 words. Native-level B2B technology article. Title, dek, 4~6 section headings, context, technical or operational meaning, application, next steps, closing CTA.',
    '- 보도자료: 한국어 2,200~3,500자. 제목, 부제, 리드문, 본문, 회사 소개/배경, 향후 계획 순서. 날짜/장소/인용문이 자료에 없으면 만들지 말고 missingChecks로 남긴다.',
    '',
    '각 결과물은 해당 채널의 권장 길이를 실제로 채운다. 지나치게 짧은 요약문을 반환하지 않는다.',
    '필요한 사진, 캡처, 현장 이미지, 로고, 도표는 requiredAssets에 구체적으로 적는다.',
    '게시 전 확인해야 할 고객명 공개, 정확한 일정, 수치, 파트너 표기, 행사명 등은 missingChecks에 적는다.',
    '본문 안에는 [확인 필요] 같은 메모를 삽입하지 말고, 본문은 읽을 수 있는 완성본으로 작성하며 불확실한 사실 자체를 제외한다.',
    'JSON만 반환: {"drafts":[{"channel":string,"title":string,"body":string,"requiredAssets":[string],"missingChecks":[string]}]}.',
    '',
    '[생성 채널] '+channels.join(', '),
    '[승인 소재] '+c.title+' | '+c.angle+' | '+c.rationale,
    '[최근 30일 내 승인 사실]',
    ...selectedFacts.map(f=>'- '+(f.feature_name||f.subject)+': '+(f.description||f.fact)+' | 적용:'+f.applied_entities+' | 개발:'+f.development_status+' | 근거:'+f.evidence_docs),
    '[최근 30일 내 연결 프로젝트·이벤트]',
    ...selectedProjects.map(p=>'- '+p.name+' | 분류:'+(p.manual_category||p.source_category)+' | 대상:'+p.customer+' | 상태:'+(p.manual_status||p.source_status)+' | '+p.summary+' | 근거:'+p.source_evidence),
    '[기존 확인 필요] '+(c.missing_checks||'없음'),
    '[필요 소재] '+(c.required_assets||'없음')
  ].join('\n');

  const ai=await gemini(prompt),now=new Date().toISOString(),rows=arr(ai.data?.drafts).filter(x=>channels.includes(clean(x.channel))).map(x=>({
    draft_id:central.id('draft',clean(c.content_id)+'|'+clean(x.channel)+'|'+now),
    content_id:clean(c.content_id),channel:clean(x.channel),title:clean(x.title),body:String(x.body||'').trim(),
    required_assets:arr(x.requiredAssets).map(clean).filter(Boolean).join(' | '),
    missing_checks:arr(x.missingChecks).map(clean).filter(Boolean).join(' | '),
    status:'초안',created_at:now,approved_by:'',approved_at:''
  }));
  await central.replace(token,'MarketingDrafts',[...existing.filter(d=>clean(d.content_id)!==clean(c.content_id)),...rows]);
  return {drafts:rows,modelUsed:ai.modelUsed,windowDays:30}
}
async function approveDraft(token,b){const rows=await central.list(token,'MarketingDrafts'),i=rows.findIndex(x=>clean(x.draft_id)===clean(b.draft_id));if(i<0)throw new Error('marketing_draft_not_found');const reviewer=await central.userEmail(token),now=new Date().toISOString();rows[i]={...rows[i],status:'승인됨',approved_by:reviewer,approved_at:now};await central.replace(token,'MarketingDrafts',rows);await central.append(token,'Approvals',[central.approval({targetType:'MarketingDraft',targetId:rows[i].draft_id,action:'채널 초안 승인',approvedBy:reviewer,source:'3차 마케팅 검토',note:rows[i].channel+' · '+rows[i].title})]);return rows[i]}
async function deleteMarketingCandidate(token,b){
  const id=clean(b.content_id);if(!id)throw new Error('content_id_required');
  const [rows,drafts,approvals]=await Promise.all([central.list(token,'MarketingCandidates'),central.list(token,'MarketingDrafts'),central.list(token,'Approvals')]);
  const found=rows.find(x=>clean(x.content_id)===id);if(!found)throw new Error('marketing_candidate_not_found');
  await central.replace(token,'MarketingCandidates',rows.filter(x=>clean(x.content_id)!==id));
  await central.replace(token,'MarketingDrafts',drafts.filter(x=>clean(x.content_id)!==id));
  await central.replace(token,'Approvals',approvals.filter(x=>!(clean(x.target_type)==='MarketingCandidate'&&clean(x.target_id)===id)&&!(clean(x.target_type)==='MarketingDraft'&&drafts.some(d=>clean(d.content_id)===id&&clean(d.draft_id)===clean(x.target_id)))));
  return {deleted:id,title:found.title}
}
async function deleteMarketingDraft(token,b){
  const id=clean(b.draft_id);if(!id)throw new Error('draft_id_required');
  const [rows,approvals]=await Promise.all([central.list(token,'MarketingDrafts'),central.list(token,'Approvals')]);
  const found=rows.find(x=>clean(x.draft_id)===id);if(!found)throw new Error('marketing_draft_not_found');
  await central.replace(token,'MarketingDrafts',rows.filter(x=>clean(x.draft_id)!==id));
  await central.replace(token,'Approvals',approvals.filter(x=>!(clean(x.target_type)==='MarketingDraft'&&clean(x.target_id)===id)));
  return {deleted:id,title:found.title}
}
async function deleteProductFact(token,b){
  const id=clean(b.fact_id);if(!id)throw new Error('fact_id_required');
  const [facts,approvals,candidates]=await Promise.all([central.list(token,'ProductFacts'),central.list(token,'Approvals'),central.list(token,'FactCandidates')]);
  const found=facts.find(x=>clean(x.fact_id)===id);if(!found)throw new Error('product_fact_not_found');
  await central.replace(token,'ProductFacts',facts.filter(x=>clean(x.fact_id)!==id));
  await central.replace(token,'Approvals',approvals.filter(x=>!(clean(x.target_type)==='ProductFact'&&clean(x.target_id)===id)));
  await central.replace(token,'FactCandidates',candidates.map(x=>clean(x.fact_id)===id?{...x,status:'검토 대기',reviewed_by:'',reviewed_at:''}:x));
  return {deleted:id,title:found.feature_name||found.subject}
}
async function attachEntities(token,payload){const x=await central.listMany(token,['Approvals','Customers','ProductFacts','Results','FactCandidates','MarketingCandidates','MarketingDrafts']);payload.entities={approvals:x.Approvals||[],customers:x.Customers||[],productFacts:x.ProductFacts||[],results:x.Results||[],factCandidates:x.FactCandidates||[],marketingCandidates:x.MarketingCandidates||[],marketingDrafts:x.MarketingDrafts||[]};if(payload.data)payload.data.entities=payload.entities;return payload}

module.exports=async(req,res)=>{try{
  const token=await access(req).catch(()=>null),u=new URL(req.url,'https://'+req.headers.host),action=u.searchParams.get('action')||'bootstrap';
  if(token&&action==='phase3-list')return json(res,200,await phase3List(token));
  if(token&&req.method==='POST'&&action==='phase3-scan')return json(res,200,{ok:true,...await scanFacts(token)});
  if(token&&req.method==='POST'&&action==='phase3-approve-fact')return json(res,200,{ok:true,...await approveFact(token,await body(req))});
  if(token&&req.method==='POST'&&action==='phase3-marketing')return json(res,200,{ok:true,...await generateMarketing(token)});
  if(token&&req.method==='POST'&&action==='phase3-approve-marketing')return json(res,200,{ok:true,candidate:await approveMarketing(token,await body(req))});
  if(token&&req.method==='POST'&&action==='phase3-drafts')return json(res,200,{ok:true,...await generateDrafts(token,await body(req))});
  if(token&&req.method==='POST'&&action==='phase3-approve-draft')return json(res,200,{ok:true,draft:await approveDraft(token,await body(req))});
  if(token&&req.method==='POST'&&action==='phase3-delete-marketing')return json(res,200,{ok:true,...await deleteMarketingCandidate(token,await body(req))});
  if(token&&req.method==='POST'&&action==='phase3-delete-draft')return json(res,200,{ok:true,...await deleteMarketingDraft(token,await body(req))});
  if(token&&req.method==='POST'&&action==='phase3-delete-fact')return json(res,200,{ok:true,...await deleteProductFact(token,await body(req))});
  const temp=fakeResponse();await original(req,temp);let payload={};try{payload=JSON.parse(temp.body||'{}')}catch{payload={raw:temp.body}}if(token&&temp.statusCode<400)await attachEntities(token,payload);res.statusCode=temp.statusCode;for(const [k,v] of Object.entries(temp.headers))res.setHeader(k,v);res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(payload));
}catch(e){return json(res,500,{error:e.message,connection:'연결 안 됨'})}};
