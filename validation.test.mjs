import test from 'node:test';
import assert from 'node:assert/strict';
import './validation.js';
const {payload,escape}=globalThis.DependencyValidation;
test('only answered pairs are sent, preserving A to B direction and not sure',()=>{
  const draft={token:'signed',role:'Operations',pairs:[{a:{id:1},b:{id:2}},{a:{id:2},b:{id:1}},{a:{id:3},b:{id:1}}],answers:{0:{answer:'no',comment:'Reason'},2:{answer:'not_sure'}}};
  assert.deepEqual(payload(draft),{token:'signed',role:'Operations',votes:[{a:1,b:2,answer:'no',comment:'Reason'},{a:3,b:1,answer:'not_sure',comment:''}]});
});
test('card text and comments are escaped before rendering',()=>{
  assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
