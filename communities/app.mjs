import {zoomBox} from './zoom.mjs';
import {visibleBlockers,orderedDependencies,isValidated,incompleteIds,projectComponents} from './model.mjs';
const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=await fetch('../data/explorer-data.json').then(r=>{if(!r.ok)throw Error('Data could not be loaded');return r.json()}).catch(e=>{app.textContent=e.message;throw e});
let mode='communities',domain='',role='',focus=null,selected=null,includeUnreviewed=true,activeCommunity=null,box=[0,0,1600,900];
const positions=[[80,60],[1390,80],[720,710],[1440,800],[80,790]];
const get=id=>data.blockers.find(b=>b.id===Number(id));
const badge=b=>`<span class="badge ${b.classification==='Critical core'?'core':''}">${esc(b.classification)}</span>`;
const options=(pairs,current)=>pairs.map(([id,label])=>`<option value="${esc(id)}" ${id===current?'selected':''}>${esc(label)}</option>`).join('');
function explorer(){
 app.innerHTML=`<section class="explorer"><div class="explore-title"><div><p class="eyebrow">Explorer</p><h1>Focus on what matters.</h1></div><div class="tabs" role="tablist"><button role="tab" aria-selected="${mode==='stage'}" data-mode="stage">Stage Gates</button><button role="tab" aria-selected="${mode==='communities'}" data-mode="communities">Communities</button></div></div><div class="filters"><label>Community<select id="domain" aria-label="Community">${options([['','All communities'],...data.communities.map(c=>[String(c.id),c.name])],domain)}</select></label><label>Stakeholder<select id="role" aria-label="Stakeholder">${options([['','All stakeholders'],...[...new Set(data.blockers.flatMap(b=>b.stakeholders))].sort().map(x=>[x,x])],role)}</select></label><span id="count"></span>${focus?'<button id="clear-focus">Show all blockers</button>':''}</div>${focus?`<p class="focus-note">Assessment focus: ${focus.length} weak or incomplete points. Filters refine this selection.</p>`:''}<div class="legend"><span class="core-key">Critical core</span><span>Critical core highlights the most critical blockers.</span><span>Solid = validated dependency</span><span>Dashed = unreviewed dependency</span></div><div id="view"></div></section>`;
 app.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;selected=null;box=[0,0,1600,900];explorer()});
 app.querySelector('#domain').onchange=e=>{domain=e.target.value;selected=null;activeCommunity=null;box=[0,0,1600,900];renderView()};app.querySelector('#role').onchange=e=>{role=e.target.value;selected=null;activeCommunity=null;box=[0,0,1600,900];renderView()};
 app.querySelector('#clear-focus')?.addEventListener('click',()=>{focus=null;explorer()});renderView();
}
function renderView(){
 const bs=visibleBlockers(data,{role,focus}).filter(b=>!domain||String(b.communityId)===domain);app.querySelector('#count').textContent=`${bs.length} of 41 blockers`;
 const view=app.querySelector('#view');
 if(!bs.length){view.innerHTML='<div class="empty"><h2>No blockers in this selection</h2><p>Change the filters or show all blockers to explore further.</p></div>';return;}
 if(mode==='stage'){
  const params=new URLSearchParams({revision:'20261009-redesign'});if(domain)params.set('domain',domain);if(role)params.set('role',role);if(focus)params.set('focus',focus.join(','));
  view.innerHTML=`<iframe title="Existing Stage Gate spatial timeline" src="./preview/timeline/?${params}" class="timeline"></iframe><p class="muted">The existing timeline layout, gate sequence, pan, zoom and detail flow are preserved. Filters apply to blocker membership.</p>`;
 }else cloud(bs);
}
function cloud(bs){
 const view=app.querySelector('#view');
 view.innerHTML=`<div class="cloud-toolbar"><nav class="breadcrumbs" aria-label="Community navigation"><button id="reset-cloud">All communities</button><span id="trail"></span></nav><div class="map-controls"><button id="zoom-out" aria-label="Zoom out">−</button><button id="zoom-in" aria-label="Zoom in">+</button><button id="fit-cloud">Fit all</button><button id="fullscreen">Fullscreen</button></div><label class="link-toggle"><input id="unreviewed" type="checkbox" ${includeUnreviewed?'checked':''}> Unreviewed links</label></div><div class="cloud-layout"><div class="canvas"><svg id="cloud" role="group" aria-label="Community map"></svg><p class="map-hint">Drag to move · + / − to zoom</p></div><aside id="detail" hidden aria-label="Blocker details" tabindex="-1"></aside></div>`;
 const svg=view.querySelector('svg'), panel=view.querySelector('#detail'),coordinates=new Map();
 const mobile=()=>svg.clientWidth<620;
 const columns=()=>mobile()?1:3;
 const items=()=>bs.filter(b=>b.communityId===activeCommunity).sort((a,b)=>a.criticalityComposite-b.criticalityComposite);
 const apply=()=>svg.setAttribute('viewBox',box.join(' '));
 let frame=0,targetBox=[...box],suppressClick=false;
 const stop=()=>{cancelAnimationFrame(frame);frame=0;targetBox=[...box]};
 const animate=()=>{box=box.map((n,i)=>n+(targetBox[i]-n)*.24);apply();if(box.some((n,i)=>Math.abs(n-targetBox[i])>.1))frame=requestAnimationFrame(animate);else{box=[...targetBox];apply();frame=0}};
 const moveTo=(next,animated=true)=>{stop();targetBox=next;if(!animated||matchMedia('(prefers-reduced-motion: reduce)').matches){box=[...next];apply()}else frame=requestAnimationFrame(animate)};
 function fit(initial=false,animated=true){
  const narrow=mobile(),detail=activeCommunity!==null;
  const width=detail?(narrow?372:1080):(narrow?720:1440);
  const height=detail?120+Math.ceil(items().length/columns())*180:(narrow?1050:800);
  const ratio=svg.clientWidth/Math.max(1,svg.clientHeight);
  let w=Math.max(width,height*ratio),h=w/ratio;
  // Enter at readable card width; Fit all remains an explicit overview action.
  if(detail&&initial){w=width;h=w/ratio}
  moveTo([(width-w)/2,detail&&initial?0:(height-h)/2,w,h],animated);
 }
 const zoom=(factor,anchor=[.5,.5])=>moveTo(zoomBox(frame?targetBox:box,factor,anchor,mobile()?260:500,4000));
 function closeDetail(restore=true){panel.hidden=true;panel.classList.remove('expanded');view.querySelector('.cloud-layout').classList.remove('detail-open');if(restore)svg.querySelector(`[data-blocker="${selected}"]`)?.focus({preventScroll:true})}
 function draw(){
  coordinates.clear();const narrow=mobile(),detailed=activeCommunity!==null;
  svg.classList.toggle('deep',detailed);
  const community=data.communities.find(c=>c.id===activeCommunity);
  view.querySelector('#trail').textContent=community?`› ${community.name}${selected?` › ${get(selected).title}`:''}`:'';
  view.querySelector('.map-hint').textContent=narrow?'Drag to move · pinch to zoom':'Drag to move · wheel to zoom · trackpad to pan';
  if(!detailed){
   const places=narrow?[[190,180,162],[530,180,162],[190,520,162],[530,520,162],[360,860,162]]:[[290,220,190],[760,220,190],[1140,550,190],[690,610,180],[240,620,170]];
   svg.innerHTML=data.communities.map((c,i)=>{
    const members=bs.filter(b=>b.communityId===c.id);if(!members.length)return '';
    const [cx,cy,r]=places[i],core=members.filter(b=>b.classification==='Critical core').length;
    const dots=narrow?'':members.map((b,j)=>{const a=j/members.length*Math.PI*2;return `<circle cx="${cx+Math.cos(a)*(r-18)}" cy="${cy+Math.sin(a)*(r-18)}" r="${b.classification==='Critical core'?5:3}" class="member-dot ${b.classification==='Critical core'?'critical-dot':''}"/>`}).join('');
    return `<g class="community-orb tone-${i}" data-orb="${c.id}" role="button" tabindex="0" aria-label="${esc(c.name)}: ${members.length} blockers"><path class="orb-surface" d="M ${cx-r} ${cy} C ${cx-r-8} ${cy-r*.65}, ${cx-r*.5} ${cy-r-20}, ${cx} ${cy-r} S ${cx+r+18} ${cy-r*.65}, ${cx+r} ${cy+5} S ${cx+r*.55} ${cy+r+15}, ${cx-5} ${cy+r} S ${cx-r-15} ${cy+r*.55}, ${cx-r} ${cy}"/>${dots}<foreignObject x="${cx-r+28}" y="${cy-r+35}" width="${2*r-56}" height="${2*r-70}"><div xmlns="http://www.w3.org/1999/xhtml" class="orb-content"><strong>${esc(c.name)}</strong><span class="orb-count">${members.length}<small>blockers</small></span>${narrow?'':`<span class="orb-critical">${core} critical core</span>`}</div></foreignObject></g>`;
   }).join('');
   svg.querySelectorAll('[data-orb]').forEach(el=>bind(el,()=>openCommunity(Number(el.dataset.orb))));apply();return;
  }
  const cards=items().map((b,j)=>{
   const x=24+(j%columns())*348,y=100+Math.floor(j/columns())*180;
   coordinates.set(b.id,[x+162,y+78]);
   return `<g class="blocker ${selected===b.id?'selected':''}" data-blocker="${b.id}" role="button" tabindex="0" aria-label="${esc(b.title)}, Stage Gate ${b.stageGate}, ${esc(b.classification)}" aria-pressed="${selected===b.id}"><rect x="${x}" y="${y}" width="324" height="156" rx="16"/><foreignObject x="${x+18}" y="${y+17}" width="288" height="124"><div xmlns="http://www.w3.org/1999/xhtml" class="node-title"><span class="node-meta">${b.stageGate===null||b.stageGate===undefined?'Stage Gate not mapped':`Stage Gate G${esc(b.stageGate)}`}</span><strong>${esc(b.title)}</strong><span class="node-status ${b.classification==='Critical core'?'critical':''}">${esc(b.classification)}</span></div></foreignObject></g>`;
  }).join('');
  const links=selected?orderedDependencies(data,selected,includeUnreviewed).map(d=>{const a=coordinates.get(d.blockerId),b=coordinates.get(d.dependsOnBlockerId);return a&&b?`<path d="M ${a.join(' ')} Q ${(a[0]+b[0])/2-70} ${Math.min(a[1],b[1])-65} ${b.join(' ')}" class="link ${isValidated(d)?'validated':'unreviewed'}" marker-end="url(#arrow)"><title>${esc(get(d.blockerId).title)} depends on ${esc(get(d.dependsOnBlockerId).title)}</title></path>`:''}).join(''):'';
  svg.innerHTML=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#778b95"/></marker></defs><foreignObject x="24" y="20" width="${narrow?324:1020}" height="74"><div xmlns="http://www.w3.org/1999/xhtml" class="community-title">${esc(community.name)}<small>${items().length} blockers</small></div></foreignObject>${links}${cards}`;
  svg.querySelectorAll('[data-blocker]').forEach(el=>bind(el,()=>{selected=Number(el.dataset.blocker);draw();detail()}));apply();
 }
 function bind(el,activate){el.onclick=e=>{e.stopPropagation();if(!suppressClick)activate()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}}}
 function openCommunity(id){closeDetail(false);activeCommunity=id;selected=null;draw();fit(true);}
 view.querySelector('#reset-cloud').onclick=()=>{closeDetail(false);activeCommunity=null;selected=null;draw();fit()};
 view.querySelector('#fit-cloud').onclick=()=>fit();
 view.querySelector('#zoom-in').onclick=()=>zoom(.8);view.querySelector('#zoom-out').onclick=()=>zoom(1.25);
 view.querySelector('#unreviewed').onchange=e=>{includeUnreviewed=e.target.checked;draw();if(!panel.hidden)detail(false)};
 view.querySelector('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await app.requestFullscreen()}catch{view.querySelector('.map-hint').textContent='Fullscreen unavailable in this browser'}};
 app.onfullscreenchange=()=>{view.querySelector('#fullscreen').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen'};
 // Browsers expose no device type for wheel events: coarse/line steps identify a mouse;
 // continuous pixel deltas pan a trackpad, while its pinch gesture carries ctrlKey.
 svg.addEventListener('wheel',e=>{
  e.preventDefault();const rect=svg.getBoundingClientRect(),anchor=[(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height];
  if(e.ctrlKey||e.deltaMode!==0||(!e.deltaX&&Math.abs(e.deltaY)>=50&&Number.isInteger(e.deltaY)))zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY*(e.deltaMode?16:1)))*(e.ctrlKey?.01:.003)),anchor);
  else{stop();box[0]+=e.deltaX*box[2]/rect.width;box[1]+=e.deltaY*box[3]/rect.height;apply()}
 },{passive:false});
 const pointers=new Map();let gesture=null;
 function snapshot(){const p=[...pointers.values()];if(!p.length){gesture=null;return}const center=p.length>1?[(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2]:p[0];gesture={center,distance:p.length>1?Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]):0,box:[...box]}}
 svg.onpointerdown=e=>{if(e.button!==0)return;stop();if(!pointers.size)suppressClick=false;pointers.set(e.pointerId,[e.clientX,e.clientY]);snapshot();if(e.pointerType==='touch')suppressClick=pointers.size>1};
 svg.onpointermove=e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,[e.clientX,e.clientY]);const p=[...pointers.values()],center=p.length>1?[(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2]:p[0],dx=center[0]-gesture.center[0],dy=center[1]-gesture.center[1];
  if(Math.hypot(dx,dy)>4||p.length>1){suppressClick=true;svg.setPointerCapture(e.pointerId)}
  if(!suppressClick)return;const r=svg.getBoundingClientRect(),distance=p.length>1?Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]):0;
  box=zoomBox(gesture.box,gesture.distance&&distance?gesture.distance/distance:1,[(gesture.center[0]-r.left)/r.width,(gesture.center[1]-r.top)/r.height],mobile()?260:500,4000);
  box[0]-=dx*box[2]/r.width;box[1]-=dy*box[3]/r.height;apply();
 };
 const release=e=>{pointers.delete(e.pointerId);snapshot()};svg.onpointerup=release;svg.onpointercancel=release;svg.onlostpointercapture=release;svg.onpointerleave=e=>{if(!svg.hasPointerCapture(e.pointerId))release(e)};
 view.onkeydown=e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();closeDetail()}};
 let size=null;const observer=new ResizeObserver(()=>{
  if(!svg.isConnected){observer.disconnect();return}const next=[svg.clientWidth,svg.clientHeight];if(!next[0]||!next[1])return;
  if(size){stop();const center=[box[0]+box[2]/2,box[1]+box[3]/2],w=box[2]*next[0]/size[0],h=box[3]*next[1]/size[1];box=[center[0]-w/2,center[1]-h/2,w,h];if((size[0]<620)!==(next[0]<620))draw();apply()}
  size=next;
 });observer.observe(svg);
 function detail(moveFocus=true){
  view.querySelector('#detail').hidden=false;view.querySelector('.cloud-layout').classList.add('detail-open');
  const b=get(selected),deps=orderedDependencies(data,b.id,includeUnreviewed),ids=new Set(bs.map(x=>x.id));
  view.querySelector('#detail').innerHTML=`<button id="expand-detail" aria-expanded="false">Expand details</button><button id="close-detail" aria-label="Close blocker details">×</button><p class="eyebrow">${esc(b.communityName)}</p><h2>${esc(b.title)}</h2>${badge(b)}<p>${esc(b.statement)}</p><a class="dependency" target="_parent" href="../#domain/${b.domain}/blocker/${b.id}">Open full details →</a><h3>Dependencies</h3><p class="muted">Arrow: blocker → prerequisite. ${deps.filter(d=>!ids.has(d.blockerId)||!ids.has(d.dependsOnBlockerId)).length} links reach blockers outside these filters.</p>${deps.length?deps.map(d=>{const other=get(d.blockerId===b.id?d.dependsOnBlockerId:d.blockerId);return `<button class="dependency" data-jump="${other.id}" ${ids.has(other.id)?'':'disabled'}><small>${d.blockerId===b.id?'Depends on':'Required by'} · ${isValidated(d)?'Validated':'Unreviewed'} · importance ${d.dependencyImportance??'unspecified'}</small>${esc(other.title)}</button>`}).join(''):'<p>No dependencies in this link selection.</p>'}<h3>Why it matters</h3><p>${esc(b.whyItMatters)}</p><h3>Enablers</h3>${data.mechanisms.map(m=>{const rel=data.relationships.filter(r=>r.blockerId===b.id&&r.mechanism===m.key);return rel.length?`<details><summary>${esc(m.key)} · ${rel.length}</summary>${rel.map(r=>{const en=data.enablers.find(e=>e.id===r.enablerId);return `<h4>${esc(en.title)}</h4><p>${esc(en.description)}</p><p>${esc(en.practicalActions)}</p>`}).join('')}</details>`:''}).join('')}`;
  view.querySelector('#close-detail').onclick=()=>closeDetail();
  view.querySelector('#expand-detail').onclick=e=>{const expanded=panel.classList.toggle('expanded');e.target.textContent=expanded?'Reduce details':'Expand details';e.target.setAttribute('aria-expanded',expanded)};
  if(moveFocus){panel.scrollTop=0;panel.focus({preventScroll:true})}
  view.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>{selected=Number(el.dataset.jump);const b=get(selected),id=selected;if(activeCommunity!==b.communityId)openCommunity(b.communityId);selected=id;draw();detail()});
 }

 draw();fit(true,false);if(selected)detail();
}

explorer();
