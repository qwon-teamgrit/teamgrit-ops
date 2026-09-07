(function(){
  const SYSTEM_DEV_URL='https://docs.google.com/document/d/1TirSjrD8b2p07tHt5Gn9sOrQoJPigyFmwcgSbAXPSxc/edit?usp=drivesdk';
  const SALES_SHEET_URL='https://docs.google.com/spreadsheets/d/1MuMAcRqjOeHkwSdU6ZOUjfpUkUE5KLGb/edit?usp=drivesdk&ouid=114828042007615113264&rtpof=true&sd=true';
  const GMAIL_BY_EMAIL={
    'jhpark@younginmo.com':'https://mail.google.com/mail/#all/19ef725dcc698016',
    'chris@roas.co.kr':'https://mail.google.com/mail/#all/19ef725e84274d6a',
    'manyeob.lim@hanwha.com':'https://mail.google.com/mail/#all/19ef72617d5b9ac9',
    'dk0925@kwater.or.kr':'https://mail.google.com/mail/#all/19ef7261fb02fad6',
    'te.joo@etevers.com':'https://mail.google.com/mail/#all/19ef72629508d3b6'
  };
  const sourceUrl=text=>{
    const t=String(text||'');
    if(/영업 통합 운영 시트|고객 마스터/.test(t)) return SALES_SHEET_URL;
    if(/Gmail|메일|메일링/.test(t)) return null;
    if(/시스템개발팀|Drive|Source|프로젝트 정보/.test(t)) return SYSTEM_DEV_URL;
    return null;
  };
  const link=(label,url,kind='source-link')=>url?`<a class="${kind}" href="${url}" target="_blank" rel="noopener noreferrer">↗ ${label}</a>`:'';

  function decorateProjectCards(){
    document.querySelectorAll('#projectInfoList .project-info-card').forEach(card=>{
      if(card.querySelector('.source-link-group')) return;
      const sourceList=card.querySelector('.source-list');
      if(!sourceList) return;
      const group=document.createElement('div');group.className='source-link-group';
      group.innerHTML=link('시스템개발팀 원본 열기',SYSTEM_DEV_URL);
      sourceList.appendChild(group);
    });
  }
  function decorateFacts(){
    document.querySelectorAll('#factList .knowledge-row, #dashFacts .knowledge-row').forEach(row=>{
      if(row.querySelector('.source-link-group'))return;
      const text=row.textContent||'';const url=sourceUrl(text);if(!url)return;
      const first=row.firstElementChild||row;const group=document.createElement('div');group.className='source-link-group';group.innerHTML=link('근거 자료 열기',url);first.appendChild(group);
    });
  }
  function decorateSales(){
    document.querySelectorAll('#companyList table tbody tr').forEach(row=>{
      if(row.querySelector('.source-link-group'))return;
      const text=row.textContent||'';const email=Object.keys(GMAIL_BY_EMAIL).find(e=>text.includes(e));
      const cell=document.createElement('td');cell.className='source-links-cell';
      cell.innerHTML=`<div class="source-link-group">${link('고객 마스터',SALES_SHEET_URL)}${email?link('Gmail 발송 원본',GMAIL_BY_EMAIL[email]):''}</div>`;
      row.appendChild(cell);
    });
    const head=document.querySelector('#companyList table thead tr');
    if(head&&!head.querySelector('[data-source-head]')){const th=document.createElement('th');th.textContent='근거 자료';th.setAttribute('data-source-head','1');head.appendChild(th)}
  }
  function decorateAutomation(){
    document.querySelectorAll('#automationList .knowledge-row, #automationSummary .knowledge-row').forEach(row=>{
      if(row.querySelector('.source-link-group'))return;
      const text=row.textContent||'';let url=sourceUrl(text);let label='근거 자료 열기';
      if(/고객 마스터/.test(text)){url=SALES_SHEET_URL;label='고객 마스터 열기'}
      if(!url)return;
      const first=row.firstElementChild||row;const group=document.createElement('div');group.className='source-link-group';group.innerHTML=link(label,url);first.appendChild(group);
    });
  }
  function decorateProjectDetail(){
    const box=document.querySelector('#projectRelations');if(!box||box.querySelector('.source-reference-block'))return;
    const wrap=document.createElement('div');wrap.className='source-reference-block';wrap.innerHTML=`<label>확인 중인 원본 자료</label><div class="source-link-group">${link('시스템개발팀 문서',SYSTEM_DEV_URL)}</div><div class="muted">프로젝트 상세 분석 시 연결된 Drive 폴더·문서와 함께 이 기준 문서를 참고합니다.</div>`;box.prepend(wrap);
  }
  function decorate(){decorateProjectCards();decorateFacts();decorateSales();decorateAutomation();decorateProjectDetail()}
  new MutationObserver(()=>decorate()).observe(document.body,{childList:true,subtree:true});
  setTimeout(decorate,0);
})();