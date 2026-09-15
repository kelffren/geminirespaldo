import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKeyboardHistoryController } from '../src/studio/input/studio-keyboard-history-controller.mjs';

const listeners=new Map();
let undoClicks=0,redoClicks=0;
const buttons={
  undo:{disabled:false,click(){undoClicks++;}},
  redo:{disabled:false,click(){redoClicks++;}}
};
const shell={querySelector(selector){
  const match=String(selector).match(/data-act="(undo|redo)"/);
  return match?buttons[match[1]]:null;
}};
const document={
  addEventListener(type,fn){listeners.set(type,fn);},
  removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
  querySelector(selector){assert.equal(selector,'#kelo-studio-live');return shell;}
};
const controller=createStudioKeyboardHistoryController({root:{document}});

function fire(key,{target={closest:()=>null},repeat=false,ctrlKey=false,metaKey=false,altKey=false,shiftKey=false,defaultPrevented=false}={}){
  let prevented=false,stopped=false;
  listeners.get('keydown')?.({key,target,repeat,ctrlKey,metaKey,altKey,shiftKey,defaultPrevented,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  return {prevented,stopped};
}

let state=fire('z',{ctrlKey:true});
assert.equal(undoClicks,1,'Ctrl+Z must delegate exactly once to canonical undo');
assert.equal(redoClicks,0);
assert.equal(state.prevented,true,'Handled undo must suppress browser behavior');
assert.equal(state.stopped,true,'Handled undo must stop competing Studio shortcuts');

state=fire('Z',{metaKey:true});
assert.equal(undoClicks,2,'Cmd+Z must share canonical undo');
assert.equal(state.prevented,true);

state=fire('z',{metaKey:true,shiftKey:true});
assert.equal(redoClicks,1,'Cmd+Shift+Z must delegate exactly once to canonical redo');
assert.equal(state.prevented,true);

state=fire('Z',{ctrlKey:true,shiftKey:true});
assert.equal(redoClicks,2,'Ctrl+Shift+Z must share canonical redo');
assert.equal(state.prevented,true);

state=fire('y',{ctrlKey:true});
assert.equal(redoClicks,3,'Ctrl+Y must support Windows-style redo');
assert.equal(state.prevented,true);

for(const options of [
  {ctrlKey:true,target:{closest:selector=>selector.includes('input')?{}:null}},
  {ctrlKey:true,altKey:true},
  {ctrlKey:true,repeat:true},
  {ctrlKey:true,defaultPrevented:true},
  {},
  {metaKey:true,shiftKey:true}
])fire(options.metaKey?'y':'z',options);
fire('y',{metaKey:true});
fire('y',{ctrlKey:true,shiftKey:true});
fire('x',{ctrlKey:true});
assert.equal(undoClicks,2,'Editable, modified, repeated, pre-handled or unrelated keys must not undo');
assert.equal(redoClicks,3,'Unsupported redo combinations must remain guarded');

buttons.undo.disabled=true;
state=fire('z',{ctrlKey:true});
assert.equal(undoClicks,2,'Disabled canonical undo must not be bypassed');
assert.equal(state.prevented,false,'Disabled undo must leave shortcut untouched');
buttons.undo.disabled=false;
buttons.redo.disabled=true;
state=fire('y',{ctrlKey:true});
assert.equal(redoClicks,3,'Disabled canonical redo must not be bypassed');
assert.equal(state.prevented,false,'Disabled redo must leave shortcut untouched');
buttons.redo.disabled=false;

controller.destroy();
assert.equal(listeners.has('keydown'),false,'destroy() must detach the capture listener');

const source=fs.readFileSync(new URL('../src/studio/input/studio-keyboard-history-controller.mjs',import.meta.url),'utf8');
const executable=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
assert.equal(/KELO_WORLD_EDIT\s*[.=\[]/.test(executable),false,'Keyboard history must not write authority directly');
assert.equal(executable.includes('kernel.execute('),false,'Keyboard history must delegate instead of creating a parallel command path');
assert.match(executable,/data-act=.*\$\{action\}/,'Controller must preserve canonical undo/redo delegation');

console.log('Studio keyboard history audit passed: Ctrl/Cmd+Z undo, Shift+Z/Ctrl+Y redo, guards, disabled state, teardown, authority isolation.');
