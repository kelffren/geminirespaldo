/* KELO-INDEX
 * area: CORE / SIMULATION
 * owner: KeloSimulation
 * keys: SIMULATION UPDATE HOOK BEFORE AFTER EXTENSION FOUNDATION SLEEP WAKE LIFECYCLE OWNER
 * purpose: único owner global de updateSimulation; ejecuta la simulación base legacy y extensiones ordenadas sin wrappers paralelos
 * public-api: KeloSimulation.before/after/setEnabled/unregister/snapshot
 * consumes: updateSimulation base de engine-a + KELO_LEGACY_SIMULATION_BRIDGE de engine-c
 * state-owned: registro ordenado + estado enabled/sleeping de extensiones simulation
 * extension-points: before/after con prioridad explícita y suspensión idempotente
 * reuse: timers gameplay existentes, interpolación net y updates de sistemas sin envolver updateSimulation
 * legacy: la simulación base sigue en engine-a; engine-c aporta augmentación mediante bridge sin reasignar el global
 * do-not: NO crear otro game loop, NO envolver updateSimulation fuera de este owner, NO renderizar, NO meter UI
 */
(function(root){
  'use strict';
  if(root.KeloSimulation)return;
  const VERSION='kelo-simulation-extensions-v1.3.0';
  if(typeof updateSimulation!=='function'){
    root.KELO_SIMULATION_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'updateSimulation-missing'});
    return;
  }
  const originalUpdateSimulation=updateSimulation;
  const legacyBridge=root.KELO_LEGACY_SIMULATION_BRIDGE||null;
  const hooks={before:[],after:[]};
  const active={before:[],after:[]};
  let sequence=1;

  function rebuild(phase){
    active[phase]=hooks[phase].filter(function(entry){return entry.enabled!==false;});
  }
  function add(phase,owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('simulation hook must be a function');
    const entry={id:'sim-hook-'+sequence++,owner:String(owner||'anonymous'),fn:fn,priority:Number(priority)||0,enabled:true};
    hooks[phase].push(entry);
    hooks[phase].sort(function(a,b){return a.priority-b.priority||a.id.localeCompare(b.id);});
    rebuild(phase);
    return entry.id;
  }
  function find(id){
    for(const phase of ['before','after']){
      const entry=hooks[phase].find(function(h){return h.id===id;});
      if(entry)return {phase:phase,entry:entry};
    }
    return null;
  }
  // KELO-INDEX CORE/SIMULATION LIFECYCLE duerme/despierta hooks sin registrarlos de nuevo ni crear otro scheduler.
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
    ['before','after'].forEach(function(phase){
      const i=hooks[phase].findIndex(function(h){return h.id===id;});
      if(i>=0){hooks[phase].splice(i,1);rebuild(phase);removed=true;}
    });
    return removed;
  }
  function runPhase(phase,ctx){
    const list=active[phase];
    for(let i=0;i<list.length;i++)list[i].fn(ctx);
  }
  function publicList(phase){
    return Object.freeze(hooks[phase].map(function(h){return Object.freeze({id:h.id,owner:h.owner,priority:h.priority,enabled:h.enabled!==false});}));
  }
  function snapshot(){
    const before=publicList('before'),after=publicList('after');
    const all=before.concat(after),enabled=all.filter(function(h){return h.enabled;}).length;
    return Object.freeze({version:VERSION,before:before,after:after,registered:all.length,enabled:enabled,sleeping:all.length-enabled,legacyBridge:!!legacyBridge});
  }

  // FOUNDATION-ALLOW: única asignación runtime autorizada de updateSimulation después del bootstrap base de engine-a.
  updateSimulation=function(dt){
    const context={dt:Number(dt)||0,player:typeof localPlayer!=='undefined'?localPlayer:null,state:typeof STATE!=='undefined'?STATE:null};
    runPhase('before',context);
    if(legacyBridge&&typeof legacyBridge.before==='function')legacyBridge.before(context);
    const out=originalUpdateSimulation.apply(this,arguments);
    if(legacyBridge&&typeof legacyBridge.after==='function')legacyBridge.after(context);
    runPhase('after',context);
    return out;
  };

  root.KeloSimulation=Object.freeze({
    version:VERSION,
    before:function(owner,fn,priority){return add('before',owner,fn,priority);},
    after:function(owner,fn,priority){return add('after',owner,fn,priority);},
    setEnabled:setEnabled,
    unregister:unregister,
    snapshot:snapshot
  });
  root.KELO_SIMULATION_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:true,singleGlobalWriter:true,legacyAugmentBridge:!!legacyBridge,beforeAfter:true,sleepWake:true,activeListCached:true,timers:0,renderAuthority:false,baseTarget:'engine-a:updateSimulation'});
})(typeof globalThis!=='undefined'?globalThis:window);
