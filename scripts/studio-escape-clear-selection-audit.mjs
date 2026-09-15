import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioSelectAllController } from '../src/studio/input/studio-select-all-controller.mjs';

let keyHandler=null;
let selection=['entity-a','entity-b'];
const sets=[];
const studio={};
const document={
  addEventListener(type,fn){if(type==='keydown')keyHandler=fn;},
  removeEventListener(type,fn){if(type==='keydown'&&keyHandler===fn)keyHandler=null;},
  getElementById(id){return id==='kelo-studio-live'?studio:null;}
};
const kernel={
  document:{entities:[{id:'entity-a'},{id:'entity-b'}]},
  selection:{get:()=>selection.slice(),set(next){selection=next.map(String);sets.push(selection.slice());}}
};
const controller=createStudioSelectAllController({root:{document},kernel});
const makeEvent=(extra={})=>({
  key:'Escape',defaultPrevented:false,repeat:false,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false,
  target:{closest(){return null;}},prevented:0,preventDefault(){this.prevented++;},...extra
});

const escape=makeEvent();
keyHandler(escape);
assert.deepEqual(selection,[],'Escape must clear an active Studio selection');
assert.equal(escape.prevented,1,'handled Escape must suppress browser/default behavior');
assert.deepEqual(sets,[[]],'Escape must perform one local selection update');

selection=[];sets.length=0;
const emptyEscape=makeEvent();
keyHandler(emptyEscape);
assert.equal(emptyEscape.prevented,0,'Escape with no selection must remain a no-op');
assert.equal(sets.length,0,'empty Escape must not emit redundant selection updates');

selection=['entity-a'];sets.length=0;
const consumed=makeEvent({defaultPrevented:true});
keyHandler(consumed);
assert.deepEqual(selection,['entity-a'],'Escape already consumed by another UI must not clear selection');
assert.equal(sets.length,0,'consumed Escape must not write selection state');

const editable=makeEvent({target:{closest(selector){return selector.includes('input')?{}:null;}}});
keyHandler(editable);
assert.deepEqual(selection,['entity-a'],'Escape inside an editable control must not clear selection');

controller.destroy();
assert.equal(keyHandler,null,'destroy must detach the Escape keyboard handler');

const source=fs.readFileSync(new URL('../src/studio/input/studio-select-all-controller.mjs',import.meta.url),'utf8');
assert.match(source,/event\.key==='Escape'/,'controller must explicitly own the Escape clear-selection path');
assert.match(source,/kernel\.selection\.set\(\[\]\)/,'Escape clear must use the canonical local selection store');
assert.doesNotMatch(source,/kernel\.execute/,'Escape clear must not create document commands');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'Escape clear must not write through world authority');

console.log(JSON.stringify({ok:true,escapeClearsSelection:true,emptyNoop:true,respectsConsumedEscape:true,respectsEditable:true,commandBusWrites:0,authorityWrites:0},null,2));
