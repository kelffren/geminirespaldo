import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMarqueeSelectTool } from '../src/studio/tools/marquee-select-tool.mjs';

const rows=[
  {id:'inside',rect:{x:20,y:20,w:20,h:20}},
  {id:'edge',rect:{x:90,y:20,w:30,h:20}},
  {id:'outside',rect:{x:130,y:20,w:20,h:20}}
];
const selection={value:[],setCalls:0,addCalls:0,get(){return [...this.value];},set(ids){this.setCalls++;this.value=[...ids];},add(id){this.addCalls++;if(!this.value.includes(id))this.value.push(id);}};
const kernel={spatial:{queryRect(){return rows.filter(row=>row.id!=='outside');}},selection};
const tool=createMarqueeSelectTool(kernel);

tool.begin(0,0);tool.move(100,100);
assert.deepEqual(tool.commit(),['inside'],'left-to-right marquee must require full containment');
assert.deepEqual(selection.value,['inside'],'plain marquee must still replace selection');

tool.begin(100,0);tool.move(0,100);
assert.deepEqual(tool.commit(),['inside','edge'],'right-to-left marquee must include crossing entities');
assert.deepEqual(selection.value,['inside','edge'],'plain crossing marquee must still replace selection');

selection.value=['prior','inside'];
selection.setCalls=0;selection.addCalls=0;
tool.begin(0,0,{append:true});tool.move(100,100);
assert.deepEqual(tool.commit(),['inside'],'toggle enclosure must preserve directional semantics');
assert.deepEqual(selection.value,['prior'],'Shift-marquee must remove hits that were selected when the gesture began');
assert.equal(selection.setCalls,1,'toggle marquee must publish one atomic selection update');
assert.equal(selection.addCalls,0,'toggle marquee must not emit one selection update per matched entity');
assert.equal(tool.active,false,'commit must clear transient marquee state');

tool.begin(0,0,{append:true});tool.move(100,100);
assert.deepEqual(tool.commit(),['inside'],'repeated toggle must hit the same enclosed entity');
assert.deepEqual(selection.value,['prior','inside'],'repeating the same Shift-marquee must add the removed hit back');

selection.value=['prior','inside'];
tool.begin(0,0,{append:true});
selection.value=['transient-change'];
tool.move(100,100);tool.commit();
assert.deepEqual(selection.value,['prior'],'toggle must resolve against the selection snapshot from pointer-down, not a moving selection target');

const largeRows=Array.from({length:1200},(_,i)=>({id:`entity-${i}`,rect:{x:i%30,y:Math.floor(i/30),w:1,h:1}}));
const largeSelection={
  value:Array.from({length:300},(_,i)=>`prior-${i}`),setCalls:0,addCalls:0,
  get(){return [...this.value];},
  set(ids){this.setCalls++;this.value=[...ids];},
  add(){this.addCalls++;}
};
const largeTool=createMarqueeSelectTool({spatial:{queryRect(){return largeRows;}},selection:largeSelection});
largeTool.begin(0,0,{append:true});largeTool.move(100,100);
assert.equal(largeTool.commit().length,1200,'large marquee fixture must select every matched entity');
assert.equal(largeSelection.setCalls,1,'1,200 toggled entities must still produce exactly one selection write');
assert.equal(largeSelection.addCalls,0,'large toggle must avoid per-entity selection.add emissions');
assert.equal(largeSelection.value.length,1500,'large toggle must retain non-hit prior selection and add all new unique entities');
assert.deepEqual(largeSelection.value.slice(0,3),['prior-0','prior-1','prior-2'],'atomic toggle must preserve surviving prior selection order');
assert.deepEqual(largeSelection.value.slice(300,303),['entity-0','entity-1','entity-2'],'atomic toggle must preserve spatial result order for new entities');

const source=fs.readFileSync(new URL('../src/studio/tools/marquee-select-tool.mjs',import.meta.url),'utf8');
assert.match(source,/crossing=state\.x1<state\.x0/,'horizontal drag direction must choose crossing vs enclosure semantics');
assert.match(source,/rows\.filter\(row=>contained\(row,box\)\)/,'enclosure mode must filter to fully-contained entities');
assert.match(source,/kernel\.spatial\.queryRect/,'marquee must keep using the spatial index');
assert.match(source,/toggledFrom=append\?\[\.\.\.\(kernel\.selection\.get/,'toggle mode must snapshot ordered selection when the gesture begins');
assert.match(source,/kernel\.selection\.set\(next\)/,'toggle must publish one atomic selection replacement');
assert.doesNotMatch(source,/kernel\.selection\.add/,'marquee toggle must not create per-entity selection emissions');
assert.doesNotMatch(source,/kernel\.execute/,'selection must remain outside CommandBus history');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection must not write authority directly');

console.log(JSON.stringify({ok:true,directionalMarquee:true,leftToRight:'enclosure',rightToLeft:'crossing',shiftMarquee:'toggle',repeatGestureRestores:true,gestureSnapshot:true,atomicToggle:true,largeFixture:{matched:1200,prior:300,selectionWrites:largeSelection.setCalls},spatialIndex:true,localOnly:true},null,2));
