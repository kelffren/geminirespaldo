/* KELO-INDEX
 * area: AUDIT / EQUIPMENT ABILITIES
 * keys: AUDIT EQUIPMENT WEAPON Q W E MOUNT STONES SOURCE CAST SLOT CHOICES CATALOG MARKET
 * purpose: protege 5 Stone intactos, Q/W/E data-driven, catálogo de armas, adquisición Commerce y cast source-native en KeloAbilities
 * online: valida IDs/profile/fingerprint/content; la autoridad final del mercado/PvP sigue siendo server-ready
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
globalThis.window=globalThis;
globalThis.KeloEvents={events:[],emit(name,payload){this.events.push({name,payload});}};
const stone0={stoneUid:'stone-real',abilityKey:'fireball',definition:{id:1,key:'fireball'},cooldown:0};
const stoneSlots=[stone0,{stoneUid:'stone-2'},null,null,null],stoneRefs=stoneSlots.slice();
let casts=0,lastSource=null;
globalThis.KeloAbilities={hotbar:{slots:stoneSlots},engine:{castSource(opts){casts++;lastSource=opts;for(let i=0;i<5;i++)assert.strictEqual(stoneSlots[i],stoneRefs[i],'source-native cast must not mutate Stone hotbar');const out={valid:true,abilityId:opts.definition.id,abilityKey:opts.definition.key,stoneUid:null,sourceType:opts.sourceType,sourceId:opts.sourceId,sourceSlot:opts.sourceSlot,sourceFingerprint:opts.sourceFingerprint};globalThis.KeloEvents.emit('KELO_ABILITY_SOURCE_CAST',out);return out;}}};
const data=require('../src/abilities/equipment-ability-data.js');globalThis.KELO_EQUIPMENT_ABILITY_DATA=data;
assert.equal(data.version,2);assert.equal(data.slotCount,3);assert.equal(data.abilities.length,20);assert.equal(data.profiles.length,6);
for(const profile of data.profiles){assert.equal(data.validateProfile(profile).ok,true);assert.equal(profile.abilityKeys.length,3);assert.equal(profile.slotChoices.length,3);}
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_weapon'}).family,'sword');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_bow'}).family,'bow');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_daggers'}).family,'dagger');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_hammer'}).family,'hammer');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'frost_staff'}).family,'frost_staff');
assert.equal(data.getProfilesByFamily('staff').length,1);
const customSword={slot:'weapon',templateId:'starter_weapon',combatAbilityKeys:['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']};
let resolved=data.resolveLoadoutForItem(customSword);assert.equal(resolved.customized,true);assert.equal(resolved.selectionStatus,'custom');assert.equal(resolved.abilityKeys[0],'weapon_guard_breaker');
const invalidSword={slot:'weapon',templateId:'starter_weapon',combatAbilityKeys:['weapon_bow_quickshot','weapon_duelist_step','weapon_royal_break']};
resolved=data.resolveLoadoutForItem(invalidSword);assert.equal(resolved.customized,false);assert.equal(resolved.selectionStatus,'invalid_fallback');assert.equal(resolved.abilityKeys[0],'weapon_vanguard_cut');

const itemCatalog=require('../src/systems/equipment-item-catalog.js');globalThis.KELO_EQUIPMENT_ITEM_CATALOG=itemCatalog;
assert.equal(itemCatalog.version,1);assert.equal(itemCatalog.templates.length,6);assert.equal(itemCatalog.marketOffers.length,6);
assert.equal(new Set(itemCatalog.templates.map(x=>x.templateId)).size,6);assert.equal(new Set(itemCatalog.templates.map(x=>x.weaponProfileId)).size,6);assert.equal(new Set(itemCatalog.marketOffers.map(x=>x.offerId)).size,6);
for(const template of itemCatalog.templates){
 assert.equal(itemCatalog.validateTemplate(template,data).ok,true);assert.equal(template.kind,'equipment');assert.equal(template.slot,'weapon');assert.ok(template.marketPrice>0);
 const item=itemCatalog.createItem(template.templateId,{id:'audit_'+template.templateId,createdAt:1});assert.equal(item.kind,'equipment');assert.equal(item.slot,'weapon');assert.equal(item.templateId,template.templateId);assert.equal(item.weaponProfileId,template.weaponProfileId);
 const loadout=data.resolveLoadoutForItem(item);assert.ok(loadout);assert.equal(loadout.profile.id,template.weaponProfileId);assert.equal(loadout.profile.family,template.family);assert.equal(loadout.abilityKeys.length,3);
}
const expectedFamilies=['sword','staff','bow','dagger','hammer','frost_staff'];assert.deepEqual(itemCatalog.templates.map(x=>x.family),expectedFamilies);

const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const catalogPos=indexSource.indexOf('src/systems/equipment-item-catalog.js'),equipmentPos=indexSource.indexOf('src/systems/equipment-system.js'),commercePos=indexSource.indexOf('src/systems/commerce-authority.js');
assert.ok(catalogPos>=0&&equipmentPos>catalogPos&&commercePos>catalogPos);
const commerceSource=fs.readFileSync(new URL('../src/systems/commerce-authority.js',import.meta.url),'utf8');
new Function(commerceSource);assert.ok(commerceSource.includes('KELO_EQUIPMENT_ITEM_CATALOG'));assert.ok(commerceSource.includes('catalog.marketOffers'));assert.ok(commerceSource.includes("listingId:'demo_listing_'+offer.offerId"));assert.ok(commerceSource.includes("!s.demoListings.some(x=>x&&x.listingId===row.listingId)"));assert.ok(!commerceSource.includes('shadow_blade_demo'));

const equipmentChannelSource=fs.readFileSync(new URL('../src/abilities/equipment-ability-channel.js',import.meta.url),'utf8');
assert(equipmentChannelSource.includes('KeloAbilities?.engine'));assert(equipmentChannelSource.includes('castSource'));assert(!equipmentChannelSource.includes('root.KeloAbilitySourceCast'));assert(!equipmentChannelSource.includes('hotbar.slots'));
let weapon={id:'eq_weapon',templateId:'starter_weapon',slot:'weapon',itemLevel:1,quality:1,grade:1};
globalThis.KeloEquipment={getEquipped:()=>[weapon]};globalThis.KeloMounts={isMounted:()=>false,getEquippedMountId:()=>null};
require('../src/abilities/equipment-ability-channel.js');
const EquipmentChannel=globalThis.KeloEquipmentAbilityChannel;let snap=EquipmentChannel.sync(true);assert.equal(EquipmentChannel.slotCount,3);assert.equal(snap.slots.length,3);assert.equal(snap.profileId,'weapon.vanguard_blade');assert.equal(snap.profileName,'Hoja de Vanguardia');assert.equal(snap.weaponFamily,'sword');assert.equal(snap.selectionStatus,'default');assert.equal(snap.customized,false);assert.deepEqual(EquipmentChannel.labels,['Q','W','E']);
let result=EquipmentChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'equipment');assert.equal(result.sourceId,'eq_weapon');assert.equal(result.sourceSlot,'Q');assert.equal(lastSource.sourceType,'equipment');assert.equal(lastSource.definition.key,'weapon_vanguard_cut');for(let i=0;i<5;i++)assert.strictEqual(stoneSlots[i],stoneRefs[i]);assert.equal(stoneSlots.length,5);assert.ok(EquipmentChannel.getRemainingCooldown(0)>0);assert.equal(stone0.cooldown,0);

weapon={...weapon,combatAbilityKeys:['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']};snap=EquipmentChannel.sync(true);assert.equal(snap.customized,true);assert.equal(snap.selectionStatus,'custom');assert.equal(snap.abilityKeys[0],'weapon_guard_breaker');assert.equal(snap.slots[0].abilityKey,'weapon_guard_breaker');result=EquipmentChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(lastSource.definition.key,'weapon_guard_breaker');for(let i=0;i<5;i++)assert.strictEqual(stoneSlots[i],stoneRefs[i]);

weapon=itemCatalog.createItem('starter_bow',{id:'eq_bow',createdAt:1});snap=EquipmentChannel.sync(true);assert.equal(snap.profileId,'weapon.longbow');assert.equal(snap.weaponFamily,'bow');assert.deepEqual(snap.abilityKeys,['weapon_bow_quickshot','weapon_bow_evasive_step','weapon_bow_arrow_rain']);

globalThis.KeloMounts={isMounted:()=>true,getEquippedMountId:()=> 'mount.training_horse',getAbilityLoadout:()=>({mounted:true,mountId:'mount.training_horse',fingerprint:'mount.training_horse|1',slots:['mount_horse_gallop','mount_horse_guard','mount_horse_trample'].map((abilityKey,slotIndex)=>({sourceType:'mount',sourceId:'mount.training_horse',slotIndex,abilityKey}))})};
result=EquipmentChannel.cast({slotIndex:1,direction:{x:1,y:0}});assert.equal(result.reason,'WEAPON_SKILLS_DISABLED_WHILE_MOUNTED');
const mountData=require('../src/mounts/mount-ability-data.js');globalThis.KELO_MOUNT_ABILITY_DATA=mountData;require('../src/mounts/mount-ability-channel.js');
const MountChannel=globalThis.KeloMountAbilityChannel;MountChannel.sync(true);assert.equal(MountChannel.slotCount,3);result=MountChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'mount');assert.equal(result.sourceSlot,'M1');assert.equal(lastSource.sourceType,'mount');assert.equal(lastSource.definition.key,'mount_horse_gallop');for(let i=0;i<5;i++)assert.strictEqual(stoneSlots[i],stoneRefs[i]);assert.equal(stoneSlots.length,5);
assert.equal(casts,3);assert.ok(globalThis.KeloEvents.events.some(e=>e.name==='KELO_ABILITY_SOURCE_CAST'&&e.payload.sourceType==='equipment'));assert.ok(globalThis.KeloEvents.events.some(e=>e.name==='KELO_ABILITY_SOURCE_CAST'&&e.payload.sourceType==='mount'));assert.equal(globalThis.KELO_EQUIPMENT_ABILITY_AUDIT.nativeSourceCast,true);assert.equal(globalThis.KELO_EQUIPMENT_ABILITY_AUDIT.legacyBridge,false);assert.equal(globalThis.KELO_MOUNT_ABILITY_AUDIT.nativeSourceCast,true);assert.equal(globalThis.KELO_MOUNT_ABILITY_AUDIT.legacyBridge,false);
console.log('KELO_EQUIPMENT_ABILITY_AUDIT=PASS');
console.log(JSON.stringify({ok:true,weaponProfiles:data.profiles.length,equipmentAbilities:data.abilities.length,weaponCatalogItems:itemCatalog.templates.length,marketWeaponOffers:itemCatalog.marketOffers.length,weaponSlots:3,mountSlots:3,stoneSlotsUntouched:stoneSlots.length,reusesAbilityEngine:true,nativeSourceCast:true,legacyBridge:false,mountMutualExclusion:true,sourceEvents:true,perItemSlotChoices:true,catalogCommerceBridge:true,families:data.profiles.map(p=>p.family)},null,2));
