export const isValidated=d=>d.reviewStatus==='Validated';
export function visibleBlockers(data,{domain='',role='',focus=null}={}){
 return data.blockers.filter(b=>(!domain||b.domain===domain)&&(!role||b.stakeholders.includes(role))&&(!focus||focus.includes(b.id)));
}
export function orderedDependencies(data,id,includeUnreviewed=true){
 return data.blockerDependencies.filter(d=>d.reviewStatus!=='Rejected'&&(d.blockerId===id||d.dependsOnBlockerId===id)&&(includeUnreviewed||isValidated(d))).sort((a,b)=>Number(isValidated(b))-Number(isValidated(a))||(b.dependencyImportance||0)-(a.dependencyImportance||0));
}
export function incompleteIds(data,answers){return data.blockers.filter(b=>answers[b.id]!=='resolved').map(b=>b.id);}
export function projectComponents(data,q){return data.questionBlockerMap.filter(m=>m.questionId===q.id&&m.relationship==='Direct').map(m=>data.blockers.find(b=>b.id===m.blockerId));}
