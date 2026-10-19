(function (root) {
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = ['Strategic alignment', 'Architecture & feasibility', 'Build & verification', 'Deployment', 'Operation & evolution', 'Retirement & transition'];
  const gateNumber = value => { const match = /Gate\s*(\d+)/i.exec(value || ''); return match ? Number(match[1]) : null; };
  function gateAxes(report) {
    return labels.map((label, id) => ({id, label, ...report.groups.find(g => g.kind === 'stage_gate' && gateNumber(g.id) === id)}));
  }
  function radar(axes, kind = 'stage_gate') {
    const name=kind==='cluster'?'Cluster':kind==='community'?'Community':'Stage Gate';
    const axisName=(a,i)=>kind==='stage_gate'?`Gate ${i}`:`${i+1}`;
    const point = (i, r) => [360 + Math.sin(i * 2 * Math.PI / axes.length) * r, 270 - Math.cos(i * 2 * Math.PI / axes.length) * r];
    const coords = pairs => pairs.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');
    let svg = `<svg class="radar" viewBox="0 0 720 550" role="img" aria-labelledby="radar-title radar-description"><title id="radar-title">Maturity by ${name}</title><desc id="radar-description">Scale 0 to 100 percent. Missing values are not plotted; dashed segments indicate a partial profile.</desc>`;
    for (const level of [25,50,75,100]) svg += `<polygon points="${coords(axes.map((_,i)=>point(i,level*1.75)))}" fill="none" stroke="#d6e2eb"/><text x="367" y="${270-level*1.75+4}" fill="#60798b" font-size="11">${level}%</text>`;
    axes.forEach((a,i) => {
      const [x,y] = point(i,175), [tx,ty] = point(i,225);
      svg += `<line x1="360" y1="270" x2="${x}" y2="${y}" stroke="#d6e2eb"/><text x="${tx}" y="${ty-12}" text-anchor="middle" fill="#173f5f" font-size="14"><tspan x="${tx}" font-weight="700">${axisName(a,i)}</tspan><tspan x="${tx}" dy="20" font-size="12">${kind==='stage_gate'?escape(labels[i]):''}</tspan><tspan x="${tx}" dy="18" font-size="12">${a.applicable===0?'N/A':a.percent == null?'Not answered':Math.round(a.percent)+'%'+(a.partial?' · partial':'')}</tspan></text>`;
    });
    const known = axes.map(a=>Number.isFinite(a.percent));
    if (known.every(Boolean)) svg += `<polygon points="${coords(axes.map((a,i)=>point(i,a.percent*1.75)))}" fill="#187fb02b" stroke="#1379ad" stroke-width="3" ${axes.some(a=>a.partial)?'stroke-dasharray="7 5"':''}/>`;
    else axes.forEach((a,i)=>{const j=(i+1)%axes.length;if(known[i]&&known[j])svg+=`<polyline points="${coords([point(i,a.percent*1.75),point(j,axes[j].percent*1.75)])}" stroke="#1379ad" stroke-width="3" stroke-dasharray="6 5" fill="none"/>`;});
    axes.forEach((a,i)=>{if(known[i]){const [x,y]=point(i,a.percent*1.75);svg+=`<circle cx="${x}" cy="${y}" r="5" fill="#1379ad"><title>${escape(a.label)}: ${a.percent.toFixed(1)}%, ${a.answered}/${a.applicable} blockers answered</title></circle>`;}});
    return svg+'</svg>'+(kind==='stage_gate'?'':`<ol class="radar-legend">${axes.map(a=>`<li>${escape(a.label.replace(/^\d+\)\s*/,''))}</li>`).join('')}</ol>`)+ '<table class="sr-only"><caption>Radar values and coverage</caption><thead><tr><th>Group</th><th>Maturity</th><th>Coverage</th></tr></thead><tbody>'+axes.map((a,i)=>`<tr><td>${escape(a.label)}</td><td>${a.percent==null?'No score':a.percent.toFixed(1)+'%'}</td><td>${a.answered||0}/${a.applicable||0}</td></tr>`).join('')+'</tbody></table>';
  }
  function enablerReport(report, catalog, baseUrl) {
    if(!report.recommendations.length) return '<p>No enablers are suggested from the current responses. Unanswered questions do not count as gaps.</p>';
    return report.recommendations.map(e=>`<article class="pdf-enabler"><h3>${escape(e.enabler_title)}</h3><p><strong>Actions:</strong> ${escape(e.practical_actions)}</p><p><strong>Expected outcome:</strong> ${escape(e.expected_outcome)}</p><p class="muted">Addresses: ${e.contributions.map(b=>{const title=catalog?.blockers.find(x=>x.blocker_id===b.blocker_id)?.title || "Blocker details";const href=baseUrl ? new URL(`assessment-preview/blocker.html?id=${encodeURIComponent(b.blocker_id)}`,baseUrl).href : null;return href ? `<a href="${escape(href)}">${escape(title)}</a>` : escape(title);}).join("; ")}</p></article>`).join('');
  }
  function timeline(c, report, session) {
    const stakeholders = value => String(value || '').split(';').map(x=>x.trim()).filter(Boolean);
    const statuses = Object.fromEntries(report.blockers.map(b=>[b.blocker_id,b.status==='not_applicable'?'not_applicable':b.score===null?'unanswered':b.score<=2?'gap':'review']));
    return {assessment_id:session.assessment_id,preview:true,blockerStatuses:statuses,blockerScores:Object.fromEntries(report.blockers.map(b=>[b.blocker_id,b.score])),mode:session.mode,
      data:{stageGates:labels.map((label,id)=>({id,label})),domains:[],mechanisms:[...new Map(c.blocker_enabler_relationships.map(r=>[r.attribute,{key:r.attribute,description:r.attribute_description}])).values()],
        blockers:c.blockers.map(b=>({id:b.blocker_id,title:b.title,statement:b.statement,cluster:b.cluster,dimension:b.dimension,stageGate:gateNumber(b.stage_gate),stageGateDescription:b.stage_gate,whyItMatters:b.why_it_matters,consequence:b.consequence,stakeholders:stakeholders(b.stakeholders),classification:b.dependency_analysis?.state,communityName:b.dependency_analysis?.community})),
        enablers:c.enablers.map(e=>({id:e.enabler_id,title:e.enabler_title,description:e.enabler_description,practicalActions:e.practical_actions,expectedOutcome:e.expected_outcome,stageGate:null,stakeholders:stakeholders(e.stakeholders)})),
        relationships:c.blocker_enabler_relationships.map(r=>({id:r.relationship_id,blockerId:r.blocker_id,enablerId:r.enabler_id,mechanism:r.attribute,rationale:r.rationale})),
        blockerDependencies:c.blocker_dependencies.map(r=>({id:r.relationship_id,blockerId:r.blocker_id,dependsOnBlockerId:r.depends_on_blocker_id,dependencyImportance:r.dependency_importance}))}};
  }
  root.AssessmentViews = { escape, gateAxes, radar, enablerReport, timeline };
})(globalThis);
