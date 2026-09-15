import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolveStudioSnapCycle,createStudioSnapCycleController,STUDIO_SNAP_STEPS} from '../src/studio/input/studio-snap-cycle-controller.mjs';

const source=fs.readFileSync(new URL('../src/studio/input/studio-snap-cycle-controller.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');

assert.deepEqual(STUDIO_SNAP_STEPS,[1,8,16,32,64]);
assert.equal(resolveStudioSnapCycle(1,1),8);
assert.equal(resolveStudioSnapCycle(8,1),16);
assert.equal(resolveStudioSnapCycle(64,1),1);
assert.equal(resolveStudioSnapCycle(1,-1),64);
assert.equal(resolveStudioSnapCycle(32,-1),16);
assert.equal(resolveStudioSnapCycle(12,1),16);
assert.equal(resolveStudioSnapCycle(12,-1),8);

let keydown=null,changes=0,removed=false;
class FakeEvent{constructor(type,options={}){this.type=type;this.bubbles=!!options.bubbles;}}
const select={value:'8',disabled:false,dispatchEvent(event){if(event.type==='change'&&event.bubbles)changes++;}};
const document={
  addEventListener(type,fn,capture){assert.equal(type,'keydown');assert.equal(capture,true);keydown=fn;},
  removeEventListener(type,fn,capture){assert.equal(type,'keydown');assert.equal(fn,keydown);assert.equal(capture,true);removed=true;},
  querySelector(selector){assert.equal(selector,'#kelo-studio-live [data-ext="snap"]');return select;}
};
const root={document,Event:FakeEvent};
const controller=createStudioSnapCycleController({root});

const event=(key,extra={})=>({key,defaultPrevented:false,repeat:false,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false,getModifierState:()=>false,target:{closest:()=>null},prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
let e=event(']');keydown(e);assert.equal(select.value,'16');assert.equal(changes,1);assert.equal(e.prevented,true);assert.equal(e.stopped,true);
e=event('[');keydown(e);assert.equal(select.value,'8');assert.equal(changes,2);
select.value='64';e=event(']');keydown(e);assert.equal(select.value,'1');assert.equal(changes,3);
select.value='8';e=event(']',{ctrlKey:true,altKey:true,getModifierState:name=>name==='AltGraph'});keydown(e);assert.equal(select.value,'16');assert.equal(changes,4);assert.equal(e.prevented,true);

for(const blocked of [
  event(']',{repeat:true}),event(']',{ctrlKey:true}),event(']',{metaKey:true}),event(']',{altKey:true}),event(']',{shiftKey:true}),event(']',{defaultPrevented:true}),
  event(']',{target:{closest:()=>({tagName:'INPUT'})}}),event('x')
]){const before=changes;keydown(blocked);assert.equal(changes,before);}
select.disabled=true;const disabled=event(']');keydown(disabled);assert.equal(changes,4);assert.equal(disabled.prevented,false);select.disabled=false;

controller.destroy();assert.equal(removed,true);
assert.match(entry,/createStudioSnapCycleController/);
assert.match(entry,/snapCycleController=createStudioSnapCycleController/);
assert.match(entry,/snapCycleController\.destroy\(\)/);
assert.match(entry,/v1\.28\.0-snap-cycle/);
assert.ok(!source.includes('KELO_WORLD_EDIT.')&&!source.includes('kernel.execute('),'snap cycling must not mutate authority or CommandBus');

console.log('PASS studio snap cycle audit');
