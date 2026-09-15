/* KELO-INDEX
 * area: MOUNTS / RUNTIME
 * owner: KeloMounts
 * purpose: estado equip/mounted, equipo/outfit, stats y bridge a KeloMovement sin segundo loop
 * public-api: equipMount/unequipMount/mount/dismount/equipItem/unequipItem/setOutfit/getAbilityLoadout/getMountStats/setAuthority
 * consumes: KeloMountCatalog, KeloMountEquipmentCatalog, KeloStats, KeloAppearance, KeloMovement, KeloEvents, KeloEquipment
 * state-owned: STATE.mounts únicamente
 * extension-points: authority adapter + movement profiles + equipment/outfit IDs
 * online: mismas operaciones pasan por request(op,payload,localFallback); server puede reemplazar authority sin cambiar UI/domain IDs
 * do-not: no tocar STATE.equipped stones; no game loop; no renderer; no reglas por mountId
 */
(function(root){'use strict';
if(root.KeloMounts)return;
const Catalog=root.KeloMountCatalog,EquipCatalog=root.KeloMountEquipmentCatalog,Stats=root.KeloStats,Appearance=root.KeloAppearance;
if(!Catalog||!EquipCatalog||!Stats){console.error('KeloMounts missing catalog/stats dependency');return;}
const VERSION='mount-runtime-v1.0.1',SCHEMA_VERSION=1;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
let authority={request:async function(_op,_payload,localFallback){return localFallback();}};
let statsUnsub=null,movementBefore=null,movementAfter=null;
function seedStarterContent(s){
 if(!Object.keys(s.owned).length){const starter=Catalog.query({tag:'starter'})[0]||null;if(starter){s.owned[starter.id]={id:starter.id,unlockedAt:Date.now()};s.equippedMountId=starter.id;}}
 for(const item of EquipCatalog.list())if(item?.tags?.includes('starter')&&!s.equipmentInventory.includes(item.id))s.equipmentInventory.push(item.id);
}
function state(){
 if(typeof STATE==='undefined')return null;
 if(!STATE.mounts||typeof STATE.mounts!=='object')STATE.mounts={};
 const s=STATE.mounts;s.schemaVersion=SCHEMA_VERSION;
 if(!s.owned||typeof s.owned!=='object')s.owned={};
 if(!s.equipmentByMountId||typeof s.equipmentByMountId!=='object')s.equipmentByMountId={};
 if(!s.appearanceByMountId||typeof s.appearanceByMountId!=='object')s.appearanceByMountId={};
 if(!Array.isArray(s.equipmentInventory))s.equipmentInventory=[];
 if(!Number.isFinite(Number(s.revision)))s.revision=1;
 if(typeof s.mounted!=='boolean')s.mounted=false;
 seedStarterContent(s);
 if(s.equippedMountId&&!s.owned[s.equippedMountId])s.equippedMountId=null;
 return s;
}
function emit(name,detail){try{root.KeloEvents?.emit?.(name,detail);}catch(_e){}try{root.dispatchEvent?.(new CustomEvent(name,{detail}));}catch(_e){}}
function persist(){if(typeof saveState==='function')saveState();}
function dirty(reason){const s=state();if(s)s.revision++;Stats.markDirty();if(typeof localPlayer!=='undefined'&&root.KeloEquipment?.recalculate)root.KeloEquipment.recalculate(localPlayer,true);emit('KELO_MOUNT_CHANGED',{reason,snapshot:snapshot()});persist();}
function snapshot(){const s=state();return s?{schemaVersion:s.schemaVersion,equippedMountId:s.equippedMountId||null,mounted:s.mounted===true,revision:s.revision,equipmentByMountId:clone(s.equipmentByMountId),appearanceByMountId:clone(s.appearanceByMountId)}:null;}
function setAuthority(next){if(!next||typeof next.request!=='function')throw new Error('MOUNT_AUTHORITY_INVALID');authority=next;return true;}
function request(op,payload,fn){return Promise.resolve(authority.request(op,clone(payload||{}),fn));}
function owned(id){const s=state();return!!s?.owned?.[String(id)];}
function grantLocalMount(id){const def=Catalog.get(id);if(!def)return{ok:false,error:'MOUNT_NOT_FOUND'};const s=state();s.owned[def.id]={id:def.id,unlockedAt:Date.now()};dirty('grant');return{ok:true,mountId:def.id};}
async function equipMount(id){id=String(id||'');return request('mount:equip',{mountId:id},()=>{const s=state(),def=Catalog.get(id);if(!def)return{ok:false,error:'MOUNT_NOT_FOUND'};if(!owned(id))return{ok:false,error:'MOUNT_NOT_OWNED'};s.equippedMountId=id;if(s.mounted)s.mounted=false;dirty('equip-mount');return{ok:true,mountId:id};});}
async function unequipMount(){return request('mount:unequip',{},()=>{const s=state();s.mounted=false;s.equippedMountId=null;dirty('unequip-mount');return{ok:true};});}
async function mount(){return request('mount:mount',{mountId:state()?.equippedMountId||null},()=>{const s=state();if(!s?.equippedMountId)return{ok:false,error:'NO_EQUIPPED_MOUNT'};if(!owned(s.equippedMountId))return{ok:false,error:'MOUNT_NOT_OWNED'};s.mounted=true;dirty('mount');emit('KELO_MOUNTED',{mountId:s.equippedMountId});return{ok:true,mountId:s.equippedMountId};});}
async function dismount(){return request('mount:dismount',{mountId:state()?.equippedMountId||null},()=>{const s=state();if(!s)return{ok:false,error:'STATE_UNAVAILABLE'};s.mounted=false;dirty('dismount');emit('KELO_DISMOUNTED',{mountId:s.equippedMountId||null});return{ok:true};});}
function activeDefinition(){const s=state();return s?.equippedMountId?Catalog.get(s.equippedMountId):null;}
function getAbilityLoadout(){const s=state(),def=activeDefinition();if(!s?.mounted||!def)return{mounted:false,mountId:s?.equippedMountId||null,slots:[null,null,null],fingerprint:'none'};return{mounted:true,mountId:def.id,slots:def.abilityIds.map((abilityKey,index)=>({sourceType:'mount',sourceId:def.id,slotIndex:index,abilityKey})),fingerprint:[def.id,s.revision,def.abilityIds.join(',')].join('|')};}
function itemSlots(mountId){const s=state();return s?.equipmentByMountId?.[mountId]||{};}
function equipmentItems(mountId){const slots=itemSlots(mountId);return Object.values(slots).map(id=>EquipCatalog.get(id)).filter(Boolean);}
function equipmentModifiersFor(){const s=state();if(!s?.equippedMountId)return[];const mountId=s.equippedMountId;const out=[];for(const item of equipmentItems(mountId))for(const raw of item.modifiers||[]){const m=clone(raw);if(m.target==='mount')m.targetId=mountId;out.push(m);}return out;}
function installStatsSource(){if(statsUnsub)return;statsUnsub=Stats.registerSource('mount-equipment',equipmentModifiersFor);}
function getMountStats(id){const def=Catalog.get(id);if(!def)return null;const s=state(),context={mounted:s?.mounted===true&&s.equippedMountId===def.id,mountId:def.id,inCombat:typeof isPvPActive!=='undefined'&&isPvPActive===true};return Stats.resolve('mount',def.baseStats||{},context,def.id).stats;}
async function equipItem(mountId,itemId){mountId=String(mountId||'');itemId=String(itemId||'');return request('mount:equipment:equip',{mountId,itemId},()=>{const s=state(),def=Catalog.get(mountId),item=EquipCatalog.get(itemId);if(!def)return{ok:false,error:'MOUNT_NOT_FOUND'};if(!owned(mountId))return{ok:false,error:'MOUNT_NOT_OWNED'};if(!item)return{ok:false,error:'ITEM_NOT_FOUND'};if(!s.equipmentInventory.includes(itemId))return{ok:false,error:'ITEM_NOT_OWNED'};const profile=Catalog.getEquipmentProfile(def.equipmentSlotProfileId);if(!profile?.slots.includes(item.slotId)||!item.compatibleProfiles.includes(def.equipmentSlotProfileId))return{ok:false,error:'ITEM_INCOMPATIBLE'};if(!s.equipmentByMountId[mountId])s.equipmentByMountId[mountId]={};s.equipmentByMountId[mountId][item.slotId]=itemId;dirty('equip-item');return{ok:true,mountId,itemId,slotId:item.slotId,playerStats:typeof localPlayer!=='undefined'?clone(localPlayer.equipmentStats||{}):null,mountStats:getMountStats(mountId)};});}
async function unequipItem(mountId,slotId){mountId=String(mountId||'');slotId=String(slotId||'');return request('mount:equipment:unequip',{mountId,slotId},()=>{const s=state();if(!s?.equipmentByMountId?.[mountId])return{ok:true,itemId:null};const itemId=s.equipmentByMountId[mountId][slotId]||null;delete s.equipmentByMountId[mountId][slotId];dirty('unequip-item');return{ok:true,itemId};});}
async function setOutfitItem(mountId,itemId){mountId=String(mountId||'');return request('mount:appearance:set',{mountId,itemId:itemId||null},()=>{const s=state(),def=Catalog.get(mountId);if(!def)return{ok:false,error:'MOUNT_NOT_FOUND'};if(!owned(mountId))return{ok:false,error:'MOUNT_NOT_OWNED'};if(!s.appearanceByMountId[mountId])s.appearanceByMountId[mountId]={};if(!itemId){s.appearanceByMountId[mountId]={};dirty('outfit-clear');return{ok:true};}const item=Appearance?.getItem?.(itemId),profile=Appearance?.getProfile?.(def.appearanceProfileId);if(!item||!profile||!Appearance.compatible(item,profile))return{ok:false,error:'OUTFIT_INCOMPATIBLE'};s.appearanceByMountId[mountId][item.slotId]=item.id;dirty('outfit-set');return{ok:true,mountId,itemId:item.id,slotId:item.slotId};});}
function appearanceSnapshot(mountId,direction,motion){const def=Catalog.get(mountId);if(!def||!Appearance)return null;return Appearance.resolveLoadout({profileId:def.appearanceProfileId,slots:state()?.appearanceByMountId?.[mountId]||{},direction:direction||'down',motion:motion||'idle'});}
function installMovement(){if(!root.KeloMovement||movementBefore)return;
 movementBefore=root.KeloMovement.before('mounts:movement-profile',ctx=>{const s=state();if(!s?.mounted||!s.equippedMountId||!ctx.config)return;const def=Catalog.get(s.equippedMountId),profile=def&&Catalog.getMovement(def.movementProfileId),resolved=getMountStats(s.equippedMountId);if(!profile||!resolved)return;ctx._mountRestore={speed:ctx.config.speed,accelDecay:ctx.config.accelDecay,decelDecay:ctx.config.decelDecay};ctx.config.speed=Math.max(1,Number(resolved.maxSpeed)||profile.maxSpeed||ctx.config.speed);ctx.config.accelDecay=Math.max(4,Math.min(40,(Number(resolved.acceleration)||profile.acceleration||540)/30));ctx.config.decelDecay=Math.max(6,Math.min(50,(Number(profile.braking)||700)/20));},-20);
 movementAfter=root.KeloMovement.after('mounts:movement-profile',ctx=>{const r=ctx._mountRestore;if(!r||!ctx.config)return;ctx.config.speed=r.speed;ctx.config.accelDecay=r.accelDecay;ctx.config.decelDecay=r.decelDecay;},20);
}
installStatsSource();state();installMovement();if(typeof localPlayer!=='undefined'&&root.KeloEquipment?.recalculate)root.KeloEquipment.recalculate(localPlayer,true);
root.KeloMounts=Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,setAuthority,snapshot,isOwned:owned,grantLocalMount,equipMount,unequipMount,mount,dismount,isMounted:()=>state()?.mounted===true,getEquippedMountId:()=>state()?.equippedMountId||null,getEquippedMount:activeDefinition,getAbilityLoadout,getMountStats,getEquipment:mountId=>clone(itemSlots(String(mountId||''))),equipItem,unequipItem,setOutfitItem,getAppearance:appearanceSnapshot,migrateState:state,refresh:function(reason){dirty(reason||'refresh');}});
root.KELO_MOUNT_AUDIT=Object.freeze({version:VERSION,stoneSlotsUntouched:true,mountAbilitySlots:3,usesKeloMovementHooks:!!movementBefore,usesKeloStats:true,authorityBoundary:true,starterIdsInCore:false,secondLoop:false});
})(typeof globalThis!=='undefined'?globalThis:window);
