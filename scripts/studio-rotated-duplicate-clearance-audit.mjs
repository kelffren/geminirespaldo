import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createCreatorActions,smartDuplicateOffset,findClearDuplicateOffset} from '../src/studio/tools/creator-actions.mjs';

const source={id:'rotated-wall',prefabId:'wall',transform:{x:0,y:0,rotation:90},bounds:{w:64,h:16},components:{}};
const blocker={id:'blocker',prefabId:'post',transform:{x:50,y:-24,rotation:0},bounds:{w:10,h:64},components:{}};

assert.deepEqual(smartDuplicateOffset([source],32),{dx:32,dy:0},'90° wall footprint must use its rotated 16px visual width instead of raw 64px width');
assert.deepEqual(findClearDuplicateOffset([source],[source,blocker],32),{dx:0,dy:64},'smart duplicate must reject the visually-overlapping +X candidate and choose the clear +Y candidate');

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:rotated-duplicate-clearance',settings:{tileSize:32,chunkSize:256},entities:[source,blocker]})});
const actions=createCreatorActions(kernel);kernel.tools.register?.({...actions,id:'creatorActions'});kernel.selection.set([source.id]);
let executed=null;const off=kernel.commands.on(event=>{if(event.type==='execute')executed=event.command;});

const clones=await actions.duplicateSelection({armGrab:false});
assert.equal(clones.length,1,'duplicate must create one clone');
assert.deepEqual([clones[0].transform.x,clones[0].transform.y,clones[0].transform.rotation],[0,64,90],'real duplicate must use the rotation-aware clear offset and preserve orientation');
assert.equal(kernel.history.undoDepth,1,'duplicate must remain one history entry');
assert.equal(executed?.type,'entity.batch.duplicate','duplicate must remain one composite CommandBus operation');
assert.equal(executed?.commands?.length,1,'single duplicate must serialize one child place command');
assert.equal(kernel.document.entities.length,3,'duplicate must persist exactly one new entity');

await kernel.undo();
assert.equal(kernel.document.entities.length,2,'one Undo must remove only the duplicate');
assert.ok(kernel.document.entities.some(row=>row.id===source.id)&&kernel.document.entities.some(row=>row.id===blocker.id),'Undo must preserve source and blocker');
await kernel.redo();
assert.equal(kernel.document.entities.length,3,'one Redo must restore the duplicate');
assert.equal(kernel.history.undoDepth,1,'Redo must restore one history entry');

const creatorSource=fs.readFileSync(new URL('../src/studio/tools/creator-actions.mjs',import.meta.url),'utf8');
assert.match(creatorSource,/Math\.abs\(Math\.cos\(radians\)\)/,'duplicate clearance must account for rotated AABB geometry');
assert.doesNotMatch(creatorSource,/document\.entities\s*=|document\.entities\.splice|KELO_WORLD_EDIT/,'creator actions must not bypass CommandBus/authority with direct document mutation');
off();
console.log(JSON.stringify({ok:true,phase:7.3,rotationAwareClearance:true,rawWidth:64,rotatedVisualWidth:16,rejectedOffset:[32,0],chosenOffset:[0,64],oneUndo:true,oneRedo:true,authorityBypass:false},null,2));