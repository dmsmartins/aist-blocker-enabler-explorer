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
test('reverse remains an answer about the original directed pair for new and legacy drafts',()=>{
  for(const reviewScope of [undefined,'dependency-review-84-v1']){
    const draft={token:'signed',reviewScope,pairs:[{a:{id:1024},b:{id:1323}}],answers:{0:{answer:'reverse'}}};
    assert.deepEqual(payload(draft).votes,[{a:1024,b:1323,answer:'reverse',comment:''}]);
  }
});
test('new drafts require the scoped service; legacy drafts have clear resumable guidance',()=>{
  const {validateSession,scopeMessage}=globalThis.DependencyValidation;
  const response={reviewScope:'dependency-review-84-v1',eligiblePairCount:84,pairs:[{a:{id:1024},b:{id:1323}}]};
  assert.equal(validateSession(response),response);
  assert.throws(()=>validateSession({pairs:response.pairs}),/service has been updated/);
  assert.throws(()=>validateSession({...response,reviewScope:'unknown'}));
  assert.throws(()=>validateSession({...response,eligiblePairCount:85}));
  assert.match(scopeMessage(null),/84 selected directed pairs/);
  assert.match(scopeMessage(response),/Reverse direction/);
  assert.match(scopeMessage({token:'legacy'}),/Resuming an earlier session/);
});
