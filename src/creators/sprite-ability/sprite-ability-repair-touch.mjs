/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY / REPAIR TOUCH
 * owner: mobile pointer gestures layered over Sprite Repair Studio
 * keys: TOUCH PINCH SCALE PAN ERASER BRUSH SIZE CURSOR MOBILE POINTER
 * purpose: keep Repair Studio canonical while making its existing move/scale/erase controls directly operable with fingers
 * does-not-own: frame pixels, repair persistence, spritesheet generation or combat data
 */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const dist=(a,b)=>Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));
const mid=(a,b)=>({x:((a?.x||0)+(b?.x||0))/2,y:((a?.y||0)+(b?.y||0))/2});

export function pinchScale(startScale,startDistance,currentDistance,{min=.25,max=2.5}={}){
  const base=clamp(startScale,min,max),from=Number(startDistance),to=Number(currentDistance);
  if(!(from>0)||!(to>0))return base;
  return clamp(base*(to/from),min,max);
}
export function pinchBrushSize(startSize,startDistance,currentDistance,{min=2,max=48}={}){
  return Math.round(pinchScale(startSize,startDistance,currentDistance,{min,max}));
}
export function pinchMidpoint(a,b){return mid(a,b);}
export function brushScreenDiameter(brush,{stageCssWidth=320,stageLogicalWidth=640,frameWidth=128,frameHeight=128}={}){
  const size=Math.min(stageLogicalWidth,stageLogicalWidth)*.72,ratio=Math.min(size/Math.max(1,frameWidth),size/Math.max(1,frameHeight)),cssScale=stageCssWidth/Math.max(1,stageLogicalWidth);
  return Math.max(6,Number(brush||12)*ratio*cssScale*2);
}

function activeTool(overlay){return overlay?.querySelector('.sr-mode button.on')?.textContent?.trim()||'';}
function rangeInputFor(overlay,label){
  for(const row of overlay?.querySelectorAll?.('.sr-range')||[])if(row.querySelector('span')?.textContent?.trim()===label)return row.querySelector('input[type="range"]');
  return null;
}
const scaleInputFor=overlay=>rangeInputFor(overlay,'ESCALA');
const brushInputFor=overlay=>rangeInputFor(overlay,'BORRADOR');
function cellSizeFor(overlay){const text=overlay?.querySelector('.sr-ref')?.textContent||'',m=text.match(/celda\s+(\d+)×(\d+)/i);return m?{frameWidth:Number(m[1])||128,frameHeight:Number(m[2])||128}:{frameWidth:128,frameHeight:128};}
function addHint(stage){
  const overlay=stage.closest('.sab-repair');if(!overlay||overlay.querySelector('.sr-touch-help'))return;
  const card=overlay.querySelector('.sr-side .sr-card');if(!card)return;
  const p=overlay.ownerDocument.createElement('p');p.className='sr-help sr-touch-help';p.textContent='☝️ MOVER: arrastra · 🤏 MOVER: escala · ⌫ BORRAR: 1 dedo borra · 🤏 BORRAR: tamaño';card.append(p);
}
function createBrushRing(stage){
  const wrap=stage.parentElement,doc=stage.ownerDocument,ring=doc.createElement('div');ring.className='sr-touch-brush-ring';ring.hidden=true;Object.assign(ring.style,{position:'absolute',zIndex:'8',border:'2px solid rgba(255,235,155,.95)',boxShadow:'0 0 0 1px rgba(0,0,0,.7)',borderRadius:'50%',pointerEvents:'none',transform:'translate(-50%,-50%)',background:'rgba(255,255,255,.035)'});wrap?.append(ring);return ring;
}

function attachStage(stage,root){
  if(stage.dataset.srTouchGestures==='1')return()=>{};
  stage.dataset.srTouchGestures='1';addHint(stage);
  const pointers=new Map(),blocked=new Set(),ring=createBrushRing(stage);let gesture=null;
  const point=e=>({x:e.clientX,y:e.clientY});
  const stop=e=>{e.preventDefault?.();e.stopImmediatePropagation?.();};
  const hideRing=()=>{ring.hidden=true;};
  const showRing=(clientX,clientY)=>{const overlay=stage.closest('.sab-repair'),brush=Number(brushInputFor(overlay)?.value)||12,stageRect=stage.getBoundingClientRect(),wrapRect=stage.parentElement?.getBoundingClientRect?.()||stageRect,{frameWidth,frameHeight}=cellSizeFor(overlay),diameter=brushScreenDiameter(brush,{stageCssWidth:stageRect.width,stageLogicalWidth:stage.width||640,frameWidth,frameHeight});ring.style.width=`${diameter}px`;ring.style.height=`${diameter}px`;ring.style.left=`${clientX-wrapRect.left}px`;ring.style.top=`${clientY-wrapRect.top}px`;ring.hidden=false;};
  const clearGesture=()=>{
    if(!gesture)return;
    try{stage.onpointerup?.({pointerId:gesture.primaryId,preventDefault(){}});}catch{}
    gesture=null;delete stage.dataset.srGesture;
  };
  const down=e=>{
    if(e.pointerType!=='touch')return;
    pointers.set(e.pointerId,point(e));
    const overlay=stage.closest('.sab-repair'),tool=activeTool(overlay);
    if(tool.includes('BORRAR')&&pointers.size===1)showRing(e.clientX,e.clientY);
    if(pointers.size<2)return;
    hideRing();
    if(gesture){stop(e);return;}
    const entries=[...pointers.entries()].slice(0,2),[first,second]=entries,startDistance=dist(first[1],second[1]);
    if(!(startDistance>0)){blocked.add(e.pointerId);stop(e);return;}
    if(tool.includes('MOVER')){
      const scaleInput=scaleInputFor(overlay);if(!scaleInput){blocked.add(e.pointerId);stop(e);return;}
      gesture={mode:'sprite-scale',ids:[first[0],second[0]],primaryId:first[0],primaryStart:{...first[1]},startDistance,startMid:mid(first[1],second[1]),startValue:Number(scaleInput.value)||1,input:scaleInput};
      stage.dataset.srGesture='pinch-scale';stop(e);return;
    }
    if(tool.includes('BORRAR')){
      const brushInput=brushInputFor(overlay);if(!brushInput){blocked.add(e.pointerId);stop(e);return;}
      gesture={mode:'brush-size',ids:[first[0],second[0]],primaryId:first[0],startDistance,startValue:Number(brushInput.value)||12,input:brushInput};
      stage.dataset.srGesture='pinch-brush';stop(e);return;
    }
    blocked.add(e.pointerId);stop(e);
  };
  const move=e=>{
    if(e.pointerType!=='touch')return;
    if(blocked.has(e.pointerId)){stop(e);return;}
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,point(e));
    const overlay=stage.closest('.sab-repair'),tool=activeTool(overlay);
    if(!gesture&&tool.includes('BORRAR')&&pointers.size===1)showRing(e.clientX,e.clientY);
    if(!gesture||!gesture.ids.includes(e.pointerId))return;
    const a=pointers.get(gesture.ids[0]),b=pointers.get(gesture.ids[1]);if(!a||!b)return;
    stop(e);
    if(gesture.mode==='sprite-scale'){
      const nextScale=pinchScale(gesture.startValue,gesture.startDistance,dist(a,b),{min:Number(gesture.input.min)||.25,max:Number(gesture.input.max)||2.5});
      if(Math.abs((Number(gesture.input.value)||0)-nextScale)>.0005){gesture.input.value=String(nextScale);gesture.input.dispatchEvent(new root.Event('input',{bubbles:true}));}
      const currentMid=mid(a,b),dx=currentMid.x-gesture.startMid.x,dy=currentMid.y-gesture.startMid.y;
      try{stage.onpointermove?.({pointerId:gesture.primaryId,clientX:gesture.primaryStart.x+dx,clientY:gesture.primaryStart.y+dy,preventDefault(){}});}catch{}
      return;
    }
    if(gesture.mode==='brush-size'){
      const nextSize=pinchBrushSize(gesture.startValue,gesture.startDistance,dist(a,b),{min:Number(gesture.input.min)||2,max:Number(gesture.input.max)||48});
      if(Number(gesture.input.value)!==nextSize){gesture.input.value=String(nextSize);gesture.input.dispatchEvent(new root.Event('input',{bubbles:true}));}
    }
  };
  const up=e=>{
    if(e.pointerType!=='touch')return;
    const wasBlocked=blocked.delete(e.pointerId),wasGesture=Boolean(gesture?.ids.includes(e.pointerId));
    if(wasBlocked)stop(e);
    if(wasGesture){stop(e);clearGesture();}
    pointers.delete(e.pointerId);if(pointers.size===0)hideRing();
  };
  stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,true);stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',up,true);
  return()=>{stage.removeEventListener('pointerdown',down,true);stage.removeEventListener('pointermove',move,true);stage.removeEventListener('pointerup',up,true);stage.removeEventListener('pointercancel',up,true);pointers.clear();blocked.clear();clearGesture();ring.remove();delete stage.dataset.srTouchGestures;};
}

export function installSpriteAbilityRepairTouch({root=globalThis}={}){
  if(!root?.document)return()=>{};
  const attached=new Map();let disposed=false;
  const scan=()=>{
    if(disposed)return;
    for(const stage of root.document.querySelectorAll('.sab-repair .sr-stage'))if(!attached.has(stage))attached.set(stage,attachStage(stage,root));
    for(const [stage,dispose] of [...attached])if(!stage.isConnected){try{dispose();}catch{}attached.delete(stage);}
  };
  const observer=new root.MutationObserver(scan);observer.observe(root.document.documentElement,{subtree:true,childList:true});scan();
  return()=>{disposed=true;observer.disconnect();for(const dispose of attached.values())try{dispose();}catch{}attached.clear();};
}