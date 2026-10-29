import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCatalog, sampleBlockers, newSession, qualify, toggleRelationship, answerError, validateSession, exportSession} from './model.mjs';
const challenge=JSON.parse(readFileSync(new URL('../data/stakeholder-challenge.json',import.meta.url)));
const explorer=JSON.parse(readFileSync(new URL('../data/explorer-data.json',import.meta.url)));
const catalog=validateCatalog(challenge,explorer);
const clone=value=>structuredClone(value);
function rng(seed=42){return ()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);}
function accepted(){const s=newSession(catalog,'test',rng());qualify(s,'YES',catalog,rng());return s;}

test('real source maps 11 roles and 41 blockers, with Q03 optional',()=>{
  assert.equal(catalog.roles.size,11);assert.equal(catalog.blockers.size,41);
  assert.equal(catalog.questions.get('Q03').required,false);
  for(const role of catalog.roles.values()) assert.equal(explorer.blockers.filter(b=>b.stakeholders.includes(role.Stakeholder_Name)).length,role.Blockers_Linked);
});
test('sampling yields six unique IDs and balanced pools when both exist',()=>{
  for(let seed=1;seed<=80;seed++)for(const role of catalog.roles.values()){
    const ids=sampleBlockers(catalog,role.id,rng(seed));
    assert.equal(ids.length,6);assert.equal(new Set(ids).size,6);
    const totalLinked=explorer.blockers.filter(b=>b.stakeholders.includes(role.Stakeholder_Name)).length;
    const selectedLinked=ids.filter(id=>catalog.blockers.get(id).stakeholders.includes(role.Stakeholder_Name)).length;
    assert.equal(selectedLinked,totalLinked===41?6:3);
  }
});
test('sampling favours gate diversity without replacement',()=>{
  const synthetic=clone(explorer);synthetic.blockers=Array.from({length:12},(_,i)=>({...explorer.blockers[0],id:i,stageGate:i%6,stakeholders:i<6?[challenge.stakeholders[0].Stakeholder_Name]:[challenge.stakeholders[1].Stakeholder_Name]}));
  const c={...catalog,explorer:synthetic};
  const ids=sampleBlockers(c,challenge.stakeholders[0].id,rng());
  assert.equal(new Set(ids.map(id=>synthetic.blockers[id].stageGate)).size,6);
});
test('NO assigns a different role, all rejections finish without looping',()=>{
  const s=newSession(catalog,'test',rng());const seen=[];
  for(let i=0;i<11;i++){seen.push(s.role_order[s.role_index]);qualify(s,'NO',catalog);validateSession(s,catalog,'test');}
  assert.equal(new Set(seen).size,11);assert.equal(s.screen,'exhausted');
  assert.throws(()=>qualify(s,'NO',catalog));
});
test('SOMEWHAT is retained and rejected roles remain in history',()=>{
  const s=newSession(catalog,'test',rng());qualify(s,'NO',catalog);qualify(s,'SOMEWHAT',catalog,rng());
  assert.equal(s.qualification,'SOMEWHAT');assert.equal(s.qualifications.length,2);validateSession(s,catalog,'test');
});
test('relationship choices allow multiple normal codes and enforce exclusivity both ways',()=>{
  const q=catalog.questions.get('Q02');let selected=[];
  selected=toggleRelationship(selected,'RESPONSIBLE',true,q);
  selected=toggleRelationship(selected,'AFFECTED',true,q);assert.equal(selected.length,2);
  selected=toggleRelationship(selected,'NOT_RELEVANT',true,q);assert.deepEqual(selected,['NOT_RELEVANT']);
  selected=toggleRelationship(selected,'NOT_SURE',true,q);assert.deepEqual(selected,['NOT_SURE']);
  selected=toggleRelationship(selected,'CONTRIBUTOR',true,q);assert.deepEqual(selected,['CONTRIBUTOR']);
  selected=toggleRelationship(selected,'CONTRIBUTOR',false,q);assert.deepEqual(selected,[]);
});
test('answers require selections, reject impossible combinations, allow empty optional text',()=>{
  const check=relationships=>answerError({relationships,explanation:''},catalog);
  assert.ok(check([]));assert.ok(check(['NOT_SURE','AFFECTED']));assert.ok(check(['NO']));assert.ok(check(['AFFECTED','AFFECTED']));
  assert.equal(check(['AFFECTED','CONTRIBUTOR']),'');assert.equal(check(['NOT_SURE']),'');
});
test('complete draft survives reload, exports only as unsent test data',()=>{
  const s=accepted();for(const id of s.blocker_ids)s.answers[id]={relationships:['AFFECTED'],explanation:''};s.screen='done';
  const saved=JSON.parse(JSON.stringify(s));assert.deepEqual(validateSession(saved,catalog,'test'),s);
  const output=exportSession(saved);assert.equal(output.assessments.length,6);assert.equal(output.submitted,false);assert.equal(output.is_test,true);assert.equal(output.submission_status,'not_submitted');
});
test('bad or outdated drafts are rejected instead of silently reassigned',()=>{
  const s=accepted();
  assert.throws(()=>validateSession(s,catalog,'new-version'));
  for(const mutate of [s=>s.blocker_ids[1]=s.blocker_ids[0],s=>s.index=999,s=>s.stakeholder_id='STK-99',s=>s.screen='done',s=>s.qualifications[0].response_code='NO',s=>s.submitted=true]){
    const bad=clone(s);mutate(bad);assert.throws(()=>validateSession(bad,catalog,'test'));
  }
});
test('unknown stakeholder names and broken response contracts fail visibly',()=>{
  const data=clone(explorer);data.blockers[0].stakeholders.push('Unmapped role');assert.throws(()=>validateCatalog(challenge,data));
  const questions=clone(challenge);questions.questions[1].options.pop();assert.throws(()=>validateCatalog(questions,explorer));
});
