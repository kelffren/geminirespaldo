import assert from 'node:assert/strict';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createCreatorActions, smartDuplicateOffset } from '../src/studio/tools/creator-actions.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'world:duplicate-grab',settings:{tileSize:32,chunkSize:512}})});
const tools=registerBasicTools(kernel);
const creator=createCreatorActions(kernel);
const entity=(id,x,y,{w=32,h=32,scale=1}={})=>({id,prefabId:'audit',transform:{x,y,rotation:0,scale},bounds:{w,h}});

assert.deepEqual(smartDuplicateOffset([entity('smart:a',0,0)],32),{dx:32,dy:0},'single tile duplicate must land directly to the right, not diagonally');
assert.deepEqual(smartDuplicateOffset([entity('smart:wide',0,0,{w:70})],32),{dx:96,dy:0},'wide objects must clear their real footprint and align to snap');
assert.deepEqual(smartDuplicateOffset([entity('smart:scaled',0,0,{w:32,scale:2})],32),{dx:64,dy:0},'scaled objects must use scaled footprint');
assert.deepEqual(smartDuplicateOffset([entity('smart:left',32,0),entity('smart:right',128,0)],32),{dx:128,dy:0},'group duplicate must clear the whole selection footprint');

await kernel.execute(createPlaceEntityCommand(entity('entity:a',32,32)));
kernel.selection.set('entity:a');
const clones=await creator.duplicateSelection();
assert.equal(clones.length,1);
assert.equal(clones[0].transform.x,64,'default duplicate must be adjacent on X');
assert.equal(clones[0].transform.y,32,'default duplicate must preserve Y alignment');
assert.equal(kernel.selection.get()[0],clones[0].id,'duplicate must select the clone');
const armedHit=tools.select.selectPoint(9999,9999);
assert.equal(armedHit.id,clones[0].id,'first canvas contact after duplicate must grab the clone even on empty space');
assert.equal(kernel.selection.get()[0],clones[0].id,'armed grab must preserve clone selection');
const afterConsume=tools.select.selectPoint(9999,9999);
assert.equal(afterConsume,null,'armed grab must be one-shot');
assert.equal(kernel.selection.get().length,0,'normal empty-space selection must resume after armed grab is consumed');

await kernel.execute(createPlaceEntityCommand(entity('entity:b',128,32)));
kernel.selection.set(['entity:a','entity:b']);
const group=await creator.duplicateSelection();
assert.equal(group.length,2);
assert.deepEqual(group.map(row=>row.transform.x),[160,256],'group copies must preserve internal spacing while clearing the original footprint');
assert.deepEqual(group.map(row=>row.transform.y),[32,32],'group copies must stay aligned on Y');
const groupIds=group.map(row=>row.id);
assert.deepEqual(kernel.selection.get(),groupIds,'duplicate group must remain selected');
const groupHit=tools.select.selectPoint(-5000,-5000);
assert.equal(groupIds.includes(groupHit.id),true,'armed group grab must return one member of the duplicated selection');
assert.deepEqual(kernel.selection.get(),groupIds,'armed group grab must preserve the whole group for transform.begin');

const explicit=await creator.duplicateSelection({offsetX:7,offsetY:11,armGrab:false});
assert.equal(explicit[0].transform.x,167,'explicit X offset must remain supported');
assert.equal(explicit[0].transform.y,43,'explicit Y offset must remain supported');

console.log(JSON.stringify({ok:true,smartOffset:true,noDiagonal:true,scaledFootprint:true,groupFootprint:true,duplicateGrab:true,oneShot:true,explicitOffsets:true},null,2));
