(function(){
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let activeOpportunityId=null;

  function companyName(c){return c?.endCustomer||c?.companyName||c?.partner||'-'}
  function companyContacts(companyId){return (window.db?.contacts||[]).filter(c=>c.companyId===companyId)}
  function companyInteractions(companyId){return (window.db?.interactions||[]).filter(i=>i.companyId===companyId).sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))}
  function fmtDate(v){if(!v)return '-';try{return new Date(v).toLocaleString('ko-KR')}catch{return String(v)}}

  function interactionDirection(i){
    const from=String(i.from||i.fromEmail||'');
    const to=String(i.to||i.toEmail||'');
    const sent=/발신|sent/i.test(i.type||'')||/@teamgrit\.kr/i.test(from);
    const received=/수신|received/i.test(i.type||'')||/@teamgrit\.kr/i.test(to);
    if(sent)return {label:'TeamGRIT → 고객',from:from||'TeamGRIT',to:to||'고객'};
    if(received)return {label:'고객 → TeamGRIT',from:from||'고객',to:to||'TeamGRIT'};
    return {label:i.type||'접점',from:from||'-',to:to||'-'};
  }

  function enrichCompanyTable(){
    const host=q('companyContactList');
    if(!host||!window.db||host.dataset.enriched==='1')return;
    const companies=window.db.companies||[];
    if(!companies.length)return;
    host.dataset.enriched='1';
    host.innerHTML=`<table class="table"><thead><tr><th>고객 ID</th><th>기업 / 고객</th><th>파트너</th><th>유형·산업</th><th>TeamGRIT 담당</th><th>고객 담당자</th><th>연락처</th><th>이메일</th><th>영업 상태 / 메모</th><th>최근 접촉</th></tr></thead><tbody>${companies.map(c=>{
      const contacts=companyContacts(c.id), primary=contacts[0], interactions=companyInteractions(c.id), last=interactions[0];
      return `<tr><td>${esc(c.customerId||'-')}</td><td><b>${esc(companyName(c))}</b></td><td>${esc(c.partner||'-')}</td><td>${esc(c.customerType||'-')}<div class="muted">${esc(c.industry||'-')}</div></td><td>${c.accountOwner?`<b>${esc(c.accountOwner)}</b>`:'<span class="tag amber">미지정</span>'}</td><td>${primary?esc(primary.name):'<span class="tag amber">보완 필요</span>'}</td><td>${primary?.phone?`<a href="tel:${esc(primary.phone)}">${esc(primary.phone)}</a>`:'-'}</td><td>${primary?.email?`<a href="mailto:${esc(primary.email)}">${esc(primary.email)}</a>`:'-'}</td><td>${esc(c.salesTemperature||c.status||'-')}<div class="muted">${esc(c.memo||'')}</div></td><td>${last?`${esc(fmtDate(last.date||last.createdAt))}<div class="muted">${esc(last.subject||last.type||'')}</div>`:'-'}</td></tr>`
    }).join('')}</tbody></table>`;
  }

  function detailCompanyPanel(o){
    const d=window.db||{}, c=(d.companies||[]).find(x=>x.id===o.companyId), contacts=companyContacts(o.companyId), interactions=companyInteractions(o.companyId), primary=contacts[0];
    const outbound=interactions.find(i=>interactionDirection(i).label==='TeamGRIT → 고객');
    return `<div class="panel" id="salesContactPanel"><div class="ph"><b>담당자 / 접촉 정보</b><span class="muted">영업 통합 운영 시트 기준 + Gmail 접점</span></div><div class="pb"><div class="form-row"><div><div class="muted">고객사</div><b>${esc(companyName(c))}</b>${c?.partner?`<div class="muted">파트너: ${esc(c.partner)}</div>`:''}</div><div><div class="muted">TeamGRIT 담당</div>${c?.accountOwner?`<b>${esc(c.accountOwner)}</b>`:'<span class="tag amber">미지정</span>'}</div></div><div class="form-row" style="margin-top:14px"><div><div class="muted">고객 담당자</div><b>${esc(primary?.name||'보완 필요')}</b>${primary?.phone?`<div><a href="tel:${esc(primary.phone)}">${esc(primary.phone)}</a></div>`:''}</div><div><div class="muted">고객 이메일</div>${primary?.email?`<a href="mailto:${esc(primary.email)}">${esc(primary.email)}</a>`:'-'}</div></div>${outbound?`<div class="notice" style="margin-top:14px"><b>최근 TeamGRIT 발신</b><br>${esc(outbound.from||'TeamGRIT')} → ${esc(outbound.to||primary?.email||'고객')}<br><span class="muted">${esc(outbound.subject||'')} · ${esc(fmtDate(outbound.date))}</span>${outbound.url?` <a target="_blank" href="${esc(outbound.url)}">Gmail 원본 ↗</a>`:''}</div>`:''}</div></div>`;
  }

  function timelineHtml(o){
    const d=window.db||{};
    const local=(d.salesActivities||[]).filter(a=>a.opportunityId===o.id).map(a=>({...a,_kind:'activity'}));
    const gmail=(d.interactions||[]).filter(i=>i.opportunityId===o.id||(o.companyId&&i.companyId===o.companyId)).map(i=>({...i,_kind:'gmail'}));
    const all=[...local,...gmail].sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')));
    if(!all.length)return '<div class="empty">아직 진행 이력이 없습니다.</div>';
    return all.map(item=>{
      if(item._kind==='gmail'){
        const dir=interactionDirection(item);
        return `<div class="timeline-item"><div class="timeline-head"><div><span class="tag blue">Gmail</span> <span class="tag">${esc(dir.label)}</span><b style="display:block;margin-top:7px">${esc(item.subject||'제목 없음')}</b></div><span class="muted">${esc(fmtDate(item.date||item.createdAt))}</span></div><div class="muted" style="margin-top:8px">보낸 사람: ${esc(dir.from)}<br>받는 사람: ${esc(dir.to)}</div><div style="margin-top:8px">${esc(item.snippet||item.status||'')}</div>${item.url?`<div style="margin-top:10px"><a class="btn" target="_blank" href="${esc(item.url)}">Gmail 원본 열기 ↗</a></div>`:''}</div>`;
      }
      return `<div class="timeline-item"><div class="timeline-head"><div><span class="tag">${esc(item.type||'활동')}</span><b style="display:block;margin-top:7px">${esc(item.title||'')}</b></div><span class="muted">${esc(fmtDate(item.date||item.createdAt))}</span></div><div style="margin-top:8px">${esc(item.detail||'')}</div>${item.url?`<div style="margin-top:10px"><a class="btn" target="_blank" href="${esc(item.url)}">원본 자료 열기 ↗</a></div>`:'<div class="muted" style="margin-top:8px">원본 링크 없음</div>'}</div>`;
    }).join('');
  }

  function enrichDetail(){
    const root=q('salesDetail');
    if(!root||root.classList.contains('hidden')||!activeOpportunityId||!window.db)return;
    const o=(window.db.opportunities||[]).find(x=>x.id===activeOpportunityId);if(!o)return;
    const grid=root.querySelector('.sales-detail-grid');if(grid&&!q('salesContactPanel')){const left=grid.querySelector('.detail-stack');if(left)left.insertAdjacentHTML('afterbegin',detailCompanyPanel(o))}
    const panels=[...root.querySelectorAll('.panel')];
    const history=panels.find(p=>p.querySelector('.ph b')?.textContent?.includes('진행 이력'));
    const timeline=history?.querySelector('.timeline');if(timeline&&timeline.dataset.enriched!=='1'){timeline.dataset.enriched='1';timeline.innerHTML=timelineHtml(o)}
  }

  document.addEventListener('click',e=>{const row=e.target.closest?.('[data-opp]');if(row)activeOpportunityId=row.dataset.opp},true);
  const obs=new MutationObserver(()=>{const host=q('companyContactList');if(host&&host.querySelector('table')){host.dataset.enriched='';enrichCompanyTable()}enrichDetail()});
  obs.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(()=>{enrichCompanyTable();enrichDetail()},300);
})();
