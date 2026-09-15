import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { createRoomBuildTool } from '../src/studio/tools/room-build-tool.mjs';
import { createSelectTool, resolveRepeatSelectRadius } from '../src/studio/tools/select-tool.mjs';
import { worldSnapPoints } from '../src/studio/tools/snap-resolver.mjs';

const mobileRoot={innerWidth:390,matchMedia:()=>({matches:true}),KeloCamera:{snapshot:()=>({effectiveZoom:.25})}};
const desktopRoot={innerWidth:1440,matchMedia:()=>({matches:false}),KeloCamera:{snapshot:()=>({effectiveZoom:.25})}};
assert.equal(resolveRepeatSelectRadius({root:mobileRoot}),80,'20px repeat tolerance at 0.25x zoom must map to 80 world units on coarse mobile input');
assert.equal(resolveRepeatSelectRadius({root:desktopRoot}),12,'desktop repeat tolerance must remain the precise 12-world-unit contract');

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-build',settings:{tileSize:32,chunkSize:512}})});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const select=createSelectTool(kernel,{root:mobileRoot});kernel.tools.register(select);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);
const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root:{}});kernel.tools.register(room);

assert.equal(room.activate(),true,'ROOM must activate when a WALL prefab is available');
assert.equal(room.active,true,'ROOM must expose active state');
assert.equal(quick.active.type,'wall','ROOM must reuse the Quick Build WALL piece instead of creating a parallel catalog');
assert.equal(kernel.input.active().includes('studio-quick-build-room'),true,'ROOM must own a temporary higher-priority input context');
assert.equal(room.getMeasurement(),null,'ROOM measurement must be empty before a drag plan exists');

let previews=room.planRect(0,0,128,96);
let wallPreviews=previews.filter(row=>row.components?.buildingPiece?.type==='wall');
let floorPreviews=previews.filter(row=>row.components?.buildingPiece?.type==='floor');
assert.equal(wallPreviews.length,8,'drag dimensions must quantize to the wall module length and keep an eight-module closed perimeter');
assert.equal(floorPreviews.length,16,'ROOM V2 must auto-fill the quantized 128x128 interior with sixteen 32px FLOOR modules');
assert.equal(previews.length,24,'ROOM preview must compose perimeter and floor fill');
const measure=room.getMeasurement();
assert.deepEqual({width:measure.width,height:measure.height,requestedWidth:measure.requestedWidth,requestedHeight:measure.requestedHeight,deltaWidth:measure.deltaWidth,deltaHeight:measure.deltaHeight,modulesX:measure.modulesX,modulesY:measure.modulesY,totalWalls:measure.totalWalls,totalFloors:measure.totalFloors,totalPieces:measure.totalPieces,wallLength:measure.wallLength},{width:128,height:128,requestedWidth:128,requestedHeight:96,deltaWidth:0,deltaHeight:32,modulesX:2,modulesY:2,totalWalls:8,totalFloors:16,totalPieces:24,wallLength:64},'ROOM must expose modular perimeter, floor fill and quantization delta before commit');
assert.equal(wallPreviews.every(row=>row.prefabId==='stone_wall_01'),true,'ROOM perimeter must use the same resolved WALL prefab as Quick Build');
assert.equal(floorPreviews.every(row=>row.prefabId==='marble_floor_01'),true,'ROOM interior must use the same resolved FLOOR prefab as Quick Build');
assert.equal(wallPreviews.every(row=>row.components?.buildingPiece?.roomGenerated===true),true,'ROOM-generated walls must remain identifiable for later semantic editing');
assert.equal(floorPreviews.every(row=>row.components?.buildingPiece?.roomInterior===true),true,'ROOM-generated floors must remain identifiable as room interior');
const roomIds=new Set(previews.map(row=>row.components?.buildingPiece?.roomId));
assert.equal(roomIds.size,1,'every preview in one ROOM gesture must share one semantic roomId');
assert.ok([...roomIds][0]?.startsWith('room:'),'ROOM semantic identity must use a stable room namespace');
assert.deepEqual([...new Set(wallPreviews.map(row=>row.components?.buildingPiece?.roomEdge))].sort(),['bottom','left','right','top'],'ROOM walls must carry explicit edge roles');
assert.equal(wallPreviews.filter(row=>row.transform.rotation===0).length,4,'ROOM must produce two horizontal edges with two modules each');
assert.equal(wallPreviews.filter(row=>row.transform.rotation===90).length,4,'ROOM must produce two vertical edges with two modules each');
const unique=new Set(wallPreviews.map(row=>`${row.transform.x}:${row.transform.y}:${row.transform.rotation}`));
assert.equal(unique.size,wallPreviews.length,'ROOM planner must not emit duplicate wall modules');
const points=wallPreviews.flatMap(worldSnapPoints);
for(const corner of [[0,0],[128,0],[0,128],[128,128]]){
  const matches=points.filter(point=>Math.hypot(point.x-corner[0],point.y-corner[1])<0.001);
  assert.equal(matches.length,2,`room corner ${corner.join(',')} must join exactly two wall endpoints`);
}

let routed=kernel.input.route('pointerdown',{worldX:0,worldY:0,pointerType:'mouse'});
assert.equal(routed.handled,true,'desktop pointerdown must route through ROOM');
routed=kernel.input.route('pointermove',{worldX:128,worldY:96,pointerType:'mouse'});
assert.equal(routed.handled,true,'desktop pointermove must update ROOM preview');
assert.equal(room.getMeasurement().height,128,'live desktop drag must expose the quantized room height before pointerup');
routed=kernel.input.route('pointercancel',{worldX:128,worldY:96,pointerType:'mouse'});
assert.equal(routed.handled,true,'pointercancel must cleanly terminate ROOM drag');
assert.equal(room.getMeasurement(),null,'pointercancel must clear stale room measurements');
routed=kernel.input.route('pointerdown',{worldX:0,worldY:0,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile touch pointerdown must route through ROOM');
routed=kernel.input.route('pointermove',{worldX:128,worldY:96,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile touch pointermove must update ROOM preview');
assert.equal(room.getMeasurement().deltaHeight,32,'mobile drag must expose the same quantization delta as desktop');
routed=kernel.input.route('pointercancel',{worldX:128,worldY:96,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile pointercancel must cleanly terminate ROOM drag');
assert.equal(room.getMeasurement(),null,'mobile cancel must clear measurement feedback');

previews=room.planRect(0,0,128,96);
const historyBefore=kernel.history.undoDepth;
const committed=await room.commitRoom();
assert.equal(committed.length,24,'ROOM V2 must commit perimeter and floor fill together');
assert.equal(room.getMeasurement(),null,'committed ROOM must clear transient measurement state');
assert.equal(kernel.document.entities.length,24,'all ROOM pieces must persist through one placement batch');
assert.equal(kernel.history.undoDepth,historyBefore+1,'one ROOM gesture must create exactly one history entry');
const persistedRoomId=kernel.document.entities[0].components?.buildingPiece?.roomId;
assert.equal(kernel.document.entities.every(row=>row.components?.buildingPiece?.roomId===persistedRoomId),true,'persisted ROOM pieces must retain one shared roomId');
assert.deepEqual(kernel.selection.get().length,24,'fresh room placement must leave the whole semantic room selected');

select.clear();
const target=kernel.document.entities.find(row=>row.components?.buildingPiece?.roomEdge==='top'&&row.components?.buildingPiece?.roomIndex===1);
assert.ok(target,'audit must have a non-corner top wall target');
const firstX=(Number(target.transform?.x)||0)+10,secondX=(Number(target.transform?.x)||0)+50,py=(Number(target.transform?.y)||0)+8;
select.selectPoint(firstX,py,{preserveExisting:false,cycle:true,radius:0});
assert.equal(kernel.selection.get().length,1,'first mobile tap on a room wall must preserve fine-grained single-piece editing');
select.selectPoint(secondX,py,{preserveExisting:true,cycle:true,radius:0});
assert.equal(kernel.selection.get().length,24,'second mobile tap within tolerance must expand selection to walls and floors sharing the semantic roomId');
assert.equal(kernel.selection.get().every(id=>kernel.document.entities.find(row=>row.id===id)?.components?.buildingPiece?.roomId===persistedRoomId),true,'semantic expansion must never select pieces from another room');
select.selectPoint(secondX,py,{preserveExisting:true,cycle:true,radius:0});
assert.deepEqual(kernel.selection.get(),[String(target.id)],'third repeat tap on the same room wall must collapse the semantic room back to the targeted piece');
select.selectPoint(secondX,py,{preserveExisting:true,cycle:true,radius:0});
assert.equal(kernel.selection.get().length,24,'fourth repeat tap must re-expand the same room so single/group editing stays reversible without clearing selection');

const desktopSelect=createSelectTool(kernel,{root:desktopRoot});
desktopSelect.clear();
desktopSelect.selectPoint(firstX,py,{preserveExisting:false,cycle:true,radius:0});
desktopSelect.selectPoint(secondX,py,{preserveExisting:true,cycle:true,radius:0});
assert.equal(kernel.selection.get().length,1,'desktop must keep its precise 12-world-unit repeat radius instead of inheriting the larger mobile tolerance');

await kernel.undo();
assert.equal(kernel.document.entities.length,0,'one Undo must remove the entire room including floor fill');
await kernel.redo();
assert.equal(kernel.document.entities.length,24,'one Redo must restore the entire room including floor fill');
assert.equal(kernel.document.entities.every(row=>row.components?.buildingPiece?.roomId===persistedRoomId),true,'Undo/Redo must preserve semantic room identity');

const roomSource=fs.readFileSync(new URL('../src/studio/tools/room-build-tool.mjs',import.meta.url),'utf8');
const selectSource=fs.readFileSync(new URL('../src/studio/tools/select-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(roomSource,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'ROOM must not bypass placement/CommandBus authority');
assert.match(roomSource,/placement\.commitBatch\(/,'ROOM persistent mutation must delegate to placement.commitBatch');
assert.match(roomSource,/getMeasurement/,'ROOM must expose transient measurement feedback without persisting it to the document');
assert.doesNotMatch(selectSource,/kernel\.execute\s*\(|KELO_WORLD_EDIT/,'semantic selection toggling must remain transient and must not bypass CommandBus/authority');
assert.equal(room.deactivate(),true,'ROOM must be cancellable back to normal Quick Build');
assert.equal(kernel.input.active().includes('studio-quick-build-room'),false,'ROOM cancel must release its input context');
room.destroy();quick.destroy();
assert.equal(kernel.input.has('studio-quick-build-room'),false,'ROOM destroy must unregister listeners/context');

console.log(JSON.stringify({ok:true,phase:'5.10',tool:'ROOM',wallModules:8,floorModules:16,roomEntities:24,liveMeasurement:true,requestedSize:[128,96],quantizedSize:[128,128],quantizationDelta:[0,32],moduleGrid:[2,2],exactCornerConnections:true,semanticRoomId:true,edgeRoles:true,singleWallFirstTap:true,zoomAwareMobileRoomSecondTap:true,roomThirdTapCollapse:true,roomFourthTapReexpand:true,mobileRepeatScreenPx:20,mobileRepeatWorldAtQuarterZoom:80,desktopRepeatWorld:12,historyEntries:1,oneUndo:true,oneRedo:true,desktopPointer:true,mobilePointer:true,authorityBypass:false},null,2));
