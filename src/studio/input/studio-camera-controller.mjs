/* KELO-INDEX
 * area: STUDIO / CAMERA
 * owns: editor-only camera navigation state and gestures
 * does-not-own: gameplay camera follow, viewport rendering or legacy camera/config globals
 * public-api: createStudioCameraController()
 * consumes: KeloCamera public owner only
 * online: local-only; suspends to gameplay camera and resumes the creator view
 */

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MIN_ZOOM=.2;
const MAX_ZOOM=5;

export function createStudioCameraController({root=globalThis,onNavigateStart=()=>{},isUi=()=>false,onPinchStart=()=>false,onPinchMove=()=>{},onPinchEnd=()=>{}}={}){
  const document=root.document,owner=root.KeloCamera;
  if(!document||!owner?.snapshot||!owner?.setTarget||!owner?.setBaseZoom||!owner?.screenToWorld||!owner?.setFollowTuning)throw new Error('STUDIO_CAMERA_OWNER_REQUIRED');

  const initial=owner.snapshot();
  const savedBaseZoom=Number(owner.getBaseZoom?.())||Number(initial.baseZoom)||1;
  const savedTuning={...(owner.getFollowTuning?.()||initial.follow||{})};
  const pointers=new Map(),navTouchIds=new Set();
  let enabled=true,zoom=1,space=false,panMode=false,mousePan=null,touchPan=null,pinch=null,studioView=null;

  const snapshot=()=>owner.snapshot();
  const viewport=()=>{const s=snapshot();return{w:Number(s.screenW)||root.innerWidth||1,h:Number(s.screenH)||root.innerHeight||1};};
  function freezeFollow(){
    owner.setFollowTuning({...savedTuning,deadXRatio:1e6,deadYRatio:1e6,lookAheadDist:0});
    const s=snapshot();owner.setTarget(s.x,s.y,{snap:true,source:'kelo-studio-freeze'});
  }
  function restoreGameplayOwnership(){owner.setFollowTuning(savedTuning);owner.setBaseZoom(savedBaseZoom,'kelo-studio-gameplay');}
  function applyStudioZoom(){owner.setBaseZoom(savedBaseZoom*zoom,'kelo-studio-zoom');return snapshot();}
  function setCenter(x,y){owner.setTarget(Number(x)||0,Number(y)||0,{snap:true,source:'kelo-studio-pan'});const s=snapshot();return{x:s.x,y:s.y};}
  function toWorld(clientX,clientY){return owner.screenToWorld(Number(clientX)||0,Number(clientY)||0);}
  function panScreen(dx,dy){if(!enabled)return null;const s=snapshot(),z=Math.max(.05,Number(s.effectiveZoom)||1);return setCenter(s.x-(Number(dx)||0)/z,s.y-(Number(dy)||0)/z);}
  function setZoom(next,{anchorX,anchorY}={}){
    if(!enabled)return zoom;
    const {w,h}=viewport(),ax=Number.isFinite(Number(anchorX))?Number(anchorX):w/2,ay=Number.isFinite(Number(anchorY))?Number(anchorY):h/2,before=toWorld(ax,ay);
    zoom=clamp(Number(next)||1,MIN_ZOOM,MAX_ZOOM);applyStudioZoom();
    const after=toWorld(ax,ay),s=snapshot();setCenter(s.x+(before.x-after.x),s.y+(before.y-after.y));return zoom;
  }
  function focusRect(rect,{padding=80}={}){
    if(!rect)return null;
    const w=Math.max(1,Number(rect.w)||1),h=Math.max(1,Number(rect.h)||1),cx=(Number(rect.x)||0)+w/2,cy=(Number(rect.y)||0)+h/2,{w:vw,h:vh}=viewport();
    const desiredEffective=Math.min((vw-Math.max(0,padding)*2)/w,(vh-Math.max(0,padding)*2)/h),baseline=Math.max(.05,Number(initial.effectiveZoom)||Number(initial.baseZoom)||1);
    setZoom(clamp(desiredEffective/baseline,MIN_ZOOM,MAX_ZOOM));return setCenter(cx,cy);
  }
  function setPanMode(value){panMode=!!value;if(!panMode){mousePan=null;touchPan=null;}return panMode;}
  function consume(e){e.preventDefault?.();e.stopImmediatePropagation?.();}
  function resetTransientNavigation(reason='reset'){
    const delegated=pinch?.mode==='delegate';
    space=false;mousePan=null;touchPan=null;pinch=null;pointers.clear();navTouchIds.clear();
    if(delegated){try{onPinchEnd({cancelled:true,reason});}catch{}}
  }
  function keydown(e){if(e.code==='Space'&&!isUi(e)){space=true;e.preventDefault();}}
  function keyup(e){if(e.code==='Space')space=false;}
  function blur(){resetTransientNavigation('blur');}
  function visibilitychange(){if(document.hidden)resetTransientNavigation('hidden');}
  function wheel(e){if(!enabled||isUi(e))return;onNavigateStart();const factor=Math.exp(-Number(e.deltaY||0)*.0012);setZoom(zoom*factor,{anchorX:e.clientX,anchorY:e.clientY});consume(e);}
  function pointerdown(e){
    if(!enabled||isUi(e))return;
    if(e.pointerType==='touch'){
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===1&&panMode){onNavigateStart();touchPan={id:e.pointerId,x:e.clientX,y:e.clientY};navTouchIds.add(e.pointerId);consume(e);return;}
      if(pointers.size===2){touchPan=null;for(const id of pointers.keys())navTouchIds.add(id);const [a,b]=[...pointers.values()],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),world=toWorld(cx,cy),delegated=!!onPinchStart({clientX:cx,clientY:cy,worldX:world.x,worldY:world.y,distance:d});if(delegated){pinch={mode:'delegate',cx,cy,d,zoom};consume(e);return;}onNavigateStart();pinch={mode:'camera',cx,cy,d,zoom};consume(e);}return;
    }
    if(e.button===1||(e.button===0&&(space||panMode))){onNavigateStart();mousePan={id:e.pointerId,x:e.clientX,y:e.clientY};consume(e);}
  }
  function pointermove(e){
    if(!enabled)return;
    if(e.pointerType==='touch'&&pointers.has(e.pointerId)){
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size>=2&&pinch){for(const id of pointers.keys())navTouchIds.add(id);const [a,b]=[...pointers.values()].slice(0,2),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));if(pinch.mode==='delegate'){const world=toWorld(cx,cy);onPinchMove({clientX:cx,clientY:cy,worldX:world.x,worldY:world.y,distance:d,ratio:d/pinch.d});consume(e);}else{panScreen(cx-pinch.cx,cy-pinch.cy);setZoom(pinch.zoom*(d/pinch.d),{anchorX:cx,anchorY:cy});pinch={...pinch,cx,cy};consume(e);}}
      else if(touchPan&&e.pointerId===touchPan.id&&panMode){const dx=e.clientX-touchPan.x,dy=e.clientY-touchPan.y;touchPan.x=e.clientX;touchPan.y=e.clientY;panScreen(dx,dy);consume(e);}
      else if(navTouchIds.has(e.pointerId))consume(e);return;
    }
    if(mousePan&&e.pointerId===mousePan.id){const dx=e.clientX-mousePan.x,dy=e.clientY-mousePan.y;mousePan.x=e.clientX;mousePan.y=e.clientY;panScreen(dx,dy);consume(e);}
  }
  function pointerup(e){
    if(e.pointerType==='touch'){const wasNav=navTouchIds.has(e.pointerId),endingPinch=pinch;pointers.delete(e.pointerId);if(touchPan&&touchPan.id===e.pointerId)touchPan=null;if(pointers.size<2){if(endingPinch?.mode==='delegate')onPinchEnd({cancelled:e.type==='pointercancel'});pinch=null;}if(wasNav){navTouchIds.delete(e.pointerId);consume(e);}if(!pointers.size)navTouchIds.clear();return;}
    if(mousePan&&e.pointerId===mousePan.id){mousePan=null;consume(e);}
  }
  function resume(){
    if(enabled)return;enabled=true;freezeFollow();applyStudioZoom();
    if(studioView?.camera)owner.restoreState?.(studioView.camera,{source:'kelo-studio-resume',resetLook:false});
    const s=snapshot();owner.setTarget(s.x,s.y,{snap:true,source:'kelo-studio-resume'});
  }
  function suspend(){
    if(!enabled)return;studioView={camera:snapshot(),zoom};enabled=false;restoreGameplayOwnership();resetTransientNavigation('suspend');
  }
  function destroy(){
    if(enabled)restoreGameplayOwnership();
    enabled=false;resetTransientNavigation('destroy');
    root.removeEventListener?.('blur',blur,true);document.removeEventListener('visibilitychange',visibilitychange,true);
    document.removeEventListener('keydown',keydown,true);document.removeEventListener('keyup',keyup,true);document.removeEventListener('wheel',wheel,true);document.removeEventListener('pointerdown',pointerdown,true);document.removeEventListener('pointermove',pointermove,true);document.removeEventListener('pointerup',pointerup,true);document.removeEventListener('pointercancel',pointerup,true);
  }

  freezeFollow();applyStudioZoom();
  root.addEventListener?.('blur',blur,true);document.addEventListener('visibilitychange',visibilitychange,true);
  document.addEventListener('keydown',keydown,true);document.addEventListener('keyup',keyup,true);document.addEventListener('wheel',wheel,{capture:true,passive:false});document.addEventListener('pointerdown',pointerdown,{capture:true,passive:false});document.addEventListener('pointermove',pointermove,{capture:true,passive:false});document.addEventListener('pointerup',pointerup,{capture:true,passive:false});document.addEventListener('pointercancel',pointerup,{capture:true,passive:false});

  return Object.freeze({toWorld,panScreen,setCenter,setZoom,focusRect,setPanMode,resume,suspend,destroy,snapshot,minZoom:MIN_ZOOM,maxZoom:MAX_ZOOM,get zoom(){return zoom;},get effectiveZoom(){return Number(snapshot().effectiveZoom)||1;},get enabled(){return enabled;},get panMode(){return panMode;}});
}
