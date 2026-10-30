import {request,assignmentBody,acceptAssignment,submissionBody,confirmReceipt,MAX_EXPLANATION,acceptRoleOrder,reviewHistory,rememberReview} from './api.mjs';
import {STORAGE_KEY, SESSION_SIZE, validateCatalog, newSession, qualify, toggleRelationship, answerError, validateSession, exportSession} from './model.mjs';

const host = document.getElementById('challenge');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog, explorerVersion, session = null, storageOk = true, recovery = null, recoveryReason = '', view = 'intro', busy = false, submitError = '';
const testMode = new URLSearchParams(location.search).get('stakeholderTest') === '1';
const draftKey = STORAGE_KEY + (testMode ? '-test' : '');
let participantId;
try {participantId=localStorage.getItem('aist-stakeholder-participant-v1'); if(!/^[0-9a-f-]{36}$/i.test(participantId||'')) {participantId=crypto.randomUUID();localStorage.setItem('aist-stakeholder-participant-v1',participantId);}} catch {participantId=crypto.randomUUID();}
const preview = `<div class="preview-bar"><span class="badge">${testMode?'TEST SESSION':'STAKEHOLDER REVIEW'}</span><span>${testMode?'Test answers are stored separately and excluded from research results.':'Review 20 blockers, then submit your answers to the project team.'}</span></div>`;

async function readData(url) {
  const response = await fetch(url, {cache: 'no-cache', signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('The challenge data could not be loaded. Please try again.');
  return response.json();
}

function persist() {
  try { localStorage.setItem(draftKey, JSON.stringify(session)); storageOk = true; }
  catch { storageOk = false; }
  updateStorageStatus();
}

function updateStorageStatus() {
  const message = host.querySelector('#storage-status');
  if (!message) return;
  message.className = storageOk ? 'storage-status' : 'notice error';
  message.textContent = session?.submitted ? 'Submission confirmed · receipt kept in this browser.' : storageOk ? 'Draft kept in this browser · not submitted yet.' : 'This browser could not save your draft. Keep this tab open and download your answers before leaving.';
}

function download(data, name) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function finishRender(focus = true) {
  updateStorageStatus();
  if (focus) { host.focus(); window.scrollTo({top: 0, behavior: 'instant'}); }
}

function roleDetails(role) {
  return `<dl class="role-details">${[['Key priorities','Key_Priorities'],['AI adoption perspective','AI_Adoption_Perspective'],['Typical challenges','Typical_Challenges'],['Decision authority','Decision_Authority']].map(([label,key]) => `<dt>${label}</dt><dd>${escape(role[key])}</dd>`).join('')}</dl>`;
}

function bindExport() {
  host.querySelector('#export')?.addEventListener('click', () => download(exportSession(session), `stakeholder-review-${session.session_id}.json`));
}

function renderIntro() {
  const saved = Boolean(session);
  host.innerHTML = `${preview}<div class="hero-grid"><section class="hero-copy"><p class="eyebrow">Stakeholder perspective challenge</p><h1>One role.<br>Twenty blockers.<br><span class="hero-accent">Your perspective.</span></h1><p class="lead">Step into a stakeholder’s role and explore what stands in the way of AI adoption in railways.</p><p>Help test how we describe the people who can resolve, contribute to, or be affected by each blocker.</p><div class="actions"><button class="primary" id="start">${saved?'Resume local session':'Try the challenge'} <span aria-hidden="true">→</span></button>${saved?'<button id="new">Start a new session</button>':''}</div><p class="small">20 blockers per session · no name or email needed</p></section><aside class="steps-card" aria-label="How it works"><p class="eyebrow">A different point of view</p><ol><li><div><strong>Meet your assigned role</strong><p>Read its priorities and responsibilities. You can ask for a different role.</p></div></li><li><div><strong>Consider 20 blockers</strong><p>Choose all relationships that apply. It is fine to be unsure.</p></div></li><li><div><strong>Review your perspective</strong><p>Check your answers and submit them for review.</p></div></li></ol></aside></div><p class="small">The role cards and questions are drafts for review. When you submit, your role, qualification, 20 assessments and optional explanations are stored in the project’s private repository. No name or email is requested. A random browser identifier links submissions. Answers do not change the Explorer automatically.</p>`;
  host.querySelector('#start').onclick = () => { if (!session) start(); else {view = session.screen; render();} };
  host.querySelector('#new')?.addEventListener('click', restart);
  finishRender(false);
}

const historyKey='aist-stakeholder-history-v1'+(testMode?'-test':'');
let history;
function completedHistory(){
  if(!history){let raw=null;try{raw=localStorage.getItem(historyKey);}catch{}history=reviewHistory(raw,catalog,explorerVersion);}
  rememberReview(history,session);
  try{localStorage.setItem(historyKey,JSON.stringify(history));}catch{}
  return history;
}
async function start() {
  if(busy)return;
  busy=true;const buttons=[...host.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
    const h=completedHistory();
    const result=await request('/stakeholder-roles',{datasetVersion:catalog.challenge.dataset_version,explorerVersion,seenRoleIds:Object.keys(h.roles)});
    const order=acceptRoleOrder(result,catalog,explorerVersion);
    session=newSession(catalog,explorerVersion);session.role_order=order;session.participant_id=participantId;session.is_test=testMode;
    view=session.screen;persist();render();
  }catch(error){host.querySelector('#start-error')?.remove();const notice=document.createElement('p');notice.id='start-error';notice.className='notice error';notice.setAttribute('role','alert');notice.textContent=error.message;host.append(notice);}
  finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
function restart() { if (window.confirm('Start a new session? This replaces the draft saved in this browser. Download it first if you want to keep it.')) start(); }

function renderRole() {
  const role = catalog.roles.get(session.role_order[session.role_index]), question = catalog.questions.get('Q01');
  host.innerHTML = `${preview}<div class="section-head"><div><p class="eyebrow">01 / Meet your role</p><h1 class="page-title">Start with a different perspective.</h1></div><span class="step-label">Role → Blockers → Review</span></div><div class="columns"><article class="panel role-card"><p class="eyebrow">Your assigned stakeholder</p><h2>${escape(role.Stakeholder_Name)}</h2><p>${escape(role.Role_Description)}</p>${roleDetails(role)}</article><section class="panel"><form id="qualification"><fieldset><legend>${escape(question.text)}</legend><p class="small">You do not need to hold this job. Consider whether you understand its responsibilities well enough to take its perspective.</p><div class="choice-stack">${question.options.map(o => `<label class="choice"><input type="radio" name="qualification" value="${escape(o.code)}" required><span><strong>${escape(o.label)}</strong></span></label>`).join('')}</div></fieldset><button class="primary" type="submit">Continue →</button></form>${session.role_index?`<p class="small" role="status" style="margin-top:20px">A different role has been assigned. ${session.role_index} role${session.role_index===1?' was':'s were'} set aside.</p>`:''}<p id="storage-status" role="status"></p></section></div>`;
  host.querySelector('#qualification').onsubmit = async event => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('qualification');
    if (!code) return;
    if(busy)return;
    const next=structuredClone(session); qualify(next, code, catalog);
    if(code==='NO'){session=next;view=session.screen;persist();render();return;}
    busy=true;const button=event.currentTarget.querySelector('button');button.disabled=true;button.textContent='Preparing 20 blockers…';
    try{const result=await request('/stakeholder-session',assignmentBody(next,testMode,completedHistory().roles[next.stakeholder_id]||[]));session=acceptAssignment(next,result,catalog);view=session.screen;persist();render();}
    catch(error){host.querySelector('#qualification-error')?.remove();const notice=document.createElement('p');notice.id='qualification-error';notice.className='notice error';notice.setAttribute('role','alert');notice.textContent=error.message;host.querySelector('#qualification').append(notice);}
    finally{busy=false;button.disabled=false;button.textContent='Continue →';}
  };
  finishRender();
}

function renderEvaluate() {
  const role = catalog.roles.get(session.stakeholder_id), blocker = catalog.blockers.get(session.blocker_ids[session.index]);
  const question = catalog.questions.get('Q02'), explanation = catalog.questions.get('Q03');
  const answer = session.answers[blocker.id] || {relationships: [], explanation: ''};
  const answered = session.blocker_ids.filter(id => !answerError(session.answers[id], catalog)).length;
  host.innerHTML = `${preview}<div class="progress-row"><span>02 / Consider each blocker</span><span id="answered-count">${answered} of ${SESSION_SIZE} answered</span></div><progress id="progress" value="${answered}" max="${SESSION_SIZE}" aria-label="Answered blockers"></progress><details class="role-summary"><summary>Your perspective: ${escape(role.Stakeholder_Name)} · View role card</summary><p>${escape(role.Role_Description)}</p>${roleDetails(role)}</details><div class="columns"><article class="panel blocker-card"><p class="eyebrow">Blocker ${session.index + 1} of ${SESSION_SIZE}</p><h1 class="page-title">${escape(blocker.title)}</h1><p>${escape(blocker.statement)}</p>${blocker.whyItMatters?`<details><summary>Why it matters</summary><p>${escape(blocker.whyItMatters)}</p></details>`:''}${blocker.consequence?`<details><summary>What can happen</summary><p>${escape(blocker.consequence)}</p></details>`:''}</article><section class="panel"><form id="assessment" novalidate><fieldset aria-describedby="selection-hint selection-error"><legend>${escape(question.text)}</legend><p class="small" id="selection-hint">Select all that apply. “Not relevant” and “Not sure” must each be selected alone.</p><div class="choice-stack">${question.options.map((option,i) => `${i===3?'<div class="divider" aria-hidden="true"></div>':''}<label class="choice ${question.exclusive_response_codes.includes(option.code)?'exclusive':''}"><input type="checkbox" name="relationship" value="${escape(option.code)}" ${answer.relationships.includes(option.code)?'checked':''}><span><strong>${escape(option.label)}</strong><small>${escape(option.description)}</small></span></label>`).join('')}</div></fieldset><label class="explanation" for="explanation">${escape(explanation.text)} <span>(${explanation.required?'required':'optional'})</span></label><textarea id="explanation" rows="3" maxlength="${explanation.max_length ?? MAX_EXPLANATION,acceptRoleOrder,reviewHistory,rememberReview}" placeholder="Add context for your choices…">${escape(answer.explanation)}</textarea><p class="small">Maximum 500 characters. Please avoid personal or confidential information.</p><p id="selection-error" class="notice error" role="alert" hidden></p><div class="form-actions"><button type="button" id="previous" ${session.index===0?'disabled':''}>← Previous</button><button class="primary" type="submit">${session.index===SESSION_SIZE-1?'Review answers':'Next blocker →'}</button></div></form><p id="storage-status" role="status"></p></section></div><div class="actions"><button id="export">Download draft</button><button id="pause">Pause & return to start</button></div>`;
  const capture = () => {
    session.answers[blocker.id] = {relationships: [...host.querySelectorAll('[name="relationship"]:checked')].map(el => el.value), explanation: host.querySelector('#explanation').value};
    persist();
    const count = session.blocker_ids.filter(id => !answerError(session.answers[id], catalog)).length;
    host.querySelector('#progress').value = count;
    host.querySelector('#answered-count').textContent = `${count} of ${SESSION_SIZE} answered`;
    host.querySelector('#selection-error').hidden = true;
  };
  host.querySelectorAll('[name="relationship"]').forEach(input => input.onchange = () => {
    const selected = toggleRelationship(session.answers[blocker.id]?.relationships || answer.relationships, input.value, input.checked, question);
    host.querySelectorAll('[name="relationship"]').forEach(el => {el.checked = selected.includes(el.value);});
    capture();
  });
  host.querySelector('#explanation').oninput = capture;
  host.querySelector('#previous').onclick = () => {capture(); session.index--; persist(); render();};
  host.querySelector('#pause').onclick = () => {capture(); view='intro'; render();};
  host.querySelector('#assessment').onsubmit = event => {
    event.preventDefault(); capture();
    const error = answerError(session.answers[blocker.id], catalog);
    if (error) {
      const target=host.querySelector('#selection-error'); target.textContent=error; target.hidden=false;
      host.querySelector('[name="relationship"]').focus(); return;
    }
    if (session.index === SESSION_SIZE - 1) {
      const missing = session.blocker_ids.findIndex(id => answerError(session.answers[id], catalog));
      if (missing >= 0) session.index = missing;
      else {session.screen='review'; view='review';}
    } else session.index++;
    persist(); render();
  };
  bindExport(); finishRender();
}

function renderReview() {
  const role = catalog.roles.get(session.stakeholder_id), question = catalog.questions.get('Q02');
  host.innerHTML = `${preview}<p class="eyebrow">03 / Review your perspective</p><h1 class="page-title">Twenty blockers. Your assessment.</h1><p class="lead">${escape(role.Stakeholder_Name)}</p><p class="small">${session.qualification==='SOMEWHAT'?'You reported limited familiarity with this role.':'You reported sufficient familiarity with this role.'} You can edit any answer before submitting these 20 assessments.</p><div class="review-list">${session.blocker_ids.map((id,i) => {const answer=session.answers[id];return `<article class="review-item"><div><h2 style="font-size:1rem">${i+1}. ${escape(catalog.blockers.get(id).title)}</h2><div>${answer.relationships.map(code => `<span class="tag">${escape(question.options.find(o=>o.code===code).label)}</span>`).join('')}</div>${answer.explanation?`<p>${escape(answer.explanation)}</p>`:''}</div><button data-edit="${i}" aria-label="Edit answer ${i+1}">Edit</button></article>`;}).join('')}</div><div class="actions"><button class="primary" id="complete">${busy?'Saving…':session.pending?'Retry submission':'Submit 20 assessments'}</button><button id="export">Download answers</button></div><p id="submit-error" class="notice error" role="alert" ${submitError?'':'hidden'}>${escape(submitError)}</p>${session.pending?'<p class="notice">Submission is locked while delivery is uncertain. Retry safely; the same answers will not be counted twice.</p>':''}<p id="storage-status" role="status"></p>`;
  host.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => {session.index=Number(button.dataset.edit); session.screen='evaluate'; view='evaluate'; persist(); render();});
  host.querySelectorAll('[data-edit]').forEach(button=>{button.disabled=busy||Boolean(session.pending);});
  host.querySelector('#complete').disabled=busy||Boolean(session.expired);
  host.querySelector('#complete').onclick = async () => {
    if(busy||session.expired)return;
    session.pending ||= submissionBody(session);persist();busy=true;submitError='';render();
    try{const result=await request('/stakeholder-votes',session.pending);session.receipt=confirmReceipt(result,session);session.submitted=true;session.screen='done';view='done';delete session.pending;persist();completedHistory();}
    catch(error){submitError=error.message;if([400,409,410].includes(error.status)){session.expired=true;persist();}}
    finally{busy=false;render();}
  };
  if(session.expired){const button=document.createElement('button');button.textContent='Download draft & start again';button.onclick=()=>{download(exportSession(session),`stakeholder-draft-${session.session_id}.json`);restart();};host.querySelector('.actions').append(button);}
  bindExport(); finishRender();
}

function renderDone() {
  host.innerHTML = `${preview}<section class="panel completion"><div class="completion-symbol" aria-hidden="true">✓</div><p class="eyebrow">${session.is_test?'Test submission saved':'Submission saved'}</p><h1 class="page-title">Thank you for sharing your perspective.</h1><p class="lead">Your 20 assessments as ${escape(catalog.roles.get(session.stakeholder_id).Stakeholder_Name)} have been received.</p><p>${session.is_test?'These test answers are excluded from research results.':'The project team can now review your answers.'}</p><p class="small">Receipt: ${escape(session.receipt.session_id)}</p><div class="actions"><button class="primary" id="export">Download submitted answers</button><button id="new">Start another session</button><a href="./index.html#review">Back to Review</a></div><p id="storage-status" role="status"></p></section>`;
  host.querySelector('#new').onclick = restart; bindExport(); finishRender();
}

function renderExhausted() {
  host.innerHTML = `${preview}<section class="panel completion"><p class="eyebrow">No suitable role found</p><h1 class="page-title">It is fine to sit this one out.</h1><p>You have considered all ${catalog.roles.size} roles. There is no need to assess blockers from a perspective you are unfamiliar with.</p><div class="actions"><a href="./index.html">Return to Explorer</a><button id="new">Try the roles again</button></div><p id="storage-status" role="status"></p></section>`;
  host.querySelector('#new').onclick=restart; finishRender();
}

function renderRecovery() {
  host.innerHTML = `${preview}<section class="panel completion"><h1 class="page-title">Your previous draft needs attention.</h1><p>${escape(recoveryReason)}</p><p>Download it before starting again. It will not be combined with a different version of the questions or blockers.</p><div class="actions"><button id="export-old">Download previous draft</button><button id="discard">Discard draft & start again</button></div></section>`;
  host.querySelector('#export-old').onclick=()=>download(recovery,'stakeholder-preview-recovered.json');
  host.querySelector('#discard').onclick=()=>{if(window.confirm('Replace the previous local draft?')) {recovery=null; start();}};
  finishRender();
}

function render() {
  if (recovery !== null) return renderRecovery();
  ({intro:renderIntro, role:renderRole, evaluate:renderEvaluate, review:renderReview, done:renderDone, exhausted:renderExhausted}[view])();
}

try {
  const [challenge, explorer] = await Promise.all([readData('./data/stakeholder-challenge.json'), readData('./data/explorer-data.json')]);
  catalog=validateCatalog(challenge,explorer);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(explorer)));
  explorerVersion='sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  let raw=null;
  try {raw=localStorage.getItem(draftKey);} catch {storageOk=false;}
  if(raw && raw!=='null') {
    try {session=validateSession(JSON.parse(raw),catalog,explorerVersion); if(['evaluate','review','done'].includes(session.screen)&&!session.token)throw new Error('Missing server assignment.'); if(session.is_test!==testMode)throw new Error('This draft belongs to a different test mode.');}
    catch(error) {recovery=raw; recoveryReason=error instanceof SyntaxError?'The saved draft could not be read.':error.message;}
  }
  render();
} catch(error) {
  host.innerHTML=`<section class="panel completion"><h1 class="page-title">The challenge could not be opened.</h1><p role="alert">${escape(error.message)}</p><p>Check your connection and try again. Existing drafts have not been removed.</p><button id="retry">Try again</button> <a href="./index.html">Back to Explorer</a></section>`;
  host.querySelector('#retry').onclick=()=>location.reload();
}

