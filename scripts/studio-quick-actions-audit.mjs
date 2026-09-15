import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/studio/input/studio-quick-actions-controller.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');

const has=s=>assert.ok(source.includes(s),`missing: ${s}`);
[
  "mod&&k==='a'",
  'invertSelection():selectAll()',
  "k==='escape'",
  "k==='tab'",
  'cycleSelection(e.shiftKey?-1:1)',
  "k==='/'",
  'focusAssetSearch()',
  "k==='g'&&e.shiftKey",
  'toggleGrid()',
  "k==='m'",
  'toggleWorkspace()',
  "k==='enter'&&mod",
  'save()',
  "k==='p'&&e.shiftKey",
  'togglePlaytest()',
  "/^[1-6]$/.test(k)",
  "1:'select',2:'move',3:'terrain',4:'path',5:'collision',6:'camera'",
  'min-width:44px;min-height:44px',
  'aria-label="Seleccionar todos"',
  'aria-label="Invertir selección"',
  'aria-label="Limpiar selección"',
  'e.target?.closest?.(EDITABLE)',
  'e.stopImmediatePropagation?.()',
  'document.removeEventListener(\'keydown\',onKey,true)',
  'observer?.disconnect()'
].forEach(has);

// Persistent actions must delegate to existing Studio controls, never bypass authority/CommandBus.
assert.equal(source.includes('KELO_WORLD_EDIT'),false,'quick actions must not write authority directly');
assert.equal(source.includes('kernel.execute'),false,'quick actions must not create a parallel mutation path');
assert.ok(source.includes("click(root,'[data-act=\"play\"]')"),'playtest must delegate to live shell');
assert.ok(source.includes("click(root,'[data-act=\"save\"]')"),'save must delegate to live shell');
assert.ok(source.includes("click(root,'[data-ext=\"grid\"]')"),'grid must delegate to productivity panel');
assert.ok(source.includes('assetPalette?.open?.()'),'asset search should reuse palette API');

assert.ok(entry.includes("createStudioQuickActionsController"),'foundation must import quick actions');
assert.ok(entry.includes("quickActionsController.destroy()"),'foundation must clean up quick actions');
assert.ok(entry.includes("kelo-studio-foundation-v1.19.0-quick-actions"),'foundation version must advance');

console.log('studio quick actions audit: OK — 10 accelerators wired, mobile targets >=44px, no direct authority/CommandBus bypass');
