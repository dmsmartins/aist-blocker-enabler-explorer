import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import './readiness.js';
const R=globalThis.ProjectReadiness;
const data=JSON.parse(fs.readFileSync(new URL('./data/explorer-data.json',import.meta.url)));
const copy=()=>structuredClone(data);
function answered(response,fields={}){
 const q=data.readinessQuestions[0];
 return {version:1,projectName:'Test project',answers:{[q.id]:{response,signature:R.signature(q,data),...fields}}};
}
test('actual JSON validates and untouched assessment shows all unanswered',()=>{
 R.validate(data);const r=R.report(data,R.clean(null,data));
 assert.equal(r.counts.unanswered,26);assert.equal(r.unresolved,26);assert.equal(r.candidateBlockers.length,0);
});
test('Yes without evidence remains unresolved and with evidence is only self-reported',()=>{
 let r=R.report(data,answered('yes'));assert.equal(r.counts['evidence-needed'],1);assert.ok(r.candidateBlockers.length>0);
 r=R.report(data,answered('yes',{evidence:'Owner signed the problem statement'}));
 assert.equal(r.counts.evidenced,1);assert.equal(r.unresolved,25);assert.equal(r.candidateBlockers.length,0);
});
test('N/A requires a reason and does not diagnose blockers',()=>{
 assert.equal(R.report(data,answered('na')).counts['justify-na'],1);
 const r=R.report(data,answered('na',{comments:'Outside the project scope'}));
 assert.equal(r.counts['not-applicable'],1);assert.equal(r.candidateBlockers.length,0);
});
test('partial, no and not sure are unresolved',()=>{
 for(const response of ['partial','no','unsure'])assert.equal(R.report(data,answered(response)).counts.gap,1);
});
test('grouped answer can limit candidate issues to identified Direct blockers',()=>{
 const q=data.readinessQuestions[0],id=q.sourceBlockerIds[0];
 const r=R.report(data,answered('partial',{affectedBlockerIds:[id]}));
 assert.deepEqual(r.candidateBlockers,[id]);
 assert.ok(r.rows[0].enablers.every(e=>e.links.every(l=>l.blockerId===id)));
});
test('Contextual relationships never diagnose additional gaps or recommend their enablers',()=>{
 const q=data.readinessQuestions[0],r=R.report(data,answered('no'));
 const contextual=data.questionBlockerMap.filter(m=>m.questionId===q.id&&m.relationship==='Contextual');
 assert.ok(contextual.length>0);
 for(const m of contextual)assert.ok(!r.candidateBlockers.includes(m.blockerId));
});
test('all suggested enablers and rationale links exist in source JSON and are deduplicated',()=>{
 const r=R.report(data,answered('no')),row=r.rows[0];
 assert.equal(new Set(row.enablers.map(e=>e.id)).size,row.enablers.length);
 for(const e of row.enablers)assert.ok(e.links.every(l=>data.relationships.some(s=>s.blockerId===l.blockerId&&s.enablerId===e.id&&s.rationale===l.rationale)));
});
test('modified framework requires review and does not keep a healthy answer',()=>{
 const d=copy();d.readinessQuestions[0].question+=' Updated';
 const r=R.report(d,answered('yes',{evidence:'Old evidence'}));
 assert.equal(r.counts.stale,1);assert.equal(r.counts.evidenced,0);
});
test('mapping changes also invalidate saved answers',()=>{
 const d=copy();d.questionBlockerMap[0].reviewStatus='Under UIC review';
 assert.equal(R.report(d,answered('yes',{evidence:'Evidence'})).counts.stale,1);
});
test('unknown saved answers and selected blockers are discarded',()=>{
 const session=answered('partial',{affectedBlockerIds:[999999],owner:123});
 session.answers.unknown={response:'yes'};
 const clean=R.clean(session,data);
 assert.equal(Object.keys(clean.answers).length,1);
 assert.deepEqual(clean.answers[data.readinessQuestions[0].id].affectedBlockerIds,[]);
 assert.equal(clean.answers[data.readinessQuestions[0].id].owner,'');
});
test('invalid source references, duplicate mappings and missing sheets fail explicitly',()=>{
 for(const change of [
   d=>delete d.readinessQuestions,
   d=>d.questionBlockerMap[0].blockerId=99999,
   d=>d.questionBlockerMap.push({...d.questionBlockerMap[0]}),
   d=>d.questionBlockerMap[0].relationship='Contextual'
 ]){
  const d=copy();change(d);assert.throws(()=>R.validate(d));
 }
});
test('export report preserves responses, actions, mapping review status and draft limits',()=>{
 const md=R.markdown(data,answered('partial',{evidence:'Trial',action:'Confirm owner',owner:'Team',dueDate:'2026-11-02'}));
 assert.ok(md.includes('Confirm owner'));assert.ok(md.includes('Context only:'));
 assert.ok(md.includes('Draft - UIC review'));assert.ok(md.includes('do not approve Stage Gates'));
});
test('user and source content is escaped for HTML',()=>{
 assert.equal(R.escape('<img src=x onerror="x">&'), '&lt;img src=x onerror=&quot;x&quot;&gt;&amp;');
});
