/* KELO-INDEX
 * area: ABILITIES / EQUIPMENT CHANNEL
 * owner: KeloEquipment owns equipped weapon state; KeloAbilities owns cast runtime; this file is support projection
 * keys: EQUIPMENT WEAPON FAMILY Q W E ABILITY SOURCE CAST LOADOUT SLOT CHOICES
 * purpose: proyecta el arma equipada a tres técnicas Q/W/E sin tocar los cinco Stone slots
 * public-api: KeloEquipmentAbilityChannel.sync/getSlots/getSnapshot/cast/on/getRemainingCooldown
 * consumes: KeloEquipment, KELO_EQUIPMENT_ABILITY_DATA, KeloAbilities.engine.castSource, KeloMounts optional
 * state-owned: cooldown readyAt + proyección runtime de 3 slots; NO inventory/equipment state
 * extension-points: WeaponProfile data-driven + selección permitida por slot; exactamente 3 abilities resueltas
 * online: sourceType=equipment + weaponId/profile/fingerprint/loadout permiten validar el cast contra equipo autoritativo
 * legacy: ninguno en el cast path; KeloAbilitySourceCast queda solo como shim de compatibilidad externa
 * do-not: no escribir STATE.equipmentSlots, no crear delivery/effect handlers, no segundo loop, no tocar hotbar Stone
 */
(function(root){'use strict';if(root.KeloEquipmentAbilityChannel)return;
const VERSION='equipment-ability-channel-v1.2.0',COUNT=3,LABELS=Object.freeze(['Q','W','E']),listeners=new Map(),slots=Array(COUNT).fill(null);let fingerprint='none',weaponId=null,profileId=null,profileName=null,weaponFamily=null,abilityKeys=[],selectionStatus='none',customized=false;
function emit(name,payload){const set=listeners.get(name);if(set)for(const fn of [...set])try{fn(payload);}catch(e){console.error(e);}try{root.KeloEvents?.emit?.(name,payload);}catch(_e){}}
function on(name,fn){if(typeof fn!=='function')return()=>{};if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name)?.delete(fn);}
function equippedWeapon(){const items=root.KeloEquipment?.getEquipped?.()||[];return items.find(item=>item&&item.slot==='weapon')||null;}
function sourceFingerprint(weapon,profile,keys){return weapon&&profile?[String(weapon.id||''),String(weapon.templateId||''),String(weapon.itemLevel||1),String(weapon.quality||1),String(weapon.grade||1),profile.id,...(keys||profile.abilityKeys||[])].join('|'):'none';}
function remaining(instance){return instance?Math.max(0,(Number(instance.readyAt)||0)-Date.now())/1000:0;}
function snapshot(){return{version:VERSION,fingerprint,weaponId,profileId,profileName,weaponFamily,abilityKeys:abilityKeys.slice(),selectionStatus,customized,mounted:root.KeloMounts?.isMounted?.()===true,slots:slots.map((s,i)=>s?{sourceType:'equipment',sourceId:s.sourceId,sourceSlot:LABELS[i],slotIndex:i,profileId:s.profileId,profileName:s.profileName,weaponFamily:s.weaponFamily,abilityId:s.abilityId,abilityKey:s.abilityKey,cooldown:remaining(s)}:null)};}
function resolveLoadout(data,weapon){
 if(data?.resolveLoadoutForItem){const loadout=data.resolveLoadoutForItem(weapon);if(loadout)return loadout;}
 const profile=data?.resolveProfileForItem?.(weapon)||null;return profile?{profile,abilityKeys:profile.abilityKeys||[],customized:false,selectionStatus:'default'}:null;
}
function sync(force){
 const data=root.KELO_EQUIPMENT_ABILITY_DATA,weapon=equippedWeapon(),loadout=resolveLoadout(data,weapon),profile=loadout?.profile||null,keys=loadout?.abilityKeys||[],nextFingerprint=sourceFingerprint(weapon,profile,keys);
 if(!force&&nextFingerprint===fingerprint)return snapshot();
 const old=new Map(slots.filter(Boolean).map(s=>[s.sourceId+':'+s.abilityKey,s]));
 weaponId=weapon?.id?String(weapon.id):null;profileId=profile?.id||null;profileName=profile?.displayName||null;weaponFamily=profile?.family||null;abilityKeys=Array.isArray(keys)?keys.slice(0,COUNT):[];selectionStatus=loadout?.selectionStatus||'none';customized=loadout?.customized===true;
 for(let i=0;i<COUNT;i++){const abilityKey=abilityKeys[i],def=abilityKey?data?.getAbility?.(abilityKey):null;if(!weapon||!profile||!def){slots[i]=null;continue;}const key=String(weapon.id)+':'+def.key,prev=old.get(key);slots[i]={sourceType:'equipment',sourceId:String(weapon.id),sourceSlot:LABELS[i],slotIndex:i,profileId:profile.id,profileName:profile.displayName||profile.id,weaponFamily:profile.family,abilityId:def.id,abilityKey:def.key,definition:def,readyAt:prev?.readyAt||0};}
 fingerprint=nextFingerprint;const snap=snapshot();emit('EQUIPMENT_ABILITY_LOADOUT_CHANGED',snap);return snap;
}
function cast(request){
 sync(false);const slotIndex=Number(request?.slotIndex);if(!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=COUNT)return{valid:false,reason:'INVALID_EQUIPMENT_SLOT'};
 if(root.KeloMounts?.isMounted?.()===true)return{valid:false,reason:'WEAPON_SKILLS_DISABLED_WHILE_MOUNTED'};
 const instance=slots[slotIndex];if(!instance)return{valid:false,reason:'EMPTY_SLOT'};const left=remaining(instance);if(left>0)return{valid:false,reason:'COOLDOWN',cooldown:left};
 const runtime=root.KeloAbilities?.engine;if(!runtime?.castSource)return{valid:false,reason:'ABILITY_SOURCE_RUNTIME_UNAVAILABLE'};
 const result=runtime.castSource({sourceType:'equipment',sourceId:instance.sourceId,sourceSlot:instance.sourceSlot,sourceFingerprint:fingerprint,definition:instance.definition,request});
 if(result?.valid){instance.readyAt=Date.now()+Number(instance.definition.cooldown||0)*1000;const semantic=Object.assign({},result,{sourceType:'equipment',sourceId:instance.sourceId,sourceSlot:instance.sourceSlot,slotIndex,profileId:instance.profileId,profileName:instance.profileName,weaponFamily:instance.weaponFamily,cooldown:Number(instance.definition.cooldown)||0});emit('EQUIPMENT_ABILITY_CAST',semantic);return semantic;}
 return result||{valid:false,reason:'CAST_FAILED'};
}
root.KeloEquipmentAbilityChannel=Object.freeze({version:VERSION,slotCount:COUNT,labels:LABELS.slice(),sync,getSlots:()=>slots.slice(),getSnapshot:snapshot,cast,on,getRemainingCooldown:slot=>remaining(slots[Number(slot)])});
root.KELO_EQUIPMENT_ABILITY_AUDIT=Object.freeze({version:VERSION,slotCount:COUNT,stoneStateWrites:0,equipmentStateWrites:0,reusesKeloAbilitiesEngine:true,nativeSourceCast:true,legacyBridge:false,duplicateDeliveryHandlers:0,simulationHooks:0,mountMutualExclusion:true,dataDrivenProfiles:true,perItemSlotChoices:true});
})(typeof globalThis!=='undefined'?globalThis:window);
