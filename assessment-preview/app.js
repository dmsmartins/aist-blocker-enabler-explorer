(async function () {
  'use strict';
  const M = AssessmentPreview, V = AssessmentViews;
  const app = document.getElementById('app'), status = document.getElementById('storage-status');
  const STORE = 'aistQuestionnairePreviewV1';
  const esc = V.escape, now = () => new Date().toISOString();
  const title = q => `${q.assessment_type === 'company' ? 'Company' : 'Project'} · ${q.mode === 'quick' ? 'Quick' : 'Expert'}`;
  const levels = ['Absent', 'Recognised', 'Defined / tested locally', 'Implemented', 'Measured / sustained'];
  let current, catalog, session, view = 'home', store = { catalogs: {}, sessions: [] }, storageBlocked = false;
  function persist() {
    if (storageBlocked) return;
    try { localStorage.setItem(STORE, JSON.stringify(store)); status.textContent = 'Saved in this browser'; }
    catch { status.textContent = 'Browser storage is full or unavailable. Keep this tab open; these answers cannot be restored after closing.'; }
  }
  function touch() { session.updated_at = now(); persist(); }
  function on(selector, callback) { app.querySelector(selector)?.addEventListener('click', callback); }
  function go(next) { view = next; render(); app.focus(); window.scrollTo(0, 0); }
  function start(q) {
    catalog = current;
    session = M.create(catalog, q, crypto.randomUUID(), now());
    session.scoring_basis = 'self_report_preview';
    store.catalogs[catalog.catalog_version] = catalog;
    store.sessions.push(session);
    persist(); go('questions');
  }
  function resume(index, next = 'questions') {
    try {
      session = store.sessions[index]; catalog = store.catalogs[session.catalog_version];
      M.validate(catalog); M.validateAssessment(catalog, session);
      // Preserve historical evidence-based evaluations when changing preview policy.
      if (session.scoring_basis !== 'self_report_preview') {
        const old = session;
        session = structuredClone(old);
        session.assessment_id = crypto.randomUUID();
        session.source_assessment_id = old.assessment_id;
        session.scoring_basis = 'self_report_preview';
        session.created_at = now();
        for (const q of M.questionnaire(catalog, session).questions) session.answers[q.question_id].effective_weight = q.default_weight;
        store.sessions.push(session); touch();
      }
      go(next);
    } catch (e) { status.textContent = `Cannot open this saved evaluation: ${e.message}`; }
  }
  function home() {
    app.innerHTML = `<p class="eyebrow">Maturity assessment · Preview</p><h1>Where are you ready to scale?</h1>
      <p class="muted">Choose a questionnaire and start answering.</p><div class="cards">${current.questionnaires.map((q, i) => `
      <section class="card"><p class="eyebrow">${esc(q.assessment_type)}</p><h2>${q.mode === 'quick' ? 'Quick overview' : 'Expert assessment'}</h2>
      <p>${q.questions.length} questions</p><button class="primary" data-start="${i}">Start ${esc(title(q))}</button></section>`).join('')}</div>
      ${store.sessions.length ? `<section class="panel"><h2>Continue an assessment</h2><div class="drafts">${store.sessions.map((s, i) => `
      <button data-resume="${i}">${esc(title(s))} <small>${esc(s.updated_at?.slice(0, 10))}</small></button>`).join('')}</div></section>` : ''}`;
    app.querySelectorAll('[data-start]').forEach(b => b.onclick = () => start(current.questionnaires[Number(b.dataset.start)]));
    app.querySelectorAll('[data-resume]').forEach(b => b.onclick = () => resume(Number(b.dataset.resume)));
  }
  function questions() {
    const q = M.questionnaire(catalog, session);
    session.current_step = Math.max(0, Math.min(Number.isInteger(session.current_step) ? session.current_step : 0, q.questions.length - 1));
    const question = q.questions[session.current_step], answer = session.answers[question.question_id];
    const answered = Object.values(session.answers).filter(a => a.score !== null || a.applicability === 'not_applicable').length;
    app.innerHTML = `<div class="tools"><button id="home">← Questionnaires</button><button id="results">Results</button></div>
      <p class="eyebrow">${esc(title(q))}</p><progress max="${q.questions.length}" value="${answered}" aria-label="Questions answered"></progress>
      <section class="question"><p class="eyebrow">Question ${session.current_step + 1} of ${q.questions.length}</p><h2>${esc(question.text)}</h2>
      <p class="muted">${q.mode === 'quick' ? 'Choose the lowest level that applies across all parts of this question.' : 'Choose the level that best describes your current practice.'}</p>
      <fieldset><legend class="sr-only">Maturity level</legend>${levels.map((label, n) => `
      <label class="option"><input type="radio" name="score" value="${n}" ${answer.applicability === 'applicable' && answer.score === n ? 'checked' : ''}>
      <span><strong>Level ${n}</strong>${label}</span></label>`).join('')}
      <label class="option"><input type="radio" name="score" value="unknown" ${answer.applicability === 'undecided' ? 'checked' : ''}><span>Not sure / skip for now</span></label>
      <label class="option"><input type="radio" name="score" value="na" ${answer.applicability === 'not_applicable' ? 'checked' : ''}><span>Not applicable${q.mode === 'quick' ? ' to any part of this question' : ''}</span></label></fieldset>
      <div class="tools"><button id="previous" ${session.current_step === 0 ? 'disabled' : ''}>← Previous</button><button class="primary" id="next">${session.current_step === q.questions.length - 1 ? 'See results' : 'Next →'}</button></div></section>`;
    on('#home', () => go('home')); on('#results', () => go('results'));
    app.querySelectorAll('[name=score]').forEach(input => input.onchange = () => {
      answer.score = ['unknown', 'na'].includes(input.value) ? null : Number(input.value);
      answer.applicability = input.value === 'na' ? 'not_applicable' : input.value === 'unknown' ? 'undecided' : 'applicable';
      answer.updated_at = now(); touch();
      app.querySelector('progress').value = Object.values(session.answers).filter(a => a.score !== null || a.applicability === 'not_applicable').length;
    });
    on('#previous', () => { session.current_step--; touch(); go('questions'); });
    on('#next', () => { if (session.current_step === q.questions.length - 1) go('results'); else { session.current_step++; touch(); go('questions'); } });
  }
  function results() {
    const q = M.questionnaire(catalog, session), report = M.report(catalog, session);
    app.innerHTML = `<div class="tools"><button id="back">← Questions</button><button id="home">Questionnaires</button></div>
      <p class="eyebrow">${esc(title(q))}</p><h1>Your scalability profile</h1>
      <section class="radar-panel">${V.radar(V.gateAxes(report))}<p class="muted radar-caption">${report.rows.filter(r => r.status === 'valid').length}/${q.questions.length} questions answered${report.counts.not_applicable ? ` · ${report.counts.not_applicable} not applicable` : ''}.
      ${report.partial ? 'Partial profile — unanswered areas are left blank.' : ''} Self-reported preview.</p></section>
      <div class="tools result-actions"><button class="primary" id="timeline">Explore my timeline →</button><button id="pdf">PDF · recommended enablers</button></div>
      <section class="pdf-only"><h2>Enablers to develop</h2><p>${report.partial ? 'Recommendations reflect the answered questions only.' : 'Recommendations reflect the reported gaps.'} Scores do not imply blocker closure.</p>
      ${V.enablerReport(report, catalog, new URL("../", location.href))}</section>`;
    on('#back', () => go('questions')); on('#home', () => go('home'));
    on('#timeline', () => {
      try {
        sessionStorage.setItem('aistQuestionnaireTimelineV1', JSON.stringify(V.timeline(catalog, report, session)));
        window.location.href = `../timeline/?assessment=questionnaire&id=${encodeURIComponent(session.assessment_id)}`;
      } catch { status.textContent = 'Unable to open the timeline: browser session storage is unavailable.'; }
    });
    on('#pdf', () => window.print());
  }
  function render() { if (view === 'home') home(); else if (view === 'questions') questions(); else results(); }
  try {
    const response = await fetch('../data/explorer_catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
    current = M.validate(await response.json());
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { const saved = JSON.parse(raw); if (!saved.catalogs || !Array.isArray(saved.sessions)) throw new Error('Invalid saved data'); store = saved; }
    } catch { storageBlocked = true; status.textContent = 'Existing drafts could not be read. They have not been overwritten.'; }
    const id = new URLSearchParams(location.search).get('resume');
    const index = store.sessions.findIndex(s => s.assessment_id === id);
    if (id && index >= 0) resume(index, 'results'); else render();
  } catch (error) { app.innerHTML = `<h1>Unable to open assessment</h1><p>${esc(error.message)}</p>`; }
})();
