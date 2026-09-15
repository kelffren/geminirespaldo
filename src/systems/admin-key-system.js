/* KELO-INDEX
 * area: AUTH
 * keys: ADMIN KEY CREATORS WORLD EDIT ANIMATION EDIT VFX EDIT ABILITY EDIT PERMISSION BACKPACK OFFLINE ONLINE READY ROLE SCOPE
 * hace: modela Llave Admin local y combina scopes autoritativos online mediante un provider; Creator/Studio posee la UI de autoría
 * online: installScopeProvider() permite que permisos Supabase gobiernen los consumidores existentes sin duplicar lógica
 */
(function(){
'use strict';

const VERSION='admin-key-v1.6.0-online-scopes';
const SCHEMA=1;
const STORAGE='kelo_admin_keys_v1';
const TEMPLATE_ID='admin-key';
const DEFAULT_CREATOR_SCOPES=Object.freeze(['creators.access','world.edit','world.export','world.import']);
const ROOT_SCOPES=Object.freeze(['creators.access','world.edit','world.export','world.import','world.publish','animation.edit','vfx.edit','ability.edit','admin.issue','admin.revoke']);
let remoteAdapter=null,scopeProvider=null;
let seq=1;
const listeners=new Set();
const clone=v=>JSON.parse(JSON.stringify(v));
const now=()=>Date.now();
const playerId=()=>String(window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
function fresh(){return{schema:SCHEMA,revision:0,keys:{}};}
function load(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');return v&&v.schema===SCHEMA&&v.keys?v:fresh();}catch(e){return fresh();}}
let state=load();
function snapshot(){return clone(state);}
function newId(){return `admin-key:${Date.now().toString(36)}:${(seq++).toString(36)}`;}
function activeKeys(ownerId){ownerId=String(ownerId||playerId());return Object.values(state.keys).filter(k=>k&&k.active!==false&&k.ownerId===ownerId);}
function externalCan(scope,ownerId){
  const who=String(ownerId||playerId()),me=playerId();
  if(who!==me||!scopeProvider||typeof scopeProvider.can!=='function')return false;
  try{return !!scopeProvider.can(String(scope||''));}catch(_){return false;}
}
function hasScope(scope,ownerId){
  const wanted=String(scope||''),who=String(ownerId||playerId());
  return activeKeys(who).some(k=>Array.isArray(k.scopes)&&k.scopes.includes(wanted))||externalCan(wanted,who);
}
function can(scope,ownerId){return hasScope(String(scope||''),ownerId);}
function publicKey(k){return k?clone(k):null;}
function keyInventoryRow(k){return{id:k.keyId,uid:k.keyId,templateId:TEMPLATE_ID,kind:'admin_key',name:k.label||'Llave Admin',icon:'🗝',rarity:'ADMIN',quantity:1,maxStack:1,bound:true,adminKeyId:k.keyId,scopes:clone(k.scopes||[]),description:'Permiso especial para herramientas autorizadas de Kelo Creators.'};}
function syncInventory(){
  if(typeof STATE==='undefined'||!Array.isArray(STATE.inventory))return false;
  const me=playerId(),valid=new Map(activeKeys(me).map(k=>[k.keyId,k]));let changed=false;
  for(let i=STATE.inventory.length-1;i>=0;i--){const item=STATE.inventory[i];if(item?.kind==='admin_key'&&item?.templateId===TEMPLATE_ID&&!valid.has(String(item.adminKeyId||item.id||''))){STATE.inventory.splice(i,1);changed=true;}}
  for(const [keyId,k] of valid){const existing=STATE.inventory.find(x=>x?.kind==='admin_key'&&String(x.adminKeyId||x.id||'')===keyId);if(existing){existing.scopes=clone(k.scopes||[]);existing.bound=true;existing.name=k.label||'Llave Admin';}else{STATE.inventory.push(keyInventoryRow(k));changed=true;}}
  if(changed){try{window.KeloBackpack?.ensure?.();}catch(e){};try{if(typeof saveState==='function')saveState();}catch(e){}}
  return true;
}
function notify(){listeners.forEach(fn=>{try{fn(snapshot());}catch(e){}});}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){};syncInventory();notify();}
function bump(){state.revision=(Number(state.revision)||0)+1;persist();}
function ensureScopes(key,scopes){if(!key)return false;const current=new Set(Array.isArray(key.scopes)?key.scopes.map(String):[]);let changed=false;for(const scope of scopes)if(!current.has(scope)){current.add(scope);changed=true;}if(changed)key.scopes=[...current];return changed;}
function migrateLocalRootScopes(){let changed=false;for(const key of Object.values(state.keys)){if(key?.active!==false&&(key.scopes||[]).includes('admin.issue'))changed=ensureScopes(key,ROOT_SCOPES)||changed;}if(changed){state.revision=(Number(state.revision)||0)+1;try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}}}
function syncWhenReady(){if(syncInventory())return;let tries=0;const timer=setInterval(()=>{tries++;if(syncInventory()||tries>=20)clearInterval(timer);},50);}
function requireScope(scope,actorId){if(!can(scope,actorId))throw new Error('ADMIN_KEY_PERMISSION_DENIED');}
async function localRequest(op,payload){
  const data=payload||{},actorId=String(data.actorId||playerId());
  if(op==='admin-key:status')return{ownerId:actorId,hasKey:activeKeys(actorId).length>0||externalCan('creators.access',actorId),scopes:Array.from(new Set(activeKeys(actorId).flatMap(k=>k.scopes||[]))),keys:activeKeys(actorId).map(publicKey),revision:state.revision,onlineScopes:!!scopeProvider};
  if(op==='admin-key:list'){requireScope('admin.issue',actorId);return Object.values(state.keys).map(publicKey);}
  if(op==='admin-key:issue'){
    requireScope('admin.issue',actorId);const ownerId=String(data.ownerId||'').trim();if(!ownerId)throw new Error('ADMIN_KEY_OWNER_REQUIRED');
    const requested=Array.isArray(data.scopes)&&data.scopes.length?data.scopes:DEFAULT_CREATOR_SCOPES,scopes=Array.from(new Set(requested.map(String)));if(scopes.some(scope=>scope.endsWith('.edit'))&&!scopes.includes('creators.access'))scopes.unshift('creators.access');
    const keyId=newId();state.keys[keyId]={schema:1,keyId,templateId:TEMPLATE_ID,ownerId,label:String(data.label||'Llave Admin · Creador'),scopes,active:true,issuedBy:actorId,createdAt:now(),revokedAt:null};bump();return publicKey(state.keys[keyId]);
  }
  if(op==='admin-key:revoke'){requireScope('admin.revoke',actorId);const keyId=String(data.keyId||'');const k=state.keys[keyId];if(!k)throw new Error('ADMIN_KEY_NOT_FOUND');k.active=false;k.revokedAt=now();k.revokedBy=actorId;bump();return publicKey(k);}
  if(op==='admin-key:bootstrap-local-root'){
    if(!data.developer||!new URLSearchParams(location.search).has('mapEditor'))throw new Error('LOCAL_BOOTSTRAP_DISABLED');
    const ownerId=String(data.ownerId||actorId);let k=activeKeys(ownerId).find(x=>(x.scopes||[]).includes('admin.issue'));
    if(!k){const keyId=newId();state.keys[keyId]={schema:1,keyId,templateId:TEMPLATE_ID,ownerId,label:'Llave Admin · Propietario',scopes:Array.from(ROOT_SCOPES),active:true,issuedBy:'offline-bootstrap',createdAt:now(),revokedAt:null};bump();k=state.keys[keyId];}
    else if(ensureScopes(k,ROOT_SCOPES))bump();
    return publicKey(k);
  }
  throw new Error('UNKNOWN_ADMIN_KEY_OPERATION');
}
async function request(op,payload){if(remoteAdapter&&typeof remoteAdapter.request==='function')return remoteAdapter.request(op,payload||{});return localRequest(op,payload||{});}
function installRemoteAdapter(adapter){if(adapter&&typeof adapter.request!=='function')throw new Error('INVALID_ADMIN_KEY_ADAPTER');remoteAdapter=adapter||null;notify();}
function installScopeProvider(provider){if(provider&&typeof provider.can!=='function')throw new Error('INVALID_SCOPE_PROVIDER');scopeProvider=provider||null;notify();return true;}
function assert(scope,ownerId){requireScope(scope,String(ownerId||playerId()));return true;}

migrateLocalRootScopes();
window.KELO_ADMIN_KEYS=Object.freeze({version:VERSION,templateId:TEMPLATE_ID,scopes:Object.freeze({creator:DEFAULT_CREATOR_SCOPES,root:ROOT_SCOPES}),request,installRemoteAdapter,installScopeProvider,can,assert,hasKey:(ownerId)=>activeKeys(ownerId).length>0,getActiveKeys:(ownerId)=>activeKeys(ownerId).map(publicKey),syncInventory,playerId,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},authoritySource:()=>scopeProvider?'online-scope-provider':remoteAdapter?'remote-adapter':'local-prototype'});
window.KELO_ADMIN_KEY_AUDIT=Object.freeze({version:VERSION,itemIdentity:true,bound:true,scopedPermissions:true,serverReplaceable:true,uiTrustOnlyOffline:true,creatorUiOwner:'Kelo Creators',creatorAccessScope:true,animationEditScope:true,vfxEditScope:true,abilityEditScope:true,onlineScopeProvider:true,legacyWorldBuilderUiBoot:false,legacyPreviewHotfixBoot:false});

const params=new URLSearchParams(location.search);
if(params.get('mapEditor')==='1')request('admin-key:bootstrap-local-root',{actorId:playerId(),ownerId:playerId(),developer:true}).then(syncWhenReady).catch(console.error);else syncWhenReady();
window.addEventListener('load',syncWhenReady,{once:true});
})();

/* World notifications depend on Admin authority for publishing, so they boot here after KELO_ADMIN_KEYS exists. */
(function bootWorldNotifications(){
  if(window.KeloNotifications||document.getElementById('kelo-world-notification-script'))return;
  const script=document.createElement('script');
  script.id='kelo-world-notification-script';
  script.src='src/systems/world-notification-system.js?v=1';
  script.async=false;
  script.onload=function(){
    if(document.getElementById('kelo-world-notification-online-bridge'))return;
    const bridge=document.createElement('script');
    bridge.id='kelo-world-notification-online-bridge';
    bridge.src='src/systems/world-notification-online-bridge.js?v=1';
    bridge.async=false;
    document.head.appendChild(bridge);
  };
  document.head.appendChild(script);
})();