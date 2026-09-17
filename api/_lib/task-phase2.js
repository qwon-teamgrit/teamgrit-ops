const crypto=require('crypto');
const {gemini,clean,arr}=require('./source-corpus-all');

const TASK_HEADERS=['task_id','title','project','owner','due_date','status','source','source_url','source_ids','created_at','approved_at','updated_at','predecessor_task_ids','result_url','result_title','followup_source_task_id','followup_generated_statuses','review_notification_at'];
const TASK_LAST_COL='R';
const TASK_STATUSES=['예정','진행 중','검토 필요','승인 대기','보류','완료'];

function normalizeStatus(v){const s=clean(v);if(!s)return '예정';const map={'진행 전':'예정','검토 대기':'검토 필요','완료됨':'완료'};return TASK_STATUSES.includes(s)?s:(map[s]||'예정')}
function ids(v){if(Array.isArray(v))return [...new Set(v.map(clean).filter(Boolean))];return [...new Set(String(v||'').split(/[\s,;|]+/).map(clean).filter(Boolean))]}
function parseGenerated(v){return new Set(ids(v))}
function serializeGenerated(set){return [...set].join(',')}
function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9가-힣]+/g,' ').replace(/\s+/g,' ').trim()}
function tokens(v){return new Set(norm(v).split(' ').filter(x=>x.length>=2))}
function overlap(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.size,B.size)}
function similarity(a,b){const A=norm(a),B=norm(b);if(!A||!B)return 0;if(A===B)return 1;if((A.includes(B)||B.includes(A))&&Math.min(A.length,B.length)>=7)return .9;return overlap(A,B)}
function taskKey(t){return [norm(t.title),norm(t.project||'확인 필요'),norm(t.owner||'확인 필요'),norm(t.dueDate||t.due_date||'확인 필요')].join('|')}
function makeId(prefix='task'){return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`}

async function generateFollowups({task,status,existingTasks=[]}){
  const prompt=`너는 TeamGRIT 업무 Lifecycle 에이전트다. 현재 업무의 상태가 변경되었다. 다음 상태에서 실제로 필요한 후속 업무만 제안한다. 필요하지 않으면 tasks를 빈 배열로 반환한다. 원문에 없는 프로젝트, 담당자, 기한은 만들지 않는다. 상태는 반드시 예정으로 둔다. 현재 업무를 선행 업무로 연결한다. 기존 업무와 의미가 겹치면 제안하지 않는다. JSON만 반환: {"tasks":[{"title":string,"project":string,"owner":string,"dueDate":string,"status":"예정","reason":string}]}.\n\n[현재 업무]\n업무명: ${clean(task.title)}\n프로젝트: ${clean(task.project)}\n담당자: ${clean(task.owner)}\n기한: ${clean(task.due_date)}\n변경 상태: ${status}\n결과물: ${clean(task.result_url)}\n출처: ${clean(task.source)}\n\n[기존 업무]\n${existingTasks.slice(0,200).map(t=>`- ${clean(t.title)} | ${clean(t.project)} | ${clean(t.status)}`).join('\n')}`;
  let ai;try{ai=await gemini(prompt)}catch{return {tasks:[],modelUsed:null,error:'followup_ai_unavailable'}}
  const out=[];for(const t of arr(ai.data?.tasks)){const title=clean(t.title);if(!title)continue;let duplicate=false;for(const e of existingTasks){const sameProject=!clean(task.project)||!clean(e.project)||norm(task.project)===norm(e.project);if(sameProject&&similarity(title,e.title)>=.72){duplicate=true;break}}if(duplicate)continue;out.push({title,project:clean(t.project)||clean(task.project),owner:clean(t.owner),dueDate:clean(t.dueDate),status:'예정',reason:clean(t.reason),sourceEvidence:`${clean(task.title)} 상태가 '${status}'로 변경됨`,sourceIds:ids(task.source_ids),predecessorTaskIds:[clean(task.task_id)].filter(Boolean),followupSourceTaskId:clean(task.task_id),approved:true})}
  return {tasks:out,modelUsed:ai.modelUsed,error:''};
}

module.exports={TASK_HEADERS,TASK_LAST_COL,TASK_STATUSES,normalizeStatus,ids,parseGenerated,serializeGenerated,norm,similarity,taskKey,makeId,generateFollowups};
