import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioExplorerRangeSelectionController} from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

const visibleIds=['a','c','e'];
let clickHandler=null,keyHandler=null;
const rows=visibleIds.map(id=>({
  dataset:{entity:id},
  closest(selector){return selector==='#kelo-studio-live [data-entity]'?this:null;},
  getAttribute(){return '-1';},
  focus(){},
  scrollIntoView(){}
}));
const document={
  addEventListener(type,fn,capture){
    if(capture!==true)return;
    if(type==='click')clickHandler=fn;
    if(type==='keydown')keyHandler=fn;
  },
  removeEventListener(){},
  querySelectorAll(selector){return selector==='#kelo-studio-live [data-entity]'?rows:[];}
};
let selection=['a'],setCount=0;
const kernel={
  document:{entities:['a','b','c','d','e'].map(id=>({id}))},
  selection:{get:()=>selection.slice(),set(next){selection=next.map(String);setCount++;}}
};
createStudioExplorerRangeSelectionController({root:{document},kernel});
const click=(row,extra={})=>({
  target:row,defaultPrevented:false,shiftKey:false,ctrlKey:false,metaKey:false,
  prevented:0,stopped:0,
  preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extra
});

clickHandler(click(rows[0]));
const ranged=click(rows[2],{shiftKey:true});
clickHandler(ranged);
assert.deepEqual(selection,visibleIds,'Shift+click must select only visible Explorer rows and skip filtered document entities');
assert.equal(setCount,1,'visible range selection should write once');
assert.equal(ranged.prevented,1,'handled Shift+click must suppress competing selection handlers');
assert.equal(ranged.stopped,1,'handled Shift+click must remain isolated from other Studio handlers');
assert.ok(!selection.includes('b')&&!selection.includes('d'),'filtered-out entities must never leak into a plain Shift range');

selection=['b'];
clickHandler(click(rows[0]));
const append=click(rows[2],{shiftKey:true,ctrlKey:true});
clickHandler(append);
assert.deepEqual(selection,['b','a','c','e'],'Ctrl/Cmd+Shift range must retain explicitly selected hidden rows while adding only the visible range');

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');
assert.match(source,/ids:visibleEntityIds\(\)/,'Shift+click must resolve its range from visible Explorer rows');
assert.doesNotMatch(source,/ids:entityIds\(\)/,'Shift+click must not regress to full-document range resolution');
assert.doesNotMatch(source,/kernel\.execute|KELO_WORLD_EDIT/,'Explorer range selection must remain selection-only and never bypass CommandBus\/authority');
assert.equal(typeof keyHandler,'function','keyboard navigation must remain registered after the change');

console.log(JSON.stringify({ok:true,visibleRows:visibleIds.length,documentEntities:5,filteredEntitiesSkipped:2,plainShiftRange:selection.length,authorityBypass:false},null,2));
