import assert from 'node:assert/strict';
import { createStudioKeyboardDeleteController } from '../src/studio/input/studio-keyboard-delete-controller.mjs';

const listeners=new Map();
let clicks=0;
const button={disabled:false,getAttribute:()=>null,click(){clicks++;}};
const document={
  addEventListener(type,fn){listeners.set(type,fn);},
  removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
  querySelector(selector){assert.equal(selector,'#kelo-studio-live [data-act="delete"]');return button;}
};
let selection=['a'];
const kernel={selection:{get:()=>selection.slice()}};
const controller=createStudioKeyboardDeleteController({root:{document},kernel});

function fire(key,{target={closest:()=>null},repeat=false,ctrlKey=false,metaKey=false,altKey=false}={}){
  let prevented=false,stopped=false;
  listeners.get('keydown')?.({key,target,repeat,ctrlKey,metaKey,altKey,defaultPrevented:false,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  return {prevented,stopped};
}

let state=fire('Delete');
assert.equal(clicks,1,'Delete must delegate exactly once to the canonical delete control');
assert.equal(state.prevented,true,'Handled Delete must suppress browser behavior');
assert.equal(state.stopped,true,'Handled Delete must stop competing Studio shortcuts');

state=fire('Backspace');
assert.equal(clicks,2,'Backspace must use the same canonical delete path');
assert.equal(state.prevented,true);

selection=[];
state=fire('Delete');
assert.equal(clicks,2,'Empty selection must be a no-op');
assert.equal(state.prevented,false,'No-op Delete must not swallow the key');

selection=['a'];
fire('Delete',{target:{closest:selector=>selector.includes('input')?{}:null}});
assert.equal(clicks,2,'Editable targets must never delete world entities');
fire('Delete',{ctrlKey:true});
fire('Delete',{metaKey:true});
fire('Delete',{altKey:true});
fire('Delete',{repeat:true});
assert.equal(clicks,2,'Modified or repeated delete keys must remain guarded');

button.disabled=true;
fire('Delete');
assert.equal(clicks,2,'Disabled canonical delete must not be bypassed');
button.disabled=false;

controller.destroy();
assert.equal(listeners.has('keydown'),false,'destroy() must detach the capture listener');

console.log('Studio keyboard delete audit passed: canonical delegation, editable guards, modifier guards, repeat guard, disabled-state guard, teardown.');
