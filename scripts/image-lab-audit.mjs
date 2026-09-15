/* KELO-INDEX
 * area: CREATORS / IMAGE LAB / AUDIT
 * keys: IMAGE LAB NONDESTRUCTIVE ORIGINAL REVISION RESET PNG JPEG STORE AUDIT
 * purpose: protect source immutability, replayable revisions, reset semantics and format policy
 * online: N/A; deterministic authoring audit
 */
import assert from 'node:assert/strict';
import {createImageLabProject,appendImageLabOperation,replaceImageLabOperation,resetImageLabWorkingCopy,createImageLabRevision,resolveImageLabOperations} from '../src/creators/assets/image-lab-project.mjs';
import {normalizeImageFormat,imageExportPolicy,buildImageExportName} from '../src/creators/assets/image-format-converter.mjs';
import {createImageLabSourceStore} from '../src/creators/assets/image-lab-source-store.mjs';

let project=createImageLabProject({name:'Imperial Gate',source:{sourceId:'source-gate-a',name:'gate.jpg',mimeType:'image/jpeg',size:12345,width:1200,height:900}});
assert.equal(project.source.immutable,true);assert.equal(project.source.sourceId,'source-gate-a');assert.equal(project.working.operations.length,0);
project=appendImageLabOperation(project,{operationId:'trim-1',type:'trim-alpha',params:{padding:2,threshold:0}});
project=appendImageLabOperation(project,{operationId:'alpha-1',type:'alpha-snap',params:{transparentBelow:8,opaqueAbove:248}});
project=createImageLabRevision(project,{label:'clean-v1'});const revisionId=project.revisions[0].revisionId;
assert.equal(resolveImageLabOperations(project,{revisionId})[0].params.padding,2);
project=replaceImageLabOperation(project,'trim-1',{params:{padding:12,threshold:0}});
assert.equal(resolveImageLabOperations(project)[0].params.padding,12);assert.equal(resolveImageLabOperations(project,{revisionId})[0].params.padding,2,'saved revision must be immutable after later edits');
const reset=resetImageLabWorkingCopy(project);assert.equal(reset.working.operations.length,0);assert.equal(reset.source.sourceId,'source-gate-a');assert.equal(reset.revisions.length,1,'reset working copy must not erase saved revisions');

assert.equal(normalizeImageFormat('image/png'),'png');assert.equal(normalizeImageFormat('jpg'),'jpeg');assert.equal(imageExportPolicy('png').lossy,false);assert.equal(imageExportPolicy('jpeg').lossy,true);assert.match(imageExportPolicy('png').description,/cannot restore detail/i);assert.equal(buildImageExportName('gate.original.jpg','png',{suffix:'kelo'}),'gate.original-kelo.png');

const store=createImageLabSourceStore({indexedDBFactory:null});const original=new Blob(['jpeg-source-bytes'],{type:'image/jpeg'});await store.saveOriginal(reset.source.sourceId,original,reset.source);await store.saveProject(reset);const loaded=await store.loadOriginal(reset.source.sourceId);assert.equal(await loaded.blob.text(),'jpeg-source-bytes');const restored=await store.loadProject(reset.projectId);assert.equal(restored.source.sourceId,reset.source.sourceId);assert.equal((await store.listProjects()).length,1);
await assert.rejects(()=>store.saveOriginal(reset.source.sourceId,new Blob(['replacement'])),/IMAGE_LAB_SOURCE_IMMUTABLE/);await store.close();

console.log(JSON.stringify({ok:true,sourceImmutable:true,revisionSnapshot:true,resetToOriginal:true,pngAddsLossyCompression:false,jpegExportLossy:true,localOriginalStore:true}));
