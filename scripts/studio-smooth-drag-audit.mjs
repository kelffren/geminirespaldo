import assert from 'node:assert/strict';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'world:smooth-drag',settings:{tileSize:32,chunkSize:512}})});
const tools=registerBasicTools(kernel);
const entity=(id,x,y)=>({id,prefabId:'audit',transform:{x,y,rotation:0},bounds:{w:32,h:32}});

await kernel.execute(createPlaceEntityCommand(entity('entity:a',32,32)));
await kernel.execute(createPlaceEntityCommand(entity('entity:b',128,32)));

kernel.selection.set('entity:a');
tools.transform.begin('entity:a');
let preview=tools.transform.previewMove(47,51,{snap:32});
assert.equal(preview.x,47,'preview must follow the pointer freely on X');
assert.equal(preview.y,51,'preview must follow the pointer freely on Y');
await tools.transform.commit();
let a=kernel.document.entities.find(row=>row.id==='entity:a');
assert.equal(a.transform.x,32,'commit must snap X to the configured grid');
assert.equal(a.transform.y,64,'commit must snap Y to the configured grid');

kernel.selection.set(['entity:a','entity:b']);
tools.transform.begin('entity:a');
preview=tools.transform.previewMove(95,70,{snap:32});
const previews=tools.transform.getPreviews();
assert.equal(preview.x,95,'group anchor preview must remain smooth');
assert.equal(previews.find(row=>row.entityId==='entity:b').x,191,'group members must preserve their relative offset while previewing');
await tools.transform.commit();
a=kernel.document.entities.find(row=>row.id==='entity:a');
const b=kernel.document.entities.find(row=>row.id==='entity:b');
assert.equal(a.transform.x,96,'group anchor must snap only on release');
assert.equal(a.transform.y,64,'group anchor Y must snap only on release');
assert.equal(b.transform.x,192,'group member must keep its offset after snapped commit');
assert.equal(b.transform.y,32,'group member Y offset must remain stable');

console.log(JSON.stringify({ok:true,smoothPreview:true,snapOnRelease:true,groupOffsets:true},null,2));
