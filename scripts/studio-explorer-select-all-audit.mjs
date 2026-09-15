import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioExplorerRangeSelectionController} from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

const ids=['a','b','c','d'];
let keyHandler=null;
const rows=ids.map(id=>({dataset:{entity:id},closest(selector){return selector==='#kelo-studio-live [data-entity]'?this:null;},getAttribute(){return '-1';},focus(){},scrollIntoView(){}}));
const outside={closest(){return null;}};
const document={
 addEventListener(type,fn,capture){if(type==='keydown'&&capture===true)keyHandler=fn;},
 removeEventListener(){},
 querySelectorAll(selector){return selector==='#kelo-studio-live [data-entity]'?rows:[];}
};
let selection=['b'],setCount=0;
const kernel={document:{entities:ids.map(id=>({id}))},selection:{get:()=>selection.slice(),set(next){selection=next.map(String);setCount++;}}};
createStudioExplorerRangeSelectionController({root:{document},kernel});
const event=(target,extra={})=>({target,key:'a',defaultPrevented:false,ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,prevented:0,stopped:0,preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extra});

const ctrl=event(rows[1]);
keyHandler(ctrl);
assert.deepEqual(selection,ids,'Ctrl+A from a focused Explorer row must select every visible row in Explorer order');
assert.equal(ctrl.prevented,1,'context select-all must suppress browser select-all');
assert.equal(ctrl.stopped,1,'context select-all must stay isolated from other Studio keyboard handlers');
assert.equal(setCount,1,'context select-all should write selection exactly once');

const repeat=event(rows[1]);
keyHandler(repeat);
assert.equal(setCount,1,'already-selected visible rows must not trigger a redundant selection update');
assert.equal(repeat.prevented,1,'already-complete context select-all must still consume browser select-all');

selection=['b'];
const cmd=event(rows[1],{ctrlKey:false,metaKey:true});
keyHandler(cmd);
assert.deepEqual(selection,ids,'Cmd+A must provide the same visible Explorer selection on macOS');

selection=['b'];
const shifted=event(rows[1],{shiftKey:true});
const beforeShift=setCount;
keyHandler(shifted);
assert.equal(setCount,beforeShift,'Shift+Ctrl/Cmd+A must remain reserved');
assert.equal(shifted.prevented,0,'reserved modified select-all must not be consumed');

const elsewhere=event(outside);
const beforeOutside=setCount;
keyHandler(elsewhere);
assert.equal(setCount,beforeOutside,'Ctrl/Cmd+A outside Explorer rows must not mutate Studio selection');
assert.equal(elsewhere.prevented,0,'Ctrl/Cmd+A outside Explorer must remain native');

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/kernel\.execute|KELO_WORLD_EDIT/,'Explorer select-all must remain local-only and must not bypass CommandBus/authority');
assert.match(source,/kernel\.selection\.set\(ids\)/,'Explorer select-all must use the canonical local selection store');
console.log('PASS studio explorer contextual select-all audit');
