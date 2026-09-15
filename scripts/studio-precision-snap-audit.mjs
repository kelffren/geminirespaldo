import assert from 'node:assert/strict';
import fs from 'node:fs';
import { precisionSnapTransition } from '../src/studio/input/studio-precision-snap-controller.mjs';

assert.deepEqual(
  precisionSnapTransition({current:32,pressed:true}),
  {value:1,stored:32,active:true},
  'pressing the precision modifier must temporarily switch to 1px while remembering the configured snap'
);
assert.deepEqual(
  precisionSnapTransition({current:1,stored:32,pressed:false}),
  {value:32,stored:null,active:false},
  'releasing the precision modifier must restore the exact prior snap'
);
assert.deepEqual(
  precisionSnapTransition({current:16,stored:64,pressed:true}),
  {value:1,stored:64,active:true},
  'repeated activation must preserve the original snap rather than overwrite it'
);
assert.deepEqual(
  precisionSnapTransition({current:1,pressed:true}),
  {value:1,stored:1,active:true},
  'an already-free snap must remain stable'
);

const source=fs.readFileSync(new URL('../src/studio/input/studio-precision-snap-controller.mjs',import.meta.url),'utf8');
assert.match(source,/\[data-ext="snap"\]/,'precision mode must delegate to the existing Studio Snap control');
assert.match(source,/event\.key!==['"]Shift['"]/,'Shift must be the temporary precision modifier');
assert.match(source,/EDITABLE_SELECTOR/,'typing controls must not trigger precision mode');
assert.match(source,/visibilitychange/,'hidden-tab cleanup must restore the configured snap');
assert.match(source,/addEventListener\?\.\(['"]blur['"]|addEventListener\?\.\('blur'/,'window blur must restore the configured snap');
assert.match(source,/snapValue\(select\.value\)===1/,'release must not overwrite a snap deliberately changed while precision mode is active');
assert.doesNotMatch(source,/kernel\.execute|worldEditRequest|KELO_WORLD_EDIT/,'precision snap must remain a local UI/input layer and never bypass CommandBus or authority');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioPrecisionSnapController/,'Studio boot must install the precision snap controller');
assert.match(entry,/precisionSnapController\.destroy\(\)/,'Studio close must clean up the precision snap controller');
assert.match(entry,/kelo-studio-foundation-v1\.15\.0-precision-snap/,'Studio foundation version must expose the precision snap release');

console.log(JSON.stringify({ok:true,temporary1px:true,restoresPrevious:true,inputSafe:true,blurSafe:true,authorityIsolated:true},null,2));
