/* KELO-INDEX
 * area: CORE / OPTIONAL AUTH
 * owner: KeloAccountLiveControlGate
 * keys: ADMIN LIVE CONTROL LAZY AUTH NO-FREEZE NO-POLL-BOOT
 * purpose: activar el receptor GM solo cuando KeloOnlineAuth ya existe/está listo; el gate por sí solo no carga Supabase ni gameplay
 * do-not: NO auth bootstrap, NO requestAnimationFrame, NO gameLoop hook
 */
(function(root){
'use strict';
if(root.KeloAccountLiveControlGate)return;
const VERSION='kelo-account-live-control-gate-v2';
let loading=null,installed=false;
async function arm(){
  if(installed||loading||!root.KeloOnlineAuth)return installed;
  loading=import('./../auth/account-live-control-runtime.mjs?v=2')
    .then(m=>m.installAccountLiveControl({root}))
    .then(api=>{installed=!!api;return installed;})
    .catch(error=>{console.warn('[Kelo account live-control gate]',error);return false;})
    .finally(()=>{loading=null;});
  return loading;
}
['kelo:online-auth-ready','kelo:account-signed-in','kelo:profile-complete','kelo:account-created'].forEach(name=>root.addEventListener(name,()=>void arm(),{passive:true}));
const api=Object.freeze({version:VERSION,arm,get installed(){return installed;}});root.KeloAccountLiveControlGate=api;
if(root.KeloOnlineAuth)void arm();
})(typeof globalThis!=='undefined'?globalThis:window);