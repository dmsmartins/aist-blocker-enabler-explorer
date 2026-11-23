import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadDependencyDataset} from './dependency-source.mjs';

const dataset=JSON.parse(await readFile(new URL('../data/explorer-data.json',import.meta.url),'utf8'));
let requested;
const fetcher=async url=>(requested=url,{ok:true,json:async()=>dataset});

test('normal timeline and assessment load the single current dataset',async()=>{
  const snapshot={data:{blockerDependencies:[{id:'old'}]},blockerStatuses:{[dataset.blockers[0].id]:'gap'}};
  const result=await loadDependencyDataset({snapshot,fetcher});
  assert.equal(requested,'../data/explorer-data.json');
  assert.deepEqual(result.blockerDependencies,dataset.blockerDependencies);
});
test('missing or incompatible data fails closed',async()=>{
  await assert.rejects(loadDependencyDataset({fetcher:async()=>({ok:false})}));
  await assert.rejects(loadDependencyDataset({snapshot:{blockerStatuses:{999999:'gap'}},fetcher}));
});
