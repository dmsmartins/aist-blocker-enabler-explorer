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
  Object.assign(s.answers[q.questions[2].question_id],{applicability:'not_applicable',na_reason:'Outside scope',all_blockers_not_applicable:true});
  const t=V.timeline(c,M.report(c,s),s);
  assert.equal(t.blockerStatuses[1114],'review');assert.equal(t.blockerStatuses[1211],'gap');assert.equal(t.blockerStatuses[1314],'not_applicable');assert.equal(t.blockerStatuses[1413],'unanswered');
  assert.ok(!Object.values(t.blockerStatuses).includes('resolved'));assert.equal(t.data.blockerDependencies.length,127);assert.equal(t.data.relationships.length,152);assert.ok(t.data.enablers.every(e=>e.stageGate===null));
});
test('enriched questions render context and all five example sets with escaping',()=>{
  for(const form of c.questionnaires)for(const question of form.questions){
    assert.ok(V.questionContext(question).includes('What to consider'));
    for(let n=0;n<5;n++)assert.ok(V.answerGuidance(question,n).includes('For example'));
  }
  assert.ok(!V.questionContext({why_this_matters:'<img onerror=alert(1)>'}).includes('<img'));
});
test('Don’t Know is distinct from blank and zero and survives saved assessment roundtrip',()=>{
  const s=make(),a=s.answers[q.questions[0].question_id];
  assert.equal(M.report(c,s).counts.unanswered,16);
  a.response_state='dont_know';
  const restored=JSON.parse(JSON.stringify(s));M.validateAssessment(c,restored);
  const r=M.report(c,restored);
  assert.equal(r.counts.information_gap,1);assert.equal(r.counts.unanswered,15);
  assert.equal(r.maturity_percent,null);assert.equal(r.completion,0);
  Object.assign(a,{score:0,applicability:'applicable',response_state:'rated'});
  assert.equal(M.report(c,s).maturity_percent,0);
});
test('enriched N/A requires a reason even in self-report preview',()=>{
  const s=make(),a=s.answers[q.questions[0].question_id];
  Object.assign(a,{applicability:'not_applicable',all_blockers_not_applicable:true});
  assert.equal(M.report(c,s).counts.na_reason_missing,1);
  a.na_reason='Outside the named scope';
  assert.equal(M.report(c,s).counts.not_applicable,1);
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

test('community and cluster groupings preserve allocated weights and missingness',()=>{
  const s=make();
  for(const a of Object.values(s.answers))Object.assign(a,{score:2,applicability:'applicable'});
  const r=M.report(c,s);
  const communities=r.groups.filter(g=>g.kind==='community');
  assert.equal(communities.length,5);
  assert.equal(communities.reduce((n,g)=>n+g.answered,0),41);
  assert.ok(communities.every(g=>Math.abs(g.percent-50)<1e-9));
  const clusters=r.groups.filter(g=>g.kind==='cluster');
  assert.equal(clusters.length,22);
  assert.equal(new Set(clusters.map(g=>g.dimension)).size,3);
  for(const kind of ['cluster','community']){
    const axes=r.groups.filter(g=>g.kind===kind&&(kind!=='cluster'||g.dimension==='Organisational'));
    const svg=V.radar(axes,kind);
    assert.equal((svg.match(/<circle /g)||[]).length,axes.length);
    assert.equal((svg.match(/<li>/g)||[]).length,axes.length);
    assert.ok(!svg.includes('NaN'));
  }
  const blank=M.report(c,make()).groups.filter(g=>g.kind==='community');
  assert.ok(blank.every(g=>g.percent===null));
});

test('named saving preserves identity, answers and score, including duplicate names and reload',()=>{
  const a=make(),b=make();b.assessment_id='other';
  const before=JSON.stringify(a.answers),score=M.report(c,a).maturity_percent;
  assert.equal(M.displayName(a),'Company · Quick');
  assert.equal(M.defaultName(a),'Company · Quick — 2026-10-19');
  assert.throws(()=>M.nameAssessment(a,'   ','2026-10-20T12:00:00Z',M.report(c,a)));
  M.nameAssessment(a,'  Board review  ','2026-10-20T12:00:00Z',M.report(c,a));
  M.nameAssessment(b,'Board review','2026-10-20T12:00:00Z',M.report(c,b));
  M.nameAssessment(a,'Renamed','2026-10-21T12:00:00Z',M.report(c,a));
  assert.equal(a.assessment_id,'preview');assert.equal(b.assessment_id,'other');
  assert.equal(b.assessment_name,'Board review');assert.equal(a.created_at,'2026-10-19T12:00:00Z');
  assert.equal(JSON.stringify(a.answers),before);assert.equal(M.report(c,a).maturity_percent,score);
  assert.equal(a.completed_at,undefined);
  const restored=M.validateAssessment(c,JSON.parse(JSON.stringify(a)));
  assert.equal(M.displayName(restored),'Renamed');
  for(const answer of Object.values(a.answers))Object.assign(answer,{score:3,applicability:'applicable'});
  M.nameAssessment(a,'Finished','2026-10-22T12:00:00Z',M.report(c,a));
  M.nameAssessment(a,'Finished again','2026-10-23T12:00:00Z',M.report(c,a));
  assert.equal(a.completed_at,'2026-10-22T12:00:00Z');
  assert.equal(V.timeline(c,M.report(c,a),a).assessment_name,'Finished again');
});
