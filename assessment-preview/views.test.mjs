import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './model.js';
import './views.js';
const M=globalThis.AssessmentPreview,V=globalThis.AssessmentViews;
const c=JSON.parse(readFileSync(new URL('../data/explorer_catalog.json',import.meta.url)));
const q=c.questionnaires[0];
function make(){const s=M.create(c,q,'preview','2026-10-19T12:00:00Z');s.scoring_basis='self_report_preview';return s;}
test('self-reported preview scores without inventing evidence, legacy scoring unchanged',()=>{
  const s=make(),a=s.answers[q.questions[0].question_id];a.score=2;a.applicability='applicable';
  assert.equal(a.evidence,'');assert.equal(M.report(c,s).maturity_percent,50);
  delete s.scoring_basis;assert.equal(M.report(c,s).maturity_percent,null);
});
test('radar contains six gates, missing values remain unplotted and real zero is plotted',()=>{
  const s=make();let axes=V.gateAxes(M.report(c,s)),svg=V.radar(axes);
  assert.equal(axes.length,6);assert.equal((svg.match(/<circle /g)||[]).length,0);
  Object.assign(s.answers[q.questions[0].question_id],{score:0,applicability:'applicable'});
  axes=V.gateAxes(M.report(c,s));svg=V.radar(axes);
  assert.equal(axes[0].percent,0);assert.equal((svg.match(/<circle /g)||[]).length,1);
  assert.equal((svg.match(/<polygon /g)||[]).length,4); // grid only: no invented closed profile
});
test('timeline uses canonical IDs and retains unanswered, N/A, gaps and review without resolved',()=>{
  const s=make();Object.assign(s.answers[q.questions[0].question_id],{score:4,applicability:'applicable'});
  Object.assign(s.answers[q.questions[1].question_id],{score:1,applicability:'applicable'});
  s.answers[q.questions[2].question_id].applicability='not_applicable';
  const t=V.timeline(c,M.report(c,s),s);
  assert.equal(t.blockerStatuses[1114],'review');assert.equal(t.blockerStatuses[1211],'gap');assert.equal(t.blockerStatuses[1314],'not_applicable');assert.equal(t.blockerStatuses[1413],'unanswered');
  assert.ok(!Object.values(t.blockerStatuses).includes('resolved'));assert.equal(t.data.blockerDependencies.length,127);assert.equal(t.data.relationships.length,152);assert.ok(t.data.enablers.every(e=>e.stageGate===null));
});
test('PDF has unique recommended enablers, practical actions and outcomes, with escaped content',()=>{
  const s=make();Object.assign(s.answers[q.questions[0].question_id],{score:1,applicability:'applicable'});
  const r=M.report(c,s),html=V.enablerReport(r,c,'https://example.com/');
  const b=c.blockers.find(b=>b.blocker_id===r.recommendations[0].contributions[0].blocker_id);
  assert.ok(html.includes(V.escape(b.title)));
  assert.ok(html.includes(`https://example.com/assessment-preview/blocker.html?id=${b.blocker_id}`));
  assert.ok(!html.includes('Supports blockers'));
  assert.equal((html.match(/class="pdf-enabler"/g)||[]).length,r.recommendations.length);
  assert.ok(html.includes('Expected outcome:')&&html.includes('Actions:'));
  r.recommendations[0].enabler_title='<script>alert(1)</script>';
  assert.ok(!V.enablerReport(r).includes('<script>'));
});
