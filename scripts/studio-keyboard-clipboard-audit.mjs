import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKeyboardClipboardController } from '../src/studio/input/studio-keyboard-clipboard-controller.mjs';

const listeners=new Map();
let copyClicks=0,pasteClicks=0;
const copy={disabled:false,click(){copyClicks++;}};
const paste={disabled:false,click(){pasteClicks++;}};
const shell={querySelector(selector){
  if(selector==='[data-ext="copy"]')return copy;
  if(selector==='[data-ext="paste"]')return paste;
  throw new Error(`unexpected selector ${selector}`);
}};
const document={
  addEventListener(type,fn){listeners.set(type,fn);},
  removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
  querySelector(selector){assert.equal(selector,'#kelo-studio-live');return shell;}
};
const controller=createStudioKeyboardClipboardController({root:{document}});

function fire(key,{target={closest:()=>null},repeat=false,ctrlKey=false,metaKey=false,altKey=false,shiftKey=false,defaultPrevented=false}={}){
  let prevented=false,stopped=false;
  listeners.get('keydown')?.({key,target,repeat,ctrlKey,metaKey,altKey,shiftKey,defaultPrevented,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  return {prevented,stopped};
}

let state=fire('c',{ctrlKey:true});
assert.equal(copyClicks,1,'Ctrl+C must delegate once to canonical Studio copy');
assert.equal(state.prevented,true,'Handled Ctrl+C must suppress browser copy');
assert.equal(state.stopped,true,'Handled Ctrl+C must stop competing Studio shortcuts');
state=fire('C',{metaKey:true});
assert.equal(copyClicks,2,'Cmd+C must use the same canonical copy path');

state=fire('v',{ctrlKey:true});
assert.equal(pasteClicks,1,'Ctrl+V must delegate once to canonical Studio paste');
assert.equal(state.prevented,true,'Handled Ctrl+V must suppress browser paste');
state=fire('V',{metaKey:true});
assert.equal(pasteClicks,2,'Cmd+V must use the same canonical paste path');

const editable={closest:selector=>selector.includes('input')?{}:null};
fire('c',{ctrlKey:true,target:editable});
fire('v',{metaKey:true,target:editable});
fire('c',{ctrlKey:true,altKey:true});
fire('v',{ctrlKey:true,shiftKey:true});
fire('c',{ctrlKey:true,repeat:true});
fire('v',{ctrlKey:true,defaultPrevented:true});
fire('x',{ctrlKey:true});
fire('c');
assert.equal(copyClicks,2,'Editable, modified, repeated, pre-handled or unrelated copy keys must be ignored');
assert.equal(pasteClicks,2,'Editable, modified, repeated, pre-handled or unrelated paste keys must be ignored');

copy.disabled=true;
state=fire('c',{ctrlKey:true});
assert.equal(copyClicks,2,'Disabled canonical copy must not be bypassed');
assert.equal(state.prevented,false,'Disabled copy must not swallow browser shortcut');
copy.disabled=false;
paste.disabled=true;
state=fire('v',{ctrlKey:true});
assert.equal(pasteClicks,2,'Disabled canonical paste must not be bypassed');
assert.equal(state.prevented,false,'Disabled paste must not swallow browser shortcut');
paste.disabled=false;

controller.destroy();
assert.equal(listeners.has('keydown'),false,'destroy() must detach the capture listener');

const source=fs.readFileSync(new URL('../src/studio/input/studio-keyboard-clipboard-controller.mjs',import.meta.url),'utf8');
const executable=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
assert.equal(/KELO_WORLD_EDIT\s*[.=\[]/.test(executable),false,'Keyboard clipboard must not write authority directly');
assert.equal(executable.includes('kernel.execute('),false,'Keyboard clipboard must delegate instead of creating a parallel mutation path');
assert.match(executable,/\[data-ext=\\?"copy\\?"\]/,'Controller must preserve canonical copy delegation');
assert.match(executable,/\[data-ext=\\?"paste\\?"\]/,'Controller must preserve canonical paste delegation');

console.log('Studio keyboard clipboard audit passed: Ctrl/Cmd+C/V delegation, editable guards, disabled states, teardown, authority isolation.');
