/* KELO-INDEX
 * area: MOUNTS / CATALOG
 * owner: KeloMountCatalog
 * purpose: definitions ligeras, movement profiles y equipment slot profiles; contenido no crea clases
 * public-api: register/registerMany/get/query/count/registerMovement/getMovement/registerEquipmentProfile/getEquipmentProfile/validate
 * consumes: KELO_MOUNT_ABILITY_DATA IDs; KeloAppearance profile IDs por referencia
 * state-owned: registries de metadata; NO posee mounted state ni assets cargados
 * extension-points: schemaVersion + profile IDs + tags
 * online: IDs estables y definitions serializables; server puede validar catálogo por versión
 * do-not: no instanciar actors/textures por definition; no switch por mountId
 */
(function(root,factory){const api=factory(root);if(root)root.KeloMountCatalog=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
const VERSION='mount-catalog-v1.0.1',SCHEMA_VERSION=1;
const mounts=new Map(),movement=new Map(),equipmentProfiles=new Map();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const idOk=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9._:-]*$/i.test(v);
function abilityKeys(){return new Set((root?.KELO_MOUNT_ABILITY_DATA?.abilities||[]).map(a=>String(a.key)));}
function validate(raw){const errors=[];if(!raw||typeof raw!=='object')return{ok:false,errors:['MOUNT_REQUIRED']};if(!idOk(raw.id))errors.push('ID_INVALID');if(!raw.displayName)errors.push('DISPLAY_NAME_REQUIRED');if(!raw.speciesId)errors.push('SPECIES_REQUIRED');if(!raw.movementProfileId)errors.push('MOVEMENT_PROFILE_REQUIRED');if(!Array.isArray(raw.abilityIds)||raw.abilityIds.length!==3)errors.push('ABILITY_COUNT_MUST_BE_3');else{const keys=abilityKeys();for(const a of raw.abilityIds)if(keys.size&&!keys.has(String(a)))errors.push('ABILITY_UNKNOWN:'+a);}if(!raw.appearanceProfileId)errors.push('APPEARANCE_PROFILE_REQUIRED');if(!raw.equipmentSlotProfileId)errors.push('EQUIPMENT_PROFILE_REQUIRED');if(!raw.assetBundleId)errors.push('ASSET_BUNDLE_REQUIRED');if(raw.movementProfileId&&!movement.has(String(raw.movementProfileId)))errors.push('MOVEMENT_PROFILE_UNKNOWN:'+raw.movementProfileId);if(raw.equipmentSlotProfileId&&!equipmentProfiles.has(String(raw.equipmentSlotProfileId)))errors.push('EQUIPMENT_PROFILE_UNKNOWN:'+raw.equipmentSlotProfileId);return{ok:!errors.length,errors};}
function normalize(raw){const check=validate(raw);if(!check.ok)throw new Error('MOUNT_DEFINITION_INVALID:'+check.errors.join(','));return Object.freeze({schemaVersion:SCHEMA_VERSION,id:String(raw.id),displayName:String(raw.displayName),speciesId:String(raw.speciesId),rarity:String(raw.rarity||'common'),movementProfileId:String(raw.movementProfileId),abilityIds:Object.freeze(raw.abilityIds.map(String)),appearanceProfileId:String(raw.appearanceProfileId),equipmentSlotProfileId:String(raw.equipmentSlotProfileId),assetBundleId:String(raw.assetBundleId),animationSetId:String(raw.animationSetId||''),riderAnchorProfileId:String(raw.riderAnchorProfileId||raw.appearanceProfileId),unlockRuleId:raw.unlockRuleId==null?null:String(raw.unlockRuleId),tags:Object.freeze((raw.tags||[]).map(String)),baseStats:Object.freeze(copy(raw.baseStats||{})),metadata:Object.freeze(copy(raw.metadata||{}))});}
function register(raw){const row=normalize(raw);if(mounts.has(row.id))throw new Error('MOUNT_DUPLICATE:'+row.id);mounts.set(row.id,row);return row;}
function registerMany(rows){const out=[];for(const row of rows||[])out.push(register(row));return out;}
function registerMovement(raw){if(!raw||!idOk(raw.id))throw new Error('MOUNT_MOVEMENT_ID_INVALID');const row=Object.freeze({id:String(raw.id),acceleration:Number(raw.acceleration)||0,maxSpeed:Number(raw.maxSpeed)||0,braking:Number(raw.braking)||0,turnRate:Number(raw.turnRate)||0,reverseSpeed:Number(raw.reverseSpeed)||0,momentum:Number(raw.momentum)||0,terrainModifiers:Object.freeze(copy(raw.terrainModifiers||{})),specialTraversal:Object.freeze(copy(raw.specialTraversal||{}))});movement.set(row.id,row);return row;}
function registerEquipmentProfile(raw){if(!raw||!idOk(raw.id)||!Array.isArray(raw.slots))throw new Error('MOUNT_EQUIPMENT_PROFILE_INVALID');const row=Object.freeze({id:String(raw.id),slots:Object.freeze([...new Set(raw.slots.map(String))])});equipmentProfiles.set(row.id,row);return row;}
function query(filter){const f=filter||{};let out=[...mounts.values()];if(f.speciesId)out=out.filter(x=>x.speciesId===f.speciesId);if(f.rarity)out=out.filter(x=>x.rarity===f.rarity);if(f.tag)out=out.filter(x=>x.tags.includes(f.tag));if(f.text){const q=String(f.text).toLowerCase();out=out.filter(x=>x.id.toLowerCase().includes(q)||x.displayName.toLowerCase().includes(q));}return out;}
function migrate(raw){const out=copy(raw||{});out.schemaVersion=SCHEMA_VERSION;return out;}
registerMovement({id:'movement.horse.standard',acceleration:760,maxSpeed:430,braking:820,turnRate:8.5,momentum:.62});
registerMovement({id:'movement.wolf.fast',acceleration:920,maxSpeed:455,braking:940,turnRate:10.5,momentum:.4});
registerEquipmentProfile({id:'equipment.mount.standard',slots:['saddle','armor','horseshoes','reins','bags','charm']});
registerEquipmentProfile({id:'equipment.mount.wolf',slots:['harness','armor','paws','bags','charm','accessory']});
const starter=[
{id:'mount.training_horse',displayName:'Caballo de Entrenamiento',speciesId:'species.horse',rarity:'common',movementProfileId:'movement.horse.standard',abilityIds:['mount_horse_gallop','mount_horse_guard','mount_horse_trample'],appearanceProfileId:'appearance.mount.horse.standard',equipmentSlotProfileId:'equipment.mount.standard',assetBundleId:'mount.asset.training_horse',animationSetId:'animation.mount.horse.standard',baseStats:{maxSpeed:430,acceleration:760,defense:10,cargo:40},tags:['starter','horse']},
{id:'mount.shadow_wolf',displayName:'Lobo Umbral',speciesId:'species.wolf',rarity:'legendary',movementProfileId:'movement.wolf.fast',abilityIds:['mount_wolf_pounce','mount_wolf_howl','mount_wolf_shadow_run'],appearanceProfileId:'appearance.mount.wolf.standard',equipmentSlotProfileId:'equipment.mount.wolf',assetBundleId:'mount.asset.shadow_wolf',animationSetId:'animation.mount.wolf.standard',baseStats:{maxSpeed:455,acceleration:920,defense:6,cargo:15},tags:['wolf','agile','legendary']}
];
starter.forEach(register);
return Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,register,registerMany,get:id=>mounts.get(String(id))||null,has:id=>mounts.has(String(id)),query,list:()=>[...mounts.values()],get count(){return mounts.size;},validate,migrate,registerMovement,getMovement:id=>movement.get(String(id))||null,listMovement:()=>[...movement.values()],registerEquipmentProfile,getEquipmentProfile:id=>equipmentProfiles.get(String(id))||null,listEquipmentProfiles:()=>[...equipmentProfiles.values()]});
});