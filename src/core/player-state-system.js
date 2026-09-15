/* KELO-INDEX
 * area: CORE / PLAYER STATE / VITALS
 * owner: KeloPlayerState
 * keys: PLAYER HP MAXHP VITALS AUTHORITY ACCESSOR DAMAGE RESTORE NETWORK
 * purpose: single runtime authority boundary for localPlayer.hp/maxHp while legacy callers remain compatible
 * public-api: KeloPlayerState.isLocal/setHp/setMaxHp/setVitals/damage/restoreFull/applyAuthoritative/snapshot
 * consumes: localPlayer created by engine-a
 * state-owned: local player hp/maxHp backing values + audit counters only
 * legacy: direct or aliased assignments remain compatible because hp/maxHp accessors route every write through this owner
 * do-not: NO position, NO mana, NO UI, NO timers, NO listeners, NO game loop
 */
(function(root){
  'use strict';
  if(root.KeloPlayerState)return;
  if(typeof localPlayer==='undefined'||!localPlayer){
    root.KELO_PLAYER_STATE_AUDIT=Object.freeze({version:'kelo-player-state-v1',installed:false,reason:'localPlayer-missing'});
    return;
  }

  const VERSION='kelo-player-state-v1';
  const player=localPlayer;
  let maxHp=normalizeMax(player.maxHp);
  let hp=clampHp(player.hp,maxHp);
  let writes=0;
  let directCompatibilityWrites=0;
  let lastSource='bootstrap';

  function finite(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function normalizeMax(value){return Math.max(1,finite(value,100));}
  function clampHp(value,max){return Math.max(0,Math.min(max,finite(value,0)));}
  function mark(source,compat){writes++;if(compat)directCompatibilityWrites++;lastSource=String(source||'unknown');}
  function setMaxInternal(value,source,compat){maxHp=normalizeMax(value);if(hp>maxHp)hp=maxHp;mark(source,compat);return maxHp;}
  function setHpInternal(value,source,compat){hp=clampHp(value,maxHp);mark(source,compat);return hp;}

  Object.defineProperty(player,'maxHp',{enumerable:true,configurable:false,get:function(){return maxHp;},set:function(value){setMaxInternal(value,'compat:maxHp-assignment',true);}});
  Object.defineProperty(player,'hp',{enumerable:true,configurable:false,get:function(){return hp;},set:function(value){setHpInternal(value,'compat:hp-assignment',true);}});

  function setMaxHp(value,meta){return setMaxInternal(value,meta&&meta.source||'api:setMaxHp',false);}
  function setHp(value,meta){return setHpInternal(value,meta&&meta.source||'api:setHp',false);}
  function setVitals(next,meta){
    next=next||{};
    const source=meta&&meta.source||'api:setVitals';
    if(next.maxHp!=null)maxHp=normalizeMax(next.maxHp);
    if(next.hp!=null)hp=clampHp(next.hp,maxHp);else if(hp>maxHp)hp=maxHp;
    mark(source,false);
    return snapshot();
  }
  function damage(amount,meta){
    const dealt=Math.max(0,finite(amount,0)),before=hp;
    hp=clampHp(before-dealt,maxHp);mark(meta&&meta.source||'api:damage',false);
    return Object.freeze({before,after:hp,amount:before-hp,killed:before>0&&hp<=0,maxHp});
  }
  function restoreFull(meta){hp=maxHp;mark(meta&&meta.source||'api:restoreFull',false);return hp;}
  function applyAuthoritative(next,meta){return setVitals(next,Object.assign({},meta,{source:meta&&meta.source||'authority'}));}
  function isLocal(actor){return actor===player;}
  function snapshot(){return Object.freeze({version:VERSION,hp,maxHp,writes,directCompatibilityWrites,lastSource});}

  root.KeloPlayerState=Object.freeze({version:VERSION,isLocal,setHp,setMaxHp,setVitals,damage,restoreFull,applyAuthoritative,snapshot});
  root.KELO_PLAYER_STATE_AUDIT=Object.freeze({
    version:VERSION,installed:true,owner:'KeloPlayerState',accessorBoundary:true,localVitalsOnly:true,
    timers:0,listeners:0,gameLoop:false,positionAuthority:false,manaAuthority:false,
    get hp(){return hp;},get maxHp(){return maxHp;},get writes(){return writes;},
    get directCompatibilityWrites(){return directCompatibilityWrites;},get lastSource(){return lastSource;}
  });
})(typeof globalThis!=='undefined'?globalThis:window);
