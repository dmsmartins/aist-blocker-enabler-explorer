import assert from 'node:assert/strict';
import {createInput} from './input.mjs';
const callbacks=new Map(),windowEvents=new Map();
function button(key){const listeners=new Map();return {dataset:{hold:key},classList:{add(){},remove(){}},setPointerCapture(){},addEventListener:(key,fn)=>listeners.set(key,fn),fire(type,id=1){listeners.get(type)?.({pointerId:id,preventDefault(){},key:'Enter',repeat:false});}};}
const left=button('left'),jump=button('jump'),action=button('action'),buttons=[left,jump,action],canvas={};let paused=0;
globalThis.document={body:{},hidden:false,querySelector:()=>null,querySelectorAll:()=>buttons,addEventListener:(type,fn)=>callbacks.set(type,fn)};
globalThis.window={addEventListener:(type,fn)=>windowEvents.set(type,fn)};
const input=createInput(canvas,{isPlaying:()=>true,pause(){},lostFocus(){paused++;},cycle(){},knowledge(){},map(){},family(){}});
left.fire('pointerdown',1);jump.fire('pointerdown',2);assert.deepEqual(input.sample(),{left:true,jump:true});jump.fire('pointerup',2);assert.deepEqual(input.sample(),{left:true});left.fire('pointercancel',1);assert.deepEqual(input.sample(),{});
action.fire('pointerdown');action.fire('pointerup');assert.equal(input.sample().action,true,'A short tap survives until the physics tick');assert.deepEqual(input.sample(),{});
callbacks.get('keydown')({code:'Space',target:canvas,preventDefault(){},repeat:false});callbacks.get('keyup')({code:'Space'});assert.equal(input.sample().jump,true);
left.fire('pointerdown');windowEvents.get('blur')();assert.equal(paused,1);assert.deepEqual(input.sample(),{});
console.log('PASS simultaneous touch input, pointer cancellation, quick taps, keyboard pulses and blur release');
