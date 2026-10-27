import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('./feedback.js',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../data/explorer_catalog.json',import.meta.url)));
const questionId=catalog.questionnaires[0].questions[0].question_id;
const session=()=>({assessment_id:crypto.randomUUID(),catalog_version:catalog.catalog_version,assessment_name:'Private name',answers:{[questionId]:{score:null,applicability:'undecided',evidence:'Private evidence'}}});
function browser(storage=new Map()){
  const posts=[],status={dataset:{},textContent:''};
  const stars=['relevance','clarity'].flatMap(rating=>[1,2,3,4,5].map(n=>({dataset:{rating,stars:String(n)}})));
  const box={innerHTML:'',querySelectorAll:()=>stars,querySelector:()=>({focus(){}})};
  const elements={'question-stars':box,'feedback-clear':{},'feedback-retry':{}};
  const context={crypto,AbortSignal,setTimeout:()=>1,clearTimeout(){},addEventListener(){},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    document:{querySelector:()=>status,getElementById:id=>elements[id]},
    fetch:async(url,options)=>{posts.push({url,body:JSON.parse(options.body)});if(context.offline)throw Error('Offline');return {ok:true,json:async()=>({saved:true})};}};
  runInNewContext(source,context);
  return {context,feedback:context.QuestionFeedback,posts,stars,elements,storage,status};
}

test('independent stars and clearing sync without changing or transmitting maturity answers',async()=>{
  const b=browser(),s=session(),before=JSON.stringify(s);
  b.feedback.mount(s,questionId);
  b.stars.find(x=>x.dataset.rating==='relevance'&&x.dataset.stars==='5').onclick();
  b.stars.find(x=>x.dataset.rating==='clarity'&&x.dataset.stars==='3').onclick();
  await b.feedback.flush();
  const payload=b.posts[0].body;
  assert.equal(payload.version,catalog.catalog_version);
  assert.deepEqual(payload.questions,[{questionId,relevance:5,clarity:3,answered:false}]);
  assert.equal(JSON.stringify(s),before);
  assert.ok(!JSON.stringify(payload).includes('Private'));
  assert.deepEqual(Object.keys(payload).sort(),['assessmentId','participantId','questions','revision','version']);
  b.elements['feedback-clear'].onclick();await b.feedback.flush();
  assert.equal(b.posts[1].body.questions[0].relevance,null);
  assert.equal(b.posts[1].body.questions[0].clarity,null);
  assert.equal(b.posts[1].body.assessmentId,payload.assessmentId);
});

test('zero, N/A and unknown count once per question; blank answers do not submit',async()=>{
  for(const patch of [{score:0,applicability:'applicable'},{applicability:'not_applicable'},{response_state:'dont_know'}]){
    const b=browser(),s=session();b.feedback.mount(s,questionId);await b.feedback.flush();assert.equal(b.posts.length,0);
    Object.assign(s.answers[questionId],patch);b.feedback.answered(s,questionId);b.feedback.answered(s,questionId);
    await b.feedback.flush();await b.feedback.flush();
    assert.equal(b.posts.length,1);assert.equal(b.posts[0].body.revision,1);assert.equal(b.posts[0].body.questions[0].answered,true);
    const reopened=browser(b.storage);reopened.feedback.mount(s,questionId);await reopened.feedback.flush();assert.equal(reopened.posts.length,0);
  }
});

test('failed sync survives reload and retry preserves assessment, catalogue and revision',async()=>{
  const b=browser(),s=session();s.catalog_version='historical-catalogue';s.answers[questionId].score=2;
  b.context.offline=true;b.feedback.mount(s,questionId);await b.feedback.flush();
  assert.ok(b.status.textContent.includes('Could not sync'));
  const reopened=browser(b.storage);reopened.feedback.mount(s,questionId);await reopened.feedback.flush();
  assert.deepEqual(reopened.posts[0].body,b.posts[0].body);
  assert.equal(reopened.posts[0].body.version,'historical-catalogue');
  assert.ok(reopened.status.textContent.includes('Feedback saved'));
});
