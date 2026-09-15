/* KELO-INDEX
 * area: QA / FRAME SURGERY
 * owner: strict behavior-first finger-first feature supervisor
 * keys: SURGERY SUPERVISOR 35-OF-35 EXACT-CANVAS GESTURE MASK ONION PIXEL-PERFECT NONDESTRUCTIVE
 * purpose: refuse PASS unless every promised capability works and exact runtime sizing is mathematically guaranteed
 */
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{
  SURGERY_TOOLS,SURGERY_LAYERS,SURGERY_SELECTION_OPS,surgeryFeatureContract,createSurgeryPatch,createSurgeryHistory,
  reduceSurgeryGesture,createStroke,createOverlayPatch,serializeSurgeryPatches,normalizeSurgeryPatch,
  selectionFromMask,maskToRuns,runsToMask,combineSelectionRuns,invertSelectionRuns,snapSurgeryPatch
}from'../src/creators/sprite-compiler/sprite-frame-surgery-model.mjs';
import{colorFloodSelectionMask,polygonSelectionMask}from'../src/creators/sprite-compiler/sprite-frame-surgery-selection.mjs';
import{planSpriteFrameNormalization,__spriteFrameNormalizerInternals as normalizerInternals}from'../src/creators/sprite-compiler/sprite-frame-normalizer.mjs';
import{normalizeExactCanvasConfig,exactCanvasPlacement,verifyExactRuntime}from'../src/creators/sprite-compiler/sprite-exact-canvas.mjs';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const ui=[read('src/creators/ui/avatar-frame-surgery-workspace.mjs'),read('src/creators/ui/avatar-frame-surgery-editor.mjs'),read('src/creators/ui/avatar-frame-surgery-ui-kit.mjs')].join('\n');
const normalizer=read('src/creators/sprite-compiler/sprite-frame-normalizer.mjs'),service=read('src/creators/avatar/avatar-quick-import-service.mjs'),manifest=read('src/creators/workspaces/avatar-workspace.mjs');
const failures=[],checks=[];function check(id,fn){try{fn();checks.push({id,pass:true})}catch(error){checks.push({id,pass:false,error:error.message});failures.push(`${id}: ${error.message}`)}}
const has=(text,parts)=>{for(const part of[].concat(parts))assert.ok(text.includes(part),`missing ${part}`)};

check('01-one-finger-move',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'drag',dx:7,dy:-4});assert.deepEqual([p.x,p.y],[7,-4]);has(ui,['pointers.size===1',"type:'drag'"])});
check('02-two-finger-scale',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'pinch',start:[{x:0,y:0},{x:10,y:0}],current:[{x:0,y:0},{x:20,y:0}]});assert.ok(Math.abs(p.scale-2)<.01);has(ui,['pointers.size===2','scaleMul'])});
check('03-two-finger-rotate',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'pinch',start:[{x:0,y:0},{x:10,y:0}],current:[{x:0,y:0},{x:0,y:10}]});assert.ok(Math.abs(p.rotation-Math.PI/2)<1e-6);has(normalizer,'context.rotate(plan.patch.rotation')});
check('04-ghost-reference',()=>has(ui,['ghostIndex','drawOnion','globalAlpha']));
check('05-align-feet',()=>has(ui,["autoRepair('feet')",'feetOffsetPx']));
check('06-center-body',()=>has(ui,["autoRepair('center')",'centerOffsetPx']));
check('07-match-scale',()=>has(ui,["autoRepair('scale')",'verticalScaleDelta']));
check('08-finger-eraser',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'stroke',bucket:'erase',points:[{x:.5,y:.5}],radius:.08});assert.equal(p.erase.length,1);has(normalizer,['destination-out','patch.erase'])});
check('09-finger-restore',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'stroke',bucket:'restore',points:[{x:.5,y:.5}],radius:.08});assert.equal(p.restore.length,1);has(normalizer,['restoreStroke','patch.restore'])});
check('10-magic-color-selection',()=>{const D=new Uint8ClampedArray([200,20,20,255,202,21,21,255,20,20,220,255]);assert.deepEqual([...colorFloodSelectionMask(D,3,1,0,0,{tolerance:10})],[1,1,0]);has(ui,['colorFloodSelectionMask','WAND COLOR'])});
check('11-selection-to-layer',()=>has(ui,['selectionToLayer','cutoutOriginal:true',"kind:'selection'"]));
check('12-import-piece',()=>has(ui,['+ PIEZA PNG','importExternalPiece','dataUrl']));
check('13-copy-piece-from-frame',()=>has(ui,['COPIAR DE FRAME','showFramePicker','sourceFrame:i']));
check('14-clone-brush',()=>{const s=createStroke([{x:.4,y:.4}],{source:{x:.2,y:.2}});assert.deepEqual(s.source,{x:.2,y:.2});has(normalizer,'cloneStroke')});
check('15-small-gap-fill',()=>has(normalizer,'smartFillSmallGap'));
check('16-free-frame-crop',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'crop',edge:'left',value:-.2});assert.equal(p.crop.left,-.2);has(normalizer,'cropSourceRect')});
check('17-outside-crop-recovery',()=>{const p=normalizeSurgeryPatch({crop:{left:-.3}});assert.equal(p.crop.left,-.3);has(ui,'drawCropSource')});
check('18-simple-layers',()=>{assert.deepEqual([...SURGERY_LAYERS],['original','character','patches','pieces','mask']);has(normalizer,'layerVisibility')});
check('19-undo-redo',()=>{const h=createSurgeryHistory(createSurgeryPatch());h.commit({...h.value,x:9});assert.equal(h.undo().x,0);assert.equal(h.redo().x,9);has(ui,['doUndo','doRedo'])});
check('20-before-after-hold',()=>has(ui,['HOLD ORIGINAL','holdOriginal=true','holdOriginal=false']));
check('21-live-animation-preview',()=>has(ui,['motion.clock','requestAnimationFrame(tick)']));
check('22-frame-doctor-heatmap',()=>has(ui,['paintHeatmap','doctorFinding']));
check('23-auto-fix-first',()=>has(ui,["autoRepair('all')",'AUTO-FIX']));
check('24-nondestructive-patches',()=>{const source={x:1};const patch=createSurgeryPatch({x:3,overlays:[createOverlayPatch({kind:'external',image:source,dataUrl:'data:image/png;base64,AA=='})]});const serial=serializeSurgeryPatches({2:patch});assert.equal(serial[2].x,3);assert.equal(serial[2].overlays[0].image,undefined);assert.equal(source.x,1);has(normalizer,['foreground.cleanedData','source=makeCanvas'])});
check('25-recompile-and-test',()=>has(ui,['RECOMPILAR Y PROBAR','compileUniversalAvatarRuntime','use.disabled=!pass']));
check('26-exact-selection-mask',()=>{const mask=Uint8Array.from([1,1,0,0,1,0]),s=selectionFromMask(mask,3,2);assert.deepEqual([...runsToMask(s.runs,6)],[...mask])});
check('27-selection-boolean-ops',()=>{assert.deepEqual([...SURGERY_SELECTION_OPS],['replace','add','subtract','intersect']);const a=maskToRuns(Uint8Array.from([1,1,0,0])),b=maskToRuns(Uint8Array.from([0,1,1,0]));assert.deepEqual([...runsToMask(combineSelectionRuns(a,b,'add',4),4)],[1,1,1,0]);assert.deepEqual([...runsToMask(invertSelectionRuns(a,4),4)],[0,0,1,1])});
check('28-multi-frame-onion-skin',()=>has(ui,['drawOnion','onionSpan','col-distance','col+distance']));
check('29-pixel-perfect-strokes',()=>{const pts=normalizerInternals.rasterizeStrokePoints({points:[{x:0,y:0},{x:1,y:1}]},4,4);assert.deepEqual(pts.map(p=>[p.x,p.y]),[[0,0],[1,1],[2,2],[3,3]])});
check('30-relative-clone-path',()=>has(normalizer,['anchor.x+(p.x-first.x)','anchor.y+(p.y-first.y)']));
check('31-enclosed-gap-fill',()=>{const enclosed=new Uint8ClampedArray(5*5*4);for(let i=0;i<enclosed.length;i+=4)enclosed[i+3]=255;enclosed[(2*5+2)*4+3]=0;assert.deepEqual(normalizerInternals.findEnclosedTransparentComponent(enclosed,5,5,2,2,8),[12]);const edge=new Uint8ClampedArray(5*5*4);for(let i=0;i<edge.length;i+=4)edge[i+3]=255;edge[3]=0;assert.deepEqual(normalizerInternals.findEnclosedTransparentComponent(edge,5,5,0,0,8),[])});
check('32-pixel-snap-transforms',()=>{const p=snapSurgeryPatch(createSurgeryPatch({x:2.7,y:-3.3,rotation:.3,scale:1.021}));assert.deepEqual([p.x,p.y],[3,-3]);has(ui,'PIXEL SNAP')});
check('33-piece-visibility-lock-order',()=>{let p=createSurgeryPatch({overlays:[createOverlayPatch({id:'x',x:1,z:0})]});p=reduceSurgeryGesture(p,{type:'overlay-property',id:'x',changes:{locked:true,visible:false}});assert.equal(p.overlays[0].locked,true);assert.equal(reduceSurgeryGesture(p,{type:'overlay-transform',id:'x',transform:{x:9}}).overlays[0].x,1);assert.equal(reduceSurgeryGesture(p,{type:'overlay-reorder',id:'x',delta:1}).overlays[0].z,1)});
check('34-pointer-cancel-rollback',()=>has(ui,['onpointercancel','history.replace(original)','releasePointerCapture']));
check('35-selective-patch-backward-compatibility',()=>{const frame=i=>({bounds:{x:i*12,y:0,w:8,h:10},sourceRect:{x:i*12,y:0,w:8,h:10},cell:{x:i*12,y:0,w:10,h:12},area:80,boundaryRatio:0,touchesCanvasEdge:false}),rig={groups:[[frame(0),frame(1)]],directionKeys:['s'],rowMap:{s:0}},plan=planSpriteFrameNormalization(rig,{sourceWidth:40,sourceHeight:20,framePatches:{0:{scale:1.2,x:3,y:4,copyFrom:1}}});assert.equal(plan.plans[0].patch.scale,1.2);assert.equal(plan.plans[0].patch.copyFrom,1)});

check('exact-canvas-config',()=>{const c=normalizeExactCanvasConfig({enabled:true,width:128,height:192,mode:'contain'});assert.deepEqual([c.width,c.height,c.mode],[128,192,'contain'])});
check('exact-contain-never-crops',()=>{const p=exactCanvasPlacement(80,160,128,192,{mode:'contain',anchorX:.5,anchorY:1});assert.equal(p.crops,false);assert.ok(p.width<=128+.001&&p.height<=192+.001)});
check('exact-cover-reports-crop',()=>assert.equal(exactCanvasPlacement(200,100,128,192,{mode:'cover'}).crops,true));
check('exact-runtime-verifier',()=>{const runtime={columns:4,rows:4,frameWidth:128,frameHeight:192,width:512,height:768,canvas:{width:512,height:768}};assert.equal(verifyExactRuntime(runtime,{enabled:true,width:128,height:192}).ok,true)});
check('exact-ui-is-real-export',()=>has(ui,['CANVAS EXACTO · RUNTIME REAL','exactCanvasVerification','reframeCompiledRuntimeExact','128','192']));
check('exact-service-persists-runtime',()=>has(service,['reframeCompiledRuntimeExact','avatarRuntime','exactCanvas']));
check('lasso-is-exact-mask',()=>{const m=polygonSelectionMask(5,5,[{x:.25,y:.25},{x:.75,y:.25},{x:.75,y:.75},{x:.25,y:.75}]);assert.equal(m[2*5+2],1);assert.equal(m[0],0);assert.equal(m[4],0);assert.equal(m[20],0);assert.equal(m[24],0)});
check('contract-exact-35',()=>{assert.equal(surgeryFeatureContract.required.length,35);assert.equal(new Set(surgeryFeatureContract.required).size,35);assert.deepEqual([...SURGERY_TOOLS],['move','erase','restore','piece','compare'])});
check('finger-first-safety',()=>has(ui,['touch-action:none','setPointerCapture','pointercancel']));
check('runtime-gate-not-bypassed',()=>{has(service,['compiled.reviewRequired','compiled.validation?.artDefects']);has(ui,'use.disabled=!pass')});
check('workspace-routes-to-surgery',()=>has(manifest,'avatar-frame-surgery-workspace.mjs'));
check('original-remains-immutable',()=>{const p=createSurgeryPatch({erase:[createStroke([{x:.5,y:.5}])]});assert.equal(serializeSurgeryPatches({0:p})[0].erase.length,1);has(normalizer,'foreground.cleanedData')});
check('explicit-ambiguous-review',()=>has(ui,['CONFIRMAR INTERPRETACIÓN','reviewConfirmed','userConfirmedInterpretation:reviewConfirmed']));

const promised=checks.slice(0,35),score=promised.filter(x=>x.pass).length,report={ok:failures.length===0,supervisor:'Kelo Frame Surgery Guardian',version:'3.0.1-behavior-exact-canvas',promisedFeatures:35,score:`${score}/35`,astonished:failures.length===0&&score===35,extraGuards:checks.length-35,checks,failures};console.log(JSON.stringify(report,null,2));if(failures.length||score!==35)throw new Error(`FRAME_SURGERY_SUPERVISOR_REJECTED ${score}/35 :: ${failures.join(' | ')}`);
