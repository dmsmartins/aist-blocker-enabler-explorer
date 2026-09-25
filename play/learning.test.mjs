import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareData} from './data.mjs';import {buildJourney} from './world-builder.mjs';import {createRun} from './engine.mjs';import {learningCard,journeyStep,excerpt} from './learning.mjs';
const data=prepareData(JSON.parse(readFileSync(new URL('../data/explorer-data.json',import.meta.url))));const run=createRun(buildJourney(data)[0]),encounter=run.encounters[0],pickup=run.world.pickups[0];
assert.equal(journeyStep(run),0);assert.equal(learningCard({type:'encounter',encounter},run),null);assert.equal(learningCard({type:'collect',encounter,pickup},run),null);run.inventory.add(pickup.enabler.id);const card=learningCard({type:'open',encounter,relation:pickup.relation},run);assert.ok(card.html.includes('key-assembly'));assert.ok(!card.html.includes('next move'));assert.ok(excerpt('word '.repeat(100)).length<=241);
console.log('PASS nonmodal discoveries and concise key assembly without next-step instructions');
