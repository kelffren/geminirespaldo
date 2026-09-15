import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONTEXT_SNAP_VALUES, nextContextSnap } from '../src/studio/ui/studio-context-snap-chip.mjs';

assert.deepEqual(CONTEXT_SNAP_VALUES,[1,8,16,32,64],'context Snap must mirror the existing Studio snap ladder');
assert.equal(nextContextSnap(1),8,'FREE must cycle to Snap 8');
assert.equal(nextContextSnap(8),16,'Snap 8 must cycle to Snap 16');
assert.equal(nextContextSnap(16),32,'Snap 16 must cycle to Snap 32');
assert.equal(nextContextSnap(32),64,'Snap 32 must cycle to Snap 64');
assert.equal(nextContextSnap(64),1,'Snap 64 must wrap back to FREE');
assert.equal(nextContextSnap(999),1,'unknown values must recover to the first supported Snap');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-context-snap-chip.mjs',import.meta.url),'utf8');
assert.match(source,/\[data-ext="snap"\]/,'context chip must reuse the existing productivity Snap select');
assert.match(source,/select\.dispatchEvent\(new EventCtor\('change'/,'context chip must delegate through the existing Snap change pipeline');
assert.match(source,/ks-context-head/,'Snap control must live beside the selected object rather than reopen the full map controls');
assert.match(source,/MutationObserver/,'chip must survive lazy/recreated Studio DOM');
assert.doesNotMatch(source,/kernel\.execute|worldEditRequest|KELO_WORLD_EDIT/,'context Snap UI must not create a world mutation or authority path');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioContextSnapChip/,'Studio boot must install the contextual Snap chip');
assert.match(entry,/contextSnapChip\.destroy\(\)/,'Studio close must clean up the contextual Snap chip');
assert.match(entry,/kelo-studio-foundation-v1\.12\.0-context-snap/,'Studio foundation version must identify the contextual Snap release');

console.log(JSON.stringify({ok:true,snapCycle:true,existingControlReuse:true,noWorldMutation:true,lazyDomSafe:true,cleanup:true},null,2));
