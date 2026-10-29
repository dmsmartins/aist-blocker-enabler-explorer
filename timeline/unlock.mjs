// Read the existing relationship model; never infer a mechanism from an enabler.
export function mechanismGroups(data,blockerId){
  const groups=Object.fromEntries(data.mechanisms.map(m=>[m.key,[]]));
  const enablers=new Map(data.enablers.map(e=>[e.id,e]));
  for(const relationship of data.relationships){
    if(relationship.blockerId!==blockerId)continue;
    const enabler=enablers.get(relationship.enablerId);
    if(enabler&&groups[relationship.mechanism])groups[relationship.mechanism].push({enabler,relationship});
  }
  return groups;
}

export function initialMechanism(data,blockerId,requested){
  const groups=mechanismGroups(data,blockerId);
  const available=data.mechanisms.filter(m=>groups[m.key].length);
  const match=available.find(m=>m.key.toLowerCase()===String(requested||"").toLowerCase());
  return match?.key||(available.length===1?available[0].key:null);
}

export function selectionFromHash(data,hash,search=""){
  const params=new URLSearchParams(hash.replace(/^#/,""));
  const id=params.get("blocker");
  const blocker=id&&data.blockers.find(b=>String(b.id)===id);
  if(blocker)return{gate:blocker.stageGate,blocker:blocker.id,detail:true,mechanism:initialMechanism(data,blocker.id,params.get("mech"))};
  const gateId=params.get("gate")||(!hash?new URLSearchParams(search).get("gate"):null);
  const gate=gateId!==null&&data.stageGates.find(g=>String(g.id)===gateId);
  return{gate:gate?gate.id:null,blocker:null,detail:false,mechanism:null};
}

export function selectionHash({gate,blocker,detail,mechanism}){
  const params=new URLSearchParams();
  if(blocker!=null){
    params.set("blocker",blocker);
    if(detail&&mechanism)params.set("mech",mechanism.toLowerCase());
  }else if(gate!=null)params.set("gate",gate);
  return params.size?"#"+params.toString():"";
}

export function firstSentence(text){
  return String(text||"").match(/^.*?[.!?](?=\s|$)/s)?.[0]||String(text||"");
}

// Reserve the whole central band for enablers. Dependency cards stay outside it.
export function enablerLayout(count,canvasWidth,focusX,focusY,blockerWidth=330,canvasHeight=600){
  // Choose up to three columns by the scale that fits both available dimensions.
  const candidates=Array.from({length:Math.min(3,Math.max(1,count))},(_,i)=>i+1);
  const scale=cols=>Math.min((canvasWidth-48)/Math.max(blockerWidth,245+(cols-1)*270),(canvasHeight-70)/(350+Math.ceil(count/cols)*184));
  const columns=candidates.reduce((best,cols)=>scale(cols)>scale(best)?cols:best,1);
  const width=245+(columns-1)*270;
  const left=focusX+blockerWidth/2-width/2;
  const top=focusY+350;
  return{left,width,legend:{x:left,y:top-45},positions:Array.from({length:count},(_,i)=>({x:left+(i%columns)*270,y:top+Math.floor(i/columns)*184})),dependencyLeft:Math.min(focusX-350,left-305),dependencyRight:Math.max(focusX+380,left+width+50)};
}
