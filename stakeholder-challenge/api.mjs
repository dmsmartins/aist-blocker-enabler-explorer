export const API='https://aist-dependency-votes.diogomsmartins.workers.dev';
export const MAX_EXPLANATION=500;
export async function request(path,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error||'The service is unavailable. Please retry.'),{status:response.status});
    return data;
  }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('The connection was interrupted. Your draft is safe. Please retry.');throw e;}
  finally{clearTimeout(timer);}
}
export function assignmentBody(session,isTest){
  return {participantId:session.participant_id,datasetVersion:session.dataset_version,explorerVersion:session.explorer_version,
    stakeholderId:session.stakeholder_id,qualification:session.qualification,qualifications:session.qualifications,isTest};
}
export function acceptAssignment(session,result,catalog){
  if(typeof result.token!=='string'||!result.token||typeof result.sessionId!=='string'||!result.sessionId||result.datasetVersion!==session.dataset_version||result.explorerVersion!==session.explorer_version||!Array.isArray(result.blockerIds)||result.blockerIds.length!==20||new Set(result.blockerIds).size!==20||result.blockerIds.some(id=>!catalog.blockers.has(id))||!Number.isFinite(result.expiresAt))throw new Error('Invalid server assignment. Please retry.');
  return {...session,session_id:result.sessionId,token:result.token,blocker_ids:result.blockerIds,expires_at:result.expiresAt,is_test:result.isTest===true};
}
export function submissionBody(session){return {token:session.token,assessments:session.blocker_ids.map(id=>({blocker_id:id,relationships:session.answers[id].relationships,explanation:session.answers[id].explanation}))};}
export function confirmReceipt(result,session){
  if(result.saved!==true||result.sessionId!==session.session_id||result.count!==20||result.isTest!==session.is_test)throw new Error('Saving was not confirmed. Retry the same submission.');
  return {session_id:result.sessionId,count:result.count,is_test:result.isTest};
}
