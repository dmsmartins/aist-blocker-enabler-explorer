(function (root) {
  'use strict';
  const colors = {1:'#7893aa',2:'#2489a8',3:'#bc7316',4:'#b74468'};
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const level = edge => [1,2,3,4].includes(edge.dependencyImportance) ? edge.dependencyImportance : null;

  function aggregate(data, highOnly = false) {
    const blockers = new Map(data.blockers.map(b=>[b.id,b]));
    const gates = new Set(data.stageGates.map(g=>g.id));
    const groups = new Map();
    let unmapped = 0;
    for (const edge of data.blockerDependencies || []) {
      const importance = level(edge);
      if (highOnly && (importance === null || importance < 3)) continue;
      const from = blockers.get(edge.blockerId), to = blockers.get(edge.dependsOnBlockerId);
      if (!from || !to || from.stageGate == null || to.stageGate == null || !gates.has(from.stageGate) || !gates.has(to.stageGate)) { unmapped++; continue; }
      const key = `${from.stageGate}:${to.stageGate}`;
      if (!groups.has(key)) groups.set(key,{key,from:from.stageGate,to:to.stageGate,count:0,maxImportance:null,pairs:[]});
      const group = groups.get(key);
      group.count++;
      if (importance !== null) group.maxImportance = Math.max(group.maxImportance || 0,importance);
      group.pairs.push({from,to,importance,id:edge.id});
    }
    const links = [...groups.values()].sort((a,b)=>a.from-b.from || a.to-b.to);
    links.forEach(g=>g.pairs.sort((a,b)=>(b.importance || 0)-(a.importance || 0) || a.from.title.localeCompare(b.from.title)));
    return {links,unmapped};
  }
  let highOnly = false, focusGate = null, selected = null;
  const description = g => `Gate ${g.from} → Gate ${g.to}: ${g.count} blocker dependenc${g.count===1?'y':'ies'}; highest importance ${g.maxImportance ?? 'not specified'}`;
  function mount(host,data,openBlocker) {
    const gates = [...data.stageGates].sort((a,b)=>a.id-b.id);
    if (!gates.some(g=>g.id===focusGate)) focusGate = null;
    const {links,unmapped} = aggregate(data,highOnly);
    const visible = links.filter(g=>focusGate===null || g.from===focusGate || g.to===focusGate);
    if (!visible.some(g=>g.key===selected)) selected = null;
    const active = visible.find(g=>g.key===selected);
    const positions = new Map(gates.map((g,i)=>[g.id,100+i*200]));
    const width = Math.max(1200,gates.length*200), y=300;
    const maxCount = Math.max(1,...links.map(g=>g.count));
    const weight = count => 1.5 + 9.5 * count / maxCount;
    const svgLinks = visible.filter(g=>g.from!==g.to).map(g=>{
      const x1=positions.get(g.from),x2=positions.get(g.to),later=g.to>g.from;
      const startY=later?y-54:y+54;
      const controlY=startY+(later?-1:1)*(65+Math.abs(g.to-g.from)*66);
      const d=`M ${x1} ${startY} Q ${(x1+x2)/2} ${controlY} ${x2} ${startY}`;
      const color=colors[g.maxImportance] || '#8293a2';
      return `<g class="sg-link ${selected===g.key?'selected':''}" role="button" tabindex="0" data-sg-link="${g.key}" aria-label="${esc(description(g))}${later?'; dependency on a later stage':''}" aria-pressed="${selected===g.key}"><title>${esc(description(g))}${later?' — Dependency on a later stage':''}</title><path class="sg-hit" d="${d}"/><path class="sg-line" d="${d}" stroke="${color}" stroke-width="${weight(g.count)}" marker-end="url(#sg-arrow-${g.maxImportance || 0})"/></g>`;
    }).join('');
    function labelLines(text) {
      const lines=[''];
      for(const word of text.split(' ')) { if ((lines.at(-1)+' '+word).trim().length>23) lines.push(word); else lines[lines.length-1]=(lines.at(-1)+' '+word).trim(); }
      return lines;
    }
    const svgNodes = gates.map(g=>{
      const x=positions.get(g.id),within=visible.find(l=>l.from===g.id&&l.to===g.id);
      return `<g class="sg-node ${focusGate===g.id?'focused':''}" role="button" tabindex="0" data-sg-gate="${g.id}" aria-label="Focus Gate ${g.id}: ${esc(g.label)}" aria-pressed="${focusGate===g.id}"><rect x="${x-88}" y="${y-50}" width="176" height="100" rx="12"/><text x="${x}" y="${y-28}" class="sg-node-id">Gate ${g.id}</text>${labelLines(g.label).map((line,i)=>`<text x="${x}" y="${y-6+i*17}" class="sg-node-label">${esc(line)}</text>`).join('')}</g>${within?`<g class="sg-within" role="button" tabindex="0" data-sg-link="${within.key}" aria-label="${esc(description(within))}; within this gate" aria-pressed="${selected===within.key}"><rect x="${x-74}" y="${y+64}" width="148" height="25" rx="12" fill="${colors[within.maxImportance] || '#8293a2'}"/><text x="${x}" y="${y+81}">${within.count} within this gate ↻</text></g>`:''}`;
    }).join('');
    host.innerHTML = `<section class="page sg-page"><p class="eyebrow">Stage Gate dependencies</p><h2>See the connections across stages.</h2><p class="lead">Follow dependencies between stages, then inspect the blocker relationships behind each connection.</p>
      <div class="sg-toolbar"><label><input id="sg-high" type="checkbox" ${highOnly?'checked':''}> Only importance 3–4</label><label>Focus on a gate <select id="sg-focus"><option value="">All gates</option>${gates.map(g=>`<option value="${g.id}" ${focusGate===g.id?'selected':''}>Gate ${g.id} — ${esc(g.label)}</option>`).join('')}</select></label></div>
      <div class="sg-legend"><strong>Colour = highest importance in the connection</strong>${[1,2,3,4].map(n=>`<span><i style="background:${colors[n]}"></i>${n}</span>`).join('')}<span>1 = lowest · 4 = highest</span><strong>Line thickness = number of blocker dependencies</strong></div>
      <p class="sg-reading">A → B means that blockers in Gate A depend on blockers in Gate B. Select a curve to see the pairs. All counts and colours reflect the active filters.</p>
      <p class="sg-summary" role="status">${visible.reduce((n,g)=>n+g.count,0)} blocker dependencies · ${visible.filter(g=>g.from!==g.to).length} connections between gates · ${visible.filter(g=>g.to>g.from).reduce((n,g)=>n+g.count,0)} dependencies on later stages${unmapped?` · ${unmapped} dependencies omitted because a gate is not assigned`:''}</p>
      <div class="sg-scroll" role="region" aria-label="Stage Gate dependency map; scroll horizontally on small screens" tabindex="0"><svg class="sg-map ${selected?'has-selection':''}" viewBox="0 0 ${width} 640" aria-label="Stage Gates in sequence, with directional dependency curves"><defs>${[0,1,2,3,4].map(n=>`<marker id="sg-arrow-${n}" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L12,6 L0,12 Z" fill="${colors[n] || '#8293a2'}"/></marker>`).join('')}</defs><text x="20" y="24" class="sg-map-caption">DEPENDENCIES ON LATER STAGES →</text><text x="20" y="620" class="sg-map-caption">← DEPENDENCIES ON EARLIER STAGES</text>${svgLinks}${svgNodes}</svg></div>
      <p class="sg-reading sg-mobile-note">On a small screen, scroll the map sideways or use the connection list below.</p>
      <details class="sg-connections"><summary>Connection list (${visible.length}, including within-gate relationships)</summary><div class="sg-connection-list">${visible.map(g=>`<button data-sg-link="${g.key}" aria-pressed="${selected===g.key}">Gate ${g.from} → Gate ${g.to}<span>${g.count} pairs · max importance ${g.maxImportance ?? 'unspecified'}${g.to>g.from?' · Later stage':''}</span></button>`).join('') || '<p>No dependencies match these filters.</p>'}</div></details>
      <section class="sg-detail" aria-labelledby="sg-detail-heading" tabindex="-1">${active?detail(active):'<h3 id="sg-detail-heading">Inspect a connection</h3><p>Select a curve, a “within this gate” badge, or an item in the connection list to see its blocker pairs.</p>'}</section>
      <aside class="sg-explanation"><h3>How to read dependencies on later stages</h3><p>A connection such as Gate 0 → Gate 4 records a dependency between specific blockers. It does <strong>not automatically mean that the whole of Gate 4 must be completed before Gate 0</strong>.</p><p>It may indicate a capability that needs to be anticipated, a learning cycle between stages, or a gate assignment or dependency direction worth reviewing. These are possible interpretations, not automatic errors.</p></aside></section>`;
    function detail(g) {
      return `<h3 id="sg-detail-heading">Gate ${g.from} → Gate ${g.to}</h3><p>${g.count} blocker dependenc${g.count===1?'y':'ies'} · Highest importance: ${g.maxImportance ?? 'not specified'}${g.to>g.from?' <span class="sg-later">Dependency on a later stage</span>':g.to===g.from?' · Within the same stage':''}</p><div class="sg-table-scroll"><table><caption>Blocker relationships behind this connection${highOnly?' — importance 3–4 only':''}</caption><thead><tr><th scope="col">Dependent blocker</th><th scope="col">Gate</th><th scope="col">Depends on</th><th scope="col">Gate</th><th scope="col">Importance</th></tr></thead><tbody>${g.pairs.map(p=>`<tr><td><button data-sg-blocker="${p.from.id}">${esc(p.from.title)}</button></td><td>${p.from.stageGate}</td><td><button data-sg-blocker="${p.to.id}">${esc(p.to.title)}</button></td><td>${p.to.stageGate}</td><td><span class="sg-importance" style="border-color:${colors[p.importance] || '#8293a2'}">${p.importance ?? 'Not specified'}</span></td></tr>`).join('')}</tbody></table></div>`;
    }
    const rerender = () => { mount(host,data,openBlocker); };
    host.querySelector('#sg-high').onchange = e => {highOnly=e.target.checked;rerender();host.querySelector('#sg-high').focus({preventScroll:true});};
    host.querySelector('#sg-focus').onchange = e => {focusGate=e.target.value===''?null:Number(e.target.value);rerender();host.querySelector('#sg-focus').focus({preventScroll:true});};
    function action(selector,fn) {
      host.querySelectorAll(selector).forEach(el=>{
        el.addEventListener('click',()=>fn(el));
        if(el.tagName.toLowerCase()==='g') el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn(el);}});
      });
    }
    action('[data-sg-link]',el=>{selected=el.dataset.sgLink;rerender();const panel=host.querySelector('.sg-detail');panel.focus({preventScroll:true});panel.scrollIntoView({behavior:'instant',block:'nearest'});});
    action('[data-sg-gate]',el=>{const id=Number(el.dataset.sgGate);focusGate=focusGate===id?null:id;rerender();host.querySelector('#sg-focus').focus({preventScroll:true});});
    action('[data-sg-blocker]',el=>openBlocker(Number(el.dataset.sgBlocker)));
    root.stageDependencyNavigation?.();
  }
  root.StageDependencies = {aggregate,mount};
})(typeof window === 'undefined' ? globalThis : window);
