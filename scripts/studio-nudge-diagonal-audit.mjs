import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/studio/input/studio-nudge-controller.mjs',import.meta.url),'utf8');

assert.match(source,/const MOBILE_VECTORS=Object\.freeze\(\{/,'mobile nudge directions must use one auditable vector table');
assert.match(source,/'up-left':\[-1,-1\]/,'up-left diagonal must move both axes once');
assert.match(source,/'up-right':\[1,-1\]/,'up-right diagonal must move both axes once');
assert.match(source,/'down-left':\[-1,1\]/,'down-left diagonal must move both axes once');
assert.match(source,/'down-right':\[1,1\]/,'down-right diagonal must move both axes once');
assert.match(source,/data-nudge-dir="up-left" aria-label="Mover arriba izquierda">↖<\/button>/,'pad must expose an accessible up-left target');
assert.match(source,/data-nudge-dir="up-right" aria-label="Mover arriba derecha">↗<\/button>/,'pad must expose an accessible up-right target');
assert.match(source,/data-nudge-dir="down-left" aria-label="Mover abajo izquierda">↙<\/button>/,'pad must expose an accessible down-left target');
assert.match(source,/data-nudge-dir="down-right" aria-label="Mover abajo derecha">↘<\/button>/,'pad must expose an accessible down-right target');
assert.match(source,/const vector=MOBILE_VECTORS\[dir\]/,'all mobile directions must resolve through the shared vector table');
assert.match(source,/void nudge\(vector\[0\],vector\[1\],\{step:mobileStep\(\)\}\)/,'a diagonal tap must remain one reversible nudge command instead of two axis commands');
assert.match(source,/await kernel\.execute\(command\)/,'persistent diagonal movement must still pass through Kernel CommandBus');
assert.match(source,/event\.repeat/,'keyboard hold protection must remain intact');
assert.doesNotMatch(source,/KELO_WORLD_EDIT\s*\./,'diagonal input must not write authority directly');
assert.match(source,/studio-nudge-v1\.2\.0-diagonal-mobile/,'controller version must expose diagonal-mobile behavior');

console.log(JSON.stringify({ok:true,mobileDiagonalNudge:true,diagonalTargets:4,tapsPerDiagonalAdjustment:1,historyActionsPerDiagonalAdjustment:1,commandBusPreserved:true,authorityDirectWrite:false},null,2));
