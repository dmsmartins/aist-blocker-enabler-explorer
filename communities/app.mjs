import {zoomBox,wheelFactor} from './zoom.mjs';
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
 const view=app.querySelector('#view');view.innerHTML=`<div class="cloud-toolbar"><span>Select a community to reveal its blockers. Choose a blocker to focus its dependencies and details.</span><button id="zoom-out" aria-label="Zoom out">−</button><button id="zoom-in" aria-label="Zoom in">+</button><button id="reset-cloud">All communities</button><label><input id="unreviewed" type="checkbox" ${includeUnreviewed?'checked':''}> Show unreviewed links</label></div><div class="cloud-layout"><div class="canvas"><svg id="cloud" viewBox="${box.join(' ')}" role="group" aria-label="Five nonsequential community clusters"></svg></div><aside id="detail" hidden aria-live="polite"><h2>Choose a community</h2><p>Select a blocker to explore its dependencies and enablers. Links appear around the selected blocker to keep the map clear.</p></aside></div>`;
 const svg=view.querySelector('svg');const coordinates=new Map();
 const draw=()=>{
  const detailed=activeCommunity!==null;svg.classList.toggle('deep',detailed);coordinates.clear();
  if(!detailed){
   const places=[[410,270,235],[1060,255,215],[790,615,205],[1250,650,195],[295,650,175]];
   svg.innerHTML=`<defs><filter id="halo"><feGaussianBlur stdDeviation="22"/></filter></defs>`+data.communities.map((c,i)=>{
    const items=bs.filter(b=>b.communityId===c.id);if(!items.length)return '';
    const [cx,cy,r]=places[i],core=items.filter(b=>b.classification==='Critical core').length;
    const dots=items.map((b,j)=>{const angle=(j/items.length)*Math.PI*2-.7,rad=r-27;return `<circle cx="${cx+Math.cos(angle)*rad}" cy="${cy+Math.sin(angle)*rad}" r="${b.classification==='Critical core'?7:4}" class="member-dot ${b.classification==='Critical core'?'critical-dot':''}"/>`}).join('');
    return `<g class="community-orb tone-${i}" data-orb="${c.id}" role="button" tabindex="0" aria-label="${esc(c.name)}: ${items.length} blockers"><circle class="orb-halo" cx="${cx}" cy="${cy}" r="${r+20}"/><path class="orb-surface" d="M ${cx-r} ${cy} C ${cx-r-8} ${cy-r*.65}, ${cx-r*.5} ${cy-r-20}, ${cx} ${cy-r} S ${cx+r+18} ${cy-r*.65}, ${cx+r} ${cy+5} S ${cx+r*.55} ${cy+r+15}, ${cx-5} ${cy+r} S ${cx-r-15} ${cy+r*.55}, ${cx-r} ${cy}"/>${dots}<foreignObject x="${cx-r+53}" y="${cy-110}" width="${2*r-106}" height="240"><div xmlns="http://www.w3.org/1999/xhtml" class="orb-content"><span class="orb-count">${items.length}<small>blockers</small></span><strong>${esc(c.name)}</strong><span class="orb-critical">${core?`${core} critical core`:'No critical core blockers'}</span><span class="orb-open">Explore community ↗</span></div></foreignObject></g>`;
   }).join('');
   svg.setAttribute('viewBox',box.join(' '));
   svg.querySelectorAll('[data-orb]').forEach(el=>{const activate=()=>openCommunity(Number(el.dataset.orb));el.onclick=activate;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}}});
   return;
  }
  const clusters=data.communities.map((c,i)=>{
   if(c.id!==activeCommunity)return '';const [x,y]=[80,60],items=bs.filter(b=>b.communityId===c.id).sort((a,b)=>a.criticalityComposite-b.criticalityComposite);
   if(!items.length)return '';
   const nodes=items.map((b,j)=>{const bx=x+24+(j%3)*272,by=y+125+Math.floor(j/3)*120;coordinates.set(b.id,[bx+124,by+52]);return detailed?`<g class="blocker ${selected===b.id?'selected':''}" data-blocker="${b.id}" role="button" tabindex="0" aria-label="${esc(b.title)}, ${esc(b.classification)}"><rect x="${bx}" y="${by}" width="248" height="108" rx="14" class="${b.classification==='Critical core'?'core-node':''}"/><foreignObject x="${bx+16}" y="${by+14}" width="216" height="83"><div xmlns="http://www.w3.org/1999/xhtml" class="node-title"><span>${esc(b.title)}</span><small>${esc(b.classification)}</small></div></foreignObject></g>`:''}).join('');
   const core=items.filter(b=>b.classification==='Critical core').length;
   return `<g class="community ${detailed?'':'overview'}" data-community="${c.id}" role="button" tabindex="0" aria-label="${esc(c.name)}: ${items.length} blockers"><rect x="${x}" y="${y}" width="840" height="${160+Math.ceil(items.length/3)*120}" rx="${detailed?32:120}"/><foreignObject x="${x+35}" y="${y+30}" width="770" height="90"><div xmlns="http://www.w3.org/1999/xhtml" class="community-title">${esc(c.name)}<small>${items.length} blockers · ${core} critical core</small></div></foreignObject>${nodes}</g>`;
  }).join('');
  const visibleIds=new Set(bs.filter(b=>b.communityId===activeCommunity).map(b=>b.id));
  const links=detailed&&selected?orderedDependencies(data,selected,includeUnreviewed).filter(d=>visibleIds.has(d.blockerId)&&visibleIds.has(d.dependsOnBlockerId)).map(d=>{const a=coordinates.get(d.blockerId),b=coordinates.get(d.dependsOnBlockerId);return a&&b?`<path d="M ${a.join(' ')} Q ${(a[0]+b[0])/2} ${Math.min(a[1],b[1])-65} ${b.join(' ')}" class="link ${isValidated(d)?'validated':'unreviewed'}" marker-end="url(#arrow)"><title>${esc(get(d.blockerId).title)} depends on ${esc(get(d.dependsOnBlockerId).title)}: ${esc(d.reviewStatus)}</title></path>`:''}).join(''):'';
  svg.innerHTML=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#778b95"/></marker></defs>${clusters}${links}`;
  svg.querySelectorAll('.blocker').forEach(node=>svg.appendChild(node));
  svg.setAttribute('viewBox',box.join(' '));
  svg.querySelectorAll('[data-community]').forEach(el=>{const activate=()=>openCommunity(Number(el.dataset.community));el.onclick=activate;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}}});
  svg.querySelectorAll('[data-blocker]').forEach(el=>{const activate=()=>{selected=Number(el.dataset.blocker);draw();detail()};el.onclick=e=>{e.stopPropagation();activate()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();activate()}}});
 };
 let frame=0,targetBox=[...box];
 const stop=()=>{cancelAnimationFrame(frame);frame=0;targetBox=[...box]};
 const animate=()=>{box=box.map((n,i)=>n+(targetBox[i]-n)*.16);svg.setAttribute('viewBox',box.join(' '));if(box.some((n,i)=>Math.abs(n-targetBox[i])>.1))frame=requestAnimationFrame(animate);else{box=[...targetBox];frame=0;}};
 const zoom=(factor,anchor=[.5,.5])=>{targetBox=zoomBox(frame?targetBox:box,factor,anchor,activeCommunity===null?1000:650,2400);if(matchMedia('(prefers-reduced-motion: reduce)').matches){box=[...targetBox];svg.setAttribute('viewBox',box.join(' '));return;}if(!frame)frame=requestAnimationFrame(animate)};
 function openCommunity(id){stop();activeCommunity=id;selected=null;const count=bs.filter(b=>b.communityId===id).length;box=[0,0,1000,Math.max(540,240+Math.ceil(count/3)*120)];targetBox=[...box];view.querySelector('#detail').hidden=true;view.querySelector('.cloud-layout').classList.remove('detail-open');draw();svg.classList.remove('entering');requestAnimationFrame(()=>svg.classList.add('entering'));}
 view.querySelector('#zoom-in').onclick=()=>zoom(.92);view.querySelector('#zoom-out').onclick=()=>zoom(1/.92);view.querySelector('#reset-cloud').onclick=()=>{stop();activeCommunity=null;box=[0,0,1600,900];selected=null;targetBox=[...box];draw();view.querySelector('#detail').hidden=true;view.querySelector('.cloud-layout').classList.remove('detail-open')};
 view.querySelector('#unreviewed').onchange=e=>{includeUnreviewed=e.target.checked;draw();if(selected)detail()};
 svg.addEventListener('wheel',e=>{e.preventDefault();const rect=svg.getBoundingClientRect();zoom(wheelFactor(e.deltaY,e.deltaMode),[(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height])},{passive:false});
 let drag=null;svg.onpointerdown=e=>{if(e.target.closest('[data-blocker],[data-community],[data-orb]'))return;stop();drag=[e.clientX,e.clientY,...box];svg.setPointerCapture(e.pointerId)};svg.onpointermove=e=>{if(!drag)return;box=[drag[2]-(e.clientX-drag[0])*box[2]/svg.clientWidth,drag[3]-(e.clientY-drag[1])*box[3]/svg.clientHeight,drag[4],drag[5]];svg.setAttribute('viewBox',box.join(' '))};svg.onpointerup=()=>{drag=null};svg.onpointercancel=()=>{drag=null};
 function detail(){
  view.querySelector('#detail').hidden=false;view.querySelector('.cloud-layout').classList.add('detail-open');
  const b=get(selected),deps=orderedDependencies(data,b.id,includeUnreviewed),ids=new Set(bs.map(x=>x.id));
  view.querySelector('#detail').innerHTML=`<button id="close-detail" aria-label="Close blocker details">×</button><p class="eyebrow">${esc(b.communityName)}</p><h2>${esc(b.title)}</h2>${badge(b)}<p>${esc(b.statement)}</p><a class="dependency" target="_parent" href="../#domain/${b.domain}/blocker/${b.id}">Open full details →</a><h3>Dependencies</h3><p class="muted">Arrow: blocker → prerequisite. ${deps.filter(d=>!ids.has(d.blockerId)||!ids.has(d.dependsOnBlockerId)).length} links reach blockers outside these filters.</p>${deps.length?deps.map(d=>{const other=get(d.blockerId===b.id?d.dependsOnBlockerId:d.blockerId);return `<button class="dependency" data-jump="${other.id}" ${ids.has(other.id)?'':'disabled'}><small>${d.blockerId===b.id?'Depends on':'Required by'} · ${isValidated(d)?'Validated':'Unreviewed'} · importance ${d.dependencyImportance??'unspecified'}</small>${esc(other.title)}</button>`}).join(''):'<p>No dependencies in this link selection.</p>'}<h3>Why it matters</h3><p>${esc(b.whyItMatters)}</p><h3>Enablers</h3>${data.mechanisms.map(m=>{const rel=data.relationships.filter(r=>r.blockerId===b.id&&r.mechanism===m.key);return rel.length?`<details><summary>${esc(m.key)} · ${rel.length}</summary>${rel.map(r=>{const en=data.enablers.find(e=>e.id===r.enablerId);return `<h4>${esc(en.title)}</h4><p>${esc(en.description)}</p><p>${esc(en.practicalActions)}</p>`}).join('')}</details>`:''}).join('')}`;
  view.querySelector('#close-detail').onclick=()=>{selected=null;draw();view.querySelector('#detail').hidden=true;view.querySelector('.cloud-layout').classList.remove('detail-open')};
  view.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>{selected=Number(el.dataset.jump);const b=get(selected),id=selected;openCommunity(b.communityId);selected=id;draw();detail()});
 }
 draw();if(selected)detail();
}
explorer();