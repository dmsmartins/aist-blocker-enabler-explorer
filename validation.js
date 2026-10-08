(function(root){
  'use strict';
  const API='https://aist-dependency-votes.diogomsmartins.workers.dev';
  const KEY='aist-dependency-review-v1'+(typeof location!=='undefined'&&new URLSearchParams(location.search).get('reviewTest')==='1'?'-test':'');
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let memory;
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return memory||{};}}
  function save(v){memory=v;try{localStorage.setItem(KEY,JSON.stringify(v));return true;}catch{return false;}}
  function payload(draft){return {token:draft.token,role:draft.role||'',votes:draft.pairs.flatMap((p,i)=>draft.answers[i]?.answer?[{a:p.a.id,b:p.b.id,answer:draft.answers[i].answer,comment:draft.answers[i].comment||''}]:[])};}
  async function request(path,data){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try{const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
      const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.error||'The service is unavailable. Please retry.'),{status:r.status});return result;
    }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('The connection was interrupted. Your answers remain here. Please retry.');throw e;}finally{clearTimeout(timer);}
  }
  function mount(host){
    const store=load();store.participantId ||= crypto.randomUUID();store.seen ||= {};
    let storageOk=save(store),draft=store.draft||null,screen=draft?(draft.pending||draft.expired?'review':'vote'):'start',busy=false,error='',success=null;
    const testMode=new URLSearchParams(location.search).get('reviewTest')==='1';
    function persist(){store.draft=draft;storageOk=save(store);}
    const alive=()=>host.querySelector('#review-panel');
    function download(){const blob=new Blob([JSON.stringify({type:'unsent-dependency-review',...draft},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`dependency-review-draft-${draft.sessionId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function render(){
      if(location.hash!=='#validate-dependencies')return;
      const answered=draft?payload(draft).votes.length:0;
      host.innerHTML=`<section class="vr-page" id="review-panel"><header class="vr-header"><span class="vr-eyebrow">DEPENDENCY REVIEW</span><h1>Does A depend on B?</h1><p>Two blockers. One direction. Share your judgement to help review the dependency map.</p></header>
        ${testMode||draft?.isTest?'<p class="vr-test">Test session — answers are excluded from analysis.</p>':''}
        ${!storageOk?'<p role="status" class="vr-error">This browser cannot save drafts locally. Keep this page open until your answers are submitted.</p>':''}
        <div role="alert" class="vr-error" ${error?'':'hidden'}>${escape(error)}</div>
        <div id="vr-content"></div>
        <p class="vr-privacy">No name or email is requested. A random browser identifier helps avoid counting repeat answers. Votes, optional role and comments are stored in a private GitHub repository for the project team. Avoid personal or confidential information. Drafts stay in this browser until you submit.</p></section>`;
      root.stageDependencyNavigation?.();
      const area=host.querySelector('#vr-content');
      if(screen==='start'){
        area.innerHTML=`<div class="vr-box vr-intro"><h2>Review a few pairs</h2><p>For each pair, consider: <strong>does addressing blocker A require progress on blocker B?</strong> Being related is not enough. The reverse direction is a separate question.</p><div class="vr-steps"><span><b>1</b> Read both blockers</span><span><b>2</b> Yes, No or Not sure</span><span><b>3</b> Submit your answers</span></div><p>You can stop early or continue with another set. Current links and their importance are hidden while you vote.</p><div class="vr-setup"><label>Pairs in this set<select id="vr-size"><option value="10">10 pairs</option><option value="15">15 pairs</option></select></label><label>Your role (optional)<input id="vr-role" maxlength="100" placeholder="e.g. Operations, IT, project manager" value="${escape(store.role||'')}"></label></div><button class="vr-primary" id="vr-start" ${busy?'disabled':''}>${busy?'Preparing pairs…':'Start reviewing'}</button></div>`;
        area.querySelector('#vr-start').onclick=async()=>{
          const size=Number(area.querySelector('#vr-size').value);store.role=area.querySelector('#vr-role').value.trim();busy=true;error='';render();
          try{const result=await request('/session',{participantId:store.participantId,size,exclude:store.seen[store.version]||[],excludeVersion:store.version,isTest:testMode});
            draft={...result,role:store.role,answers:{},index:0};store.version=result.version;screen='vote';persist();
          }catch(e){error=e.message;}finally{busy=false;if(alive())render();}
        };
      }else if(screen==='vote'){
        const i=draft.index,p=draft.pairs[i],answer=draft.answers[i]||{};
        area.innerHTML=`<div class="vr-progress"><span>Pair ${i+1} of ${draft.pairs.length}</span><span>${answered} answered</span></div><progress value="${answered}" max="${draft.pairs.length}" aria-label="Answered pairs"></progress><div class="vr-pair"><article class="vr-card vr-a"><span class="vr-badge">A · BLOCKER BEING EVALUATED</span><h2>${escape(p.a.title)}</h2><p>${escape(p.a.statement)}</p></article><div class="vr-direction" aria-label="A depends on B">depends on <span aria-hidden="true">→</span></div><article class="vr-card vr-b"><span class="vr-badge">B · POSSIBLE PREREQUISITE</span><h2>${escape(p.b.title)}</h2><p>${escape(p.b.statement)}</p></article></div><div class="vr-box"><fieldset><legend>Does addressing A require progress on B?</legend><p class="vr-hint">Assess A → B only. Choose “Not sure” if you need more context.</p><div class="vr-answers">${[['yes','Yes','A depends on B'],['no','No','A does not depend on B'],['not_sure','Not sure','I need more context']].map(([value,title,sub])=>`<label><input type="radio" name="vr-answer" value="${value}" ${answer.answer===value?'checked':''}><span><strong>${title}</strong><small>${sub}</small></span></label>`).join('')}</div></fieldset><label class="vr-comment">Comment (optional)<textarea id="vr-comment" maxlength="500" rows="2" placeholder="What makes this dependency valid or invalid?">${escape(answer.comment||'')}</textarea></label><div class="vr-actions"><button id="vr-back" ${i?'':'disabled'}>Previous pair</button><button id="vr-finish" ${answered?'':'disabled'}>Finish & review</button><button class="vr-primary" id="vr-next" ${answer.answer?'':'disabled'}>${i+1===draft.pairs.length?'Review answers':'Next pair →'}</button></div></div><p class="vr-saved">Draft saved in this browser · catalogue ${escape(draft.version.slice(0,7))}</p>`;
        area.querySelectorAll('[name="vr-answer"]').forEach(el=>el.onchange=()=>{draft.answers[i]={answer:el.value,comment:area.querySelector('#vr-comment').value};persist();render();host.querySelector('input:checked')?.focus();});
        area.querySelector('#vr-comment').oninput=e=>{draft.answers[i]={...draft.answers[i],comment:e.target.value};persist();};
        area.querySelector('#vr-back').onclick=()=>{draft.index--;persist();render();};
        area.querySelector('#vr-next').onclick=()=>{if(i+1===draft.pairs.length)screen='review';else draft.index++;persist();render();};
        area.querySelector('#vr-finish').onclick=()=>{screen='review';persist();render();};
      }else if(screen==='review'){
        const votes=payload(draft).votes;
        area.innerHTML=`<div class="vr-box"><h2>Ready to submit ${votes.length} answer${votes.length===1?'':'s'}?</h2><p>${votes.filter(v=>v.answer==='yes').length} Yes · ${votes.filter(v=>v.answer==='no').length} No · ${votes.filter(v=>v.answer==='not_sure').length} Not sure</p><p>Your answers help the project team review the map. They will not change the published dependencies automatically.</p><div class="vr-review-list">${draft.pairs.map((p,i)=>draft.answers[i]?.answer?`<button data-edit="${i}" ${busy||draft.pending?'disabled':''}><span>${escape(p.a.title)} → ${escape(p.b.title)}</span><b>${escape({yes:'Yes',no:'No',not_sure:'Not sure'}[draft.answers[i].answer])}</b></button>`:'').join('')}</div><div class="vr-actions"><button id="vr-return" ${busy||draft.pending?'disabled':''}>Back to pairs</button><button id="vr-download" ${busy?'disabled':''}>Export draft</button><button class="vr-primary" id="vr-submit" ${busy||!votes.length?'disabled':''}>${busy?'Saving answers…':draft.pending?'Retry submission':'Submit answers'}</button></div>${draft.pending?'<p class="vr-hint">Submission is locked while delivery is uncertain. Retry safely: it will not create a duplicate.</p>':''}</div>`;
        area.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>{draft.index=Number(el.dataset.edit);screen='vote';persist();render();});
        area.querySelector('#vr-return').onclick=()=>{screen='vote';render();};
        area.querySelector('#vr-download').onclick=download;
        if(draft.expired){area.querySelector('#vr-submit').disabled=true;const restart=document.createElement('button');restart.textContent='Export draft & start again';restart.onclick=()=>{download();draft=null;screen='start';error='';persist();render();};area.querySelector('.vr-actions').append(restart);}
        area.querySelector('#vr-submit').onclick=async()=>{
          draft.pending ||= payload(draft);persist();busy=true;error='';render();
          try{const result=await request('/votes',draft.pending);if(result.saved!==true)throw new Error('Save was not confirmed. Please retry.');
            const seen=new Set(store.seen[draft.version]||[]);draft.pending.votes.forEach(v=>seen.add(`${v.a}>${v.b}`));store.seen[draft.version]=[...seen];
            success={count:draft.pending.votes.length,id:result.sessionId,isTest:draft.isTest};draft=null;screen='done';persist();
          }catch(e){error=e.message;if([400,410].includes(e.status)){draft.expired=true;persist();}}finally{busy=false;if(alive())render();}
        };
      }else{
        area.innerHTML=`<div class="vr-box vr-done" role="status"><span class="vr-check" aria-hidden="true">✓</span><h2>Answers saved. Thank you.</h2><p>${success.count} answer${success.count===1?' has':'s have'} been stored${success.isTest?' as test data':' for review'}.</p><p>You can finish here or review another set.</p><button class="vr-primary" id="vr-more">Review more pairs</button><p class="vr-hint">Receipt: ${escape(success.id)}</p></div>`;
        area.querySelector('#vr-more').onclick=()=>{screen='start';error='';render();};
      }
    }
    render();
  }
  root.DependencyValidation={mount,payload,escape};
})(globalThis);
