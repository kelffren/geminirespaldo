import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioSelectionHistoryController, normalizeSelectionSnapshot, stepSelectionHistory, selectionHistoryNavState } from '../src/studio/input/studio-selection-history-controller.mjs';

assert.deepEqual(normalizeSelectionSnapshot(['tree-a','tree-a','rock-b','']),['tree-a','rock-b'],'selection snapshots must be stable, deduplicated and non-empty');
assert.deepEqual(normalizeSelectionSnapshot(null),[],'invalid selection snapshots must remain safe');

const history=[['tree-a'],['rock-b'],['tree-c','tree-d']];
assert.equal(stepSelectionHistory(history,2,-1),1,'back must move exactly one selection snapshot');
assert.equal(stepSelectionHistory(history,1,-1),0,'back must reach the oldest snapshot');
assert.equal(stepSelectionHistory(history,0,-1),0,'back must clamp at the oldest snapshot');
assert.equal(stepSelectionHistory(history,0,1),1,'forward must move exactly one selection snapshot');
assert.equal(stepSelectionHistory(history,2,1),2,'forward must clamp at the newest snapshot');
assert.equal(stepSelectionHistory([],0,-1),-1,'empty history must remain inert');
assert.deepEqual(selectionHistoryNavState([[]],0),{visible:false,canBack:false,canForward:false},'touch navigation must stay hidden until history exists');
assert.deepEqual(selectionHistoryNavState([[],['tree-a']],1),{visible:true,canBack:true,canForward:false},'latest snapshot must expose back and disable forward');
assert.deepEqual(selectionHistoryNavState([[],['tree-a'],['rock-b']],1),{visible:true,canBack:true,canForward:true},'middle snapshot must expose both directions');

const keyListeners=new Set();
const root={
  document:{getElementById:id=>id==='kelo-studio-live'?{}:null},
  addEventListener(type,fn){if(type==='keydown')keyListeners.add(fn);},
  removeEventListener(type,fn){if(type==='keydown')keyListeners.delete(fn);}
};
let selected=[];
const selectionListeners=new Set();
let unsubscribeCount=0;
const kernel={
  document:{entities:[{id:'tree-a'},{id:'rock-b'},{id:'tree-c'},{id:'tree-d'},{id:'lamp-e'}]},
  selection:{
    get:()=>[...selected],
    set(ids){selected=[...ids];for(const fn of selectionListeners)fn(selected);},
    onChange(fn){selectionListeners.add(fn);return()=>{unsubscribeCount++;selectionListeners.delete(fn);};}
  }
};
const choose=ids=>kernel.selection.set(ids);
const controller=createStudioSelectionHistoryController({root,kernel,maxHistory:4});
choose(['tree-a']);
choose(['rock-b']);
choose(['tree-c','tree-d']);
assert.equal(controller.size,4,'runtime history must include the initial empty selection and three distinct selections');
assert.equal(controller.back(),true,'runtime back navigation must move to the previous selection');
assert.deepEqual(selected,['rock-b'],'back must restore the prior selection exactly');
assert.equal(controller.forward(),true,'runtime forward navigation must restore the next selection');
assert.deepEqual(selected,['tree-c','tree-d'],'forward must restore grouped selection exactly');
assert.equal(controller.back(),true);
choose(['lamp-e']);
assert.equal(controller.forward(),false,'a new selection after back must invalidate stale forward history');
assert.deepEqual(selected,['lamp-e']);

choose(['tree-a']);
choose(['rock-b']);
kernel.document.entities=kernel.document.entities.filter(row=>row.id!=='tree-a');
assert.equal(controller.back(),true,'history must still navigate when an old entity was deleted');
assert.deepEqual(selected,[],'deleted entity ids must be filtered before restoring a snapshot');

let prevented=0;
const keyboardEvent=key=>({key,defaultPrevented:false,metaKey:false,ctrlKey:false,altKey:false,target:{closest:()=>null},preventDefault(){prevented++;},stopPropagation(){}});
choose(['rock-b']);
choose(['lamp-e']);
for(const listener of keyListeners)listener(keyboardEvent('['));
assert.deepEqual(selected,['rock-b'],'[ must navigate to the previous selection when Studio is mounted');
for(const listener of keyListeners)listener(keyboardEvent(']'));
assert.deepEqual(selected,['lamp-e'],'] must navigate to the next selection when Studio is mounted');
assert.equal(prevented,2,'handled keyboard navigation must suppress conflicting browser behavior');

controller.destroy();
assert.equal(keyListeners.size,0,'destroy must release the global keyboard listener');
assert.equal(selectionListeners.size,0,'destroy must release the selection subscription');
assert.equal(unsubscribeCount,1,'selection subscription must be released exactly once');

const source=fs.readFileSync(new URL('../src/studio/input/studio-selection-history-controller.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(source,/const MAX_HISTORY=40/,'selection history must stay bounded for long Studio sessions');
assert.match(source,/history=history\.slice\(0,index\+1\)/,'new selections after going back must discard stale forward history');
assert.match(source,/kernel\.selection\.set\(snapshot\)/,'history navigation must reuse the Studio selection owner');
assert.match(source,/kernel\.document\?\.entities/,'replay must filter ids against the live document');
assert.match(source,/key!==\s*'\['/u,'keyboard navigation must expose the previous-selection shortcut');
assert.match(source,/key!==\s*'\]'/u,'keyboard navigation must expose the next-selection shortcut');
assert.match(source,/data-ext|selection-history-nav/,'selection history must expose a dedicated compact touch control');
assert.match(source,/width:44px;height:44px/,'touch controls must retain a 44px minimum target');
assert.match(source,/Previous selection/,'touch navigation must provide an accessible back label');
assert.match(source,/Next selection/,'touch navigation must provide an accessible forward label');
assert.match(source,/nav\.hidden=!state\.visible/,'touch controls must stay visually clean until navigation is useful');
assert.match(source,/backButton\.disabled=!state\.canBack/,'back button must expose truthful disabled state');
assert.match(source,/forwardButton\.disabled=!state\.canForward/,'forward button must expose truthful disabled state');
assert.match(source,/EDITABLE_SELECTOR/,'selection history shortcuts must not hijack property editing');
assert.match(source,/unsubscribe\?\.\(\)/,'controller destroy must release the selection subscription');
assert.match(source,/nav\?\.remove\?\.\(\)/,'controller destroy must remove touch UI');
assert.doesNotMatch(source,/kernel\.execute\(/,'selection history must not create world commands or pollute undo');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection history must remain authority-isolated');
assert.match(entry,/createStudioSelectionHistoryController\(\{root,kernel\}\)/,'Studio boot must mount selection history against the live kernel');
assert.match(entry,/selectionHistoryController\.destroy\(\)/,'Studio close must destroy selection history');
assert.match(entry,/kelo-studio-foundation-v1\.17\.0-selection-history/,'Studio version must identify the cumulative selection-history foundation');

console.log(JSON.stringify({ok:true,bounded:true,branchingHistory:true,liveEntityFilter:true,keyboardBackForward:true,touchBackForward:true,touchTarget44px:true,accessible:true,editableSafe:true,undoIsolated:true,authorityIsolated:true,lifecycleIntegrated:true,cleanup:true},null,2));
