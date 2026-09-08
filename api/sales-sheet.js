const XLSX=require('xlsx');
const crypto=require('crypto');

function parseCookies(req){const raw=req.headers.cookie||'',out={};raw.split(';').forEach(p=>{const i=p.indexOf('=');if(i>-1)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return out}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
async function refresh(refreshToken){const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:refreshToken,grant_type:'refresh_token'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params});if(!r.ok)throw new Error('Google token refresh failed');return r.json()}
async function access(req){const c=parseCookies(req);if(c.g_access)return c.g_access;if(!c.g_refresh)return null;return (await refresh(c.g_refresh)).access_token}
function uid(prefix,key){return `${prefix}_${crypto.createHash('sha1').update(String(key)).digest('hex').slice(0,12)}`}
function clean(v){return v===undefined||v===null?'':String(v).trim()}
function rows(ws){return XLSX.utils.sheet_to_json(ws,{defval:'',raw:false})}

module.exports=async(req,res)=>{try{
  const token=await access(req);if(!token)return json(res,401,{error:'google_not_connected'});
  const fileId=process.env.SALES_SHEET_FILE_ID||'1MuMAcRqjOeHkwSdU6ZOUjfpUkUE5KLGb';
  const r=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
  if(!r.ok)throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0,300)}`);
  const buf=Buffer.from(await r.arrayBuffer());
  const wb=XLSX.read(buf,{type:'buffer',cellDates:false});
  const master=rows(wb.Sheets['고객 마스터']||{}), actions=rows(wb.Sheets['후속 액션']||{}), distributions=rows(wb.Sheets['배포 이력']||{});
  const companies=[],contacts=[],followups=[],distributionHistory=[];
  for(const m of master){const customerId=clean(m['고객 ID']);if(!customerId)continue;const companyId=uid('company',customerId);companies.push({id:companyId,customerId,partner:clean(m['파트너사']),endCustomer:clean(m['최종고객사']),companyName:clean(m['최종고객사'])||clean(m['파트너사']),customerType:clean(m['고객 유형']),industry:clean(m['산업군']),salesTemperature:clean(m['영업 온도']),accountOwner:clean(m['담당 영업']),memo:clean(m['메모']),sourceType:'영업 통합 운영 시트'});const name=clean(m['주요 담당자']),phone=clean(m['담당자 연락처']),email=clean(m['담당자 이메일']);if(name||phone||email)contacts.push({id:uid('contact',`${customerId}|${name}|${email}`),companyId,name,phone,email,sourceType:'영업 통합 운영 시트'})}
  const byCustomer=new Map(companies.map(c=>[c.customerId,c]));
  for(const a of actions){const customerId=clean(a['고객 ID']);if(!customerId)continue;const c=byCustomer.get(customerId);followups.push({id:uid('sheetaction',clean(a['액션 ID'])||`${customerId}|${clean(a['액션 내용'])}`),customerId,companyId:c?.id||null,title:clean(a['액션 내용']),dueDate:clean(a['예정일']),owner:clean(a['담당자']),status:clean(a['상태'])||'대기중',completedAt:clean(a['완료일']),memo:clean(a['메모']),sourceType:'영업 통합 운영 시트'})}
  for(const d of distributions){const customerId=clean(d['고객 ID']);if(!customerId)continue;const c=byCustomer.get(customerId);distributionHistory.push({id:uid('distribution',clean(d['배포 ID'])||`${customerId}|${clean(d['자료 ID'])}`),customerId,companyId:c?.id||null,materialId:clean(d['자료 ID']),materialName:clean(d['자료명']),sentAt:clean(d['발송일']),channel:clean(d['발송 채널']),owner:clean(d['담당자']),memo:clean(d['메모']),sourceType:'영업 통합 운영 시트'})}
  return json(res,200,{fileId,companies,contacts,followups,distributionHistory,counts:{companies:companies.length,contacts:contacts.length,followups:followups.length,distributionHistory:distributionHistory.length}})
}catch(e){return json(res,500,{error:e.message})}}
