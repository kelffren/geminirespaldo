import assert from 'node:assert/strict';
import fs from 'node:fs';

const selectionSource=fs.readFileSync(new URL('../src/studio/input/studio-selection-history-controller.mjs',import.meta.url),'utf8');
const snapSource=fs.readFileSync(new URL('../src/studio/input/studio-snap-cycle-controller.mjs',import.meta.url),'utf8');

assert.match(selectionSource,/event\.metaKey\|\|event\.ctrlKey\|\|!event\.altKey/,'selection history must require Alt and reject Ctrl/Cmd');
assert.match(selectionSource,/key!==\s*'\['/,'selection history must keep bracket navigation');
assert.match(selectionSource,/key!==\s*'\]'/,'selection history must keep bracket navigation');
assert.match(snapSource,/event\.key!==']'&&event\.key!=='\['/,'snap cycle must keep plain bracket shortcuts');
assert.match(snapSource,/\(!altGraph&&\(event\.ctrlKey\|\|event\.altKey\)\)/,'snap cycle must reject Alt except AltGraph');
assert.doesNotMatch(selectionSource,/kernel\.execute\(/,'shortcut disambiguation must not bypass CommandBus');
assert.doesNotMatch(selectionSource,/KELO_WORLD_EDIT/,'selection history must stay authority isolated');
assert.doesNotMatch(snapSource,/kernel\.execute\(/,'snap cycle must remain UI-only');

console.log(JSON.stringify({ok:true,plainBrackets:'snap-cycle',altBrackets:'selection-history',authorityIsolated:true},null,2));
