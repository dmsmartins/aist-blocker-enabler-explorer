import {selectJourneyChallenges} from './data.mjs?v=4';
import {buildWorld} from './world-builder.mjs?v=4';
export function buildCampaign(data,seed='first-light'){
 const experienced=[],centralEnablers=new Set(data.enablers.filter(e=>new Set(data.relationships.filter(r=>r.enablerId===e.id).map(r=>r.blockerId)).size>=4).map(e=>e.id)),centralBlockers=new Set(data.blockers.filter(b=>(data.downstream.get(b.id)||[]).length>=3).map(b=>b.id));
 return data.gates.map((gate,index)=>{
  const challenges=selectJourneyChallenges(data,gate.id,seed,experienced,{all:true});experienced.push(...challenges.map(c=>c.blocker.id));
  const rooms=[];for(let i=0;i<Math.max(1,Math.ceil(challenges.length/3));i++)rooms.push(buildWorld(data,gate,challenges.slice(i*3,i*3+3),seed,index));
  const earlier=new Set();rooms.forEach((room,i)=>{
   const sourceRequirements=[...new Set(room.encounters.flatMap(e=>e.upstream).filter(id=>earlier.has(id)))];
   room.roomIndex=i;room.roomCount=rooms.length;room.chapterIds=challenges.map(c=>c.blocker.id);room.chapterChallenges=challenges;room.centralEnablers=centralEnablers;room.centralBlockers=centralBlockers;
   // Only earlier rooms may gate an entrance. Cycles cannot lock their own tools.
   room.entryRequirements=i?sourceRequirements.length?[sourceRequirements[0]]:rooms[i-1].encounters.map(e=>e.id):[];
   room.entryAny=i>0&&!sourceRequirements.length;room.sourceGate=sourceRequirements.length>0;room.encounters.forEach(e=>earlier.add(e.id));
  });
  for(const room of rooms){
   room.portals=[];
   for(const target of rooms){if(target===room)continue;
    const hosts=room.encounters.filter(e=>target.entryRequirements.includes(e.id));
    for(const host of hosts)room.portals.push({id:`passage-${room.roomIndex}-${target.roomIndex}-${host.id}`,targetRoom:target.roomIndex,hostId:host.id,requirements:target.entryRequirements,any:target.entryAny,x:host.anchorX,y:host.y-30,platformId:'landing-'+host.id,label:'Mini-map '+(target.roomIndex+1)});
   }
   for(const e of room.encounters){const group=room.portals.filter(p=>p.hostId===e.id),landing=room.platforms.find(p=>p.id==='landing-'+e.id);if(!group.length)continue;landing.w=Math.max(150,group.length*78+30);landing.x=e.anchorX-landing.w/2;group.forEach((p,j)=>p.x=e.anchorX+(j-(group.length-1)/2)*78);}
   if(room.roomIndex>0)room.portals.push({id:'return-to-first',targetRoom:0,x:room.entrance.x+140,y:room.entrance.y-30,platformId:'home',requirements:[],any:false,label:'Return to mini-map 1'});
  }
  return {...rooms[0],rooms,allChallenges:challenges};
 });
}
export function roomUnlocked(room,progress){const opened=new Set(progress.applied.map(a=>a.blockerId));return room.entryAny?room.entryRequirements.some(id=>opened.has(id)):room.entryRequirements.every(id=>opened.has(id));}
export function hasFastTravel(run){return [...run.inventory].some(id=>run.world.centralEnablers?.has(id))||[...run.priorOpened,...run.encounters.filter(e=>e.opened).map(e=>e.id)].some(id=>run.world.centralBlockers?.has(id));}
export function canTravel(run){return Math.hypot(run.player.x+12-run.world.exit.x,run.player.y+14-(run.world.exit.y-20))<115||hasFastTravel(run);}
export function arriveAt(run,id){const e=run.encounters.find(e=>e.id===id);if(!e)return false;Object.assign(run.player,{x:e.x-12,y:e.y-28,vx:0,vy:0,grounded:true,platformId:'approach-'+e.id});run.checkpoint={x:run.player.x,y:run.player.y};return true;}
export function reconcileCampaign(progress,chapters){
 const challenges=chapters.flatMap(c=>c.allChallenges),valid=new Set(challenges.filter(c=>c.alternatives.every(a=>progress.capabilities.includes(a.enabler.id))).map(c=>c.blocker.id));
 const applied=progress.applied.filter(a=>valid.has(a.blockerId)),opened=new Set(applied.map(a=>a.blockerId));return {...progress,applied,completed:progress.completed.filter(id=>chapters.find(c=>c.gate.id===id)?.allChallenges.every(c=>opened.has(c.blocker.id)))};
}
