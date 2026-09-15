/* KELO-INDEX
 * area: CORE / MOVEMENT
 * owner: KeloMovement
 * keys: MOVEMENT HOOK BEFORE INTERCEPT AFTER UPDATE EXTENSION FOUNDATION ZERO-GARBAGE
 * purpose: único punto de extensión alrededor del updateMovement legacy mientras la física base siga en engine-a
 * public-api: KeloMovement.before/intercept/after/unregister/snapshot
 * consumes: updateMovement legacy
 * state-owned: registro ordenado de hooks e interceptores de movimiento
 * extension-points: before/intercept/after con prioridad explícita
 * reuse: gait, telemetría, dash/knockback/cutscene y compatibilidad sin volver a envolver updateMovement
 * legacy: bridge temporal; la física base aún vive en engine-a.js
 * do-not: NO meter UI, input locks, reglas de habilidad ni render aquí
 */
(function(root){
  'use strict';
  if(root.KeloMovement)return;
  const VERSION='kelo-movement-v1.2.0-zero-garbage-hooks';
  if(typeof updateMovement!=='function'){
    root.KELO_MOVEMENT_SYSTEM_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'updateMovement-missing'});
    return;
  }
  const originalUpdateMovement=updateMovement;
  const hooks={before:[],intercept:[],after:[]};
  const active={before:[],intercept:[],after:[]};
  let sequence=1;

  function rebuild(phase){active[phase]=hooks[phase].slice();}
  function add(phase,owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('movement hook must be a function');
    const entry={id:'move-hook-'+sequence++,owner:String(owner||'anonymous'),fn:fn,priority:Number(priority)||0};
    hooks[phase].push(entry);
    hooks[phase].sort(function(a,b){return a.priority-b.priority||a.id.localeCompare(b.id);});
    rebuild(phase);
    return entry.id;
  }
  function unregister(id){
    let removed=false;
    ['before','intercept','after'].forEach(function(phase){
      const i=hooks[phase].findIndex(function(h){return h.id===id;});
      if(i>=0){hooks[phase].splice(i,1);rebuild(phase);removed=true;}
    });
    return removed;
  }
  function run(phase,ctx){const list=active[phase];for(let i=0;i<list.length;i++)list[i].fn(ctx);}
  function runInterceptor(ctx){
    const list=active.intercept;
    for(let i=0;i<list.length;i++){
      if(list[i].fn(ctx)===true){ctx.handledBy=list[i].owner;return true;}
    }
    return false;
  }
  function publicList(phase){return Object.freeze(hooks[phase].map(function(h){return Object.freeze({id:h.id,owner:h.owner,priority:h.priority});}));}
  function snapshot(){return Object.freeze({version:VERSION,before:publicList('before'),intercept:publicList('intercept'),after:publicList('after')});}

  // FOUNDATION-ALLOW: único bridge autorizado alrededor del updateMovement legacy.
  updateMovement=function(dt){
    const ctx={dt:Number(dt)||0,player:typeof localPlayer!=='undefined'?localPlayer:null,input:typeof input!=='undefined'?input:null,config:typeof CONFIG!=='undefined'?CONFIG:null,handledBy:null};
    run('before',ctx);
    if(!runInterceptor(ctx))originalUpdateMovement(dt);
    run('after',ctx);
  };

  root.KeloMovement=Object.freeze({
    version:VERSION,
    before:function(owner,fn,priority){return add('before',owner,fn,priority);},
    intercept:function(owner,fn,priority){return add('intercept',owner,fn,priority);},
    after:function(owner,fn,priority){return add('after',owner,fn,priority);},
    unregister:unregister,
    snapshot:snapshot
  });
  root.KELO_MOVEMENT_SYSTEM_AUDIT=Object.freeze({version:VERSION,installed:true,singleLegacyWrapper:true,beforeAfterHooks:true,exclusiveInterceptors:true,activeListCached:true,perFrameHookCopies:false,timers:0,uiRules:false});
})(typeof globalThis!=='undefined'?globalThis:window);
