import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool, resolveQuickBuildPieces } from '../src/studio/tools/quick-build-tool.mjs';
import { createSnapResolver, defaultSnapPointsForPiece, worldSnapPoints } from '../src/studio/tools/snap-resolver.mjs';

const resolved=resolveQuickBuildPieces({
  prefabs:[
    {id:'decor_lamp',label:'Lamp',category:'decor'},
    {id:'stone_wall_01',label:'Stone Wall',category:'building'},
    {id:'marble_floor_01',label:'Marble Floor',category:'building'}
  ]
});
assert.deepEqual(resolved.map(row=>[row.type,row.prefabId]),[['wall','stone_wall_01'],['floor','marble_floor_01']],'catalog resolver must pick semantic wall/floor prefabs');
assert.deepEqual(defaultSnapPointsForPiece('wall',{w:64,h:16}).map(point=>point.id),['start','end'],'wall contract must expose reusable start/end points');
assert.deepEqual(defaultSnapPointsForPiece('floor',{w:32,h:32}).map(point=>point.id),['north','south','west','east'],'floor contract must expose four reusable edges');

// Phase 3 orientation contract: infer a perpendicular wall from pointer position without scanning another candidate set per rotation.
const rotateKernel=createStudioKernel({document:createWorldDocument({worldId:'audit:auto-rotate',settings:{tileSize:32,chunkSize:256}})});
const targetWall={id:'target:wall',prefabId:'stone_wall_01',transform:{x:0,y:0,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
rotateKernel.spatial.upsert({id:targetWall.id,category:'entity',rect:{x:0,y:0,w:64,h:16},data:targetWall,order:0});
const rotateResolver=createSnapResolver({spatial:rotateKernel.spatial,radius:48});
const cornerPreview={id:'preview:corner',prefabId:'stone_wall_01',transform:{x:32,y:32,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
const autoTurn=rotateResolver.resolve(cornerPreview);
assert.equal(autoTurn.state,'snapped','perpendicular wall must find a compatible endpoint');
assert.equal(autoTurn.rotation,90,'resolver must infer the nearest cardinal orientation for a perpendicular connection');
assert.equal(autoTurn.autoRotated,true,'resolver must report when snap changed orientation');
assert.equal(autoTurn.rotationChecks,4,'automatic orientation must evaluate the four cardinal rotations against one local candidate query');
assert.ok(autoTurn.connection.distance<0.001,'auto-rotated endpoint should connect exactly');
const manualOnly=rotateResolver.resolve(cornerPreview,{rotations:[0]});
assert.notEqual(manualOnly.rotation,90,'explicit rotation constraint must prevent automatic 90-degree override');
assert.equal(manualOnly.rotationChecks,1,'manual override must evaluate only the chosen orientation');

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:quick-build',settings:{tileSize:32,chunkSize:512}})});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);

assert.equal(quick.pieces.length,2,'phase 3 must preserve WALL and FLOOR');
assert.equal(quick.activate('wall'),true,'WALL must be selectable');
assert.equal(kernel.input.active().includes('studio-quick-build'),true,'Quick Build must own a temporary input context while active');
let preview=placement.getPreview();
assert.equal(preview.prefabId,'stone_wall_01','selecting WALL must create a placement preview immediately');
assert.equal(preview.components.buildingPiece.type,'wall','preview must carry semantic building-piece type');
assert.equal(preview.components.buildingPiece.version,2,'semantic metadata schema must remain compatible with phase 2');
assert.equal(preview.components.buildingPiece.snapPoints.length,2,'preview metadata must persist local snap-point contract');

let routed=kernel.input.route('pointermove',{worldX:70,worldY:35,pointerType:'mouse'});
assert.equal(routed.handled,true,'desktop pointer movement must route through Quick Build');
preview=placement.getPreview();
assert.deepEqual([preview.transform.x,preview.transform.y],[64,32],'free preview movement must respect the existing tile snap');
assert.equal(quick.getSnapState().state,'valid','preview away from compatible pieces must remain valid/free');
routed=kernel.input.route('pointerdown',{worldX:98,worldY:65,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile pointer path must route through the same Quick Build context');

const first=await quick.commitAt(98,65);
assert.equal(kernel.document.entities.length,1,'first placement must persist through the canonical placement command');
assert.equal(first.components.buildingPiece.type,'wall','placed entity must remain semantically identifiable as a wall');
assert.equal(first.components.buildingPiece.snapPoints.length,2,'placed wall must retain snap points for future edits');
assert.ok(placement.getPreview(),'Quick Build must immediately recreate the next preview after placement');
assert.equal(quick.active.type,'wall','placing must keep the same build piece active');
preview=placement.getPreview();
assert.deepEqual([preview.transform.x,preview.transform.y],[160,64],'next wall preview must advance to the adjacent module');
const snapState=quick.getSnapState();
assert.equal(snapState.state,'snapped','advanced wall preview must detect the compatible endpoint of the placed wall');
assert.equal(snapState.connection.targetEntityId,first.id,'snap must identify the local target entity');
assert.ok(snapState.connection.distance<0.001,'adjacent modular endpoint should snap exactly');
const placedPoints=worldSnapPoints(first),previewPoints=worldSnapPoints(preview);
assert.ok(placedPoints.some(a=>previewPoints.some(b=>Math.hypot(a.x-b.x,a.y-b.y)<0.001)),'snapped pieces must share a world-space connection point');

const second=await quick.commitAt(preview.transform.x,preview.transform.y);
assert.equal(kernel.document.entities.length,2,'second tap on snapped preview must place another wall without reopening the catalog');
assert.deepEqual(kernel.document.entities.map(entity=>[entity.transform.x,entity.transform.y]),[[96,64],[160,64]],'snap chain must create adjacent non-overlapping wall modules');
assert.equal(kernel.history.undoDepth,2,'each single-piece placement must remain independently undoable');
await kernel.undo();
assert.equal(kernel.document.entities.length,1,'Undo must remove the most recent Quick Build placement');
await kernel.redo();
assert.equal(kernel.document.entities.length,2,'Redo must restore the Quick Build placement');

// Inject a local semantic wall only into the spatial fixture so Quick Build can demonstrate automatic corner orientation.
kernel.spatial.upsert({id:targetWall.id,category:'entity',rect:{x:0,y:0,w:64,h:16},data:targetWall,order:99});
quick.resolveMove(32,32);
preview=placement.getPreview();
assert.equal(preview.transform.rotation,90,'Quick Build must apply the resolver cardinal rotation to the live ghost');
assert.equal(quick.getSnapState().autoRotated,true,'Quick Build status must expose automatic orientation');
assert.equal(quick.getSnapState().rotationChecks,4,'normal snap movement must keep automatic cardinal orientation enabled');
assert.equal(quick.rotate(),true,'R/manual rotate must remain available while building');
const manualRotation=placement.getPreview().transform.rotation;
quick.resolveMove(32,32);
assert.equal(placement.getPreview().transform.rotation,manualRotation,'manual R rotation must override automatic orientation for the current piece');
assert.equal(quick.getSnapState().manualRotationOverride,true,'snap state must report the active manual orientation override');
assert.equal(quick.getSnapState().rotationChecks,1,'manual override must constrain resolver work to one orientation');

assert.equal(quick.activate('floor'),true,'creator must be able to switch directly from WALL to FLOOR');
assert.equal(placement.getPreview().components.buildingPiece.type,'floor','switching piece must update semantic metadata');
assert.equal(placement.getPreview().components.buildingPiece.snapPoints.length,4,'floor preview must use floor edge snap points');
assert.equal(quick.deactivate(),true,'Quick Build must be cancellable');
assert.equal(placement.getPreview(),null,'cancel must remove the local preview');
assert.equal(kernel.input.active().includes('studio-quick-build'),false,'cancel must return world input to the normal Studio stack');

// Locality/performance: populate a large indexed world and require one local query instead of a 5,000-row scan per rotation.
const perfKernel=createStudioKernel({document:createWorldDocument({worldId:'audit:snap-perf',settings:{tileSize:32,chunkSize:256}})});
for(let i=0;i<5000;i++){
  const x=(i%100)*1024,y=Math.floor(i/100)*1024;
  const entity={id:`perf:${i}`,prefabId:'wall',transform:{x,y,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
  perfKernel.spatial.upsert({id:entity.id,category:'entity',rect:{x,y,w:64,h:16},data:entity,order:i});
}
for(let i=0;i<5;i++){
  const entity={id:`near:${i}`,prefabId:'wall',transform:{x:96+i*70,y:96,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
  perfKernel.spatial.upsert({id:entity.id,category:'entity',rect:{x:entity.transform.x,y:entity.transform.y,w:64,h:16},data:entity,order:5000+i});
}
const perfResolver=createSnapResolver({spatial:perfKernel.spatial,radius:48});
const perfPreview={id:'preview',prefabId:'wall',transform:{x:160,y:96,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
const perfResult=perfResolver.resolve(perfPreview);
const perfStats=perfKernel.spatial.stats();
assert.equal(perfStats.entries,5005,'performance fixture must contain 5,000 distant entities plus five local neighbors');
assert.ok(perfStats.lastQuery.uniqueCandidates<30,`snap query must stay local; inspected ${perfStats.lastQuery.uniqueCandidates} indexed candidates`);
assert.ok(perfResult.candidateCount<30,'resolver candidate set must stay local instead of scaling with full world size');
assert.equal(perfResult.rotationChecks,4,'auto rotation must reuse the local candidate set for all cardinal orientations');

const source=fs.readFileSync(new URL('../src/studio/tools/quick-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'Quick Build must never bypass placement/CommandBus authority');
assert.match(source,/placement\.commit\(\)/,'persistent placement must delegate to the existing placement tool');
quick.destroy();
assert.equal(kernel.input.has('studio-quick-build'),false,'destroy must unregister the temporary input context');

console.log(JSON.stringify({ok:true,phase:'3',pieces:['wall','floor'],preview:true,semanticMetadata:true,snapPoints:true,localSnap:true,autoRotation:true,manualRotationOverride:true,snapFeedback:true,continuousPlacement:true,desktopPointer:true,mobilePointer:true,undoRedo:true,cancel:true,authorityBypass:false,performance:{entries:perfStats.entries,uniqueCandidates:perfStats.lastQuery.uniqueCandidates,membershipChecks:perfStats.lastQuery.membershipChecks,rotationChecks:perfResult.rotationChecks}},null,2));
