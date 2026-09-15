/* KELO-INDEX
 * area: CORE / BUG OBSERVABILITY
 * owner: Bug observability runtime
 * keys: BUG RECOVERY FREEZE FLIGHT-RECORDER LONGTASK LOAF MODULE STALL SURVIVOR QUARANTINE
 * purpose: milestones, error capture and opt-in black-box diagnostics that locate freeze/crash boundaries without owning gameplay
 * public-api: createBugObserver(), installBugErrorCapture(), installFreezeLocator(), installRecoveryMesh()
 * consumes: sessionStorage, localStorage, PerformanceObserver, DOM state, module-loader diagnostic events, input timestamps
 * state-owned: diagnostic session timeline + opt-in survivor snapshot only
 * online: local evidence only; an explicit reporter/CI agent may export sanitized reports later
 * do-not: never mutate gameplay/editor authority, never auto-heal gameplay state, never enable heavy diagnostics unless explicitly requested
 */

const DEFAULT_KEY='kelo:bug-observability:v1';
const RECOVERY_KEY='kelo:recovery-mesh:events:v1';
const RECOVERY_SURVIVOR_KEY='kelo:recovery-mesh:survivor:v1';
const FREEZE_LOCATOR_VERSION='freeze-locator-v1.1.0';
const RECOVERY_MESH_VERSION='recovery-mesh-v1.0.0';

function safeStorage(root){
  try{return root?.sessionStorage||null;}catch{return null;}
}
function safeLocalStorage(root){
  try{return root?.localStorage||null;}catch{return null;}
}
function now(){return new Date().toISOString();}
function trim(value,max=500){const s=String(value??'');return s.length>max?s.slice(0,max)+'…':s;}
function perfNow(root){try{return Number(root?.performance?.now?.())||Date.now();}catch{return Date.now();}}
function parseQuery(root){try{return new URLSearchParams(root?.location?.search||'');}catch{return new URLSearchParams();}}
function queryEnabled(root){
  const q=parseQuery(root);
  return q.get('freezeLab')==='1'||q.get('freeze')==='1'||q.get('debugFreeze')==='1';
}
function recoveryEnabled(root){
  const q=parseQuery(root);
  return q.get('recoveryLab')==='1'||q.get('debugRecovery')==='1'||queryEnabled(root);
}
function sanitizedLocation(root){
  try{
    const url=new URL(root?.location?.href||'',root?.location?.origin||'https://local.invalid');
    const allowed=['recoveryLab','debugRecovery','freezeLab','freeze','debugFreeze','recoveryFlow','bug','recoverySkip','recoveryHud','creators','creator','guest','aiGuest'];
    const out=new URLSearchParams();
    for(const key of allowed)if(url.searchParams.has(key))out.set(key,trim(url.searchParams.get(key),80));
    return `${url.pathname}${out.size?`?${out.toString()}`:''}`;
  }catch{return trim(root?.location?.pathname||'unknown',220);}
}
function shortResource(name){
  const raw=String(name||'');
  const i=raw.indexOf('/src/');
  return trim(i>=0?raw.slice(i+1):raw,180);
}
function readJSON(storage,key,fallback=null){
  try{const value=JSON.parse(storage?.getItem(key)||'null');return value??fallback;}catch{return fallback;}
}
function writeJSON(storage,key,value){try{storage?.setItem(key,JSON.stringify(value));return true;}catch{return false;}}

export function createBugObserver({root=globalThis,flow='unknown',bugId=null,version=null,storageKey=DEFAULT_KEY,maxEvents=80}={}){
  const storage=safeStorage(root);
  const read=()=>{
    try{const parsed=JSON.parse(storage?.getItem(storageKey)||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}
  };
  const write=events=>{try{storage?.setItem(storageKey,JSON.stringify(events.slice(-maxEvents)));}catch{}};
  const mark=(milestone,data={})=>{
    const event={at:now(),flow,bugId,version,milestone:trim(milestone,80),data:{}};
    for(const [k,v] of Object.entries(data||{}))event.data[trim(k,80)]=trim(v,300);
    const events=read();events.push(event);write(events);
    try{root.dispatchEvent?.(new CustomEvent('kelo:bug-milestone',{detail:event}));}catch{}
    return event;
  };
  const fail=(error,phase='UNHANDLED')=>mark('FAIL',{phase,name:error?.name||'Error',message:error?.message||error,stack:error?.stack||''});
  return Object.freeze({mark,fail,read,clear(){try{storage?.removeItem(storageKey);}catch{}},last(){const e=read();return e[e.length-1]||null;}});
}

export function installBugErrorCapture({root=globalThis,observer=createBugObserver({root,flow:'global'})}={}){
  if(!root.__keloBugErrorObservers)root.__keloBugErrorObservers=new Set();
  root.__keloBugErrorObservers.add(observer);
  if(root.__keloBugErrorCaptureInstalled)return observer;
  root.__keloBugErrorCaptureInstalled=true;
  const fanout=(error,phase)=>{
    for(const target of root.__keloBugErrorObservers||[]){try{target?.fail?.(error,phase);}catch{}}
  };
  try{root.addEventListener('error',event=>fanout(event.error||event.message,'window.error'));}catch{}
  try{root.addEventListener('unhandledrejection',event=>fanout(event.reason,'unhandledrejection'));}catch{}
  return observer;
}

export function installRecoveryMesh({
  root=globalThis,
  flow=null,
  bugId=null,
  version=RECOVERY_MESH_VERSION,
  force=false,
  tickMs=250,
  stallMs=700,
  severeStallMs=2000,
  survivorTtlMs=24*60*60*1000
}={}){
  if(!force&&!recoveryEnabled(root))return null;
  if(root.__keloRecoveryMesh)return root.__keloRecoveryMesh;

  const q=parseQuery(root);
  flow=String(flow||q.get('recoveryFlow')||'runtime');
  bugId=bugId||q.get('bug')||null;
  const hudEnabled=q.get('recoveryHud')!=='0';
  const quarantined=new Set(String(q.get('recoverySkip')||'').split(',').map(v=>v.trim()).filter(Boolean));
  const observer=createBugObserver({root,flow,bugId,version,storageKey:RECOVERY_KEY,maxEvents:240});
  installBugErrorCapture({root,observer});

  const doc=root?.document||null;
  const local=safeLocalStorage(root);
  const startedWall=Date.now();
  const startedAt=perfNow(root);
  const sessionId=`rm-${startedWall.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const previous=readJSON(local,RECOVERY_SURVIVOR_KEY,null);
  let lastTick=startedAt;
  let lastResource='none';
  let lastMilestone='RECOVERY_START';
  let lastInput='none';
  let lastInputAt=startedAt;
  let maxGap=0;
  let stallCount=0;
  let severeStallCount=0;
  let longTaskCount=0;
  let longFrameCount=0;
  let worstLongFrame=0;
  let surface='boot';
  let timer=0;
  let hud=null;
  let destroyed=false;
  let survivorTimer=0;
  const performanceObservers=[];
  const listeners=[];

  function snapshotSurface(){
    try{
      if(doc?.getElementById?.('kelo-studio-live'))return 'studio';
      if(doc?.getElementById?.('kelo-creators-hub'))return 'creators';
      if(doc?.getElementById?.('kelo-account-auth'))return 'auth';
      const menu=doc?.getElementById?.('lx-menu-panel');
      if(menu&&!menu.hidden)return 'menu';
      if(doc?.getElementById?.('game-canvas'))return 'game';
    }catch{}
    return 'unknown';
  }

  function survivorPayload(active=true){
    return {
      version,sessionId,active,flow,bugId,
      startedAt:new Date(startedWall).toISOString(),updatedAt:now(),
      path:sanitizedLocation(root),surface,lastMilestone,lastResource,
      maxGapMs:Math.round(maxGap),stallCount,severeStallCount,longTaskCount,longFrameCount
    };
  }
  function scheduleSurvivor(){
    if(!local||survivorTimer)return;
    const wait=root.setTimeout||setTimeout;
    survivorTimer=wait(()=>{survivorTimer=0;writeJSON(local,RECOVERY_SURVIVOR_KEY,survivorPayload(true));},350);
  }
  function mark(milestone,data={}){
    lastMilestone=String(milestone||'UNKNOWN');
    const event=observer.mark(lastMilestone,{surface,lastResource,...data});
    scheduleSurvivor();
    return event;
  }

  function ensureHud(){
    if(!hudEnabled||hud?.isConnected||!doc?.body||typeof doc.createElement!=='function')return hud;
    hud=doc.createElement('aside');
    hud.id='kelo-recovery-mesh';
    hud.setAttribute('data-kelo-debug-ui','recovery-mesh');
    hud.setAttribute('aria-live','polite');
    hud.style.cssText='position:fixed;left:6px;top:max(6px,env(safe-area-inset-top));z-index:2147483645;pointer-events:none;max-width:min(86vw,350px);padding:7px 9px;border-radius:10px;border:1px solid rgba(120,220,255,.52);background:rgba(0,0,0,.78);color:#d8f7ff;font:700 10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left';
    doc.body.append(hud);
    return hud;
  }
  function renderHud(gap=0){
    ensureHud();
    if(!hud)return;
    const elapsed=((perfNow(root)-startedAt)/1000).toFixed(1);
    const inputAge=((perfNow(root)-lastInputAt)/1000).toFixed(1);
    hud.textContent=`RECOVERY MESH · ${flow}${bugId?` · ${bugId}`:''}\n${surface.toUpperCase()} · ${lastMilestone}\nlast: ${lastResource}\nloop ${Math.round(gap)}ms / max ${Math.round(maxGap)}ms · stalls ${stallCount}/${severeStallCount}\nlong ${longTaskCount} · loaf ${longFrameCount} worst ${Math.round(worstLongFrame)}ms\ninput ${lastInput} ${inputAge}s ago · t+${elapsed}s`;
  }

  function tick(){
    if(destroyed)return;
    const t=perfNow(root),gap=t-lastTick;
    lastTick=t;
    const nextSurface=snapshotSurface();
    if(nextSurface!==surface){surface=nextSurface;mark('SURFACE_CHANGE',{surface});}
    maxGap=Math.max(maxGap,gap);
    if(gap>=stallMs){
      stallCount++;
      const severe=gap>=severeStallMs;
      if(severe)severeStallCount++;
      mark(severe?'EVENT_LOOP_SEVERE_STALL':'EVENT_LOOP_STALL',{gapMs:Math.round(gap)});
    }
    renderHud(gap);
    timer=(root.setTimeout||setTimeout)(tick,Math.max(100,Number(tickMs)||250));
  }

  function listen(target,type,handler,options){
    try{target?.addEventListener?.(type,handler,options);listeners.push([target,type,handler,options]);}catch{}
  }
  const onInput=event=>{
    lastInputAt=perfNow(root);
    const target=event?.target;
    const label=target?.getAttribute?.('aria-label')||target?.textContent||target?.id||target?.tagName||event?.type||'input';
    lastInput=trim(`${event?.type||'input'}:${String(label).trim().replace(/\s+/g,' ')}`,90);
  };
  for(const type of ['pointerdown','touchstart','keydown','click'])listen(root,type,onInput,{capture:true,passive:true});

  const moduleEvent=event=>{
    const d=event?.detail||{};
    if(d.src)lastResource=shortResource(d.src);
    mark(String(event.type||'kelo:module').replace(/^kelo:/,'').replace(/-/g,'_').toUpperCase(),{
      feature:d.feature||'',src:d.src||'',ok:d.ok,ms:d.ms,error:d.error||''
    });
  };
  for(const type of ['kelo:module-load-start','kelo:module-load-end','kelo:module-load-error','kelo:module-quarantined'])listen(root,type,moduleEvent);

  try{
    if(typeof root.PerformanceObserver==='function'){
      const po=new root.PerformanceObserver(list=>{
        for(const entry of list.getEntries()){
          const name=String(entry?.name||'');
          if(!/\.(?:js|mjs|css)(?:\?|$)/i.test(name)&&!name.includes('/src/'))continue;
          lastResource=shortResource(name);
          mark('RESOURCE_READY',{resource:lastResource,durationMs:Math.round(Number(entry?.duration)||0),transferSize:Number(entry?.transferSize)||0});
        }
      });
      po.observe({type:'resource',buffered:true});performanceObservers.push(po);
    }
  }catch(error){mark('RESOURCE_OBSERVER_UNAVAILABLE',{message:error?.message||error});}

  try{
    if(root.PerformanceObserver?.supportedEntryTypes?.includes?.('longtask')){
      const po=new root.PerformanceObserver(list=>{
        for(const entry of list.getEntries()){
          longTaskCount++;
          mark('LONG_TASK',{durationMs:Math.round(Number(entry?.duration)||0)});
        }
      });
      po.observe({type:'longtask',buffered:true});performanceObservers.push(po);
    }
  }catch(error){mark('LONGTASK_OBSERVER_UNAVAILABLE',{message:error?.message||error});}

  try{
    if(root.PerformanceObserver?.supportedEntryTypes?.includes?.('long-animation-frame')){
      const po=new root.PerformanceObserver(list=>{
        for(const entry of list.getEntries()){
          longFrameCount++;
          worstLongFrame=Math.max(worstLongFrame,Number(entry?.duration)||0);
          const scripts=Array.from(entry?.scripts||[]).sort((a,b)=>(Number(b?.duration)||0)-(Number(a?.duration)||0));
          const top=scripts[0];
          mark('LONG_ANIMATION_FRAME',{
            durationMs:Math.round(Number(entry?.duration)||0),blockingMs:Math.round(Number(entry?.blockingDuration)||0),
            script:shortResource(top?.sourceURL||''),function:top?.sourceFunctionName||top?.invoker||''
          });
        }
      });
      po.observe({type:'long-animation-frame',buffered:true});performanceObservers.push(po);
    }
  }catch(error){mark('LOAF_OBSERVER_UNAVAILABLE',{message:error?.message||error});}

  listen(root,'pagehide',()=>{mark('PAGE_HIDE');writeJSON(local,RECOVERY_SURVIVOR_KEY,survivorPayload(false));});
  listen(root,'pageshow',event=>mark('PAGE_SHOW',{persisted:!!event?.persisted}));
  listen(doc,'visibilitychange',()=>mark('VISIBILITY',{state:doc?.visibilityState||'unknown'}));

  const report=()=>Object.freeze({
    version,sessionId,flow,bugId,generatedAt:now(),path:sanitizedLocation(root),
    elapsedMs:Math.round(perfNow(root)-startedAt),surface,lastMilestone,lastResource,
    maxGapMs:Math.round(maxGap),stallCount,severeStallCount,longTaskCount,longFrameCount,worstLongFrameMs:Math.round(worstLongFrame),
    lastInput,inputAgeMs:Math.round(perfNow(root)-lastInputAt),quarantined:[...quarantined],
    previousUnclean:previous?.active===true?previous:null,
    events:observer.read().filter(event=>event?.flow===flow).slice(-120)
  });
  const destroy=({clean=true}={})=>{
    if(destroyed)return;
    destroyed=true;
    try{if(timer)(root.clearTimeout||clearTimeout)(timer);}catch{}
    try{if(survivorTimer)(root.clearTimeout||clearTimeout)(survivorTimer);}catch{}
    for(const po of performanceObservers)try{po?.disconnect?.();}catch{}
    for(const [target,type,handler,options] of listeners)try{target?.removeEventListener?.(type,handler,options);}catch{}
    try{hud?.remove?.();}catch{}
    try{if(clean)writeJSON(local,RECOVERY_SURVIVOR_KEY,survivorPayload(false));}catch{}
    root.__keloRecoveryMesh=null;
    root.KELO_RECOVERY_MESH=null;
  };
  const shouldSkip=id=>quarantined.has(String(id||'').trim());
  const api=Object.freeze({version,sessionId,mark,report,read:observer.read,last:observer.last,shouldSkip,destroy,get quarantined(){return [...quarantined];},get hud(){return hud;}});
  root.__keloRecoveryMesh=api;
  root.KELO_RECOVERY_MESH=api;

  surface=snapshotSurface();
  if(previous?.active===true&&Date.now()-Date.parse(previous?.updatedAt||0)<survivorTtlMs){
    mark('PREVIOUS_UNCLEAN_SESSION',{
      previousSession:previous.sessionId||'',previousMilestone:previous.lastMilestone||'',previousResource:previous.lastResource||'',previousSurface:previous.surface||'',previousUpdatedAt:previous.updatedAt||''
    });
  }
  mark('RECOVERY_START',{path:sanitizedLocation(root),quarantined:[...quarantined].join(',')||'none'});
  writeJSON(local,RECOVERY_SURVIVOR_KEY,survivorPayload(true));
  renderHud(0);
  timer=(root.setTimeout||setTimeout)(tick,Math.max(100,Number(tickMs)||250));
  return api;
}

export function installFreezeLocator({
  root=globalThis,
  flow='world-open',
  bugId='BUG-0003',
  version=FREEZE_LOCATOR_VERSION,
  force=false,
  tickMs=250,
  stallMs=700,
  severeStallMs=2000,
  stuckMs=3500
}={}){
  if(!force&&!queryEnabled(root))return null;
  if(root.__keloFreezeLocator)return root.__keloFreezeLocator;

  const observer=createBugObserver({root,flow,bugId,version,maxEvents:120});
  const previous=observer.last();
  installBugErrorCapture({root,observer});

  const doc=root?.document||null;
  const startedAt=perfNow(root);
  let lastTick=startedAt;
  let lastInputAt=startedAt;
  let lastInput='none';
  let maxGap=0;
  let stallCount=0;
  let resourceCount=0;
  let lastResource='none';
  let shellState='missing';
  let statusText='boot';
  let statusChangedAt=startedAt;
  let stuckMarkedFor='';
  let timer=0;
  let hud=null;
  let resourceObserver=null;
  let longTaskObserver=null;
  let destroyed=false;

  const relevantResource=name=>/\/src\/(studio|creators)\//.test(String(name||''));
  const mark=(milestone,data={})=>{
    const event=observer.mark(milestone,data);
    try{root.KELO_RECOVERY_MESH?.mark?.(`FREEZE_${milestone}`,data);}catch{}
    return event;
  };

  function getShellSnapshot(){
    const shell=doc?.getElementById?.('kelo-studio-live')||null;
    if(!shell)return {state:'missing',status:'no studio shell'};
    const status=String(shell.querySelector?.('[data-kelo-world-launch-status], .ks-status')?.textContent||'').trim();
    const loading=shell.dataset?.keloWorldLoading==='1';
    const hasStatus=!!shell.querySelector?.('.ks-status');
    return {state:loading?'loading':hasStatus?'ready':'mounted',status:status||'(empty status)'};
  }

  function ensureHud(){
    if(hud?.isConnected||!doc?.body||typeof doc.createElement!=='function')return hud;
    hud=doc.createElement('aside');
    hud.id='kelo-freeze-locator';
    hud.setAttribute('data-kelo-debug-ui','freeze-locator');
    hud.setAttribute('aria-live','polite');
    hud.style.cssText='position:fixed;top:max(6px,env(safe-area-inset-top));right:6px;z-index:2147483646;pointer-events:none;max-width:min(82vw,330px);padding:7px 9px;border-radius:10px;border:1px solid rgba(231,197,106,.5);background:rgba(0,0,0,.76);color:#f7e7b4;font:700 10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left';
    doc.body.append(hud);
    return hud;
  }

  function renderHud(gap=0){
    ensureHud();
    if(!hud)return;
    const elapsed=((perfNow(root)-startedAt)/1000).toFixed(1);
    const inputAge=((perfNow(root)-lastInputAt)/1000).toFixed(1);
    const stuckAge=((perfNow(root)-statusChangedAt)/1000).toFixed(1);
    hud.textContent=`FREEZE LOCATOR · ${bugId}\n${shellState.toUpperCase()} · ${statusText}\nlast module: ${lastResource}\nloop ${Math.round(gap)}ms / max ${Math.round(maxGap)}ms · stalls ${stallCount}\ninput ${lastInput} ${inputAge}s ago · status age ${stuckAge}s · t+${elapsed}s`;
  }

  function sampleDom(){
    const next=getShellSnapshot();
    if(next.state!==shellState){shellState=next.state;mark('SHELL_STATE',{state:shellState,status:next.status});}
    if(next.status!==statusText){
      statusText=next.status;statusChangedAt=perfNow(root);stuckMarkedFor='';
      mark('STATUS_CHANGE',{state:shellState,status:statusText,lastResource});
    }
    const age=perfNow(root)-statusChangedAt;
    if(shellState==='loading'&&age>=stuckMs&&stuckMarkedFor!==statusText){
      stuckMarkedFor=statusText;
      mark('STATUS_STUCK',{status:statusText,stuckMs:Math.round(age),lastResource,maxGap:Math.round(maxGap)});
    }
  }

  function tick(){
    if(destroyed)return;
    const t=perfNow(root),gap=t-lastTick;lastTick=t;maxGap=Math.max(maxGap,gap);
    if(gap>=stallMs){stallCount++;mark(gap>=severeStallMs?'EVENT_LOOP_SEVERE_STALL':'EVENT_LOOP_STALL',{gapMs:Math.round(gap),status:statusText,lastResource,shellState});}
    sampleDom();renderHud(gap);
  }

  const onInput=event=>{
    lastInputAt=perfNow(root);
    const target=event?.target;
    const label=target?.getAttribute?.('aria-label')||target?.textContent||target?.id||target?.tagName||event?.type||'input';
    lastInput=trim(`${event?.type||'input'}:${String(label).trim().replace(/\s+/g,' ')}`,80);
  };
  try{for(const type of ['pointerdown','touchstart','click'])root.addEventListener?.(type,onInput,{capture:true,passive:true});}catch{}

  try{
    if(typeof root.PerformanceObserver==='function'){
      resourceObserver=new root.PerformanceObserver(list=>{
        const relevant=list.getEntries().filter(entry=>relevantResource(entry?.name));
        if(!relevant.length)return;
        resourceCount+=relevant.length;
        const last=relevant[relevant.length-1];lastResource=shortResource(last?.name);
        mark('RESOURCE_READY',{resource:lastResource,durationMs:Math.round(Number(last?.duration)||0),resourceCount,status:statusText});
      });
      resourceObserver.observe({type:'resource',buffered:true});
    }
  }catch(error){mark('RESOURCE_OBSERVER_UNAVAILABLE',{message:error?.message||error});}

  try{
    if(root.PerformanceObserver?.supportedEntryTypes?.includes?.('longtask')){
      longTaskObserver=new root.PerformanceObserver(list=>{for(const entry of list.getEntries())mark('LONG_TASK',{durationMs:Math.round(Number(entry?.duration)||0),status:statusText,lastResource});});
      longTaskObserver.observe({type:'longtask',buffered:true});
    }
  }catch(error){mark('LONGTASK_OBSERVER_UNAVAILABLE',{message:error?.message||error});}

  try{root.addEventListener?.('pagehide',()=>mark('PAGE_HIDE',{status:statusText,lastResource,shellState}));}catch{}
  try{root.addEventListener?.('pageshow',event=>mark('PAGE_SHOW',{persisted:!!event?.persisted,status:statusText}));}catch{}
  try{doc?.addEventListener?.('visibilitychange',()=>mark('VISIBILITY',{state:doc.visibilityState,status:statusText}));}catch{}

  const report=()=>Object.freeze({
    version,flow,bugId,generatedAt:now(),elapsedMs:Math.round(perfNow(root)-startedAt),
    shellState,statusText,statusAgeMs:Math.round(perfNow(root)-statusChangedAt),lastResource,resourceCount,maxGapMs:Math.round(maxGap),stallCount,
    lastInput,inputAgeMs:Math.round(perfNow(root)-lastInputAt),events:observer.read().filter(event=>event?.flow===flow).slice(-60)
  });
  const destroy=()=>{
    if(destroyed)return;destroyed=true;
    try{if(timer)(root.clearInterval||clearInterval)(timer);}catch{}
    try{resourceObserver?.disconnect?.();}catch{}
    try{longTaskObserver?.disconnect?.();}catch{}
    try{for(const type of ['pointerdown','touchstart','click'])root.removeEventListener?.(type,onInput,true);}catch{}
    try{hud?.remove?.();}catch{}
    root.__keloFreezeLocator=null;root.KELO_FREEZE_LOCATOR=null;
  };
  const api=Object.freeze({version,mark,report,read:observer.read,last:observer.last,destroy,get hud(){return hud;}});
  root.__keloFreezeLocator=api;root.KELO_FREEZE_LOCATOR=api;

  mark('LOCATOR_START',{previousMilestone:previous?.milestone||'none',previousAt:previous?.at||'none',href:sanitizedLocation(root)});
  sampleDom();renderHud(0);
  timer=(root.setInterval||setInterval)(tick,Math.max(100,Number(tickMs)||250));
  return api;
}
