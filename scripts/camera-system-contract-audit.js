/* KELO-INDEX
 * area: QA / CAMERA
 * owner: FOUNDATION CI
 * keys: CAMERA VIEWPORT WORLDVIEW ZOOM DPR TARGET RESTORE SCREEN WORLD ORIENTATION LIVE WRITERS CONTRACT DEADZONE
 * purpose: valida owner único KeloCamera, viewport world-space reusable, dead-zone screen-space estable, compatibilidad determinista y ausencia de nuevos owners paralelos en scripts LIVE
 * public-api: CLI
 * consumes: camera-system, world-map, engine-h, mobile-orientation, index.html y scripts runtime directos
 * state-owned: ninguno
 * extension-points: invariantes KeloCamera + allowlist legacy explícita y temporal
 * reuse: Foundation CI
 * legacy: engine-a conserva follow/Canvas bootstrap; KeloCamera compensa dead-zone legacy world-space; engine-b es el único writer legacy directo de target tolerado temporalmente
 * do-not: no sustituir browser smoke de rotación/viewport
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
function ok(cond,msg){if(!cond)throw new Error(msg);}
const source=fs.readFileSync('src/core/camera-system.js','utf8');
const hd=fs.readFileSync('engine-h.js','utf8');
const orientation=fs.readFileSync('src/ui/mobile-orientation.js','utf8');
const worldMap=fs.readFileSync('src/environment/world-map.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const trace=[];
const events=[];
const styleValues={};
const context={
  console,innerWidth:390,innerHeight:844,devicePixelRatio:2,screenW:390,screenH:844,
  camera:{x:100,y:200,targetX:100,targetY:200,lookOffsetX:0,lookOffsetY:0},
  CONFIG:{zoom:.82,roundPixels:false,dampX:10,dampY:8,deadXRatio:.2,deadYRatio:.16,lookAheadDist:45,lookAheadDecay:7},
  canvas:{width:390,height:844,style:{}},
  ctx:{imageSmoothingEnabled:true,setTransform:(...args)=>trace.push('transform:'+args.join(','))},
  updateCamera(dt){trace.push('legacy-update:'+dt);context.camera.x+=1;},
  resize(){trace.push('legacy-resize');},cycleZoom(){trace.push('legacy-cycle');},
  document:{documentElement:{style:{setProperty:(k,v)=>{styleValues[k]=v;}}}},
  CustomEvent:function(name,init){this.type=name;this.detail=init?.detail;},
  addEventListener(){},dispatchEvent(event){events.push(event);},visualViewport:{addEventListener(){}},
  requestAnimationFrame(fn){fn();return 1;},showToast(){},closeMenu(){}
};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'camera-system.js'});
ok(context.KeloCamera&&context.KELO_CAMERA_AUDIT?.owner==='KeloCamera','OWNER_NOT_INSTALLED');
ok(context.KeloCamera.version.startsWith('kelo-camera-v1.'),'VERSION');
ok(context.KELO_CAMERA_AUDIT.screenSpaceDeadZone===true,'SCREEN_SPACE_DEADZONE_AUDIT');
ok(typeof context.KeloCamera.setTarget==='function'&&typeof context.KeloCamera.restoreState==='function'&&typeof context.KeloCamera.screenToWorld==='function'&&typeof context.KeloCamera.worldToScreen==='function'&&typeof context.KeloCamera.worldView==='function','PUBLIC_API');
context.KeloCamera.setTarget(500,600,{source:'test'});
ok(context.camera.targetX===500&&context.camera.targetY===600,'TARGET_API');
context.camera.targetX=700;context.camera.targetY=800;
ok(context.KeloCamera.snapshot().targetX===700&&context.KeloCamera.snapshot().targetY===800,'LEGACY_TARGET_ADAPTER');
context.KeloCamera.restoreState({x:111,y:222,targetX:333,targetY:444,lookOffsetX:5,lookOffsetY:-4},{source:'test-restore'});
ok(context.camera.x===111&&context.camera.y===222&&context.camera.targetX===333&&context.camera.targetY===444&&context.camera.lookOffsetX===5&&context.camera.lookOffsetY===-4,'RESTORE_STATE_API');
context.KeloCamera.setFollowTuning({dampX:12,lookAheadDist:60});
ok(context.CONFIG.dampX===12&&context.CONFIG.lookAheadDist===60,'FOLLOW_TUNING_API');
context.CONFIG.dampY=9;
ok(context.KeloCamera.getFollowTuning().dampY===9,'LEGACY_TUNING_ADAPTER');
trace.length=0;context.updateCamera(.25);ok(trace.includes('legacy-update:0.25'),'LEGACY_FOLLOW_CALLED_ONCE');
context.KeloCamera.configureViewport({dprCap:2,pixelPerfect:true,roundPixels:true,smoothing:false,imageRendering:'pixelated'});
context.KeloCamera.setBaseZoom(1,'test-portrait');context.KeloCamera.syncViewport('test-portrait');
ok(context.canvas.width===780&&context.canvas.height===1688,'PORTRAIT_DPR_VIEWPORT');
ok(Math.abs(context.KeloCamera.getEffectiveZoom()-1)<1e-9,'PORTRAIT_ZOOM');
ok(Math.abs(context.CONFIG.deadXRatio-context.KeloCamera.getFollowTuning().deadXRatio)<1e-9&&Math.abs(context.CONFIG.deadYRatio-context.KeloCamera.getFollowTuning().deadYRatio)<1e-9,'PORTRAIT_DEADZONE_SCREEN_PARITY');
ok(context.CONFIG.roundPixels===true&&context.ctx.imageSmoothingEnabled===false,'HD_POLICY');
const portraitView=context.KeloCamera.worldView();
ok(Object.isFrozen(portraitView),'WORLD_VIEW_READ_ONLY');
ok(Math.abs(portraitView.w-390)<1e-9&&Math.abs(portraitView.h-844)<1e-9,'PORTRAIT_WORLD_VIEW_SPAN');
ok(Math.abs(portraitView.left-(context.camera.x-195))<1e-9&&Math.abs(portraitView.right-(context.camera.x+195))<1e-9,'PORTRAIT_WORLD_VIEW_X');
ok(Math.abs(portraitView.top-(context.camera.y-422))<1e-9&&Math.abs(portraitView.bottom-(context.camera.y+422))<1e-9,'PORTRAIT_WORLD_VIEW_Y');
const world={x:525,y:640};const screen=context.KeloCamera.worldToScreen(world.x,world.y);const roundTrip=context.KeloCamera.screenToWorld(screen.x,screen.y);
ok(Math.abs(roundTrip.x-world.x)<1e-9&&Math.abs(roundTrip.y-world.y)<1e-9,'SCREEN_WORLD_ROUNDTRIP');
const portraitBase=context.KeloCamera.getBaseZoom();context.innerWidth=844;context.innerHeight=390;context.KeloCamera.syncViewport('test-landscape');
const expected=portraitBase*(390/844);
ok(Math.abs(context.KeloCamera.getBaseZoom()-portraitBase)<1e-9,'BASE_ZOOM_STABLE_ON_ROTATE');
ok(Math.abs(context.KeloCamera.getEffectiveZoom()-expected)<1e-9,'LANDSCAPE_EQUIVALENT_ZOOM');
const landscapeFollow=context.KeloCamera.getFollowTuning();
ok(Math.abs(context.CONFIG.deadXRatio*expected-landscapeFollow.deadXRatio)<1e-9&&Math.abs(context.CONFIG.deadYRatio*expected-landscapeFollow.deadYRatio)<1e-9,'LANDSCAPE_DEADZONE_SCREEN_PARITY');
ok(context.canvas.width===1688&&context.canvas.height===780,'LANDSCAPE_DPR_VIEWPORT');
const landscapeView=context.KeloCamera.worldView();
ok(Math.abs(landscapeView.w-(844/expected))<1e-9&&Math.abs(landscapeView.h-(390/expected))<1e-9,'LANDSCAPE_WORLD_VIEW_SPAN');
ok(Math.abs(landscapeView.centerX-context.camera.x)<1e-9&&Math.abs(landscapeView.centerY-context.camera.y)<1e-9,'WORLD_VIEW_CENTER');
const before=context.KeloCamera.getBaseZoom();context.cycleZoom();
ok(Math.abs(context.KeloCamera.getBaseZoom()-before)>1e-6,'GLOBAL_CYCLE_OWNED');
ok(styleValues['--kelo-vw']==='844px'&&styleValues['--kelo-vh']==='390px','VIEWPORT_CSS_OWNER');
ok(events.some(e=>e.type==='kelo:viewportchange')&&events.some(e=>e.type==='kelo:camerazoomchange')&&events.some(e=>e.type==='kelo:camerarestore'),'OBSERVABILITY_EVENTS');
ok(context.KELO_CAMERA_AUDIT.worldViewOwner===true,'WORLD_VIEW_OWNER_AUDIT');
ok(hd.includes("cameraOwner = window.KeloCamera")&&hd.includes('cameraOwner.configureViewport')&&hd.includes('cameraOwner.syncViewport'),'ENGINE_H_CONSUMES_OWNER');
ok(!/\bCONFIG\.zoom\s*=/.test(hd),'ENGINE_H_DIRECT_ZOOM_WRITE');
ok(!/\b(?:window\.)?resize\s*=/.test(hd),'ENGINE_H_RESIZE_OVERRIDE');
ok(!/\b(?:window\.)?cycleZoom\s*=/.test(hd),'ENGINE_H_ZOOM_OVERRIDE');
ok(!/canvas\.(?:width|height)\s*=/.test(hd),'ENGINE_H_CANVAS_WRITE');
ok(orientation.includes("viewportOwner:'KeloCamera'")&&orientation.includes("zoomOwner:'KeloCamera'"),'ORIENTATION_OWNER_DECLARATION');
ok(!/\bCONFIG\.zoom\s*=/.test(orientation),'ORIENTATION_DIRECT_ZOOM_WRITE');
ok(!/canvas\.(?:width|height)\s*=/.test(orientation),'ORIENTATION_CANVAS_WRITE');
ok(!/\bwindow\.cycleZoom\s*=/.test(orientation),'ORIENTATION_CYCLE_OVERRIDE');
ok(!/\bwindow\.resize\s*=/.test(orientation),'ORIENTATION_RESIZE_OVERRIDE');
ok(worldMap.includes('CAM=window.KeloCamera')&&worldMap.includes('CAM.worldView()'),'WORLD_MAP_CONSUMES_WORLD_VIEW');
ok(!worldMap.includes('(window.screenW||innerWidth)/(2*z)')&&!worldMap.includes('(window.screenH||innerHeight)/(2*z)'),'WORLD_MAP_NO_DUPLICATE_VIEWPORT_MATH');
ok(worldMap.includes("viewportOwner:'KeloCamera'")&&worldMap.includes("viewportMode:'kelo-camera-world-view-v1'"),'WORLD_MAP_VIEWPORT_AUDIT');
const iA=html.indexOf('engine-a.js'),iC=html.indexOf('engine-c.js'),iCamera=html.indexOf('src/core/camera-system.js'),iAvatar=html.indexOf('src/core/avatar-render-system.js'),iH=html.indexOf('engine-h.js'),iOrientation=html.indexOf('src/ui/mobile-orientation.js'),iWorld=html.indexOf('src/environment/world-map.js');
ok(iA>=0&&iC>iA&&iCamera>iC&&iAvatar>iCamera&&iH>iCamera&&iOrientation>iCamera&&iWorld>iCamera,'LOAD_ORDER');

function stripNonCode(text){
  let out='',state='code',quote='',escaped=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(state==='line'){if(c==='\n'){state='code';out+='\n';}else out+=' ';continue;}
    if(state==='block'){if(c==='*'&&n==='/'){out+='  ';i++;state='code';}else out+=c==='\n'?'\n':' ';continue;}
    if(state==='string'){
      if(escaped){escaped=false;out+=c==='\n'?'\n':' ';continue;}
      if(c==='\\'){escaped=true;out+=' ';continue;}
      if(c===quote){state='code';quote='';out+=' ';continue;}
      out+=c==='\n'?'\n':' ';continue;
    }
    if(c==='/'&&n==='/'){out+='  ';i++;state='line';continue;}
    if(c==='/'&&n==='*'){out+='  ';i++;state='block';continue;}
    if(c==='"'||c==="'"||c==='`'){state='string';quote=c;out+=' ';continue;}
    out+=c;
  }
  return out;
}
function globalAssignment(name){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:\\b(?:window|globalThis|root)\\.'+escaped+'\\s*=)|(?:^|[;{}]|\\))\\s*'+escaped+'\\s*=','gm');
}
function directRuntimeFiles(){
  const out=[];const re=/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;let m;
  while((m=re.exec(html))){const file=m[1].split('?')[0].replace(/^\.\//,'');if(!/^(https?:)?\/\//.test(file))out.push(file);}
  return [...new Set(out)];
}
function writers(pattern){
  const found=[];
  for(const file of directRuntimeFiles()){
    if(!fs.existsSync(file))continue;
    const text=stripNonCode(fs.readFileSync(file,'utf8'));pattern.lastIndex=0;
    if(pattern.test(text))found.push(file);
  }
  return found.sort();
}
function exactWriters(pattern,allowed,label){
  const actual=writers(pattern);const expected=[...allowed].sort();
  ok(JSON.stringify(actual)===JSON.stringify(expected),label+': actual='+actual.join(',')+' expected='+expected.join(','));
}
exactWriters(/\bcamera\.(?:targetX|targetY)\s*=/g,['engine-b.js'],'LIVE_CAMERA_TARGET_WRITERS');
exactWriters(/\bCONFIG\.zoom\s*=/g,['engine-c.js'],'LIVE_CAMERA_ZOOM_WRITERS');
exactWriters(/\bcanvas\.(?:width|height)\s*=/g,['engine-a.js','src/core/camera-system.js'],'LIVE_CANVAS_SIZE_WRITERS');
exactWriters(globalAssignment('resize'),['src/core/camera-system.js'],'LIVE_RESIZE_OWNERS');
exactWriters(globalAssignment('cycleZoom'),['src/core/camera-system.js'],'LIVE_CYCLE_ZOOM_OWNERS');
console.log('CAMERA_SYSTEM_OK: owner + worldView + screen-space dead-zone + target + restore + tuning + viewport + DPR + orientation + screen/world + LIVE writer guard passed');
