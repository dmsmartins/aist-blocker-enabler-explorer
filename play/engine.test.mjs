import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLevels,createRun,step,GROUND,platforms} from './engine.mjs';

const data=JSON.parse(readFileSync(new URL('../data/explorer-data.json',import.meta.url),'utf8'));
const levels=buildLevels(data);
assert.equal(levels.length,6);
for(const level of levels){
  assert.ok(level.encounters.length<=3);
  assert.equal(new Set(level.encounters.map(e=>e.blocker.id)).size,level.encounters.length);
  for(const e of level.encounters){assert.equal(e.blocker.stageGate,level.gate.id);assert.ok(data.relationships.some(r=>r.blockerId===e.blocker.id&&r.enablerId===e.enabler.id&&r.mechanism===e.mechanism));}
}
assert.ok(levels[5].transition);

// Running and jumping without the linked enabler cannot pass the first barrier.
const blocked=createRun(levels[0]);
for(let i=0;i<1000;i++)step(blocked,{right:true,jump:blocked.player.grounded},1/120);
assert.ok(blocked.player.x+blocked.player.w<=blocked.encounters[0].x+385);
assert.equal(blocked.encounters[0].resolved,false);
const missing=createRun(levels[0]);missing.player.x=400;
assert.equal(step(missing,{action:true},1/120)[0].type,'missing');
assert.equal(missing.encounters[0].resolved,false);

// Collection survives a fall, and respawn uses the checkpoint.
const falling=createRun(levels[0]);falling.encounters[0].collected=true;falling.checkpoint=700;falling.player.y=700;
assert.ok(step(falling,{},1/120).some(e=>e.type==='respawn'));
assert.equal(falling.player.x,700);assert.ok(falling.encounters[0].collected);

// Play every stage using only normal inputs and physics (no position changes).
// The deterministic pilot approaches each collectible, jumps to it, uses it,
// and crosses the terrain. This checks reachability, collisions and completion.
for(const level of levels){
  const run=createRun(level);let jumps=0,falls=0,previousJump=false,frames=0;
  while(!run.complete&&frames<40000){
    frames++;const p=run.player;
    const target=level.transition?run.beacons.find(b=>!b.collected):run.encounters.find(e=>!e.collected);
    const tx=target?(level.transition?target.x:target.x+190):null;
    let jump=false,right=true,left=false,action=false;
    if(tx!==null){
      // Stop horizontally below the orb if necessary, then jump vertically.
      if(p.x+p.w/2>tx+8){left=true;right=false;}
      else if(p.x+p.w/2>tx-8)right=false;
      if(Math.abs(p.x+p.w/2-tx)<75&&p.grounded&&!previousJump)jump=true;
    }
    const barrier=run.encounters.find(e=>!e.resolved);
    if(barrier&&barrier.collected&&Math.abs(p.x+p.w/2-(barrier.x+400))<135)action=!run.actionHeld;
    // Leap over actual floor gaps in the transition level.
    const floor=platforms(run).find(f=>f.y===GROUND&&p.x+p.w/2>=f.x&&p.x+p.w/2<=f.x+f.w);
    if(floor&&floor.x+floor.w<run.length&&floor.x+floor.w-(p.x+p.w/2)<80&&p.grounded&&!previousJump)jump=true;
    if(jump)jumps++;previousJump=jump;
    const events=step(run,{right,left,jump,action},1/120);falls+=events.filter(e=>e.type==='respawn').length;
  }
  assert.ok(run.complete,`Gate ${level.gate.id} did not finish: ${JSON.stringify({p:run.player,encounters:run.encounters.map(e=>({collected:e.collected,resolved:e.resolved})),beacons:run.beacons})}`);
  assert.equal(falls,0,`Gate ${level.gate.id} requires an unintended fall`);
  console.log(`PASS Gate ${level.gate.id}: ${level.encounters.length} real challenges, ${jumps} jumps, ${frames} frames, no falls`);
}
console.log('PASS source mappings, no duplicate challenges, barriers, checkpoint recovery and all six playable levels');
