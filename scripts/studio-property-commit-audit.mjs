import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioPropertyCommitController, shouldHandleStudioPropertyCommitKey } from '../src/studio/input/studio-property-commit-controller.mjs';

const listeners=new Map();
const document={
  addEventListener(type,fn,capture){listeners.set(type,{fn,capture});},
  removeEventListener(type,fn,capture){const row=listeners.get(type);if(row?.fn===fn&&row.capture===capture)listeners.delete(type);}
};
const root={document};
let blurCount=0;
const input={
  value:'32',
  matches(selector){return selector==='#kelo-studio-live [data-prop]';},
  blur(){blurCount++;}
};
const event=(key,target=input,extra={})=>({key,target,defaultPrevented:false,repeat:false,ctrlKey:false,metaKey:false,altKey:false,prevented:0,stopped:0,preventDefault(){this.prevented++;},stopPropagation(){this.stopped++;},...extra});

assert.equal(shouldHandleStudioPropertyCommitKey(event('Enter')),true,'Enter should commit a Studio property');
assert.equal(shouldHandleStudioPropertyCommitKey(event('Escape')),true,'Escape should cancel a Studio property');
assert.equal(shouldHandleStudioPropertyCommitKey(event('Tab')),true,'Tab should be eligible for stable internal Inspector navigation');
assert.equal(shouldHandleStudioPropertyCommitKey(event('Enter',input,{ctrlKey:true})),false,'modified Enter must pass through');
assert.equal(shouldHandleStudioPropertyCommitKey(event('Enter',{matches:()=>false})),false,'non-property inputs must pass through');

const controller=createStudioPropertyCommitController({root});
assert.equal(listeners.get('focusin')?.capture,true,'focus snapshot must use capture');
assert.equal(listeners.get('keydown')?.capture,true,'property keys must be handled before global Studio shortcuts');

listeners.get('focusin').fn({target:input});
input.value='96';
const enter=event('Enter');
listeners.get('keydown').fn(enter);
assert.equal(blurCount,1,'Enter must blur once so the canonical change handler commits');
assert.equal(input.value,'96','Enter must preserve the edited value');
assert.equal(enter.prevented,1,'Enter default form behavior must be suppressed');

input.value='64';
listeners.get('focusin').fn({target:input});
input.value='777';
const escape=event('Escape');
listeners.get('keydown').fn(escape);
assert.equal(blurCount,2,'Escape must exit the field once');
assert.equal(input.value,'64','Escape must restore the value captured on focus');
assert.equal(escape.prevented,1,'Escape must be consumed inside property editing');

const boundaryTab=event('Tab');
listeners.get('keydown').fn(boundaryTab);
assert.equal(boundaryTab.prevented,0,'Tab must remain native when there is no internal enabled-field destination');
assert.equal(blurCount,2,'boundary Tab must not force a parallel blur path');

controller.destroy();
assert.equal(listeners.has('focusin'),false,'destroy must remove focus listener');
assert.equal(listeners.has('keydown'),false,'destroy must remove keyboard listener');

const source=fs.readFileSync(new URL('../src/studio/input/studio-property-commit-controller.mjs',import.meta.url),'utf8');
assert.ok(!source.includes('KELO_WORLD_EDIT'),'controller must not access authority directly');
assert.ok(!source.includes('kernel.execute'),'controller must not create a parallel mutation path');
assert.ok(source.includes('input.blur'), 'persistence must delegate through the shell canonical blur/change path');

console.log('PASS studio property commit audit: Enter commits via canonical blur/change; Escape restores; internal Tab is stabilized with native boundary pass-through; no authority bypass.');
