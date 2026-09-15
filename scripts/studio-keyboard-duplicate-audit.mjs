import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKeyboardDuplicateController } from '../src/studio/input/studio-keyboard-duplicate-controller.mjs';

const listeners=new Map();
let clicks=0;
const button={disabled:false,click(){clicks++;}};
const shell={querySelector(selector){assert.equal(selector,'[data-act="duplicate"]');return button;}};
const document={
  addEventListener(type,fn){listeners.set(type,fn);},
  removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
  querySelector(selector){assert.equal(selector,'#kelo-studio-live');return shell;}
};
let selection=['a'];
const kernel={selection:{get:()=>selection.slice()}};
const controller=createStudioKeyboardDuplicateController({root:{document},kernel});

function fire(key,{target={closest:()=>null},repeat=false,ctrlKey=false,metaKey=false,altKey=false,shiftKey=false,defaultPrevented=false}={}){
  let prevented=false,stopped=false;
  listeners.get('keydown')?.({key,target,repeat,ctrlKey,metaKey,altKey,shiftKey,defaultPrevented,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  return {prevented,stopped};
}

let state=fire('d',{ctrlKey:true});
assert.equal(clicks,1,'Ctrl+D must delegate exactly once to canonical duplicate');
assert.equal(state.prevented,true,'Handled Ctrl+D must suppress browser behavior');
assert.equal(state.stopped,true,'Handled Ctrl+D must stop competing Studio shortcuts');

state=fire('D',{metaKey:true});
assert.equal(clicks,2,'Cmd+D must share the canonical duplicate path');
assert.equal(state.prevented,true);

selection=[];
state=fire('d',{ctrlKey:true});
assert.equal(clicks,2,'Empty selection must not duplicate');
assert.equal(state.prevented,false,'Empty selection must not swallow browser shortcut');

selection=['a'];
fire('d',{ctrlKey:true,target:{closest:selector=>selector.includes('input')?{}:null}});
fire('d',{ctrlKey:true,altKey:true});
fire('d',{ctrlKey:true,shiftKey:true});
fire('d',{ctrlKey:true,repeat:true});
fire('d',{ctrlKey:true,defaultPrevented:true});
fire('x',{ctrlKey:true});
fire('d');
assert.equal(clicks,2,'Editable, modified, repeated, pre-handled or unrelated keys must remain guarded');

button.disabled=true;
state=fire('d',{ctrlKey:true});
assert.equal(clicks,2,'Disabled canonical duplicate must not be bypassed');
assert.equal(state.prevented,false,'Disabled canonical action must leave shortcut untouched');
button.disabled=false;

controller.destroy();
assert.equal(listeners.has('keydown'),false,'destroy() must detach the capture listener');

const source=fs.readFileSync(new URL('../src/studio/input/studio-keyboard-duplicate-controller.mjs',import.meta.url),'utf8');
const executable=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
assert.equal(/KELO_WORLD_EDIT\s*[.=\[]/.test(executable),false,'Keyboard duplicate must not write authority directly');
assert.equal(executable.includes('kernel.execute('),false,'Keyboard duplicate must delegate instead of creating a parallel mutation path');
assert.match(executable,/\[data-act=\\?"duplicate\\?"\]/,'Controller must preserve canonical duplicate delegation');

console.log('Studio keyboard duplicate audit passed: Ctrl/Cmd+D canonical delegation, guards, disabled state, teardown, authority isolation.');
