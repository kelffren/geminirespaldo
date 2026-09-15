import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createCreatorActions} from '../src/studio/tools/creator-actions.mjs';

const entity=(id,x,y,{rotation=0,w=32,h=32}={})=>({id,prefabId:'wall',transform:{x,y,rotation,scale:1},bounds:{w,h},components:{buildingPiece:{type:'wall',system:'quick-build',version:3,prefabId:'wall'}}});
const source=entity('source',0,0);
const blockers=[entity('block-right',32,0),entity('block-down',0,32)];
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:paste-clearance',settings:{tileSize:32,chunkSize:256},entities:[source,...blockers]})});
const actions=createCreatorActions(kernel);
kernel.selection.set('source');
assert.equal(actions.copySelection(),1,'copy must capture source entity');

const executed=[];const off=kernel.commands.on(event=>{if(event.type==='execute')executed.push(event.command);});
const first=await actions.pasteClipboard();
assert.equal(first.length,1,'automatic paste must create one clone');
assert.deepEqual({x:first[0].transform.x,y:first[0].transform.y},{x:-32,y:0},'automatic paste must skip blocked +X/+Y candidates and choose the first clear slot');
assert.equal(kernel.history.undoDepth,1,'automatic paste must occupy one history entry');
assert.equal(executed.at(-1)?.type,'entity.batch.paste','automatic paste must remain one composite CommandBus operation');

await kernel.undo();
assert.equal(kernel.document.entities.some(row=>row.id===first[0].id),false,'one Undo must remove the automatic paste');
await kernel.redo();
assert.equal(kernel.document.entities.some(row=>row.id===first[0].id),true,'one Redo must restore the automatic paste');

const second=await actions.pasteClipboard();
assert.deepEqual({x:second[0].transform.x,y:second[0].transform.y},{x:0,y:-32},'repeated automatic paste must account for the previous pasted clone and choose another clear slot');
assert.notDeepEqual({x:second[0].transform.x,y:second[0].transform.y},{x:first[0].transform.x,y:first[0].transform.y},'repeated paste must not stack clones');
assert.equal(kernel.history.undoDepth,2,'second paste must add exactly one history entry');

const explicit=await actions.pasteClipboard({offsetX:96,offsetY:64});
assert.deepEqual({x:explicit[0].transform.x,y:explicit[0].transform.y},{x:96,y:64},'explicit paste offsets must remain authoritative and bypass automatic clearance placement');
assert.equal(kernel.history.undoDepth,3,'explicit paste must still be one history entry');
assert.ok(executed.slice(-3).every(command=>command?.type==='entity.batch.paste'),'all paste persistence must remain composite CommandBus operations');

const rotatedSource=entity('rotated',160,160,{rotation:90,w:64,h:16});
const rotatedBlocker=entity('rotated-block',192,160,{w:32,h:64});
kernel.document.entities.push(rotatedSource,rotatedBlocker);
kernel.selection.set('rotated');actions.copySelection();
const rotatedPaste=await actions.pasteClipboard();
assert.notDeepEqual({x:rotatedPaste[0].transform.x,y:rotatedPaste[0].transform.y},{x:192,y:160},'automatic paste clearance must respect rotated visual footprints');

const creatorSource=fs.readFileSync(new URL('../src/studio/tools/creator-actions.mjs',import.meta.url),'utf8');
assert.match(creatorSource,/findClearDuplicateOffset\(clipboard,kernel\.document\.entities,tile\)/,'automatic paste must reuse collision-aware clearance resolver');
assert.doesNotMatch(creatorSource,/document\.entities\s*=|document\.entities\.splice|KELO_WORLD_EDIT/,'paste must not bypass CommandBus/authority with direct document mutation');
off();
console.log(JSON.stringify({ok:true,phase:'7.5',tool:'automatic paste clearance',firstClear:{x:-32,y:0},secondClear:{x:0,y:-32},repeatedPasteNoStack:true,rotatedFootprintAware:true,explicitOffsetsPreserved:true,historyEntriesPerPaste:1,oneUndo:true,oneRedo:true,authorityBypass:false},null,2));