import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioExplorerRevealController, explorerRevealScrollTop } from '../src/studio/input/studio-explorer-reveal-controller.mjs';

assert.equal(explorerRevealScrollTop({index:0,scrollTop:120,viewportHeight:138}),0,'selection above the viewport must reveal upward');
assert.equal(explorerRevealScrollTop({index:10,scrollTop:0,viewportHeight:138}),376,'selection below the viewport must reveal with a small edge pad');
assert.equal(explorerRevealScrollTop({index:2,scrollTop:80,viewportHeight:150}),80,'already-visible rows must not move the Explorer');
assert.equal(explorerRevealScrollTop({index:10,scrollTop:77,viewportHeight:0}),77,'hidden/zero-height Explorer panes must not be force-scrolled');

const makeViewport=({scrollTop=0,clientHeight=138}={})=>({
  scrollTop,clientHeight,scrollEvents:0,
  dispatchEvent(){this.scrollEvents++;}
});
const desktop=makeViewport(),mobile=makeViewport({clientHeight:92});
const shell={querySelectorAll:selector=>selector==='.ks-explorer'?[desktop,mobile]:[]};
let raf=null,rafCancelCount=0;
const document={querySelector:selector=>selector==='#kelo-studio-live'?shell:null};
const root={document,requestAnimationFrame(fn){raf=fn;return 17;},cancelAnimationFrame(id){if(id===17)rafCancelCount++;}};
let selection=[];
const listeners=new Set();
let unsubscribeCount=0;
const kernel={
  document:{entities:Array.from({length:20},(_,index)=>({id:`entity-${index}`}))},
  selection:{
    get:()=>[...selection],
    onChange(fn){listeners.add(fn);return()=>{unsubscribeCount++;listeners.delete(fn);};},
    set(ids){selection=[...ids];for(const fn of listeners)fn(selection);}
  }
};

const controller=createStudioExplorerRevealController({root,kernel});
kernel.selection.set(['entity-10']);
assert.equal(typeof raf,'function','selection changes must defer reveal until the UI has rendered its virtual rows');
raf();raf=null;
assert.equal(desktop.scrollTop,376,'desktop Explorer must reveal the selected virtual row');
assert.equal(mobile.scrollTop,422,'mobile Explorer must reveal the same selected row using its own viewport height');
assert.equal(desktop.scrollEvents,1,'scrolling must notify the existing virtual renderer exactly once');
assert.equal(mobile.scrollEvents,1,'mobile virtual renderer must receive the reveal scroll');

kernel.selection.set(['entity-10']);
assert.equal(raf,null,'identical selection snapshots must not schedule redundant reveal work');
kernel.selection.set(['entity-2','entity-15']);
assert.equal(typeof raf,'function','multi-selection changes must schedule one reveal');
raf();raf=null;
assert.equal(desktop.scrollTop,606,'the latest selection anchor must be revealed for grouped selections');
assert.equal(mobile.scrollTop,652,'grouped selection anchor must also be visible on mobile');

controller.destroy();
assert.equal(listeners.size,0,'destroy must release selection subscription');
assert.equal(unsubscribeCount,1,'selection subscription must be released exactly once');
assert.equal(rafCancelCount,0,'completed reveal work must not leave an animation frame behind');

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-reveal-controller.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(source,/const ROW_HEIGHT=46/,'reveal math must stay aligned with the existing virtual Explorer row height');
assert.match(source,/selected\[selected\.length-1\]/,'multi-selection must use the latest selection anchor');
assert.match(source,/requestAnimationFrame/,'reveal must wait for the current virtualized UI render before scrolling');
assert.match(source,/viewport\.clientHeight/,'desktop and mobile panes must use their actual viewport size');
assert.match(source,/dispatchEvent\?\.\(new Event\('scroll'\)\)/,'reveal must reuse the existing scroll-driven virtual renderer');
assert.doesNotMatch(source,/kernel\.execute\(/,'Explorer reveal must not create world commands or pollute Undo');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'Explorer reveal must remain authority-isolated');
assert.doesNotMatch(source,/setCamera|camera\.(?:x|y|zoom)|camera\s*=|KELO_CAMERA/,'Explorer reveal must not mutate the world camera');
assert.doesNotMatch(source,/createStudioExplorerRangeSelectionController/,'Explorer reveal must not mount a second range-selection listener');
assert.match(entry,/createStudioExplorerRevealController\(\{root,kernel\}\)/,'Studio boot must mount Explorer reveal against the live kernel');
assert.match(entry,/explorerRevealController\.destroy\(\)/,'Studio close must release Explorer reveal');
assert.match(entry,/version: 'kelo-studio-foundation-v\d+\.\d+\.\d+[-\w]*'/,'Studio entry must expose a current versioned foundation session');

console.log(JSON.stringify({ok:true,desktopReveal:true,mobileReveal:true,virtualized:true,noRedundantReveal:true,multiSelectionAnchor:true,singleRangeOwner:true,undoIsolated:true,authorityIsolated:true,cameraIsolated:true,lifecycleIntegrated:true},null,2));
