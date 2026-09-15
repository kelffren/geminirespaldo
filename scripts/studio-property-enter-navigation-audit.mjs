import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioPropertyCommitController } from '../src/studio/input/studio-property-commit-controller.mjs';

const handlers=new Map();
const microtasks=[];
const calls=[];
function field(prop,{disabled=false,ariaDisabled=null}={}){
  return {
    dataset:{prop},disabled,value:prop,
    matches(selector){return selector==='#kelo-studio-live [data-prop]';},
    closest(){return null;},
    getAttribute(name){if(name==='data-prop')return prop;if(name==='aria-disabled')return ariaDisabled;return null;},
    blur(){calls.push(`blur:${prop}`);},focus(){calls.push(`focus:${prop}`);},select(){calls.push(`select:${prop}`);}
  };
}
const locked=field('locked',{disabled:true}),x=field('x'),y=field('y'),rotation=field('rotation');
let fields=[locked,x,y,rotation];
const document={
  addEventListener(type,fn){handlers.set(type,fn);},
  removeEventListener(type,fn){if(handlers.get(type)===fn)handlers.delete(type);},
  querySelectorAll(selector){assert.equal(selector,'#kelo-studio-live [data-prop]');return fields;}
};
const root={document,queueMicrotask(fn){microtasks.push(fn);}};
const controller=createStudioPropertyCommitController({root});
const key=(target,key='Enter',extra={})=>({target,key,defaultPrevented:false,repeat:false,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra});

const canvasTarget={closest(){return null;}};
const f2=key(canvasTarget,'F2');
handlers.get('keydown')(f2);
assert.equal(f2.defaultPrevented,true,'F2 must be consumed when an editable property is available');
assert.deepEqual(calls,['focus:x','select:x'],'F2 must jump directly to the first enabled Studio property and select its value');

calls.length=0;
const editableTarget={closest(selector){return selector.includes('input')?this:null;}};
handlers.get('keydown')(key(editableTarget,'F2'));
assert.deepEqual(calls,[],'F2 must not steal focus from an existing editable control');
handlers.get('keydown')(key(canvasTarget,'F2',{shiftKey:true}));
assert.deepEqual(calls,[],'modified F2 must remain available to other shortcuts');

handlers.get('keydown')(key(x));
assert.deepEqual(calls,['blur:x'],'Enter must commit through the canonical blur path before navigation');
assert.equal(microtasks.length,1,'Enter must defer focus until post-commit rerenders settle');
microtasks.shift()();
assert.deepEqual(calls,['blur:x','focus:y','select:y'],'Enter must advance to the next enabled property and select its value');

calls.length=0;
handlers.get('keydown')(key(rotation,'Enter',{shiftKey:true}));
microtasks.shift()();
assert.deepEqual(calls,['blur:rotation','focus:y','select:y'],'Shift+Enter must move to the previous enabled property and skip disabled controls');

calls.length=0;
handlers.get('keydown')(key(rotation));
microtasks.shift()();
assert.deepEqual(calls,['blur:rotation','focus:x','select:x'],'Enter on the last enabled property must wrap to the first enabled property');

calls.length=0;
handlers.get('keydown')(key(x,'Enter',{shiftKey:true}));
microtasks.shift()();
assert.deepEqual(calls,['blur:x','focus:rotation','select:rotation'],'Shift+Enter on the first enabled property must wrap to the last enabled property');

calls.length=0;
fields=[locked,x,y,rotation];
const tab=key(x,'Tab');
handlers.get('keydown')(tab);
assert.equal(tab.defaultPrevented,true,'internal Tab must be stabilized by the controller');
assert.deepEqual(calls,['blur:x'],'internal Tab must commit through the canonical blur path');
const replacementX=field('x'),replacementY=field('y'),replacementRotation=field('rotation');
fields=[locked,replacementX,replacementY,replacementRotation];
microtasks.shift()();
assert.deepEqual(calls,['blur:x','focus:y','select:y'],'Tab must recover the next property after a synchronous Inspector rerender');

calls.length=0;
const shiftTab=key(replacementRotation,'Tab',{shiftKey:true});
handlers.get('keydown')(shiftTab);
assert.equal(shiftTab.defaultPrevented,true,'internal Shift+Tab must be stabilized by the controller');
microtasks.shift()();
assert.deepEqual(calls,['blur:rotation','focus:y','select:y'],'Shift+Tab must move to the previous enabled property');

calls.length=0;
const firstBoundary=key(replacementX,'Tab',{shiftKey:true});
handlers.get('keydown')(firstBoundary);
assert.equal(firstBoundary.defaultPrevented,false,'Shift+Tab on the first enabled property must remain native so focus can leave the Inspector');
assert.deepEqual(calls,[],'boundary Shift+Tab must not force a manual blur');
assert.equal(microtasks.length,0,'boundary Shift+Tab must not schedule internal navigation');

const lastBoundary=key(replacementRotation,'Tab');
handlers.get('keydown')(lastBoundary);
assert.equal(lastBoundary.defaultPrevented,false,'Tab on the last enabled property must remain native so focus can leave the Inspector');
assert.deepEqual(calls,[],'boundary Tab must not force a manual blur');
assert.equal(microtasks.length,0,'boundary Tab must not schedule internal navigation');

calls.length=0;
fields=[field('x'),field('y'),field('rotation')];
handlers.get('keydown')(key(y));
const rerenderY=field('y');
const rerenderRotation=field('rotation');
fields=[field('x'),rerenderY,rerenderRotation];
microtasks.shift()();
assert.deepEqual(calls,['blur:y','focus:rotation','select:rotation'],'Enter navigation must recover by data-prop after a synchronous property-panel rerender');

calls.length=0;
const solo=field('solo');
fields=[solo];
handlers.get('keydown')(key(solo));
microtasks.shift()();
assert.deepEqual(calls,['blur:solo'],'single-field panels must commit without pointlessly refocusing the same control');

calls.length=0;
handlers.get('focusin')({target:x});
x.value='999';
handlers.get('keydown')(key(x,'Escape'));
assert.equal(x.value,'x','Escape must still restore the value captured at focus-in');
assert.deepEqual(calls,['blur:x'],'Escape must preserve cancel-via-blur behavior and never navigate');
assert.equal(microtasks.length,0,'Escape must not schedule property navigation');

calls.length=0;
fields=[];
const emptyF2=key(canvasTarget,'F2');
handlers.get('keydown')(emptyF2);
assert.equal(emptyF2.defaultPrevented,false,'F2 must remain unconsumed when no property can receive focus');
assert.deepEqual(calls,[],'empty property panels must be a no-op');

controller.destroy();
assert.equal(handlers.has('keydown'),false,'destroy must detach keydown listener');
assert.equal(handlers.has('focusin'),false,'destroy must detach focusin listener');
assert.equal(controller.focusFirstProperty(),false,'destroyed controller must not refocus properties');

const source=fs.readFileSync(new URL('../src/studio/input/studio-property-commit-controller.mjs',import.meta.url),'utf8');
assert.match(source,/input\.blur\?\.\(\)/,'keyboard commit must remain delegated to canonical blur/change handling');
assert.match(source,/key==='Enter'\|\|key==='Escape'\|\|key==='Tab'/,'controller must explicitly support stable Tab navigation');
assert.match(source,/isTab\?index\+direction:\(index\+direction\+fields\.length\)%fields\.length/,'Tab must stay bounded while Enter keeps cyclic navigation');
assert.doesNotMatch(source,/kernel\.execute|KELO_WORLD_EDIT/,'property keyboard ergonomics must not bypass CommandBus or authority');

console.log(JSON.stringify({ok:true,f2DirectFocus:true,enterAdvances:true,shiftEnterReverses:true,cyclicNavigation:true,stableTabNavigation:true,stableShiftTabNavigation:true,tabBoundaryPassThrough:true,rerenderRecovery:true,escapeCancelPreserved:true,commandBusBypass:false,authorityBypass:false},null,2));
