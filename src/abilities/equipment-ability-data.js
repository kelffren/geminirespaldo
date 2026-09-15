/* KELO-INDEX
 * area: ABILITIES / EQUIPMENT CONTENT
 * owner: equipment ability content only; KeloAbilities remains runtime owner
 * keys: EQUIPMENT WEAPON FAMILY Q W E ABILITY DATA SLOT CHOICES LOADOUT
 * purpose: define familias de arma y sus tres técnicas Q/W/E sin contaminar KeloStones
 * public-api: KELO_EQUIPMENT_ABILITY_DATA + CommonJS export
 * consumes: delivery/effect primitives soportados por KeloAbilities
 * state-owned: ninguno
 * extension-points: añadir AbilityDefinition + WeaponProfile + template binding + slotChoices
 * online: IDs/keys/profile IDs/loadout estable para validar arma equipada y cast en servidor
 * do-not: no crear WeaponAbilityEngine, no añadir estas definitions a STATE.equipped ni KeloStones
 */
(function(root,factory){const data=factory();if(root)root.KELO_EQUIPMENT_ABILITY_DATA=data;if(typeof module==='object'&&module.exports)module.exports=data;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const F=Object.freeze;
const abilities=F([
 F({id:2001,key:'weapon_vanguard_cut',name:'Corte de Vanguardia',icon:'⚔️',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:F({type:'self'}),resource:F({type:'mana',cost:4}),cooldown:2.2,delivery:F({type:'self_aoe',radius:72}),effects:F([F({type:'damage',damageType:'physical',amount:14})]),visuals:F({color:'#e7c56a',fx:'weapon_vanguard_cut'})}),
 F({id:2002,key:'weapon_duelist_step',name:'Paso del Duelista',icon:'💨',sourceType:'equipment',slotType:'weapon',role:'mobility',targeting:F({type:'direction',range:125}),resource:F({type:'mana',cost:5}),cooldown:6,delivery:F({type:'dash',distance:125,duration:.16}),effects:F([]),visuals:F({color:'#f1d58a',fx:'weapon_duelist_step'})}),
 F({id:2003,key:'weapon_royal_break',name:'Ruptura Real',icon:'💥',sourceType:'equipment',slotType:'weapon',role:'control',targeting:F({type:'self'}),resource:F({type:'mana',cost:10}),cooldown:11,delivery:F({type:'self_aoe',radius:96}),effects:F([F({type:'damage',damageType:'physical',amount:24}),F({type:'status',status:'slow',duration:1.4,magnitude:.3})]),visuals:F({color:'#d6b45f',fx:'weapon_royal_break'})}),
 F({id:2004,key:'weapon_guard_breaker',name:'Rompeguardia',icon:'🗡️',sourceType:'equipment',slotType:'weapon',role:'pressure',targeting:F({type:'self'}),resource:F({type:'mana',cost:6}),cooldown:3.8,delivery:F({type:'self_aoe',radius:78}),effects:F([F({type:'damage',damageType:'physical',amount:18}),F({type:'status',status:'slow',duration:.8,magnitude:.18})]),visuals:F({color:'#f0c96b',fx:'weapon_guard_breaker'})}),

 F({id:2011,key:'weapon_arcane_bolt',name:'Proyectil Arcano',icon:'✦',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:F({type:'direction',range:420}),resource:F({type:'mana',cost:5}),cooldown:2.4,delivery:F({type:'projectile',speed:650,maxDistance:420,radius:7,maxTargets:1}),effects:F([F({type:'damage',damageType:'arcane',amount:13})]),visuals:F({color:'#9c8cff',fx:'weapon_arcane_bolt'})}),
 F({id:2012,key:'weapon_arcane_shift',name:'Salto Arcano',icon:'◇',sourceType:'equipment',slotType:'weapon',role:'mobility',targeting:F({type:'direction',range:145}),resource:F({type:'mana',cost:8}),cooldown:8,delivery:F({type:'blink',distance:145}),effects:F([]),visuals:F({color:'#7c65df',fx:'weapon_arcane_shift'})}),
 F({id:2013,key:'weapon_arcane_tempest',name:'Tempestad Arcana',icon:'✹',sourceType:'equipment',slotType:'weapon',role:'pressure',targeting:F({type:'position',range:330}),resource:F({type:'mana',cost:15}),cooldown:14,delivery:F({type:'persistent_area',radius:105,duration:3,tickInterval:.75}),effects:F([F({type:'damage',damageType:'arcane',amount:8,perTick:true})]),visuals:F({color:'#7059d9',fx:'weapon_arcane_tempest'})}),

 F({id:2021,key:'weapon_bow_quickshot',name:'Disparo Rápido',icon:'🏹',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:F({type:'direction',range:500}),resource:F({type:'mana',cost:4}),cooldown:1.9,delivery:F({type:'projectile',speed:820,maxDistance:500,radius:6,maxTargets:1}),effects:F([F({type:'damage',damageType:'physical',amount:12})]),visuals:F({color:'#9ed36a',fx:'weapon_bow_quickshot'})}),
 F({id:2022,key:'weapon_bow_evasive_step',name:'Paso Evasivo',icon:'🍃',sourceType:'equipment',slotType:'weapon',role:'mobility',targeting:F({type:'direction',range:150}),resource:F({type:'mana',cost:6}),cooldown:7,delivery:F({type:'dash',distance:150,duration:.18}),effects:F([]),visuals:F({color:'#80bd5b',fx:'weapon_bow_evasive_step'})}),
 F({id:2023,key:'weapon_bow_arrow_rain',name:'Lluvia de Flechas',icon:'🌧️',sourceType:'equipment',slotType:'weapon',role:'pressure',targeting:F({type:'position',range:430}),resource:F({type:'mana',cost:14}),cooldown:13,delivery:F({type:'persistent_area',radius:118,duration:3.2,tickInterval:.8}),effects:F([F({type:'damage',damageType:'physical',amount:7,perTick:true})]),visuals:F({color:'#6aa94b',fx:'weapon_bow_arrow_rain'})}),
 F({id:2024,key:'weapon_bow_piercing_arrow',name:'Flecha Perforante',icon:'➶',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:F({type:'direction',range:560}),resource:F({type:'mana',cost:7}),cooldown:4.4,delivery:F({type:'projectile',speed:900,maxDistance:560,radius:7,maxTargets:2,pierceCount:1}),effects:F([F({type:'damage',damageType:'physical',amount:16})]),visuals:F({color:'#b3dd72',fx:'weapon_bow_piercing_arrow'})}),

 F({id:2031,key:'weapon_dagger_blade_flurry',name:'Ráfaga de Hojas',icon:'🗡️',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:F({type:'self'}),resource:F({type:'mana',cost:5}),cooldown:2.5,delivery:F({type:'self_aoe',radius:64}),effects:F([F({type:'damage',damageType:'physical',amount:15})]),visuals:F({color:'#d6d9e0',fx:'weapon_dagger_blade_flurry'})}),
 F({id:2032,key:'weapon_dagger_shadow_dash',name:'Paso Sombrío',icon:'🌑',sourceType:'equipment',slotType:'weapon',role:'mobility',targeting:F({type:'direction',range:170}),resource:F({type:'mana',cost:7}),cooldown:7.5,delivery:F({type:'dash',distance:170,duration:.13}),effects:F([]),visuals:F({color:'#7c6e91',fx:'weapon_dagger_shadow_dash'})}),
 F({id:2033,key:'weapon_dagger_execution',name:'Círculo de Ejecución',icon:'☠️',sourceType:'equipment',slotType:'weapon',role:'burst',targeting:F({type:'self'}),resource:F({type:'mana',cost:13}),cooldown:12,delivery:F({type:'self_aoe',radius:82}),effects:F([F({type:'damage',damageType:'physical',amount:29}),F({type:'status',status:'slow',duration:1,magnitude:.22})]),visuals:F({color:'#8f7ba8',fx:'weapon_dagger_execution'})}),

 F({id:2041,key:'weapon_hammer_ground_slam',name:'Golpe de Tierra',icon:'🔨',sourceType:'equipment',slotType:'weapon',role:'control',targeting:F({type:'self'}),resource:F({type:'mana',cost:6}),cooldown:3.5,delivery:F({type:'self_aoe',radius:86}),effects:F([F({type:'damage',damageType:'physical',amount:16}),F({type:'status',status:'slow',duration:1.1,magnitude:.28})]),visuals:F({color:'#c49b63',fx:'weapon_hammer_ground_slam'})}),
 F({id:2042,key:'weapon_hammer_bull_charge',name:'Carga del Toro',icon:'🐂',sourceType:'equipment',slotType:'weapon',role:'engage',targeting:F({type:'direction',range:185}),resource:F({type:'mana',cost:8}),cooldown:9,delivery:F({type:'dash',distance:185,duration:.22}),effects:F([]),visuals:F({color:'#b48652',fx:'weapon_hammer_bull_charge'})}),
 F({id:2043,key:'weapon_hammer_quake',name:'Terremoto',icon:'🌋',sourceType:'equipment',slotType:'weapon',role:'pressure',targeting:F({type:'self'}),resource:F({type:'mana',cost:15}),cooldown:15,delivery:F({type:'persistent_area',radius:125,duration:3,tickInterval:.75}),effects:F([F({type:'damage',damageType:'physical',amount:8,perTick:true}),F({type:'status',status:'slow',duration:.9,magnitude:.2,perTick:true})]),visuals:F({color:'#a87345',fx:'weapon_hammer_quake'})}),

 F({id:2051,key:'weapon_frost_shard',name:'Esquirla de Hielo',icon:'❄️',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:F({type:'direction',range:470}),resource:F({type:'mana',cost:5}),cooldown:2.3,delivery:F({type:'projectile',speed:720,maxDistance:470,radius:8,maxTargets:1}),effects:F([F({type:'damage',damageType:'frost',amount:12}),F({type:'status',status:'slow',duration:1,magnitude:.16})]),visuals:F({color:'#8fd7ff',fx:'weapon_frost_shard'})}),
 F({id:2052,key:'weapon_frost_step',name:'Paso Glacial',icon:'🧊',sourceType:'equipment',slotType:'weapon',role:'mobility',targeting:F({type:'direction',range:140}),resource:F({type:'mana',cost:8}),cooldown:8,delivery:F({type:'blink',distance:140}),effects:F([]),visuals:F({color:'#72c4f2',fx:'weapon_frost_step'})}),
 F({id:2053,key:'weapon_frost_field',name:'Campo Glacial',icon:'🌨️',sourceType:'equipment',slotType:'weapon',role:'control',targeting:F({type:'position',range:350}),resource:F({type:'mana',cost:15}),cooldown:14.5,delivery:F({type:'persistent_area',radius:112,duration:3.4,tickInterval:.85}),effects:F([F({type:'damage',damageType:'frost',amount:7,perTick:true}),F({type:'status',status:'slow',duration:1.1,magnitude:.24,perTick:true})]),visuals:F({color:'#5fb9e8',fx:'weapon_frost_field'})})
]);

function choices(q,w,e){return F([F(q.slice()),F(w.slice()),F(e.slice())]);}
const profiles=F([
 F({id:'weapon.vanguard_blade',family:'sword',displayName:'Hoja de Vanguardia',abilityKeys:F(['weapon_vanguard_cut','weapon_duelist_step','weapon_royal_break']),slotChoices:choices(['weapon_vanguard_cut','weapon_guard_breaker'],['weapon_duelist_step'],['weapon_royal_break']),tags:F(['melee','starter','duelist'])}),
 F({id:'weapon.arcane_staff',family:'staff',displayName:'Bastón Arcano',abilityKeys:F(['weapon_arcane_bolt','weapon_arcane_shift','weapon_arcane_tempest']),slotChoices:choices(['weapon_arcane_bolt'],['weapon_arcane_shift'],['weapon_arcane_tempest']),tags:F(['ranged','magic','pressure'])}),
 F({id:'weapon.longbow',family:'bow',displayName:'Arco Largo',abilityKeys:F(['weapon_bow_quickshot','weapon_bow_evasive_step','weapon_bow_arrow_rain']),slotChoices:choices(['weapon_bow_quickshot','weapon_bow_piercing_arrow'],['weapon_bow_evasive_step'],['weapon_bow_arrow_rain']),tags:F(['ranged','physical','kite'])}),
 F({id:'weapon.shadow_daggers',family:'dagger',displayName:'Dagas de Sombra',abilityKeys:F(['weapon_dagger_blade_flurry','weapon_dagger_shadow_dash','weapon_dagger_execution']),slotChoices:choices(['weapon_dagger_blade_flurry'],['weapon_dagger_shadow_dash'],['weapon_dagger_execution']),tags:F(['melee','assassin','burst'])}),
 F({id:'weapon.war_hammer',family:'hammer',displayName:'Martillo de Guerra',abilityKeys:F(['weapon_hammer_ground_slam','weapon_hammer_bull_charge','weapon_hammer_quake']),slotChoices:choices(['weapon_hammer_ground_slam'],['weapon_hammer_bull_charge'],['weapon_hammer_quake']),tags:F(['melee','tank','control'])}),
 F({id:'weapon.frost_staff',family:'frost_staff',displayName:'Bastón Glacial',abilityKeys:F(['weapon_frost_shard','weapon_frost_step','weapon_frost_field']),slotChoices:choices(['weapon_frost_shard'],['weapon_frost_step'],['weapon_frost_field']),tags:F(['ranged','magic','control'])})
]);

const templateBindings=F({
 'starter_weapon':'weapon.vanguard_blade',
 'vanguard_blade':'weapon.vanguard_blade',
 'arcane_staff':'weapon.arcane_staff',
 'starter_bow':'weapon.longbow',
 'longbow':'weapon.longbow',
 'starter_daggers':'weapon.shadow_daggers',
 'shadow_daggers':'weapon.shadow_daggers',
 'starter_hammer':'weapon.war_hammer',
 'war_hammer':'weapon.war_hammer',
 'frost_staff':'weapon.frost_staff'
});

const byKey=new Map(abilities.map(def=>[def.key,def])),byId=new Map(abilities.map(def=>[def.id,def])),profileById=new Map(profiles.map(profile=>[profile.id,profile]));
function getAbility(keyOrId){return Number.isFinite(Number(keyOrId))&&byId.has(Number(keyOrId))?byId.get(Number(keyOrId)):byKey.get(String(keyOrId||''))||null;}
function getProfile(id){return profileById.get(String(id||''))||null;}
function getProfilesByFamily(family){const f=String(family||'');return profiles.filter(profile=>profile.family===f);}
function resolveProfileForItem(item){if(!item||item.slot!=='weapon')return null;const explicit=item.weaponProfileId||item.combatProfileId||null,profileId=explicit||templateBindings[String(item.templateId||'')];return getProfile(profileId);}
function validateProfile(profile){
 if(!profile||!profile.id||!profile.family||!Array.isArray(profile.abilityKeys)||profile.abilityKeys.length!==3)return{ok:false,reason:'INVALID_PROFILE'};
 if(profile.abilityKeys.some(key=>!byKey.has(key)))return{ok:false,reason:'UNKNOWN_ABILITY'};
 const slotChoices=profile.slotChoices||profile.abilityKeys.map(key=>[key]);
 if(!Array.isArray(slotChoices)||slotChoices.length!==3||slotChoices.some(list=>!Array.isArray(list)||!list.length))return{ok:false,reason:'INVALID_SLOT_CHOICES'};
 for(let i=0;i<3;i++){if(slotChoices[i].some(key=>!byKey.has(key)))return{ok:false,reason:'UNKNOWN_SLOT_ABILITY'};if(!slotChoices[i].includes(profile.abilityKeys[i]))return{ok:false,reason:'DEFAULT_NOT_ALLOWED'};}
 return{ok:true};
}
function normalizeRequestedAbilityKeys(item){
 const raw=item&&(item.combatAbilityKeys||item.weaponAbilityKeys);if(!raw)return null;
 if(Array.isArray(raw))return raw.length===3?raw.map(key=>String(key||'')):null;
 if(typeof raw==='object')return [raw.Q??raw.q,raw.W??raw.w,raw.E??raw.e].map(key=>String(key||''));
 return null;
}
function validateLoadout(profile,abilityKeys){
 const validProfile=validateProfile(profile);if(!validProfile.ok)return validProfile;
 if(!Array.isArray(abilityKeys)||abilityKeys.length!==3)return{ok:false,reason:'INVALID_LOADOUT'};
 const slotChoices=profile.slotChoices||profile.abilityKeys.map(key=>[key]);
 for(let i=0;i<3;i++){const key=String(abilityKeys[i]||'');if(!byKey.has(key))return{ok:false,reason:'UNKNOWN_ABILITY',slotIndex:i};if(!slotChoices[i].includes(key))return{ok:false,reason:'ABILITY_NOT_ALLOWED_IN_SLOT',slotIndex:i};}
 return{ok:true};
}
function resolveLoadoutForItem(item){
 const profile=resolveProfileForItem(item);if(!profile)return null;
 const requested=normalizeRequestedAbilityKeys(item),defaults=profile.abilityKeys.slice();
 if(!requested)return F({profile,abilityKeys:F(defaults),customized:false,selectionStatus:'default'});
 const validation=validateLoadout(profile,requested);
 if(!validation.ok)return F({profile,abilityKeys:F(defaults),customized:false,selectionStatus:'invalid_fallback',selectionError:validation.reason});
 const customized=requested.some((key,i)=>key!==defaults[i]);
 return F({profile,abilityKeys:F(requested.slice()),customized,selectionStatus:customized?'custom':'default'});
}
return F({version:2,slotCount:3,abilities,profiles,templateBindings,getAbility,getProfile,getProfilesByFamily,resolveProfileForItem,resolveLoadoutForItem,validateProfile,validateLoadout});});
