import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { createRoomBuildTool } from '../src/studio/tools/room-build-tool.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-plan-cache',settings:{tileSize:32,chunkSize:512}})});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);
const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root:{}});kernel.tools.register(room);
room.activate();

const first=room.planRect(0,0,96,64);
let measurement=room.getMeasurement();
let stats=room.getPlannerStats();
assert.deepEqual([measurement.width,measurement.height,measurement.requestedWidth,measurement.deltaWidth],[128,64,96,32],'fixture must quantize 96 requested width to the same 128 modular room');
assert.deepEqual(stats,{requests:1,rebuilds:1,reuses:0},'first plan must build one room plan');
const firstRoomId=first[0].components.buildingPiece.roomId;

const second=room.planRect(0,0,128,64);
measurement=room.getMeasurement();
stats=room.getPlannerStats();
assert.deepEqual([measurement.width,measurement.height,measurement.requestedWidth,measurement.deltaWidth],[128,64,128,0],'cached plan must still refresh live requested measurement');
assert.equal(second[0].components.buildingPiece.roomId,firstRoomId,'reuse must preserve semantic room identity');
assert.deepEqual(second,first,'same quantized geometry must reuse equivalent wall+floor rows instead of rebuilding');
assert.deepEqual(stats,{requests:2,rebuilds:1,reuses:1},'same modular geometry must count as a reuse');

for(let i=0;i<100;i++)room.planRect(0,0,i%2?96:128,64);
stats=room.getPlannerStats();
assert.equal(stats.requests,102,'planner must account for every high-frequency move request');
assert.equal(stats.rebuilds,1,'100 same-geometry pointer updates must not rebuild the room plan');
assert.equal(stats.reuses,101,'redundant quantized pointer updates must be served from the existing plan');

const changed=room.planRect(0,0,160,64);
stats=room.getPlannerStats();
assert.equal(changed.filter(row=>row.components?.buildingPiece?.type==='wall').length,8,'crossing into a 3x1 modular room must rebuild an eight-wall perimeter');
assert.equal(changed.filter(row=>row.components?.buildingPiece?.type==='floor').length,12,'3x1 modular room must rebuild twelve floor tiles');
assert.deepEqual(stats,{requests:103,rebuilds:2,reuses:101},'a real modular geometry change must trigger exactly one additional rebuild');

room.planRect(0,0,160,64,{square:true});
stats=room.getPlannerStats();
assert.equal(room.getMeasurement().squareLocked,true,'square modifier must still update behavior');
assert.equal(stats.rebuilds,3,'modifier changes must invalidate the cached free-rectangle plan');

const before=kernel.history.undoDepth;
const committed=await room.commitRoom();
assert.equal(committed.filter(row=>row.components?.buildingPiece?.type==='wall').length,12,'cached square plan must persist its full 3x3 perimeter');
assert.equal(committed.filter(row=>row.components?.buildingPiece?.type==='floor').length,36,'cached square plan must persist its full floor fill');
assert.equal(kernel.history.undoDepth,before+1,'cache optimization must preserve one CommandBus history entry');
await kernel.undo();
assert.equal(kernel.document.entities.length,0,'one Undo must remove the cached ROOM commit');
await kernel.redo();
assert.equal(kernel.document.entities.length,48,'one Redo must restore cached walls and floors');

const source=fs.readFileSync(new URL('../src/studio/tools/room-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'plan cache must not bypass placement/CommandBus authority');
assert.match(source,/placement\.commitBatch\(/,'ROOM persistence must remain delegated to placement.commitBatch');
room.destroy();quick.destroy();

console.log(JSON.stringify({ok:true,phase:'5.8',tool:'ROOM',improvement:'quantized-plan-cache+floor-fill',requests:103,rebuildsBeforeModifier:2,reuses:101,redundantRebuildReduction:'100 -> 0',liveMeasurement:true,historyEntries:1,oneUndo:true,oneRedo:true,authorityBypass:false},null,2));
