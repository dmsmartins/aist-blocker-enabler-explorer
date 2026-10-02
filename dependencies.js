/* Dependency importance belongs to each relationship, not to the blocker. */
(function (root) {
  'use strict';
  const palette = {1: '#7893aa', 2: '#2489a8', 3: '#bc7316', 4: '#b74468'};
  const importance = edge => [1, 2, 3, 4].includes(edge.dependencyImportance) ? edge.dependencyImportance : null;
  function connections(data, id, minimum = 0) {
    const byId = new Map(data.blockers.map(b => [b.id, b]));
    const result = {upstream: [], downstream: []};
    for (const edge of data.blockerDependencies || []) {
      const level = importance(edge);
      if (minimum && (level === null || level < minimum)) continue;
      if (edge.blockerId === id && byId.has(edge.dependsOnBlockerId)) result.upstream.push({blocker: byId.get(edge.dependsOnBlockerId), edge, level});
      if (edge.dependsOnBlockerId === id && byId.has(edge.blockerId)) result.downstream.push({blocker: byId.get(edge.blockerId), edge, level});
    }
    for (const list of Object.values(result)) list.sort((a, b) => (b.level || 0) - (a.level || 0) || a.blocker.title.localeCompare(b.blocker.title));
    return result;
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  let selectedId = null, minimum = 0, direction = 'both', cleanup = () => {};

  function mount(host, data, openDetails) {
    cleanup();
    const blockers = [...data.blockers].sort((a, b) => a.title.localeCompare(b.title));
    if (!blockers.length) { host.innerHTML = '<section class="page"><h2>Dependencies</h2><p>No blockers available.</p></section>'; return; }
    if (!blockers.some(b => b.id === selectedId)) selectedId = blockers[0].id;
    const selected = blockers.find(b => b.id === selectedId);
    const all = connections(data, selectedId);
    const shown = connections(data, selectedId, minimum);
    const count = shown.upstream.length + shown.downstream.length;
    const card = ({blocker, edge, level}, side) => `<button class="dep-card" data-dep-node="${blocker.id}" data-dep-side="${side}" data-dep-level="${level || 0}" style="--dep-color:${palette[level] || '#8293a2'}" aria-label="${esc(blocker.title)}. ${side === 'upstream' ? 'Selected blocker depends on this' : 'Depends on selected blocker'}. Importance ${level ?? 'not specified'}. Explore dependencies."><span class="dep-domain">${esc(data.domains?.find(d => d.slug === blocker.domain)?.title || blocker.cluster)}</span><strong>${esc(blocker.title)}</strong><span class="dep-card-footer"><span class="dep-badge">Importance ${level ?? 'not specified'}</span><span aria-hidden="true">Explore →</span></span></button>`;
    const column = (side, title, description) => `<section class="dep-column dep-${side}"><h3>${title} <span>${shown[side].length}</span></h3><p>${description}</p><div class="dep-stack">${shown[side].map(item => card(item, side)).join('') || '<div class="dep-empty">' + (all[side].length ? 'No dependencies match this importance filter.' : 'No dependencies mapped in this direction.') + '</div>'}</div></section>`;
    host.innerHTML = `<section class="page dep-page"><p class="eyebrow">Dependency explorer</p><h2>See what depends on what.</h2><p class="lead">Explore the blockers behind a blocker, and the blockers that rely on it. Select any connected blocker to follow the chain.</p>
      <div class="dep-controls"><label class="dep-select-blocker">Selected blocker<select id="dep-blocker">${blockers.map(b => `<option value="${b.id}" ${b.id === selectedId ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></label><label>Importance<select id="dep-minimum">${[[0,'All importance levels'],[1,'1 and above'],[2,'2 and above'],[3,'3 and above'],[4,'4 only']].map(([value,label]) => `<option value="${value}" ${minimum === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Direction<select id="dep-direction">${[['both','Both directions'],['upstream','Depends on'],['downstream','Depended on by']].map(([value,label]) => `<option value="${value}" ${direction === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
      <div class="dep-legend"><strong>Dependency importance</strong>${[1,2,3,4].map(n => `<span><i style="background:${palette[n]};height:${n * 2}px"></i>${n}</span>`).join('')}<span>1 = lowest · 4 = highest</span></div>
      <p class="dep-reading">Arrows point from a blocker to the blocker it depends on. Thicker lines mean greater importance of that dependency.</p>
      <div class="dep-summary" role="status">${all.upstream.length} dependencies · ${all.downstream.length} dependents${minimum ? ` · ${count} connections match importance ≥ ${minimum}` : ''}. Direct connections only; cycles can appear in both directions.</div>
      <div class="dep-map dep-direction-${direction}"><svg class="dep-lines" aria-hidden="true"></svg>
      ${direction !== 'downstream' ? column('upstream','Depends on','The selected blocker depends on these blockers.') : ''}
      <section class="dep-focus"><span class="eyebrow">Selected blocker</span><h3>${esc(selected.title)}</h3><p>${esc(selected.statement)}</p><button class="outline-btn" id="dep-details">View blocker details →</button></section>
      ${direction !== 'upstream' ? column('downstream','Depended on by','These blockers depend on the selected blocker.') : ''}</div>
      <p class="dep-footnote">Importance describes each dependency, not an overall score for a blocker. Values come from the source workbook.</p></section>`;
    const redraw = (focusSelector) => { mount(host, data, openDetails); if (focusSelector) host.querySelector(focusSelector)?.focus({preventScroll:true}); };
    host.querySelector('#dep-blocker').onchange = event => { selectedId = Number(event.target.value); redraw('#dep-blocker'); };
    host.querySelector('#dep-minimum').onchange = event => { minimum = Number(event.target.value); redraw('#dep-minimum'); };
    host.querySelector('#dep-direction').onchange = event => { direction = event.target.value; redraw('#dep-direction'); };
    host.querySelectorAll('[data-dep-node]').forEach(button => button.onclick = () => { selectedId = Number(button.dataset.depNode); redraw('#dep-blocker'); });
    host.querySelector('#dep-details').onclick = () => openDetails(selectedId);
    const map = host.querySelector('.dep-map'), svg = host.querySelector('.dep-lines');
    function draw() {
      if (!map.isConnected) { cleanup(); return; }
      const bounds = map.getBoundingClientRect(), center = host.querySelector('.dep-focus').getBoundingClientRect();
      const vertical = window.matchMedia('(max-width: 760px)').matches;
      svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      svg.innerHTML = `<defs>${[0,1,2,3,4].map(n => `<marker id="dep-arrow-${n}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 Z" fill="${palette[n] || '#8293a2'}"/></marker>`).join('')}</defs>`;
      host.querySelectorAll('[data-dep-node]').forEach(button => {
        const rect = button.getBoundingClientRect(), up = button.dataset.depSide === 'upstream', n = Number(button.dataset.depLevel);
        let x1, y1, x2, y2, curve;
        if (vertical) {
          // On small screens columns stack; short connectors retain direction without crossing cards.
          x1 = rect.left - bounds.left - 12; x2 = x1;
          y1 = rect.bottom - bounds.top;
          y2 = rect.top - bounds.top + 8;
          curve = `M${x1},${y1} L${x2},${y2}`;
        } else {
          x1 = (up ? center.left : rect.left) - bounds.left;
          y1 = (up ? center.top + center.height / 2 : rect.top + rect.height / 2) - bounds.top;
          x2 = (up ? rect.right : center.right) - bounds.left + 4;
          y2 = (up ? rect.top + rect.height / 2 : center.top + center.height / 2) - bounds.top;
          const middle = (x1 + x2) / 2;
          curve = `M${x1},${y1} C${middle},${y1} ${middle},${y2} ${x2},${y2}`;
        }
        svg.insertAdjacentHTML('beforeend', `<path d="${curve}" fill="none" stroke="${palette[n] || '#8293a2'}" stroke-width="${n ? 1 + n * 1.3 : 1.5}" opacity=".85" marker-end="url(#dep-arrow-${n})"/>`);
      });
    }
    const observer = new ResizeObserver(draw); observer.observe(map);
    cleanup = () => observer.disconnect();
    requestAnimationFrame(draw);
    root.stageDependencyNavigation?.();
  }
  root.DependencyExplorer = {mount, connections, importance};
})(typeof window === 'undefined' ? globalThis : window);
