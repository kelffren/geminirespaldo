/* KELO-INDEX
 * area: CORE / INPUT COMPAT
 * owner: NONE — RETIRED into KeloInput
 * keys: INPUT GATE RETIRED COMPAT FOUNDATION
 * purpose: conserva el nombre histórico del antiguo gate para auditoría; el runtime usa src/core/input-system.js
 * public-api: ninguna
 * consumes: KeloInput opcional
 * state-owned: ninguno
 * extension-points: ninguno
 * reuse: NO cargar ni extender; usar KeloInput
 * legacy: compatibilidad documental únicamente
 * do-not: NO envolver processInput, NO crear timers ni reglas de input aquí
 */
(function(root){
  'use strict';
  if(root.KELO_INPUT_GATE_AUDIT)return;
  root.KELO_INPUT_GATE_AUDIT=Object.freeze({
    version:'kelo-input-gate-retired-v2.0.0',
    installed:false,
    retired:true,
    replacementOwner:'KeloInput',
    lockOwner:'KeloInputLocks',
    processInputWrapper:false,
    timers:0
  });
})(typeof globalThis!=='undefined'?globalThis:window);
