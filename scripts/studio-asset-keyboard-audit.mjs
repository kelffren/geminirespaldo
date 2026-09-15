import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nextAssetPaletteIndex } from '../src/studio/input/studio-asset-keyboard-controller.mjs';

assert.equal(nextAssetPaletteIndex(0,8,'ArrowRight',4),1,'right must advance one asset');
assert.equal(nextAssetPaletteIndex(1,8,'ArrowLeft',4),0,'left must move back one asset');
assert.equal(nextAssetPaletteIndex(1,8,'ArrowDown',4),5,'down must move one visual row');
assert.equal(nextAssetPaletteIndex(6,8,'ArrowUp',4),2,'up must move one visual row');
assert.equal(nextAssetPaletteIndex(7,8,'ArrowRight',4),7,'navigation must clamp at the end');
assert.equal(nextAssetPaletteIndex(0,8,'ArrowUp',4),0,'navigation must clamp at the start');
assert.equal(nextAssetPaletteIndex(0,0,'ArrowDown',4),-1,'empty palettes must not create a selection');

const source=fs.readFileSync(new URL('../src/studio/input/studio-asset-keyboard-controller.mjs',import.meta.url),'utf8');
assert.match(source,/String\(event\.key\)\.toLowerCase\(\)===['"]a['"]/,'A must open the existing asset palette');
assert.match(source,/assetPalette\.open\?\.\(\)/,'keyboard shortcut must reuse palette open');
assert.match(source,/event\.key===['"]Escape['"]/,'Escape must dismiss an open palette');
assert.match(source,/assetPalette\.close\?\.\(\)/,'Escape must reuse the canonical palette close flow');
assert.match(source,/stopImmediatePropagation\?\.\(\)/,'Escape dismissal must not fall through to selection-clearing shortcuts');
assert.match(source,/lastOpener=document\.activeElement|const active=document\.activeElement/,'controller must remember keyboard focus before opening');
assert.match(source,/requestAnimationFrame\?\.\(restoreOpener\)/,'focus restoration must happen after palette close settles');
assert.match(source,/target\.focus\?\.\(\{preventScroll:true\}\)/,'focus must return without moving the workspace');
assert.match(source,/assetPalette\.choose\?\.\(/,'Enter must reuse the existing placement choice flow');
assert.match(source,/ArrowLeft.*ArrowRight.*ArrowUp.*ArrowDown|ArrowLeft['"],['"]ArrowRight['"],['"]ArrowUp['"],['"]ArrowDown/s,'arrow navigation must cover four directions');
assert.match(source,/isEditable\(target\)/,'global shortcut must not steal typing focus');
assert.match(source,/removeEventListener\(['"]keydown['"]/, 'controller must clean up its keyboard listener');
assert.doesNotMatch(source,/kernel\.execute|KELO_WORLD_EDIT|worldEditRequest/,'keyboard controller must not mutate world or authority directly');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioAssetKeyboardController/,'Studio entry must install the asset keyboard controller');
assert.match(entry,/assetKeyboardController\.destroy\(\)/,'Studio close must clean up asset keyboard controller');

console.log(JSON.stringify({ok:true,openShortcut:true,escapeDismiss:true,focusRestore:true,selectionPreserved:true,arrowNavigation:true,enterPlacement:true,editableGuard:true,authorityIsolated:true,cleanup:true},null,2));
