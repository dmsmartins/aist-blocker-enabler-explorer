(async function () {
  const app = document.getElementById('app'), esc = AssessmentViews.escape;
  try {
    const response = await fetch('../data/explorer_catalog.json');
    if (!response.ok) throw new Error('Catalogue unavailable.');
    const catalog = await response.json();
    const id = new URLSearchParams(location.search).get('id');
    const blocker = catalog.blockers.find(b => String(b.blocker_id) === id);
    if (!blocker) throw new Error('Blocker not found.');
    document.title = `${blocker.title} · AI Scalability Explorer`;
    app.innerHTML = `<p class="eyebrow">${esc(blocker.stage_gate)}</p><h1>${esc(blocker.title)}</h1><p>${esc(blocker.statement)}</p><section class="panel"><h2>Why it matters</h2><p>${esc(blocker.why_it_matters)}</p><h2>Consequence</h2><p>${esc(blocker.consequence)}</p></section>`;
  } catch (error) { app.innerHTML = `<h1>Unable to open blocker</h1><p>${esc(error.message)}</p>`; }
})();
