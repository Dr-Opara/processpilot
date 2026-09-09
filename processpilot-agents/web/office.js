const $=s=>document.querySelector(s);
let config,activity=null,selectedTab='activity',selectedAgent=null,loading=false,motion=true;
const validStatus=new Set(['waiting','working','completed','blocked','needs_approval']);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=s=>s&&Number.isFinite(Date.parse(s))?new Date(s).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' CT':'Not yet recorded';
const personStyle=n=>(n%5*25)+'% '+(n<5?'0':'100')+'%';
function safeLink(url,label){try{const u=new URL(url);if(u.protocol!=='https:')return '';return '<a href="'+esc(u.href)+'" target="_blank" rel="noopener">'+esc(label)+'</a>';}catch{return '';}}
function statusFor(id){return activity?.agents.find(a=>a.id===id);}
function reviews(){return activity?.reviews.filter(x=>x.status==='pending')||[];}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function fit(){const box=$('#roomViewport').getBoundingClientRect(),scale=Math.min(box.width/1200,box.height/820);$('#room').style.transform='translate('+((box.width-1200*scale)/2)+'px,'+((box.height-820*scale)/2)+'px) scale('+scale+')';}
function buildRoom(){
 config.pods.forEach((pod,pi)=>{
  const el=document.createElement('section');el.className='pod';el.style.left=pod.x+'px';el.style.top=pod.y+'px';
  el.innerHTML='<h3>'+esc(pod.name)+'</h3><div class="state-list"></div><div class="desk-line"></div><span class="desk-label">'+(pod.states.length?pod.states.length+' offices · ':'')+pod.agents.length+' specialists</span>';
  pod.states.forEach(state=>{const b=document.createElement('button');b.className='state';b.dataset.state=state;b.textContent=state;b.title=state+' office';b.onclick=()=>openAgent(config.agents.find(a=>a.states.includes(state)).id,state);el.querySelector('.state-list').append(b);});
  $('#pods').append(el);
  const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d','M600 410 L'+pod.x+' '+pod.y);$('.connections').append(line);
  pod.agents.forEach((id,j)=>{
   const a=config.agents.find(a=>a.id===id),count=pod.agents.length;
   const x=pod.x+(j-(count-1)/2)*36,y=pod.y+37;
   const towardX=(600-x)*.16,towardY=(410-y)*.16;
   const endX=x+towardX+(j%2?12:-12),endY=y+towardY;
   const p=document.createElement('button');p.className='person waiting';p.dataset.id=id;p.setAttribute('aria-label',a.name);p.title=a.name;p.style.offsetPath='path("M '+x+' '+y+' Q '+(x+30)+' '+(y-15)+' '+endX+' '+endY+' Q '+(x-20)+' '+(y+15)+' '+x+' '+y+'")';p.style.setProperty('--duration',(18+j*3+pi)+'s');p.style.setProperty('--delay',(-j*3-pi*2)+'s');p.innerHTML='<span class="sprite" style="background-position:'+personStyle(a.sprite)+'"></span><span class="id">'+id+'</span>';p.onclick=()=>openAgent(id);$('#people').append(p);
  });
 });
 new ResizeObserver(fit).observe($('#roomViewport'));fit();
}
function detailSection(title,text){return '<section class="detail-section"><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p></section>';}
function openAgent(id,state){selectedAgent={id,state};renderAgent();if(!$('#detail').open)$('#detail').showModal();}
function renderAgent(){if(!selectedAgent)return;const a=config.agents.find(a=>a.id===selectedAgent.id),r=statusFor(a.id);let html='<div class="agent-heading"><div class="large-sprite" style="background-position:'+personStyle(a.sprite)+'"></div><div><span class="eyebrow">'+esc(a.id)+' · '+esc((r?.status||'waiting').replaceAll('_',' ').toUpperCase())+'</span><h2>'+esc(selectedAgent.state?selectedAgent.state+' office':a.name)+'</h2><p>'+esc(a.name)+'</p></div></div>';
 html+=detailSection('Current recorded task',r?.task||'No task execution has been recorded for this agent yet.');
 html+=detailSection('Assigned responsibility',a.task);
 html+=detailSection('Latest output',r?.output||'Awaiting first recorded output.');
 html+=detailSection('Evidence & actions',r?.actions?.join('\n')||'No completed actions recorded.');
 html+=detailSection('Blocker / next step',r?.blocker||r?.nextStep||'Pick up the next assigned item during a scheduled cycle.');
 html+=detailSection('Required deliverable',a.deliverable);
 html+=detailSection('Handoff',r?.handoff||config.agents.find(x=>x.id===a.handoff)?.name||a.handoff);
 html+=detailSection('State assignments',a.states.join(', ')||'Supports all 50 states and DC.');
 html+='<section class="detail-section"><h3>Assigned tools · used by the recurring workflow</h3><div class="tool-pills">'+a.tools.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div></section>';
 const links=(r?.sources||[]).map(s=>safeLink(s.url,s.title||s.url)).filter(Boolean);if(links.length)html+='<section class="detail-section"><h3>Official evidence</h3>'+links.join('<br>')+'</section>';
 html+=detailSection('Last recorded update',stamp(r?.updatedAt));$('#detailBody').innerHTML=html;
}
function renderReviews(){const pending=reviews();if(!pending.length)return '<p class="empty">'+(activity?'No pending review requests in the latest recorded update.':'Review status is unavailable until the feed connects.')+'</p>';
 return pending.map(r=>'<article class="review"><b>'+esc(r.title)+'</b><p>'+esc(r.reason)+'</p><p>'+esc(r.agentId||'')+' · '+stamp(r.createdAt)+'</p>'+safeLink(r.emailUrl,'Open review email ↗')+(r.documentUrl?'<br>'+safeLink(r.documentUrl,'Open response package ↗'):'')+'<p>Opening an email does not approve this request.</p></article>').join('');}
function renderPanel(){
 if(selectedTab==='reviews'){$('#panel').innerHTML=(activity?.reviewSyncWarning?'<p class="empty">'+esc(activity.reviewSyncWarning)+'</p>':'')+renderReviews()+'<p class="muted">Mailbox last checked '+stamp(activity?.reviewsCheckedAt)+'</p>';return;}
 if(selectedTab==='tools'){$('#panel').innerHTML=[
 ['Gmail','Connected to the recurring workflow. Reads replies, checks duplicates and sends permitted outreach or review notifications.'],
 ['GitHub','Source code and encrypted activity feed connected. The office polls recorded updates every 30 seconds.'],
 ['Web research & buyer portals','Scouts search official procurement sources and validate attachments. Login-only portals may require your access.'],
 ['Documents · PDFs · Spreadsheets','Used by the scheduled workflow for requirement matrices, proposal drafts, forms and internal pricing.'],
 ['Hourly ChatGPT workflow','Runs 8 AM–4 PM Central. These are coordinated roles in a scheduled workflow; they are not 30 continuously running model processes.']
 ].map(([t,p])=>'<article class="tool"><b>'+t+'</b><p>'+p+'</p></article>').join('');return;}
 const events=activity?.events||[];$('#panel').innerHTML=events.length?events.slice().reverse().slice(0,50).map(e=>'<article class="event"><b>'+esc(e.agentId||'Operations')+' · '+esc(e.title)+'</b><p>'+esc(e.detail)+'</p>'+(e.url?safeLink(e.url,'View source ↗'):'')+'<time>'+stamp(e.at)+'</time></article>').join(''):'<p class="empty">Waiting for recorded activity. Agent movement is an office visualization and does not imply completed searches.</p>';
}
function applyActivity(){
 const pending=reviews().length,working=activity.agents.filter(a=>a.status==='working').length;
 $('#working').textContent=working;$('#matches').textContent=activity.opportunities?.filter(x=>x.status==='qualified').length||0;$('#documents').textContent=activity.documents?.length||0;$('#sent').textContent=activity.outreach?.filter(x=>x.status==='sent').length||0;
 $('#reviewBadge').textContent=pending?pending+' review'+(pending>1?'s':''):activity.reviewSyncWarning?'Review sync delayed':'No pending reviews';$('#me').classList.toggle('alert',pending>0);$('#tabCount').textContent=pending||'';
 const checked=new Set(activity.coverage?.checkedStates||[]);$('#coverage').textContent=checked.size+' / 51 offices checked in latest cycle';
 document.querySelectorAll('.state').forEach(el=>el.classList.toggle('checked',checked.has(el.dataset.state)));
 document.querySelectorAll('.person').forEach(el=>{const s=statusFor(el.dataset.id)?.status||'waiting';el.className='person '+(validStatus.has(s)?s:'waiting');});
 renderPanel();if($('#detail').open&&selectedAgent)renderAgent();
}
async function refresh(){if(loading)return;loading=true;$('#refresh').disabled=true;try{const res=await fetch('/api/activity',{cache:'no-store'});if(!res.ok)throw Error('Live feed unavailable');const data=await res.json();if(data.schemaVersion!==1||!Array.isArray(data.agents)||!Array.isArray(data.reviews))throw Error('Invalid activity update');activity=data;const age=Date.now()-Date.parse(data.updatedAt);$('#connection').textContent=age>90*60000?'Connected · last record is over 90 minutes old':'Connected · recorded activity';$('#connection').className='connection'+(age>90*60000?' error':'');$('#updated').textContent='Last update '+stamp(data.updatedAt);applyActivity();}catch{$('#connection').textContent='Connection unavailable · results may be stale';$('#connection').className='connection error';if(!activity){$('#reviewBadge').textContent='Status unavailable';renderPanel();}}finally{loading=false;$('#refresh').disabled=false;}}
function updateClock(){const now=new Date();$('#clock').textContent=now.toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'})+' CT';const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(now));const next=h<8?8:h<16?h+1:null;$('#nextRun').textContent='Next cycle: '+(next===null?'tomorrow 8 AM':(next>12?next-12:next)+(next>=12?' PM':' AM'))+' CT';}
$('#motion').onclick=()=>{motion=!motion;$('#room').classList.toggle('paused',!motion);$('#motion').textContent=motion?'Pause motion':'Resume motion';};$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Use your browser’s full-screen control.');}};$('#refresh').onclick=refresh;$('#closeDetail').onclick=()=>{$('#detail').close();selectedAgent=null;};$('#me').onclick=()=>{selectedTab='reviews';document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===selectedTab));renderPanel();};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{selectedTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',x===b));renderPanel();});
try{const response=await fetch('/agents.json');if(!response.ok)throw Error();config=await response.json();buildRoom();await refresh();setInterval(refresh,30000);setInterval(updateClock,1000);updateClock();}catch{$('#connection').textContent='Office configuration could not load. Refresh to retry.';}
