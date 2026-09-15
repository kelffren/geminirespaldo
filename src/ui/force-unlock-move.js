/* KELO-INDEX
 * area: UI / INPUT COMPAT
 * owner: NONE — RETIRED HOTFIX, conservado temporalmente para auditoría/cache compatibility
 * keys: INPUT UNLOCK JOYSTICK MODAL BUILDMODE HOTFIX RETIRED FOUNDATION
 * purpose: documenta el antiguo watchdog que borraba locks; ya NO muta input, build mode ni processInput
 * public-api: KELO_FORCE_UNLOCK_AUDIT
 * consumes: ninguno
 * state-owned: ninguno
 * extension-points: ninguno
 * reuse: NO REUTILIZAR este patrón
 * legacy: eliminar cuando no queden referencias/cache contracts al nombre del archivo
 * do-not: NO añadir timers, flags, wrappers ni comportamiento gameplay aquí
 */
(function(root){
  'use strict';
  root.KELO_FORCE_UNLOCK_AUDIT=Object.freeze({
    version:'force-unlock-retired-v2.0.0',
    active:false,
    retired:true,
    timers:0,
    processInputWrapper:false,
    clearsModalLocks:false,
    clearsBuildMode:false,
    replacementOwner:'KeloInputLocks',
    replacementGate:'KELO_INPUT_GATE_AUDIT'
  });
})(typeof globalThis!=='undefined'?globalThis:window);
