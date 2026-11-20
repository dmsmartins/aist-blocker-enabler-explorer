import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('comparison uses both datasets and filters directed changes', async () => {
  const elements = new Map();
  for (const name of ['#app','#network','#blocker','#change','#search','#columns','#result-count','#rows']) {
    elements.set(name, {value:name==='#blocker'?'3413':name==='#change'?'all':'',innerHTML:'',textContent:'',handlers:{},addEventListener(event,fn){this.handlers[event]=fn;}});
  }
  globalThis.document = {querySelector(selector){return elements.get(selector);}};
  let mounted;
  globalThis.window = {DependencyExplorer:{mount(host,data){mounted=data;}}};
  globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(await readFile(new URL(url.replace('../data/','../data/'), import.meta.url),'utf8'))});
  await import('./compare.mjs');
  assert.equal(mounted.blockerDependencies.length,83);
  assert.equal(mounted.communities.length,6);
  assert.match(elements.get('#app').innerHTML, /<strong>127<\/strong>/);
  assert.match(elements.get('#app').innerHTML, /<strong>83<\/strong>/);
  assert.match(elements.get('#app').innerHTML, /<strong>31<\/strong>/);
  assert.match(elements.get('#app').innerHTML, /<strong>75<\/strong>/);
  assert.match(elements.get('#app').innerHTML, /Community and criticality comparison/);
  assert.match(elements.get('#app').innerHTML, /Data, architecture &amp; production foundations/);
  assert.match(elements.get('#app').innerHTML, /Peripheral \/ 32.8/);
  assert.match(elements.get('#app').innerHTML, /Watch \/ 21.2/);
  assert.match(elements.get('#result-count').textContent, /^158 of 158/);
  assert.match(elements.get('#columns').innerHTML, /Original/);
  assert.match(elements.get('#columns').innerHTML, /New/);
  elements.get('#change').value='Added';
  elements.get('#change').handlers.change();
  assert.match(elements.get('#result-count').textContent, /^31 of 158/);
  assert.doesNotMatch(elements.get('#rows').innerHTML, />Removed</);
});
