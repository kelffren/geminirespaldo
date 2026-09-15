/* KELO-INDEX
 * area: UI / INPUT COMPAT
 * owner: KeloInputLocks (compatibility only)
 * keys: MODAL INPUT LOCK RETIRED COMPAT INVENTORY FOUNDATION
 * purpose: conserva compatibilidad con el antiguo módulo modal sin volver a envolver processInput
 * public-api: KELO_MODAL_INPUT_AUDIT
 * consumes: KeloInputLocks + inventory interaction hotfix loader
 * state-owned: ninguno
 * extension-points: ninguno; consumidores nuevos usan KeloInputLocks.acquire/release
 * reuse: NO usar como gate nuevo
 * legacy: nombre conservado temporalmente para loaders/tests antiguos
 * do-not: NO envolver processInput, NO crear timers, NO gobernar movimiento
 */
(function(root){
'use strict';
const VERSION='modal-input-lock-v2.0.0-retired';
if(!document.querySelector('script[data-kelo-inventory-hotfix]')){
  const script=document.createElement('script');
  script.src='src/ui/inventory-interaction-hotfix.js?v=1';
  script.dataset.keloInventoryHotfix='1';
  document.head.appendChild(script);
}
root.KELO_MODAL_INPUT_AUDIT=Object.freeze({
  version:VERSION,
  activeGate:false,
  retired:true,
  compatibilityOnly:true,
  replacementOwner:'KeloInputLocks',
  replacementGate:'KELO_INPUT_GATE_AUDIT',
  processInputWrapper:false,
  timers:0,
  inventoryInteractionHotfix:true
});
})(typeof globalThis!=='undefined'?globalThis:window);
