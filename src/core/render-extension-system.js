/* KELO-INDEX
 * area: CORE / RENDER
 * owner: KeloRender
 * keys: RENDER OWNER FRAME BRIDGE HOOK BEFORE FRAME AFTER FRAME INTERCEPT EXTENSION FOUNDATION SLEEP WAKE LIFECYCLE
 * purpose: único owner global de render; ejecuta el bridge legacy de dibujo y ofrece extensiones ordenadas sin crear otro loop
 * public-api: KeloRender.intercept/beforeFrame/afterFrame/setEnabled/unregister/snapshot
 * consumes: render base de engine-a como fallback + KELO_LEGACY_RENDER_BRIDGE de engine-c
 * state-owned: writer global render + registro ordenado + estado enabled/sleeping de interceptores y extensiones
 * extension-points: intercept exclusivo + beforeFrame/afterFrame con prioridad explícita y suspensión idempotente
 * reuse: arena exclusiva, minimapa, overlays, indicadores, compatibilidad visual y preparación de contexto
 * legacy: engine-c conserva solo drawFrame detrás de KELO_LEGACY_RENDER_BRIDGE; no puede reasignar render
 * do-not: NO crear otro render loop, NO decidir gameplay, NO mutar física
 */
(function(root){
  'use strict';
  if(root.KeloRender)return;
  const VERSION='kelo-render-owner-v2.0.0';
  if(typeof render!=='function'){
    root.KELO_RENDER_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'render-missing'});
    return;
  }
  const fallbackRender=render;
  const hooks={intercept:[],beforeFrame:[],afterFrame:[]};
  const active={intercept:[],beforeFrame:[],afterFrame:[]};
  let sequence=1,frames=0,bridgeFrames=0,fallbackFrames=0,exclusiveFrames=0,lastFrameSource='none';

  function rebuild(phase){
    active[phase]=hooks[phase].filter(function(entry){return entry.enabled!==false;});
  }
  function add(phase,owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('render hook must be a function');
    const entry={id:'render-hook-'+sequence++,owner:String(owner||'anonymous'),fn:fn,priority:Number(priority)||0,enabled:true};
    hooks[phase].push(entry);
    hooks[phase].sort(function(a,b){return a.priority-b.priority||a.id.localeCompare(b.id);});
    rebuild(phase);
    return entry.id;
  }
  function find(id){
    for(const phase of ['intercept','beforeFrame','afterFrame']){
      const entry=hooks[phase].find(function(h){return h.id===id;});
      if(entry)return {phase:phase,entry:entry};
    }
    return null;
  }
  function setEnabled(id,enabled){
    const found=find(id);
    if(!found)return false;
    const next=enabled!==false;
    if(found.entry.enabled===next)return true;
    found.entry.enabled=next;
    rebuild(found.phase);
    return true;
  }
  function unregister(id){
    let removed=false;
    ['intercept','beforeFrame','afterFrame'].forEach(function(phase){
      const i=hooks[phase].findIndex(function(h){return h.id===id;});
      if(i>=0){hooks[phase].splice(i,1);rebuild(phase);removed=true;}
    });
    return removed;
  }
  function runPhase(phase,context){
    const list=active[phase];
    for(let i=0;i<list.length;i++)list[i].fn(context);
  }
  function runIntercept(context){
    const list=active.intercept;
    for(let i=0;i<list.length;i++){
      if(list[i].fn(context)===true){context.exclusive=true;context.exclusiveOwner=list[i].owner;return true;}
    }
    return false;
  }
  function publicList(phase){
    return Object.freeze(hooks[phase].map(function(h){return Object.freeze({id:h.id,owner:h.owner,priority:h.priority,enabled:h.enabled!==false});}));
  }
  function frameSource(){
    const bridge=root.KELO_LEGACY_RENDER_BRIDGE;
    return bridge&&typeof bridge.drawFrame==='function'?'engine-c-bridge':'engine-a-fallback';
  }
  function drawOwnedFrame(args,self){
    const bridge=root.KELO_LEGACY_RENDER_BRIDGE;
    if(bridge&&typeof bridge.drawFrame==='function'){
      bridgeFrames++;lastFrameSource='engine-c-bridge';
      return bridge.drawFrame.apply(self,args);
    }
    fallbackFrames++;lastFrameSource='engine-a-fallback';
    return fallbackRender.apply(self,args);
  }
  function snapshot(){
    const intercept=publicList('intercept'),beforeFrame=publicList('beforeFrame'),afterFrame=publicList('afterFrame');
    const all=intercept.concat(beforeFrame,afterFrame),enabled=all.filter(function(h){return h.enabled;}).length;
    return Object.freeze({version:VERSION,owner:'KeloRender',frameSource:frameSource(),lastFrameSource:lastFrameSource,frames:frames,bridgeFrames:bridgeFrames,fallbackFrames:fallbackFrames,exclusiveFrames:exclusiveFrames,intercept:intercept,beforeFrame:beforeFrame,afterFrame:afterFrame,registered:all.length,enabled:enabled,sleeping:all.length-enabled});
  }

  // FOUNDATION-ALLOW: único writer global de render. engine-c ya no puede envolver/reasignar este contrato.
  render=function(){
    frames++;
    const context={ctx:typeof ctx!=='undefined'?ctx:null,screenW:typeof screenW!=='undefined'?screenW:0,screenH:typeof screenH!=='undefined'?screenH:0,camera:typeof camera!=='undefined'?camera:null,config:typeof CONFIG!=='undefined'?CONFIG:null,exclusive:false,exclusiveOwner:null,frameSource:frameSource()};
    if(runIntercept(context)){exclusiveFrames++;lastFrameSource='exclusive:'+String(context.exclusiveOwner||'anonymous');return;}
    runPhase('beforeFrame',context);
    const out=drawOwnedFrame(arguments,this);
    runPhase('afterFrame',context);
    return out;
  };

  root.KeloRender=Object.freeze({
    version:VERSION,
    intercept:function(owner,fn,priority){return add('intercept',owner,fn,priority);},
    beforeFrame:function(owner,fn,priority){return add('beforeFrame',owner,fn,priority);},
    afterFrame:function(owner,fn,priority){return add('afterFrame',owner,fn,priority);},
    setEnabled:setEnabled,
    unregister:unregister,
    snapshot:snapshot
  });
  root.KELO_RENDER_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:true,owner:'KeloRender',singleGlobalWriter:true,ownsFrameOrchestration:true,legacyBridge:'KELO_LEGACY_RENDER_BRIDGE',fallback:'engine-a render',exclusiveIntercept:true,beforeAfterFrame:true,sleepWake:true,activeListCached:true,timers:0,gameplayAuthority:false});
})(typeof globalThis!=='undefined'?globalThis:window);
