import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { createRoomBuildTool } from '../src/studio/tools/room-build-tool.mjs';
import { worldSnapPoints } from '../src/studio/tools/snap-resolver.mjs';

const walls=rows=>rows.filter(row=>row.components?.buildingPiece?.type==='wall');
const floors=rows=>rows.filter(row=>row.components?.buildingPiece?.type==='floor');
function fixture(){
  const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-square-lock',settings:{tileSize:32,chunkSize:512}})});
  kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
  kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
  const placement=createPlacementTool(kernel);kernel.tools.register(placement);
  const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);
  const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root:{}});kernel.tools.register(room);
  room.activate();
  return {kernel,placement,quick,room};
}

const {kernel,quick,room}=fixture();
let rows=room.planRect(0,0,192,96);
let measure=room.getMeasurement();
assert.deepEqual([measure.width,measure.height,measure.modulesX,measure.modulesY,measure.totalWalls,measure.squareLocked],[192,128,3,2,10,false],'normal ROOM planning must preserve independent modular width/height');
assert.equal(walls(rows).length,10,'normal 192x96 request must keep its 3x2 modular perimeter');
assert.equal(floors(rows).length,24,'normal quantized 192x128 room must add twenty-four 32px floor tiles');

rows=room.planRect(0,0,192,96,{square:true});
measure=room.getMeasurement();
assert.deepEqual([measure.width,measure.height,measure.modulesX,measure.modulesY,measure.totalWalls,measure.squareLocked],[192,192,3,3,12,true],'square lock must use the longer requested axis for both modular dimensions');
assert.equal(walls(rows).length,12,'3x3 square perimeter must contain twelve wall modules');
assert.equal(floors(rows).length,36,'192x192 square must fill with thirty-six 32px floor tiles');
const points=walls(rows).flatMap(worldSnapPoints);
for(const corner of [[0,0],[192,0],[0,192],[192,192]]){
  assert.equal(points.filter(point=>Math.hypot(point.x-corner[0],point.y-corner[1])<0.001).length,2,`square corner ${corner.join(',')} must remain exactly endpoint-connected`);
}

rows=room.planRect(256,256,64,160,{square:true});
measure=room.getMeasurement();
assert.deepEqual([measure.x,measure.y,measure.width,measure.height],[64,64,192,192],'reverse square drag must expand from the anchor toward the pointer quadrant instead of jumping positive');

kernel.input.route('pointerdown',{worldX:0,worldY:0,pointerType:'mouse'});
kernel.input.route('pointermove',{worldX:192,worldY:96,pointerType:'mouse',shiftKey:true});
measure=room.getMeasurement();
assert.equal(measure.squareLocked,true,'desktop Shift pointermove must enable square lock live');
assert.deepEqual([measure.width,measure.height],[192,192],'live Shift drag must preview a square before release');
kernel.input.route('pointermove',{worldX:192,worldY:96,pointerType:'mouse',shiftKey:false});
measure=room.getMeasurement();
assert.equal(measure.squareLocked,false,'releasing Shift mid-drag must immediately return to free rectangular planning');
assert.deepEqual([measure.width,measure.height],[192,128],'free planning must restore independent modular dimensions without restarting the gesture');
kernel.input.route('pointercancel',{worldX:192,worldY:96,pointerType:'mouse'});

rows=room.planRect(0,0,192,96,{square:true});
const before=kernel.history.undoDepth;
const committed=await room.commitRoom();
assert.equal(committed.length,48,'square ROOM must commit twelve walls plus thirty-six floor tiles');
assert.equal(kernel.history.undoDepth,before+1,'square ROOM must remain one CommandBus history entry');
assert.equal(kernel.document.entities.length,48,'all square ROOM pieces must persist');
await kernel.undo();
assert.equal(kernel.document.entities.length,0,'one Undo must remove the whole square room');
await kernel.redo();
assert.equal(kernel.document.entities.length,48,'one Redo must restore the whole square room');

const source=fs.readFileSync(new URL('../src/studio/tools/room-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'square lock must not bypass placement/CommandBus authority');
assert.match(source,/placement\.commitBatch\(/,'square ROOM persistence must remain delegated to placement.commitBatch');
room.destroy();quick.destroy();

console.log(JSON.stringify({ok:true,phase:'5.8',tool:'ROOM',improvement:'shift-square-lock+floor-fill',freeQuantizedSize:[192,128],lockedSize:[192,192],lockedModules:[3,3],lockedWalls:12,lockedFloors:36,reverseDrag:true,liveToggle:true,historyEntries:1,oneUndo:true,oneRedo:true,authorityBypass:false},null,2));
