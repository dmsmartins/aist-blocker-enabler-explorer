// Pure game rules. The Explorer dataset remains the source of all knowledge cards.
export const POWERS = {
  Frame:   {color:'#b4a0ff', glyph:'◎', verb:'Reveal', effect:'Reveal a hidden route.'},
  Commit:  {color:'#ffc778', glyph:'◇', verb:'Connect', effect:'Connect the divided path.'},
  Equip:   {color:'#63ceff', glyph:'↑', verb:'Build', effect:'Build the missing capability.'},
  Assure:  {color:'#f5a7d4', glyph:'⬡', verb:'Shield', effect:'Make the crossing safe.'},
  Operate: {color:'#65e2b7', glyph:'≋', verb:'Stabilise', effect:'Stabilise the moving system.'},
  Learn:   {color:'#d1e88b', glyph:'↻', verb:'Adapt', effect:'Adapt the route to change.'}
};
export const GROUND = 430;
export const WIDTH = 960;
export const HEIGHT = 510;

export function buildLevels(data) {
  if (!Array.isArray(data.stageGates) || !Array.isArray(data.blockers) || !Array.isArray(data.relationships) || !Array.isArray(data.enablers)) throw new Error('Explorer data is incomplete.');
  const enablers = new Map(data.enablers.map(e=>[e.id,e]));
  const preferred = [['Frame','Commit','Assure'],['Equip','Frame','Assure'],['Operate','Equip','Assure'],['Operate','Commit','Learn'],['Learn','Equip']];
  return [...data.stageGates].sort((a,b)=>a.id-b.id).map((gate, i)=>{
    const candidates=data.blockers.filter(b=>Number(b.stageGate)===Number(gate.id)).map(blocker=>({blocker,relations:data.relationships.filter(r=>r.blockerId===blocker.id && enablers.has(r.enablerId) && POWERS[r.mechanism])})).filter(c=>c.relations.length);
    const selected=[];
    for(const mechanism of preferred[i] || Object.keys(POWERS)) {
      if(selected.length===3) break;
      const c=candidates.find(c=>!selected.some(s=>s.blocker.id===c.blocker.id) && c.relations.some(r=>r.mechanism===mechanism));
      if(c){const relation=c.relations.find(r=>r.mechanism===mechanism);selected.push({blocker:c.blocker,relation,enabler:enablers.get(relation.enablerId),mechanism:relation.mechanism});}
    }
    for(const c of candidates){if(selected.length===3)break;if(!selected.some(s=>s.blocker.id===c.blocker.id)){const relation=c.relations[0];selected.push({blocker:c.blocker,relation,enabler:enablers.get(relation.enablerId),mechanism:relation.mechanism});}}
    const unmapped=data.blockers.filter(b=>Number(b.stageGate)===Number(gate.id)).length;
    if(unmapped && !selected.length)throw new Error(`No playable relationships for Stage Gate ${gate.id}.`);
    return {gate, encounters:selected, mappedCount:unmapped, transition:unmapped===0};
  });
}

export function createRun(level) {
  const encounters=level.encounters.map((e,i)=>({...e,x:100+i*740,collected:false,resolved:false}));
  const length=level.transition?2100:Math.max(1100,encounters.length*740+260);
  return {level,encounters,length,player:{x:45,y:GROUND-34,w:28,h:34,vx:0,vy:0,grounded:true},checkpoint:45,complete:false,jumpHeld:false,actionHeld:false,time:0,beacons:level.transition?[{x:420,label:'Preserve knowledge',collected:false},{x:1030,label:'Transfer responsibility',collected:false},{x:1610,label:'Close with care',collected:false}]:[]};
}

export function platforms(run) {
  if(run.level.transition)return [{x:0,y:GROUND,w:680},{x:790,y:GROUND,w:580},{x:1480,y:GROUND,w:run.length-1480},{x:360,y:350,w:120},{x:970,y:350,w:120},{x:1550,y:350,w:120}];
  const p=[];let start=0;
  for(const e of run.encounters){p.push({x:start,y:GROUND,w:e.x+430-start});p.push({x:e.x+125,y:350,w:130});if(e.resolved)p.push({x:e.x+430,y:GROUND,w:120,bridge:true,mechanism:e.mechanism});start=e.x+550;}
  p.push({x:start,y:GROUND,w:run.length-start});return p;
}

export function currentEncounter(run) {
  return run.encounters.find(e=>!e.resolved) || run.encounters.at(-1) || null;
}

export function step(run,input,dt) {
  if(run.complete)return [];
  dt=Math.min(Math.max(dt,0),1/30);run.time+=dt;
  const p=run.player,events=[],oldBottom=p.y+p.h;
  const jump=!!input.jump&&!run.jumpHeld;run.jumpHeld=!!input.jump;
  if(jump && p.grounded){p.vy=-590;p.grounded=false;}
  p.vx=((input.right?1:0)-(input.left?1:0))*255;
  p.x=Math.max(0,Math.min(run.length-p.w,p.x+p.vx*dt));
  for(const e of run.encounters){const wall=e.x+385;if(!e.resolved && p.x+p.w>wall && p.x<wall+30){p.x=p.vx>=0?wall-p.w:wall+30;p.vx=0;}}
  p.vy+=1550*dt;p.y+=p.vy*dt;p.grounded=false;
  if(p.vy>=0)for(const platform of platforms(run)){if(p.x+p.w>platform.x && p.x<platform.x+platform.w && oldBottom<=platform.y+1 && p.y+p.h>=platform.y){p.y=platform.y-p.h;p.vy=0;p.grounded=true;break;}}
  for(const e of run.encounters){
    if(!e.collected && Math.abs(p.x+p.w/2-(e.x+190))<38 && Math.abs(p.y+p.h/2-301)<45){e.collected=true;events.push({type:'collect',encounter:e});}
    if(e.resolved && p.x>e.x+570 && run.checkpoint<e.x+570){run.checkpoint=e.x+580;events.push({type:'checkpoint'});}
  }
  const action=!!input.action&&!run.actionHeld;run.actionHeld=!!input.action;
  if(action){const e=run.encounters.find(e=>!e.resolved && Math.abs(p.x+p.w/2-(e.x+400))<145);if(e){if(e.collected){e.resolved=true;events.push({type:'resolve',encounter:e});}else events.push({type:'missing',encounter:e});}else events.push({type:'outOfRange'});}
  for(const b of run.beacons){if(!b.collected && Math.abs(p.x+p.w/2-b.x)<38 && Math.abs(p.y+p.h/2-301)<45){b.collected=true;events.push({type:'beacon',beacon:b});}}
  if(p.y>HEIGHT+110){p.x=run.checkpoint;p.y=GROUND-p.h;p.vx=0;p.vy=0;p.grounded=true;events.push({type:'respawn'});}
  const ready=run.level.transition?run.beacons.every(b=>b.collected):run.encounters.every(e=>e.resolved);
  if(p.x>run.length-150 && ready){run.complete=true;events.push({type:'complete'});}
  else if(p.x>run.length-155 && !ready){p.x=run.length-156;events.push({type:'unfinished'});}
  return events;
}
