import {PHYSICS} from './config.mjs?v=3';
import {bridgePlatforms} from './world-builder.mjs?v=3';
export function createRun(world,progress={}) {
  const inventory=new Set(progress.capabilities||[]),applied=new Map((progress.applied||[]).map(x=>[x.blockerId,x.enablerId]));
  const encounters=world.encounters.map(e=>{const enablerId=applied.get(e.id),relation=e.relations.find(r=>r.enablerId===enablerId&&inventory.has(enablerId)&&(!e.requiredAll||e.alternatives.every(a=>inventory.has(a.enabler.id))));return {...e,encountered:(progress.encountered||[]).includes(e.id)||!!relation,opened:!!relation,chosen:relation?.enablerId||null,mechanism:relation?.mechanism||null,animation:relation?1:0,support:0,crossed:false};});
  const player={x:world.entrance.x-12,y:world.entrance.y-28,w:PHYSICS.width,h:PHYSICS.height,vx:0,vy:0,grounded:true,platformId:'home',coyote:0,jumpBuffer:0,jumpTime:0};
  const run={world,encounters,inventory,priorOpened:new Set((progress.applied||[]).map(a=>a.blockerId)),mechanisms:new Set(progress.mechanisms||[]),selected:inventory.values().next().value||null,player,checkpoint:{x:player.x,y:player.y},signals:new Set(world.signals.filter(s=>(progress.handover||[]).includes(world.gate.id+':'+s.key)).map(s=>s.key)),complete:false,time:0,actionHeld:false,jumpHeld:false,focusId:null,abilityCooldown:{},timers:{},temporaryPlatforms:[],facing:1};
  updateSupports(run);return run;
}
const centre=p=>({x:p.x+p.w/2,y:p.y+p.h/2});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function currentEncounter(run) {return run.encounters.find(e=>e.id===run.focusId)||null;}
export function availableRelations(run,encounter=currentEncounter(run)) {return encounter?encounter.relations.filter(r=>run.inventory.has(r.enablerId)):[];}
export function cycleCapability(run) {const relevant=availableRelations(run).map(r=>r.enablerId),ids=[...new Set([...relevant,...run.inventory])];if(!ids.length)return null;run.selected=ids[(ids.indexOf(run.selected)+1)%ids.length];return run.selected;}
function updateSupports(run){for(const e of run.encounters)e.support=e.upstream.filter(id=>run.priorOpened.has(id)||run.encounters.some(other=>other.id===id&&other.opened)).length;}
export function platforms(run) {
  const result=[...run.world.platforms,...run.temporaryPlatforms.filter(p=>p.until>run.time)];
  for(const e of run.encounters){if(e.opened)result.push(...bridgePlatforms(e,e.mechanism));if(e.support)result.push({id:'support-'+e.id,x:e.x-e.dir*145-65,y:e.y-48,w:130,kind:'support',encounterId:e.id});}
  return result;
}
export function activate(run) {
  const p=centre(run.player);
  const node=run.encounters.filter(e=>distance(p,{x:e.x,y:e.y-20})<95).sort((a,b)=>distance(p,{x:a.x,y:a.y})-distance(p,{x:b.x,y:b.y}))[0];
  if(node){
    run.focusId=node.id;
    if(node.opened){returnHome(run);return {type:'return',encounter:node};}
    if(node.requiredAll){const missing=node.alternatives.filter(a=>!run.inventory.has(a.enabler.id));if(missing.length)return {type:'tools-missing',encounter:node,missing};}
    const relation=node.relations.find(r=>r.enablerId===run.selected&&run.inventory.has(r.enablerId));
    if(!relation)return {type:'unavailable',encounter:node,hasAlternative:availableRelations(run,node).length>0};
    node.opened=true;node.encountered=true;node.chosen=relation.enablerId;node.mechanism=relation.mechanism;node.animation=0;run.mechanisms.add(relation.mechanism);updateSupports(run);
    run.checkpoint={x:node.x-12,y:node.y-28};return {type:'open',encounter:node,relation,supported:run.encounters.filter(e=>e.upstream.includes(node.id))};
  }
  const anchor=run.encounters.find(e=>e.opened&&distance(p,{x:e.anchorX,y:e.y-25})<85);
  if(anchor){returnHome(run);return {type:'return',encounter:anchor};}
  if(distance(p,{x:run.world.exit.x,y:run.world.exit.y-20})<110){const opened=new Set([...run.priorOpened,...run.encounters.filter(e=>e.opened).map(e=>e.id)]),ready=run.encounters.length?(run.world.chapterIds||run.encounters.map(e=>e.id)).every(id=>opened.has(id)):run.signals.size===run.world.signals.length;if(ready){run.complete=true;return {type:'complete'};}return {type:run.world.roomCount>1?'portals':'home',remaining:run.encounters.filter(e=>!e.opened).length};}
  return {type:'distant'};
}
export function returnHome(run){Object.assign(run.player,{x:run.world.entrance.x-12,y:run.world.entrance.y-28,vx:0,vy:0,grounded:true,platformId:'home',dropTimer:0,coyote:0,jumpBuffer:0});run.downHeld=false;run.jumpHeld=false;run.checkpoint={x:run.player.x,y:run.player.y};}
export function step(run,input,dt) {
  if(run.complete)return [];
  dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,1/30));run.time+=dt;const events=[],p=run.player;
  const wasGrounded=p.grounded,oldBottom=p.y+p.h,oldX=p.x;
  p.dropTimer=Math.max(0,(p.dropTimer||0)-dt);if(input.down&&p.grounded&&!run.downHeld){p.dropY=p.y+p.h;p.dropTimer=.25;p.grounded=false;p.coyote=0;}run.downHeld=!!input.down;
  const press=!!input.jump&&!run.jumpHeld;run.jumpHeld=!!input.jump;
  p.coyote=wasGrounded&&!p.dropTimer?PHYSICS.coyote:Math.max(0,p.coyote-dt);p.jumpBuffer=press?PHYSICS.buffer:Math.max(0,p.jumpBuffer-dt);
  if(p.jumpBuffer>0&&p.coyote>0){p.vy=-PHYSICS.jump*(run.timers.Equip>run.time?1.32:1);run.timers.Equip=0;p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.jumpTime=0;events.push({type:'jump'});}
  p.jumpTime+=dt;if(!input.jump&&p.jumpTime>.14&&p.vy< -330)p.vy=-330;
  const direction=Number(!!input.right)-Number(!!input.left),target=run.timers.Commit>run.time?run.facing*600:direction*PHYSICS.speed*(run.timers.Operate>run.time?1.45:1),acceleration=direction?PHYSICS.acceleration:PHYSICS.friction;
  if(direction)run.facing=direction;
  p.vx+=Math.sign(target-p.vx)*Math.min(Math.abs(target-p.vx),acceleration*dt);p.x=Math.max(35,Math.min(run.world.width-p.w-35,p.x+p.vx*dt));
  for(const e of run.encounters){if(e.opened)continue;const left=e.dir>0?e.x+105:e.x-305,right=e.dir>0?e.x+305:e.x-105;
    if(p.y+p.h>e.y-155&&p.y<e.y+30&&p.x+p.w>left&&p.x<right){if(oldX+p.w<=left+2){p.x=left-p.w;p.vx=0;}else if(oldX>=right-2){p.x=right;p.vx=0;}}
  }
  p.vy+=PHYSICS.gravity*dt;if(run.timers.Assure>run.time&&p.vy>150)p.vy=150;p.y+=p.vy*dt;p.grounded=false;p.platformId=null;
  if(p.vy>=0){const landings=platforms(run).filter(f=>!(p.dropTimer>0&&Math.abs(f.y-p.dropY)<4)&&p.x+p.w>f.x+2&&p.x<f.x+f.w-2&&oldBottom<=f.y+2&&p.y+p.h>=f.y).sort((a,b)=>a.y-b.y);if(landings.length){const f=landings[0];p.y=f.y-p.h;p.vy=0;p.grounded=true;p.airBoostUsed=false;p.platformId=f.id;}}
  const pc=centre(p);
  for(const e of run.encounters){
    if(distance(pc,{x:e.x,y:e.y-25})<165){run.focusId=e.id;if(!e.encountered){e.encountered=true;events.push({type:'encounter',encounter:e});}}
    if(e.opened){e.animation=Math.min(1,e.animation+dt/1.2);if(!e.crossed&&distance(pc,{x:e.anchorX,y:e.y-25})<70){e.crossed=true;run.checkpoint={x:e.anchorX-12,y:e.y-28};events.push({type:'crossed',encounter:e});}}
  }
  for(const pickup of run.world.pickups){const e=run.encounters.find(e=>e.id===pickup.encounterId);if(!e.encountered||run.inventory.has(pickup.enabler.id))continue;if(distance(pc,{x:pickup.x,y:pickup.y-28})<42){run.inventory.add(pickup.enabler.id);run.selected=pickup.enabler.id;run.mechanisms.add(pickup.relation.mechanism);run.checkpoint={x:pickup.x-12,y:pickup.y-28};events.push({type:'collect',pickup,encounter:e});}}
  for(const signal of run.world.signals)if(!run.signals.has(signal.key)&&distance(pc,signal)<45){run.signals.add(signal.key);run.checkpoint={x:signal.x-12,y:signal.y+2};events.push({type:'signal',signal});}
  if(input.action&&!run.actionHeld)events.push(activate(run));run.actionHeld=!!input.action;
  if(p.y>run.world.height+100){Object.assign(p,{x:run.checkpoint.x,y:run.checkpoint.y,vx:0,vy:0,grounded:true,coyote:0,jumpBuffer:0});events.push({type:'respawn'});}
  return events;
}
export function objective(run) {
  if(run.world.epilogue||run.world.unavailable)return `${run.signals.size} / ${run.world.signals.length} handover signals · Return to the central portal`;
  const remaining=run.encounters.filter(e=>!e.opened).length,e=currentEncounter(run);
  if(!remaining)return run.world.roomCount>1?'This mini-map is open. Return to its central portal: E opens the next mini-map or finishes the Stage Gate.':'All paths are open. Return to the central portal and use E.';
  if(e&&!e.opened&&e.requiredAll){const found=e.alternatives.filter(a=>run.inventory.has(a.enabler.id)).length;return `${found} / ${e.alternatives.length} tools for this blocker. ${found===e.alternatives.length?'Return to its round node and use E or a linked ability.':'Explore its gold lights; collect the missing tools.'}`;}
  if(e&&!e.opened)return availableRelations(run,e).length?'Return to this node. Choose a linked capability and use E.':'Path incomplete. Explore the glowing branches for an enabling capability.';
  return 'Follow the stepping stones. Find an incomplete system.';
}

export function useAbility(run,family){
 if(!run.mechanisms.has(family))return {type:'ability-locked',family};
 if((run.abilityCooldown[family]||0)>run.time)return {type:'ability-cooldown',family};
 const e=currentEncounter(run),p=run.player,relation=e?.relations.find(r=>r.mechanism===family&&run.inventory.has(r.enablerId));
 if(e&&!e.opened&&relation&&distance(centre(p),{x:e.x,y:e.y-20})<95&&(!e.requiredAll||e.alternatives.every(a=>run.inventory.has(a.enabler.id)))){run.selected=relation.enablerId;return activate(run);}
 run.abilityCooldown[family]=run.time+(family==='Learn'?3:family==='Equip'?1:4);
 if(family==='Frame'){run.temporaryPlatforms=[80,165,250].map((offset,i)=>({id:'reveal-'+i,x:p.x+12+run.facing*offset-42,y:p.y+p.h-i*22,w:84,kind:'support',until:run.time+8}));run.timers.Frame=run.time+8;}
 if(family==='Commit'){run.timers.Commit=run.time+.3;p.vx=run.facing*600;}
 if(family==='Equip'){if(!p.grounded&&!p.airBoostUsed){p.vy=-550;p.airBoostUsed=true;p.jumpTime=0;}else if(p.grounded)run.timers.Equip=run.time+8;}
 if(family==='Assure')run.timers.Assure=run.time+8;
 if(family==='Operate')run.timers.Operate=run.time+8;
 if(family==='Learn')returnHome(run);
 return {type:'ability',family};
}
