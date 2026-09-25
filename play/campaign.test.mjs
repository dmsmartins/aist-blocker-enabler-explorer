import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {prepareData} from './data.mjs';import {buildCampaign,roomUnlocked,canTravel,reconcileCampaign,arriveAt} from './campaign.mjs';import {platformGraph,routeBetween} from './world-builder.mjs';import {createRun,step,activate,platforms,useAbility} from './engine.mjs';import {freshProgress,captureProgress,reconcileProgress,restartProgress} from './storage.mjs';
const data=prepareData(JSON.parse(readFileSync(new URL('../data/explorer-data.json',import.meta.url))));const chapters=buildCampaign(data);
assert.equal(chapters.flatMap(c=>c.allChallenges).length,data.blockers.filter(b=>data.relationsByBlocker.get(b.id).length).length);
for(const c of chapters)for(const e of c.allChallenges)assert.equal(e.alternatives.length,new Set(e.relations.map(r=>r.enablerId)).size);
let totalFrames=0;
function tick(run,input){totalFrames++;const events=step(run,input,1/120);assert.ok(!events.some(e=>e.type==='respawn'),'Pilot fell off a required route');return events;}
function steer(run,x,jump=false){const p=run.player,delta=x-(p.x+p.w/2),braking=p.vx*Math.abs(p.vx)/4400;return {left:delta-braking< -3,right:delta-braking>3,jump};}
function settle(run,x){for(let i=0;i<200;i++){const p=run.player;if(Math.abs(x-p.x-p.w/2)<5&&Math.abs(p.vx)<20)return;tick(run,steer(run,x));}throw Error('Could not settle');}
function navigate(run,targetId){ const avoided=new Set();
  for(let hop=0;hop<120;hop++){
    for(let i=0;!run.player.grounded&&i<240;i++)tick(run,{});
    const ps=platforms(run).filter(p=>!p.lockedBy||run.encounters.find(e=>e.id===p.lockedBy)?.opened),target=ps.find(p=>p.id===targetId);
    if(run.player.platformId===targetId){settle(run,target.x+target.w/2);return;}
    const graph=platformGraph(ps);for(const [id,edges] of graph)graph.set(id,edges.filter(next=>!avoided.has(id+"|"+next)));const route=routeBetween(graph,run.player.platformId,targetId);assert.ok(route,`No route from ${run.player.platformId} to ${targetId}`);
    const from=ps.find(p=>p.id===run.player.platformId),to=ps.find(p=>p.id===route[1]);
    const launch=Math.max(from.x+20,Math.min(from.x+from.w-20,to.x+to.w/2));settle(run,launch);
    const aim=to.x+to.w/2;
    const descending=to.y>from.y+5&&Math.abs(aim-launch)<85;tick(run,{...steer(run,aim,!descending),down:descending});let airborne=false;
    for(let i=0;i<200;i++){tick(run,steer(run,aim,!descending));if(!run.player.grounded)airborne=true;if(airborne&&run.player.grounded)break;}
    tick(run,steer(run,aim,false));if(run.player.platformId!==to.id)avoided.add(from.id+"|"+to.id);
  }
  throw Error(`Navigation exhausted to ${targetId}: ${JSON.stringify(run.player)}`);
}

let progress=freshProgress(),visited=0,pickupsVisited=0;
for(const chapter of chapters){
 for(const room of chapter.rooms){
  assert.ok(roomUnlocked(room,progress),'Room entry must be reachable in dependency order');
  const run=createRun(room,progress);
  for(const e of run.encounters){
   navigate(run,'approach-'+e.id);assert.ok(e.encountered);
   if(e.alternatives.some(a=>!run.inventory.has(a.enabler.id)))assert.equal(activate(run).type,'tools-missing');
   for(const pickup of room.pickups.filter(p=>p.encounterId===e.id)){if(run.inventory.has(pickup.enabler.id))continue;navigate(run,pickup.platformId);settle(run,pickup.x);assert.ok(run.inventory.has(pickup.enabler.id),'Not collected '+pickup.id);pickupsVisited++;}
   navigate(run,'approach-'+e.id);run.selected=e.alternatives[0].enabler.id;assert.equal(activate(run).type,'open');navigate(run,'landing-'+e.id);assert.equal(activate(run).type,'return');visited++;
  }
  for(const signal of room.signals)navigate(run,signal.platformId);
  navigate(run,'home');const end=activate(run);assert.equal(end.type,room.roomIndex===chapter.rooms.length-1?'complete':'portals');
  progress=captureProgress(progress,run,data);if(end.type==='complete')progress.completed.push(chapter.gate.id);progress=reconcileProgress(JSON.parse(JSON.stringify(progress)),data);
 }
 console.log(`PASS full Stage Gate ${chapter.gate.id}: ${chapter.rooms.length} mini-maps, ${chapter.allChallenges.length} blockers`);
}
assert.equal(progress.completed.length,chapters.length);assert.equal(progress.applied.length,visited);
assert.deepEqual(reconcileCampaign(progress,chapters).completed,progress.completed);
const reset=restartProgress(progress,data);assert.deepEqual(reset.applied,[]);assert.ok(chapters[0].rooms.slice(1).every(r=>!roomUnlocked(r,reset)));
const run=createRun(chapters[0].rooms[0]);assert.equal(useAbility(run,'Equip').type,'ability-locked');run.mechanisms=new Set(['Frame','Commit','Equip','Assure','Operate','Learn']);
assert.equal(useAbility(run,'Equip').type,'ability');step(run,{jump:true},1/120);assert.ok(run.player.vy< -750,'Boost changes actual jump physics');assert.equal(useAbility(run,'Frame').type,'ability');assert.ok(platforms(run).some(p=>p.id==='reveal-0'));assert.equal(useAbility(run,'Frame').type,'ability-cooldown');useAbility(run,'Assure');run.player.vy=700;step(run,{},1/120);assert.ok(run.player.vy<=150);useAbility(run,'Commit');assert.equal(run.player.vx,600);useAbility(run,'Operate');assert.ok(run.timers.Operate>run.time);useAbility(run,'Learn');assert.equal(run.player.platformId,'home');
run.player.x=200;assert.equal(canTravel(run),false);const fast=[...run.world.centralEnablers][0];if(fast){run.inventory.add(fast);assert.equal(canTravel(run),true);}
console.log(`PASS ${visited} blockers, ${progress.capabilities.length} unique enablers, ${pickupsVisited} collection visits, ${totalFrames} physical frames, every exit, portal locks, abilities and clean restart`);

assert.ok(arriveAt(run,run.encounters[0].id));assert.equal(run.player.platformId,'approach-'+run.encounters[0].id);assert.equal(arriveAt(run,'unknown'),false);
for(let seed=0;seed<30;seed++){const generated=buildCampaign(data,String(seed));for(const chapter of generated){const reachable=freshProgress();for(const room of chapter.rooms){assert.ok(roomUnlocked(room,reachable),'Seeded entry lock is circular');assert.ok(room.validation.valid);reachable.applied.push(...room.encounters.map(e=>({blockerId:e.id,enablerId:e.alternatives[0].enabler.id})));}}}
console.log('PASS 30 complete campaign layouts, noncircular room locks and direct discovery arrival');

const handoverRun=createRun(chapters.at(-1).rooms[0]);handoverRun.signals.add(handoverRun.world.signals[0].key);const handoverSaved=captureProgress(freshProgress(),handoverRun,data);assert.equal(createRun(handoverRun.world,handoverSaved).signals.size,1);assert.equal(restartProgress(handoverSaved,data).handover.length,0);console.log('PASS epilogue signal progress survives reload and resets cleanly');

for(const chapter of chapters)for(const room of chapter.rooms){if(room.sourceGate)assert.ok(room.entryRequirements.every(id=>room.encounters.some(e=>e.upstream.includes(id))));for(const e of room.encounters){const trial=createRun(room);e.alternatives.forEach(a=>trial.inventory.add(a.enabler.id));const family=e.relations[0].mechanism;trial.mechanisms.add(family);arriveAt(trial,e.id);step(trial,{},1/120);assert.equal(useAbility(trial,family).type,'open');assert.equal(trial.encounters.filter(n=>n.opened).length,1);}}
console.log('PASS linked ability barrier activation and authoritative dependency gate direction');
