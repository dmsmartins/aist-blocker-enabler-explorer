const host = document.querySelector('#app');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = d => `${d.blockerId}:${d.dependsOnBlockerId}`;
const read = async url => { const r = await fetch(url, {cache:'no-cache'}); if (!r.ok) throw new Error(`Could not load ${url} (HTTP ${r.status})`); return r.json(); };

try {
  const [original, updated] = await Promise.all([read('../data/explorer-data.json'), read('../data/new-dependencies/explorer-data.json')]);
  const old = new Map(original.blockerDependencies.map(d => [key(d), d]));
  const fresh = new Map(updated.blockerDependencies.map(d => [key(d), d]));
  const blockerById = new Map(updated.blockers.map(b => [b.id,b]));
  const name = id => blockerById.get(id)?.title || `Blocker ${id}`;
  const keys = [...new Set([...old.keys(), ...fresh.keys()])];
  const state = k => old.has(k) && fresh.has(k) ? 'Retained' : fresh.has(k) ? 'Added' : 'Removed';
  const counts = {Retained:0, Added:0, Removed:0};
  keys.forEach(k => counts[state(k)]++);
  const degree = id => keys.filter(k => {const e=fresh.get(k) || old.get(k); return e.blockerId===id || e.dependsOnBlockerId===id;}).length;
  const sorted = [...updated.blockers].sort((a,b) => a.title.localeCompare(b.title));
  const initial = [...updated.blockers].sort((a,b) => degree(b.id)-degree(a.id))[0]?.id;
  host.innerHTML = `
    <section class="metrics" aria-label="Comparison totals">
      <div><strong>${old.size}</strong><span>Original links</span></div><div><strong>${fresh.size}</strong><span>New links</span></div>
      <div><strong>${counts.Retained}</strong><span>Retained</span></div><div><strong>${counts.Added}</strong><span>Added</span></div><div><strong>${counts.Removed}</strong><span>Removed</span></div>
    </section>
    <p class="notice">The community names and blocker membership in the workbook are unchanged. The updated dependency links differ. The new 1–4 values were converted from a 0–1 source measure; they should not automatically be interpreted as the same measure as the original importance scores.</p>
    <section class="panel"><div id="network"></div></section>
    <section class="panel"><h2>Compare a blocker</h2><p>Select a blocker to see its incoming and outgoing links in both versions.</p>
      <label for="blocker">Blocker</label><select id="blocker">${sorted.map(b=>`<option value="${b.id}" ${b.id===initial?'selected':''}>${escapeHtml(b.title)} (${b.id})</option>`).join('')}</select>
      <div class="columns" id="columns"></div>
    </section>
    <section class="panel"><h2>All dependency pairs</h2><p>Each row is a directed pair. Reversing a pair is a separate relationship.</p>
      <div class="filters"><label>Change<select id="change"><option value="all">All changes</option><option>Added</option><option>Removed</option><option>Retained</option></select></label><label>Search<input id="search" type="search" placeholder="Blocker name or ID"></label></div>
      <p id="result-count" class="result-count"></p>
      <div class="table-wrap"><table><thead><tr><th>Dependent blocker A</th><th>Depends on B</th><th>Change</th><th>Original level</th><th>New level</th></tr></thead><tbody id="rows"></tbody></table></div>
    </section>`;
  const blocker = document.querySelector('#blocker'), change = document.querySelector('#change'), search = document.querySelector('#search');
  window.DependencyExplorer.mount(document.querySelector('#network'), updated, id => { window.location.href = `../new-communities/#blocker=${id}`; });
  const badge = s => `<span class="badge ${s.toLowerCase()}">${s}</span>`;
  function renderColumns() {
    const id=Number(blocker.value);
    const list = (map, version) => {
      const edges=[...map.entries()].filter(([,e])=>e.blockerId===id || e.dependsOnBlockerId===id).sort((a,b)=>name(a[1].blockerId===id?a[1].dependsOnBlockerId:a[1].blockerId).localeCompare(name(b[1].blockerId===id?b[1].dependsOnBlockerId:b[1].blockerId)));
      return `<article class="version"><h3>${version} <span>${edges.length} links</span></h3>${edges.length?edges.map(([k,e])=>`<div class="connection"><div><strong>${e.blockerId===id?'Depends on':'Depended on by'}:</strong> ${escapeHtml(name(e.blockerId===id?e.dependsOnBlockerId:e.blockerId))} <small>(${e.blockerId===id?e.dependsOnBlockerId:e.blockerId})</small></div><div>${badge(state(k))} <small>Level: ${escapeHtml(e.dependencyImportance ?? '—')}</small></div></div>`).join(''):'<p>No links for this blocker.</p>'}</article>`;
    };
    document.querySelector('#columns').innerHTML=list(old,'Original')+list(fresh,'New');
  }
  function renderRows() {
    const q=search.value.trim().toLocaleLowerCase();
    const filtered=keys.filter(k=>{const e=fresh.get(k)||old.get(k); return (change.value==='all'||state(k)===change.value)&&(`${name(e.blockerId)} ${name(e.dependsOnBlockerId)} ${e.blockerId} ${e.dependsOnBlockerId}`).toLocaleLowerCase().includes(q);}).sort((a,b)=>{let x=fresh.get(a)||old.get(a),y=fresh.get(b)||old.get(b); return name(x.blockerId).localeCompare(name(y.blockerId))||name(x.dependsOnBlockerId).localeCompare(name(y.dependsOnBlockerId));});
    document.querySelector('#result-count').textContent=`${filtered.length} of ${keys.length} directed pairs`;
    document.querySelector('#rows').innerHTML=filtered.map(k=>{const e=fresh.get(k)||old.get(k);return `<tr><td>${escapeHtml(name(e.blockerId))} <small>(${e.blockerId})</small></td><td>${escapeHtml(name(e.dependsOnBlockerId))} <small>(${e.dependsOnBlockerId})</small></td><td>${badge(state(k))}</td><td>${escapeHtml(old.get(k)?.dependencyImportance ?? '—')}</td><td>${escapeHtml(fresh.get(k)?.dependencyImportance ?? '—')}</td></tr>`;}).join('') || '<tr><td colspan="5">No pairs match these filters.</td></tr>';
  }
  blocker.addEventListener('change',renderColumns); change.addEventListener('change',renderRows); search.addEventListener('input',renderRows); renderColumns(); renderRows();
} catch (error) {
  host.textContent = `Could not load the comparison: ${error.message}`;
}
