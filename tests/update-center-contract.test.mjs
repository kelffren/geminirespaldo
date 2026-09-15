import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('src/ui/update-ui.js', 'utf8');
const shell = fs.readFileSync('src/ui/luxe-shell.js', 'utf8');

assert.match(ui, /kelo\.world\.updateCenter\.queue\.v1/, 'queue must persist locally');
assert.match(ui, /data-update-center/, 'Menu > Actualizaciones card must exist');
assert.match(ui, /Actualizaciones/, 'update center title missing');
assert.match(ui, /ACTUALIZAR AHORA/, 'ready action missing');
assert.match(ui, /DEJAR PARA LUEGO/, 'defer action missing');
assert.match(ui, /KeloUpdater\.applyUpdate|g\.KeloUpdater\.applyUpdate/, 'update center must delegate activation to KeloUpdater');
assert.match(ui, /KeloUpdater\.check|g\.KeloUpdater\.check/, 'manual update check missing');
assert.match(ui, /staging-progress/, 'download progress event must feed queue state');
assert.match(ui, /staging-paused/, 'paused update state missing');
assert.match(ui, /staged/, 'ready update state missing');
assert.match(ui, /installed/, 'installed history state missing');
assert.match(ui, /close\(true\)/, 'defer/back path must return to Menu');
assert.match(ui, /más reciente|mas reciente|latest/i, 'queue policy must document latest-build activation');
assert.doesNotMatch(ui, /kelo-updater-ui[^\n]{0,80}position\s*:\s*fixed/i, 'legacy floating updater panel must not return');
assert.match(shell, /lx-menu-grid/, 'Luxe menu integration anchor missing');

console.log('UPDATE CENTER CONTRACT PASS — silent menu UI, queue, ready/apply/later states present');
