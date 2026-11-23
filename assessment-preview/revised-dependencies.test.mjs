import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './model.js';
import './views.js';
const catalog=JSON.parse(await readFile(new URL('../data/explorer_catalog.json',import.meta.url),'utf8'));
const revised=JSON.parse(await readFile(new URL('../data/new-dependencies/explorer-data.json',import.meta.url),'utf8'));
const M=globalThis.AssessmentPreview,V=globalThis.AssessmentViews;

test('assessment results and timeline use revised communities and dependency graph',()=>{
  const q=catalog.questionnaires.find(x=>x.assessment_type==='company'&&x.mode==='quick');
  const session=M.create(catalog,q,'test','2026-11-23T00:00:00Z');
  session.scoring_basis='self_report_preview';
  Object.assign(session.answers[q.questions[0].question_id],{score:2,applicability:'applicable'});
  const report=M.report(catalog,session,revised);
  for(const b of report.blockers){
    const current=revised.blockers.find(x=>x.id===b.blocker_id);
    assert.equal(b.dependency_analysis.community,current.communityName);
    assert.equal(b.dependency_analysis.state,current.classification);
  }
  const snapshot=V.timeline(catalog,report,session,revised);
  assert.deepEqual(snapshot.data.blockerDependencies,revised.blockerDependencies);
  assert.equal(snapshot.data.blockerDependencies.length,83);
  assert.equal(snapshot.blockerScores[q.questions[0].blocker_ids[0]],2);
});
