import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './stage-dependencies.js';
const {aggregate} = globalThis.StageDependencies;
const data = JSON.parse(readFileSync(new URL('./data/explorer-data.json',import.meta.url)));
test('every source dependency appears once in its directed gate pair, including Gate 0 and same-gate links',()=>{
  const {links,unmapped}=aggregate(data);
  assert.equal(unmapped,0);
  assert.equal(links.reduce((n,g)=>n+g.count,0),data.blockerDependencies.length);
  for(const edge of data.blockerDependencies){
    const from=data.blockers.find(b=>b.id===edge.blockerId),to=data.blockers.find(b=>b.id===edge.dependsOnBlockerId);
    const group=links.find(g=>g.from===from.stageGate&&g.to===to.stageGate);
    assert.ok(group.pairs.some(p=>p.id===edge.id&&p.from.id===from.id&&p.to.id===to.id));
    assert.equal(group.count,group.pairs.length);
    assert.equal(group.maxImportance,Math.max(...group.pairs.map(p=>p.importance)));
  }
  assert.ok(links.some(g=>g.from===0&&g.to===4));
  assert.ok(links.some(g=>g.from===g.to));
});
test('importance filtering happens before grouping; reverse directions and unmapped records remain distinct',()=>{
  const fixture={stageGates:[{id:0},{id:4}],blockers:[{id:1,title:'A',stageGate:0},{id:2,title:'B',stageGate:4},{id:3,title:'C',stageGate:null}],blockerDependencies:[
    {id:1,blockerId:1,dependsOnBlockerId:2,dependencyImportance:1},
    {id:2,blockerId:1,dependsOnBlockerId:2,dependencyImportance:4},
    {id:3,blockerId:2,dependsOnBlockerId:1,dependencyImportance:3},
    {id:4,blockerId:3,dependsOnBlockerId:1,dependencyImportance:4},
  ]};
  const all=aggregate(fixture),high=aggregate(fixture,true);
  assert.equal(all.links.find(g=>g.from===0).count,2);
  assert.equal(high.links.find(g=>g.from===0).count,1);
  assert.equal(high.links.find(g=>g.from===4).maxImportance,3);
  assert.equal(high.unmapped,1);
  assert.equal(high.links.flatMap(g=>g.pairs).length,2);
  assert.deepEqual(aggregate({...fixture,blockerDependencies:[]}),{links:[],unmapped:0});
});
test('live high-importance aggregates reconcile with the source filter',()=>{
  const expected=data.blockerDependencies.filter(e=>e.dependencyImportance>=3);
  assert.equal(aggregate(data,true).links.reduce((n,g)=>n+g.count,0),expected.length);
});
