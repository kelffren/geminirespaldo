import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveExplorerNavigationIndex, createStudioExplorerRangeSelectionController } from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

const length=35;
assert.equal(resolveExplorerNavigationIndex({index:0,length,key:'PageDown'}),10,'PageDown should advance ten visible rows');
assert.equal(resolveExplorerNavigationIndex({index:10,length,key:'PageDown'}),20,'repeated PageDown should keep advancing by ten rows');
assert.equal(resolveExplorerNavigationIndex({index:30,length,key:'PageDown'}),34,'PageDown should clamp to the last visible row');
assert.equal(resolveExplorerNavigationIndex({index:20,length,key:'PageUp'}),10,'PageUp should move back ten visible rows');
assert.equal(resolveExplorerNavigationIndex({index:5,length,key:'PageUp'}),0,'PageUp should clamp to the first visible row');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'ArrowDown'}),18,'ArrowDown must retain one-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'ArrowUp'}),16,'ArrowUp must retain one-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'Home'}),0,'Home must retain first-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'End'}),34,'End must retain last-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:0,length:0,key:'PageDown'}),-1,'empty Explorer navigation should remain a no-op sentinel');

const ids=Array.from({length:25},(_,index)=>`entity-${index}`);
let keyHandler=null,clickHandler=null,selection=['entity-4'];
const sets=[];
const rows=ids.map(id=>({
  dataset:{entity:id},
  closest(selector){return selector==='#kelo-studio-live [data-entity]'?this:null;},
  getAttribute(){return '-1';},setAttribute(){},focus(){},scrollIntoView(){this.scrolled=(this.scrolled||0)+1;}
}));
const document={
  addEventListener(type,fn,capture){if(type==='keydown'&&capture===true)keyHandler=fn;if(type==='click'&&capture===true)clickHandler=fn;},
  removeEventListener(){},
  querySelectorAll(selector){return selector==='#kelo-studio-live [data-entity]'?rows:[];}
};
const kernel={document:{entities:ids.map(id=>({id}))},selection:{get:()=>selection.slice(),set(next){selection=next.map(String);sets.push(selection.slice());}}};
const controller=createStudioExplorerRangeSelectionController({root:{document},kernel});
const event=(index,key,extra={})=>({target:rows[index],key,defaultPrevented:false,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,prevented:0,stopped:0,preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extra});

const down=event(4,'PageDown');
keyHandler(down);
assert.deepEqual(sets.at(-1),['entity-14'],'PageDown must select the row ten visible positions ahead');
assert.equal(down.prevented,1,'PageDown must suppress browser page scrolling');
assert.equal(down.stopped,1,'PageDown must not leak into other Studio handlers');
assert.equal(rows[14].scrolled,1,'PageDown must keep the destination row visible');

selection=['entity-4'];
clickHandler({target:rows[4],defaultPrevented:false,shiftKey:false,ctrlKey:false,metaKey:false,preventDefault(){},stopImmediatePropagation(){}});
const shiftDown=event(4,'PageDown',{shiftKey:true});
keyHandler(shiftDown);
assert.deepEqual(sets.at(-1),ids.slice(4,15),'Shift+PageDown must extend one anchored contiguous range by ten visible rows');

const shiftUp=event(14,'PageUp',{shiftKey:true});
keyHandler(shiftUp);
assert.deepEqual(sets.at(-1),['entity-4'],'Shift+PageUp must shrink the range back to its anchor');
controller.destroy();

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');
assert.match(source,/PAGE_STEP=10/,'paged navigation must keep a deterministic ten-row step');
assert.match(source,/PageUp','PageDown/,'Explorer keyboard handler must accept PageUp/PageDown');
assert.match(source,/resolveExplorerNavigationIndex\(\{index,length:rows\.length,key:event\.key\}\)/,'live Explorer navigation must use the tested resolver');
assert.match(source,/kernel\.selection\.set/,'paged navigation must use the canonical local selection store');
assert.doesNotMatch(source,/kernel\.execute/,'paged navigation must not create document commands');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'paged navigation must not write through world authority');
assert.match(source,/stopImmediatePropagation/,'Explorer navigation must stay isolated from world nudge handlers');

console.log(JSON.stringify({ok:true,pageStep:10,pageUp:true,pageDown:true,livePageDown:true,shiftRangeCompatible:true,commandBusWrites:0,authorityWrites:0},null,2));
