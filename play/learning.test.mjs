import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareData} from './data.mjs';import {buildJourney} from './world-builder.mjs';import {createRun} from './engine.mjs';import {learningCard,journeyStep,excerpt} from './learning.mjs';
const data=prepareData(JSON.parse(readFileSync(new URL('../data/explorer-data.json',import.meta.url))));const run=createRun(buildJourney(data)[0]),encounter=run.encounters[0],pickup=run.world.pickups[0];
assert.equal(journeyStep(run),0);assert.ok(learningCard({type:'encounter',encounter},run).html.includes('Your next move'));assert.ok(learningCard({type:'collect',encounter,pickup},run).html.includes(pickup.relation.mechanism));run.inventory.add(pickup.enabler.id);assert.ok(learningCard({type:'open',encounter},run).html.includes('tool-assembly'));assert.ok(excerpt('word '.repeat(100)).length<=241);
console.log('PASS instructional discovery cards and blocker tool presentation');
