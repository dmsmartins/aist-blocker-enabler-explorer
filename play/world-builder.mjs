import {WORLD,PHYSICS,CHAPTERS} from './config.mjs?v=3';
import {hash,selectJourneyChallenges} from './data.mjs?v=3';
export function buildJourney(data,seed='first-light') {
  const experienced=[];
  return data.gates.map((gate,index)=>{const challenges=selectJourneyChallenges(data,gate.id,seed,experienced);experienced.push(...challenges.map(c=>c.blocker.id));return buildWorld(data,gate,challenges,seed,index);});
}
export function buildWorld(data,gate,challenges,seed,index) {
  const world={gate,index,alias:CHAPTERS[index]||'JOURNEY',seed,width:WORLD.width,height:WORLD.height,entrance:{x:WORLD.hubX,y:WORLD.hubY},exit:{x:WORLD.hubX,y:WORLD.hubY},platforms:[],encounters:[],pickups:[],signals:[],dependencyLinks:[],mappedCount:data.blockers.filter(b=>b.stageGate===gate.id).length};
  world.epilogue=world.mappedCount===0;world.unavailable=world.mappedCount>0&&challenges.length===0;
  const add=(id,x,y,w,kind='island',extra={})=>{const p={id,x:x-w/2,y,w,kind,...extra};world.platforms.push(p);return p;};
  add('home',WORLD.hubX,WORLD.hubY,420,'hub');
  // Every capability branch is independent of challenge locks.
  for(let i=1;i<=10;i++)add('spine-'+i,WORLD.hubX+(i%2?-62:62),WORLD.hubY-i*90,170,'spine');
  const slots=[{x:660,y:1020,dir:-1},{x:2140,y:1020,dir:1},{x:660,y:630,dir:-1},{x:2140,y:630,dir:1},{x:1400,y:350,dir:1}];
  const templates=['split-route','vertical-loop','upper-lower-branch','return-shortcut','dependency-knot'];
  const selected=new Set(challenges.map(c=>c.blocker.id));
  challenges.forEach((c,i)=>{
    const slot=slots[i],id=c.blocker.id,template=templates[hash(seed+id)%4];
    const encounter={...c,...slot,id,template,anchorX:slot.x+slot.dir*345};world.encounters.push(encounter);
    add('approach-'+id,slot.x,slot.y,210,'approach',{encounterId:id});
    const distance=Math.abs(WORLD.hubX-slot.x),sign=Math.sign(slot.x-WORLD.hubX);
    for(let n=0;n<Math.ceil(distance/160);n++){const x=WORLD.hubX+sign*n*160,y=slot.y+(n%2?12:0);if(!world.platforms.some(p=>Math.abs(p.x+p.w/2-x)<40&&Math.abs(p.y-y)<18))add(`branch-${id}-${n}`,x,y,130,'branch');}
    const s=slot.dir;
    const layouts={
      'split-route':[[100,-80,135],[235,-160,185],[110,-240,140],[-35,-255,150],[335,85,185]],
      'vertical-loop':[[85,-95,125],[205,-190,160],[90,-280,130],[-55,-290,145],[310,85,175]],
      'upper-lower-branch':[[115,-75,140],[245,-155,180],[125,-240,140],[-20,-250,160],[370,90,200]],
      'return-shortcut':[[100,-85,125],[220,-170,170],[100,-255,135],[-45,-255,145],[340,85,175]]
    };
    const parts=['step','upper','loop','crown','lower'],placed={};
    layouts[template].forEach(([offset,dy,width],j)=>{const name=parts[j];placed[name]=add(name+'-'+id,slot.x-s*offset,slot.y+dy,width,['upper','crown','lower'].includes(name)?'garden':'step');});
    add('landing-'+id,encounter.anchorX,slot.y,150,'landing',{lockedBy:id});
    const positions=['upper','crown','lower'].map(name=>({x:placed[name].x+placed[name].w/2,y:placed[name].y,platformId:placed[name].id}));
    c.alternatives.forEach((alternative,j)=>{const pos=positions[j%3],platform=world.platforms.find(p=>p.id===pos.platformId),row=Math.floor(j/3),count=Math.ceil((c.alternatives.length-j%3)/3),offset=count>1?(row/(count-1)-.5)*(platform.w-45):0;world.pickups.push({id:id+':'+alternative.enabler.id,encounterId:id,...pos,x:pos.x+offset,...alternative});});
    for(const target of c.upstream){const source=data.blockerMap.get(target);world.dependencyLinks.push({from:target,to:id,echo:!selected.has(target),stage:source.stageGate,sameGate:source.stageGate===gate.id,knot:data.componentOf.get(target)===data.componentOf.get(id)&&c.knot,title:source.title});}
  });
  if(world.epilogue||world.unavailable){
    for(const [i,s] of slots.slice(0,3).entries()){
      const sign=Math.sign(s.x-WORLD.hubX),distance=Math.abs(s.x-WORLD.hubX);
      for(let n=0;n<Math.ceil(distance/160);n++)add(`handover-route-${i}-${n}`,WORLD.hubX+sign*Math.min(n*160,distance),s.y,140,'branch');
      const p=add('signal-'+i,s.x,s.y,190,'garden');
      world.signals.push({key:'signal-'+i,label:['Preserve knowledge','Transfer responsibility','Carry learning forward'][i],x:s.x,y:s.y-30,platformId:p.id});
    }
  }
  const report=validateWorld(world);
  if(!report.valid)throw new Error(`Unreachable generated world: ${report.errors.join('; ')}`);
  world.validation=report;return world;
}
export function bridgePlatforms(encounter,mechanism) {
  const {x,y,dir,id}=encounter;
  const patterns={Frame:[{offset:130,w:70,dy:0},{offset:210,w:70,dy:-15},{offset:285,w:80,dy:0}],Commit:[{offset:210,w:240,dy:0}],Equip:[{offset:135,w:80,dy:-25},{offset:220,w:85,dy:-55},{offset:295,w:75,dy:-25}],Assure:[{offset:210,w:240,dy:0}],Operate:[{offset:140,w:85,dy:0},{offset:240,w:125,dy:0}],Learn:[{offset:135,w:90,dy:-40},{offset:240,w:130,dy:-15}]};
  return (patterns[mechanism]||patterns.Commit).map((p,i)=>({id:`bridge-${id}-${i}`,x:x+dir*p.offset-p.w/2,y:y+p.dy,w:p.w,kind:'bridge',encounterId:id,mechanism}));
}
export function platformGraph(platforms) {
  const graph=new Map(platforms.map(p=>[p.id,[]]));
  for(const from of platforms)for(const to of platforms){
    if(from===to)continue;const rise=from.y-to.y;if(rise>125||rise< -320)continue;
    const discriminant=PHYSICS.jump**2-2*PHYSICS.gravity*rise;if(discriminant<0)continue;
    const time=(PHYSICS.jump+Math.sqrt(discriminant))/PHYSICS.gravity;
    const gap=Math.max(0,to.x-(from.x+from.w),from.x-(to.x+to.w));
    if(gap+36<PHYSICS.speed*time*.88)graph.get(from.id).push(to.id);
  }
  return graph;
}
export function routeBetween(graph,from,to) {
  const queue=[from],prev=new Map([[from,null]]);
  for(let i=0;i<queue.length;i++){const id=queue[i];if(id===to){const route=[];let p=to;while(p!==null){route.unshift(p);p=prev.get(p);}return route;}for(const next of graph.get(id)||[])if(!prev.has(next)){prev.set(next,id);queue.push(next);}}
  return null;
}
export function validateWorld(world) {
  const errors=[],base=world.platforms.filter(p=>!p.lockedBy),graph=platformGraph(base);
  if(!world.entrance||!world.exit)errors.push('Missing entrance or exit');
  for(const p of world.pickups){if(p.x<0||p.x>world.width||p.y<0||p.y>world.height)errors.push('Pickup out of bounds');if(!routeBetween(graph,'home',p.platformId))errors.push('Unreachable capability '+p.id);if(!routeBetween(graph,p.platformId,'approach-'+p.encounterId))errors.push('No return from capability '+p.id);}
  for(const e of world.encounters){if(!routeBetween(graph,'home','approach-'+e.id))errors.push('Unreachable encounter '+e.id);if(!routeBetween(graph,'approach-'+e.id,'home'))errors.push('No return to hub '+e.id);}
  for(const signal of world.signals)if(!routeBetween(graph,'home',signal.platformId)||!routeBetween(graph,signal.platformId,'home'))errors.push('Unreachable handover signal');
  return {valid:!errors.length,errors};
}
