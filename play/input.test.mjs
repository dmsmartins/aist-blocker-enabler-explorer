import assert from 'node:assert/strict';
import {createInput} from './input.mjs';
const callbacks=new Map(),windowEvents=new Map();
function button(key){const listeners=new Map();return {dataset:{hold:key},classList:{add(){},remove(){}},setPointerCapture(){},addEventListener:(key,fn)=>listeners.set(key,fn),fire(type,id=1){listeners.get(type)?.({pointerId:id,preventDefault(){},key:'Enter',repeat:false,clientX:50,clientY:50});}};}
const left=button('left'),jump=button('jump'),action=button('action'),buttons=[left,jump,action],canvas={};let paused=0;
globalThis.document={body:{},hidden:false,querySelector:()=>null,querySelectorAll:()=>buttons,addEventListener:(type,fn)=>callbacks.set(type,fn)};
globalThis.window={addEventListener:(type,fn)=>windowEvents.set(type,fn)};
const input=createInput(canvas,{isPlaying:()=>true,pause(){},lostFocus(){paused++;},cycle(){},knowledge(){},map(){},family(){}});
left.fire('pointerdown',1);jump.fire('pointerdown',2);assert.deepEqual(input.sample(),{left:true,jump:true});jump.fire('pointerup',2);assert.deepEqual(input.sample(),{left:true});left.fire('pointercancel',1);assert.deepEqual(input.sample(),{});
action.fire('pointerdown');action.fire('pointerup');assert.equal(input.sample().action,true,'A short tap survives until the physics tick');assert.deepEqual(input.sample(),{});
callbacks.get('keydown')({code:'Space',target:canvas,preventDefault(){},repeat:false});callbacks.get('keyup')({code:'Space'});assert.equal(input.sample().jump,true);
left.fire('pointerdown');windowEvents.get('blur')();assert.equal(paused,1);assert.deepEqual(input.sample(),{});
console.log('PASS simultaneous touch input, pointer cancellation, quick taps, keyboard pulses and blur release');

const right=button('right');document.elementFromPoint=()=>({closest:()=>right});
left.fire('pointerdown',10);jump.fire('pointerdown',11);input.sample();left.fire('pointermove',10);assert.deepEqual(input.sample(),{right:true,jump:true},'Slide direction while holding jump');left.fire('pointerup',10);assert.deepEqual(input.sample(),{jump:true});jump.fire('lostpointercapture',11);assert.deepEqual(input.sample(),{});
left.fire('pointerdown',12);jump.fire('pointerdown',13);input.clear();assert.deepEqual(input.sample(),{});left.fire('pointermove',12);assert.deepEqual(input.sample(),{},'A cleared drag cannot restart movement');
console.log('PASS thumb sliding, simultaneous jumping, capture loss and clearing active touches');
