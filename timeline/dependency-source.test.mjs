import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {useOriginalCommunities,loadDependencyDataset} from './dependency-source.mjs';

const revised=JSON.parse(await readFile(new URL('../data/new-dependencies/explorer-data.json',import.meta.url),'utf8'));
const original=JSON.parse(await readFile(new URL('../data/explorer-data.json',import.meta.url),'utf8'));
const fetcher=async url=>({ok:true,json:async()=>url.includes('/new-dependencies/')?revised:original});

test('the original dataset is limited to explicitly selected community comparison',()=>{
  assert.equal(useOriginalCommunities(false,''),false);
  assert.equal(useOriginalCommunities(false,'?version=original'),false);
  assert.equal(useOriginalCommunities(true,''),false);
  assert.equal(useOriginalCommunities(true,'?version=original'),true);
});
test('normal timeline and assessment use revised data even for an old snapshot',async()=>{
  const snapshot={data:original,blockerStatuses:{[original.blockers[0].id]:'gap'}};
  const result=await loadDependencyDataset({snapshot,fetcher});
  assert.equal(result.blockerDependencies.length,83);
  assert.deepEqual(result.blockerDependencies,revised.blockerDependencies);
});
test('explicit original comparison is preserved and errors fail closed',async()=>{
  assert.equal((await loadDependencyDataset({original:true,fetcher})).blockerDependencies.length,127);
  await assert.rejects(loadDependencyDataset({fetcher:async()=>({ok:false})}));
  await assert.rejects(loadDependencyDataset({snapshot:{blockerStatuses:{999999:'gap'}},fetcher}));
});
