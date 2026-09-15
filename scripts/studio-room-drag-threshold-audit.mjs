import assert from 'node:assert/strict';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { createRoomBuildTool, resolveRoomDragThreshold } from '../src/studio/tools/room-build-tool.mjs';

const root={innerWidth:390,matchMedia:()=>({matches:true}),KeloCamera:{snapshot:()=>({effectiveZoom:.25})}};
assert.equal(resolveRoomDragThreshold('touch',{root}),64,'16px touch threshold at 0.25x zoom must equal 64 world units');
assert.equal(resolveRoomDragThreshold('mouse',{root}),24,'mouse pointer on a hybrid/coarse device must retain precise 6px threshold = 24 world units at 0.25x');

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-drag-threshold',settings:{tileSize:32,chunkSize:512}})});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);
const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root});kernel.tools.register(room);
assert.equal(room.activate(),true);

// Accidental touch jitter: 40 world units at 0.25x = 10 screen px, below the 16px threshold.
kernel.input.route('pointerdown',{worldX:100,worldY:100,pointerType:'touch'});
kernel.input.route('pointermove',{worldX:140,worldY:100,pointerType:'touch'});
assert.equal(room.getPreviews().length,0,'sub-threshold touch jitter must not create room ghosts');
assert.equal(room.getMeasurement(),null,'sub-threshold touch jitter must not show misleading room dimensions');
const beforeTapHistory=kernel.history.undoDepth;
kernel.input.route('pointerup',{worldX:140,worldY:100,pointerType:'touch'});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(kernel.document.entities.length,0,'sub-threshold touch gesture must not create an accidental room');
assert.equal(kernel.history.undoDepth,beforeTapHistory,'sub-threshold touch gesture must not create history');

// Intentional touch drag: 80 world units at 0.25x = 20 screen px, above threshold.
kernel.input.route('pointerdown',{worldX:0,worldY:0,pointerType:'touch'});
kernel.input.route('pointermove',{worldX:80,worldY:80,pointerType:'touch'});
assert.ok(room.getPreviews().length>=4,'intentional touch drag must produce a room preview');
assert.ok(room.getMeasurement(),'intentional touch drag must restore live dimensions after threshold crossing');
kernel.input.route('pointerup',{worldX:80,worldY:80,pointerType:'touch'});
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(kernel.document.entities.length>=4,'intentional touch drag must commit the room');
assert.equal(kernel.history.undoDepth,beforeTapHistory+1,'intentional room drag must remain one history entry');

room.destroy();quick.destroy();
console.log(JSON.stringify({ok:true,phase:'5.4',intentionalDrag:true,touchThresholdPx:16,mouseThresholdPx:6,quarterZoomTouchWorldThreshold:64,quarterZoomMouseWorldThreshold:24,accidentalRoomPrevented:true,historyNoisePrevented:true,authorityPath:'placement.commitBatch'},null,2));
