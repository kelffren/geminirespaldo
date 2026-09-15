/* KELO-INDEX
 * area: NET / AUTH BOOT
 * owner: KeloNetAuthority runtime endpoint configuration
 * keys: ONLINE ENDPOINT WSS CONFIG QA OFFLINE SUPABASE AUTH ACCOUNT LOGIN GOOGLE OAUTH BOOT
 * purpose: define endpoint WSS y el estado de la puerta Auth justo antes del transporte existente
 * online: `?net=` conserva override QA; `?offline=1` fuerza fallback; Auth enriquece el mismo hello de engine-net.js
 * do-not: NO guardar secrets aquí, NO crear transporte paralelo, NO inyectar scripts dinámicamente
 */
(function(){
'use strict';
const DEFAULT_WS_URL='wss://kelo-world-server.onrender.com';
const params=new URLSearchParams(location.search),explicitNet=params.get('net'),forceOffline=params.get('offline')==='1',localHost=/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(location.hostname||'');
let mode='local';
if(!forceOffline&&!explicitNet&&!localHost&&location.protocol==='https:'){
  params.set('net',DEFAULT_WS_URL);
  history.replaceState(history.state,'',location.pathname+'?'+params.toString()+location.hash);
  mode='production-default';
}else if(explicitNet)mode='query-override';else if(forceOffline)mode='forced-offline';
document.documentElement.dataset.keloAuthGate=forceOffline?'off':'on';
window.KELO_ONLINE_RUNTIME_CONFIG=Object.freeze({
  version:'kelo-online-runtime-config-v6',
  defaultWsUrl:DEFAULT_WS_URL,
  mode,
  forceOffline,
  effectiveNet:new URLSearchParams(location.search).get('net')||null,
  authBootstrap:'static-supabase-pinned-2.116.0',
  accountGate:!forceOffline,
  googleAuth:!forceOffline
});
})();
