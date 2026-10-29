import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {collectionId,collections,matchingBlockers,collectionAssessment,explorationFromHash,explorationHash,visibleDependencies} from './explore.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/explorer-data.json',import.meta.url)));

test('communities and gates partition the same source blockers without changing IDs or memberships',()=>{
  const original=JSON.stringify(data);
  assert.equal(collections(data,'community').length,5);
  assert.equal(collections(data,'gate').length,6);
  for(const mode of ['community','gate']){
    const ids=collections(data,mode).flatMap(g=>matchingBlockers(data,{mode,group:g.id}).map(b=>b.id));
    assert.equal(ids.length,data.blockers.length);
    assert.deepEqual([...ids].sort(),data.blockers.map(b=>b.id).sort());
  }
  assert.equal(JSON.stringify(data),original);
});

test('group and stakeholder filters intersect, retain Gate 0 and preserve an honest empty result',()=>{
  const stakeholder=data.blockers[0].stakeholders[0];
  for(const mode of ['community','gate'])for(const group of collections(data,mode)){
    const expected=data.blockers.filter(b=>collectionId(b,mode)===group.id&&b.stakeholders.includes(stakeholder));
    assert.deepEqual(matchingBlockers(data,{mode,group:group.id,stakeholder}),expected);
  }
  assert.ok(matchingBlockers(data,{group:0}).length>0);
  assert.deepEqual(matchingBlockers(data,{stakeholder:'missing stakeholder'}),[]);
});

test('both modes restore blocker and mechanism links in their correct first layer',()=>{
  for(const mode of ['community','gate'])for(const blocker of data.blockers){
    const relationship=data.relationships.find(r=>r.blockerId===blocker.id);
    const selection={group:collectionId(blocker,mode),blocker:blocker.id,detail:true,mechanism:relationship.mechanism,stakeholder:blocker.stakeholders[0]};
    assert.deepEqual(explorationFromHash(data,explorationHash(selection,mode),'',mode),selection);
  }
  for(const mode of ['community','gate'])for(const group of collections(data,mode)){
    const selection={group:group.id,blocker:null,detail:false,mechanism:null,stakeholder:''};
    assert.deepEqual(explorationFromHash(data,explorationHash(selection,mode),'',mode),selection);
  }
});

test('invalid links cannot invent groups or roles; explicit linked blockers take priority',()=>{
  assert.equal(explorationFromHash(data,'#community=999','','community').group,null);
  assert.equal(explorationFromHash(data,'#gate=999').group,null);
  assert.equal(explorationFromHash(data,'#role=missing').stakeholder,'');
  assert.equal(explorationFromHash(data,'','?gate=0').group,0);
  assert.equal(explorationFromHash(data,'','?community=1','community').group,1);
  const blocker=data.blockers[0],role=data.blockers.flatMap(b=>b.stakeholders).find(r=>!blocker.stakeholders.includes(r));
  const result=explorationFromHash(data,`#blocker=${blocker.id}&community=999&role=${encodeURIComponent(role)}`,'','community');
  assert.equal(result.group,blocker.communityId);assert.equal(result.stakeholder,'');
});

test('assessment snapshots can reuse their existing blocker community metadata',()=>{
  const snapshot={...data};delete snapshot.communities;
  const groups=collections(snapshot,'community');
  assert.equal(groups.length,5);
  for(const g of groups)assert.equal(g.label,data.blockers.find(b=>b.communityId===g.id).communityName);
});

test('dependency review filtering distinguishes validated, unreviewed, missing and rejected rows',()=>{
  const rows=[{id:1,reviewStatus:'Validated'},{id:2,reviewStatus:'Unreviewed'},{id:3},{id:4,reviewStatus:'Rejected'}];
  assert.deepEqual(visibleDependencies({blockerDependencies:rows}),rows.slice(0,3));
  assert.deepEqual(visibleDependencies({blockerDependencies:rows},false),[rows[0]]);
  assert.equal(visibleDependencies(data).length,127);
});

test('a completed stakeholder subset cannot mark an incomplete collection done',()=>{
  const roles=[...new Set(data.blockers.flatMap(b=>b.stakeholders))];
  for(const mode of ['community','gate']){
    const scope=collections(data,mode).flatMap(g=>roles.map(stakeholder=>({group:g.id,stakeholder,all:matchingBlockers(data,{mode,group:g.id}),visible:matchingBlockers(data,{mode,group:g.id,stakeholder})}))).find(s=>s.visible.length>0&&s.visible.length<s.all.length);
    assert.ok(scope);
    const statuses=Object.fromEntries(scope.visible.map(b=>[b.id,'resolved']));
    assert.deepEqual(collectionAssessment(data,{...scope,mode,statuses}),{state:'active',remaining:0});
    scope.all.forEach(b=>{statuses[b.id]='resolved'});
    assert.deepEqual(collectionAssessment(data,{...scope,mode,statuses}),{state:'done',remaining:0});
    assert.equal(collectionAssessment(data,{...scope,mode,statuses,preview:true}).state,'active');
  }
});
