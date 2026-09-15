import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createCreatorActions} from '../src/studio/tools/creator-actions.mjs';

const roomId='room:original';
const piece=(id,x,edge,index)=>({
  id,prefabId:'wall',transform:{x,y:0,rotation:0,scale:1},bounds:{w:32,h:16},
  components:{buildingPiece:{type:'wall',system:'quick-build',version:3,roomGenerated:true,roomId,roomEdge:edge,roomIndex:index,prefabId:'wall'}}
});
const original=[piece('a',0,'top',0),piece('b',32,'top',1),piece('c',64,'top',2)];
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-clone-isolation',settings:{tileSize:32,chunkSize:256},entities:original})});
const actions=createCreatorActions(kernel);kernel.tools.register?.({...actions,id:'creatorActions'});
kernel.selection.set(['a','b','c']);
let executed=[];const off=kernel.commands.on(event=>{if(event.type==='execute')executed.push(event.command);});

const duplicated=await actions.duplicateSelection({offsetX:128,offsetY:0,armGrab:false});
assert.equal(duplicated.length,3,'duplicate must clone the complete selected room subset');
const duplicateRoomIds=new Set(duplicated.map(row=>row.components?.buildingPiece?.roomId));
assert.equal(duplicateRoomIds.size,1,'all pieces duplicated from one room must stay grouped under one cloned roomId');
const duplicateRoomId=[...duplicateRoomIds][0];
assert.ok(duplicateRoomId&&duplicateRoomId!==roomId,'duplicate roomId must be fresh and isolated from the source room');
assert.deepEqual(original.map(row=>row.components.buildingPiece.roomId),[roomId,roomId,roomId],'source room identity must remain unchanged');
assert.equal(kernel.history.undoDepth,1,'duplicate must occupy one history entry');
assert.equal(executed.at(-1)?.type,'entity.batch.duplicate','duplicate must remain one composite CommandBus operation');
assert.equal(executed.at(-1)?.commands?.length,3,'duplicate batch must contain one place command per cloned piece');

await kernel.undo();
assert.equal(kernel.document.entities.length,3,'one Undo must remove the full duplicated room');
await kernel.redo();
assert.equal(kernel.document.entities.length,6,'one Redo must restore the full duplicated room');
const redoneRoomIds=new Set(kernel.document.entities.filter(row=>!['a','b','c'].includes(row.id)).map(row=>row.components?.buildingPiece?.roomId));
assert.deepEqual([...redoneRoomIds],[duplicateRoomId],'Redo must restore the same isolated semantic room identity');

kernel.selection.set(['a','b','c']);
assert.equal(actions.copySelection(),3,'copy must capture all selected room pieces');
const pasted=await actions.pasteClipboard({offsetX:256,offsetY:0});
const pasteRoomIds=new Set(pasted.map(row=>row.components?.buildingPiece?.roomId));
assert.equal(pasteRoomIds.size,1,'all pieces pasted together from one room must share one roomId');
const pasteRoomId=[...pasteRoomIds][0];
assert.ok(pasteRoomId!==roomId&&pasteRoomId!==duplicateRoomId,'every paste must receive a new semantic room identity');
assert.equal(kernel.history.undoDepth,2,'paste after duplicate/redo must add exactly one history entry');
assert.equal(executed.at(-1)?.type,'entity.batch.paste','paste must remain one composite CommandBus operation');

const pastedAgain=await actions.pasteClipboard({offsetX:384,offsetY:0});
const pasteAgainIds=new Set(pastedAgain.map(row=>row.components?.buildingPiece?.roomId));
assert.equal(pasteAgainIds.size,1,'second paste must remain internally grouped');
const pasteAgainRoomId=[...pasteAgainIds][0];
assert.ok(![roomId,duplicateRoomId,pasteRoomId].includes(pasteAgainRoomId),'each paste invocation must isolate its semantic identity independently');

const source=fs.readFileSync(new URL('../src/studio/tools/creator-actions.mjs',import.meta.url),'utf8');
assert.match(source,/isolateSemanticRooms\(/,'duplicate/paste must explicitly isolate semantic room identities');
assert.match(source,/createCompositeCommand\(clones\.map/,'clone persistence must remain a composite CommandBus operation');
assert.doesNotMatch(source,/document\.entities\s*=|document\.entities\.splice|KELO_WORLD_EDIT/,'creator actions must not bypass CommandBus/authority with direct document mutation');
off();
console.log(JSON.stringify({ok:true,roomCloneIsolation:true,sourceRoomId:roomId,duplicateFresh:true,pasteFresh:true,repeatedPasteFresh:true,oneUndo:true,oneRedo:true,authorityBypass:false},null,2));