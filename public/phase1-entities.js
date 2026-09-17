(()=>{
  db.approvals=db.approvals||[];
  db.customers=db.customers||[];
  db.productFacts=db.productFacts||[];
  db.results=db.results||[];
  function applyEntities(d){const e=d?.entities||d?.data?.entities;if(!e)return;db.approvals=e.approvals||[];db.customers=e.customers||[];db.productFacts=e.productFacts||[];db.results=e.results||[]}
  const originalLoadCentral=loadCentral;
  loadCentral=async function(){const d=await originalLoadCentral();applyEntities(d);return d};
  const originalLoadSales=loadSales;
  loadSales=async function(){const r=await originalLoadSales();try{const d=await api('/api/live-data?action=bootstrap');applyEntities(d)}catch{}return r};
  const originalLoadTasks=loadTasks;
  loadTasks=async function(){const r=await originalLoadTasks();try{const d=await api('/api/work-tasks?action=list');db.approvals=d.approvals||db.approvals}catch{}return r};
  const originalRenderDash=renderDash;
  renderDash=function(){originalRenderDash();const el=$('#dashSources');if(!el)return;const central=`<span class="tag blue">중앙 구조</span><span class="muted"> Projects ${db.projects.length} · Tasks ${db.tasks.length} · Approvals ${db.approvals.length} · Customers ${db.customers.length} · ProductFacts ${db.productFacts.length} · Results ${db.results.length} · Executions ${db.executions.length}</span>`;if(!el.querySelector('[data-phase1]'))el.insertAdjacentHTML('beforeend',`<span data-phase1 style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${central}</span>`);else el.querySelector('[data-phase1]').innerHTML=central};
  if(!document.querySelector('link[href="/agent-ui.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/agent-ui.css';document.head.appendChild(l)}
  if(!document.querySelector('script[src="/agent-ui.js"]')){const s=document.createElement('script');s.src='/agent-ui.js';s.async=false;document.body.appendChild(s)}
  if(!document.querySelector('link[href="/phase2-ui.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/phase2-ui.css';document.head.appendChild(l)}
  if(!document.querySelector('script[src="/phase2-ui.js"]')){const s=document.createElement('script');s.src='/phase2-ui.js';s.async=false;document.body.appendChild(s)}
  if(!document.querySelector('script[src="/result-review.js"]')){const s=document.createElement('script');s.src='/result-review.js';s.async=false;document.body.appendChild(s)}
})();
