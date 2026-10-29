// Phase 2: browser-only trial. No vote API or server submission is implemented.
export const STORAGE_KEY = 'aist-stakeholder-challenge-preview-v1';
export const SESSION_SIZE = 6;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export function validateCatalog(challenge, explorer) {
  assert(challenge?.schema_version === '1.0.0' && nonempty(challenge.dataset_version), 'Unsupported challenge dataset.');
  assert(Array.isArray(challenge.stakeholders) && challenge.stakeholders.length, 'No stakeholder roles available.');
  assert(Array.isArray(explorer?.blockers) && explorer.blockers.length >= SESSION_SIZE, 'Not enough blockers for a session.');
  const roles = new Map(), names = new Set(), blockers = new Map();
  for (const role of challenge.stakeholders) {
    assert(nonempty(role.id) && !roles.has(role.id), 'Duplicate or missing stakeholder ID.');
    assert(nonempty(role.Stakeholder_Name) && !names.has(role.Stakeholder_Name), 'Duplicate or missing stakeholder name.');
    for (const key of ['Role_Description', 'Key_Priorities', 'AI_Adoption_Perspective', 'Typical_Challenges', 'Decision_Authority']) {
      assert(nonempty(role[key]), `Incomplete role card: ${role.id}.`);
    }
    roles.set(role.id, role); names.add(role.Stakeholder_Name);
  }
  for (const blocker of explorer.blockers) {
    assert(Number.isSafeInteger(blocker.id) && !blockers.has(blocker.id), 'Duplicate or invalid blocker ID.');
    assert(nonempty(blocker.title) && nonempty(blocker.statement), 'Incomplete blocker card.');
    assert(Array.isArray(blocker.stakeholders) && blocker.stakeholders.every(name => names.has(name)), 'An Explorer stakeholder has no role card.');
    blockers.set(blocker.id, blocker);
  }
  for (const role of roles.values()) {
    assert(explorer.blockers.some(b => b.stakeholders.includes(role.Stakeholder_Name)), `No Explorer mapping for ${role.id}.`);
  }
  const questions = new Map((challenge.questions || []).map(q => [q.id, q]));
  assert(questions.size === 3 && challenge.questions.length === 3, 'Expected three unique questions.');
  const expected = {Q01: ['YES', 'SOMEWHAT', 'NO'], Q02: ['RESPONSIBLE', 'AFFECTED', 'CONTRIBUTOR', 'NOT_RELEVANT', 'NOT_SURE'], Q03: ['FREE_TEXT']};
  for (const [id, codes] of Object.entries(expected)) {
    const question = questions.get(id);
    assert(question && nonempty(question.text) && typeof question.required === 'boolean', `Invalid ${id}.`);
    assert(question.options?.length === codes.length && codes.every(code => question.options.filter(o => o.code === code).length === 1), `Invalid options for ${id}.`);
  }
  assert(questions.get('Q01').response_type === 'single_choice' && questions.get('Q02').response_type === 'multiple_choice' && questions.get('Q03').response_type === 'free_text', 'Unsupported question response types.');
  assert(JSON.stringify([...(questions.get('Q02').exclusive_response_codes || [])].sort()) === JSON.stringify(['NOT_RELEVANT', 'NOT_SURE']), 'Invalid exclusive options.');
  return {challenge, explorer, roles, blockers, questions};
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sampleBlockers(catalog, roleId, random = Math.random) {
  const role = catalog.roles.get(roleId);
  assert(role, 'Unknown role.');
  const linked = catalog.explorer.blockers.filter(b => b.stakeholders.includes(role.Stakeholder_Name));
  const unlinked = catalog.explorer.blockers.filter(b => !b.stakeholders.includes(role.Stakeholder_Name));
  const selected = [], usedGates = new Set();
  const take = (pool, count) => {
    const candidates = shuffle(pool.filter(b => !selected.includes(b)), random);
    while (count-- > 0 && candidates.length) {
      // Prefer an unused gate; shuffle breaks ties. This is diversity, not global coverage balancing.
      let i = candidates.findIndex(b => !usedGates.has(b.stageGate));
      if (i < 0) i = 0;
      const [blocker] = candidates.splice(i, 1);
      selected.push(blocker); usedGates.add(blocker.stageGate);
    }
  };
  // Randomise pool priority to avoid always giving first gate choice to existing links.
  for (const pool of shuffle([linked, unlinked], random)) take(pool, SESSION_SIZE / 2);
  take(catalog.explorer.blockers, SESSION_SIZE - selected.length);
  return shuffle(selected, random).map(b => b.id);
}

export function newSession(catalog, explorerVersion, random = Math.random) {
  return {
    type: 'stakeholder-challenge-preview', schema_version: '1.0.0',
    session_id: crypto.randomUUID(), created_at: new Date().toISOString(),
    dataset_version: catalog.challenge.dataset_version, explorer_version: explorerVersion,
    submitted: false, screen: 'role', role_order: shuffle([...catalog.roles.keys()], random),
    role_index: 0, qualifications: [], stakeholder_id: null, qualification: null,
    blocker_ids: [], answers: {}, index: 0,
  };
}

export function qualify(session, code, catalog, random = Math.random) {
  assert(session.screen === 'role', 'Not at role qualification.');
  assert(['YES', 'SOMEWHAT', 'NO'].includes(code), 'Unknown qualification.');
  const roleId = session.role_order[session.role_index];
  assert(catalog.roles.has(roleId), 'No remaining role.');
  session.qualifications.push({stakeholder_id: roleId, response_code: code});
  if (code === 'NO') {
    session.role_index++;
    if (session.role_index === session.role_order.length) session.screen = 'exhausted';
    return;
  }
  session.stakeholder_id = roleId;
  session.qualification = code;
  session.blocker_ids = sampleBlockers(catalog, roleId, random);
  session.screen = 'evaluate';
}

export function toggleRelationship(current, code, checked, question) {
  assert(question.options.some(o => o.code === code), 'Unknown relationship.');
  const exclusive = question.exclusive_response_codes;
  if (!checked) return current.filter(c => c !== code);
  if (exclusive.includes(code)) return [code];
  return [...new Set([...current.filter(c => !exclusive.includes(c)), code])];
}

export function answerError(answer, catalog) {
  const q = catalog.questions.get('Q02'), explanation = catalog.questions.get('Q03');
  if (!answer || !Array.isArray(answer.relationships) || !answer.relationships.length) return 'Choose at least one relationship, or select Not sure.';
  if (new Set(answer.relationships).size !== answer.relationships.length || answer.relationships.some(code => !q.options.some(o => o.code === code))) return 'Invalid relationship selection.';
  if (answer.relationships.length > 1 && answer.relationships.some(code => q.exclusive_response_codes.includes(code))) return 'Not relevant and Not sure must each be selected alone.';
  if (typeof answer.explanation !== 'string') return 'Invalid explanation.';
  if (explanation.required && !answer.explanation.trim()) return 'Please add an explanation.';
  if (explanation.max_length != null && answer.explanation.length > explanation.max_length) return `Use at most ${explanation.max_length} characters.`;
  return '';
}

export function validateSession(session, catalog, explorerVersion) {
  assert(session?.type === 'stakeholder-challenge-preview' && session.submitted === false, 'Unrecognised local draft.');
  assert(session.dataset_version === catalog.challenge.dataset_version && session.explorer_version === explorerVersion, 'The datasets have changed since this draft was started.');
  assert(nonempty(session.session_id) && nonempty(session.created_at), 'Invalid session identity.');
  assert(['role', 'evaluate', 'review', 'done', 'exhausted'].includes(session.screen), 'Invalid draft screen.');
  assert(Array.isArray(session.role_order) && session.role_order.length === catalog.roles.size && new Set(session.role_order).size === catalog.roles.size && session.role_order.every(id => catalog.roles.has(id)), 'Invalid role assignment.');
  assert(Number.isInteger(session.role_index) && session.role_index >= 0 && session.role_index <= session.role_order.length, 'Invalid role index.');
  assert(Array.isArray(session.qualifications) && session.qualifications.every((q, i) => q.stakeholder_id === session.role_order[i] && ['YES', 'SOMEWHAT', 'NO'].includes(q.response_code)), 'Invalid qualification history.');
  const accepted = ['evaluate', 'review', 'done'].includes(session.screen);
  assert(session.qualifications.length === session.role_index + (accepted ? 1 : 0), 'Incomplete qualification history.');
  assert(session.qualifications.slice(0, session.role_index).every(q => q.response_code === 'NO'), 'Invalid rejected roles.');
  assert(session.answers && typeof session.answers === 'object' && !Array.isArray(session.answers), 'Invalid answers.');
  assert(Array.isArray(session.blocker_ids), 'Invalid blocker assignment.');
  if (accepted) {
    assert(session.role_order[session.role_index] === session.stakeholder_id && ['YES', 'SOMEWHAT'].includes(session.qualification) && session.qualifications.at(-1).response_code === session.qualification, 'Invalid accepted role.');
    assert(session.blocker_ids.length === SESSION_SIZE && new Set(session.blocker_ids).size === SESSION_SIZE && session.blocker_ids.every(id => catalog.blockers.has(id)), 'Invalid blocker assignment.');
    assert(Number.isInteger(session.index) && session.index >= 0 && session.index < SESSION_SIZE, 'Invalid question index.');
    for (const [id, answer] of Object.entries(session.answers)) {
      assert(session.blocker_ids.some(bid => String(bid) === id), 'An answer is outside this session.');
      assert(Array.isArray(answer.relationships) && typeof answer.explanation === 'string', 'Invalid draft answer.');
      // An unselected, partially typed answer is a valid unfinished draft.
      if (answer.relationships.length) assert(!answerError(answer, catalog), 'Invalid stored answer.');
    }
    if (['review', 'done'].includes(session.screen)) assert(session.blocker_ids.every(id => !answerError(session.answers[id], catalog)), 'Incomplete review.');
  } else {
    assert(session.blocker_ids.length === 0 && Object.keys(session.answers).length === 0 && session.stakeholder_id === null && session.qualification === null, 'Unexpected answers before qualification.');
    assert((session.screen === 'exhausted') === (session.role_index === session.role_order.length), 'Invalid role progression.');
  }
  return session;
}

export function exportSession(session) {
  // Preview exports are deliberately labelled and cannot be mistaken for server receipts.
  return {...session, is_test: true, submitted: false, submission_status: 'not_submitted',
    assessments: session.blocker_ids.map(id => ({blocker_id: id, stakeholder_id: session.stakeholder_id, qualification: session.qualification, ...session.answers[id]}))};
}
