(function(root) {
  'use strict';
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const weightOK = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const key = q => [q.questionnaire_version,q.assessment_type,q.mode].join('|');
  const assert = (condition,message) => { if (!condition) throw new Error(message); };
  function validate(c) {
    assert(c?.schema_version === '1.0.0' && text(c.catalog_version), 'Unsupported catalogue.');
    const ids = new Set(c.blockers.map(b=>b.blocker_id));
    const enablers = new Set(c.enablers.map(e=>e.enabler_id));
    assert(ids.size===41 && c.blockers.length===41 && [...ids].every(Number.isInteger),'Invalid blocker IDs.');
    assert(enablers.size===c.enablers.length,'Duplicate enabler IDs.');
    assert(c.blocker_dependencies.length===127 && c.blocker_enabler_relationships.length===152,'Unexpected relation counts.');
    for (const edges of [c.blocker_dependencies,c.blocker_enabler_relationships]) {
      assert(new Set(edges.map(e=>e.relationship_id)).size===edges.length,'Duplicate relationship IDs.');
      for (const e of edges) assert(ids.has(e.blocker_id) && (e.depends_on_blocker_id!==undefined ? ids.has(e.depends_on_blocker_id) : enablers.has(e.enabler_id)), 'Unknown relation endpoint.');
    }
    assert(c.questionnaires.length===4 && new Set(c.questionnaires.map(q=>q.assessment_type+'|'+q.mode)).size===4,'Expected four distinct questionnaires.');
    let total=0;
    for (const q of c.questionnaires) {
      assert(['company','project'].includes(q.assessment_type) && ['quick','expert'].includes(q.mode),'Invalid questionnaire type.');
      assert(q.questions.length===(q.mode==='quick'?16:41),'Unexpected question count.');
      const pairs=c.question_blocker.filter(m=>key(m)===key(q));
      assert(pairs.length===41 && new Set(pairs.map(m=>m.blocker_id)).size===41,'Invalid mapping coverage.');
      const seen=new Set();
      for (const question of q.questions) {
        assert(!seen.has(question.question_id) && text(question.text) && key(question)===key(q),'Invalid question identity.');
        seen.add(question.question_id);
        assert(weightOK(question.default_weight) && [0,1,2,3,4].every(n=>text(question['rubric_'+n])),'Invalid weight or rubric.');
        const mapped=pairs.filter(m=>m.question_id===question.question_id).map(m=>m.blocker_id);
        assert(mapped.length>0 && mapped.length===question.blocker_ids.length && mapped.every(id=>ids.has(id)&&question.blocker_ids.includes(id)), 'Invalid question mapping.');
        assert(q.mode!=='expert'||mapped.length===1,'Expert requires one blocker per question.');
      }
      total+=q.questions.length;
    }
    assert(total===114 && c.question_blocker.length===164,'Invalid catalogue totals.');
    return c;
  }
  function questionnaire(c,s) {
    const q=c.questionnaires.find(q=>key(q)===s.questionnaire_key);
    assert(q && s.catalog_version===c.catalog_version && s.maps_version===c.maps_version,'Assessment snapshot does not match catalogue.');
    return q;
  }
  function create(c,q,id,now) {
    return {assessment_id:id,entity_id:'',entity_name:'',scope:'',target_scale:'',author:'',assessment_date:now.slice(0,10),created_at:now,updated_at:now,catalog_version:c.catalog_version,maps_version:c.maps_version,questionnaire_key:key(q),assessment_type:q.assessment_type,mode:q.mode,questionnaire_version:q.questionnaire_version,questionnaire_snapshot:structuredClone(q),source_quick_assessment_id:null,answers:Object.fromEntries(q.questions.map(x=>[x.question_id,{score:null,applicability:'undecided',evidence:'',na_reason:'',all_blockers_not_applicable:false,effective_weight:x.default_weight,review_comment:'',author:'',updated_at:now}])),current_step:0};
  }
  function classify(a,q,mode) {
    if (!a || !weightOK(a.effective_weight)) return 'invalid';
    if(a.applicability==='not_applicable') return a.score===null && text(a.na_reason) && (mode!=='quick'||a.all_blockers_not_applicable===true) ? 'not_applicable':'na_reason_missing';
    if(a.score===null) return 'unanswered';
    if(a.applicability!=='applicable'||!Number.isInteger(a.score)||a.score<0||a.score>4) return 'invalid';
    return text(a.evidence)?'valid':'evidence_missing';
  }
  function validateAssessment(c,s) {
    const q=questionnaire(c,s);
    assert(text(s.assessment_id) && s.assessment_id.length<=100,'Invalid assessment ID.');
    assert(JSON.stringify(s.questionnaire_snapshot)===JSON.stringify(q),'Questionnaire snapshot changed.');
    for(const field of ['entity_id','entity_name','scope','target_scale','author','assessment_date']) assert(typeof s[field]==='string','Invalid assessment metadata.');
    assert(s.answers && Object.keys(s.answers).length===q.questions.length,'Invalid answer count.');
    for (const question of q.questions) {
      const a=s.answers[question.question_id];
      assert(a && weightOK(a.effective_weight),'Invalid effective weight.');
      assert(a.score===null||Number.isInteger(a.score)&&a.score>=0&&a.score<=4,'Invalid score.');
      assert(['applicable','not_applicable','undecided'].includes(a.applicability),'Invalid applicability.');
      assert(a.applicability==='applicable'||a.score===null,'Score incompatible with applicability.');
      for (const field of ['evidence','na_reason','review_comment']) assert(typeof a[field]==='string','Invalid answer text.');
    }
    return s;
  }
  function report(c,s) {
    const q=questionnaire(c,s), rows=[], counts={valid:0,not_applicable:0,unanswered:0,evidence_missing:0,na_reason_missing:0,invalid:0,zero_weight:0};
    let numerator=0,denominator=0;
    const blockers=[];
    for (const question of q.questions) {
      const answer=s.answers[question.question_id],status=classify(answer,question,q.mode);
      counts[status]++;
      if(answer?.effective_weight===0)counts.zero_weight++;
      if(status==='valid'){numerator+=answer.effective_weight*answer.score;denominator+=4*answer.effective_weight;}
      rows.push({question,answer,status});
      for (const id of question.blocker_ids) {
        const b=c.blockers.find(b=>b.blocker_id===id);
        blockers.push({...b,question_id:question.question_id,status,score:status==='valid'?answer.score:null,allocated_weight:answer.effective_weight/question.blocker_ids.length,score_origin:q.mode==='quick'?'quick_group':'expert',operational_status:'not_reviewed'});
      }
    }
    const groups=[];
    for (const kind of ['cluster','stage_gate']) {
      const labels=new Map(blockers.map(b=>[kind==='cluster'?b.cluster_id:b.stage_gate,kind==='cluster'?b.dimension+' · '+b.cluster:b.stage_gate||'Unspecified stage gate']));
      for (const [id,label] of labels) {
        const bs=blockers.filter(b=>(kind==='cluster'?b.cluster_id:b.stage_gate)===id), valid=bs.filter(b=>b.status==='valid'), applicable=bs.filter(b=>b.status!=='not_applicable');
        const den=4*valid.reduce((n,b)=>n+b.allocated_weight,0);
        groups.push({kind,id,label,percent:den?100*valid.reduce((n,b)=>n+b.allocated_weight*b.score,0)/den:null,answered:valid.length,applicable:applicable.length,not_applicable:bs.length-applicable.length,partial:valid.length<applicable.length});
      }
    }
    const recommendations=[];
    for(const enabler of c.enablers) {
      const links=c.blocker_enabler_relationships.filter(e=>e.enabler_id===enabler.enabler_id);
      const gaps=blockers.filter(b=>b.status==='valid'&&b.score<=2&&links.some(l=>l.blocker_id===b.blocker_id));
      if(gaps.length) recommendations.push({...enabler,priority:gaps.reduce((n,b)=>n+b.allocated_weight*(4-b.score)/4,0),contributions:gaps.map(b=>({blocker_id:b.blocker_id,question_id:b.question_id,contribution:b.allocated_weight*(4-b.score)/4,relationship_ids:links.filter(l=>l.blocker_id===b.blocker_id).map(l=>l.relationship_id)})),links:links.filter(l=>gaps.some(b=>b.blocker_id===l.blocker_id))});
    }
    recommendations.sort((a,b)=>b.priority-a.priority||a.enabler_id-b.enabler_id);
    return {maturity_percent:denominator?100*numerator/denominator:null,numerator,denominator,completion:(counts.valid+counts.not_applicable)/q.questions.length,counts,rows,blockers,groups,recommendations,partial:counts.valid+counts.not_applicable<q.questions.length};
  }
  root.AssessmentPreview={validate,key,create,classify,questionnaire,validateAssessment,report,weightOK};
})(globalThis);
