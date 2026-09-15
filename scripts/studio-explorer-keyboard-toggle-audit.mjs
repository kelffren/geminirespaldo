import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioExplorerRangeSelectionController} from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

let keyHandler=null;
const makeRow=id=>({
  dataset:{entity:id},
  closest(selector){return selector==='#kelo-studio-live [data-entity]'?this:null;},
  getAttribute(){return '-1';},
  focus(){},
  scrollIntoView(){}
});
const rows=['a','b','c'].map(makeRow);
const document={
  addEventListener(type,fn,capture){if(type==='keydown'&&capture===true)keyHandler=fn;},
  removeEventListener(){},
  querySelectorAll(selector){return selector==='#kelo-studio-live [data-entity]'?rows:[];}
};
let selection=['a','c'],writes=0;
const kernel={selection:{get:()=>selection.slice(),set(next){selection=next.map(String);writes++;}}};
const controller=createStudioExplorerRangeSelectionController({root:{document},kernel});
assert.equal(typeof keyHandler,'function','Explorer keyboard handler must register');

const key=(row,extra={})=>({
  target:row,key:' ',code:'Space',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false,
  prevented:0,stopped:0,
  preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extra
});

const add=key(rows[1]);
keyHandler(add);
assert.deepEqual(selection,['a','c','b'],'Ctrl/Cmd+Space must append the focused unselected row without replacing existing selection');
assert.equal(writes,1,'toggle-on should write selection once');
assert.equal(add.prevented,1,'handled toggle must suppress browser scrolling');
assert.equal(add.stopped,1,'handled toggle must remain isolated from competing Studio handlers');
assert.equal(controller.anchor,'b','keyboard toggle must move the range anchor to the focused row');

const remove=key(rows[1],{ctrlKey:false,metaKey:true});
keyHandler(remove);
assert.deepEqual(selection,['a','c'],'Ctrl/Cmd+Space must remove the focused selected row while preserving the rest');
assert.equal(writes,2,'toggle-off should write selection once');
assert.equal(remove.prevented,1);
assert.equal(remove.stopped,1);

const plainSpace=key(rows[0],{ctrlKey:false,metaKey:false});
keyHandler(plainSpace);
assert.deepEqual(selection,['a','c'],'plain Space must remain available to existing/global behavior');
assert.equal(writes,2,'plain Space must not mutate Explorer selection');
assert.equal(plainSpace.prevented,0,'plain Space must not be captured by this controller');

const shifted=key(rows[0],{shiftKey:true});
keyHandler(shifted);
assert.deepEqual(selection,['a','c'],'Ctrl/Cmd+Shift+Space must stay reserved');
assert.equal(writes,2,'reserved modified Space must not mutate selection');

const escape=key(rows[0],{key:'Escape',code:'Escape',ctrlKey:false,metaKey:false,shiftKey:false});
keyHandler(escape);
assert.deepEqual(selection,[],'Escape must clear the current Explorer selection');
assert.equal(writes,3,'Escape must clear selection with exactly one local selection write');
assert.equal(escape.prevented,1,'handled Escape must suppress competing browser/global handling');
assert.equal(escape.stopped,1,'handled Escape must stay isolated from competing Studio handlers');
assert.equal(controller.anchor,null,'Escape must reset the range anchor so the next Shift range starts fresh');

const emptyEscape=key(rows[0],{key:'Escape',code:'Escape',ctrlKey:false,metaKey:false,shiftKey:false});
keyHandler(emptyEscape);
assert.equal(writes,3,'Escape on an already-empty selection must be a no-op');
assert.equal(emptyEscape.prevented,0,'empty Escape must remain available to higher-level UI such as panel dismissal');
assert.equal(emptyEscape.stopped,0,'empty Escape must not block higher-level UI');

selection=['a'];
const modifiedEscape=key(rows[0],{key:'Escape',code:'Escape',ctrlKey:false,metaKey:false,shiftKey:true});
keyHandler(modifiedEscape);
assert.deepEqual(selection,['a'],'modified Escape must remain reserved');
assert.equal(writes,3,'modified Escape must not write selection state');
assert.equal(modifiedEscape.prevented,0,'modified Escape must not be captured');

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');
assert.match(source,/command&&\(event\.key===' '\|\|event\.code==='Space'\)&&!event\.shiftKey/,'controller must keep the keyboard toggle scoped to command+Space');
assert.match(source,/event\.key==='Escape'&&!command&&!event\.shiftKey/,'Explorer deselection must stay scoped to plain Escape');
assert.doesNotMatch(source,/kernel\.execute|KELO_WORLD_EDIT/,'Explorer keyboard selection controls must remain selection-only and never bypass CommandBus/authority');

console.log(JSON.stringify({ok:true,keyboardToggle:true,escapeClear:true,emptyEscapePassThrough:true,nonContiguousSelection:true,writes,authorityBypass:false},null,2));
