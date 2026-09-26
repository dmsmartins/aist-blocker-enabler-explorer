import {selectJourneyChallenges} from './data.mjs?v=8';
import {buildWorld} from './world-builder.mjs?v=8';
import {WORLD_PROFILES,designOrder,expandRoom,route,validateCampaign} from './world-design.mjs?v=8';
export function buildCampaign(data,seed='first-light'){
 const experienced=[];
 return data.gates.map((gate,index)=>{
  const challenges=designOrder(selectJourneyChallenges(data,gate.id,seed,experienced,{all:true}),index,seed),profile=WORLD_PROFILES[index]||WORLD_PROFILES[5];experienced.push(...challenges.map(c=>c.blocker.id));
  const count=Math.max(profile.zones,Math.ceil(challenges.length/5)),buckets=Array.from({length:count},()=>[]);
  challenges.forEach((c,i)=>buckets[Math.min(count-1,Math.floor(i*count/Math.max(1,challenges.length)))].push(c));
  const rooms=buckets.map((cs,i)=>expandRoom(buildWorld(data,gate,cs,seed,index),profile,i));
  const first=challenges[0]?.blocker.id,lockedRoom=challenges.length?count-1:-1;
  rooms.forEach((r,i)=>{r.roomIndex=i;r.roomCount=count;r.chapterIds=challenges.map(c=>c.blocker.id);r.chapterChallenges=challenges;r.entryRequirements=i===lockedRoom&&first?[first]:[];r.entryAny=false;r.sourceGate=false;r.centralEnablers=new Set();r.centralBlockers=new Set();r.portals=[];r.epilogue=challenges.length===0;r.unavailable=false;r.discoveryKey=gate.id+':world6:'+i;});
  // Zones form distinct navigable graphs. A late region opens after the tutorial/entry encounter.
  const edges=index===0?[[0,1],[1,2]]:index===1?[[0,1],[0,2],[1,3],[2,3],[3,4]]:index===2?[[0,1],[1,2],[2,3],[3,0]]:index===3?[[0,1],[0,2],[0,3],[0,4],[2,5],[4,5],[3,6],[4,6]]:index===4?[[0,1],[0,2],[1,3],[2,3],[3,4],[4,2]]:[[0,1],[1,2]];
  for(let i=profile.zones;i<count;i++)edges.push([i-1,i]);
  function connect(a,b,requirements=[],host=null,shortcut=false){const r=rooms[a],target=rooms[b];if(!r||!target)return;const n=r.portals.filter(p=>!p.hostId).length,side=n%2?1:-1,x=r.entrance.x+side*(350+Math.floor(n/2)*230),y=r.entrance.y-180-Math.floor(n/2)*profile.rise*2,id=`zone-${a}-${b}-${shortcut?'shortcut':'route'}`,platformId=host?'landing-'+host.id:id;
   if(!host){r.platforms.push({id:platformId,x:x-65,y,w:130,kind:'portal'});route(r,id+'-path',{x:r.entrance.x,y},{x,y},145);}r.portals.push({id,targetRoom:b,hostId:host?.id,requirements,any:false,shortcut,x:host?.anchorX??x,y:(host?.y??y)-30,platformId,label:target.zoneName});
  }
  for(const [a,b] of edges){connect(a,b,rooms[b]?.entryRequirements||[]);connect(b,a,rooms[a]?.entryRequirements||[]);}
  for(const r of rooms)for(const e of r.encounters){const related=rooms.find(other=>other!==r&&other.encounters.some(n=>n.upstream.includes(e.id)));const target=related?.roomIndex??(r.roomIndex+2)%count;if(target===r.roomIndex)continue;connect(r.roomIndex,target,[e.id,...rooms[target].entryRequirements],e,true);}
  // Place capabilities independently. Required tools for entry locks always stay in open zones.
  const pickups=rooms.flatMap(r=>r.pickups.map(p=>({...p,originRoom:r.roomIndex})));rooms.forEach(r=>r.pickups=[]);
  for(const p of pickups){const c=challenges.find(c=>c.blocker.id===p.encounterId),rank=c.journeyRank,localTutorial=index===0&&rank<2;
   let dest=localTutorial?p.originRoom:(p.originRoom+1+(rank%Math.max(1,count-2)))%count;
   if(dest===lockedRoom&&(p.encounterId===first||index===0))dest=0;
   if(index===0&&!localTutorial)dest=rooms[0].pickups.length<=rooms[1].pickups.length?0:1;
   p.signature=c.signature;p.encounter=c;p.remote=dest!==p.originRoom;rooms[dest].pickups.push(p);
  }
  for(const r of rooms){
   // Separate stops in world space, including neighbouring/overlapping platforms.
   const candidates=r.platforms.filter(f=>!f.lockedBy&&!f.requiresBlocker&&!f.motion&&f.w>=100&&!['home','hub','approach','portal','landing'].includes(f.kind)&&f.id!=='home').map(f=>({f,x:f.x+f.w/2,y:f.y,items:[]})).filter(a=>r.portals.every(p=>Math.hypot(a.x-p.x,a.y-p.y)>170)&&r.encounters.every(e=>Math.hypot(a.x-e.x,a.y-e.y)>180));
   const stops=[];
   while(candidates.length){candidates.sort((a,b)=>score(b)-score(a));const next=candidates.shift();stops.push(next);for(let i=candidates.length-1;i>=0;i--)if(Math.hypot(candidates[i].x-next.x,candidates[i].y-next.y)<170)candidates.splice(i,1);}
   function score(a){return stops.length?Math.min(...stops.map(b=>Math.hypot(a.x-b.x,a.y-b.y))):Math.hypot(a.x-r.entrance.x,a.y-r.entrance.y);}
   if(r.pickups.length>stops.length*2)throw Error('Not enough separated enabler stops in '+r.zoneName+': '+r.pickups.length+' pickups / '+stops.length+' stops');
   r.pickups.forEach((p,i)=>stops[i%stops.length].items.push(p));
   for(const stop of stops)stop.items.forEach((p,i)=>{p.platformId=stop.f.id;p.x=stop.x+(stop.items.length===2?(i?30:-30):0);p.y=stop.y;});
   if(!challenges.length){r.signals=r.signals.slice(r.roomIndex,r.roomIndex+1);for(const s of r.signals)s.key='signal-'+r.roomIndex;}else r.signals=[];r.chapterSignalKeys=challenges.length?[]:rooms.map((_,i)=>'signal-'+i);
  }
  const chapter={...rooms[0],rooms,allChallenges:challenges};chapter.validation=validateCampaign(chapter);if(!chapter.validation.valid)throw Error(chapter.validation.errors.join('; '));return chapter;
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
