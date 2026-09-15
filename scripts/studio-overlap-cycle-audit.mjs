import assert from 'node:assert/strict';
import fs from 'node:fs';
import { overlappingEntitiesAtPoint, nextOverlapSelection, isStudioTouchCycleGesture } from '../src/studio/input/studio-overlap-cycle-controller.mjs';

const entities=[{id:'bottom'},{id:'middle'},{id:'top'}];
const rects=new Map([
  ['bottom',{rect:{x:0,y:0,w:100,h:100}}],
  ['middle',{rect:{x:20,y:20,w:60,h:60}}],
  ['top',{rect:{x:30,y:30,w:40,h:40}}]
]);
const spatial={get:id=>rects.get(id)};

assert.deepEqual(overlappingEntitiesAtPoint({entities,spatial},50,50).map(row=>row.id),['top','middle','bottom'],'overlap candidates must follow topmost-last document order');
assert.deepEqual(overlappingEntitiesAtPoint({entities,spatial},10,10).map(row=>row.id),['bottom'],'point filtering must exclude entities outside the pointer');
assert.equal(nextOverlapSelection(overlappingEntitiesAtPoint({entities,spatial},50,50),'top').id,'middle','cycling must move from top to next entity');
assert.equal(nextOverlapSelection(overlappingEntitiesAtPoint({entities,spatial},50,50),'bottom').id,'top','cycling must wrap back to the topmost entity');
assert.equal(nextOverlapSelection(overlappingEntitiesAtPoint({entities,spatial},50,50),'missing').id,'top','cycling without a current candidate must select topmost first');

assert.equal(isStudioTouchCycleGesture({x:100,y:120,at:1000},{x:110,y:126,at:1300}),true,'nearby second tap inside 360ms must cycle overlap on touch');
assert.equal(isStudioTouchCycleGesture({x:100,y:120,at:1000},{x:110,y:126,at:1361}),false,'touches outside the double-tap window must stay ordinary selection');
assert.equal(isStudioTouchCycleGesture({x:100,y:120,at:1000},{x:126,y:120,at:1200}),false,'touches farther than 24px must not cycle another location');
assert.equal(isStudioTouchCycleGesture(null,{x:100,y:120,at:1000}),false,'first touch must never be intercepted');

const source=fs.readFileSync(new URL('../src/studio/input/studio-overlap-cycle-controller.mjs',import.meta.url),'utf8');
assert.match(source,/TOUCH_DOUBLE_TAP_MS=360/,'mobile overlap timing must stay explicit and auditable');
assert.match(source,/TOUCH_RADIUS_PX=24/,'mobile overlap spatial tolerance must stay explicit and auditable');
assert.match(source,/event\.altKey/,'desktop overlap cycling must keep the intentional Alt/Option gesture');
assert.match(source,/event\.pointerType==='touch'/,'controller must distinguish touch from desktop pointer input');
assert.match(source,/if\(active!==\'select\'\)return/,'touch cycling must stay in Select mode so Move gestures are not hijacked');
assert.match(source,/isStudioTouchCycleGesture\(lastTouch,sample\)/,'touch input must use the bounded double-tap classifier');
assert.match(source,/screenToWorld/,'pointer selection must use the camera owner coordinate conversion');
assert.match(source,/kernel\.selection\.set/,'feature must mutate local selection only');
assert.doesNotMatch(source,/kernel\.execute|createMoveEntityCommand|createPatchEntityCommand|worldEditRequest/,'overlap cycling must not create world commands or authority writes');
assert.match(source,/stopImmediatePropagation/,'successful cycling must prevent the ordinary click selector from immediately replacing the result');
assert.match(source,/root\.addEventListener\?\.\('blur',clearTouch\)/,'blur must clear stale mobile double-tap state');
assert.match(source,/root\.removeEventListener\?\.\('blur',clearTouch\)/,'destroy must release the blur listener');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioOverlapCycleController/,'Studio entry must install overlap cycling');
assert.match(entry,/overlapCycleController\.destroy\(\)/,'Studio close must remove the overlap controller');
assert.match(entry,/kelo-studio-foundation-v\d+\.\d+\.\d+/,'focused audit must accept the current Studio foundation instead of pinning an obsolete release');

console.log(JSON.stringify({ok:true,deterministicOrder:true,wrap:true,localSelectionOnly:true,desktopAltClick:true,mobileDoubleTap:true,touchWindowMs:360,touchRadiusPx:24,moveGestureProtected:true,inputCleanup:true},null,2));
