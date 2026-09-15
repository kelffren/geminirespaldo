/* KELO-INDEX
 * area: STUDIO / WORLD BRIDGE
 * owns: paced World→Studio handoff only
 * does-not-own: Studio kernel, live shell internals, Hub, world authority
 * public-api: openKeloStudioLive(), closeKeloStudioLive(), getKeloStudioLive()
 * reuse: live-studio-controller remains the session owner; this file is the only first hop from World workspace
 * mobile: import the zero-static-import controller after one paint yield, then hand off to controller immediately; controller owns phased runtime loading after chrome exists. Do not cloneNode the provisional chrome. Reveal the game viewport during hydrate without treating provisional chrome as interactive, keep one Studio stylesheet after provisional→live handoff, and persist BUG-0003 milestones so a Safari/WebContent death leaves the last completed phase in sessionStorage.
 * observability: reuses src/core/bug-observability.mjs; records bridge/controller/shell readiness plus lightweight canvas/resource/viewport snapshots and 1s/5s/10s survival marks.
 * online: no; authority stays in KELO_WORLD_EDIT
 */
import { createBugObserver } from '../../core/bug-observability.mjs';
import { yieldStudioBoot, setWorldLaunchStatus } from './studio-boot-pace.mjs';

export const WORLD_STUDIO_BRIDGE_BUILD='world-bridge-20260915-22';
const bridgeUrl=new URL(import.meta.url);
const incomingBuild=bridgeUrl.searchParams.get('v')||'';
// Workspace can lag one or more static build tags behind this bridge. Do not let
// that stale tag downgrade the controller/shell/studio-entry chain. Preserve only
// explicit recovery tags (stable *-retry or legacy world-ios-*); never invent new nonces.
const controllerBuild=(incomingBuild.endsWith('-retry')||incomingBuild.startsWith('world-ios-'))?incomingBuild:WORLD_STUDIO_BRIDGE_BUILD;
const CONTROLLER=`./live-studio-controller.mjs?v=${encodeURIComponent(controllerBuild)}`;
const BUG_ID='BUG-0003';
let controllerMod=null;

function runtimeSnapshot(root=globalThis){
  const doc=root?.document;
  const shell=doc?.getElementById?.('kelo-studio-live')||null;
  let studioResources=0;
  try{
    studioResources=(root?.performance?.getEntriesByType?.('resource')||[])
      .filter(entry=>String(entry?.name||'').includes('/src/studio/')).length;
  }catch{}
  let heapMb='';
  try{
    const bytes=Number(root?.performance?.memory?.usedJSHeapSize);
    if(Number.isFinite(bytes)&&bytes>0)heapMb=Math.round(bytes/1048576);
  }catch{}
  return {
    build:WORLD_STUDIO_BRIDGE_BUILD,
    dpr:Number(root?.devicePixelRatio)||1,
    viewport:`${Number(root?.innerWidth)||0}x${Number(root?.innerHeight)||0}`,
    visibility:String(doc?.visibilityState||''),
    shell:!!shell,
    loading:shell?.dataset?.keloWorldLoading==='1',
    interactive:shell?.dataset?.keloStudioInteractive||'',
    canvases:doc?.querySelectorAll?.('canvas')?.length||0,
    studioCanvases:shell?.querySelectorAll?.('canvas')?.length||0,
    overlay:!!doc?.querySelector?.('canvas.kelo-studio-overlay'),
    studioStyles:doc?.querySelectorAll?.('style[data-kelo-studio-ui="1"]')?.length||0,
    studioResources,
    heapMb
  };
}

function createWorldObserver(root){
  return createBugObserver({root,flow:'world-open',bugId:BUG_ID,version:WORLD_STUDIO_BRIDGE_BUILD,maxEvents:120});
}

function armSurvivalMarks(root,observer){
  const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  for(const ms of [1000,5000,10000]){
    wait(()=>{
      const shell=root?.document?.getElementById?.('kelo-studio-live');
      observer.mark(`SURVIVED_${ms}MS`,{
        ...runtimeSnapshot(root),
        connected:!!shell?.isConnected,
        status:String(shell?.querySelector?.('.ks-status')?.textContent||'').slice(0,120)
      });
    },ms);
  }
}

async function loadController(root,observer=null){
  if(controllerMod){
    observer?.mark('CONTROLLER_CACHE_HIT',runtimeSnapshot(root));
    return controllerMod;
  }
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  setWorldLaunchStatus(root,'Cargando editor…');
  observer?.mark('CONTROLLER_IMPORT_WAIT',runtimeSnapshot(root));
  await yieldStudioBoot(root);
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  observer?.mark('CONTROLLER_IMPORT_START',runtimeSnapshot(root));
  controllerMod=await import(CONTROLLER);
  observer?.mark('CONTROLLER_IMPORT_DONE',runtimeSnapshot(root));
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  setWorldLaunchStatus(root,'Montando editor…');
  return controllerMod;
}

export function sanitizeWorldStudioProvisionalShell(root=globalThis){
  // A9: cloning the painted Studio tree duplicated the whole chrome in Safari
  // memory right before controller hydrate. Listener swap is owned by the live
  // shell AbortController; this function only reports the existing node.
  return root?.document?.getElementById?.('kelo-studio-live')||null;
}

export function pruneWorldStudioStyles(root=globalThis){
  const doc=root?.document;
  const styles=Array.from(doc?.querySelectorAll?.('style[data-kelo-studio-ui="1"]')||[]);
  if(styles.length<=1)return styles.length;
  const keep=styles[styles.length-1];
  for(const style of styles){
    if(style===keep)continue;
    try{style.remove?.();}catch{}
  }
  return 1;
}

function markProvisionalControls(shell){
  const loading=shell?.dataset?.keloWorldLoading==='1';
  if(shell?.dataset)shell.dataset.keloStudioInteractive=loading?'0':'1';
  try{shell?.setAttribute?.('aria-busy',loading?'true':'false');}catch{}
  try{
    shell?.querySelectorAll?.('button,select,input')?.forEach?.(control=>{
      if(loading){
        control.disabled=true;
        control.setAttribute?.('aria-disabled','true');
        control.dataset.keloProvisionalDisabled='1';
      }else if(control.dataset?.keloProvisionalDisabled==='1'){
        // A10: re-enable only controls we disabled during provisional chrome.
        // Leave Studio's own selection-gated disabled state alone.
        control.disabled=false;
        control.removeAttribute?.('aria-disabled');
        delete control.dataset.keloProvisionalDisabled;
      }
    });
  }catch{}
  if(!loading)return;
  try{
    const status=shell?.querySelector?.('.ks-status');
    if(status)status.textContent='Terminando de cargar editor…';
  }catch{}
}

export function releaseWorldStudioViewport(root=globalThis){
  const shell=root?.document?.getElementById?.('kelo-studio-live');
  if(!shell?.dataset?.shellVersion||!shell?.querySelector?.('.ks-top'))return false;
  try{shell.removeAttribute?.('style');}catch{return false;}
  markProvisionalControls(shell);
  // A provisional shell is only visual chrome. Keep polling until the controller
  // replaces it with the live shell and clears data-kelo-world-loading. This
  // prevents iPhone/Google from showing tappable-looking controls whose callbacks
  // are intentionally no-ops during boot.
  return shell.dataset?.keloWorldLoading!=='1';
}

function releaseViewportDuringOpen(root,pending,observer=null){
  const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  const cancel=typeof root?.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
  let stopped=false,timer=null,sawShell=false,sawInteractive=false;
  const probe=()=>{
    if(stopped)return;
    const shell=root?.document?.getElementById?.('kelo-studio-live');
    if(shell&&!sawShell){
      sawShell=true;
      observer?.mark('SHELL_SEEN',runtimeSnapshot(root));
    }
    if(releaseWorldStudioViewport(root)){
      if(!sawInteractive){
        sawInteractive=true;
        observer?.mark('SHELL_INTERACTIVE',runtimeSnapshot(root));
      }
      stopped=true;
      return;
    }
    timer=wait(probe,32);
  };
  probe();
  return Promise.resolve(pending).finally(()=>{
    stopped=true;
    if(timer!=null)cancel(timer);
  });
}

export async function openKeloStudioLive(opts={}){
  const root=opts.root||globalThis;
  const observer=createWorldObserver(root);
  let phase='BRIDGE_OPEN_START';
  observer.mark(phase,runtimeSnapshot(root));
  try{
    phase='CONTROLLER_LOADING';
    const ctrl=await loadController(root,observer);
    phase='PROVISIONAL_SANITIZE';
    sanitizeWorldStudioProvisionalShell(root);
    observer.mark('PROVISIONAL_SANITIZED',runtimeSnapshot(root));
    phase='CONTROLLER_OPEN';
    observer.mark('CONTROLLER_OPEN_START',runtimeSnapshot(root));
    const session=await releaseViewportDuringOpen(root,ctrl.openKeloStudioLive(opts),observer);
    observer.mark('CONTROLLER_OPEN_RESOLVED',runtimeSnapshot(root));
    phase='FINAL_RELEASE';
    releaseWorldStudioViewport(root);
    const styles=pruneWorldStudioStyles(root);
    observer.mark('EDITOR_READY',{...runtimeSnapshot(root),styles});
    armSurvivalMarks(root,observer);
    return session;
  }catch(error){
    observer.fail(error,phase);
    throw error;
  }
}
export async function closeKeloStudioLive(opts={}){
  const root=opts.root||globalThis;
  const observer=createWorldObserver(root);
  observer.mark('EDITOR_CLOSE_START',runtimeSnapshot(root));
  try{
    const ctrl=controllerMod||await import(CONTROLLER);
    controllerMod=ctrl;
    const result=await ctrl.closeKeloStudioLive(opts);
    observer.mark('EDITOR_CLOSE_DONE',runtimeSnapshot(root));
    return result;
  }catch(error){
    observer.fail(error,'EDITOR_CLOSE');
    throw error;
  }
}
export function getKeloStudioLive(){
  return controllerMod?.getKeloStudioLive?.()||null;
}
