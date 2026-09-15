import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioFocusShortcutController, shouldHandleStudioFocusKey } from '../src/studio/input/studio-focus-shortcut-controller.mjs';

assert.equal(shouldHandleStudioFocusKey({key:'f'}),true,'F must frame the current selection');
assert.equal(shouldHandleStudioFocusKey({key:'F'}),true,'focus shortcut must be case-insensitive');
assert.equal(shouldHandleStudioFocusKey({key:'f',repeat:true}),false,'held F must not retrigger camera framing');
assert.equal(shouldHandleStudioFocusKey({key:'f',ctrlKey:true}),false,'modified shortcuts must remain available to the browser/editor');
assert.equal(shouldHandleStudioFocusKey({key:'f',metaKey:true}),false,'meta shortcuts must remain available');
assert.equal(shouldHandleStudioFocusKey({key:'f',target:{closest:()=>({})}}),false,'property inputs must not be hijacked');

const listeners=new Map();
let clicks=0,prevented=0,stopped=0;
const focusButton={disabled:false,click(){clicks++;}};
const document={
  addEventListener(type,fn,capture){listeners.set(`${type}:${capture}`,fn);},
  removeEventListener(type,fn,capture){if(listeners.get(`${type}:${capture}`)===fn)listeners.delete(`${type}:${capture}`);},
  querySelector(selector){assert.equal(selector,'#kelo-studio-live [data-act="focus"]');return focusButton;}
};
const controller=createStudioFocusShortcutController({root:{document}});
const keydown=listeners.get('keydown:true');
assert.equal(typeof keydown,'function','controller must install one captured key listener');
keydown({key:'f',target:{closest:()=>null},preventDefault(){prevented++;},stopPropagation(){stopped++;}});
assert.equal(clicks,1,'F must delegate exactly once to the existing focus button');
assert.equal(prevented,1,'handled focus must suppress browser find-like behavior');
assert.equal(stopped,1,'handled focus must not leak into gameplay input');
focusButton.disabled=true;
keydown({key:'f',target:{closest:()=>null},preventDefault(){prevented++;},stopPropagation(){stopped++;}});
assert.equal(clicks,1,'disabled existing focus action must remain authoritative');
assert.equal(prevented,1,'unhandled focus must not swallow keyboard input');
controller.destroy();
assert.equal(listeners.has('keydown:true'),false,'destroy must release the keyboard listener');

const source=fs.readFileSync(new URL('../src/studio/input/studio-focus-shortcut-controller.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(source,/\[data-act="focus"\]/,'shortcut must reuse the existing Studio focus action');
assert.match(source,/EDITABLE_SELECTOR/,'shortcut must protect direct property editing');
assert.doesNotMatch(source,/KeloCamera\.(?:setTarget|setBaseZoom)/,'shortcut must not invent a second camera-control path');
assert.doesNotMatch(source,/kernel\.execute\(/,'focus navigation must not create world commands');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'focus shortcut must remain authority-isolated');
assert.match(entry,/createStudioFocusShortcutController\(\{root\}\)/,'Studio boot must mount the focus shortcut');
assert.match(entry,/focusShortcutController\.destroy\(\)/,'Studio close must destroy the focus shortcut');
assert.match(entry,/kelo-studio-foundation-v1\.18\.0-focus-shortcut/,'Studio version must identify the cumulative focus shortcut improvement');

console.log(JSON.stringify({ok:true,key:'F',delegatesExistingFocus:true,editableSafe:true,repeatSafe:true,undoIsolated:true,authorityIsolated:true,cameraOwnerPreserved:true,lifecycleIntegrated:true,cleanup:true},null,2));
