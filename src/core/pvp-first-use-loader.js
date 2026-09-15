/* KELO-INDEX
 * area: CORE / PVP FIRST USE
 * owner: KeloPvPFirstUse
 * keys: PVP LAZY TRANSPORT ABILITIES COMBAT MOBILE SAFARI
 * purpose: reconnect the existing PvP world only when the PvP rail button is tapped, without restoring the heavy social pack
 * public-api: KELO_PVP_FIRST_USE.ensure/enter/isReady
 * consumes: KeloRuntimeBootstrap + KeloAbilitiesLoader + existing src/systems/pvp-world.js
 * do-not: no polling, no second game loop, no duplicate combat authority
 */
(function(root){
'use strict';
if(root.KELO_PVP_FIRST_USE)return;

const VERSION='kelo-pvp-first-use-v1';
const FILES=Object.freeze([
  'src/abilities/abilityData.js?v=154',
  'src/abilities/stone-system.js?v=154',
  'src/abilities/kelo-ability-boot.js?v=157'
]);
const PVP_WORLD='src/systems/pvp-world.js?v=5';
const PVP_GUARD='src/ui/pvp-social-touch-guard.js?v=3';
let promise=null;

function base(src){return String(src||'').split('?')[0];}
function exists(src){
  const target=base(src);
  return Array.from(document.scripts).some(function(script){return base(script.getAttribute('src'))===target;});
}
function entryReady(){
  return !!(root.KeloPvPWorld&&typeof root.KeloPvPWorld.enter==='function')||typeof root.enterPvPWorld==='function';
}
function toast(message){
  try{if(typeof root.showToast==='function')root.showToast(message);else console.info('[Kelo PvP]',message);}catch(_){}
}
function load(src){
  if(exists(src))return Promise.resolve(true);
  return new Promise(function(resolve,reject){
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset.keloPvpFirstUse='1';
    script.onload=function(){resolve(true);};
    script.onerror=function(){reject(new Error('PVP_SCRIPT_LOAD_FAILED:'+src));};
    document.body.appendChild(script);
  });
}
async function ensure(){
  if(entryReady())return true;
  if(promise)return promise;
  promise=(async function(){
    if(!root.KeloRuntimeBootstrap||typeof root.KeloRuntimeBootstrap.ensure!=='function')throw new Error('KELO_RUNTIME_BOOTSTRAP_UNAVAILABLE');
    await root.KeloRuntimeBootstrap.ensure();
    for(const src of FILES)await load(src);
    if(!root.KeloAbilitiesLoader||typeof root.KeloAbilitiesLoader.ensure!=='function')throw new Error('KELO_ABILITIES_LOADER_UNAVAILABLE');
    await root.KeloAbilitiesLoader.ensure();
    await load(PVP_WORLD);
    await load(PVP_GUARD);
    if(!entryReady())throw new Error('KELO_PVP_ENTRY_UNAVAILABLE');
    return true;
  })().catch(function(error){
    promise=null;
    console.error('[Kelo PvP first-use]',error);
    throw error;
  });
  return promise;
}
async function enter(){
  await ensure();
  if(root.KeloPvPWorld&&typeof root.KeloPvPWorld.enter==='function')return root.KeloPvPWorld.enter();
  if(typeof root.enterPvPWorld==='function')return root.enterPvPWorld();
  throw new Error('KELO_PVP_ENTRY_UNAVAILABLE');
}
function hook(){
  const button=document.getElementById('lx-side-pvp');
  if(!button)return false;
  if(button.dataset.keloPvpFirstUse==='1')return true;
  button.dataset.keloPvpFirstUse='1';
  button.onclick=function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    try{root.KELO_LUXE?.closeChat?.();root.KELO_LUXE?.closeMenu?.();}catch(_){}
    if(entryReady()){
      enter().catch(function(){toast('No se pudo abrir PvP');});
      return;
    }
    toast('Cargando PvP…');
    enter().catch(function(error){console.error(error);toast('No se pudo cargar PvP');});
  };
  return true;
}

root.KELO_PVP_FIRST_USE=Object.freeze({version:VERSION,ensure,enter,isReady:entryReady,hook});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook,{once:true});else hook();
root.addEventListener('kelo:boot-ready',hook,{once:true,passive:true});
})(typeof globalThis!=='undefined'?globalThis:window);
