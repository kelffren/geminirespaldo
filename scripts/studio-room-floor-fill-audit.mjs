import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { createRoomBuildTool } from '../src/studio/tools/room-build-tool.mjs';

function fixture({withFloor=true}={}){
  const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-floor',settings:{tileSize:32,chunkSize:512}})});
  kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
  if(withFloor)kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
  const placement=createPlacementTool(kernel);kernel.tools.register(placement);
  const overrides=withFloor?{wall:'stone_wall_01',floor:'marble_floor_01'}:{wall:'stone_wall_01'};
  const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:overrides}});kernel.tools.register(quick);
  const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root:{}});kernel.tools.register(room);
  return{kernel,placement,quick,room};
}

const {kernel,quick,room}=fixture();
assert.equal(room.activate(),true,'ROOM must activate with the shared WALL catalog entry');
const previews=room.planRect(0,0,128,128);
const walls=previews.filter(row=>row.components?.buildingPiece?.type==='wall');
const floors=previews.filter(row=>row.components?.buildingPiece?.type==='floor');
assert.equal(walls.length,8,'128x128 room with 64px wall modules must keep an eight-wall perimeter');
assert.equal(floors.length,16,'128x128 interior with 32px FLOOR tiles must auto-fill sixteen floor modules');
assert.equal(previews.length,24,'ROOM preview must include walls and interior floors together');
const roomIds=new Set(previews.map(row=>row.components?.buildingPiece?.roomId));
assert.equal(roomIds.size,1,'walls and floors must share one semantic roomId');
assert.equal(floors.every(row=>row.prefabId==='marble_floor_01'),true,'floor fill must reuse the Quick Build FLOOR prefab');
assert.equal(floors.every(row=>row.components?.buildingPiece?.roomInterior===true),true,'auto-filled floors must be semantically marked as room interior');
assert.equal(floors.every(row=>row.components?.buildingPiece?.snapPoints?.length===4),true,'room floor tiles must persist the reusable floor snap contract');
assert.equal(floors.every(row=>row.transform.x>=0&&row.transform.y>=0&&row.transform.x+row.bounds.w<=128&&row.transform.y+row.bounds.h<=128),true,'every generated floor tile must remain fully inside the room bounds');
const measurement=room.getMeasurement();
assert.equal(measurement.totalWalls,8,'measurement must expose wall count separately');
assert.equal(measurement.totalFloors,16,'measurement must expose floor count separately');
assert.equal(measurement.totalPieces,24,'measurement must expose total batch size');

const before=kernel.history.undoDepth;
const committed=await room.commitRoom();
assert.equal(committed.length,24,'ROOM commit must persist walls and floors in the same batch');
assert.equal(kernel.history.undoDepth,before+1,'walls + floor fill must create exactly one history entry');
assert.equal(kernel.document.entities.length,24,'all room pieces must persist through placement.commitBatch');
await kernel.undo();
assert.equal(kernel.document.entities.length,0,'one Undo must remove walls and floor fill together');
await kernel.redo();
assert.equal(kernel.document.entities.length,24,'one Redo must restore walls and floor fill together');
room.destroy();quick.destroy();

const fallback=fixture({withFloor:false});
fallback.room.activate();
const wallsOnly=fallback.room.planRect(0,0,128,128);
assert.equal(wallsOnly.every(row=>row.components?.buildingPiece?.type==='wall'),true,'ROOM must degrade cleanly to walls-only when no FLOOR prefab exists');
assert.equal(fallback.room.getMeasurement().totalFloors,0,'walls-only fallback must report zero floors');
fallback.room.destroy();fallback.quick.destroy();

const roomSource=fs.readFileSync(new URL('../src/studio/tools/room-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(roomSource,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'ROOM floor fill must not bypass placement/CommandBus authority');
assert.match(roomSource,/placement\.commitBatch\(/,'ROOM floor fill must remain inside the canonical batch placement path');

console.log(JSON.stringify({ok:true,phase:'5.8',feature:'room-floor-fill',walls:8,floors:16,totalPieces:24,historyEntries:1,oneUndo:true,oneRedo:true,semanticRoomId:true,fallbackWallsOnly:true,authorityBypass:false},null,2));
