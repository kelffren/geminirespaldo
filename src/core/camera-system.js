/* KELO-INDEX
 * area: CORE / CAMERA
 * owner: KeloCamera
 * keys: CAMERA VIEWPORT ZOOM DPR FOCUS RESTORE SCREEN WORLD ORIENTATION FOUNDATION DEADZONE REVERSAL LOOKAHEAD PVP AIM COMPOSITION ACTION FRAMING DODGE RELEASE STRAFE RELEASE LIVE ACTION DIRECTOR CRITICAL
 * purpose: owner único para comandos de cámara, zoom, viewport/Canvas y conversiones screen↔world; compone aim/acción PvP y un director contextual player↔enemy sin tocar simulación
 * public-api: KeloCamera
 * consumes: camera, CONFIG, canvas, ctx, screenW/screenH, KeloInput combat snapshot, KeloPvPWorld state, KeloPvPCastMovementPrediction y updateCamera legacy de engine-a
 * state-owned: targetX/Y, posición comandada, follow tuning, zoom efectivo/base, viewport policy, DPR policy, foco, transient camera follow/action framing intent y PvP director presentation intent
 * extension-points: setTarget/focus/restoreState/setBaseZoom/configureViewport/syncViewport/setFollowTuning/worldView/setPvPDirectorIntent/clearPvPDirectorIntent/pulsePvPImpact
 * reuse: gameplay/presentation publica intent; KeloCamera aplica framing/zoom; render/culling consulta worldView(); UI/orientación delegan viewport aquí
 * legacy: engine-a conserva temporalmente la matemática interna de follow; KeloCamera adapta dead-zone/look-ahead y compone capas de presentación PvP
 * do-not: NO escribir camera.targetX/Y, camera.x/y por comandos externos, CONFIG.zoom/camera tuning, canvas.width/height o reemplazar resize desde features nuevas
 */
(function(root){
  'use strict';
  if(root.KeloCamera)return;
  if(typeof camera==='undefined'||typeof CONFIG==='undefined'||typeof canvas==='undefined'||typeof ctx==='undefined')throw new Error('KeloCamera: legacy camera/canvas core unavailable');

  const VERSION='kelo-camera-v1.11.0-pvp-live-action-director-a';
  const ZOOM_PRESETS=Object.freeze([0.7,0.82,1]);
  const TUNING_KEYS=Object.freeze(['dampX','dampY','deadXRatio','deadYRatio','lookAheadDist','lookAheadDecay']);
  const SCREEN_SPACE_DEADZONE_KEYS=new Set(['deadXRatio','deadYRatio']);
  const LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER=2.5;
  const REVERSAL_EPSILON=0.01;
  const PVP_AIM_PERP_WEIGHT=0.5;
  const PVP_AIM_EPSILON=0.18;
  const PVP_ACTION_SCREEN_LEAD_PX=28;
  const PVP_ACTION_FRAMING_DECAY=9;
  const PVP_ACTION_DODGE_RELEASE_DECAY=22;
  const PVP_ACTION_STRAFE_RELEASE_DECAY=22;
  const PVP_ACTION_STRAFE_RELEASE_DOT=-0.15;
  const COMMITTED_ACTION_PHASES=new Set(['windup','active']);
  const PVP_DIRECTOR=Object.freeze({enemyWeight:.24,targetDecay:8.5,zoomDecay:7,nearDistance:140,farDistance:360,nearZoom:1.025,farZoom:.93,criticalZoom:.94,impactZoom:.035,maxOffsetPx:104,aimLeadPx:14});
  const legacyUpdateCamera=typeof updateCamera==='function'?updateCamera:null;
  let baseZoom=Number.isFinite(Number(CONFIG.zoom))&&Number(CONFIG.zoom)>0?Number(CONFIG.zoom):0.82;
  let effectiveZoom=baseZoom;
  let managedTargetX=Number(camera.targetX)||0,managedTargetY=Number(camera.targetY)||0;
  const managedTuning=Object.fromEntries(TUNING_KEYS.map(key=>[key,Number(CONFIG[key])]));
  let transientLookAheadDecayMultiplier=1;
  let reversalActiveX=false,reversalActiveY=false;
  let combatFramingActive=false,lastCameraIntentX=0,lastCameraIntentY=0;
  let actionFramingActive=false,actionFramingOffsetX=0,actionFramingOffsetY=0,lastActionAimX=0,lastActionAimY=0;
  let pvpDirectorIntent=null,pvpDirectorState='NORMAL',pvpDirectorOffsetX=0,pvpDirectorOffsetY=0,pvpDirectorZoomFactor=1,pvpImpactFocus=0;
  let dprCap=3,pixelPerfect=false,roundPixels=!!CONFIG.roundPixels,smoothing=true,imageRendering='auto',viewportScheduled=false,lastEffectiveZoom=null,lastViewportKey='';

  Object.defineProperty(camera,'targetX',{configurable:true,enumerable:true,get:()=>managedTargetX,set:value=>{const n=Number(value);if(Number.isFinite(n))managedTargetX=n;}});
  Object.defineProperty(camera,'targetY',{configurable:true,enumerable:true,get:()=>managedTargetY,set:value=>{const n=Number(value);if(Number.isFinite(n))managedTargetY=n;}});
  Object.defineProperty(CONFIG,'zoom',{configurable:true,enumerable:true,get:()=>effectiveZoom,set:value=>{const n=Number(value);if(Number.isFinite(n)&&n>0)effectiveZoom=n;}});
  function legacyTuningValue(key){
    const value=managedTuning[key];
    if(key==='lookAheadDecay')return value*transientLookAheadDecayMultiplier;
    if(!SCREEN_SPACE_DEADZONE_KEYS.has(key))return value;
    const zoom=Math.max(0.0001,Number(effectiveZoom)||1);
    return value/zoom;
  }
  for(const key of TUNING_KEYS)Object.defineProperty(CONFIG,key,{configurable:true,enumerable:true,get:()=>legacyTuningValue(key),set:value=>{const n=Number(value);if(Number.isFinite(n))managedTuning[key]=n;}});

  function orientation(){return root.innerWidth>=root.innerHeight?'landscape':'portrait';}
  function activeDpr(){return Math.max(1,Math.min(Number(root.devicePixelRatio)||1,Math.max(1,Number(dprCap)||1)));}
  function pixelPerfectZoom(target){const dpr=activeDpr(),physicalScale=Math.max(1,Math.round((Number(target)||1)*dpr));return physicalScale/dpr;}
  function effectiveZoomFor(base,mode){const b=Math.max(0.05,Number(base)||1);if(mode!=='landscape')return b;const w=Math.max(1,root.innerWidth),h=Math.max(1,root.innerHeight);return b*(h/w);}
  function emit(name,detail){try{root.dispatchEvent(new CustomEvent(name,{detail}));}catch(e){}}
  function syncViewportCss(){const rootEl=document.documentElement;rootEl.style.setProperty('--kelo-vw',`${root.innerWidth}px`);rootEl.style.setProperty('--kelo-vh',`${root.innerHeight}px`);}
  function recomputeZoom(source,emitChange){const mode=orientation();effectiveZoom=effectiveZoomFor(baseZoom,mode)*pvpDirectorZoomFactor;document.documentElement.style.setProperty('--kelo-camera-zoom',String(effectiveZoom));const changed=!Number.isFinite(lastEffectiveZoom)||Math.abs(lastEffectiveZoom-effectiveZoom)>0.0001;lastEffectiveZoom=effectiveZoom;if(changed&&emitChange!==false)emit('kelo:camerazoomchange',{source:source||'camera',orientation:mode,baseZoom,effectiveZoom,verticalWorldSpan:root.innerHeight/effectiveZoom,portraitReferenceWorldSpan:Math.max(root.innerWidth,root.innerHeight)/baseZoom,pvpDirectorZoomFactor});return effectiveZoom;}
  function applyZoom(source){return recomputeZoom(source,true);}
  function configureViewport(options){const opts=options||{};if(Number.isFinite(Number(opts.dprCap))&&Number(opts.dprCap)>0)dprCap=Number(opts.dprCap);if(typeof opts.pixelPerfect==='boolean')pixelPerfect=opts.pixelPerfect;if(typeof opts.roundPixels==='boolean')roundPixels=opts.roundPixels;if(typeof opts.smoothing==='boolean')smoothing=opts.smoothing;if(typeof opts.imageRendering==='string')imageRendering=opts.imageRendering;CONFIG.roundPixels=roundPixels;return snapshot();}
  function syncViewport(source){screenW=root.innerWidth;screenH=root.innerHeight;const dpr=activeDpr(),width=Math.max(1,Math.floor(screenW*dpr)),height=Math.max(1,Math.floor(screenH*dpr));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;canvas.style.width=screenW+'px';canvas.style.height=screenH+'px';canvas.style.imageRendering=imageRendering;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=smoothing;CONFIG.roundPixels=roundPixels;syncViewportCss();const zoom=applyZoom(source||'viewport'),key=[screenW,screenH,dpr,zoom].join(':');if(key!==lastViewportKey){lastViewportKey=key;emit('kelo:viewportchange',{source:source||'viewport',width:screenW,height:screenH,dpr,orientation:orientation(),baseZoom,effectiveZoom:zoom});try{root.dispatchEvent(new CustomEvent('kelo:world-audit'));}catch(e){}}return snapshot();}
  function scheduleViewportSync(source){if(viewportScheduled)return;viewportScheduled=true;requestAnimationFrame(()=>{viewportScheduled=false;syncViewport(source||'scheduled-resize');});}
  function setBaseZoom(value,source){const next=Number(value);if(!Number.isFinite(next)||next<=0)return applyZoom(source||'invalid-base');baseZoom=next;return applyZoom(source||'set-base');}
  function nearestPresetIndex(value){let best=0,dist=Infinity;ZOOM_PRESETS.forEach((z,i)=>{const d=Math.abs(z-value);if(d<dist){dist=d;best=i;}});return best;}
  function cycleZoom(source){const i=nearestPresetIndex(baseZoom),next=ZOOM_PRESETS[(i+1)%ZOOM_PRESETS.length];setBaseZoom(next,source||'cycle');if(typeof showToast==='function')showToast('Zoom '+next+(orientation()==='landscape'?' · cámara adaptada':''));if(typeof closeMenu==='function')closeMenu();return next;}
  function clearActionFramingOffset(){actionFramingActive=false;actionFramingOffsetX=0;actionFramingOffsetY=0;lastActionAimX=0;lastActionAimY=0;}
  function setTarget(x,y,options){const nx=Number(x),ny=Number(y),opts=options||{};if(!Number.isFinite(nx)||!Number.isFinite(ny))return false;managedTargetX=nx;managedTargetY=ny;if(opts.snap===true){camera.x=nx;camera.y=ny;camera.lookOffsetX=0;camera.lookOffsetY=0;clearActionFramingOffset();}emit('kelo:cameratargetchange',{source:opts.source||'api',x:nx,y:ny,snap:opts.snap===true});return true;}
  function focus(value,options){if(!value)return false;return setTarget(value.x,value.y,options);}
  function restoreState(value,options){const v=value||{},opts=options||{};const x=Number(v.x),y=Number(v.y),tx=Number(v.targetX),ty=Number(v.targetY);if(!Number.isFinite(x)||!Number.isFinite(y))return false;clearActionFramingOffset();camera.x=x;camera.y=y;managedTargetX=Number.isFinite(tx)?tx:x;managedTargetY=Number.isFinite(ty)?ty:y;if(Number.isFinite(Number(v.lookOffsetX)))camera.lookOffsetX=Number(v.lookOffsetX);else if(opts.resetLook!==false)camera.lookOffsetX=0;if(Number.isFinite(Number(v.lookOffsetY)))camera.lookOffsetY=Number(v.lookOffsetY);else if(opts.resetLook!==false)camera.lookOffsetY=0;emit('kelo:camerarestore',{source:opts.source||'restore',x,y,targetX:managedTargetX,targetY:managedTargetY});return true;}
  function setFollowTuning(next){const values=next||{};for(const key of TUNING_KEYS){const value=Number(values[key]);if(Number.isFinite(value))managedTuning[key]=value;}return getFollowTuning();}
  function getFollowTuning(){return Object.freeze(Object.fromEntries(TUNING_KEYS.map(key=>[key,managedTuning[key]])));}
  function screenToWorldPoint(sx,sy){const z=effectiveZoom||1;return{x:camera.x+(Number(sx)-screenW/2)/z,y:camera.y+(Number(sy)-screenH/2)/z};}
  function worldToScreenPoint(wx,wy){const z=effectiveZoom||1;return{x:(Number(wx)-camera.x)*z+screenW/2,y:(Number(wy)-camera.y)*z+screenH/2};}
  function worldView(){const z=effectiveZoom||1,w=screenW/z,h=screenH/z,cx=Number(camera.x)||0,cy=Number(camera.y)||0,left=cx-w/2,top=cy-h/2;return Object.freeze({x:left,y:top,w,h,left,top,right:left+w,bottom:top+h,centerX:cx,centerY:cy,zoom:z,screenW,screenH});}
  function axisReversing(inputAxis,lookOffset){return Math.abs(Number(inputAxis)||0)>REVERSAL_EPSILON&&Math.abs(Number(lookOffset)||0)>REVERSAL_EPSILON&&Number(inputAxis)*Number(lookOffset)<0;}
  function combatSnapshot(){try{return root.KeloInput?.combat?.snapshot?.()||null;}catch(e){return null;}}
  function setPvPDirectorIntent(value){
    if(!value||value.active===false){pvpDirectorIntent=null;return false;}
    const n=v=>Number.isFinite(Number(v))?Number(v):0;
    pvpDirectorIntent={active:true,playerX:n(value.playerX),playerY:n(value.playerY),enemyX:n(value.enemyX),enemyY:n(value.enemyY),aimX:n(value.aimX),aimY:n(value.aimY),velocityX:n(value.velocityX),velocityY:n(value.velocityY),distance:Math.max(0,n(value.distance)),critical:!!value.critical,hpRatio:Math.max(0,Math.min(1,n(value.hpRatio)||1)),engaged:value.engaged!==false};
    return true;
  }
  function clearPvPDirectorIntent(){pvpDirectorIntent=null;}
  function pulsePvPImpact(strength){pvpImpactFocus=Math.max(pvpImpactFocus,Math.max(0,Math.min(1,Number(strength)||1)));}
  function applyPvPDirector(dt){
    const d=Math.max(0,Number(dt)||0),intent=pvpDirectorIntent,combat=!!root.KELO_COMBAT_ENABLED;
    const active=!!(combat&&intent&&intent.active&&intent.engaged);
    let targetOffsetX=0,targetOffsetY=0,targetZoom=1;
    if(active){
      const z=Math.max(.0001,effectiveZoomFor(baseZoom,orientation())||1),dx=intent.enemyX-intent.playerX,dy=intent.enemyY-intent.playerY;
      const screenX=dx*z*PVP_DIRECTOR.enemyWeight+intent.aimX*PVP_DIRECTOR.aimLeadPx;
      const screenY=dy*z*PVP_DIRECTOR.enemyWeight+intent.aimY*PVP_DIRECTOR.aimLeadPx*.72;
      const mag=Math.hypot(screenX,screenY),scale=mag>PVP_DIRECTOR.maxOffsetPx?PVP_DIRECTOR.maxOffsetPx/mag:1;
      targetOffsetX=screenX*scale/z;targetOffsetY=screenY*scale/z;
      const span=Math.max(1,PVP_DIRECTOR.farDistance-PVP_DIRECTOR.nearDistance),u=Math.max(0,Math.min(1,(intent.distance-PVP_DIRECTOR.nearDistance)/span));
      targetZoom=PVP_DIRECTOR.nearZoom+(PVP_DIRECTOR.farZoom-PVP_DIRECTOR.nearZoom)*u;
      if(intent.critical)targetZoom=Math.min(targetZoom,PVP_DIRECTOR.criticalZoom);
      targetZoom+=PVP_DIRECTOR.impactZoom*pvpImpactFocus;
      pvpDirectorState=intent.critical?'CRITICAL':'ENGAGED';
    }else pvpDirectorState='NORMAL';
    const posFactor=1-Math.exp(-PVP_DIRECTOR.targetDecay*d),zoomFactor=1-Math.exp(-PVP_DIRECTOR.zoomDecay*d);
    pvpDirectorOffsetX+=(targetOffsetX-pvpDirectorOffsetX)*posFactor;pvpDirectorOffsetY+=(targetOffsetY-pvpDirectorOffsetY)*posFactor;
    pvpDirectorZoomFactor+=(targetZoom-pvpDirectorZoomFactor)*zoomFactor;
    pvpImpactFocus*=Math.exp(-10*d);
    if(active){managedTargetX=intent.playerX+pvpDirectorOffsetX;managedTargetY=intent.playerY+pvpDirectorOffsetY;}
    recomputeZoom('pvp-director',false);
  }
  function combatCameraIntent(ix,iy){
    combatFramingActive=false;
    const moveLen=Math.hypot(ix,iy);
    if(moveLen<=REVERSAL_EPSILON||!root.KELO_COMBAT_ENABLED)return{x:ix,y:iy};
    const snap=combatSnapshot();
    const aim=snap&&snap.aim||{},aimMag=Number(aim.magnitude)||0,ax=Number(aim.x)||0,ay=Number(aim.y)||0;
    if(aimMag<PVP_AIM_EPSILON||Math.hypot(ax,ay)<=REVERSAL_EPSILON)return{x:ix,y:iy};
    const mx=ix/moveLen,my=iy/moveLen,dot=ax*mx+ay*my,px=ax-mx*dot,py=ay-my*dot;
    const x=Math.max(-1,Math.min(1,ix+px*PVP_AIM_PERP_WEIGHT*aimMag));
    const y=Math.max(-1,Math.min(1,iy+py*PVP_AIM_PERP_WEIGHT*aimMag));
    combatFramingActive=Math.abs(x-ix)>REVERSAL_EPSILON||Math.abs(y-iy)>REVERSAL_EPSILON;
    return{x,y};
  }
  function committedActionActive(){
    const basicPhase=root.KeloPvPWorld?.state?.basicAttack?.phase;
    if(COMMITTED_ACTION_PHASES.has(basicPhase))return true;
    const castPhase=root.KeloPvPCastMovementPrediction?.phase;
    return COMMITTED_ACTION_PHASES.has(castPhase);
  }
  function stationaryActionAim(ix,iy){
    const moveLen=Math.hypot(ix,iy);
    if(moveLen>REVERSAL_EPSILON||!root.KELO_COMBAT_ENABLED||!committedActionActive())return{x:0,y:0,active:false};
    const snap=combatSnapshot(),aim=snap&&snap.aim||{},mag=Number(aim.magnitude)||0,ax=Number(aim.x)||0,ay=Number(aim.y)||0,len=Math.hypot(ax,ay);
    if(mag<PVP_AIM_EPSILON||len<=REVERSAL_EPSILON)return{x:0,y:0,active:false};
    return{x:ax/len,y:ay/len,active:true};
  }
  function actionFramingDecay(aimActive,ix,iy){
    if(aimActive)return PVP_ACTION_FRAMING_DECAY;
    if(root.KeloPvPWorld?.state?.dodgeActive)return PVP_ACTION_DODGE_RELEASE_DECAY;
    const moveLen=Math.hypot(ix,iy),aimLen=Math.hypot(lastActionAimX,lastActionAimY);
    if(moveLen>REVERSAL_EPSILON&&aimLen>REVERSAL_EPSILON){
      const dot=(ix/moveLen)*(lastActionAimX/aimLen)+(iy/moveLen)*(lastActionAimY/aimLen);
      if(dot<PVP_ACTION_STRAFE_RELEASE_DOT)return PVP_ACTION_STRAFE_RELEASE_DECAY;
    }
    return PVP_ACTION_FRAMING_DECAY;
  }
  function applyStationaryActionFraming(dt,ix,iy){
    const aim=stationaryActionAim(ix,iy),zoom=Math.max(.0001,Number(effectiveZoom)||1),factor=1-Math.exp(-actionFramingDecay(aim.active,ix,iy)*Math.max(0,Number(dt)||0));
    const targetWorld=PVP_ACTION_SCREEN_LEAD_PX/zoom;
    const targetX=aim.active?aim.x*targetWorld:0,targetY=aim.active?aim.y*targetWorld:0;
    actionFramingOffsetX+=(targetX-actionFramingOffsetX)*factor;
    actionFramingOffsetY+=(targetY-actionFramingOffsetY)*factor;
    if(Math.abs(actionFramingOffsetX)<.0001&&!aim.active)actionFramingOffsetX=0;
    if(Math.abs(actionFramingOffsetY)<.0001&&!aim.active)actionFramingOffsetY=0;
    actionFramingActive=aim.active;
    if(aim.active){lastActionAimX=aim.x;lastActionAimY=aim.y;}
    else if(!actionFramingOffsetX&&!actionFramingOffsetY){lastActionAimX=0;lastActionAimY=0;}
    camera.x+=actionFramingOffsetX;camera.y+=actionFramingOffsetY;
  }
  function update(dt){
    const ix=typeof input!=='undefined'?Number(input.normX)||0:0,iy=typeof input!=='undefined'?Number(input.normY)||0:0;
    if(actionFramingOffsetX||actionFramingOffsetY){camera.x-=actionFramingOffsetX;camera.y-=actionFramingOffsetY;}
    applyPvPDirector(dt);
    reversalActiveX=axisReversing(ix,camera.lookOffsetX);
    reversalActiveY=axisReversing(iy,camera.lookOffsetY);
    transientLookAheadDecayMultiplier=(reversalActiveX||reversalActiveY)?LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER:1;
    const intent=combatCameraIntent(ix,iy);lastCameraIntentX=intent.x;lastCameraIntentY=intent.y;
    const canAdapt=typeof input!=='undefined'&&input&&combatFramingActive;
    if(canAdapt){input.normX=intent.x;input.normY=intent.y;}
    try{if(legacyUpdateCamera)legacyUpdateCamera(dt);}finally{if(canAdapt){input.normX=ix;input.normY=iy;}transientLookAheadDecayMultiplier=1;}
    applyStationaryActionFraming(dt,ix,iy);
  }
  function refreshZoom(source){return applyZoom(source||'refresh');}
  function snapshot(){return Object.freeze({version:VERSION,x:camera.x,y:camera.y,targetX:managedTargetX,targetY:managedTargetY,lookOffsetX:Number(camera.lookOffsetX)||0,lookOffsetY:Number(camera.lookOffsetY)||0,baseZoom,effectiveZoom,orientation:orientation(),screenW,screenH,dpr:activeDpr(),dprCap,pixelPerfect,roundPixels,smoothing,follow:getFollowTuning(),reversalResponse:Object.freeze({multiplier:LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER,activeX:reversalActiveX,activeY:reversalActiveY}),combatFraming:Object.freeze({active:combatFramingActive,aimPerpWeight:PVP_AIM_PERP_WEIGHT,intentX:lastCameraIntentX,intentY:lastCameraIntentY,stationaryActionActive:actionFramingActive,stationaryActionLeadPx:PVP_ACTION_SCREEN_LEAD_PX,stationaryActionDodgeReleaseDecay:PVP_ACTION_DODGE_RELEASE_DECAY,stationaryActionStrafeReleaseDecay:PVP_ACTION_STRAFE_RELEASE_DECAY,stationaryActionStrafeReleaseDot:PVP_ACTION_STRAFE_RELEASE_DOT,stationaryActionOffsetScreenX:actionFramingOffsetX*effectiveZoom,stationaryActionOffsetScreenY:actionFramingOffsetY*effectiveZoom,stationaryActionAimX:lastActionAimX,stationaryActionAimY:lastActionAimY}),pvpDirector:Object.freeze({state:pvpDirectorState,active:!!(pvpDirectorIntent&&root.KELO_COMBAT_ENABLED),offsetScreenX:pvpDirectorOffsetX*effectiveZoom,offsetScreenY:pvpDirectorOffsetY*effectiveZoom,zoomFactor:pvpDirectorZoomFactor,impactFocus:pvpImpactFocus,config:PVP_DIRECTOR})});}

  root.updateCamera=update;
  root.resize=()=>syncViewport('legacy-resize-call');
  root.cycleZoom=()=>cycleZoom('legacy-cycle');
  root.screenToWorld=screenToWorldPoint;
  root.worldToScreen=worldToScreenPoint;
  root.addEventListener('resize',()=>scheduleViewportSync('resize'),{passive:true});
  root.visualViewport?.addEventListener('resize',()=>scheduleViewportSync('visualViewport'),{passive:true});

  root.KeloCamera=Object.freeze({version:VERSION,setTarget,focus,restoreState,setFollowTuning,getFollowTuning,setBaseZoom,getBaseZoom:()=>baseZoom,getEffectiveZoom:()=>effectiveZoom,cycleZoom,refreshZoom,getOrientation:orientation,configureViewport,syncViewport,scheduleViewportSync,syncViewportCss,activeDpr,pixelPerfectZoom,screenToWorld:screenToWorldPoint,worldToScreen:worldToScreenPoint,worldView,setPvPDirectorIntent,clearPvPDirectorIntent,pulsePvPImpact,snapshot});
  root.KELO_CAMERA_AUDIT=Object.freeze({version:VERSION,owner:'KeloCamera',legacyFollowMath:true,screenSpaceDeadZone:true,lookAheadReversalResponse:true,lookAheadReversalDecayMultiplier:LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER,pvpAimComposition:true,pvpAimPerpWeight:PVP_AIM_PERP_WEIGHT,pvpStationaryActionFraming:true,pvpStationaryActionLeadPx:PVP_ACTION_SCREEN_LEAD_PX,pvpStationaryActionDodgeReleaseDecay:PVP_ACTION_DODGE_RELEASE_DECAY,pvpStationaryActionStrafeReleaseDecay:PVP_ACTION_STRAFE_RELEASE_DECAY,pvpStationaryActionStrafeReleaseDot:PVP_ACTION_STRAFE_RELEASE_DOT,pvpLiveActionDirector:true,pvpDirectorConfig:PVP_DIRECTOR,legacyTargetAdapter:true,legacyZoomAdapter:true,legacyTuningAdapter:true,updateCameraOwner:true,viewportOwner:true,zoomOwner:true,targetOwner:true,restoreOwner:true,screenWorldOwner:true,worldViewOwner:true});
})(typeof globalThis!=='undefined'?globalThis:window);