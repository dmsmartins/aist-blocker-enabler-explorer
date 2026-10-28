import {selectionFromHash,selectionHash} from './unlock.mjs';

export const collectionId=(blocker,mode='gate')=>mode==='community'?blocker.communityId:blocker.stageGate;

export function collections(data,mode='gate'){
  if(mode!=='community')return data.stageGates;
  const rows=data.communities||[...new Map(data.blockers.filter(b=>b.communityId!=null).map(b=>[b.communityId,{id:b.communityId,name:b.communityName}])).values()];
  return rows.map(c=>({...c,label:c.name}));
}

export function matchingBlockers(data,{mode='gate',group=null,stakeholder=''}={}){
  return data.blockers.filter(b=>(group==null||collectionId(b,mode)===group)&&(!stakeholder||b.stakeholders.includes(stakeholder)));
}

export function explorationFromHash(data,hash,search='',mode='gate'){
  const selection=selectionFromHash(data,hash,search),params=new URLSearchParams(hash.replace(/^#/,''));
  const query=new URLSearchParams(search),blocker=data.blockers.find(b=>b.id===selection.blocker);
  const key=mode==='community'?'community':'gate';
  const requested=params.get(key)||(!hash?query.get(key):null);
  const group=blocker?collectionId(blocker,mode):collections(data,mode).find(g=>String(g.id)===requested)?.id??null;
  const requestedRole=params.get('role')||(!hash?query.get('role'):'')||'';
  const validRole=data.blockers.some(b=>b.stakeholders.includes(requestedRole));
  const stakeholder=validRole&&(!blocker||blocker.stakeholders.includes(requestedRole))?requestedRole:'';
  return{group,blocker:selection.blocker,detail:selection.detail,mechanism:selection.mechanism,stakeholder};
}

export function explorationHash({group,stakeholder='',...selection},mode='gate'){
  const params=new URLSearchParams(selectionHash({...selection,gate:group}).replace(/^#/,''));
  if(mode==='community'&&params.has('gate')){params.set('community',params.get('gate'));params.delete('gate')}
  if(stakeholder)params.set('role',stakeholder);
  return params.size?'#'+params.toString():'';
}

export function visibleDependencies(data,includeUnreviewed=true){
  return data.blockerDependencies.filter(d=>d.reviewStatus!=='Rejected'&&(includeUnreviewed||d.reviewStatus==='Validated'));
}
