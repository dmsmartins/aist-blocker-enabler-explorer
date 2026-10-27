(async function () {
  'use strict';
  const M = AssessmentPreview, V = AssessmentViews;
  const app = document.getElementById('app'), status = document.getElementById('storage-status');
  const STORE = 'aistQuestionnairePreviewV1';
  const esc = V.escape, now = () => new Date().toISOString();
  const title = q => `${q.assessment_type === 'company' ? 'Company' : 'Project'} · ${q.mode === 'quick' ? 'Quick' : 'Expert'}`;
  const levels = ['Absent', 'Recognised', 'Defined / tested locally', 'Implemented', 'Measured / sustained'];
  let selectedScope = 'company', nameDraft = null;
  let coffeeTimer, radarKind = 'stage_gate', radarDimension = 'Organisational';
  let current, catalog, session, view = 'home', store = { catalogs: {}, sessions: [] }, storageBlocked = false;
  function persist() {
    if (storageBlocked) return false;
    try { localStorage.setItem(STORE, JSON.stringify(store)); status.textContent = 'Saved in this browser'; return true; }
    catch { status.textContent = 'Browser storage is full or unavailable. Keep this tab open; these answers cannot be restored after closing.'; return false; }
  }
  function touch() { session.updated_at = now(); persist(); }
  function on(selector, callback) { app.querySelector(selector)?.addEventListener('click', callback); }
  function go(next) { clearInterval(coffeeTimer); view = next; render(); app.focus(); window.scrollTo(0, 0); }
  function coffee(q) {
    clearInterval(coffeeTimer);
    view = 'coffee';
    let remaining = 10;
    const deadline = Date.now() + 10000;
    app.innerHTML = `<section class="coffee-break"><p class="eyebrow">${esc(title(q))}</p>
      <div class="coffee-art" aria-hidden="true">
        <span class="steam steam-one"></span><span class="steam steam-two"></span><span class="steam steam-three"></span>
        <svg class="coffee-illustration" viewBox="0 0 160 145" focusable="false">
          <defs><linearGradient id="cup-glaze" x1="0" x2="1"><stop stop-color="#2789b1"/><stop offset="1" stop-color="#16577c"/></linearGradient></defs>
          <ellipse cx="77" cy="134" rx="69" ry="6" fill="#c5dde8"/>
          <path d="M122 76 C159 69 159 119 124 115" fill="none" stroke="#1c6e94" stroke-width="8"/>
          <path d="M25 65 C25 51 125 51 125 65 L125 87 C125 113 106 129 75 129 C44 129 25 113 25 87 Z" fill="url(#cup-glaze)"/>
          <path d="M29 70 L29 87 C29 106 40 118 55 123" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>
          <ellipse cx="75" cy="65" rx="50" ry="11" fill="#e1edf0"/>
          <ellipse cx="75" cy="65" rx="45" ry="7.5" fill="#614330"/>
        </svg>
      </div>
      <h1>Grab a coffee.</h1><p class="coffee-estimate">This will take approx. <strong>${q.mode === 'quick' ? '15' : '30'} minutes.</strong></p>
      <p class="muted">Take a breath. Your questionnaire is about to begin.</p>
      <div class="coffee-countdown" role="timer" aria-label="Seconds until the questionnaire begins"><span id="coffee-seconds">10</span><small>seconds</small></div>
      <p class="sr-only" role="status">The questionnaire starts automatically in 10 seconds. You can start now or go back.</p>
      <div class="tools"><button class="primary" id="coffee-start">Start now →</button><button id="coffee-back">← Back</button></div></section>`;
    app.focus(); window.scrollTo(0, 0);
    const begin = () => { if (view !== 'coffee') return; clearInterval(coffeeTimer); start(q); };
    on('#coffee-start', begin); on('#coffee-back', () => go('depth'));
    coffeeTimer = setInterval(() => {
      remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      const counter = document.getElementById('coffee-seconds');
      if (counter) counter.textContent = remaining;
      if (remaining === 0) begin();
    }, 200);
  }
  function start(q) {
    catalog = current; radarKind = 'stage_gate'; nameDraft = null;
    session = M.create(catalog, q, crypto.randomUUID(), now());
    session.scoring_basis = 'self_report_preview';
    store.catalogs[catalog.catalog_version] = catalog;
    store.sessions.push(session);
    persist(); go('questions');
  }
  function resume(index, next = 'questions') {
    try {
      radarKind = 'stage_gate'; nameDraft = null; session = store.sessions[index]; catalog = store.catalogs[session.catalog_version];
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
    const icon = scope => scope === 'company'
      ? '<path d="M4 21V7h10v14M14 11h6v10M8 11h2m-2 4h2M2 21h20M8 7V3h6v4"/>'
      : '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3M3 11h18M10 11v3h4v-3"/>';
    app.innerHTML = `<p class="eyebrow">Maturity assessment · Step 1 / 2</p><h1>What do you want to assess?</h1>
      <p class="muted">Choose whether to assess your organisation or a specific project.</p>
      <div class="cards scope-cards">${['company','project'].map(scope=>`<button class="scope-card ${scope}" data-scope="${scope}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icon(scope)}</svg><span class="eyebrow">${scope==='company'?'Company':'Project'} Assessment</span>
      <span class="scope-heading">${scope==='company'?'Assess your organisation':'Assess a specific project or initiative'}</span>
      <span class="scope-description">${scope==='company'?'Evaluate organisational maturity, capabilities and readiness to scale.':'Evaluate maturity, blockers and enablers for a specific project.'}</span><span class="scope-link">Choose assessment depth →</span></button>`).join('')}</div>
      ${store.sessions.length ? `<section class="panel"><h2>Your assessments</h2><div class="drafts">${store.sessions.map((s,i)=>`
      <button data-resume="${i}"><strong>${esc(M.displayName(s))}</strong><small>${esc(title(s))} · ${esc((s.completed_at||s.updated_at||s.created_at||'').slice(0,10))}${s.completed_at?' · Completed':' · In progress'}</small></button>`).join('')}</div></section>` : ''}`;
    app.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{selectedScope=b.dataset.scope;go('depth');});
    app.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.resume);resume(i,store.sessions[i].assessment_name?'results':'questions');});
  }
  function depth() {
    app.innerHTML=`<button id="scope-back">← Assessment scope</button><p class="eyebrow depth-label ${selectedScope}">${selectedScope==='company'?'Company':'Project'} Assessment · Step 2 / 2</p>
      <h1>Choose the assessment depth</h1><div class="cards depth-cards ${selectedScope}">${current.questionnaires.map((q,i)=>q.assessment_type!==selectedScope?'':`
      <section class="card"><h2>${q.mode==='quick'?'Quick overview':'Expert assessment'}</h2><p class="question-count">${q.questions.length} questions</p>
      <p>${q.mode==='quick'?'Aggregated questions covering key topics.':'Detailed assessment with one question per blocker.'}</p>
      <p class="muted">${q.mode==='quick'?'High-level maturity insights.':'Detailed analysis and recommendations.'}</p><button class="primary" data-start="${i}">Start ${esc(title(q))}</button></section>`).join('')}</div>`;
    on('#scope-back',()=>go('home'));
    app.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>coffee(current.questionnaires[Number(b.dataset.start)]));
  }
  function questions() {
    const q = M.questionnaire(catalog, session);
    session.current_step = Math.max(0, Math.min(Number.isInteger(session.current_step) ? session.current_step : 0, q.questions.length - 1));
    const question = q.questions[session.current_step], answer = session.answers[question.question_id];
    const progressCount = () => { const r=M.report(catalog,session);return r.counts.valid+r.counts.not_applicable; };
    const answered = progressCount();
    app.innerHTML = `<div class="tools"><button id="home">← Questionnaires</button><button id="results">Results</button></div>
      <p class="eyebrow">${esc(title(q))}</p>${session.assessment_name?`<p class="assessment-name">${esc(session.assessment_name)}</p>`:''}<progress max="${q.questions.length}" value="${answered}" aria-label="Questions answered"></progress>
      <section class="question"><p class="eyebrow">Question ${session.current_step + 1} of ${q.questions.length}</p><h2>${esc(question.text)}</h2>
      <div class="rating-control">
        <label for="rating-slider">Rating <output id="rating-value" for="rating-slider">${answer.score===null?'Choose a level':`${answer.score} · ${levels[answer.score]}`}</output></label>
        <input id="rating-slider" type="range" min="0" max="4" step="1" value="${answer.score??0}" aria-describedby="rating-description">
        <div class="rating-ticks">${levels.map((label,n)=>`<button type="button" data-level="${n}" aria-label="Select level ${n}: ${label}" aria-pressed="${answer.score===n}">${n}</button>`).join('')}</div>
      </div>
      <p class="muted">${q.mode === 'quick' ? 'Choose the lowest level that applies across all parts of this question.' : 'Choose the level that best describes your current practice.'}</p>
      <div id="rating-description" class="selected-guidance">${answer.score!==null?`<strong>Level ${answer.score} · ${levels[answer.score]}</strong>${V.answerGuidance(question,answer.score)}`:answer.response_state==='dont_know'?esc(question.dont_know_guidance||question.when_to_use_dont_know||'More information is needed.'):answer.applicability==='not_applicable'?esc(question.na_guidance||question.when_to_use_na||'Explain why this question is outside scope.'):'Move the slider or choose a number to see its description.'}</div>
      <div class="rating-alternatives">
        <button id="answer-unknown" aria-pressed="${answer.response_state==='dont_know'}">Don’t Know</button>
        <button id="answer-na" aria-pressed="${answer.applicability==='not_applicable'}">N/A${q.mode==='quick'?' · all parts':''}</button>
        <button id="clear-answer" class="clear-answer">Clear answer</button>
      </div>
      ${QuestionFeedback.markup()}
      ${V.questionContext(question)}
      <details class="question-help response-notes" ${answer.applicability==='not_applicable'?'open':''}>
      <summary id="note-summary">${answer.applicability==='not_applicable'?'N/A reason (required)':answer.response_state==='dont_know'?'Information needed (optional)':'Evidence or notes (optional)'}</summary>
      <label class="sr-only" for="response-note">Evidence, information needed or N/A reason</label>
      <textarea id="response-note" rows="2">${esc(answer.applicability==='not_applicable'?answer.na_reason:answer.evidence)}</textarea>
      </details>
      <div class="tools"><button id="previous" ${session.current_step === 0 ? 'disabled' : ''}>← Previous</button><button class="primary" id="next">${session.current_step === q.questions.length - 1 ? 'See results' : 'Next →'}</button></div></section>`;
    on('#home', () => go('home')); on('#results', () => go('results'));
    const slider=app.querySelector('#rating-slider');
    function chooseLevel(value) {
      const n=Number(value);
      if(!Number.isInteger(n)||n<0||n>4)return;
      const wasNa=answer.applicability==='not_applicable';
      answer.score=n;answer.applicability='applicable';answer.response_state='rated';answer.all_blockers_not_applicable=false;
      answer.updated_at=now();touch();QuestionFeedback.answered(session,question.question_id);
      slider.value=n;slider.setAttribute('aria-valuetext',`${n} · ${levels[n]}`);
      app.querySelector('#rating-value').textContent=`${n} · ${levels[n]}`;
      app.querySelector('#rating-description').innerHTML=`<strong>Level ${n} · ${levels[n]}</strong>${V.answerGuidance(question,n)}`;
      app.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.level)===n)));
      app.querySelector('#answer-unknown').setAttribute('aria-pressed','false');
      app.querySelector('#answer-na').setAttribute('aria-pressed','false');
      app.querySelector('#note-summary').textContent='Evidence or notes (optional)';
      if(wasNa){app.querySelector('#response-note').value=answer.evidence;app.querySelector('.response-notes').open=false;}
      app.querySelector('progress').value=progressCount();
    }
    slider.oninput=()=>chooseLevel(slider.value);
    slider.onpointerup=()=>chooseLevel(slider.value);
    slider.onkeyup=e=>{if(['Home','End','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))chooseLevel(slider.value);};
    slider.setAttribute('aria-valuetext',answer.score===null?'No rating selected':`${answer.score} · ${levels[answer.score]}`);
    app.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>chooseLevel(b.dataset.level));
    function chooseAlternative(na){
      answer.score=null;answer.applicability=na?'not_applicable':'undecided';answer.response_state=na?'not_applicable':'dont_know';
      answer.all_blockers_not_applicable=na&&q.mode==='quick';answer.updated_at=now();touch();questions();
      app.querySelector(na?'#answer-na':'#answer-unknown').focus({preventScroll:true});
    }
    on('#answer-unknown',()=>chooseAlternative(false));on('#answer-na',()=>chooseAlternative(true));
    QuestionFeedback.mount(session,question.question_id);
    const note=app.querySelector('#response-note');
    note.oninput=()=>{if(answer.applicability==='not_applicable')answer.na_reason=note.value;else answer.evidence=note.value;touch();app.querySelector('progress').value=progressCount();};
    on('#clear-answer',()=>{answer.score=null;answer.applicability='undecided';answer.response_state='unanswered';answer.all_blockers_not_applicable=false;touch();questions();});
    on('#previous', () => { session.current_step--; touch(); go('questions'); });
    on('#next', () => { if (session.current_step === q.questions.length - 1) go('results'); else { session.current_step++; touch(); go('questions'); } });
  }
  function results() {
    const q = M.questionnaire(catalog, session), report = M.report(catalog, session);
    const dimensions=[...new Set(report.groups.filter(g=>g.kind==='cluster').map(g=>g.dimension))];
    if(!dimensions.includes(radarDimension))radarDimension=dimensions[0];
    const axes=radarKind==='stage_gate'?V.gateAxes(report):report.groups.filter(g=>g.kind===radarKind&&(radarKind!=='cluster'||g.dimension===radarDimension)).sort((a,b)=>a.label.localeCompare(b.label,'en',{numeric:true}));
    app.innerHTML = `<div class="tools"><button id="back">← Questions</button><button id="home">Questionnaires</button></div>
      <p class="eyebrow">${esc(title(q))}</p><h1 id="profile-title">${session.assessment_name?esc(session.assessment_name):'Your scalability profile'}</h1>
      <p class="muted">Created ${esc(session.created_at.slice(0,10))}${session.completed_at?` · Completed ${esc(session.completed_at.slice(0,10))}`:''}</p>
      <form id="save-assessment" class="panel save-assessment"><h2>Save your assessment</h2>
      <label for="assessment-name">Assessment name</label><div class="save-name-row"><input id="assessment-name" name="assessment-name" required maxlength="160" value="${esc(nameDraft??session.assessment_name??M.defaultName(session))}" aria-describedby="save-feedback"><button class="primary" type="submit">Save assessment</button></div>
      <p id="save-feedback" role="status">Your answers are saved automatically in this browser. Saving a name updates this assessment.</p></form>
      <section class="radar-panel"><div class="radar-controls"><label>View by <select id="radar-kind"><option value="stage_gate" ${radarKind==='stage_gate'?'selected':''}>Stage Gate</option><option value="cluster" ${radarKind==='cluster'?'selected':''}>Cluster</option><option value="community" ${radarKind==='community'?'selected':''}>Community</option></select></label>${radarKind==='cluster'?`<label>Dimension <select id="radar-dimension">${dimensions.map(d=>`<option ${d===radarDimension?'selected':''}>${esc(d)}</option>`).join('')}</select></label>`:''}</div><h2 class="radar-view-title">${radarKind==='cluster'?esc(radarDimension)+' clusters':radarKind==='community'?'Communities':'Stage Gates'}</h2>${V.radar(axes,radarKind)}<p class="muted radar-caption">${report.rows.filter(r => r.status === 'valid').length}/${q.questions.length} questions answered${report.counts.not_applicable ? ` · ${report.counts.not_applicable} not applicable` : ''}.
      ${report.counts.na_reason_missing ? `${report.counts.na_reason_missing} N/A responses still need a reason. ` : ''}${report.counts.information_gap ? `${report.counts.information_gap} Don’t Know responses need follow-up. ` : ''}${report.partial ? 'Partial profile — unanswered areas are left blank.' : ''} Self-reported preview.</p></section>
      <div class="tools result-actions"><button class="primary" id="timeline">Explore my timeline →</button><button id="pdf">PDF · recommended enablers</button></div>
      <section class="pdf-only"><h2>Enablers to develop</h2><p>${report.partial ? 'Recommendations reflect the answered questions only.' : 'Recommendations reflect the reported gaps.'} Scores do not imply blocker closure.</p>
      ${V.enablerReport(report, catalog, new URL("../", location.href))}</section>`;
    const nameInput=app.querySelector('#assessment-name');
    nameInput.oninput=()=>{nameDraft=nameInput.value;nameInput.setCustomValidity('');};
    app.querySelector('#save-assessment').onsubmit=e=>{
      e.preventDefault();
      if(!nameInput.value.trim()){nameInput.setCustomValidity('Enter an assessment name.');nameInput.reportValidity();return;}
      M.nameAssessment(session,nameInput.value,now(),report);
      nameDraft=session.assessment_name;nameInput.value=nameDraft;
      const saved=persist();
      app.querySelector('#profile-title').textContent=session.assessment_name;
      app.querySelector('#save-feedback').textContent=saved?'Assessment saved as “'+session.assessment_name+'”.':'Unable to save in this browser. Keep this tab open; the name has not been saved to browser storage.';
    };
    app.querySelector('#radar-kind').onchange=e=>{radarKind=e.target.value;results();};
    const dimensionSelect=app.querySelector('#radar-dimension');
    if(dimensionSelect)dimensionSelect.onchange=e=>{radarDimension=e.target.value;results();};
    on('#back', () => go('questions')); on('#home', () => go('home'));
    on('#timeline', () => {
      try {
        sessionStorage.setItem('aistQuestionnaireTimelineV1', JSON.stringify(V.timeline(catalog, report, session)));
        window.location.href = `../timeline/?assessment=questionnaire&id=${encodeURIComponent(session.assessment_id)}`;
      } catch { status.textContent = 'Unable to open the timeline: browser session storage is unavailable.'; }
    });
    on('#pdf', () => window.print());
  }
  function render() { if (view === 'home') home(); else if (view === 'depth') depth(); else if (view === 'questions') questions(); else results(); }
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
