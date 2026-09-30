import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './dependencies.js';
const {connections, importance} = globalThis.DependencyExplorer;
const data = JSON.parse(readFileSync(new URL('./data/explorer-data.json', import.meta.url)));

test('each imported relationship appears in the correct direction with its own importance', () => {
  assert.equal(data.blockerDependencies.length, 127);
  for (const edge of data.blockerDependencies) {
    assert.ok(importance(edge) !== null);
    const from = connections(data, edge.blockerId).upstream.find(x => x.edge.id === edge.id);
    const to = connections(data, edge.dependsOnBlockerId).downstream.find(x => x.edge.id === edge.id);
    assert.equal(from.blocker.id, edge.dependsOnBlockerId);
    assert.equal(to.blocker.id, edge.blockerId);
    assert.equal(from.level, edge.dependencyImportance);
    assert.equal(to.level, edge.dependencyImportance);
  }
});
test('reciprocal links keep their independent weights; missing values are not treated as zero importance', () => {
  const fixture = {blockers:[{id:1,title:'One'}, {id:2,title:'Two'}, {id:3,title:'Three'}, {id:4,title:'Isolated'}],blockerDependencies:[
    {id:1,blockerId:1,dependsOnBlockerId:2,dependencyImportance:4},
    {id:2,blockerId:2,dependsOnBlockerId:1,dependencyImportance:2},
    {id:3,blockerId:1,dependsOnBlockerId:3}
  ]};
  assert.deepEqual(connections(fixture, 1).upstream.map(x => x.level), [4,null]);
  assert.deepEqual(connections(fixture, 1, 3).upstream.map(x => x.blocker.id), [2]);
  assert.equal(connections(fixture, 1, 3).downstream.length, 0);
  assert.deepEqual(connections(fixture, 4), {upstream:[],downstream:[]});
});
