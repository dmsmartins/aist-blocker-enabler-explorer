import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mechanismGroups,initialMechanism,selectionFromHash,selectionHash,firstSentence,enablerLayout} from './unlock.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/explorer-data.json',import.meta.url)));

test('all 41 blockers expose six counts reconciled to the original relationship rows',()=>{
  const before=JSON.stringify(data);
  let total=0;
  for(const blocker of data.blockers){
    const groups=mechanismGroups(data,blocker.id);
    assert.deepEqual(Object.keys(groups),data.mechanisms.map(m=>m.key));
    for(const mechanism of data.mechanisms){
      const rows=data.relationships.filter(r=>r.blockerId===blocker.id&&r.mechanism===mechanism.key);
      assert.equal(groups[mechanism.key].length,rows.length);
      for(const pair of groups[mechanism.key]){
        assert.ok(rows.includes(pair.relationship));
        assert.equal(pair.enabler,data.enablers.find(e=>e.id===pair.relationship.enablerId));
        total++;
      }
    }
  }
  assert.equal(total,data.relationships.length);
  assert.equal(JSON.stringify(data),before);
});

test('only a sole available mechanism is automatic; an unavailable request cannot select it',()=>{
  for(const blocker of data.blockers){
    const groups=mechanismGroups(data,blocker.id),available=data.mechanisms.filter(m=>groups[m.key].length);
    const expected=available.length===1?available[0].key:null;
    assert.equal(initialMechanism(data,blocker.id),expected);
    assert.equal(initialMechanism(data,blocker.id,'unknown'),expected);
    for(const mechanism of available)assert.equal(initialMechanism(data,blocker.id,mechanism.key.toLowerCase()),mechanism.key);
  }
  const empty={...data,relationships:[]};
  assert.equal(initialMechanism(empty,1024),null);
  assert.ok(Object.values(mechanismGroups(empty,1024)).every(items=>items.length===0));
});

test('share links round-trip every valid blocker/mechanism including Gate 0',()=>{
  for(const blocker of data.blockers){
    for(const [mechanism,items] of Object.entries(mechanismGroups(data,blocker.id))){
      if(!items.length)continue;
      const selection={gate:blocker.stageGate,blocker:blocker.id,detail:true,mechanism};
      assert.deepEqual(selectionFromHash(data,selectionHash(selection)),selection);
    }
  }
  assert.equal(selectionFromHash(data,'#blocker=1323&mech=assure').mechanism,'Assure');
  assert.equal(selectionFromHash(data,'#blocker=1114&mech=assure').mechanism,null);
  assert.equal(selectionFromHash(data,'#blocker=1114').mechanism,null);
  assert.equal(selectionFromHash(data,'#blocker=1713&mech=unknown').mechanism,'Assure');
  for(const hash of ['#blocker=999999&mech=assure','#blocker=NaN','#blocker=','#gate=9'])assert.equal(selectionFromHash(data,hash).blocker,null);
  assert.equal(selectionFromHash(data,'','?gate=0').gate,0);
  assert.equal(selectionHash({gate:0}), '#gate=0');
  assert.equal(selectionHash({gate:0,blocker:1713,detail:false,mechanism:'Assure'}),'#blocker=1713');
});

test('card bands never overlap each other or dependency lanes at narrow and wide canvas sizes',()=>{
  for(const width of [320,390,600,800,1100])for(let count=1;count<=12;count++){
    const layout=enablerLayout(count,width,760,350,width<600?260:330);
    assert.ok(layout.dependencyLeft+255<layout.left);
    assert.ok(layout.dependencyRight>layout.left+layout.width);
    for(const [i,a] of layout.positions.entries()){
      assert.ok(a.y>=700);
      for(const b of layout.positions.slice(i+1))assert.ok(a.x+245<=b.x||b.x+245<=a.x||a.y+164<=b.y||b.y+164<=a.y);
    }
  }
});

test('summary takes the first sentence without changing source content',()=>{
  assert.equal(firstSentence('One sentence. Another sentence.'),'One sentence.');
  assert.equal(firstSentence('First!\nSecond'),'First!');
  assert.equal(firstSentence('No full stop'),'No full stop');
  assert.equal(firstSentence(null),'');
});
