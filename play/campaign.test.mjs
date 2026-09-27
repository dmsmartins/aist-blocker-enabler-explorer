import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {prepareData} from './data.mjs';import {buildCampaign,arriveAt,roomUnlocked,reconcileCampaign} from './campaign.mjs';import {createRun,activate,step,useAbility,platforms,pickupAwake,portalOpen,portalZones} from './engine.mjs';import {freshProgress,restartProgress,captureProgress} from './storage.mjs';import {worldMapModel,worldMapHTML} from './world-map.mjs';
const data=prepareData(JSON.parse(readFileSync(new URL('../data/explorer-data.json',import.meta.url)))),chapters=buildCampaign(data),progress=freshProgress();
for(const chapter of chapters){assert.ok(chapter.validation.valid);for(const room of chapter.rooms){for(const e of room.encounters){const trial=createRun(room);e.alternatives.forEach(a=>trial.inventory.add(a.enabler.id));const family=e.relations[0].mechanism;trial.mechanisms.add(family);arriveAt(trial,e.id);step(trial,{},1/120);assert.equal(useAbility(trial,family).type,'open');assert.equal(trial.encounters.filter(n=>n.opened).length,1);}
 for(const portal of room.portals.filter(p=>p.requirements.length)){const trial=createRun(room);assert.equal(portalOpen(trial,portal),false);trial.player.x=portal.x-12;trial.player.y=portal.y-14;assert.equal(activate(trial).type,'portal-locked');const z=portalZones(trial).find(z=>z.portals.some(p=>p.id===portal.id));trial.player.x=z.x-24;trial.player.y=portal.y-14;trial.facing=1;trial.timers.Commit=1;step(trial,{right:true},1/30);assert.ok(trial.player.x+24<=z.x||trial.player.x>=z.x+z.w||trial.player.y+28<=z.y||trial.player.y>=z.y+z.h,'Sealed portal remains solid');}
}}
const run=createRun(chapters[2].rooms[0]);assert.equal(useAbility(run,'Equip').type,'ability-locked');run.mechanisms=new Set(['Frame','Commit','Equip','Assure','Operate','Learn']);useAbility(run,'Equip');step(run,{jump:true},1/120);assert.ok(run.player.vy< -750);useAbility(run,'Frame');assert.ok(platforms(run).some(p=>p.id==='reveal-0'));useAbility(run,'Assure');run.player.vy=700;step(run,{},1/120);assert.ok(run.player.vy<=150);useAbility(run,'Commit');assert.equal(run.player.vx,600);useAbility(run,'Learn');assert.equal(run.player.platformId,'home');
const c=chapters[3],fresh=createRun(c.rooms[0]),model=worldMapModel(c,fresh,progress),html=worldMapHTML(c,fresh,progress,data);assert.ok(model.zones.some(z=>!z.visible));for(const room of c.rooms.slice(1))assert.ok(!html.includes(room.zoneName),'Unvisited landmark names stay hidden');assert.ok(!html.includes('data-travel'));assert.ok(!html.includes('overallGameDifficulty'));assert.ok(!html.includes(c.allChallenges[0].blocker.title));
const moving=run.world.platforms.find(p=>p.motion),before=platforms(run).find(p=>p.id===moving.id).x;run.time+=1;assert.notEqual(platforms(run).find(p=>p.id===moving.id).x,before);
const evolving=createRun(chapters[4].rooms[0]);assert.ok(!platforms(evolving).some(p=>p.id.startsWith('adaptive-')));evolving.encounters[0].opened=true;assert.ok(platforms(evolving).some(p=>p.id.startsWith('adaptive-')));
assert.equal(restartProgress(progress,data).zones.length,0);assert.deepEqual(reconcileCampaign(progress,chapters).completed,[]);
console.log('PASS source-linked abilities, portal collision locks, hidden map content, moving spans, adaptive routes and clean restart');

// Dormant tools cannot be collected or revealed, even when physically touched.
for(const remote of [false,true]){
 const room=chapters[0].rooms.find(r=>r.pickups.some(p=>p.remote===remote)),p=room.pickups.find(p=>p.remote===remote),trial=createRun(room);
 Object.assign(trial.player,{x:p.x-12,y:p.y-28,vx:0,vy:0,platformId:p.platformId});
 step(trial,{},1/120);assert.equal(pickupAwake(trial,p),false);assert.equal(trial.inventory.has(p.enabler.id),false);assert.equal(trial.seenPickups.has(p.id),false);
 const origin=chapters[0].rooms[p.originRoom],discovery=createRun(origin);arriveAt(discovery,p.encounterId);step(discovery,{},1/120);
 const saved=captureProgress(freshProgress(),discovery,data),awake=createRun(room,JSON.parse(JSON.stringify(saved)));assert.equal(pickupAwake(awake,p),true);
 Object.assign(awake.player,{x:p.x-12,y:p.y-28,vx:0,vy:0,platformId:p.platformId});step(awake,{},1/120);assert.ok(awake.inventory.has(p.enabler.id));
}
for(const chapter of chapters)for(const room of chapter.rooms)for(const p of room.pickups){assert.ok(room.pickups.filter(q=>q.platformId===p.platformId).length<=2);assert.ok(room.pickups.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)<100).length<=2);}
assert.ok(html.includes('data-map-zoom="out"'));assert.ok(!html.includes('world-overview'));const overview=worldMapHTML(c,fresh,progress,data,0,true);assert.ok(overview.includes('world-overview'));assert.ok(overview.includes('data-map-zoom="in"'));
console.log('PASS dormant local/remote tools, saved discovery activation, at most two per stop and local-first map zoom');

for(const c of chapters.filter(c=>c.allChallenges.length))for(const r of c.rooms)assert.ok(r.pickups.length,'Every region contains enablers: '+r.zoneName);
