/* KELO-INDEX
 * area: CREATORS / WORLD WORKSPACE
 * owner: World workspace manifest only
 * owns: descriptor and lazy routing into existing live Studio controller
 * does-not-own: World editor, commands, drafts, authority, terrain, collisions, PropertySystem or camera
 * reuse: existing openKeloStudioLive() remains implementation; Map Forge handoff imports through Studio adapter + KELO_WORLD_EDIT and focuses through KeloCamera
 * mobile: paint Studio chrome first; the world-studio-bridge is the single owner of the serialized critical iPhone prewarm so Safari does not parse the full editor graph before controller hydrate; recovery retries use a stable build tag, never a nonce
 */
import { waitForWorldEditAuthority } from '../adapters/world-creator-adapter.mjs';

const actor=root=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
const finite=v=>Number.isFinite(Number(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const LAUNCH_CURTAIN_ID='kelo-world-launch-curtain';
const STUDIO_OPEN_MS=20000;
const DEFAULT_LAUNCH_YIELD_MS=420;
const DEFAULT_RUNTIME_YIELD_FALLBACK_MS=120;
const WORLD_BUILD='world-bridge-20260915-22';
const PHONE_RUNTIME_ROOTS=Object.freeze([
  '../../studio/input/pointer-input-adapter.mjs',
  '../../studio/input/studio-camera-controller.mjs',
  '../../studio/integration/authority-command-mirror.mjs',
  '../../studio/tools/creator-actions.mjs',
  '../../studio/prefabs/creator-prefab-library.mjs',
  '../../studio/document/document-commands.mjs',
  '../../studio/core/studio-kernel.mjs',
  '../../studio/document/world-document.mjs',
  '../../studio/compiler/world-compiler.mjs',
  '../../studio/adapters/kelo-runtime-adapter.mjs',
  '../../studio/adapters/current-world-importer.mjs',
  '../../studio/adapters/catalog-prefab-seeder.mjs',
  '../../studio/components/kelo-components.mjs',
  '../../studio/storage/indexeddb-studio-store.mjs',
  '../../studio/performance/studio-profiler.mjs',
  '../../studio/tools/register-core-tools-serial.mjs',
  '../../studio/render/studio-asset-preview-service.mjs',
  '../../studio/input/studio-placement-touch-controller.mjs',
  `../../studio/studio-entry.mjs?v=${WORLD_BUILD}`
]);
const studioOpenBudget=root=>Math.max(250,Number(root?.KELO_WORLD_OPEN_TIMEOUT_MS)||STUDIO_OPEN_MS);
const studioShellMounted=root=>{
  const doc=root?.document;
  if(!doc?.getElementById)return true;
  const shell=doc.getElementById('kelo-studio-live');
  if(!shell||shell.isConnected===false)return false;
  return shell.dataset?.keloWorldLoading!=='1';
};
export function isPhoneWorldBootstrap(root=globalThis){
  const ua=String(root?.navigator?.userAgent||'');
  const short=Math.min(Number(root?.innerWidth)||999,Number(root?.innerHeight)||999);
  const touch=Number(root?.navigator?.maxTouchPoints)||0;
  let coarse=false;
  try{coarse=!!root?.matchMedia?.('(pointer: coarse)')?.matches;}catch{}
  return /iPhone|iPad|iPod/i.test(ua)||short<=500||(coarse&&touch>0&&short<=900);
}
function yieldRuntimeTurn(root){
  return new Promise(resolve=>{
    const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
    const cancel=typeof root?.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
    const configured=Number(root?.KELO_WORLD_RUNTIME_YIELD_FALLBACK_MS);
    const fallbackMs=Number.isFinite(configured)?Math.max(0,configured):DEFAULT_RUNTIME_YIELD_FALLBACK_MS;
    let settled=false,timer=null;
    const finish=()=>{
      if(settled)return;
      settled=true;
      if(timer!=null)cancel(timer);
      resolve();
    };
    const raf=root?.requestAnimationFrame;
    if(typeof raf==='function'){
      timer=wait(finish,fallbackMs);
      try{raf.call(root,finish);return;}catch{}
      if(timer!=null){cancel(timer);timer=null;}
    }
    wait(finish,0);
  });
}
function paintBootProgress(root,loaded,total){
  const msg=`Cargando editor… ${loaded}/${total}`;
  try{
    const doc=root?.document;
    const status=typeof doc?.querySelector==='function'?doc.querySelector('[data-kelo-world-launch-status], #kelo-studio-live .ks-status'):null;
    if(status)status.textContent=msg;
    const curtain=typeof doc?.getElementById==='function'?doc.getElementById(LAUNCH_CURTAIN_ID):null;
    if(curtain)curtain.textContent=msg;
  }catch{}
}
export async function preloadPhoneStudioRuntime(root=globalThis,{load=null,yieldControl=null,modules=PHONE_RUNTIME_ROOTS}={}){
  if(!isPhoneWorldBootstrap(root))return Object.freeze({enabled:false,loaded:0,total:modules.length});
  const importer=typeof load==='function'?load:(specifier=>import(specifier));
  const release=typeof yieldControl==='function'?yieldControl:()=>yieldRuntimeTurn(root);
  let loaded=0;
  for(const specifier of modules){
    if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
    await importer(specifier);
    loaded++;
    paintBootProgress(root,loaded,modules.length);
    if(loaded<modules.length)await release();
  }
  return Object.freeze({enabled:true,loaded,total:modules.length});
}
function paintLaunchCurtain(root,message='Abriendo World Editor…'){
  const doc=root?.document;
  if(!doc?.body||typeof doc.createElement!=='function')return null;
  let el=typeof doc.getElementById==='function'?doc.getElementById(LAUNCH_CURTAIN_ID):null;
  if(!el){
    el=doc.createElement('div');
    el.id=LAUNCH_CURTAIN_ID;
    if(typeof el.setAttribute==='function'){
      el.setAttribute('data-kelo-world-launch','1');
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
    }
    if(el.style)el.style.cssText='position:fixed;inset:0;z-index:2147482300;display:grid;place-items:center;padding:24px;background:rgba(5,12,14,.92);color:#f7e7b4;font:800 15px/1.45 Inter,system-ui,-apple-system,sans-serif;letter-spacing:.12em;text-align:center;pointer-events:auto';
    doc.body.append?.(el);
  }
  el.textContent=message;
  return el;
}
function clearLaunchCurtain(root){
  try{root?.document?.getElementById?.(LAUNCH_CURTAIN_ID)?.remove?.();}catch{}
}
export function paintWorldEditorLaunchShell(root=globalThis,message='Abriendo World Editor…'){
  const doc=root?.document;
  if(!doc?.body||typeof doc.createElement!=='function')return null;
  try{doc.body.classList.add('kelo-studio-active');}catch{}
  let shell=typeof doc.getElementById==='function'?doc.getElementById('kelo-studio-live'):null;
  if(!shell){
    shell=doc.createElement('section');
    shell.id='kelo-studio-live';
    if(typeof shell.setAttribute==='function'){
      shell.setAttribute('data-kelo-studio-ui','1');
      shell.setAttribute('data-kelo-world-loading','1');
      shell.setAttribute('role','dialog');
      shell.setAttribute('aria-modal','true');
      shell.setAttribute('aria-label','Kelo Studio');
    }else if(shell.dataset)shell.dataset.keloWorldLoading='1';
    if(shell.style)shell.style.cssText='position:fixed;inset:0;z-index:2147482200;display:grid;grid-template-rows:auto 1fr;background:#050e10;color:#f7e7b4;font:800 13px/1.4 Inter,system-ui,-apple-system,sans-serif;pointer-events:auto';
    shell.innerHTML='<div style="display:flex;align-items:center;gap:10px;min-height:58px;padding:12px 16px;border-bottom:1px solid rgba(231,197,106,.42)"><div style="width:36px;height:36px;border:1px solid rgba(231,197,106,.5);border-radius:11px;display:grid;place-items:center">♛</div><div><div style="letter-spacing:.14em">KELO STUDIO</div><div style="margin-top:4px;font-size:9px;letter-spacing:.18em;color:#9bb7ad">MODO CREADOR</div></div></div><div class="ks-status" data-kelo-world-launch-status="1" style="display:grid;place-items:center;letter-spacing:.12em">'+message+'</div>';
    doc.body.append?.(shell);
  }else if(shell.dataset){
    shell.dataset.keloWorldLoading='1';
    const status=typeof shell.querySelector==='function'?shell.querySelector('[data-kelo-world-launch-status], .ks-status'):null;
    if(status)status.textContent=message;
  }
  return shell;
}
async function paintInteractiveChrome(root,message='Abriendo World Editor…'){
  paintWorldEditorLaunchShell(root,message);
  const doc=root?.document;
  if(typeof doc?.body?.appendChild!=='function')return null;
  try{
    const {createStudioLiveShell}=await import(`../../studio/ui/studio-live-shell.mjs?v=${WORLD_BUILD}`);
    const painted=createStudioLiveShell({
      host:doc.body,
      assets:[],
      onClose:()=>{try{root.KELO_WORLD_LAUNCH_ABORTED=true;}catch{}discardLoadingShell(root);},
      onMode:()=>{},onAsset:()=>{},onUndo:()=>{},onRedo:()=>{},onRotate:()=>{},onScale:()=>{},
      onErase:()=>{},onSave:()=>{},onSelectEntity:()=>{},onDuplicate:()=>{},onDelete:()=>{},
      onPropertyChange:()=>{},onPlay:()=>{},onBrushSize:()=>{},onFocus:()=>{}
    });
    const live=painted?.root||doc.getElementById('kelo-studio-live');
    if(live?.dataset)live.dataset.keloWorldLoading='1';
    try{painted?.setStatus?.(message);}catch{}
    clearLaunchCurtain(root);
    return painted;
  }catch(error){
    console.warn('[Kelo World] live chrome unavailable; keeping launch placeholder',error);
    paintLaunchCurtain(root,message);
    return null;
  }
}
function discardLoadingShell(root){
  const shell=root?.document?.getElementById?.('kelo-studio-live');
  if(shell?.dataset?.keloWorldLoading==='1'||!shell?.querySelector?.('.ks-status')){
    try{shell?.remove();}catch{}
    try{root.document.body.classList.remove('kelo-studio-active');}catch{}
  }
  try{root?.document?.querySelector?.('canvas.kelo-studio-overlay')?.remove?.();}catch{}
  clearLaunchCurtain(root);
}
function pauseGameplayRender(root){
  const kr=root?.KeloRender;
  if(typeof kr?.intercept!=='function'||typeof kr?.unregister!=='function')return ()=>{};
  let id=null;
  try{id=kr.intercept('world-editor-launch',()=>true,-1000);}catch{return ()=>{};}
  let done=false;
  return ()=>{
    if(done)return;
    done=true;
    try{if(id)kr.unregister(id);}catch{}
  };
}
async function yieldFrames(root,count=2){
  const wait=typeof root.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  const configured=Number(root?.KELO_WORLD_LAUNCH_YIELD_MS);
  const ms=Number.isFinite(configured)?Math.max(0,configured):DEFAULT_LAUNCH_YIELD_MS;
  if(ms<=0){
    for(let i=0;i<Math.max(1,count);i++)await new Promise(resolve=>wait(()=>resolve(),0));
    return;
  }
  await new Promise(resolve=>wait(()=>resolve(),ms));
}
async function withTimeout(root,promise,ms,code){
  let timer=null;
  const wait=typeof root.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  const cancel=typeof root.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
  const timeout=new Promise((_,reject)=>{timer=wait(()=>reject(new Error(code)),ms);});
  try{return await Promise.race([promise,timeout]);}
  finally{if(timer!=null)cancel(timer);}
}
async function openMountedStudio(mod,root){
  let session=await mod.openKeloStudioLive({root});
  if(studioShellMounted(root))return session;
  try{await mod.closeKeloStudioLive?.({root});}catch{}
  session=await mod.openKeloStudioLive({root});
  if(!studioShellMounted(root)){
    try{await mod.closeKeloStudioLive?.({root});}catch{}
    throw new Error('CREATOR_WORLD_STUDIO_MOUNT_FAILED');
  }
  return session;
}
async function loadStudioModule(loader,root,{fresh=false}={}){
  if(fresh){
    const src=Function.prototype.toString.call(loader);
    if(src.includes('live-studio-controller.mjs')||src.includes('world-studio-bridge.mjs')){
      // A10: never mint a unique nonce graph (H6). Stable retry tag reuses identities.
      return import(`../../studio/integration/world-studio-bridge.mjs?v=${WORLD_BUILD}-retry`);
    }
  }
  return loader(root);
}
function mapFocusPoint(map){
  const b=map?.worldBounds||{},bx=finite(b.x)?Number(b.x):0,by=finite(b.y)?Number(b.y):0,bw=Math.max(1,finite(b.w)?Number(b.w):1),bh=Math.max(1,finite(b.h)?Number(b.h):1),spawn=(map?.spawnPoints||[]).find(p=>finite(p?.x)&&finite(p?.y));
  const x=spawn?Number(spawn.x):bx+bw/2,y=spawn?Number(spawn.y):by+bh/2;
  return Object.freeze({x:clamp(x,bx,bx+bw),y:clamp(y,by,by+bh)});
}

// second hop after the paced bridge: import('../../studio/integration/live-studio-controller.mjs')
export function createWorldWorkspaceManifest({loader=()=>import(`../../studio/integration/world-studio-bridge.mjs?v=${WORLD_BUILD}`),mapForgeImporter=()=>import('../../studio/adapters/map-forge-draft-importer.mjs')}={}){
  return Object.freeze({
    id:'world',
    label:'World',
    category:'build',
    projectTypes:['WORLD'],
    capability:'world.edit',
    availability:'active',
    paintLaunch(root=globalThis,message){return paintWorldEditorLaunchShell(root,message);},
    async open({root=globalThis,mapDefinition=null,previewOnly=false}={}){
      paintWorldEditorLaunchShell(root,previewOnly?'Cargando vista previa…':'Abriendo World Editor…');
      await yieldFrames(root,2);
      try{root.KeloUpdater?.setGameplayBusy?.(true,'world-editor');}catch{}
      const resumeRender=pauseGameplayRender(root);
      const failsafeWait=typeof root.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
      const failsafeCancel=typeof root.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
      const failsafe=failsafeWait(()=>resumeRender(),800);
      try{
        try{root.KELO_WORLD_LAUNCH_ABORTED=false;}catch{}
        const boot=async()=>{
          if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
          if(!previewOnly){
            await paintInteractiveChrome(root,previewOnly?'Cargando vista previa…':'Cargando editor…');
            await yieldFrames(root,1);
          }
          const edit=await waitForWorldEditAuthority(root);
          let prepared=null;
          if(mapDefinition){
            const bridge=await mapForgeImporter();
            if(typeof bridge.importMapForgeIntoWorldDraft!=='function')throw new Error('MAP_FORGE_STUDIO_IMPORTER_MISSING');
            prepared=await bridge.importMapForgeIntoWorldDraft({root,mapDefinition});
          }
          if(previewOnly){
            if(!prepared?.draftId)throw new Error('MAP_FORGE_PREVIEW_DRAFT_MISSING');
            const entered=await edit.request('world:preview:enter',{actorId:actor(root),draftId:prepared.draftId});
            if(!entered?.viewSnapshot)throw new Error('MAP_FORGE_PREVIEW_SNAPSHOT_MISSING');
            const runtime=root.KELO_WORLD_BUILDER?.snapshot?.();
            if(!runtime||Object.keys(runtime.cells||{}).length===0)throw new Error('MAP_FORGE_PREVIEW_RUNTIME_PROJECTION_MISSING');
            if(typeof root.KeloCamera?.focus!=='function')throw new Error('MAP_FORGE_CAMERA_OWNER_NOT_READY');
            const focus=mapFocusPoint(mapDefinition);root.KeloCamera.focus(focus,{snap:true,source:'map-forge-exterior-preview'});
            root.showToast?.('Mapa generado cargado en el exterior como vista previa del borrador');
            return Object.freeze({mode:'map-forge-exterior-preview',draftId:prepared.draftId,prepared,focus,viewSnapshot:entered.viewSnapshot});
          }
          let mod=await loadStudioModule(loader,root);
          resumeRender();
          if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
          if(typeof mod.openKeloStudioLive!=='function')throw new Error('CREATOR_WORLD_STUDIO_ENTRY_MISSING');
          let session;
          try{
            session=await openMountedStudio(mod,root);
          }catch(first){
            const code=String(first?.message||first||'');
            if(code==='WORLD_EDITOR_OPEN_TIMEOUT')throw first;
            try{await mod.closeKeloStudioLive?.({root});}catch{}
            paintWorldEditorLaunchShell(root,'Reintentando World Editor…');
            await paintInteractiveChrome(root,'Reintentando World Editor…');
            await yieldFrames(root,1);
            mod=await loadStudioModule(loader,root,{fresh:true});
            if(typeof mod.openKeloStudioLive!=='function')throw first;
            session=await openMountedStudio(mod,root);
          }
          if(prepared?.documentMetadata&&session?.studio?.kernel?.setDocument){
            const current=session.studio.kernel.document;
            session.studio.kernel.setDocument({...current,metadata:prepared.documentMetadata});
          }
          return session;
        };
        return await withTimeout(root,boot(),studioOpenBudget(root),'WORLD_EDITOR_OPEN_TIMEOUT');
      }catch(error){
        try{root.KELO_WORLD_LAUNCH_ABORTED=true;}catch{}
        throw error;
      }finally{
        failsafeCancel(failsafe);
        resumeRender();
        try{root.KeloUpdater?.setGameplayBusy?.(false,'world-editor');}catch{}
        if(studioShellMounted(root))clearLaunchCurtain(root);
        else discardLoadingShell(root);
      }
    }
  });
}
export function registerWorldWorkspace(registry,options={}){return registry.register(createWorldWorkspaceManifest(options));}