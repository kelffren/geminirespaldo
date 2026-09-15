/* KELO-INDEX
 * area: SYSTEMS / EQUIPMENT CONTENT
 * owner: content only; KeloEquipment owns equipped state, KeloCommerceAuthority owns purchases
 * keys: EQUIPMENT ITEM CATALOG WEAPON TEMPLATE MARKET PROFILE
 * purpose: fuente data-driven reutilizable para materializar armas reales sin hardcodear familias en Equipment/Commerce
 * public-api: KELO_EQUIPMENT_ITEM_CATALOG
 * consumes: none at runtime; profile IDs must resolve through KELO_EQUIPMENT_ABILITY_DATA
 * state-owned: none
 * extension-points: add weapon template + optional offline market offer
 * online: templateId/weaponProfileId are stable semantic IDs for server-side validation/catalogs
 * do-not: no inventory mutation, no gold mutation, no equip mutation, no commerce execution
 */
(function(root,factory){
'use strict';
const api=factory();
if(root)root.KELO_EQUIPMENT_ITEM_CATALOG=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const F=Object.freeze;
function freezeStats(stats){return F(Object.assign({attack:0,defense:0,hp:0},stats||{}));}
function freezeSpecial(stats){return F(Object.assign({attackPct:0,defensePct:0,hpPct:0},stats||{}));}
function weapon(def){return F(Object.assign({kind:'equipment',slot:'weapon',quantity:1,maxStack:1,itemLevel:1,quality:1,grade:1,durability:100,maxDurability:100,bound:false,rarity:'Normal'},def,{baseStats:freezeStats(def.baseStats),specialStats:freezeSpecial(def.specialStats)}));}
const templates=F([
 weapon({templateId:'starter_weapon',weaponProfileId:'weapon.vanguard_blade',family:'sword',name:'Espada del Viajero',icon:'⚔️',baseStats:{attack:12},specialStats:{attackPct:2},marketPrice:90,tags:F(['starter','melee','duelist'])}),
 weapon({templateId:'arcane_staff',weaponProfileId:'weapon.arcane_staff',family:'staff',name:'Bastón Arcano',icon:'✦',baseStats:{attack:11},specialStats:{attackPct:2},marketPrice:135,rarity:'Uncommon',tags:F(['ranged','magic','pressure'])}),
 weapon({templateId:'starter_bow',weaponProfileId:'weapon.longbow',family:'bow',name:'Arco Largo',icon:'🏹',baseStats:{attack:11},specialStats:{attackPct:2},marketPrice:120,rarity:'Uncommon',tags:F(['ranged','physical','kite'])}),
 weapon({templateId:'starter_daggers',weaponProfileId:'weapon.shadow_daggers',family:'dagger',name:'Dagas de Sombra',icon:'🗡️',baseStats:{attack:13},specialStats:{attackPct:2},marketPrice:125,rarity:'Uncommon',tags:F(['melee','assassin','burst'])}),
 weapon({templateId:'starter_hammer',weaponProfileId:'weapon.war_hammer',family:'hammer',name:'Martillo de Guerra',icon:'🔨',baseStats:{attack:10,defense:2,hp:8},specialStats:{defensePct:1},marketPrice:130,rarity:'Uncommon',tags:F(['melee','tank','control'])}),
 weapon({templateId:'frost_staff',weaponProfileId:'weapon.frost_staff',family:'frost_staff',name:'Bastón Glacial',icon:'❄️',baseStats:{attack:10},specialStats:{attackPct:2},marketPrice:145,rarity:'Rare',tags:F(['ranged','magic','control'])})
]);
const byTemplate=new Map(templates.map(x=>[x.templateId,x]));
const marketOffers=F(templates.map((x,index)=>F({offerId:'armory_weapon_'+String(index+1).padStart(2,'0'),templateId:x.templateId,price:x.marketPrice})));
function get(templateId){return byTemplate.get(String(templateId||''))||null;}
function list(){return templates.slice();}
function listByFamily(family){const f=String(family||'');return templates.filter(x=>x.family===f);}
function createItem(templateId,overrides){
 const def=get(templateId);if(!def)return null;
 const out={};Object.keys(def).forEach(k=>{if(k==='tags')out.tags=Array.from(def.tags||[]);else if(k==='baseStats'||k==='specialStats')out[k]=Object.assign({},def[k]);else out[k]=def[k];});
 Object.assign(out,overrides||{});
 out.templateId=def.templateId;out.weaponProfileId=def.weaponProfileId;out.family=def.family;out.kind='equipment';out.slot='weapon';
 out.quantity=1;out.maxStack=1;out.itemLevel=Math.max(1,Math.floor(Number(out.itemLevel)||1));out.quality=Math.max(1,Math.floor(Number(out.quality)||1));out.grade=Math.max(1,Math.floor(Number(out.grade)||1));
 out.durability=Math.max(0,Number.isFinite(Number(out.durability))?Number(out.durability):100);out.maxDurability=Math.max(out.durability,Number.isFinite(Number(out.maxDurability))?Number(out.maxDurability):100);
 if(!out.id)out.id='weapon_'+def.templateId+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
 if(!out.createdAt)out.createdAt=Date.now();
 return out;
}
function validateTemplate(def,abilityData){
 if(!def||def.kind!=='equipment'||def.slot!=='weapon'||!def.templateId||!def.weaponProfileId||!def.family)return{ok:false,reason:'INVALID_WEAPON_TEMPLATE'};
 if(!Number.isFinite(Number(def.marketPrice))||Number(def.marketPrice)<1)return{ok:false,reason:'INVALID_MARKET_PRICE'};
 if(abilityData){const profile=abilityData.getProfile?.(def.weaponProfileId);if(!profile)return{ok:false,reason:'UNKNOWN_WEAPON_PROFILE'};if(profile.family!==def.family)return{ok:false,reason:'FAMILY_PROFILE_MISMATCH'};const resolved=abilityData.resolveProfileForItem?.(def);if(!resolved||resolved.id!==def.weaponProfileId)return{ok:false,reason:'PROFILE_RESOLUTION_MISMATCH'};}
 return{ok:true};
}
return F({version:1,templates,marketOffers,get,list,listByFamily,createItem,validateTemplate});
});
