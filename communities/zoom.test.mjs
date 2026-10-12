import test from 'node:test';import assert from 'node:assert/strict';import {wheelFactor,zoomBox} from './zoom.mjs';
test('large wheel deltas are capped and each event changes scale by at most 3.4%',()=>{assert.equal(wheelFactor(10000),wheelFactor(50));assert.ok(wheelFactor(10000)<1.034);assert.ok(wheelFactor(-10000)>.967)});
test('line and pixel wheel deltas use the same sensitivity',()=>assert.equal(wheelFactor(1,1),wheelFactor(16,0)));
test('zoom stays anchored to pointer and preserves aspect ratio',()=>{const b=zoomBox([10,20,1000,600],.9,[.25,.75]);assert.deepEqual(b,[35,65,900,540])});
test('zoom limits are respected without switching communities or resetting position',()=>{assert.deepEqual(zoomBox([10,20,650,390],.5),[10,20,650,390]);assert.equal(zoomBox([10,20,2300,1380],2)[2],2400)});
