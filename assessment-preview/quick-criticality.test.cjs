const assert = require('node:assert/strict');
const test = require('node:test');
require('./model.js');
const catalog = require('../data/explorer_catalog.json');
const M = globalThis.AssessmentPreview;

test('quick assessments contain the 15 lowest scores from their own expert assessment', () => {
  M.validate(catalog);
  for (const type of ['company', 'project']) {
    const expert = catalog.questionnaires.find(q => q.assessment_type === type && q.mode === 'expert');
    const quick = catalog.questionnaires.find(q => q.assessment_type === type && q.mode === 'quick');
    const expected = [...expert.questions].sort((a,b) => a.criticality_composite-b.criticality_composite || a.blocker_ids[0]-b.blocker_ids[0] || a.question_id.localeCompare(b.question_id)).slice(0,15);
    assert.deepEqual(quick.questions.map(q=>q.question_id), expected.map(q=>q.question_id));
  }
});

test('continuing preserves answers, metadata and feedback identity', () => {
  const quick = catalog.questionnaires.find(q => q.assessment_type === 'company' && q.mode === 'quick');
  const now = '2026-11-22T10:00:00.000Z';
  const draft = M.create(catalog, quick, 'quick-id', now);
  const id = quick.questions[0].question_id;
  Object.assign(draft.answers[id], {score: 2, applicability:'applicable', evidence:'evidence', review_comment:'change this'});
  draft.scoring_basis = 'self_report_preview';
  draft.assessment_name = 'Baseline';
  const full = M.continueExpert(catalog, draft, draft.assessment_id, now);
  assert.equal(full.assessment_id, draft.assessment_id);
  assert.equal(full.assessment_name, 'Baseline');
  assert.equal(full.source_quick_assessment_id, draft.assessment_id);
  assert.deepEqual(full.answers[id], draft.answers[id]);
  assert.notEqual(full.answers[id], draft.answers[id]);
  assert.equal(Object.keys(full.answers).length, 41);
  M.validateAssessment(catalog, full);
});
