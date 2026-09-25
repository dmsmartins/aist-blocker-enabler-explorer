import {powerStyle} from './config.mjs?v=5';

export function hash(value) {let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export const idOf = v => typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v)?v:null;
const list = x => Array.isArray(x)?x:[];
const text = x => typeof x==='string'&&x.trim().length>0;

export function prepareData(raw) {
  if(!raw||!['stageGates','blockers','enablers','relationships','mechanisms'].every(k=>Array.isArray(raw[k])))throw new Error('Required Explorer arrays are missing.');
  const warnings=[];
  function rows(items,valid,label){const seen=new Set();return items.flatMap(item=>{const id=idOf(item?.id);if(!id||seen.has(id)||!valid(item)){warnings.push(`Skipped invalid ${label}`);return [];}seen.add(id);return [{...item,id}];});}
  const gates=rows(raw.stageGates,g=>text(g.label),'gate').sort((a,b)=>Number(a.id)-Number(b.id)||a.id.localeCompare(b.id));
  if(!gates.length)throw new Error('No usable Stage Gates.');
  const gateMap=new Map(gates.map(g=>[g.id,g]));
  const mechanisms=[...new Map(raw.mechanisms.filter(m=>m&&text(m.key)).map(m=>[m.key,{...m,style:powerStyle(m.key)}])).values()];
  if(!mechanisms.length)throw new Error('No usable mechanisms.');
  const mechanismMap=new Map(mechanisms.map(m=>[m.key,m]));
  const blockers=rows(raw.blockers,b=>text(b.title)&&gateMap.has(idOf(b.stageGate)),'blocker').map(b=>({...b,stageGate:idOf(b.stageGate),stakeholders:list(b.stakeholders).filter(text)}));
  const enablers=rows(raw.enablers,e=>text(e.title),'enabler').map(e=>({...e,stakeholders:list(e.stakeholders).filter(text)}));
  const blockerMap=new Map(blockers.map(b=>[b.id,b])),enablerMap=new Map(enablers.map(e=>[e.id,e]));
  const pairs=new Set();
  const relationships=raw.relationships.flatMap(r=>{const blockerId=idOf(r?.blockerId),enablerId=idOf(r?.enablerId),key=blockerId+'|'+enablerId+'|'+r?.mechanism;if(!blockerMap.has(blockerId)||!enablerMap.has(enablerId)||!mechanismMap.has(r?.mechanism)||pairs.has(key)){warnings.push('Skipped invalid relationship');return [];}pairs.add(key);return [{...r,blockerId,enablerId}];});
  const links=new Set();
  const dependencies=list(raw.blockerDependencies).flatMap(d=>{const blockerId=idOf(d?.blockerId),dependsOnBlockerId=idOf(d?.dependsOnBlockerId),key=blockerId+'|'+dependsOnBlockerId;if(!blockerMap.has(blockerId)||!blockerMap.has(dependsOnBlockerId)||links.has(key)){warnings.push('Skipped invalid dependency');return [];}links.add(key);return [{...d,blockerId,dependsOnBlockerId}];});
  const relationsByBlocker=new Map(blockers.map(b=>[b.id,relationships.filter(r=>r.blockerId===b.id)]));
  const upstream=new Map(blockers.map(b=>[b.id,dependencies.filter(d=>d.blockerId===b.id).map(d=>d.dependsOnBlockerId)]));
  const downstream=new Map(blockers.map(b=>[b.id,dependencies.filter(d=>d.dependsOnBlockerId===b.id).map(d=>d.blockerId)]));
  const components=strongComponents(blockers.map(b=>b.id),upstream);
  const componentOf=new Map();components.forEach((members,i)=>members.forEach(id=>componentOf.set(id,i)));
  const fingerprint=hash(JSON.stringify([gates,mechanisms.map(m=>m.key),blockers,enablers,relationships,dependencies])).toString(16);
  return {gates,gateMap,blockers,blockerMap,enablers,enablerMap,mechanisms,mechanismMap,relationships,relationsByBlocker,dependencies,upstream,downstream,components,componentOf,domains:list(raw.domains),fingerprint,warnings};
}

export function strongComponents(ids,adjacency) {
  let index=0;const indices=new Map(),low=new Map(),stack=[],onStack=new Set(),components=[];
  function visit(id){indices.set(id,index);low.set(id,index++);stack.push(id);onStack.add(id);for(const next of adjacency.get(id)||[]){if(!indices.has(next)){visit(next);low.set(id,Math.min(low.get(id),low.get(next)));}else if(onStack.has(next))low.set(id,Math.min(low.get(id),indices.get(next)));}if(low.get(id)===indices.get(id)){const component=[];let x;do{x=stack.pop();onStack.delete(x);component.push(x);}while(x!==id);components.push(component);}}
  ids.forEach(id=>{if(!indices.has(id))visit(id);});return components;
}

export function visualArchetype(blocker,mechanism) {
  const words=(blocker.title+' '+blocker.cluster+' '+blocker.statement).toLowerCase();
  if(/monitor|retrain|drift|evolution|adapt/.test(words))return 'living-loop';
  if(/safety|reliab|trust|legal|regulat|explainab/.test(words))return 'veil';
  if(/silo|fragment|alignment|shared vision/.test(words))return 'split-network';
  if(/data quality|semantic|availability|consistency/.test(words))return 'broken-stream';
  if(/governance|accountab|decision rights|ownership/.test(words))return 'routing-knot';
  if(/integrat|architect|interface/.test(words))return 'misaligned-interfaces';
  if(/skill|compute|platform|tool|capabilit/.test(words))return 'missing-structure';
  if(/production|operat|workflow|handover/.test(words))return 'oscillating-flow';
  return ({'data-foundations':'broken-stream','technology-infrastructure':'misaligned-interfaces','governance-organisation':'routing-knot','people-adoption':'split-network','legal-safety-assurance':'veil','value-delivery-scale':'missing-structure'})[blocker.domain] || (mechanism==='Learn'?'living-loop':'missing-structure');
}

export function selectJourneyChallenges(data,gateId,seed,experienced=[],options={}) {
  const seen=new Set(experienced),candidates=data.blockers.filter(b=>b.stageGate===gateId&&(data.relationsByBlocker.get(b.id)||[]).length);
  const count=options.all?candidates.length:Math.min(candidates.length,candidates.length>5?4+(hash(seed+gateId)%2):5);
  const picked=[],domains=new Set(),mechanisms=new Set(),archetypes=new Set();
  while(picked.length<count){
    const available=candidates.filter(b=>!picked.includes(b));
    const score=b=>{const rs=data.relationsByBlocker.get(b.id),archetype=visualArchetype(b,rs[0].mechanism);return (!domains.has(b.domain)?5:0)+rs.filter(r=>!mechanisms.has(r.mechanism)).length*.9+(!archetypes.has(archetype)?3:0)+Math.min(3,rs.length)*.5+(picked.some(p=>(data.upstream.get(b.id)||[]).includes(p.id)||(data.upstream.get(p.id)||[]).includes(b.id))?4:0)+(seen.has(b.id)?0:3)+(hash(seed+'|'+b.id)%1000)/1000;};
    available.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));const b=available[0];picked.push(b);domains.add(b.domain);data.relationsByBlocker.get(b.id).forEach(r=>mechanisms.add(r.mechanism));archetypes.add(visualArchetype(b,data.relationsByBlocker.get(b.id)[0].mechanism));
  }
  // Visit dependencies first; a recursion guard turns cycles into neighbouring knots.
  const selected=new Set(picked.map(b=>b.id)),visited=new Set(),visiting=new Set(),ordered=[];
  function visit(b){if(visited.has(b.id)||visiting.has(b.id))return;visiting.add(b.id);for(const id of data.upstream.get(b.id)||[])if(selected.has(id))visit(data.blockerMap.get(id));visiting.delete(b.id);visited.add(b.id);ordered.push(b);}
  picked.forEach(visit);
  return ordered.map(blocker=>{
    const all=data.relationsByBlocker.get(blocker.id),used=new Set(),alternatives=[];
    const shuffled=[...all].sort((a,b)=>hash(seed+'|'+blocker.id+'|'+a.enablerId)-hash(seed+'|'+blocker.id+'|'+b.enablerId));
    for(const relation of [...shuffled.filter((r,i,a)=>a.findIndex(x=>x.mechanism===r.mechanism)===i),...shuffled]){if(!options.all&&alternatives.length===3)break;if(used.has(relation.enablerId))continue;used.add(relation.enablerId);alternatives.push({relation,enabler:data.enablerMap.get(relation.enablerId)});}
    const component=data.components[data.componentOf.get(blocker.id)]||[];
    return {blocker,alternatives,requiredAll:!!options.all,relations:all,archetype:visualArchetype(blocker,alternatives[0].relation.mechanism),knot:component.length>1||(data.upstream.get(blocker.id)||[]).includes(blocker.id),upstream:data.upstream.get(blocker.id)||[],downstream:data.downstream.get(blocker.id)||[]};
  });
}

export const connectionURL=(blocker,enablerId)=>`../#domain/${encodeURIComponent(blocker.domain||'')}/blocker/${encodeURIComponent(blocker.id)}${enablerId?'/enabler/'+encodeURIComponent(enablerId):''}`;
