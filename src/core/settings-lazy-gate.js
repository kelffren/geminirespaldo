/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloSettingsLazyGate
 * keys: SETTINGS DOWNLOAD CENTER UPDATE INTELLIGENCE LAZY FIRST-USE MOBILE SAFARI
 * purpose: mantiene Ajustes visible con una puerta mínima; Download Center + Update Intelligence solo se evalúan al primer toque
 * public-api: KeloSettingsUI.open/close + KeloSettingsLazyGate.load
 * do-not: NO settings payload on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloSettingsLazyGate)return;
const VERSION='kelo-settings-lazy-gate-v3-update-intelligence';
let loading=null;
function loadScript(src,marker){return new Promise(function(resolve,reject){const base=src.split('?')[0],existing=Array.from(document.scripts).find(function(s){return String(s.getAttribute('src')||'').split('?')[0]===base;});if(existing){resolve();return;}const s=document.createElement('script');s.src=src;s.async=false;s.dataset.keloSettingsFirstUse=marker||'1';s.onload=resolve;s.onerror=function(){reject(new Error('SETTINGS_SCRIPT_LOAD_FAILED:'+src));};document.head.appendChild(s);});}
function load(){
  if(root.KeloDownloadCenter&&root.KeloUpdateIntelligenceUI)return Promise.resolve(root.KeloDownloadCenter);
  if(loading)return loading;
  loading=loadScript('src/core/download-center.js?v=2-safe','download-center')
    .then(function(){return loadScript('src/core/update-intelligence-ui.js?v=2-fast-forward-health','update-intelligence');})
    .then(function(){return root.KeloDownloadCenter||null;})
    .finally(function(){loading=null;});
  return loading;
}
async function open(){
  try{const center=await load();if(!center||typeof center.open!=='function')throw new Error('DOWNLOAD_CENTER_UNAVAILABLE');center.open();try{root.KeloUpdateIntelligenceUI?.render?.();}catch(_){}return true;}
  catch(error){console.error('[Kelo Settings lazy gate]',error);if(typeof root.showToast==='function')root.showToast('No se pudo abrir Ajustes');return false;}
}
function close(){try{root.KeloDownloadCenter?.close?.();}catch(_){} }
const api=Object.freeze({version:VERSION,load,open,close,get loaded(){return !!(root.KeloDownloadCenter&&root.KeloUpdateIntelligenceUI);}});
root.KeloSettingsLazyGate=api;
root.KeloSettingsUI=Object.freeze({open,close});
try{root.KELO_LUXE?.renderMenu?.();}catch(_){}
})(typeof globalThis!=='undefined'?globalThis:window);
