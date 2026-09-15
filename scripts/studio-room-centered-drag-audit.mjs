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
  const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-centered-drag',settings:{tileSize:32,chunkSize:512}})});
  kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
  kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
  const placement=createPlacementTool(kernel);kernel.tools.register(placement);
  const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);
  const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root:{}});kernel.tools.register(room);room.activate();
  return {kernel,quick,room};
}

const {kernel,quick,room}=fixture();
let rows=room.planRect(256,256,352,320,{centered:true});
let measure=room.getMeasurement();
assert.deepEqual([measure.x,measure.y,measure.width,measure.height,measure.modulesX,measure.modulesY,measure.totalWalls,measure.centered,measure.centerX,measure.centerY],[160,192,192,128,3,2,10,true,256,256],'Alt-style centered planning must expand equally around the anchor');
assert.equal(walls(rows).length,10,'centered 3x2 perimeter must contain ten walls');
assert.equal(floors(rows).length,24,'centered 192x128 room must fill twenty-four floor tiles');
const points=walls(rows).flatMap(worldSnapPoints);
for(const corner of [[160,192],[352,192],[160,320],[352,320]]){
  assert.equal(points.filter(point=>Math.hypot(point.x-corner[0],point.y-corner[1])<0.001).length,2,`centered corner ${corner.join(',')} must remain endpoint-connected`);
}

rows=room.planRect(256,256,352,320,{centered:true,square:true});
measure=room.getMeasurement();
assert.deepEqual([measure.x,measure.y,measure.width,measure.height,measure.modulesX,measure.modulesY,measure.centered,measure.squareLocked],[160,160,192,192,3,3,true,true],'Alt+Shift must combine centered and square modifiers without changing the center');
assert.equal(walls(rows).length,12,'centered square must contain twelve wall modules');
assert.equal(floors(rows).length,36,'centered square must fill thirty-six floor tiles');

kernel.input.route('pointerdown',{worldX:256,worldY:256,pointerType:'mouse'});
kernel.input.route('pointermove',{worldX:352,worldY:320,pointerType:'mouse',altKey:true});
measure=room.getMeasurement();
assert.equal(measure.centered,true,'holding Alt during pointermove must enable centered preview live');
assert.deepEqual([measure.centerX,measure.centerY],[256,256],'live centered preview must preserve the initial anchor as center');
kernel.input.route('pointermove',{worldX:352,worldY:320,pointerType:'mouse',altKey:false});
measure=room.getMeasurement();
assert.equal(measure.centered,false,'releasing Alt mid-drag must return to corner-anchored ROOM without restarting');
assert.deepEqual([measure.x,measure.y,measure.width,measure.height],[256,256,128,64],'corner mode must immediately re-plan from the same anchor');
kernel.input.route('pointermove',{worldX:352,worldY:320,pointerType:'mouse',altKey:true,shiftKey:true});
measure=room.getMeasurement();
assert.deepEqual([measure.width,measure.height,measure.centered,measure.squareLocked],[192,192,true,true],'Alt and Shift must compose live in one gesture');
kernel.input.route('pointercancel',{worldX:352,worldY:320,pointerType:'mouse'});

room.planRect(256,256,352,320,{centered:true});
const before=kernel.history.undoDepth;
const committed=await room.commitRoom();
assert.equal(committed.length,34,'centered ROOM must commit ten walls plus twenty-four floor tiles');
assert.equal(kernel.history.undoDepth,before+1,'centered ROOM must remain one CommandBus history entry');
assert.equal(kernel.document.entities.length,34,'all centered room pieces must persist');
await kernel.undo();
assert.equal(kernel.document.entities.length,0,'one Undo must remove the centered room');
await kernel.redo();
assert.equal(kernel.document.entities.length,34,'one Redo must restore the centered room');

const source=fs.readFileSync(new URL('../src/studio/tools/room-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'centered ROOM must not bypass placement/CommandBus authority');
assert.match(source,/placement\.commitBatch\(/,'centered ROOM persistence must remain delegated to placement.commitBatch');
room.destroy();quick.destroy();

console.log(JSON.stringify({ok:true,phase:'5.8',tool:'ROOM',improvement:'alt-centered-drag+floor-fill',anchor:[256,256],centeredSize:[192,128],centeredBounds:[160,192,352,320],centeredSquare:[192,192],centeredWalls:10,centeredFloors:24,liveToggle:true,modifierComposition:true,historyEntries:1,oneUndo:true,oneRedo:true,authorityBypass:false},null,2));
