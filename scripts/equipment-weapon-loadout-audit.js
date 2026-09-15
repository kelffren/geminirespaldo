/* KELO-INDEX
 * area: TESTS / EQUIPMENT ABILITIES
 * owner: Equipment Ability contracts
 * keys: WEAPON LOADOUT Q W E SLOTCHOICES BACKPACK ONLINE AUTHORITY
 * purpose: protege selección Q/W/E, rechazo cross-family, reset, hidratación server y ownership UI
 * consumes: KELO_EQUIPMENT_ABILITY_DATA, KeloEquipment, KeloEquipmentAbilityChannel
 * state-owned: ninguno; harness VM efímero
 * do-not: no implementar gameplay ni autoridad aquí
 */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let saves=0,syncs=0,online=false;
function CustomEvent(type,opts){this.type=type;this.detail=opts&&opts.detail;}
const events=[];
const context={
 console,Date,Math,Map,Set,Object,Array,Number,String,JSON,Promise,CustomEvent,
 STATE:{inventory:[{id:'audit_sword',templateId:'starter_weapon',name:'Audit Sword',slot:'weapon',kind:'equipment',itemLevel:1,quality:1,grade:1,baseStats:{attack:12},specialStats:{attackPct:2}}],equipmentSlots:{weapon:'audit_sword'}},
 localPlayer:{id:'audit_player',baseAttack:100,baseDefense:50,baseMaxHp:100,maxHp:100},
 saveState(){saves++;},
 dispatchEvent(ev){events.push(ev);return true;},addEventListener(){},
 KeloEvents:{emit(name,payload){events.push({type:name,detail:payload});}},
 KeloStats:{registerSource(){},markDirty(){},resolve(_target,base){return{stats:base,revision:1};}},
 KeloNetAuthority:{isOnline(){return online;},syncEquipment(){syncs++;return Promise.resolve({ok:true});}},
 KeloEquipmentAbilityChannel:{sync(force){assert.equal(force,true);return{ok:true};}},
 window:null,keloNet:{on:false}
};
context.window=context;vm.createContext(context);
for(const file of ['src/abilities/equipment-ability-data.js','src/systems/equipment-system.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const E=context.KeloEquipment,D=context.KELO_EQUIPMENT_ABILITY_DATA;
assert(E&&D,'Equipment and ability data must load');assert.equal(E.version,'equipment-v1.3.0');
let load=E.getWeaponAbilityLoadout('audit_sword');assert(load.ok);assert.equal(load.profileId,'weapon.vanguard_blade');assert.deepEqual(Array.from(load.abilityKeys),['weapon_vanguard_cut','weapon_duelist_step','weapon_royal_break']);assert.equal(load.customized,false);assert.equal(load.slotChoices[0].length,2);
let r=E.setWeaponAbilityLoadout('audit_sword',['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']);assert(r.ok);assert.equal(r.customized,true);assert.deepEqual(Array.from(context.STATE.inventory.find(x=>x.id==='audit_sword').combatAbilityKeys),['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']);assert(events.some(x=>x.type==='EQUIPMENT_WEAPON_LOADOUT_CHANGED'));
r=E.setWeaponAbilityLoadout('audit_sword',['weapon_bow_quickshot','weapon_duelist_step','weapon_royal_break']);assert.equal(r.ok,false);assert.equal(r.error,'ABILITY_NOT_ALLOWED_IN_SLOT');assert.equal(r.slotIndex,0);assert.equal(context.STATE.inventory.find(x=>x.id==='audit_sword').combatAbilityKeys[0],'weapon_guard_breaker');
r=E.resetWeaponAbilityLoadout('audit_sword');assert(r.ok);assert.equal(r.customized,false);assert.equal(Object.prototype.hasOwnProperty.call(context.STATE.inventory.find(x=>x.id==='audit_sword'),'combatAbilityKeys'),false,'default kit should not persist redundant customization');
online=true;const before=JSON.stringify(context.STATE.inventory.find(x=>x.id==='audit_sword'));r=E.setWeaponAbilityLoadout('audit_sword',['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']);assert.equal(r.ok,false);assert.equal(r.error,'ONLINE_AUTHORITY_REQUIRED');assert.equal(JSON.stringify(context.STATE.inventory.find(x=>x.id==='audit_sword')),before,'online client must not mutate competitive loadout');online=false;
E.applyServerItem({id:'audit_sword',weaponProfileId:'weapon.vanguard_blade',combatAbilityKeys:['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']});load=E.getWeaponAbilityLoadout('audit_sword');assert(load.ok&&load.customized);assert.equal(load.abilityKeys[0],'weapon_guard_breaker','authoritative server item may hydrate approved loadout');
E.recalculate(context.localPlayer);const weaponSummary=context.localPlayer.equipmentSummary.find(x=>x.slot==='weapon');assert(weaponSummary);assert.equal(weaponSummary.templateId,'starter_weapon');assert.equal(weaponSummary.weaponProfileId,'weapon.vanguard_blade');assert.equal(weaponSummary.combatAbilityKeys[0],'weapon_guard_breaker');
const ui=fs.readFileSync('src/ui/backpack-ui.js','utf8');new Function(ui);assert(ui.includes("backpack-ui-v2.2.0"));assert(ui.includes('getWeaponAbilityLoadout'));assert(ui.includes('setWeaponAbilityLoadout'));assert(ui.includes('resetWeaponAbilityLoadout'));assert(ui.includes('HABILIDADES DEL ARMA'));assert(ui.includes('data-weapon-skill-editor'));assert(!/combatAbilityKeys\s*=/.test(ui),'Backpack UI must never write combatAbilityKeys directly');
assert(context.KELO_EQUIPMENT_AUDIT.weaponAbilityLoadoutOwner===true);assert(context.KELO_EQUIPMENT_AUDIT.weaponAbilitySlotChoiceValidation===true);assert(context.KELO_EQUIPMENT_AUDIT.weaponAbilityOnlineAuthorityGate===true);assert(saves>0);assert(syncs>0);
console.log('PASS equipment-weapon-loadout-audit',JSON.stringify({equipment:E.version,profile:load.profileId,allowedQ:load.slotChoices[0].length,invalidCrossFamilyRejected:true,resetToDefault:true,onlineClientMutationBlocked:true,serverHydration:true,uiUsesEquipmentOwner:true,directUiWrites:false,saves,syncs}));