import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareData} from './data.mjs';
import {reconcileProgress} from './storage.mjs';
const raw = JSON.parse(readFileSync(new URL('../data/explorer-data.json', import.meta.url)));
const data = prepareData(raw);

test('all six zero-based gates and Gate 0 blockers survive game data validation', () => {
  assert.deepEqual(data.gates.map(g => g.id), ['0','1','2','3','4','5']);
  assert.equal(data.blockers.length, raw.blockers.length);
  assert.equal(data.blockers.filter(b => b.stageGate === '0').length, 14);
  assert.equal(data.warnings.length, 0);
});
test('legacy game saves migrate gates once while retaining preferences and discoveries', () => {
  const saved = {version:2, completed:['1','6'], zones:['1:world6:0','6:world6:2'], handover:['6:signal-0'], encountered:[raw.blockers[0].id], settings:{currentGate:'1',currentRoom:2,sound:true}};
  const migrated = reconcileProgress(saved, data);
  assert.deepEqual(migrated.completed,['0','5']);
  assert.deepEqual(migrated.zones,['0:world6:0','5:world6:2']);
  assert.deepEqual(migrated.handover,['5:signal-0']);
  assert.deepEqual(migrated.encountered,[String(raw.blockers[0].id)]);
  assert.equal(migrated.settings.currentGate,'0');
  assert.equal(migrated.settings.currentRoom,2);
  assert.equal(migrated.settings.sound,true);
  assert.deepEqual(reconcileProgress(migrated,data),migrated);
  assert.equal(saved.settings.currentGate,'1');
});
