import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';
import { createRoomMaterialTool, resolveRoomMaterialCandidates } from '../src/studio/tools/room-material-tool.mjs';
import { createRoomOpeningTool } from '../src/studio/tools/room-opening-tool.mjs';

const mirrored=[];
const kernel=createStudioKernel({
  document:createWorldDocument({worldId:'audit:room-material',settings:{tileSize:32,chunkSize:512}}),
  adapter:{async mirrorStudioEvent(event){mirrored.push(event);}}
});
for(const prefab of [
  {id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16}},
  {id:'wood_wall_01',label:'Wood Wall',category:'building',bounds:{w:64,h:16}},
  {id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32}},
  {id:'wood_floor_01',label:'Wood Floor',category:'building',bounds:{w:32,h:32}},
  {id:'arched_door_01',label:'Arched Door',category:'building',bounds:{w:32,h:64}}
])kernel.prefabs.register({...prefab,components:{visual:{source:'fixture'}}});

const candidates=resolveRoomMaterialCandidates({prefabs:kernel.prefabs.list()});
assert.equal(candidates.wall.some(row=>row.id==='stone_wall_01'),true,'wall candidates must include stone wall');
assert.equal(candidates.wall.some(row=>row.id==='wood_wall_01'),true,'wall candidates must include wood wall');
assert.equal(candidates.wall.some(row=>row.id==='arched_door_01'),false,'wall candidates must exclude door prefabs');
assert.equal(candidates.floor.some(row=>row.id==='marble_floor_01'),true,'floor candidates must include marble floor');
assert.equal(candidates.floor.some(row=>row.id==='wood_floor_01'),true,'floor candidates must include wood floor');

const roomId='room:material-audit';
const points=[{id:'start',type:'wall',x:0,y:8,direction:'start'},{id:'end',type:'wall',x:64,y:8,direction:'end'}];
const entities=[
  {id:'w1',prefabId:'stone_wall_01',transform:{x:0,y:0,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',roomGenerated:true,roomId,roomEdge:'top',roomIndex:0,prefabId:'stone_wall_01',snapPoints:points}}},
  {id:'w2',prefabId:'stone_wall_01',transform:{x:64,y:0,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',roomGenerated:true,roomId,roomEdge:'top',roomIndex:1,prefabId:'stone_wall_01',snapPoints:points}}},
  {id:'d1',prefabId:'arched_door_01',transform:{x:128,y:0,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'door',roomGenerated:true,roomId,roomEdge:'top',roomIndex:2,prefabId:'arched_door_01',openingGenerated:true,openingType:'door',replacesType:'wall',wallPrefabId:'stone_wall_01',snapPoints:points}}},
  {id:'f1',prefabId:'marble_floor_01',transform:{x:0,y:32,rotation:0},bounds:{w:32,h:32},components:{buildingPiece:{type:'floor',roomGenerated:true,roomId,prefabId:'marble_floor_01'}}},
  {id:'f2',prefabId:'marble_floor_01',transform:{x:32,y:32,rotation:0},bounds:{w:32,h:32},components:{buildingPiece:{type:'floor',roomGenerated:true,roomId,prefabId:'marble_floor_01'}}},
  {id:'other',prefabId:'stone_wall_01',transform:{x:500,y:500,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',roomGenerated:true,roomId:'room:other',prefabId:'stone_wall_01',snapPoints:points}}}
];
for(const entity of entities)await kernel.execute(createPlaceEntityCommand(entity));
kernel.history.clear();mirrored.length=0;
kernel.selection.set('w1');
const tool=createRoomMaterialTool(kernel,{root:{}});
assert.equal(tool.getSelectedRoomId(),roomId,'material tool must resolve roomId from current selection');

const wallHistory=kernel.history.undoDepth;
await tool.applyRoomMaterial('wall','wood_wall_01');
let byId=id=>kernel.document.entities.find(row=>row.id===id);
assert.equal(byId('w1').prefabId,'wood_wall_01','wall style must update first room wall');
assert.equal(byId('w2').prefabId,'wood_wall_01','wall style must update every wall sharing the roomId');
assert.equal(byId('w1').components.buildingPiece.prefabId,'wood_wall_01','wall semantic prefabId must update with visual prefab');
assert.equal(byId('d1').prefabId,'arched_door_01','wall style must not replace visible DOOR prefab');
assert.equal(byId('d1').components.buildingPiece.wallPrefabId,'wood_wall_01','opening restoration source must follow the new room wall material');
assert.equal(byId('f1').prefabId,'marble_floor_01','wall style must not mutate floor visuals');
assert.equal(byId('other').prefabId,'stone_wall_01','wall style must not leak into another roomId');
assert.equal(kernel.history.undoDepth,wallHistory+1,'whole-room wall style must be one history entry');
assert.equal(mirrored.at(-1)?.command?.type,'room.material.wall','authority must receive one composite room wall material command');

await kernel.undo();
assert.equal(byId('w1').prefabId,'stone_wall_01','one Undo must restore all room walls');
assert.equal(byId('w2').prefabId,'stone_wall_01','one Undo must restore second wall');
assert.equal(byId('d1').components.buildingPiece.wallPrefabId,'stone_wall_01','Undo must restore opening wall restoration source');
await kernel.redo();
assert.equal(byId('w1').prefabId,'wood_wall_01','one Redo must reapply whole-room wall material');
assert.equal(byId('d1').components.buildingPiece.wallPrefabId,'wood_wall_01','Redo must reapply opening restoration source');

kernel.selection.set('d1');
const opening=createRoomOpeningTool(kernel,{root:{KELO_QUICK_BUILD_CATALOG:{door:'arched_door_01'}}});
assert.equal(opening.canRestore(),true,'door must remain a restorable semantic opening after room material change');
await opening.restoreSelected();
assert.equal(byId('d1').prefabId,'wood_wall_01','RESTORE after style change must return to the new room wall material');
assert.equal(byId('d1').components.buildingPiece.type,'wall','RESTORE must recover wall semantics');
await kernel.undo();
assert.equal(byId('d1').components.buildingPiece.type,'door','Undo restore must recover door semantics');
opening.destroy();

kernel.selection.set('f1');
const floorHistory=kernel.history.undoDepth;
await tool.applyRoomMaterial('floor','wood_floor_01');
assert.equal(byId('f1').prefabId,'wood_floor_01','floor style must update first room floor');
assert.equal(byId('f2').prefabId,'wood_floor_01','floor style must update all room floor tiles');
assert.equal(byId('f1').components.buildingPiece.prefabId,'wood_floor_01','floor semantic prefabId must update');
assert.equal(byId('w1').prefabId,'wood_wall_01','floor style must leave room wall material untouched');
assert.equal(byId('other').prefabId,'stone_wall_01','floor style must remain isolated from other rooms');
assert.equal(kernel.history.undoDepth,floorHistory+1,'whole-room floor style must be one history entry');
assert.equal(mirrored.at(-1)?.command?.type,'room.material.floor','authority must receive one composite room floor material command');
await kernel.undo();
assert.equal(byId('f1').prefabId,'marble_floor_01','one Undo must restore all floor tiles');
assert.equal(byId('f2').prefabId,'marble_floor_01','one Undo must restore second floor tile');

const source=fs.readFileSync(new URL('../src/studio/tools/room-material-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'room material tool must not bypass studio authority');
assert.match(source,/createCompositeCommand/,'whole-room material changes must use a reversible CompositeCommand');
assert.match(source,/kernel\.execute\(command\)/,'room material changes must enter persistence through Kernel CommandBus');
tool.destroy();

console.log(JSON.stringify({ok:true,phase:'7.4',tool:'ROOM material',wallStyle:true,floorStyle:true,roomIsolation:true,openingVisualPreserved:true,restoreTracksNewWallStyle:true,wallHistoryEntries:1,floorHistoryEntries:1,oneUndo:true,oneRedo:true,authorityCommands:['room.material.wall','room.material.floor']},null,2));
