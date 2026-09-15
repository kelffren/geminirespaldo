import assert from 'node:assert/strict';
import { getCrossedPreviewFrames } from '../src/creators/sprite-ability/sprite-ability-event-lab.mjs';

assert.deepEqual(getCrossedPreviewFrames(null,2,0,5),[2],'initial frame should be emitted');
assert.deepEqual(getCrossedPreviewFrames(2,2,0,5),[],'same frame should not emit twice');
assert.deepEqual(getCrossedPreviewFrames(1,4,0,5),[2,3,4],'skipped forward frames must all be processed');
assert.deepEqual(getCrossedPreviewFrames(4,1,0,5),[5,0,1],'wrapped frames must include tail and head');
assert.deepEqual(getCrossedPreviewFrames(8,11,8,12),[9,10,11],'non-zero ranges must preserve skipped frames');
assert.deepEqual(getCrossedPreviewFrames(11,8,8,12),[12,8],'non-zero ranges must preserve wrap');

console.log('sprite-ability-event-lab-audit: ok');
