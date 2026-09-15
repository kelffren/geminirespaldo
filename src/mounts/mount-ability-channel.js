/* KELO-INDEX
 * area: MOUNTS / ABILITY CHANNEL
 * owner: KeloMountAbilityChannel adapter; KeloAbilities remains delivery/effect runtime owner
 * purpose: 3 slots exclusivos de montura reutilizando KeloAbilities.engine.castSource sin tocar STATE.equipped ni hotbar Stone
 * public-api: sync/getSlots/cast/getSnapshot/on
 * consumes: KeloMounts, KeloAbilities.engine.castSource, KELO_MOUNT_ABILITY_DATA
 * state-owned: cooldown readyAt + 3 runtime slot descriptors; NO stones
 * extension-points: sourceType/sourceId semantic event payload
 * online: emite sourceType=mount/sourceId/mountSlot; authority futura valida por mountId+abilityId
 * legacy: ninguno en el cast path; KeloAbilitySourceCast queda solo como shim externo
 * do-not: no crear delivery/effect handlers; no escribir STATE.equipped; no segundo simulation loop; no tocar hotbar Stone
 */
(function(root){'use strict';if(root.KeloMountAbilityChannel)return;
const VERSION='mount-ability-channel-v1.2.0',COUNT=3,listeners=new Map(),slots=Array(COUNT).fill(null);let fingerprint='none';
const defs=new Map((root.KELO_MOUNT_ABILITY_DATA?.abilities||[]).map(d=>[String(d.key),d]));
function emit(name,payload){const set=listeners.get(name);if(set)for(const fn of [...set])try{fn(payload);}catch(e){console.error(e);}try{root.KeloEvents?.emit?.(name,payload);}catch(_e){}}
function on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name)?.delete(fn);}
function sync(force){const snap=root.KeloMounts?.getAbilityLoadout?.()||{mounted:false,slots:[null,null,null],fingerprint:'none'};if(!force&&snap.fingerprint===fingerprint)return snapshot();const old=new Map(slots.filter(Boolean).map(s=>[s.sourceId+':'+s.slotIndex+':'+s.abilityKey,s]));for(let i=0;i<COUNT;i++){const entry=snap.slots?.[i];if(!entry){slots[i]=null;continue;}const def=defs.get(String(entry.abilityKey));if(!def){slots[i]=null;continue;}const key=entry.sourceId+':'+i+':'+entry.abilityKey,prev=old.get(key);slots[i]={sourceType:'mount',sourceId:String(entry.sourceId),slotIndex:i,abilityId:def.id,abilityKey:def.key,definition:def,readyAt:prev?.readyAt||0};}fingerprint=snap.fingerprint||'none';emit('MOUNT_ABILITY_LOADOUT_CHANGED',snapshot());return snapshot();}
function remaining(instance){return instance?Math.max(0,(Number(instance.readyAt)||0)-Date.now())/1000:0;}
function snapshot(){return{version:VERSION,fingerprint,mounted:root.KeloMounts?.isMounted?.()===true,mountId:root.KeloMounts?.getEquippedMountId?.()||null,slots:slots.map(s=>s?{sourceType:'mount',sourceId:s.sourceId,slotIndex:s.slotIndex,abilityId:s.abilityId,abilityKey:s.abilityKey,cooldown:remaining(s)}:null)};}
function cast(request){sync(false);const slotIndex=Number(request?.slotIndex);if(!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=COUNT)return{valid:false,reason:'INVALID_MOUNT_SLOT'};if(root.KeloMounts?.isMounted?.()!==true)return{valid:false,reason:'NOT_MOUNTED'};const instance=slots[slotIndex];if(!instance)return{valid:false,reason:'EMPTY_SLOT'};const left=remaining(instance);if(left>0)return{valid:false,reason:'COOLDOWN',cooldown:left};const runtime=root.KeloAbilities?.engine;if(!runtime?.castSource)return{valid:false,reason:'ABILITY_SOURCE_RUNTIME_UNAVAILABLE'};
 const result=runtime.castSource({sourceType:'mount',sourceId:instance.sourceId,sourceSlot:'M'+(slotIndex+1),sourceFingerprint:fingerprint,definition:instance.definition,request});
 if(result?.valid){instance.readyAt=Date.now()+Number(instance.definition.cooldown||0)*1000;const semantic=Object.assign({},result,{valid:true,sourceType:'mount',sourceId:instance.sourceId,sourceSlot:'M'+(slotIndex+1),mountSlot:slotIndex,abilityId:instance.abilityId,abilityKey:instance.abilityKey,cooldown:Number(instance.definition.cooldown)||0});emit('MOUNT_ABILITY_CAST',semantic);return semantic;}return result||{valid:false,reason:'CAST_FAILED'};
}
root.KeloMountAbilityChannel=Object.freeze({version:VERSION,slotCount:COUNT,sync,getSlots:()=>slots.slice(),getSnapshot:snapshot,cast,on,getRemainingCooldown:slot=>remaining(slots[Number(slot)])});
root.KELO_MOUNT_ABILITY_AUDIT=Object.freeze({version:VERSION,slotCount:COUNT,stoneStateWrites:0,reusesKeloAbilitiesEngine:true,nativeSourceCast:true,reusesGenericSourceCast:false,duplicateDeliveryHandlers:0,simulationHooks:0,legacyBridge:false});
})(typeof globalThis!=='undefined'?globalThis:window);
