/* KELO-INDEX
 * area: CORE
 * owner: KeloRuntimeBootstrap
 * keys: BOOTSTRAP MODULE ORDER COMBAT EFFECTS STATUS MELEE ABILITY TIMELINE PVP PREDICTION LAZY FIRST-USE PERFORMANCE
 * purpose: expone un único loader idempotente para foundations Combat/Effects/Status/Melee y soporte compartido de prediction; los módulos pesados cargan solo bajo `ensure()`
 * public-api: KeloRuntimeBootstrap.ensure/isReady/modules
 * state-owned: progreso/promesa efímera del late boot
 * online: carga contratos compartidos y soporte cliente sin asumir autoridad
 * extension-points: features llaman ensure(); no crean loaders paralelos
 * do-not: NO gameplay específico, NO auto-load de módulos al evaluar, NO segundo loop, NO polling
 */
(function(root){
  'use strict';
  const VERSION='kelo-runtime-bootstrap-v1.5.1-player-vitals-owner';
  const MODULES=Object.freeze([
    'src/core/events/event-bus.js?v=1',
    'src/abilities/ability-action-timeline.js?v=1',
    'src/systems/combat/combat-schema.js?v=2',
    'src/systems/combat/hit-resolver.js?v=2',
    'src/systems/combat/damage-resolver.js?v=3-player-vitals',
    'src/systems/effects/effect-schema.js?v=2',
    'src/systems/effects/status-engine.js?v=1',
    'src/systems/effects/effect-engine.js?v=2',
    'src/systems/combat/combat-engine.js?v=2',
    'src/systems/melee/melee-schema.js?v=3',
    'src/systems/melee/melee-weapon-profiles.js?v=3',
    'src/systems/melee/melee-engine.js?v=3',
    'src/visuals/combat-presentation-bridge.js?v=2',
    'src/systems/pvp-ability-movement-prediction.js?v=1',
    'src/systems/pvp-visual-competitive-pass.js?v=1'
  ]);
  const audit=root.KELO_RUNTIME_BOOTSTRAP_AUDIT={version:VERSION,ready:false,loading:false,loaded:0,total:MODULES.length,failed:[],requestedAt:0,readyAt:0};
  let promise=null;
  function exists(src){const base=src.split('?')[0];return Array.from(document.scripts).some(function(s){return(s.getAttribute('src')||'').split('?')[0]===base;});}
  function load(index,resolve,reject){
    if(index>=MODULES.length){
      audit.loading=false;
      if(audit.failed.length){promise=null;reject(new Error('KELO_RUNTIME_FOUNDATION_LOAD_FAILED:'+audit.failed.join(',')));return;}
      audit.ready=true;audit.readyAt=Date.now();
      try{root.dispatchEvent(new CustomEvent('kelo:runtime-foundations-ready'));}catch(_){}
      resolve(true);return;
    }
    const src=MODULES[index];
    if(exists(src)){audit.loaded+=1;load(index+1,resolve,reject);return;}
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.keloRuntimeFoundation='1';
    script.onload=function(){audit.loaded+=1;load(index+1,resolve,reject);};
    script.onerror=function(){audit.failed.push(src);console.error('[Kelo runtime bootstrap] failed',src);load(index+1,resolve,reject);};
    document.body.appendChild(script);
  }
  function ensure(){
    if(audit.ready)return Promise.resolve(true);
    if(promise)return promise;
    audit.loading=true;audit.requestedAt=Date.now();audit.failed.length=0;audit.loaded=0;
    promise=new Promise(function(resolve,reject){load(0,resolve,reject);});
    return promise;
  }
  root.KeloRuntimeBootstrap=Object.freeze({version:VERSION,modules:MODULES.slice(),ensure,isReady:function(){return audit.ready===true;}});
})(typeof globalThis!=='undefined'?globalThis:window);
