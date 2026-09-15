import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCollisionTool } from '../src/studio/tools/collision-tool.mjs';

function kernelWith(collisions={}){
  return {
    document:{settings:{tileSize:32},navigation:{collisions}},
    execute(){throw new Error('AUDIT_SHOULD_NOT_COMMIT');}
  };
}

const existing={collisionId:'c1',x:64,y:96,w:64,h:64,label:'Wall'};
const tool=createCollisionTool(kernelWith({c1:existing}));

const started=tool.beginAt(92,124);
assert.deepEqual({x:started.x,y:started.y},{x:64,y:96},'grabbing an existing collision must not move it immediately');

const jitter=tool.move(97,129);
assert.deepEqual({x:jitter.x,y:jitter.y},{x:64,y:96},'5px pointer jitter near a tile edge must not jump the collision by a full tile');

const oneTile=tool.move(124,156);
assert.deepEqual({x:oneTile.x,y:oneTile.y},{x:96,y:128},'moving the pointer one tile must move the collision one tile while preserving the grab point');

tool.cancel();
const empty=createCollisionTool(kernelWith());
const created=empty.beginAt(95,127);
assert.deepEqual({x:created.x,y:created.y},{x:64,y:96},'new collision placement must retain the existing snap-to-grid behavior');

const source=fs.readFileSync(new URL('../src/studio/tools/collision-tool.mjs',import.meta.url),'utf8');
assert.match(source,/grabOffset\s*=\s*\{ x: 0, y: 0 \}/,'collision tool must track a local grab offset');
assert.match(source,/action === 'move' \? grabOffset\.x : 0/,'grab offset must apply only while moving existing collisions');
assert.match(source,/kernel\.execute\(createMoveWorldCollisionCommand/,'confirmed collision moves must still use the canonical CommandBus path');
assert.doesNotMatch(source,/KELO_WORLD_EDIT\./,'collision tool must not write authority directly');

console.log(JSON.stringify({ok:true,feature:'collision-grab-offset',jitterPx:5,tileSize:32,preservedGrabPoint:true,createSnapPreserved:true,commandBusPreserved:true},null,2));
