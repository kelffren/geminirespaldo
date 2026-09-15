/* KELO-INDEX
 * area: CORE / ASSET RUNTIME
 * owner: KELO_ASSET_REGISTRY
 * keys: ASSET LIBRARY FEATURE GATE LOCALSTORAGE PRESET DIAGNOSTIC MOBILE FEATURE-REGISTRY
 * purpose: persistent allow-list for optional runtime packs. Core boot stays untouched.
 * consumes: KELO_FEATURE_REGISTRY cuando está disponible; fallback legacy para compatibilidad de deploy
 */
(function(root){
'use strict';
if(root.KELO_ASSET_REGISTRY)return;
const VERSION='kelo-asset-registry-v2-feature-registry';
const STORAGE_KEY='kelo_asset_selection_v1';
const CATALOG_URL='data/asset-catalog.json?v=1';
const LEGACY_KNOWN=['social','world','bag','mounts','market','titles','appearance','properties'];
const KNOWN=Object.freeze((Array.isArray(root.KELO_FEATURE_REGISTRY?.ids)?root.KELO_FEATURE_REGISTRY.ids:LEGACY_KNOWN).slice());
const DEFAULTS=Object.freeze(KNOWN.reduce(function(acc,id){acc[id]=true;return acc;},{}));
let catalogPromise=null;
function emit(type,detail){try{root.dispatchEvent(new CustomEvent(type,{detail:Object.freeze({...detail})}));}catch(_){}}
function normalize(input){const out={...DEFAULTS};if(input&&typeof input==='object')KNOWN.forEach(function(id){if(typeof input[id]==='boolean')out[id]=input[id];});return out;}
function read(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return normalize(null);const parsed=JSON.parse(raw);return normalize(parsed&&parsed.features?parsed.features:parsed);}catch(_){return normalize(null);}}
function write(features,reason){const normalized=normalize(features);const payload={version:2,updatedAt:new Date().toISOString(),features:normalized};try{localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));}catch(_){}emit('kelo:asset-selection-changed',{features:{...normalized},reason:reason||'apply'});return normalized;}
function isEnabled(id){id=String(id||'');if(!KNOWN.includes(id))return true;return read()[id]!==false;}
function getState(){const features=read();return Object.freeze({version:VERSION,registryVersion:root.KELO_FEATURE_REGISTRY?.version||'legacy-fallback',storageKey:STORAGE_KEY,known:KNOWN.slice(),enabled:KNOWN.filter(function(id){return features[id];}),disabled:KNOWN.filter(function(id){return !features[id];}),features:Object.freeze({...features})});}
function apply(next,reason){return write(next,reason||'apply');}
function setEnabled(id,value){id=String(id||'');if(!KNOWN.includes(id))return read();const current=read();current[id]=!!value;return write(current,'set:'+id);}
function loadCatalog(){if(catalogPromise)return catalogPromise;catalogPromise=fetch(CATALOG_URL,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('ASSET_CATALOG_'+r.status);return r.json();}).catch(function(error){catalogPromise=null;throw error;});return catalogPromise;}
function applyPreset(name){return loadCatalog().then(function(catalog){const preset=catalog&&catalog.presets&&catalog.presets[name];if(!preset||!Array.isArray(preset.groups))return read();const selected=new Set(preset.groups);const next={};KNOWN.forEach(function(id){next[id]=selected.has(id);});return write(next,'preset:'+name);});}
function reset(){try{localStorage.removeItem(STORAGE_KEY);}catch(_){}const features=normalize(null);emit('kelo:asset-selection-changed',{features:{...features},reason:'reset'});return features;}
function explain(id){const enabled=isEnabled(id);return Object.freeze({id:String(id||''),enabled,known:KNOWN.includes(String(id||'')),reason:enabled?'enabled-or-core':'disabled-by-asset-library'});}
try{root.addEventListener('storage',function(event){if(event&&event.key===STORAGE_KEY)emit('kelo:asset-selection-changed',{features:{...read()},reason:'storage-sync'});});}catch(_){}
root.KELO_ASSET_REGISTRY=Object.freeze({version:VERSION,registryVersion:root.KELO_FEATURE_REGISTRY?.version||'legacy-fallback',storageKey:STORAGE_KEY,catalogUrl:CATALOG_URL,known:KNOWN.slice(),isEnabled,getState,explain,apply,setEnabled,applyPreset,reset,loadCatalog});
})(typeof globalThis!=='undefined'?globalThis:window);
