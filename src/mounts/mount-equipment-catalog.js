/* KELO-INDEX
 * area: MOUNTS / EQUIPMENT DATA
 * owner: KeloMountEquipmentCatalog content registry
 * purpose: piezas de equipo de montura declarativas; KeloStats resuelve sus modifiers
 * public-api: register/get/list/validate
 * consumes: KeloMountCatalog equipment profiles + KeloStats modifier contract
 * online: ownership/equip authority futura valida item IDs; modifiers son catálogo compartido
 * do-not: no mutar player stats aquí; no equipar desde UI directamente
 */
(function(root,factory){const api=factory(root);if(root)root.KeloMountEquipmentCatalog=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
const VERSION='mount-equipment-catalog-v1.0.1',SCHEMA_VERSION=1,rows=new Map();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
function validate(raw){const errors=[];if(!raw?.id)errors.push('ID_REQUIRED');if(!raw?.slotId)errors.push('SLOT_REQUIRED');if(!Array.isArray(raw?.compatibleProfiles)||!raw.compatibleProfiles.length)errors.push('COMPATIBILITY_REQUIRED');if(!Array.isArray(raw?.modifiers))errors.push('MODIFIERS_REQUIRED');if(root?.KeloStats)for(const m of raw?.modifiers||[]){const c=root.KeloStats.validateModifier(m);if(!c.ok)errors.push('MODIFIER_INVALID:'+m?.id+':'+c.errors.join('|'));}return{ok:!errors.length,errors};}
function register(raw){const check=validate(raw);if(!check.ok)throw new Error('MOUNT_EQUIPMENT_INVALID:'+check.errors.join(','));if(rows.has(String(raw.id)))throw new Error('MOUNT_EQUIPMENT_DUPLICATE:'+raw.id);const row=Object.freeze({schemaVersion:SCHEMA_VERSION,id:String(raw.id),displayName:String(raw.displayName||raw.id),slotId:String(raw.slotId),rarity:String(raw.rarity||'common'),compatibleProfiles:Object.freeze(raw.compatibleProfiles.map(String)),modifiers:Object.freeze(copy(raw.modifiers)),appearanceItemId:raw.appearanceItemId?String(raw.appearanceItemId):null,tags:Object.freeze((raw.tags||[]).map(String))});rows.set(row.id,row);return row;}
const defs=[
{id:'equipment.mount.war_saddle',displayName:'Silla de Guerra',slotId:'saddle',rarity:'rare',compatibleProfiles:['equipment.mount.standard'],tags:['starter'],modifiers:[{id:'mod.war_saddle.player_def',target:'player',stat:'defense',operation:'percentAdd',value:.04,scope:'whileMounted',sourceId:'equipment.mount.war_saddle'},{id:'mod.war_saddle.player_hp',target:'player',stat:'hp',operation:'percentAdd',value:.05,scope:'whileMounted',sourceId:'equipment.mount.war_saddle'},{id:'mod.war_saddle.mount_accel',target:'mount',stat:'acceleration',operation:'percentAdd',value:.08,scope:'whileEquipped',sourceId:'equipment.mount.war_saddle'}]},
{id:'equipment.mount.swift_horseshoes',displayName:'Herraduras Veloces',slotId:'horseshoes',rarity:'epic',compatibleProfiles:['equipment.mount.standard'],tags:['starter'],modifiers:[{id:'mod.swift_horseshoes.speed',target:'mount',stat:'maxSpeed',operation:'percentAdd',value:.08,scope:'whileEquipped',sourceId:'equipment.mount.swift_horseshoes'}]},
{id:'equipment.mount.shadow_harness',displayName:'Arnés Umbral',slotId:'harness',rarity:'legendary',compatibleProfiles:['equipment.mount.wolf'],tags:['wolf'],modifiers:[{id:'mod.shadow_harness.player_def',target:'player',stat:'defense',operation:'flatAdd',value:6,scope:'whileMounted',sourceId:'equipment.mount.shadow_harness'},{id:'mod.shadow_harness.mount_speed',target:'mount',stat:'maxSpeed',operation:'percentAdd',value:.05,scope:'whileEquipped',sourceId:'equipment.mount.shadow_harness'}]}
];defs.forEach(register);
return Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,register,get:id=>rows.get(String(id))||null,list:()=>[...rows.values()],validate,get count(){return rows.size;}});
});
