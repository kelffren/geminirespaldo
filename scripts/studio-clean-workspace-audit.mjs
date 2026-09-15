import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CLEAN_MENU_GROUPS, worldRectToScreen } from '../src/studio/ui/studio-clean-workspace.mjs';

assert.deepEqual(Object.keys(CLEAN_MENU_GROUPS),['edit','create','view'],'clean workspace must expose exactly three primary dropdown groups');
assert.equal(CLEAN_MENU_GROUPS.edit.some(([id])=>id==='duplicate'),true,'edit dropdown must retain duplicate');
assert.equal(CLEAN_MENU_GROUPS.edit.some(([id])=>id==='delete'),true,'edit dropdown must retain delete');
assert.equal(CLEAN_MENU_GROUPS.create.some(([id])=>id==='paint'),true,'create dropdown must expose Paint Copies');
assert.equal(CLEAN_MENU_GROUPS.create.some(([id])=>id==='terrain'),true,'create dropdown must expose terrain');
assert.equal(CLEAN_MENU_GROUPS.view.some(([id])=>id==='grid'),true,'view dropdown must expose grid');
assert.equal(CLEAN_MENU_GROUPS.view.some(([id])=>id==='camera'),true,'view dropdown must expose camera');

const point=worldRectToScreen({x:150,y:120,w:40,h:30},{x:100,y:100,effectiveZoom:2,screenW:400,screenH:300});
assert.deepEqual(point,{x:340,y:190,bottom:250},'selection HUD projection must follow camera center and zoom');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-clean-workspace.mjs',import.meta.url),'utf8');
assert.match(source,/ks-clean-workspace \.ks-left/,'clean workspace must hide desktop side panels by default');
assert.match(source,/ks-clean-popover/,'clean workspace must use dropdown popovers');
assert.match(source,/ks-selection-float/,'clean workspace must expose a floating selection HUD');
assert.match(source,/data-clean-menu=key/,'dropdown triggers must be contextual rather than permanent button rows');
assert.match(source,/\['select','move'\]\.includes\(tool\)/,'selection HUD must stay contextual to select and move tools');
assert.match(source,/ks-menu-minimized \.ks-clean-toolbar/,'clean toolbar must respect the independent menu minimizer');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioCleanWorkspace/,'Studio entry must install the clean workspace');
assert.match(entry,/cleanWorkspace\.destroy\(\)/,'Studio close must clean up the clean workspace');

console.log(JSON.stringify({ok:true,threeDropdowns:true,floatingSelectionHud:true,sidePanelsOnDemand:true,cameraProjection:true,menuMinimizerCompatible:true},null,2));
