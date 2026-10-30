import test from 'node:test';import assert from 'node:assert/strict';
import {assignmentBody,acceptAssignment,submissionBody,confirmReceipt,request} from './api.mjs';
test('only assignment and answer fields enter API payloads',()=>{
  const session={participant_id:'p',dataset_version:'d',explorer_version:'e',stakeholder_id:'r',qualification:'YES',qualifications:[],token:'signed',blocker_ids:[1],answers:{1:{relationships:['AFFECTED'],explanation:''}},unrelated:'private'};
  assert.equal(assignmentBody(session,true).isTest,true);assert.equal('unrelated' in assignmentBody(session,true),false);
  assert.deepEqual(submissionBody(session),{token:'signed',assessments:[{blocker_id:1,relationships:['AFFECTED'],explanation:''}]});
});
test('assignment must match both versions and have exactly 20 distinct blockers',()=>{
  const s={dataset_version:'d',explorer_version:'e'},c={blockers:new Map(Array.from({length:20},(_,i)=>[i,{}]))};
  const r={token:'t',sessionId:'s',datasetVersion:'d',explorerVersion:'e',blockerIds:[...c.blockers.keys()],expiresAt:Date.now()+10000,isTest:false};
  assert.equal(acceptAssignment(s,r,c).blocker_ids.length,20);
  for(const patch of [{datasetVersion:'bad'},{blockerIds:[1]},{blockerIds:Array(20).fill(1)},{token:null}])assert.throws(()=>acceptAssignment(s,{...r,...patch},c));
});
test('only matching server confirmation can mark submission saved',()=>{
  const s={session_id:'s',is_test:false};assert.equal(confirmReceipt({saved:true,sessionId:'s',count:20,isTest:false},s).count,20);
  for(const r of [{saved:false},{saved:true,sessionId:'other',count:20,isTest:false},{saved:true,sessionId:'s',count:19,isTest:false}])assert.throws(()=>confirmReceipt(r,s));
});
test('failed HTTP requests remain errors with actionable status',async()=>{
  const old=fetch;globalThis.fetch=async()=>Response.json({error:'expired'},{status:410});
  try{await assert.rejects(()=>request('/stakeholder-votes',{}),e=>e.status===410&&e.message==='expired');}finally{globalThis.fetch=old;}
});
