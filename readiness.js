(function (root) {
  'use strict';
  const KEY = 'aistProjectReadinessV1';
  const RESPONSES = {yes:'Yes',partial:'Partly',no:'No',unsure:'Not sure',na:'Not applicable'};
  const escape = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = value => typeof value==='string'?value:'';
  function validate(data) {
    const questions=data.readinessQuestions, mappings=data.questionBlockerMap;
    if (!Array.isArray(questions)||!questions.length||!Array.isArray(mappings)||!mappings.length) throw new Error('Project readiness questions are not available in the current data.');
    const ids=new Set(), blockers=new Set(data.blockers.map(b=>b.id)), pairs=new Set();
    for(const q of questions){
      if(typeof q.id!=='string'||ids.has(q.id)||!q.question||!Array.isArray(q.sourceBlockerIds)||!q.sourceBlockerIds.length||!q.sourceBlockerIds.every(id=>blockers.has(id))||!data.stageGates.some(g=>g.id===q.provisionalStageGate))throw new Error('Project readiness data contains an invalid question.');
      ids.add(q.id);
    }
    for(const m of mappings){
      const pair=JSON.stringify([m.questionId,m.blockerId]);
      if(!ids.has(m.questionId)||!blockers.has(m.blockerId)||!['Direct','Contextual'].includes(m.relationship)||pairs.has(pair))throw new Error('Project readiness data contains an invalid mapping.');
      pairs.add(pair);
    }
    for(const q of questions){
      const direct=mappings.filter(m=>m.questionId===q.id&&m.relationship==='Direct').map(m=>m.blockerId);
      if(direct.length!==q.sourceBlockerIds.length||q.sourceBlockerIds.some(id=>!direct.includes(id)))throw new Error('Project readiness source references do not match the Direct mappings.');
    }
  }
  function signature(q,data) {
    return JSON.stringify([q,data.questionBlockerMap.filter(m=>m.questionId===q.id)]);
  }
  function clean(saved,data) {
    const out={version:1,projectName:text(saved?.projectName),answers:{},updatedAt:text(saved?.updatedAt),currentStep:Number.isInteger(saved?.currentStep)&&saved.currentStep>=0&&saved.currentStep<data.readinessQuestions.length?saved.currentStep:0};
    for(const q of data.readinessQuestions){
      const a=saved?.answers?.[q.id];
      if(!a||typeof a!=='object')continue;
      const valid=data.questionBlockerMap.filter(m=>m.questionId===q.id&&m.relationship==='Direct').map(m=>m.blockerId);
      out.answers[q.id]={response:Object.hasOwn(RESPONSES,a.response)?a.response:'',evidence:text(a.evidence),comments:text(a.comments),owner:text(a.owner),action:text(a.action),dueDate:/^\d{4}-\d{2}-\d{2}$/.test(a.dueDate||'')?a.dueDate:'',affectedBlockerIds:Array.isArray(a.affectedBlockerIds)?[...new Set(a.affectedBlockerIds.filter(id=>valid.includes(id)))]:[],signature:text(a.signature)};
    }
    return out;
  }
  function classify(a,q,data) {
    if(!a?.response||!Object.hasOwn(RESPONSES,a.response))return 'unanswered';
    if(a.signature!==signature(q,data))return 'stale';
    if(a.response==='na')return a.comments?.trim()?'not-applicable':'justify-na';
    if(a.response==='yes')return a.evidence?.trim()?'evidenced':'evidence-needed';
    return 'gap';
  }
  function report(data,session) {
    validate(data);
    const rows=data.readinessQuestions.map(q=>{
      const a=session.answers[q.id]||{}, kind=classify(a,q,data);
      const direct=data.questionBlockerMap.filter(m=>m.questionId===q.id&&m.relationship==='Direct');
      const contextual=data.questionBlockerMap.filter(m=>m.questionId===q.id&&m.relationship==='Contextual');
      const selected=Array.isArray(a.affectedBlockerIds)?a.affectedBlockerIds:[];
      const candidate=['gap','evidence-needed'].includes(kind)?direct.filter(m=>!selected.length||selected.includes(m.blockerId)):[];
      const blockerIds=new Set(candidate.map(m=>m.blockerId));
      const links=data.relationships.filter(r=>blockerIds.has(r.blockerId));
      const enablers=[...new Set(links.map(r=>r.enablerId))].map(id=>({
        ...data.enablers.find(e=>e.id===id),
        links:links.filter(r=>r.enablerId===id)
      })).filter(e=>e.id!=null);
      return {question:q,answer:a,kind,direct,contextual,candidate,enablers};
    });
    return {projectName:session.projectName||'Untitled project',updatedAt:session.updatedAt,rows,
      counts:Object.fromEntries(['unanswered','stale','not-applicable','justify-na','evidenced','evidence-needed','gap'].map(k=>[k,rows.filter(r=>r.kind===k).length])),
      unresolved:rows.filter(r=>!['evidenced','not-applicable'].includes(r.kind)).length,
      candidateBlockers:[...new Set(rows.flatMap(r=>r.candidate.map(m=>m.blockerId)))]};
  }
  const labels={unanswered:'Not answered',stale:'Review after framework update','not-applicable':'Not applicable — reason recorded','justify-na':'Reason for N/A needed',evidenced:'Yes — evidence recorded','evidence-needed':'Evidence needed',gap:'Gap or uncertainty reported'};
  function markdown(data,session) {
    const r=report(data,session), lines=['# AI Project Readiness: '+r.projectName,'','Candidate framework for UIC review. Self-reported answers do not approve Stage Gates or clear blockers.','',r.unresolved+' of '+r.rows.length+' questions need attention.',''];
    for(const row of r.rows){
      const q=row.question,a=row.answer;
      lines.push('## '+q.id+': '+q.question,'','Provisional Gate '+q.provisionalStageGate+' — '+q.lifecycleStage,'Status: '+labels[row.kind], 'Framework review: '+q.reviewStatus,
        'Response: '+(RESPONSES[a.response]||'Not answered'),'Evidence: '+(a.evidence||'Not recorded'),'Comments / N/A reason: '+(a.comments||'Not recorded'),
        'Planned action: '+(a.action||'Not recorded'),'Owner: '+(a.owner||'Not assigned'),'Target date: '+(a.dueDate||'Not set'),'');
      for(const m of row.direct)lines.push('- Direct draft mapping: '+m.blockerTitle+' ['+m.blockerId+'] ('+m.reviewStatus+')');
      for(const m of row.contextual)lines.push('- Context only: '+m.blockerTitle+' ['+m.blockerId+'] ('+m.reviewStatus+')');
      if(row.candidate.length)lines.push('','Candidate issues for review: '+row.candidate.map(m=>m.blockerTitle).join('; '));
      for(const e of row.enablers)lines.push('','### Suggested enabler: '+e.title,e.practicalActions||e.description||'',...e.links.map(link=>'Linked blocker '+link.blockerId+' via '+link.mechanism+': '+(link.rationale||'')));
      lines.push('');
    }
    return lines.join('\n');
  }
  function mount(host,data,options={}) {
    try{validate(data);}catch(error){host.innerHTML='<section class="page narrow"><h2>AI Project Readiness</h2><p role="alert">'+escape(error.message)+'</p><a href="#maturity">Back to assessments</a></section>';return;}
    let storage;
    try{storage=root.localStorage;}catch{}
    let message='',saved=null;
    try{saved=JSON.parse(storage?.getItem(KEY)||'null');if(saved&&(saved.version!==1||!saved.answers||typeof saved.answers!=='object'))throw new Error();}
    catch{message='The saved assessment could not be read. This session starts blank; export your work before leaving.';}
    let session=clean(saved,data),step=session.currentStep,view='questions',saveFailed=!storage;
    function persist(){
      session.updatedAt=new Date().toISOString();
      try{if(!storage)throw new Error();storage.setItem(KEY,JSON.stringify(session));saveFailed=false;}catch{saveFailed=true;}
      const status=host.querySelector('[data-save-status]');
      if(status){status.textContent=saveFailed?'Could not save in this browser. Download the assessment before leaving.':'Saved on this browser only.';status.setAttribute('role',saveFailed?'alert':'status');}
    }
    function download(filename,content,type){
      const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
      a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function exportAssessment(){
      download('aist-project-readiness.json',JSON.stringify({type:'aist-project-readiness',...session,framework:{questions:data.readinessQuestions,mappings:data.questionBlockerMap}},null,2),'application/json');
    }
    function shell(content){
      host.innerHTML='<section class="page readiness"><div class="readiness-heading"><div><p class="eyebrow">AI Project Readiness</p><h2>Assess your project</h2></div><a class="back-btn" href="#maturity">← Assessments</a></div>'+
      '<p class="readiness-notice">Candidate questions and mappings for UIC review. Gates are provisional. Your answers support discussion and do not approve deployment or clear linked blockers.</p>'+
      (message?'<p role="alert" class="readiness-notice">'+escape(message)+'</p>':'')+
      '<div class="readiness-toolbar"><label>Project name<input id="readiness-project" maxlength="160" value="'+escape(session.projectName)+'" placeholder="Name your project"></label><div class="readiness-tools"><button class="outline-btn" data-rview="questions">Questions</button><button class="primary-btn" data-rview="report">Gap report</button><button class="outline-btn" id="readiness-export">Download assessment</button><button class="text-action" id="readiness-reset">New assessment</button></div></div>'+
      '<p data-save-status role="status" class="subtle">'+(saveFailed?'Could not save in this browser. Download before leaving.':'Saved on this browser only. Download a copy to keep a backup.')+'</p>'+content+'</section>';
      host.querySelector('#readiness-project').oninput=e=>{session.projectName=e.target.value;persist();const title=host.querySelector('#readiness-report-title');if(title)title.textContent='Gap and action report · '+(session.projectName||'Untitled project');};
      host.querySelectorAll('[data-rview]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.rview===view));b.onclick=()=>{view=b.dataset.rview;render();};});
      host.querySelector('#readiness-export').onclick=exportAssessment;
      host.querySelector('#readiness-reset').onclick=()=>{
        if(!root.confirm('Start a new assessment? This replaces the answers saved in this browser. Download a copy first if needed.'))return;
        session=clean(null,data);step=0;view='questions';message='';persist();render();
      };
      host.querySelectorAll('[data-blocker]').forEach(b=>b.onclick=()=>options.openBlocker?.(Number(b.dataset.blocker)));
    }
    function render(){
      if(view==='report'){renderReport();return;}
      const q=data.readinessQuestions[step],a=session.answers[q.id]||{},direct=data.questionBlockerMap.filter(m=>m.questionId===q.id&&m.relationship==='Direct'),contextual=data.questionBlockerMap.filter(m=>m.questionId===q.id&&m.relationship==='Contextual');
      const result=report(data,session),kind=classify(a,q,data),completed=result.rows.filter(r=>['evidenced','not-applicable'].includes(r.kind)).length;
      shell('<div class="readiness-progress"><strong>Question '+(step+1)+' of '+data.readinessQuestions.length+'</strong><span data-answer-count>'+completed+' with evidence or an N/A reason</span></div>'+
        '<label class="readiness-jump">Jump to a question<select id="readiness-jump">'+data.readinessQuestions.map((x,i)=>'<option value="'+i+'" '+(i===step?'selected':'')+'>Gate '+x.provisionalStageGate+' · '+(i+1)+'. '+escape(x.question)+'</option>').join('')+'</select></label>'+
        '<article class="readiness-question"><p class="eyebrow">Provisional Gate '+q.provisionalStageGate+' · '+escape(q.lifecycleStage)+'</p><h3 id="readiness-question-title" tabindex="-1">'+escape(q.question)+'</h3>'+
        '<p>'+escape(q.guidance)+'</p><p class="subtle">'+escape((q.dimensions||[]).join(' / '))+' · '+escape(q.reviewStatus)+'</p>'+
        (kind==='stale'?'<p role="alert" class="readiness-notice">This question or its mappings changed since your answer. Review your answer, then <button class="text-action" id="readiness-confirm">confirm it for this version</button>.</p>':'')+
        '<fieldset><legend>Your response</legend><div class="readiness-responses">'+Object.entries(RESPONSES).map(([value,label])=>'<label><input type="radio" name="readiness-response" value="'+value+'" '+(a.response===value?'checked':'')+'>'+label+'</label>').join('')+'</div></fieldset>'+
        '<div class="readiness-inputs"><label>Evidence or evidence links <span class="subtle">(needed for Yes)</span><textarea id="readiness-evidence" rows="3" maxlength="8000">'+escape(a.evidence||'')+'</textarea></label>'+
        '<label>Gaps, comments or reason for N/A<textarea id="readiness-comments" rows="3" maxlength="8000">'+escape(a.comments||'')+'</textarea></label></div>'+
        '<details class="readiness-details"><summary>Guidance, evidence examples and linked issues</summary><p>'+escape(q.applicability)+'</p><ul>'+(q.evidenceExamples||[]).map(e=>'<li>'+escape(e)+'</li>').join('')+'</ul>'+
        '<p>'+escape(q.reviewComments)+'</p><h4>Direct draft mappings</h4><ul>'+direct.map(m=>'<li><button class="text-action" data-blocker="'+m.blockerId+'">'+escape(m.blockerTitle)+'</button> · '+escape(m.reviewStatus)+'<p>'+escape(m.rationale)+'</p></li>').join('')+'</ul>'+
        (contextual.length?'<h4>Context only</h4><ul>'+contextual.map(m=>'<li>'+escape(m.blockerTitle)+' · '+escape(m.reviewStatus)+'<p>'+escape(m.rationale)+'</p></li>').join('')+'</ul>':'')+'</details>'+
        '<details class="readiness-details" '+(['no','partial','unsure'].includes(a.response)?'open':'')+'><summary>Plan follow-up actions</summary><fieldset><legend>Which linked issues need attention?</legend><p class="subtle">Select issues you have identified. If none are selected, the report lists all Direct mappings as candidates for review.</p>'+direct.map(m=>'<label class="readiness-checkbox"><input type="checkbox" data-affected="'+m.blockerId+'" '+((a.affectedBlockerIds||[]).includes(m.blockerId)?'checked':'')+'>'+escape(m.blockerTitle)+'</label>').join('')+'</fieldset>'+
        '<label>Planned action<textarea id="readiness-action" rows="2" maxlength="8000">'+escape(a.action||'')+'</textarea></label><div class="readiness-inputs"><label>Owner<input id="readiness-owner" maxlength="200" value="'+escape(a.owner||'')+'"></label><label>Target date<input type="date" id="readiness-date" value="'+escape(a.dueDate||'')+'"></label></div></details>'+
        '<p id="readiness-answer-status" aria-live="polite">'+escape(labels[kind])+'</p><div class="assessment-nav"><button class="outline-btn" id="readiness-prev" '+(step===0?'disabled':'')+'>← Previous</button><button class="primary-btn" id="readiness-next">'+(step===data.readinessQuestions.length-1?'View gap report':'Next question →')+'</button></div></article>');
      function update(field,value){
        session.answers[q.id]={response:'',evidence:'',comments:'',owner:'',action:'',dueDate:'',affectedBlockerIds:[],...session.answers[q.id],[field]:value};
        if(field==='response')session.answers[q.id].signature=signature(q,data);
        persist();
        host.querySelector('#readiness-answer-status').textContent=labels[classify(session.answers[q.id],q,data)];
        host.querySelector('[data-answer-count]').textContent=report(data,session).rows.filter(r=>['evidenced','not-applicable'].includes(r.kind)).length+' with evidence or an N/A reason';
      }
      for(const [id,field] of [['evidence','evidence'],['comments','comments'],['action','action'],['owner','owner'],['date','dueDate']]){
        host.querySelector('#readiness-'+id).oninput=e=>update(field,e.target.value);
      }
      host.querySelectorAll('[name="readiness-response"]').forEach(el=>el.onchange=e=>{update('response',e.target.value);});
      host.querySelectorAll('[data-affected]').forEach(el=>el.onchange=()=>update('affectedBlockerIds',[...host.querySelectorAll('[data-affected]:checked')].map(e=>Number(e.dataset.affected))));
      host.querySelector('#readiness-confirm')?.addEventListener('click',()=>{update('signature',signature(q,data));render();});
      function move(next){step=next;session.currentStep=next;persist();render();host.querySelector('#readiness-question-title')?.focus();}
      host.querySelector('#readiness-jump').onchange=e=>move(Number(e.target.value));
      host.querySelector('#readiness-prev').onclick=()=>move(step-1);
      host.querySelector('#readiness-next').onclick=()=>{if(step<data.readinessQuestions.length-1)move(step+1);else{view='report';render();host.querySelector('#readiness-report-title').focus();}};
    }
    function renderReport(){
      const r=report(data,session);
      const groups=data.stageGates.map(g=>{
        const rows=r.rows.filter(x=>x.question.provisionalStageGate===g.id);
        if(!rows.length)return '';
        return '<section class="readiness-gate"><h3>Provisional Gate '+g.id+' · '+escape(g.label)+'</h3>'+rows.map(row=>{
          const q=row.question,a=row.answer,i=data.readinessQuestions.indexOf(q);
          return '<article class="readiness-report-row" data-kind="'+row.kind+'"><div class="readiness-row-heading"><h4>'+escape(q.question)+'</h4><button class="text-action" data-edit="'+i+'">Edit answer</button></div><p><strong>'+escape(labels[row.kind])+'</strong> · '+escape(RESPONSES[a.response]||'Not answered')+'</p>'+
          '<p class="subtle">'+escape(q.reviewStatus)+' · '+escape(q.reviewComments)+'</p>'+
          (a.evidence?'<p><strong>Evidence:</strong> '+escape(a.evidence)+'</p>':'')+(a.comments?'<p><strong>Comments / N/A reason:</strong> '+escape(a.comments)+'</p>':'')+
          '<p><strong>Planned action:</strong> '+escape(a.action||'Not recorded')+'<br><strong>Owner:</strong> '+escape(a.owner||'Not assigned')+' · <strong>Target:</strong> '+escape(a.dueDate||'Not set')+'</p>'+
          (row.candidate.length?'<details class="readiness-details"><summary>'+row.candidate.length+' candidate blocker issues · '+row.enablers.length+' suggested enablers</summary><p>These are candidates from Direct mappings for review, not validated diagnoses.</p><ul>'+row.candidate.map(m=>'<li><button class="text-action" data-blocker="'+m.blockerId+'">'+escape(m.blockerTitle)+'</button> · '+escape(m.reviewStatus)+'</li>').join('')+'</ul>'+row.enablers.map(e=>'<details class="readiness-enabler"><summary>'+escape(e.title)+'</summary><p>'+escape(e.description||'')+'</p><p><strong>Possible actions:</strong> '+escape(e.practicalActions||'Not specified')+'</p><p><strong>Expected outcome:</strong> '+escape(e.expectedOutcome||'Not specified')+'</p>'+e.links.map(link=>'<p class="subtle">'+escape(data.blockers.find(b=>b.id===link.blockerId)?.title||'')+' · '+escape(link.mechanism)+': '+escape(link.rationale||'')+'</p>').join('')+'</details>').join('')+'</details>':'')+
          (row.contextual.length?'<p class="subtle">Context only: '+row.contextual.map(m=>escape(m.blockerTitle)).join('; ')+'. These links do not create gap diagnoses.</p>':'')+'</article>';
        }).join('')+'</section>';
      }).join('');
      shell('<div class="readiness-report"><h3 id="readiness-report-title" tabindex="-1">Gap and action report · '+escape(r.projectName)+'</h3>'+
        '<p>'+r.unresolved+' of '+r.rows.length+' questions need attention. '+r.candidateBlockers.length+' distinct candidate blocker issues are linked to reported gaps or missing evidence.</p>'+
        '<div class="readiness-counts">'+Object.entries(r.counts).filter(([,v])=>v).map(([k,v])=>'<span>'+v+' · '+escape(labels[k])+'</span>').join('')+'</div>'+
        '<p>Recorded evidence is self-reported and has not been verified. Review each component of grouped questions separately. No overall readiness score or gate approval is calculated.</p>'+
        '<div class="readiness-tools"><button class="outline-btn" id="readiness-markdown">Download report</button><button class="outline-btn" id="readiness-print">Print / PDF</button></div>'+groups+'</div>');
      host.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{step=Number(b.dataset.edit);session.currentStep=step;persist();view='questions';render();host.querySelector('#readiness-question-title').focus();});
      host.querySelector('#readiness-markdown').onclick=()=>download('aist-project-readiness-report.md',markdown(data,session),'text/markdown');
      host.querySelector('#readiness-print').onclick=()=>{
        const details=[...host.querySelectorAll('details')],opened=details.map(d=>d.open);details.forEach(d=>d.open=true);
        const restore=()=>{details.forEach((d,i)=>d.open=opened[i]);root.removeEventListener('afterprint',restore);};
        root.addEventListener('afterprint',restore);root.print();
      };
    }
    render();
  }
  root.ProjectReadiness={validate,signature,clean,classify,report,markdown,mount,escape,KEY};
})(globalThis);
