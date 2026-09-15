import assert from 'node:assert/strict';
import { normalizeCutLines,equalCutLines,buildManualFrameRects } from '../src/creators/sprite-ability/sprite-ability-manual-cutter.mjs';
import { consumeManualGridHint } from '../src/creators/sprite-ability/spritesheet-auto-fit.mjs';

assert.deepEqual(equalCutLines(100,4),[0,25,50,75,100],'4-column equal grid');
assert.deepEqual(normalizeCutLines([-5,30,30,88,120],100),[0,30,88,100],'cuts clamp, sort and dedupe');
const rects=buildManualFrameRects(100,60,[0,30,100],[0,20,60]);
assert.equal(rects.length,4,'2x2 cuts create four frames');
assert.deepEqual(rects.map(r=>[r.x,r.y,r.width,r.height]),[[0,0,30,20],[30,0,70,20],[0,20,30,40],[30,20,70,40]],'irregular manual cells stay exact');

const root={__KELO_SPRITE_MANUAL_GRID:{columns:4,rows:2,width:432,height:216,createdAt:Date.now()}};
assert.deepEqual(consumeManualGridHint(root,432,216),{columns:4,rows:2,frames:8,frameWidth:108,frameHeight:108},'manual hint preserves exact grid');
assert.equal(root.__KELO_SPRITE_MANUAL_GRID,undefined,'manual hint is one-shot');
const stale={__KELO_SPRITE_MANUAL_GRID:{columns:4,rows:2,width:432,height:216,createdAt:Date.now()-60000}};
assert.equal(consumeManualGridHint(stale,432,216),null,'stale hints are rejected');
const mismatch={__KELO_SPRITE_MANUAL_GRID:{columns:4,rows:2,width:430,height:216,createdAt:Date.now()}};
assert.equal(consumeManualGridHint(mismatch,432,216),null,'dimension mismatch cannot override auto-fit');
console.log('sprite-ability manual cutter audit: PASS');
