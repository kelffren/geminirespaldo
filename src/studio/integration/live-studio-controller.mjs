/* KELO-INDEX
 * area: STUDIO / LIVE CONTROLLER
 * owner: Kelo Studio Live Controller
 * owns: creator session lifecycle, draft import, Studio input context, camera/playtest toggle and workspace orchestration
 * does-not-own: gameplay systems, authority internals or legacy Builder internals
 * public-api: openKeloStudioLive(), closeKeloStudioLive()
 * consumes: KeloInputLocks, KELO_WORLD_EDIT, Studio Kernel/Tools
 * online: confirmed Commands mirror through KELO_WORLD_EDIT; previews/camera/productivity stay local
 * mobile: ZERO static Studio imports — chrome first; iPhone reuses the painted shell, skips overlay/grid/importCurrent on first paint, seeds a TREE-capable asset strip with paced thumbnails early, idle-slices productivity/extras, and never runs a blocking draft import on the first phone paint
 */

let active=null;
const controllerUrl=new URL(import.meta.url);
const BUILD=controllerUrl.searchParams.get('v')||'world-bridge-20260915-22';
const mutable=status=>['DRAFT','REJECTED'].includes(String(status||''));
const DIRECT_DRAG_THRESHOLD=5;
function actor(root){return String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');}
function toast(root,msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Studio]',msg);}
function isPhone(root){
  const ua=String(root?.navigator?.userAgent||'');
  const short=Math.min(Number(root?.innerWidth)||999,Number(root?.innerHeight)||999);
  return /iPhone|iPad|iPod|Android/i.test(ua)||short<=500;
}
function pause(root,ms){return new Promise(resolve=>(root.setTimeout||setTimeout)(resolve,ms));}
async function yieldLiveMount(root){const {yieldStudioBoot}=await import('./studio-boot-pace.mjs');await yieldStudioBoot(root);}
async function ensureDraft(root,actorId){const E=root.KELO_WORLD_EDIT;if(!E?.ready)throw new Error('WORLD_EDIT_NOT_READY');let res=await E.getCurrentDraft(),d=res?.draft;if(!d||!mutable(d.status)){res=await E.request('world:draft:create',{actorId,forceNew:true});d=res.draft;}else{res=await E.request('world:draft:get',{actorId,draftId:d.draftId});d=res.draft;}return d;}

async function loadLiveStudioChrome(){
  const {createStudioLiveShell}=await import(`../ui/studio-live-shell.mjs?v=${BUILD}`);
  return createStudioLiveShell;
}

async function loadLiveStudioRuntime(root){
  const phone=isPhone(root);
  const {yieldStudioBoot,setWorldLaunchStatus}=await import('./studio-boot-pace.mjs');
  const wait=async()=>{await yieldStudioBoot(root);if(phone)await pause(root,40);};
  const abortIfNeeded=()=>{if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');};
  setWorldLaunchStatus(root,'Cargando herramientas…');
  let overlayMod,gridMod,pointerMod,cameraMod;
  if(phone){
    overlayMod={createStudioOverlayCanvas:()=>({canvas:null,ctx:null,resize:()=>({}),clear(){},destroy(){},dpr:1})};
    gridMod={createCreatorGridOverlay:()=>({draw(){},configure(){}})};
    pointerMod=await import('../input/pointer-input-adapter.mjs');await wait();abortIfNeeded();
    cameraMod=await import('../input/studio-camera-controller.mjs');await wait();abortIfNeeded();
  }else{
    [overlayMod,gridMod,pointerMod,cameraMod]=await Promise.all([
      import('../render/studio-overlay-canvas.mjs'),
      import('../render/creator-grid-overlay.mjs'),
      import('../input/pointer-input-adapter.mjs'),
      import('../input/studio-camera-controller.mjs')
    ]);
    await wait();
    abortIfNeeded();
  }
  setWorldLaunchStatus(root,'Cargando núcleo…');
  let mirrorMod,prodMod,actionsMod,prefabMod,analyzerMod,commandsMod;
  if(phone){
    mirrorMod=await import('./authority-command-mirror.mjs');await wait();abortIfNeeded();
    prodMod={createCreatorProductivityPanel:null};
    actionsMod=await import('../tools/creator-actions.mjs');await wait();abortIfNeeded();
    prefabMod=await import('../prefabs/creator-prefab-library.mjs');await wait();abortIfNeeded();
    analyzerMod={analyzeCreatorWorld:()=>({ok:true,issues:[]})};
    commandsMod=await import('../document/document-commands.mjs');await wait();abortIfNeeded();
  }else{
    [mirrorMod,prodMod,actionsMod,prefabMod,analyzerMod,commandsMod]=await Promise.all([
      import('./authority-command-mirror.mjs'),
      import('../ui/creator-productivity-panel.mjs'),
      import('../tools/creator-actions.mjs'),
      import('../prefabs/creator-prefab-library.mjs'),
      import('../validation/creator-world-analyzer.mjs'),
      import('../document/document-commands.mjs')
    ]);
    await wait();
    abortIfNeeded();
  }
  return {
    createStudioOverlayCanvas:overlayMod.createStudioOverlayCanvas,
    createCreatorGridOverlay:gridMod.createCreatorGridOverlay,
    attachStudioPointerInput:pointerMod.attachStudioPointerInput,
    createStudioCameraController:cameraMod.createStudioCameraController,
    installStudioAuthorityMirror:mirrorMod.installStudioAuthorityMirror,
    createCreatorProductivityPanel:prodMod.createCreatorProductivityPanel,
    createCreatorActions:actionsMod.createCreatorActions,
    createCreatorPrefabLibrary:prefabMod.createCreatorPrefabLibrary,
    analyzeCreatorWorld:analyzerMod.analyzeCreatorWorld,
    createMoveEntityCommand:commandsMod.createMoveEntityCommand,
    createPatchEntityCommand:commandsMod.createPatchEntityCommand
  };
}

function paintStubChrome(root,createStudioLiveShell){
  const doc=root.document;
  if(!doc?.body)return null;
  try{doc.body.classList.add('kelo-studio-active');}catch{}
  const shell=createStudioLiveShell({
    host:doc.body,
    assets:[],
    onClose:()=>{
      try{root.KELO_WORLD_LAUNCH_ABORTED=true;}catch{}
      try{closeKeloStudioLive({root});}catch{}
      try{root.document.getElementById('kelo-studio-live')?.remove();}catch{}
      try{root.document.getElementById('kelo-world-launch-curtain')?.remove();}catch{}
      try{root.document.body.classList.remove('kelo-studio-active');}catch{}
    },
    onMode:()=>{},onAsset:()=>{},onUndo:()=>{},onRedo:()=>{},onRotate:()=>{},onScale:()=>{},
    onErase:()=>{},onSave:()=>{},onSelectEntity:()=>{},onDuplicate:()=>{},onDelete:()=>{},
    onPropertyChange:()=>{},onPlay:()=>{},onBrushSize:()=>{},onFocus:()=>{}
  });
  const live=shell?.root||doc.getElementById('kelo-studio-live');
  if(live?.dataset)live.dataset.keloWorldLoading='1';
  try{shell?.setStatus?.('Cargando editor…');}catch{}
  try{doc.getElementById('kelo-world-launch-curtain')?.remove?.();}catch{}
  return shell;
}


function phoneSeedAssets(all){
  const list=Array.isArray(all)?all:[];
  const prefer=/tree|arbol|oak|pine|willow|birch|nature|vegetation|bush|plant|rock|hedge|flor/i;
  const matched=list.filter(a=>prefer.test(`${a?.id||''} ${a?.label||''} ${a?.category||''}`));
  const seed=(matched.length?matched:list).slice(0,24);
  if(seed.length)return seed;
  // Catalog may still be empty on cold phone boot; keep a tiny placeable TREE strip.
  return [
    {id:'tree:oak-broad-green',label:'Roble',category:'nature/tree',width:64,height:96},
    {id:'tree:pine-tall-evergreen',label:'Pino',category:'nature/tree',width:48,height:112},
    {id:'imperial:arbol-florido-blanco',label:'Árbol florido',category:'nature/tree',width:64,height:96},
    {id:'tree:birch-green',label:'Abedul',category:'nature/tree',width:48,height:96}
  ];
}
function ensurePhonePlacementPrefabs(studio,assets){
  const registry=studio?.kernel?.prefabs;
  if(!registry?.register)return 0;
  let added=0;
  for(const asset of assets||[]){
    const id=String(asset?.id||'');
    if(!id||registry.has?.(id)||registry.resolve?.(id))continue;
    try{
      registry.register({
        id,
        version:1,
        label:String(asset.label||id),
        category:String(asset.category||'nature/tree'),
        bounds:{w:Math.max(1,Number(asset.width)||64),h:Math.max(1,Number(asset.height)||96)},
        components:{visual:{source:'phone-seed',parts:[]}},
        dependencies:[]
      });
      added++;
    }catch{}
  }
  return added;
}


function createPacedPhoneAssetPreview(assetPreview,root){
  // Serial thumbnail decode with yields — keeps strip/library preview without a main-thread spike.
  let queue=[],busy=false,token=0;
  const wait=ms=>new Promise(r=>(root.setTimeout||setTimeout)(r,ms));
  function canvasHasInk(canvas){
    try{
      const ctx=canvas.getContext('2d');
      if(!ctx||!canvas.width||!canvas.height)return false;
      const {data}=ctx.getImageData(0,0,Math.min(canvas.width,12),Math.min(canvas.height,12));
      for(let i=3;i<data.length;i+=4)if(data[i]>10)return true;
    }catch{}
    return false;
  }
  function drawFallback(canvas,asset,cssSize=48){
    if(!canvas?.getContext)return;
    const size=Math.max(32,Number(cssSize)||48);
    const dpr=1;
    canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);
    canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;
    const ctx=canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,size,size);
    ctx.fillStyle='#173028';ctx.fillRect(0,0,size,size);
    ctx.strokeStyle='rgba(231,197,106,.35)';ctx.strokeRect(1,1,size-2,size-2);
    const label=String(asset?.label||asset?.id||'?');
    const glyph=/tree|arbol|oak|pine|willow|birch|flor/i.test(label)?'Tr':(label.slice(0,2).toUpperCase()||'?');
    ctx.fillStyle='#e7f5c8';ctx.font=`bold ${Math.max(11,Math.floor(size*0.34))}px system-ui,sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(glyph,size/2,size/2+1);
  }
  async function pump(){
    if(busy)return;
    busy=true;
    while(queue.length){
      const job=queue.shift();
      if(!job||job.token!==token)continue;
      try{
        await assetPreview.renderThumbnail(job.canvas,job.asset,{cssSize:job.cssSize||48});
      }catch{}
      if(!canvasHasInk(job.canvas))drawFallback(job.canvas,job.asset,job.cssSize||48);
      await wait(job.priority?12:28);
    }
    busy=false;
  }
  function enqueue(canvas,asset,{priority=false,cssSize=48}={}){
    if(!canvas||!asset)return;
    // Paint a visible glyph immediately so preview exists before atlas/decode (well under 20s).
    try{drawFallback(canvas,asset,cssSize);}catch{}
    const job={canvas,asset,priority:!!priority,cssSize,token};
    if(priority)queue.unshift(job);
    else{
      queue.push(job);
      if(queue.length>48)queue.splice(0,queue.length-48);
    }
    void pump();
  }
  function reset(){token++;queue.length=0;}
  return Object.freeze({
    render:(canvas,asset)=>enqueue(canvas,asset,{priority:false}),
    renderPriority:(canvas,asset)=>enqueue(canvas,asset,{priority:true,cssSize:54}),
    reset
  });
}

export async function openKeloStudioLive({root=globalThis}={}){
  if(active)return active;if(!root.document)throw new Error('STUDIO_DOM_REQUIRED');
  const actorId=actor(root);if(!root.KELO_ADMIN_KEYS?.can?.('world.edit',actorId))throw new Error('ADMIN_KEY_PERMISSION_DENIED');if(root.KELO_WORLD_BUILDER?.isMainWorld&&!root.KELO_WORLD_BUILDER.isMainWorld())throw new Error('STUDIO_MAIN_WORLD_ONLY');if(!root.KeloInputLocks?.acquire||!root.KeloInputLocks?.release)throw new Error('STUDIO_INPUT_LOCKS_NOT_READY');
  try{await root.KELO_WORLD_BUILDER_UI?.close?.(false);}catch{}
  if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  const createStudioLiveShell=await loadLiveStudioChrome();
  if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  const existing=root.document.getElementById('kelo-studio-live');
  if(!existing?.querySelector?.('.ks-top'))paintStubChrome(root,createStudioLiveShell);
  else{
    if(existing.dataset)existing.dataset.keloWorldLoading='1';
    const status=existing.querySelector('.ks-status');
    if(status&&!String(status.textContent||'').trim())status.textContent='Cargando editor…';
    try{root.document.getElementById('kelo-world-launch-curtain')?.remove?.();}catch{}
  }
  if(isPhone(root))await pause(root,40);
  const {
    createStudioOverlayCanvas,createCreatorGridOverlay,attachStudioPointerInput,
    createStudioCameraController,installStudioAuthorityMirror,createCreatorProductivityPanel,
    createCreatorActions,createCreatorPrefabLibrary,analyzeCreatorWorld,
    createMoveEntityCommand,createPatchEntityCommand
  }=await loadLiveStudioRuntime(root);
  if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  const draft=await ensureDraft(root,actorId);if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  const {bootKeloStudio}=await import(`../studio-entry.mjs?v=${BUILD}`);
  if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  const studio=await bootKeloStudio({mode:'world',actorId,root});if(root.KELO_WORLD_LAUNCH_ABORTED){try{studio.close();}catch{}throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');}
  const creator=createCreatorActions(studio.kernel),prefabLibrary=createCreatorPrefabLibrary({kernel:studio.kernel,store:studio.store,tool:studio.tools.prefabStamp,ownerId:actorId});
  const phonePreview=isPhone(root)?createPacedPhoneAssetPreview(studio.assetPreview,root):null;
  const renderPhoneAssetPreview=(canvas,asset)=>{
    if(!asset)return;
    // Compact/selected preview jumps the queue; library/strip rows stay paced.
    if(canvas?.closest?.('.ks-compact-asset'))phonePreview?.renderPriority(canvas,asset);
    else phonePreview?.render(canvas,asset);
  };
  let draftId=draft.draftId;const mirror=installStudioAuthorityMirror({adapter:studio.adapter,actorId,getDraftId:()=>draftId});
  let inputLockToken=null,overlay=null,overlayStart=0,shell=null,productivity=null,cameraController=null,unregisterInput=null,detachPointer=null,selectionUnsub=null,frame=0,running=true,playing=false,mode='select',dragEntity=null,directGesture=null,onKey=null,pinchScale=null,pinchPreviewFrame=0,pinchPreviewPending=null,pinchPreviewChain=Promise.resolve();
  try{
    inputLockToken=root.KeloInputLocks.acquire('kelo-studio',{kind:'creator-session',draftId});
    const baseAssets=studio.adapter.assetCatalog.list()||[],allAssets=()=>[...baseAssets,...prefabLibrary.assets()];
    const materials=Array.from(new Set([...(root.KELO_WORLD_BUILDER?.materials||[]),...Object.keys(root.KELO_TERRAIN_CONTRACT?.materials||{})])),groundMaterial=materials.includes('grass')?'grass':materials[0]||'grass',pathMaterial=materials.includes('marble')?'marble':materials[1]||materials[0]||'grass';
    let snapSize=Math.max(1,Number(studio.kernel.document.settings?.tileSize)||32);const gridOverlay=createCreatorGridOverlay({size:snapSize,visible:true});
    const surfaceCount=()=>Object.keys(studio.kernel.document.terrain||{}).length,collisionCount=()=>Object.keys(studio.kernel.document.navigation?.collisions||{}).length,scene=()=>({entities:studio.kernel.document.entities,selection:studio.kernel.selection.get()});
    const isStudioUi=e=>!!e?.target?.closest?.('[data-kelo-studio-ui]');
    function syncModeUi(){shell?.root?.querySelectorAll?.('[data-mode]')?.forEach?.(b=>b.classList.toggle('on',b.dataset.mode===mode));}
    function updateShell(){shell?.setHistory({canUndo:studio.kernel.history.canUndo,canRedo:studio.kernel.history.canRedo});shell?.setScene(scene());syncModeUi();productivity?.setCamera(mode==='camera');productivity?.setZoom(cameraController?.zoom||1);shell?.setStatus(`${playing?'PLAY':mode.toUpperCase()} · ${studio.kernel.document.entities.length} objects · ${surfaceCount()} surface · ${collisionCount()} collision · ${Math.round((cameraController?.zoom||1)*100)}% · ${studio.kernel.history.undoDepth} undo`);}
    async function guarded(fn){try{const value=await fn();updateShell();return value;}catch(e){toast(root,e.message||String(e));return null;}}
    function cancelDirectGesture(){if(directGesture?.kind==='object')studio.tools.transform.cancel();directGesture=null;}
    function cancelTransient(except=''){cancelDirectGesture();if(except!=='placement')studio.tools.placement.cancel();if(except!=='prefab')studio.tools.prefabStamp.cancel();if(except!=='terrain')studio.tools.terrain.cancel();if(except!=='collision')studio.tools.collision.cancel();if(except!=='marquee')studio.tools.marquee.cancel();if(except!=='move')studio.tools.transform.cancel();}
    function setMode(next){if(playing)return;mode=['select','move','camera','placement','prefab','terrain','path','collision'].includes(next)?next:'select';dragEntity=null;cancelTransient(mode==='path'?'terrain':mode);cameraController?.setPanMode(mode==='camera');studio.tools.collision.setVisible(mode==='collision');if(mode==='terrain')studio.tools.terrain.configure({role:'terrain',material:groundMaterial,erase:false});if(mode==='path')studio.tools.terrain.configure({role:'path',material:pathMaterial,erase:false});updateShell();}
    function beginPlacement(assetId){if(playing)return;try{cameraController?.setPanMode(false);studio.tools.terrain.cancel();studio.tools.collision.setVisible(false);studio.tools.placement.cancel();studio.tools.prefabStamp.cancel();if(prefabLibrary.get(assetId)){studio.tools.prefabStamp.start(assetId);mode='prefab';}else{studio.tools.placement.start(assetId);studio.assetPreview.warmAsset(assetId).catch(()=>{});mode='placement';}updateShell();}catch(e){toast(root,e.message);}}
    async function changeProperty(prop,value){const id=studio.kernel.selection.get()[0],entity=studio.kernel.document.entities.find(e=>e.id===id);if(!entity)return;if(prop==='x'||prop==='y'){const to={x:Number(entity.transform?.x)||0,y:Number(entity.transform?.y)||0};to[prop]=Number(value)||0;await studio.kernel.execute(createMoveEntityCommand(id,to));}else if(prop==='rotation')await studio.kernel.execute(createPatchEntityCommand(id,{transform:{...(entity.transform||{}),rotation:Number(value)||0}}));else if(prop==='scale')await studio.kernel.execute(createPatchEntityCommand(id,{transform:{...(entity.transform||{}),scale:Math.max(.1,Math.min(8,Number(value)||1))}}));}
    async function saveDraft(){await studio.adapter.worldEditRequest('world:draft:save',{actorId,draftId});await studio.checkpoint();}
    const validateMap=()=>analyzeCreatorWorld({document:studio.kernel.document,prefabs:studio.kernel.prefabs});
    function selectionRect(){const rows=studio.kernel.selection.get().map(id=>studio.kernel.spatial.get(id)?.rect).filter(Boolean);if(!rows.length)return null;const x=Math.min(...rows.map(r=>r.x)),y=Math.min(...rows.map(r=>r.y)),x2=Math.max(...rows.map(r=>r.x+r.w)),y2=Math.max(...rows.map(r=>r.y+r.h));return{x,y,w:x2-x,h:y2-y};}
    const clampScale=v=>{const n=Number(v);return Math.max(.1,Math.min(8,Number.isFinite(n)?Math.round(n*100)/100:1));};
    function pinchEntityAt(worldX,worldY){if(playing||studio.kernel.selection.get().length!==1)return null;const id=studio.kernel.selection.get()[0],row=studio.kernel.spatial.get(id);if(!row?.rect)return null;const pad=22/Math.max(.25,cameraController?.effectiveZoom||1),r=row.rect;if(worldX<r.x-pad||worldX>r.x+r.w+pad||worldY<r.y-pad||worldY>r.y+r.h+pad)return null;return studio.kernel.document.entities.find(e=>String(e.id)===String(id))||null;}
    function previewLocalScale(entity,value){const scale=clampScale(value);entity.transform={...(entity.transform||{}),scale};const x=Number(entity.transform?.x)||0,y=Number(entity.transform?.y)||0,w=Math.max(1,(Number(entity.bounds?.w)||1)*scale),h=Math.max(1,(Number(entity.bounds?.h)||1)*scale);studio.kernel.spatial.upsert({id:entity.id,category:'entity',rect:{x,y,w,h},data:entity});shell?.setScaleGesture?.(scale,{active:!!pinchScale});return scale;}
    function queuePinchPreview(id,scale){pinchPreviewPending={id,scale};if(pinchPreviewFrame)return;const run=()=>{pinchPreviewFrame=0;const next=pinchPreviewPending;pinchPreviewPending=null;if(!next)return;pinchPreviewChain=pinchPreviewChain.catch(()=>{}).then(()=>mirror.previewScale(next.id,next.scale)).catch(e=>console.warn('[Kelo Studio] pinch preview',e));};pinchPreviewFrame=root.requestAnimationFrame?.(run)||setTimeout(run,16);}
    function cancelPinchPreviewFrame(){if(!pinchPreviewFrame)return;if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(pinchPreviewFrame);else clearTimeout(pinchPreviewFrame);pinchPreviewFrame=0;}
    async function flushPinchPreview(){cancelPinchPreviewFrame();const next=pinchPreviewPending;pinchPreviewPending=null;if(next)pinchPreviewChain=pinchPreviewChain.catch(()=>{}).then(()=>mirror.previewScale(next.id,next.scale));try{await pinchPreviewChain;}catch{}}
    function beginPinchScale({worldX,worldY}={}){const entity=pinchEntityAt(worldX,worldY);if(!entity)return false;dragEntity=null;cancelDirectGesture();studio.tools.transform.cancel();studio.tools.marquee.cancel();const baseScale=clampScale(entity.transform?.scale);pinchScale={id:String(entity.id),baseScale:baseScale,currentScale:baseScale};shell?.setScaleGesture?.(baseScale,{active:true});return true;}
    function movePinchScale({ratio=1}={}){if(!pinchScale)return;const entity=studio.kernel.document.entities.find(e=>String(e.id)===pinchScale.id);if(!entity)return;const next=clampScale(pinchScale.baseScale*(Number(ratio)||1));if(next===pinchScale.currentScale)return;pinchScale.currentScale=next;previewLocalScale(entity,next);queuePinchPreview(entity.id,next);}
    async function endPinchScale({cancelled=false}={}){const gesture=pinchScale;if(!gesture)return null;pinchScale=null;await flushPinchPreview();const entity=studio.kernel.document.entities.find(e=>String(e.id)===gesture.id);if(!entity)return null;const finalScale=gesture.currentScale;previewLocalScale(entity,gesture.baseScale);if(cancelled||Math.abs(finalScale-gesture.baseScale)<.005){await mirror.previewScale(gesture.id,gesture.baseScale);shell?.setScaleGesture?.(gesture.baseScale,{active:false});updateShell();return entity;}await creator.scaleSelection({value:finalScale});shell?.setScaleGesture?.(finalScale,{active:false});updateShell();return entity;}
    function beginDirectObjectDrag(e,hit){const entity=studio.kernel.document.entities.find(row=>String(row.id)===String(hit?.id));if(!entity)return false;studio.tools.transform.cancel();studio.tools.transform.begin(entity.id);const t=entity.transform||{};directGesture={kind:'object',pointerId:e.pointerId,startClientX:e.clientX,startClientY:e.clientY,startWorldX:e.worldX,startWorldY:e.worldY,anchorX:Number(t.x)||0,anchorY:Number(t.y)||0,moved:false};return true;}
    function beginDirectCameraPan(e){directGesture={kind:'camera',pointerId:e.pointerId,startClientX:e.clientX,startClientY:e.clientY,lastClientX:e.clientX,lastClientY:e.clientY,moved:false};}
    function moveDirectGesture(e){const g=directGesture;if(!g||(g.pointerId!=null&&e.pointerId!==g.pointerId))return false;if(g.kind==='object'){if(!g.moved&&Math.hypot(e.clientX-g.startClientX,e.clientY-g.startClientY)<DIRECT_DRAG_THRESHOLD)return true;g.moved=true;const x=g.anchorX+(e.worldX-g.startWorldX),y=g.anchorY+(e.worldY-g.startWorldY);studio.tools.transform.previewMove(x,y,{snap:snapSize});return true;}if(g.kind==='camera'){const total=Math.hypot(e.clientX-g.startClientX,e.clientY-g.startClientY),dx=e.clientX-g.lastClientX,dy=e.clientY-g.lastClientY;g.lastClientX=e.clientX;g.lastClientY=e.clientY;if(!g.moved&&total<DIRECT_DRAG_THRESHOLD)return true;g.moved=true;cameraController?.panScreen(dx,dy);return true;}return false;}
    async function endDirectGesture({cancelled=false}={}){const g=directGesture;directGesture=null;if(!g)return null;if(g.kind!=='object')return null;if(cancelled||!g.moved){studio.tools.transform.cancel();return null;}return studio.tools.transform.commit();}
    function focusSelection(){const rect=selectionRect();if(!rect){toast(root,'Selecciona algo para enfocar');return;}cameraController?.focusRect(rect,{padding:120});updateShell();}
    function setPlayChrome(on){const r=shell?.root;if(!r)return;for(const sel of ['.ks-left','.ks-right','.ks-bottom']){const el=r.querySelector(sel);if(el)el.style.display=on?'none':'';}const b=r.querySelector('[data-act="play"]');if(b)b.textContent=on?'■ EDIT':'▶ PLAY';if(overlay?.canvas)overlay.canvas.style.display=on?'none':'';}
    async function togglePlaytest(){if(!playing){await saveDraft();playing=true;cancelDirectGesture();cameraController?.suspend();if(inputLockToken){root.KeloInputLocks.release(inputLockToken);inputLockToken=null;}setPlayChrome(true);toast(root,'Playtest activo · toca EDIT para volver');}else{inputLockToken=root.KeloInputLocks.acquire('kelo-studio',{kind:'creator-session',draftId});playing=false;cameraController?.resume();cameraController?.setPanMode(mode==='camera');setPlayChrome(false);toast(root,'Modo edición');}updateShell();}
    function cancelForCamera(){dragEntity=null;cancelDirectGesture();studio.tools.transform.cancel();studio.tools.marquee.cancel();if(studio.tools.terrain.state().stroke)studio.tools.terrain.cancel();studio.tools.collision.cancel();}
    cameraController=createStudioCameraController({root,isUi:isStudioUi,onNavigateStart:cancelForCamera,onPinchStart:payload=>mode==='select'?false:beginPinchScale(payload),onPinchMove:movePinchScale,onPinchEnd:payload=>{void guarded(()=>endPinchScale(payload));}});

    const handlers={
      pointerdown:e=>{if(playing)return false;if(mode==='camera')return true;if(mode==='placement'){studio.tools.placement.move(e.worldX,e.worldY,{snap:snapSize});return true;}if(mode==='prefab'){studio.tools.prefabStamp.move(e.worldX,e.worldY,{snap:snapSize});return true;}if(mode==='terrain'||mode==='path'){studio.tools.terrain.beginStroke(e.worldX,e.worldY);return true;}if(mode==='collision'){studio.tools.collision.beginAt(e.worldX,e.worldY);return true;}const append=mode==='select'&&!!(e.originalEvent?.shiftKey||e.originalEvent?.metaKey||e.originalEvent?.ctrlKey),hit=studio.tools.select.selectPoint(e.worldX,e.worldY,{append});if(mode==='move'&&hit){dragEntity=hit.id;studio.tools.transform.begin(hit.id);}else if(mode==='select'&&hit&&!append){beginDirectObjectDrag(e,hit);}else if(mode==='select'&&!hit&&e.pointerType==='touch'&&!append){beginDirectCameraPan(e);}else if(mode==='select'&&!hit&&e.pointerType!=='touch')studio.tools.marquee.begin(e.worldX,e.worldY,{append});updateShell();return true;},
      pointermove:e=>{if(playing)return false;if(mode==='camera')return true;if(mode==='placement')studio.tools.placement.move(e.worldX,e.worldY,{snap:snapSize});else if(mode==='prefab')studio.tools.prefabStamp.move(e.worldX,e.worldY,{snap:snapSize});else if((mode==='terrain'||mode==='path')&&studio.tools.terrain.state().stroke)studio.tools.terrain.strokeTo(e.worldX,e.worldY);else if(mode==='terrain'||mode==='path')studio.tools.terrain.move(e.worldX,e.worldY);else if(mode==='collision'&&studio.tools.collision.getPreview())studio.tools.collision.move(e.worldX,e.worldY);else if(mode==='move'&&dragEntity)studio.tools.transform.previewMove(e.worldX,e.worldY,{snap:snapSize});else if(mode==='select'&&directGesture)moveDirectGesture(e);else if(mode==='select'&&studio.tools.marquee.active)studio.tools.marquee.move(e.worldX,e.worldY);return true;},
      pointerup:e=>{if(playing)return false;if(mode==='camera')return true;if(mode==='placement'&&studio.tools.placement.getPreview()){const id=studio.tools.placement.getPreview().prefabId;void guarded(async()=>{await studio.tools.placement.commit();studio.tools.placement.start(id);studio.tools.placement.move(e.worldX,e.worldY,{snap:snapSize});});}else if(mode==='prefab'&&studio.tools.prefabStamp.getPreview()){const id=studio.tools.prefabStamp.getPreview().prefabId;void guarded(async()=>{await studio.tools.prefabStamp.commit();studio.tools.prefabStamp.start(id);studio.tools.prefabStamp.move(e.worldX,e.worldY,{snap:snapSize});});}else if((mode==='terrain'||mode==='path')&&studio.tools.terrain.state().stroke)void guarded(async()=>{await studio.tools.terrain.commitStroke();studio.tools.terrain.move(e.worldX,e.worldY);});else if(mode==='collision'&&studio.tools.collision.getPreview())void guarded(()=>studio.tools.collision.commit());else if(mode==='move'&&dragEntity){dragEntity=null;void guarded(()=>studio.tools.transform.commit());}else if(mode==='select'&&directGesture){void guarded(()=>endDirectGesture());}else if(mode==='select'&&studio.tools.marquee.active){studio.tools.marquee.commit();updateShell();}return true;},
      pointercancel:()=>{if(playing)return false;if(mode==='camera')return true;if(mode==='move'){dragEntity=null;studio.tools.transform.cancel();}if(mode==='select'&&directGesture)void endDirectGesture({cancelled:true});studio.tools.marquee.cancel();if(mode==='terrain'||mode==='path')studio.tools.terrain.cancel();if(mode==='collision')studio.tools.collision.cancel();return true;}
    };
    unregisterInput=studio.kernel.input.register('studio-live',handlers,1000);studio.kernel.input.push('studio-live');
    detachPointer=attachStudioPointerInput({element:root.document,router:studio.kernel.input,toWorld:(x,y)=>cameraController.toWorld(x,y),capture:true,stopPropagation:true,shouldHandle:e=>running&&!playing&&!isStudioUi(e)});
    const phoneShell=isPhone(root);
    shell=createStudioLiveShell({host:root.document.body,reuse:phoneShell&&!!root.document.getElementById('kelo-studio-live')?.querySelector?.('.ks-top'),assets:phoneShell?phoneSeedAssets(allAssets()):allAssets(),onMode:setMode,onAsset:beginPlacement,onUndo:()=>guarded(()=>studio.kernel.undo()),onRedo:()=>guarded(()=>studio.kernel.redo()),onRotate:()=>guarded(()=>mode==='placement'?Promise.resolve(studio.tools.placement.rotate(90)):mode==='prefab'?(toast(root,'Coloca el prefab y luego rota sus piezas.'),Promise.resolve(null)):creator.rotateSelection(90)),onDuplicate:()=>guarded(()=>creator.duplicateSelection()),onScale:action=>guarded(()=>creator.scaleSelection(action==='reset'?{value:1}:{delta:action==='down'?-.1:.1})),onDelete:()=>guarded(()=>creator.removeSelection()),onSelectEntity:(id,{append=false}={})=>{if(append)studio.kernel.selection.add(id);else studio.kernel.selection.set(id);updateShell();},onPropertyChange:(prop,value)=>guarded(()=>changeProperty(prop,value)),onBrushSize:size=>{studio.tools.terrain.configure({brushSize:size});updateShell();},onErase:erase=>{if(mode==='terrain'||mode==='path'){studio.tools.terrain.configure({erase});updateShell();}},onPlay:()=>guarded(togglePlaytest),onSave:()=>guarded(async()=>{await saveDraft();toast(root,'Studio guardado');}),onFocus:focusSelection,renderAssetPreview:phoneShell?renderPhoneAssetPreview:(canvas,asset)=>studio.assetPreview.renderThumbnail(canvas,asset),onClose:()=>{void closeKeloStudioLive({root});}});
    try{root.document.getElementById('kelo-world-launch-curtain')?.remove();}catch{}
    if(phoneShell){(root.setTimeout||setTimeout)(async()=>{if(!running||productivity)return;try{const pace=await import('./studio-boot-pace.mjs');await pace.whenStudioIdle(root,{timeoutMs:600});await pace.pauseStudioBoot(root,40);}catch{}if(!running||productivity)return;const prodUi=await import('../ui/creator-productivity-panel.mjs');if(!running||productivity)return;try{const pace=await import('./studio-boot-pace.mjs');await pace.pauseStudioBoot(root,48);}catch{}if(!running||productivity)return;productivity=prodUi.createCreatorProductivityPanel({shell,onCameraToggle:on=>{setMode(on?'camera':'select');return mode==='camera';},onZoomIn:()=>{const z=cameraController.setZoom(cameraController.zoom*1.2);updateShell();return z;},onZoomOut:()=>{const z=cameraController.setZoom(cameraController.zoom/1.2);updateShell();return z;},onZoomReset:()=>{const z=cameraController.setZoom(1);updateShell();return z;},onCopy:()=>{const count=creator.copySelection();productivity?.setClipboard(count);toast(root,count?`${count} objeto${count===1?'':'s'} copiado${count===1?'':'s'}`:'Selecciona algo para copiar');return count;},onPaste:()=>guarded(()=>creator.pasteClipboard()),onSavePrefab:async label=>{try{const def=await prefabLibrary.captureSelection({label});shell.setAssets(allAssets());toast(root,`${def.label} guardado en My Prefabs`);return def;}catch(e){toast(root,e.message||String(e));return false;}},onValidate:async()=>validateMap(),onSnapChange:size=>{snapSize=Math.max(1,Number(size)||1);gridOverlay.configure({size:snapSize});toast(root,snapSize===1?'Snap libre':`Snap ${snapSize}px`);},onGridToggle:visible=>gridOverlay.configure({visible})});productivity.setSnap(snapSize);},22000);}else {productivity=createCreatorProductivityPanel({shell,onCameraToggle:on=>{setMode(on?'camera':'select');return mode==='camera';},onZoomIn:()=>{const z=cameraController.setZoom(cameraController.zoom*1.2);updateShell();return z;},onZoomOut:()=>{const z=cameraController.setZoom(cameraController.zoom/1.2);updateShell();return z;},onZoomReset:()=>{const z=cameraController.setZoom(1);updateShell();return z;},onCopy:()=>{const count=creator.copySelection();productivity?.setClipboard(count);toast(root,count?`${count} objeto${count===1?'':'s'} copiado${count===1?'':'s'}`:'Selecciona algo para copiar');return count;},onPaste:()=>guarded(()=>creator.pasteClipboard()),onSavePrefab:async label=>{try{const def=await prefabLibrary.captureSelection({label});shell.setAssets(allAssets());toast(root,`${def.label} guardado en My Prefabs`);return def;}catch(e){toast(root,e.message||String(e));return false;}},onValidate:async()=>validateMap(),onSnapChange:size=>{snapSize=Math.max(1,Number(size)||1);gridOverlay.configure({size:snapSize});toast(root,snapSize===1?'Snap libre':`Snap ${snapSize}px`);},onGridToggle:visible=>gridOverlay.configure({visible})});productivity.setSnap(snapSize);}selectionUnsub=studio.kernel.selection.onChange(updateShell);updateShell();
    void prefabLibrary.load().then(()=>{if(isPhone(root))return;try{shell?.setAssets?.(allAssets());updateShell();}catch{}}).catch(e=>console.warn('[Kelo Studio] creator prefab cache unavailable',e));
    if(isPhone(root)&&shell?.root){
      const loadFullAssets=()=>{
        if(!running||shell.root.dataset.keloAssetsReady==='1')return;
        shell.root.dataset.keloAssetsReady='1';
        try{
          phonePreview?.reset?.();
          const list=allAssets();
          ensurePhonePlacementPrefabs(studio,list.slice(0,80));
          shell.setAssets(list);
          try{shell.openAssets?.();}catch{}
          updateShell();
        }catch{}
      };
      const paintSeed=(why='',{openSheet=false}={})=>{
        if(!running||!shell?.setAssets)return null;
        try{
          const seed=phoneSeedAssets(allAssets());
          ensurePhonePlacementPrefabs(studio,seed);
          // Do not reset the preview queue on first paint — keep immediate glyphs.
          if(why==='refresh')phonePreview?.reset?.();
          shell.setAssets(seed);
          const first=seed[0];
          if(first?.id){
            try{shell.setSelectedAsset?.(first.id,{compact:false});}catch{}
          }
          if(openSheet){
            try{shell.openAssets?.();}catch{}
          }
          updateShell();
          for(const asset of seed.slice(0,8)){
            try{studio.assetPreview.warmAsset(asset.id||asset).catch(()=>{});}catch{}
          }
          try{shell?.setStatus?.(`${mode.toUpperCase()} · ${seed.length} assets · preview`);}catch{}
          return seed;
        }catch{return null;}
      };
      // A11: assets+preview in first seconds (not after 12–20s heavy waves).
      const immediate=paintSeed('seed',{openSheet:true});
      (root.setTimeout||setTimeout)(()=>{
        if(!running)return;
        paintSeed('reinforce',{openSheet:true});
      },450);
      (root.setTimeout||setTimeout)(()=>{
        if(!running||shell.root.dataset.keloAssetsReady==='1')return;
        const n=(allAssets()||[]).length;
        if(n>4)paintSeed('refresh',{openSheet:true});
      },2400);
      shell.root.addEventListener('click',e=>{if(e.target?.closest?.('[data-act="edit-assets"]'))loadFullAssets();},{capture:true});
      void immediate;
    }
    if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
    await yieldLiveMount(root);
    if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
    updateShell();
    const phoneOverlay=isPhone(root);
    const overlayDrawMs=phoneOverlay?90:16;
    function stopOverlayDraw(){
      if(overlayStart){(root.clearTimeout||clearTimeout)(overlayStart);overlayStart=0;}
      if(typeof root.cancelAnimationFrame==='function')try{root.cancelAnimationFrame(frame);}catch{}
      try{(root.clearTimeout||clearTimeout)(frame);}catch{}
      frame=0;
    }
    function draw(){
      if(!running)return;
      if(!playing&&overlay){
        overlay.resize();
        overlay.clear();
        const ctx=overlay.ctx,w=overlay.canvas.clientWidth||root.innerWidth||1,h=overlay.canvas.clientHeight||root.innerHeight||1,z=cameraController?.effectiveZoom||1,c=root.camera||{x:0,y:0};
        ctx.save();ctx.translate(w/2,h/2);ctx.scale(z,z);ctx.translate(-c.x,-c.y);
        gridOverlay.draw(ctx,{camera:c,viewWidth:w,viewHeight:h,zoom:z});
        studio.overlayRenderer.draw(ctx);
        ctx.restore();
      }
      if(!running)return;
      if(phoneOverlay)frame=(root.setTimeout||setTimeout)(draw,overlayDrawMs);
      else frame=root.requestAnimationFrame?.(draw)||setTimeout(draw,16);
    }
    function startStudioOverlayDraw(){
      overlayStart=0;
      if(!running||overlay)return;
      if(phoneOverlay)return;
      try{overlay=createStudioOverlayCanvas({host:root.document.body});}catch(error){console.warn('[Kelo Studio] overlay canvas unavailable; chrome stays up',error);return;}
      draw();
    }
    async function hydrateAfterChrome(){
      overlayStart=0;
      if(!running||root.KELO_WORLD_LAUNCH_ABORTED)return;
      // A10 phone: auto importCurrent (structuredClone + draft snapshot) freezes WebContent
      // even when delayed. Keep an empty editable document + TREE seed; draft can load later
      // from desktop or an explicit reload path without blocking first paint survival.
      if(phoneOverlay){
        try{shell?.setStatus?.(`${mode.toUpperCase()} · listo · coloca assets`);}catch{}
        updateShell();
        return;
      }
      try{
        await studio.importCurrent({view:'draft',draftId});
        if(!running||root.KELO_WORLD_LAUNCH_ABORTED)return;
        for(const e of studio.kernel.document.entities)mirror.seed(e.id,e.source?.authorityPlacementId||e.id);for(const c of Object.values(studio.kernel.document.navigation?.collisions||{}))mirror.seedCollision(c.collisionId,c.collisionId);
        updateShell();
        startStudioOverlayDraw();
      }catch(error){
        console.warn('[Kelo Studio] draft import deferred; chrome stays up',error);
        try{shell?.setStatus?.('Editor listo');}catch{}
      }
    }
    onKey=e=>{if(isStudioUi(e))return;const key=e.key.toLowerCase();if(playing){if(key==='escape'){e.preventDefault();void guarded(togglePlaytest);}return;}if((e.metaKey||e.ctrlKey)&&key==='z'){e.preventDefault();void guarded(()=>e.shiftKey?studio.kernel.redo():studio.kernel.undo());return;}if((e.metaKey||e.ctrlKey)&&key==='d'){e.preventDefault();void guarded(()=>creator.duplicateSelection());return;}if((e.metaKey||e.ctrlKey)&&key==='c'){e.preventDefault();const count=creator.copySelection();productivity?.setClipboard(count);toast(root,count?`${count} objeto${count===1?'':'s'} copiado${count===1?'':'s'}`:'Selecciona algo para copiar');return;}if((e.metaKey||e.ctrlKey)&&key==='v'){e.preventDefault();void guarded(()=>creator.pasteClipboard());return;}if((e.metaKey||e.ctrlKey)&&key==='s'){e.preventDefault();void guarded(async()=>{await saveDraft();toast(root,'Studio guardado');});return;}if(key==='f'){e.preventDefault();focusSelection();return;}if(key==='+'||key==='='){e.preventDefault();cameraController.setZoom(cameraController.zoom*1.2);updateShell();return;}if(key==='-'){e.preventDefault();cameraController.setZoom(cameraController.zoom/1.2);updateShell();return;}if(key==='0'){e.preventDefault();cameraController.setZoom(1);updateShell();return;}if(key==='escape'){e.preventDefault();if(['camera','placement','prefab','terrain','path','collision'].includes(mode)){cancelTransient();setMode('select');}else void closeKeloStudioLive({root});return;}if(key==='r'){e.preventDefault();void guarded(()=>mode==='placement'?Promise.resolve(studio.tools.placement.rotate(90)):mode==='prefab'?Promise.resolve(null):creator.rotateSelection(90));return;}if(key==='e'&&(mode==='terrain'||mode==='path')){e.preventDefault();const next=!studio.tools.terrain.state().erase;studio.tools.terrain.configure({erase:next});shell?.setErase(next);updateShell();return;}if(key==='delete'||key==='backspace'){e.preventDefault();if(mode==='collision'&&studio.tools.collision.selectedId)void guarded(()=>studio.tools.collision.removeSelected());else void guarded(()=>creator.removeSelection());return;}if(key==='q')setMode('select');else if(key==='v')setMode('move');else if(key==='h')setMode(mode==='camera'?'select':'camera');else if(key==='g')setMode('terrain');else if(key==='p')setMode('path');else if(key==='c')setMode('collision');};root.document.addEventListener('keydown',onKey,true);
    const liveSession={version:'kelo-studio-creator-v1.8.0-world-bridge-a11',studio,prefabLibrary,cameraController,get draftId(){return draftId;},get mode(){return mode;},get playing(){return playing;},get snapSize(){return snapSize;},setMode,beginPlacement,focusSelection,validate:validateMap,togglePlaytest:()=>guarded(togglePlaytest),close:()=>closeKeloStudioLive({root})};
    Object.defineProperty(liveSession,'__cleanup',{value:async()=>{running=false;cancelDirectGesture();if(pinchScale){try{await endPinchScale({cancelled:true});}catch{}}cancelPinchPreviewFrame();stopOverlayDraw();if(onKey)root.document.removeEventListener('keydown',onKey,true);selectionUnsub?.();detachPointer?.();cameraController?.destroy();studio.kernel.input.pop('studio-live');unregisterInput?.();mirror.uninstall();productivity?.destroy();shell?.destroy();overlay?.destroy();studio.tools.collision.setVisible(false);if(inputLockToken){root.KeloInputLocks.release(inputLockToken);inputLockToken=null;}try{await studio.checkpoint();}catch{}try{studio.close();}catch{}try{await root.KELO_WORLD_EDIT?.request?.('world:view:published',{actorId});}catch{}},enumerable:false});
    if(shell?.root?.dataset)delete shell.root.dataset.keloWorldLoading;
    try{
      shell?.root?.querySelectorAll?.('button,select,input')?.forEach?.(control=>{
        if(control.dataset?.keloProvisionalDisabled==='1'){
          control.disabled=false;control.removeAttribute?.('aria-disabled');delete control.dataset.keloProvisionalDisabled;
        }
      });
      if(shell?.root?.dataset)shell.root.dataset.keloStudioInteractive='1';
    }catch{}
    active=Object.freeze(liveSession);root.document.body.classList.add('kelo-studio-active');toast(root,'Kelo Studio Creator V1.8 activo');
    if(phoneOverlay){
      try{shell?.setStatus?.(`${mode.toUpperCase()} · listo`);}catch{}
      // A10: phone hydrate is status-only (no importCurrent). Run soon so UI says listo.
      overlayStart=(root.setTimeout||setTimeout)(hydrateAfterChrome,400);
    }else overlayStart=(root.setTimeout||setTimeout)(hydrateAfterChrome,0);
    return active;
  }catch(error){running=false;try{if(overlayStart){(root.clearTimeout||clearTimeout)(overlayStart);overlayStart=0;}}catch{}try{if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(frame);}catch{}try{(root.clearTimeout||clearTimeout)(frame);}catch{}try{cancelDirectGesture();detachPointer?.();cameraController?.destroy();}catch{}try{studio.kernel.input.pop('studio-live');unregisterInput?.();}catch{}try{mirror.uninstall();}catch{}try{productivity?.destroy();shell?.destroy();overlay?.destroy();studio.tools.collision.setVisible(false);}catch{}if(inputLockToken){try{root.KeloInputLocks.release(inputLockToken);}catch{}inputLockToken=null;}try{studio.close();}catch{}throw error;}
}

export async function closeKeloStudioLive({root=globalThis}={}){if(!active)return;const session=active;active=null;root.document?.body?.classList.remove('kelo-studio-active');await session.__cleanup?.();}
export function getKeloStudioLive(){return active;}