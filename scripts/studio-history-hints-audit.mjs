import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioHistoryHints} from '../src/studio/ui/studio-history-hints.mjs';

const source=fs.readFileSync(new URL('../src/studio/ui/studio-history-hints.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');

assert.match(source,/history\?\.inspect\?\.\(\)/,'history hints must read canonical history metadata');
assert.match(source,/canUndo:undo\.length>0/,'undo availability must derive from canonical history depth');
assert.match(source,/canRedo:redo\.length>0/,'redo availability must derive from canonical history depth');
assert.match(source,/button\.disabled=!available/,'empty history actions must be natively disabled');
assert.match(source,/setAttribute\('aria-disabled',String\(!available\)\)/,'availability must be exposed accessibly');
assert.match(source,/dataset\.historyAvailable/,'availability must be exposed for shell styling/debugging');
assert.doesNotMatch(source,/kernel\.execute/,'history hints must not mutate the world');
assert.doesNotMatch(source,/history\.undo\(/,'history hints must not invoke undo');
assert.doesNotMatch(source,/history\.redo\(/,'history hints must not invoke redo');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'history hints must not write authority');

function fakeButton(){
  return{title:'',disabled:false,dataset:{},attrs:{},setAttribute(name,value){this.attrs[name]=String(value);}};
}
const undoButton=fakeButton(),redoButton=fakeButton();
let state={undo:[],redo:[]};
const document={
  documentElement:{},
  querySelectorAll(selector){
    if(selector==='[data-act="undo"]')return[undoButton];
    if(selector==='[data-act="redo"]')return[redoButton];
    return[];
  }
};
const kernel={history:{inspect:()=>state},commands:{on:()=>()=>{}}};
const hints=createStudioHistoryHints({root:{document},kernel});

assert.equal(undoButton.disabled,true,'undo must be disabled with an empty undo stack');
assert.equal(redoButton.disabled,true,'redo must be disabled with an empty redo stack');
assert.equal(undoButton.attrs['aria-disabled'],'true');
assert.equal(redoButton.attrs['aria-disabled'],'true');
assert.equal(undoButton.title,'Nada que deshacer');
assert.equal(redoButton.title,'Nada que rehacer');

state={undo:['Mover objeto'],redo:[]};
hints.refresh();
assert.equal(undoButton.disabled,false,'undo must enable as soon as an undo action exists');
assert.equal(undoButton.attrs['aria-disabled'],'false');
assert.equal(undoButton.title,'Deshacer: Mover objeto');
assert.equal(undoButton.dataset.historyAvailable,'true');
assert.equal(redoButton.disabled,true);

state={undo:[],redo:['Mover objeto']};
hints.refresh();
assert.equal(undoButton.disabled,true);
assert.equal(redoButton.disabled,false,'redo must enable as soon as a redo action exists');
assert.equal(redoButton.attrs['aria-disabled'],'false');
assert.equal(redoButton.title,'Rehacer: Mover objeto');
assert.equal(redoButton.dataset.historyAvailable,'true');
hints.destroy();

assert.match(entry,/createStudioHistoryHints/,'Studio entry must install history hints');
assert.match(entry,/historyHints=createStudioHistoryHints\(\{root,kernel\}\)/,'history hints must use the existing kernel');
assert.match(entry,/historyHints\.destroy\(\)/,'Studio close must release history hints');

console.log(JSON.stringify({ok:true,emptyActionsDisabled:true,liveAvailability:true,ariaDisabled:true,contextualLabels:true,commandBusReadOnly:true,authorityUntouched:true},null,2));
