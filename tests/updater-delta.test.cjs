const assert = require('node:assert/strict');
const delta = require('../src/core/update-delta-core.js');
const base = [
  { url: 'core.js', blob: 'a'.repeat(40), bytes: 180000 },
  { url: 'world.js', blob: 'b'.repeat(40), bytes: 420000 },
  { url: 'pvp.js', blob: 'c'.repeat(40), bytes: 96000 }
];
const allCached = new Set(base.map((entry) => entry.blob));
const identical = delta.diffManifest(base, allCached);
assert.equal(identical.deltaFiles, 0);
assert.equal(identical.deltaBytes, 0);
assert.equal(identical.reusedFiles, 3);
assert.equal(identical.reusedBytes, 696000);
const changed = [base[0], base[1], { url: 'pvp.js', blob: 'd'.repeat(40), bytes: 101000 }];
const oneChanged = delta.diffManifest(changed, allCached);
assert.equal(oneChanged.deltaFiles, 1);
assert.equal(oneChanged.deltaBytes, 101000);
assert.equal(oneChanged.missing[0].url, 'pvp.js');
assert.equal(delta.chooseConcurrency({ gameplayBusy: true, foreground: false, status: 'good', pingMs: 20, downlinkMbps: 100 }), 0);
assert.equal(delta.chooseConcurrency({ gameplayBusy: false, status: 'constrained', pingMs: 180 }), 1);
assert.equal(delta.chooseConcurrency({ gameplayBusy: false, status: 'fair', pingMs: 120 }), 2);
assert.equal(delta.chooseConcurrency({ gameplayBusy: false, status: 'good', pingMs: 80, downlinkMbps: 20 }), 4);
assert.equal(delta.chooseConcurrency({ gameplayBusy: false, status: 'good', pingMs: 40, downlinkMbps: 20 }), 6);
assert.equal(delta.chooseConcurrency({ gameplayBusy: true, foreground: true, status: 'good', pingMs: 40, downlinkMbps: 20 }), 0);
console.log('UPDATER DELTA TEST PASS — identical build = 0 asset bytes; one changed file = one asset delta; combat = zero concurrency');
