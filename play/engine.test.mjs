import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareData,strongComponents,selectJourneyChallenges} from './data.mjs';
import {buildJourney,platformGraph,routeBetween} from './world-builder.mjs';
import {createRun,step,activate,platforms} from './engine.mjs';
import {knowledgeHTML,esc,gateURL,finaleHTML} from './ui.mjs';
import {freshProgress,reconcileProgress,readProgress,writeProgress,captureProgress,restartProgress} from './storage.mjs';
const raw=JSON.parse(readFileSync(new URL('../data/explorer-data.json',import.meta.url),'utf8'));
const original=JSON.stringify(raw),data=prepareData(raw),worlds=buildJourney(data);
assert.equal(data.warnings.length,0);
assert.deepEqual(buildJourney(data),worlds);
assert.ok(new Set(Array.from({length:12},(_,i)=>JSON.stringify(buildJourney(data,String(i)).map(w=>w.encounters.map(e=>e.id))))).size>1);
for(let seed=0;seed<60;seed++)for(const w of buildJourney(data,String(seed))){
  assert.ok(w.validation.valid);assert.ok(w.encounters.length<=5);
  assert.equal(new Set(w.encounters.map(e=>e.id)).size,w.encounters.length);
  for(const e of w.encounters)for(const a of e.alternatives)assert.ok(data.relationships.some(r=>r.blockerId===e.id&&r.enablerId===a.enabler.id&&r.mechanism===a.relation.mechanism));
}
assert.equal(JSON.stringify(raw),original,'Source data must stay immutable');
assert.throws(()=>prepareData({}));
const damaged=structuredClone(raw);damaged.blockers.push(null,damaged.blockers[0]);damaged.relationships.push({blockerId:999999,enablerId:999999});
assert.ok(prepareData(damaged).warnings.length>=3);
assert.deepEqual(strongComponents(['a','b','c'],new Map([['a',['b']],['b',['a']],['c',['b']]])).map(c=>c.sort()),[['a','b'],['c']]);
const empty=structuredClone(raw);empty.relationships=[];assert.ok(buildJourney(prepareData(empty)).every(w=>w.epilogue||w.unavailable));
const future=structuredClone(raw);future.blockers[0].stageGate=future.stageGates.at(-1).id;assert.ok(buildJourney(prepareData(future)).at(-1).encounters.length>0);
const brokenStore={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
assert.deepEqual(readProgress(brokenStore,data).completed,[]);assert.equal(writeProgress(brokenStore,freshProgress()),false);
assert.deepEqual(readProgress({getItem:()=>'{bad'},data).applied,[]);
const bad=reconcileProgress({completed:['missing'],capabilities:['missing'],applied:[null,{blockerId:'missing',enablerId:'missing'}]},data);assert.deepEqual(bad.applied,[]);
for(const w of worlds)for(const e of w.encounters){
  const r=createRun(w);Object.assign(r.player,{x:e.x-12,y:e.y-28});
  assert.equal(activate(r).type,'unavailable');
  const wrong=data.relationships.find(a=>!e.relations.some(b=>b.enablerId===a.enablerId));if(wrong){r.inventory.add(wrong.enablerId);r.selected=wrong.enablerId;assert.equal(activate(r).type,'unavailable');}
  for(const alternative of e.alternatives){const trial=createRun(w);Object.assign(trial.player,{x:e.x-12,y:e.y-28});trial.inventory.add(alternative.enabler.id);trial.selected=alternative.enabler.id;assert.equal(activate(trial).type,'open');assert.equal(trial.encounters.filter(x=>x.opened).length,1,'Dependencies must not auto-open');const restored=createRun(w,captureProgress(freshProgress(),trial,data));assert.ok(restored.encounters.find(x=>x.id===e.id).opened);trial.player.y=2000;assert.ok(step(trial,{},1/120).some(x=>x.type==='respawn'));assert.ok(trial.inventory.has(alternative.enabler.id));}
}

// A deterministic pilot uses the same fixed-step physics as the browser. It walks
// to a safe take-off point, holds jump, steers and brakes. No position assignments.
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
let campaign=freshProgress();
for(const world of worlds){const run=createRun(world,campaign);
  assert.notEqual(activate(run).type,"complete","A fresh chapter must not finish at its entrance");
  for(const e of run.encounters){navigate(run,'approach-'+e.id);assert.ok(e.encountered);const pickups=world.pickups.filter(p=>p.encounterId===e.id);for(const pickup of pickups){navigate(run,pickup.platformId);assert.ok(run.inventory.has(pickup.enabler.id),'Capability not collected');navigate(run,'approach-'+e.id);}run.selected=pickups[0].enabler.id;assert.equal(activate(run).type,'open');navigate(run,'landing-'+e.id);assert.equal(activate(run).type,'return');}
  for(const signal of world.signals)navigate(run,signal.platformId);
  navigate(run,'home');assert.equal(activate(run).type,'complete');assert.equal(run.complete,true);campaign.completed.push(world.gate.id);campaign=reconcileProgress(JSON.parse(JSON.stringify(captureProgress(campaign,run,data))),data);console.log(`PASS physics journey Gate ${world.gate.id}: ${run.encounters.length} source challenges`);
}
console.log(`PASS ${totalFrames} physics frames, 60 seeds, source relationships, alternative enablers, cycles, changed data, persistence and fall recovery`);

for(const world of worlds){const run=createRun(world);for(const e of run.encounters){const html=knowledgeHTML(data,run,e);assert.ok(html.includes(esc(e.blocker.statement)));assert.ok(html.includes(esc(e.alternatives[0].enabler.description)));assert.ok(html.includes(esc(e.alternatives[0].relation.rationale)));}assert.ok(gateURL(world.gate).endsWith(world.gate.id));assert.ok(finaleHTML(run).includes('<svg'));}
const supportedWorld=worlds.find(w=>w.encounters.some(e=>e.upstream.length));const dependent=supportedWorld.encounters.find(e=>e.upstream.length);const supportedRun=createRun(supportedWorld,{applied:[{blockerId:dependent.upstream[0],enablerId:'irrelevant'}]});assert.ok(supportedRun.encounters.find(e=>e.id===dependent.id).support>0);assert.ok(!supportedRun.encounters.find(e=>e.id===dependent.id).opened);
console.log('PASS verbatim source panels, chapter deep links, finale and dependency support without automatic activation');

assert.deepEqual(campaign.completed,data.gates.map(g=>g.id),'Every chapter reaches its exit in sequence');
campaign.settings.sound=true;campaign.settings.reducedMotion=true;
const restarted=restartProgress(campaign,data);
for(const field of ['completed','capabilities','encountered','applied','mechanisms'])assert.deepEqual(restarted[field],[],field+' must reset');
assert.equal(restarted.seed,campaign.seed);assert.equal(restarted.settings.sound,true);assert.equal(restarted.settings.reducedMotion,true);assert.equal(restarted.settings.currentGate,null);
const replay=createRun(buildJourney(data,restarted.seed)[0],restarted);assert.equal(replay.inventory.size,0);assert.ok(replay.encounters.every(e=>!e.opened));assert.notEqual(activate(replay).type,'complete');
assert.equal(restartProgress(campaign,data,'another-path').seed,'another-path');
console.log('PASS full sequential campaign, reload between chapters, ending and clean restart with preferences preserved');
