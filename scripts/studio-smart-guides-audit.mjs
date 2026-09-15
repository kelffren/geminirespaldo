import assert from 'node:assert/strict';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'world:smart-guides',settings:{tileSize:32,chunkSize:512}})});
const tools=registerBasicTools(kernel);
const entity=(id,x,y,w=32,h=32)=>({id,prefabId:'audit',transform:{x,y,rotation:0},bounds:{w,h}});

await kernel.execute(createPlaceEntityCommand(entity('moving',32,32,32,32)));
await kernel.execute(createPlaceEntityCommand(entity('target-edge',133,200,32,32)));

kernel.selection.set('moving');
tools.transform.begin('moving');
let preview=tools.transform.previewMove(98,32,{snap:32,smart:true,magnet:10});
assert.equal(preview.x,101,'right edge should magnetically meet target left edge');
assert.equal(preview.y,32,'unsnapped Y should remain smooth in preview');
let guides=tools.transform.getGuides();
assert.equal(guides.some(g=>g.axis==='x'&&g.position===133),true,'vertical edge guide must be exposed');
await tools.transform.commit();
let moving=kernel.document.entities.find(row=>row.id==='moving');
assert.equal(moving.transform.x,101,'magnetic X must win over 32px grid on release');
assert.equal(moving.transform.y,32,'non-magnetic Y must still use grid snap');

await kernel.execute(createPlaceEntityCommand(entity('target-center',300,200,64,64)));
kernel.selection.set('moving');
tools.transform.begin('moving');
preview=tools.transform.previewMove(315,70,{snap:32,smart:true,magnet:10});
assert.equal(preview.x,316,'center-to-center magnetism should correct the moving anchor by one pixel');
guides=tools.transform.getGuides();
const centerGuide=guides.find(g=>g.axis==='x'&&g.position===332);
assert.ok(centerGuide,'center alignment must expose a vertical guide at the target center');
assert.equal(centerGuide.kind,'center','guide should identify center alignment');
await tools.transform.commit();
moving=kernel.document.entities.find(row=>row.id==='moving');
assert.equal(moving.transform.x,316,'center magnetic alignment must persist after commit');
assert.equal(moving.transform.y,64,'Y without a guide must snap to the configured grid on release');

console.log(JSON.stringify({ok:true,edgeSnap:true,centerSnap:true,axisIndependent:true,gridFallback:true,visibleGuides:true},null,2));
