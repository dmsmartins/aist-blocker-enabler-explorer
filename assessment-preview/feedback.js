(function(root){
  'use strict';
  const KEY='aistQuestionFeedbackV1', API='https://aist-dependency-votes.diogomsmartins.workers.dev/question-feedback';
  let state, timer, sending=false, storageOK=true;
  try{state=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
  if(!state?.participantId||!state.records)state={participantId:crypto.randomUUID(),records:{}};
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}};
  function message(id,text){const el=document.querySelector('[data-feedback-status]');if(el?.dataset.feedbackStatus===id)el.textContent=text;}
  function getRecord(session){return state.records[session.assessment_id] ||= {participantId:state.participantId,assessmentId:session.assessment_id,version:session.catalog_version,revision:0,questions:[],savedRevision:0};}
  function schedule(){clearTimeout(timer);timer=setTimeout(flush,1400);}
  function update(session,questionId,patch){
    const record=getRecord(session);
    let q=record.questions.find(x=>x.questionId===questionId);
    if(!q){q={questionId,relevance:null,clarity:null,answered:false};record.questions.push(q);}
    if(Object.entries(patch).every(([k,v])=>q[k]===v))return;
    Object.assign(q,patch);record.revision++;persist();
    message(session.assessment_id,storageOK?'Saved on this device · waiting to sync.':'Waiting to sync · browser storage is unavailable.');schedule();
  }
  async function flush(){
    if(sending)return;
    sending=true;
    try{
      for(const record of Object.values(state.records)){
        if(record.revision<=record.savedRevision)continue;
        const snapshot=JSON.parse(JSON.stringify(record));delete snapshot.savedRevision;
        message(record.assessmentId,'Saving feedback…');
        try{
          const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(15000)});
          const result=await res.json();if(!res.ok||!result.saved)throw new Error();
          record.savedRevision=snapshot.revision;persist();
          message(record.assessmentId,record.revision===snapshot.revision?'Feedback saved. Thank you!':'Waiting to sync…');
          if(record.revision>snapshot.revision)schedule();
        }catch{message(record.assessmentId,storageOK?'Saved on this device. Could not sync — use Retry.':'Could not save. Keep this tab open and use Retry.');}
      }
    }finally{sending=false;}
  }
  function answered(session,questionId){
    const a=session.answers[questionId];
    // Count once per assessment/question. Never send maturity scores, notes or names.
    if(a&&(a.score!==null&&a.score!==undefined||a.response_state==='dont_know'||a.applicability==='not_applicable'))update(session,questionId,{answered:true});
  }
  function markup(){return `<details class="question-help question-feedback"><summary>Rate this question <span class="muted">(optional)</span></summary>
    <p class="feedback-intro">Help us improve the questionnaire. This does not affect your assessment score.</p>
    <div id="question-stars"></div><div class="feedback-actions"><button type="button" id="feedback-clear">Clear ratings</button><button type="button" id="feedback-retry">Retry</button></div>
    <p class="feedback-status" role="status" data-feedback-status=""></p>
    <small>Ratings and an anonymous answered/not-answered flag are shared with the research team. Your maturity scores, notes and assessment name stay in this browser.</small></details>`;}
  function mount(session,questionId){
    const record=getRecord(session), box=document.getElementById('question-stars');if(!box)return;
    const status=document.querySelector('[data-feedback-status]');status.dataset.feedbackStatus=session.assessment_id;
    function draw(){
      const q=record.questions.find(x=>x.questionId===questionId)||{};
      box.innerHTML=[['relevance','Relevance','How relevant is this question to the assessment?'],['clarity','Clarity','How clear and easy to understand is this question?']].map(([key,label,help])=>`<div class="feedback-row"><div><strong id="${key}-label">${label}</strong><small id="${key}-help">${help}</small></div><div class="feedback-stars" role="group" aria-labelledby="${key}-label" aria-describedby="${key}-help">${[1,2,3,4,5].map(n=>`<button type="button" data-rating="${key}" data-stars="${n}" aria-label="${label}: ${n} of 5 stars" aria-pressed="${q[key]===n}" class="${q[key]>=n?'filled':''}"><span aria-hidden="true">★</span></button>`).join('')}<span class="feedback-value">${q[key]?q[key]+'/5':'Not rated'}</span></div></div>`).join('')+'<small>1 = Very low · 5 = Very high</small>';
      box.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{const key=b.dataset.rating,n=Number(b.dataset.stars);update(session,questionId,{[key]:n});draw();box.querySelector(`[data-rating="${key}"][data-stars="${n}"]`).focus({preventScroll:true});});
    }
    draw();answered(session,questionId);
    document.getElementById('feedback-clear').onclick=()=>{update(session,questionId,{relevance:null,clarity:null});draw();};
    document.getElementById('feedback-retry').onclick=flush;
    message(session.assessment_id,record.revision>record.savedRevision?'Feedback waiting to sync.':record.revision?'Feedback saved. Thank you!':'Choose either rating, both, or skip.');
    if(record.revision>record.savedRevision)schedule();
  }
  addEventListener('online',flush);
  root.QuestionFeedback={markup,mount,answered,flush};
})(globalThis);
