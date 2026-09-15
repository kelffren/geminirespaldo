/* KELO-INDEX
 * area: STUDIO / BOOT PACE
 * owns: main-thread yields and World launch status text only
 * does-not-own: Studio kernel, Hub, tools, authority
 * public-api: yieldStudioBoot(), setWorldLaunchStatus()
 * mobile: lets iPhone Safari paint and run timers between Studio import waves without trusting requestAnimationFrame to fire forever
 * online: no
 */
const DEFAULT_RAF_FALLBACK_MS=48;

function liveShellAlreadyInteractive(root){
  try{
    const shell=root?.document?.getElementById?.('kelo-studio-live');
    if(!shell?.querySelector?.('.ks-top'))return false;
    const status=String(shell.querySelector?.('.ks-status')?.textContent||'').trim();
    return !!status&&!/^Cargando\b|^Abriendo\b|^Montando\b|^Reintentando\b/i.test(status);
  }catch{return false;}
}

export function yieldStudioBoot(root=globalThis){
  return new Promise(resolve=>{
    const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
    const cancel=typeof root?.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
    // Once the real shell has its controls and non-loading status, do not wait on
    // Safari rAF again. This is the final live-controller mount yield: the UI is
    // already interactive and another rAF/fallback only delays open() completion.
    if(liveShellAlreadyInteractive(root)){wait(resolve,0);return;}
    const configured=Number(root?.KELO_STUDIO_BOOT_RAF_FALLBACK_MS);
    const fallbackMs=Number.isFinite(configured)?Math.max(0,configured):DEFAULT_RAF_FALLBACK_MS;
    let settled=false,timer=null;
    const finish=()=>{
      if(settled)return;
      settled=true;
      if(timer!=null)cancel(timer);
      resolve();
    };
    const raf=root?.requestAnimationFrame;
    if(typeof raf==='function'){
      // iOS Safari can temporarily stop servicing rAF while parsing/evaluating a
      // large ESM graph. Keep the paint opportunity, but never let a missed rAF
      // hold every phased Studio import behind the old 120ms barrier.
      timer=wait(finish,fallbackMs);
      try{raf.call(root,finish);return;}catch{}
      if(timer!=null){cancel(timer);timer=null;}
    }
    wait(finish,0);
  });
}
export function setWorldLaunchStatus(root,message){
  try{
    const doc=root?.document;
    const status=doc?.querySelector?.('[data-kelo-world-launch-status], #kelo-studio-live .ks-status');
    if(status)status.textContent=message;
    const curtain=doc?.getElementById?.('kelo-world-launch-curtain');
    if(curtain)curtain.textContent=message;
  }catch{}
}

export function pauseStudioBoot(root=globalThis,ms=32){
  const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  return new Promise(resolve=>wait(resolve,Math.max(0,Number(ms)||0)));
}

/** Prefer idle time for post-chrome phone work; always fall back so Safari never stalls forever. */
export function whenStudioIdle(root=globalThis,{timeoutMs=900}={}){
  return new Promise(resolve=>{
    const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
    const cancel=typeof root?.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
    let settled=false,timer=null;
    const finish=()=>{if(settled)return;settled=true;if(timer!=null)cancel(timer);resolve();};
    timer=wait(finish,Math.max(120,Number(timeoutMs)||900));
    const ric=root?.requestIdleCallback;
    if(typeof ric==='function'){
      try{ric.call(root,finish,{timeout:Math.max(120,Number(timeoutMs)||900)});return;}catch{}
    }
    wait(finish,0);
  });
}
