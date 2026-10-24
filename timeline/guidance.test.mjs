import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gateKey,guidanceFor} from './guidance.mjs';
const payload=JSON.parse(fs.readFileSync(new URL('../data/stage-gate-guidance.json',import.meta.url)));
test('all six numeric timeline gates resolve to the corresponding workbook guidance',()=>{
  for(let id=0;id<6;id++){
    const result=guidanceFor(payload,gateKey({id}));
    assert.equal(result.gate_id,`G${id}`);
    assert.equal(result.gate_order,id);
    assert.equal(result.actions.length,3);
    result.actions.forEach((action,i)=>assert.equal(action.id,`G${id}-A${i+1}`));
    assert.equal(result.categories.length,result.iso_line_count);
  }
});
test('Info/Data is a display label; source identifiers and tokens stay intact',()=>{
  const before=JSON.stringify(payload);
  const info=guidanceFor(payload,'G1').categories.find(x=>x.token==='Info');
  assert.equal(info.label,'Info/Data');
  assert.equal(payload.stageGates[1].iso_info,true);
  assert.equal(JSON.stringify(payload),before);
});
test('unknown, unavailable and duplicate guidance never resolve to another gate',()=>{
  assert.equal(gateKey({id:6}),null);
  assert.equal(guidanceFor(null,'G0'),null);
  assert.equal(guidanceFor(payload,'G6'),null);
  assert.equal(guidanceFor({stageGates:[{gate_id:'G0',show_guidance:false}]},'G0'),null);
  assert.equal(guidanceFor({stageGates:[payload.stageGates[0],payload.stageGates[0]]},'G0'),null);
});
