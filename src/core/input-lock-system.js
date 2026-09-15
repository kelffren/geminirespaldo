/* KELO-INDEX
 * area: CORE / INPUT
 * owner: KeloInputLocks
 * keys: INPUT LOCK MODAL OWNER TOKEN COMPAT FOUNDATION
 * purpose: único owner de locks semánticos que bloquean interacción/movimiento mientras una UI o transición está activa
 * public-api: KeloInputLocks.acquire/release/releaseOwner/isLocked/has/snapshot
 * consumes: KeloEvents opcional
 * state-owned: active input lock claims + legacy compatibility claims
 * extension-points: nuevos consumidores usan acquire/release; no escriben globals directamente
 * reuse: cualquier modal/transición que necesite reclamar input temporalmente
 * legacy: mantiene KELO_MODAL_INPUT_LOCK como adapter transitorio apilable por owner
 * do-not: NO meter reglas de UI, PvP, build mode ni movimiento físico aquí
 */
(function(root){
  'use strict';
  if(root.KeloInputLocks)return;

  const VERSION='kelo-input-locks-v1.1.0';
  const claims=new Map();
  const legacyByOwner=new Map();
  const legacyOrder=[];
  let sequence=1;
  let changes=0;

  function normalizeOwner(owner){
    const value=String(owner==null?'':owner).trim();
    return value||'anonymous';
  }
  function emit(reason){
    changes+=1;
    const payload=snapshot(reason);
    try{if(root.KeloEvents&&typeof root.KeloEvents.emit==='function')root.KeloEvents.emit('input-locks:changed',payload);}catch(_){ }
    return payload;
  }
  function acquire(owner,meta){
    const token='input-lock-'+(sequence++).toString(36);
    claims.set(token,Object.freeze({token:token,owner:normalizeOwner(owner),meta:meta&&typeof meta==='object'?Object.freeze(Object.assign({},meta)):null,createdAt:Date.now(),legacy:false}));
    emit('acquire');
    return token;
  }
  function forgetLegacyToken(token){
    for(const entry of legacyByOwner.entries()){
      if(entry[1]!==token)continue;
      legacyByOwner.delete(entry[0]);
      const i=legacyOrder.lastIndexOf(entry[0]);
      if(i>=0)legacyOrder.splice(i,1);
      break;
    }
  }
  function release(token){
    const key=String(token||'');
    if(!key||!claims.has(key))return false;
    forgetLegacyToken(key);
    const removed=claims.delete(key);
    if(removed)emit('release');
    return removed;
  }
  function releaseOwner(owner){
    const target=normalizeOwner(owner);
    let removed=0;
    Array.from(claims.entries()).forEach(function(entry){
      const token=entry[0],claim=entry[1];
      if(claim.owner!==target)return;
      claims.delete(token);forgetLegacyToken(token);removed+=1;
    });
    legacyByOwner.delete(target);
    for(let i=legacyOrder.length-1;i>=0;i--)if(legacyOrder[i]===target)legacyOrder.splice(i,1);
    if(removed)emit('release-owner');
    return removed;
  }
  function has(owner){
    const target=normalizeOwner(owner);
    for(const claim of claims.values())if(claim.owner===target)return true;
    return false;
  }
  function owners(){return Array.from(new Set(Array.from(claims.values()).map(function(c){return c.owner;})));}
  function isLocked(){return claims.size>0;}
  function snapshot(reason){
    return Object.freeze({version:VERSION,locked:isLocked(),count:claims.size,owners:Object.freeze(owners()),legacyOwners:Object.freeze(legacyOrder.slice()),reason:reason||null,changes:changes});
  }
  function claimLegacy(owner){
    const target=normalizeOwner(owner);
    if(legacyByOwner.has(target)){
      const oldIndex=legacyOrder.lastIndexOf(target);
      if(oldIndex>=0)legacyOrder.splice(oldIndex,1);
      legacyOrder.push(target);
      emit('legacy-focus');
      return legacyByOwner.get(target);
    }
    const token='input-lock-legacy-'+(sequence++).toString(36);
    claims.set(token,Object.freeze({token:token,owner:target,meta:Object.freeze({source:'KELO_MODAL_INPUT_LOCK'}),createdAt:Date.now(),legacy:true}));
    legacyByOwner.set(target,token);
    legacyOrder.push(target);
    emit('legacy-acquire');
    return token;
  }
  function releaseCurrentLegacy(){
    while(legacyOrder.length){
      const owner=legacyOrder.pop();
      const token=legacyByOwner.get(owner);
      legacyByOwner.delete(owner);
      if(token&&claims.delete(token)){emit('legacy-release');return true;}
    }
    return false;
  }
  function setLegacy(value){
    if(value==null||value===false||!String(value).trim()){releaseCurrentLegacy();return;}
    claimLegacy(value);
  }
  function legacyValue(){
    for(let i=legacyOrder.length-1;i>=0;i--){
      const owner=legacyOrder[i],token=legacyByOwner.get(owner);
      if(token&&claims.has(token))return owner;
    }
    const first=claims.values().next();
    return first.done?null:first.value.owner;
  }

  const previous=root.KELO_MODAL_INPUT_LOCK;
  try{
    Object.defineProperty(root,'KELO_MODAL_INPUT_LOCK',{
      configurable:true,
      enumerable:true,
      get:legacyValue,
      set:setLegacy
    });
  }catch(_){ }
  if(previous!=null&&previous!==false&&String(previous).trim())claimLegacy(previous);

  root.KeloInputLocks=Object.freeze({
    version:VERSION,
    acquire:acquire,
    release:release,
    releaseOwner:releaseOwner,
    isLocked:isLocked,
    has:has,
    owners:function(){return Object.freeze(owners());},
    snapshot:snapshot
  });
  root.KELO_INPUT_LOCK_AUDIT=Object.freeze({version:VERSION,ready:true,singleOwner:true,legacyAdapter:true,legacyStack:true,tokenClaims:true,domainRules:false});
})(typeof globalThis!=='undefined'?globalThis:window);
