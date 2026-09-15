import fs from 'node:fs';
import assert from 'node:assert/strict';

const path=new URL('../src/studio/input/studio-placement-touch-controller.mjs',import.meta.url);
const source=fs.readFileSync(path,'utf8');

assert.match(source,/const HOLD_DELAY_MS=320;/,'hold repeat must wait before auto-repeat');
assert.match(source,/const HOLD_REPEAT_MS=90;/,'hold repeat cadence must stay responsive');
assert.match(source,/pad\.addEventListener\('pointerdown',onPointerDown\)/,'direction pad must start hold on pointerdown');
assert.match(source,/pad\.addEventListener\('pointerup',stopHold\)/,'pointerup must stop repeating');
assert.match(source,/pad\.addEventListener\('pointercancel',stopHold\)/,'pointercancel must stop repeating');
assert.match(source,/pad\.addEventListener\('lostpointercapture',stopHold\)/,'lost capture must stop repeating');
assert.match(source,/moveDirection\(dir\);\s*holdTimeout=later/,'first movement must be immediate before repeat delay');
assert.match(source,/holdInterval=every\(\(\)=>\{if\(holdDir&&preview\)moveDirection\(holdDir\);\},HOLD_REPEAT_MS\)/,'held direction must repeat at configured cadence');
assert.match(source,/if\(suppressDirectionClick\)\{suppressDirectionClick=false;return;\}/,'synthetic click after pointerdown must not double-nudge');
assert.match(source,/if\(!next\)stopHold\(\)/,'preview cancellation must stop hold loop');
assert.match(source,/if\(Number\(root\.innerWidth\|\|9999\)>MOBILE_MAX\)stopHold\(\)/,'leaving mobile width must stop hold loop');
assert.match(source,/destroy\(\)\{if\(destroyed\)return;destroyed=true;stopHold\(\);/,'destroy must clear active timers');
assert.match(source,/placement\.move\(x,y,\{snap:1\}\)/,'hold movement must reuse canonical preview movement');
assert.match(source,/await placement\.commit\(\)/,'commit must remain delegated to canonical placement commit');
assert.doesNotMatch(source,/kernel\.execute|KELO_WORLD_EDIT/,'touch controller must not bypass placement authority');

console.log('Studio placement touch hold audit: PASS');
