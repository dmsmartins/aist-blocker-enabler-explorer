import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {prepareData} from './data.mjs';import {buildCampaign} from './campaign.mjs';import {platformGraph,routeBetween} from './world-builder.mjs';import {createRun,step,activate,platforms,pickupAwake,portalOpen,portalZones} from './engine.mjs';import {freshProgress,captureProgress,reconcileProgress,restartProgress} from './storage.mjs';import {worldMapModel,worldMapHTML} from './world-map.mjs';
const raw=readFileSync(new URL('../data/explorer-data.json',import.meta.url),'utf8'),data=prepareData(JSON.parse(raw)),chapters=buildCampaign(data);
let totalFrames=0;
function tick(run,input){totalFrames++;const events=step(run,input,1/120);assert.ok(!events.some(e=>e.type==='respawn'),'Pilot fell off a required route');return events;}
function steer(run,x,jump=false){const p=run.player,delta=x-(p.x+p.w/2),braking=p.vx*Math.abs(p.vx)/4400;return {left:delta-braking< -3,right:delta-braking>3,jump};}
function settle(run,x){for(let i=0;i<200;i++){const p=run.player;if(Math.abs(x-p.x-p.w/2)<5&&Math.abs(p.vx)<20)return;tick(run,steer(run,x));}throw Error('Could not settle '+JSON.stringify({x,player:run.player,gate:run.world.gate.id,room:run.world.roomIndex}));}
function navigate(run,targetId){ const avoided=new Set();
  for(let hop=0;hop<220;hop++){
    for(let i=0;!run.player.grounded&&i<240;i++)tick(run,{});
    const ps=platforms(run).filter(p=>(!p.motion||p.id===run.player.platformId)&&(!p.lockedBy||run.encounters.find(e=>e.id===p.lockedBy)?.opened||p.id===run.player.platformId)),target=ps.find(p=>p.id===targetId);
    const standing=ps.find(p=>p.id===run.player.platformId);if(run.player.platformId===targetId||standing&&standing.y===target.y&&standing.x<target.x+target.w&&standing.x+standing.w>target.x){settle(run,target.x+target.w/2);return;}
    const graph=platformGraph(ps);for(const [id,edges] of graph)graph.set(id,edges.filter(next=>!avoided.has(id+"|"+next)));const route=routeBetween(graph,run.player.platformId,targetId);assert.ok(route,`No route from ${run.player.platformId} to ${targetId}`);
    const from=ps.find(p=>p.id===run.player.platformId),to=ps.find(p=>p.id===route[1]);
    const launch=Math.max(from.x+20,Math.min(from.x+from.w-20,to.x+to.w/2));if(!from.motion&&(!from.lockedBy||run.encounters.find(e=>e.id===from.lockedBy)?.opened)&&!portalZones(run).some(z=>from.y>z.y&&from.y<z.y+z.h&&from.x<z.x+z.w&&from.x+from.w>z.x))settle(run,launch);
    const aim=to.x+to.w/2;
    const descending=to.y>from.y+5&&Math.abs(aim-launch)<85;tick(run,{...steer(run,aim,!descending),down:descending});let airborne=false;
    for(let i=0;i<200;i++){tick(run,steer(run,aim,!descending));if(!run.player.grounded)airborne=true;if(airborne&&run.player.grounded)break;}
    tick(run,steer(run,aim,false));if(run.player.platformId!==to.id)avoided.add(from.id+"|"+to.id);
  }
  throw Error(`Navigation exhausted to ${targetId}: ${JSON.stringify(run.player)}`);
}


let progress=freshProgress(),crossZoneReturns=0,travels=0;
for(const chapter of chapters){
 let run=createRun(chapter.rooms[0],progress),visited=new Set(),openedCount=0;
 function save(){progress=captureProgress(progress,run,data);}
 function reachRoom(target){
  save();const graph=new Map(chapter.rooms.map(r=>[r.roomIndex,r.portals.filter(p=>portalOpen(createRun(r,progress),p)).map(p=>p.targetRoom)])),route=routeBetween(graph,run.world.roomIndex,target);if(!route)return false;
  for(const next of route.slice(1)){const portal=run.world.portals.find(p=>p.targetRoom===next&&portalOpen(run,p));navigate(run,portal.platformId);settle(run,portal.x);assert.equal(activate(run).type,'travel');save();run=createRun(chapter.rooms[next],progress);travels++;}return true;
 }
 const initial=worldMapModel(chapter,run,progress);assert.ok(initial.zones.filter(z=>z.visited).length===1);assert.ok(!worldMapHTML(chapter,run,progress,data).includes('Blocker difficulty'));
 for(let pass=0;pass<5;pass++){
  let changes=0;
  for(const room of chapter.rooms){if(!reachRoom(room.roomIndex))continue;visited.add(room.roomIndex);
   for(const e of run.encounters){navigate(run,'approach-'+e.id);assert.ok(e.encountered);}
   for(const p of room.pickups){if(!pickupAwake(run,p)||run.inventory.has(p.enabler.id))continue;navigate(run,p.platformId);settle(run,p.x);assert.ok(run.inventory.has(p.enabler.id),'Missed capability '+p.id);changes++;}
   for(const e of run.encounters){if(e.opened||!e.alternatives.every(a=>run.inventory.has(a.enabler.id)))continue;navigate(run,'approach-'+e.id);run.selected=e.alternatives[0].enabler.id;assert.equal(activate(run).type,'open');openedCount++;changes++;if(chapter.rooms.some(r=>r.roomIndex!==room.roomIndex&&r.pickups.some(p=>p.encounterId===e.id)))crossZoneReturns++;if(!(run.world.portals||[]).some(p=>p.hostId===e.id&&!portalOpen(run,p)))navigate(run,'landing-'+e.id);navigate(run,'home');}
   for(const signal of room.signals){navigate(run,signal.platformId);assert.ok(run.signals.has(signal.key));}
   save();
  }
  if(openedCount===chapter.allChallenges.length&&visited.size===chapter.rooms.length)break;
  assert.ok(changes||pass===0,'World stalled without a discoverable capability');
 }
 assert.equal(openedCount,chapter.allChallenges.length);assert.equal(visited.size,chapter.rooms.length);assert.ok(reachRoom(0));navigate(run,'home');assert.equal(activate(run).type,'complete');save();progress.completed.push(chapter.gate.id);progress=reconcileProgress(JSON.parse(JSON.stringify(progress)),data);
 console.log('PASS world '+chapter.gate.id+': '+visited.size+' regions, '+openedCount+' blockers; all traversal, tools, returns and ending');
}
assert.equal(progress.capabilities.length,109);assert.equal(progress.applied.length,41);assert.equal(progress.completed.length,6);assert.ok(crossZoneReturns>20);assert.ok(travels>30);
assert.equal(restartProgress(progress,data).zones.length,0);assert.equal(restartProgress(progress,data).seenPickups.length,0);
console.log('PASS '+totalFrames+' physics frames, '+travels+' physical portal crossings, '+crossZoneReturns+' distant encounter loops, save/restore and reset');
for(let seed=0;seed<8;seed++){for(const c of buildCampaign(data,String(seed))){assert.ok(c.validation.valid);const signatures=c.allChallenges.map(e=>e.signature.glyph+e.signature.marks);assert.equal(new Set(signatures).size,signatures.length);for(let i=1;i<c.allChallenges.length;i++)assert.ok(c.allChallenges[i].gameDesign.overallGameDifficulty>=c.allChallenges[i-1].gameDesign.overallGameDifficulty);for(const r of c.rooms)for(const p of r.pickups)assert.ok(data.relationships.some(link=>link.blockerId===p.encounterId&&link.enablerId===p.enabler.id));}}
assert.equal(readFileSync(new URL('../data/explorer-data.json',import.meta.url),'utf8'),raw);
console.log('PASS seeded world generation, source-valid distant pairs, unique non-colour signatures, internal progression and unchanged source');
