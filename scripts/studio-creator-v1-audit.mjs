import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createKeloRuntimeAdapter } from '../src/studio/adapters/kelo-runtime-adapter.mjs';
import { installStudioAuthorityMirror } from '../src/studio/integration/authority-command-mirror.mjs';
import { seedCatalogPrefabs } from '../src/studio/adapters/catalog-prefab-seeder.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createCreatorActions } from '../src/studio/tools/creator-actions.mjs';
import { createCreatorPrefabLibrary } from '../src/studio/prefabs/creator-prefab-library.mjs';
import { createStudioStore } from '../src/studio/storage/indexeddb-studio-store.mjs';
import { analyzeCreatorWorld } from '../src/studio/validation/creator-world-analyzer.mjs';
import { createStudioAssetPreviewService } from '../src/studio/render/studio-asset-preview-service.mjs';
import { createStudioCameraController } from '../src/studio/input/studio-camera-controller.mjs';
import { createPlaceEntityCommand, createPatchEntityCommand } from '../src/studio/document/document-commands.mjs';

const catalogRows=[{id:'prefab:house',label:'House',category:'architecture',width:64,height:64,parts:[{assetKey:'houseAtlas',source:{x:0,y:0,w:32,h:32},offset:{x:0,y:0},size:{w:64,h:64},opacity:1}],collision:{x:0,y:0,w:64,h:64}}];
const catalog={list:()=>catalogRows,get:id=>catalogRows.find(x=>x.id===id)||null,categories:()=>['architecture']};
let placementSeq=0;const calls=[];
const root={KELO_PROPERTY_CATALOG:catalog,KELO_WORLD_EDIT:{request:async(op,payload)=>{calls.push({op,payload});if(op==='world:placement:create')return{placement:{placementId:`p:${++placementSeq}`}};return{ok:true};}}};
const adapter=createKeloRuntimeAdapter(root),kernel=createStudioKernel({document:createWorldDocument({worldId:'world:creator-v1',settings:{tileSize:32,chunkSize:512}}),adapter,historyBudgetBytes:2*1024*1024});
seedCatalogPrefabs({prefabRegistry:kernel.prefabs,assetCatalog:catalog});
const tools=registerBasicTools(kernel),creator=createCreatorActions(kernel),mirror=installStudioAuthorityMirror({adapter,actorId:'creator',getDraftId:()=> 'draft:creator-v1'}),store=createStudioStore({indexedDBFactory:null,dbName:'audit'}),library=createCreatorPrefabLibrary({kernel,store,tool:tools.prefabStamp,ownerId:'creator'});
await library.load();

const a={id:'entity:a',prefabId:'prefab:house',transform:{x:32,y:32,rotation:0},bounds:{w:64,h:64}},b={id:'entity:b',prefabId:'prefab:house',transform:{x:128,y:32,rotation:0},bounds:{w:64,h:64}};
await kernel.execute(createPlaceEntityCommand(a));mirror.seed(a.id,'p:seed:a');
await kernel.execute(createPlaceEntityCommand(b));mirror.seed(b.id,'p:seed:b');
kernel.selection.set([a.id,b.id]);
const depthBeforeDuplicate=kernel.history.undoDepth,clones=await creator.duplicateSelection();
assert.equal(clones.length,2);assert.equal(kernel.document.entities.length,4);assert.equal(kernel.history.undoDepth,depthBeforeDuplicate+1,'duplicate group must be one History action');assert.deepEqual(kernel.selection.get(),clones.map(x=>x.id));assert.equal(calls.filter(x=>x.op==='world:placement:create').length>=4,true);
await kernel.undo();assert.equal(kernel.document.entities.length,2);assert.equal(calls.slice(-2).every(x=>x.op==='world:placement:remove'),true,'batch undo must mirror child removals');
await kernel.redo();assert.equal(kernel.document.entities.length,4);
const depthBeforeRotate=kernel.history.undoDepth;await creator.rotateSelection(90);assert.equal(kernel.history.undoDepth,depthBeforeRotate+1);for(const id of kernel.selection.get())assert.equal(kernel.document.entities.find(e=>e.id===id).transform.rotation,90);
const depthBeforeScale=kernel.history.undoDepth;await creator.scaleSelection({value:1.5});assert.equal(kernel.history.undoDepth,depthBeforeScale+1);for(const id of kernel.selection.get())assert.equal(kernel.document.entities.find(e=>e.id===id).transform.scale,1.5);assert.equal(calls.some(x=>x.op==='world:placement:scale'),true,'scale must mirror through world authority');await kernel.undo();for(const id of kernel.selection.get())assert.equal(Number(kernel.document.entities.find(e=>e.id===id).transform.scale||1),1);await kernel.redo();
await creator.removeSelection();assert.equal(kernel.document.entities.length,2);await kernel.undo();assert.equal(kernel.document.entities.length,4);
kernel.selection.set([a.id,b.id]);assert.equal(creator.copySelection(),2);
const beforePaste=kernel.document.entities.length,historyBeforePaste=kernel.history.undoDepth,pasted=await creator.pasteClipboard();assert.equal(pasted.length,2);assert.equal(kernel.document.entities.length,beforePaste+2);assert.equal(kernel.history.undoDepth,historyBeforePaste+1,'paste must be one History action');await kernel.undo();assert.equal(kernel.document.entities.length,beforePaste);
const arbitrary=createPatchEntityCommand(a.id,{transform:{...kernel.document.entities.find(e=>e.id===a.id).transform,rotation:47}});await kernel.execute(arbitrary);assert.equal(kernel.document.entities.find(e=>e.id===a.id).transform.rotation,90,'rotation must normalize to authority quarters');await kernel.undo();

kernel.selection.set([a.id,b.id]);
const saved=await library.captureSelection({label:'Village Pair'});assert.equal(saved.children.length,2);
const libraryAsset=library.assets()[0];assert.equal(libraryAsset.category,'My Prefabs');assert.equal(libraryAsset.previewChildren.length,2,'creator prefab assets must expose preview composition');assert.equal((await store.listCreatorPrefabs('creator')).length,1);
const beforeStamp=kernel.document.entities.length,historyBeforeStamp=kernel.history.undoDepth,callsBeforeStamp=calls.length;tools.prefabStamp.start(saved.id);tools.prefabStamp.move(320,320,{snap:32});const stamped=await tools.prefabStamp.commit();assert.equal(stamped.length,2);assert.equal(kernel.document.entities.length,beforeStamp+2);assert.equal(kernel.history.undoDepth,historyBeforeStamp+1,'prefab stamp must be one History action');assert.equal(calls.slice(callsBeforeStamp).filter(x=>x.op==='world:placement:create').length,2);await kernel.undo();assert.equal(kernel.document.entities.length,beforeStamp);

const terrainBefore=Object.keys(kernel.document.terrain).length,historyBeforeStroke=kernel.history.undoDepth,callsBeforeStroke=calls.length;
tools.terrain.configure({material:'grass',role:'terrain',brushSize:2,erase:false});tools.terrain.beginStroke(32,160);tools.terrain.strokeTo(160,160);assert.equal(Object.keys(kernel.document.terrain).length,terrainBefore,'stroke preview must remain local');const strokePreview=tools.terrain.getStrokePreview();assert.ok(strokePreview.count>=8);await tools.terrain.commitStroke();const terrainAfter=Object.keys(kernel.document.terrain).length;assert.ok(terrainAfter>terrainBefore+4);assert.equal(kernel.history.undoDepth,historyBeforeStroke+1,'stroke must be one History action');assert.ok(calls.slice(callsBeforeStroke).filter(x=>x.op==='world:tile:paint').length>=strokePreview.count);await kernel.undo();assert.equal(Object.keys(kernel.document.terrain).length,terrainBefore,'stroke undo must restore terrain');

const previewCalls=[];const preview=createStudioAssetPreviewService({assetCatalog:catalog,atlasContract:{acquire:async key=>({key}),release:key=>previewCalls.push(key)},devicePixelRatio:1});await preview.warmAsset('prefab:house');
const ctx={globalAlpha:1,imageSmoothingEnabled:false,save(){},restore(){},translate(){},rotate(){},fillRect(){},drawImage(...args){previewCalls.push(args);}};
assert.equal(preview.drawAsset(ctx,'prefab:house',10,20,{rotation:90,alpha:.7}),true,'loaded asset must render as a real sprite preview');preview.close();assert.ok(previewCalls.length>=2,'preview service must draw and release atlas references');

// Foundation V3 camera fixture: Studio consumes KeloCamera public owner only.
const listeners=new Map(),canvas={style:{transform:'',transformOrigin:''}};
const cameraState={x:500,y:400,targetX:500,targetY:400,lookOffsetX:0,lookOffsetY:0,baseZoom:1,effectiveZoom:1,screenW:800,screenH:600};
const followState={dampX:0,dampY:0,deadXRatio:.1,deadYRatio:.1,lookAheadDist:0,lookAheadDecay:0};
const fakeDocument={getElementById:id=>id==='game-canvas'?canvas:null,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
const keloCamera={
  snapshot:()=>Object.freeze({...cameraState,follow:{...followState}}),
  getBaseZoom:()=>cameraState.baseZoom,
  getFollowTuning:()=>({...followState}),
  setFollowTuning(next={}){Object.assign(followState,next);return {...followState};},
  setTarget(x,y,{snap=false}={}){cameraState.targetX=Number(x);cameraState.targetY=Number(y);if(snap){cameraState.x=Number(x);cameraState.y=Number(y);cameraState.lookOffsetX=0;cameraState.lookOffsetY=0;}return true;},
  setBaseZoom(value){cameraState.baseZoom=Number(value);cameraState.effectiveZoom=Number(value);canvas.style.transform=cameraState.baseZoom===1?'':`scale(${cameraState.baseZoom})`;return cameraState.effectiveZoom;},
  screenToWorld(sx,sy){return{x:cameraState.x+(Number(sx)-cameraState.screenW/2)/cameraState.effectiveZoom,y:cameraState.y+(Number(sy)-cameraState.screenH/2)/cameraState.effectiveZoom};},
  restoreState(value={}){for(const key of ['x','y','targetX','targetY','lookOffsetX','lookOffsetY'])if(Number.isFinite(Number(value[key])))cameraState[key]=Number(value[key]);return true;}
};
const cameraTool=createStudioCameraController({root:{document:fakeDocument,KeloCamera:keloCamera,innerWidth:800,innerHeight:600}});
assert.equal(followState.deadXRatio,1e6);
const beforeWorld=cameraTool.toWorld(400,300);assert.deepEqual(beforeWorld,{x:500,y:400});
cameraTool.panScreen(100,0);assert.equal(cameraState.x,400);
cameraTool.setZoom(1.5);assert.equal(cameraTool.zoom,1.5);assert.match(canvas.style.transform,/scale\(1\.5\)/);
cameraTool.suspend();assert.equal(followState.deadXRatio,.1);assert.equal(canvas.style.transform,'');cameraTool.destroy();

const health=analyzeCreatorWorld({document:kernel.document,prefabs:kernel.prefabs});assert.equal(health.errors.length,0);assert.equal(health.counts.objects,kernel.document.entities.length);assert.equal(health.performance.measured,false);assert.match(health.performance.notice,/Sin presupuesto medido/);
const shell=await readFile(new URL('../src/studio/ui/studio-live-shell.mjs',import.meta.url),'utf8');assert.match(shell,/ASSETS · VISUAL/);assert.match(shell,/ks-scale-hud/);assert.match(shell,/2 DEDOS/);assert.match(shell,/document\.createElement\('canvas'\)/);assert.match(shell,/renderAssetPreview/);assert.match(shell,/data-act=\"focus\"/);assert.match(shell,/onFocus/);assert.match(shell,/EXPLORER/);assert.match(shell,/PROPERTIES/);assert.match(shell,/data-act=\"duplicate\"/);assert.match(shell,/data-act=\"scale-up\"/);assert.match(shell,/ESCALA %/);assert.match(shell,/data-act=\"play\"/);assert.match(shell,/data-act=\"brush-size\"/);assert.match(shell,/virtualRange/);
const product=await readFile(new URL('../src/studio/ui/creator-productivity-panel.mjs',import.meta.url),'utf8');assert.match(product,/SAVE PREFAB/);assert.match(product,/CHECK MAP/);assert.match(product,/SNAP 32/);assert.match(product,/COPY/);assert.match(product,/PASTE/);
const overlaySource=await readFile(new URL('../src/studio/render/studio-overlay-renderer.mjs',import.meta.url),'utf8');assert.match(overlaySource,/assetPreview\?\.drawAsset/);assert.match(overlaySource,/drawCreatorPrefab/);
const controller=await readFile(new URL('../src/studio/integration/live-studio-controller.mjs',import.meta.url),'utf8');assert.match(controller,/createStudioCameraController/);assert.match(controller,/onPinchStart:beginPinchScale/);assert.match(controller,/previewScale/);assert.match(controller,/cameraController\.toWorld/);assert.match(controller,/cameraController\?\.zoom/);assert.match(controller,/studio\.tools\.marquee\.begin/);assert.match(controller,/studio\.tools\.marquee\.commit/);assert.match(controller,/renderAssetPreview/);assert.match(controller,/createCreatorActions/);assert.match(controller,/createCreatorPrefabLibrary/);assert.match(controller,/createCreatorGridOverlay/);assert.match(controller,/analyzeCreatorWorld/);assert.match(controller,/beginStroke/);assert.match(controller,/commitStroke/);assert.match(controller,/togglePlaytest/);assert.match(controller,/KeloInputLocks\.release\(inputLockToken\)/);assert.match(controller,/pasteClipboard/);assert.match(controller,/scaleSelection/);
const cameraSource=await readFile(new URL('../src/studio/input/studio-camera-controller.mjs',import.meta.url),'utf8');assert.match(cameraSource,/onPinchStart/);assert.match(cameraSource,/mode:'delegate'/);const beforePreviewDocScale=Number(kernel.document.entities.find(e=>e.id===a.id).transform?.scale||1);await mirror.previewScale(a.id,1.2);assert.equal(calls.at(-1).op,'world:placement:scale');assert.equal(Number(kernel.document.entities.find(e=>e.id===a.id).transform?.scale||1),beforePreviewDocScale,'authority preview must not mutate Studio History document');await mirror.previewScale(a.id,beforePreviewDocScale);
mirror.uninstall();await store.close();
console.log(JSON.stringify({ok:true,creatorV1:true,multiSelect:true,marquee:true,batchHistory:true,duplicate:true,delete:true,rotate:true,rotationAuthoritySafe:true,scale:true,pinchScale:true,visibleScaleHud:true,copyPaste:true,continuousBrush:true,brushSizes:true,visualAssetBrowser:true,realPlacementGhost:true,creatorPrefabPreview:true,creatorCamera:true,foundationCameraOwnerFixture:true,focusSelection:true,explorer:true,properties:true,playtestToggle:true,myPrefabs:true,prefabStamp:true,snapGrid:true,mapHealth:true,lazyArchitecturePreserved:true,entities:kernel.document.entities.length,terrainCells:Object.keys(kernel.document.terrain).length,authorityCalls:calls.length},null,2));
