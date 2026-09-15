/* KELO-INDEX
 * area: MOUNTS / ABILITY DATA
 * owner: mount ability content only; KeloAbilities sigue siendo runtime owner
 * purpose: catálogo de habilidades exclusivas de montura sin contaminar KeloStones
 * public-api: KELO_MOUNT_ABILITY_DATA
 * consumes: delivery/effect primitives soportados por KeloAbilities
 * online: IDs estables para authority/cast validation
 * do-not: no crear MountAbilityEngine; no añadir estas definitions al StoneSystem
 */
(function(root,factory){const data=factory();if(root)root.KELO_MOUNT_ABILITY_DATA=data;if(typeof module==='object'&&module.exports)module.exports=data;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const A=Object.freeze([
Object.freeze({id:1001,key:'mount_horse_gallop',name:'Galope',icon:'🐎',sourceType:'mount',slotType:'mount',role:'mobility',targeting:Object.freeze({type:'direction',range:220}),resource:Object.freeze({type:'mana',cost:0}),cooldown:6,delivery:Object.freeze({type:'dash',distance:220,duration:.28}),effects:Object.freeze([]),visuals:Object.freeze({color:'#e7c56a',fx:'mount_gallop'})}),
Object.freeze({id:1002,key:'mount_horse_guard',name:'Guardia Real',icon:'🛡️',sourceType:'mount',slotType:'mount',role:'defense',targeting:Object.freeze({type:'self'}),resource:Object.freeze({type:'mana',cost:0}),cooldown:14,delivery:Object.freeze({type:'instant'}),effects:Object.freeze([Object.freeze({type:'shield',amount:45,duration:4})]),visuals:Object.freeze({color:'#f1d58a',fx:'mount_guard'})}),
Object.freeze({id:1003,key:'mount_horse_trample',name:'Pisotón',icon:'💥',sourceType:'mount',slotType:'mount',role:'control',targeting:Object.freeze({type:'self'}),resource:Object.freeze({type:'mana',cost:0}),cooldown:10,delivery:Object.freeze({type:'self_aoe',radius:95}),effects:Object.freeze([Object.freeze({type:'damage',damageType:'physical',amount:18}),Object.freeze({type:'status',status:'slow',duration:1.5,magnitude:.25})]),visuals:Object.freeze({color:'#c5a56a',fx:'mount_trample'})}),
Object.freeze({id:1011,key:'mount_wolf_pounce',name:'Abalanzarse',icon:'🐺',sourceType:'mount',slotType:'mount',role:'mobility',targeting:Object.freeze({type:'direction',range:185}),resource:Object.freeze({type:'mana',cost:0}),cooldown:5,delivery:Object.freeze({type:'dash',distance:185,duration:.2}),effects:Object.freeze([]),visuals:Object.freeze({color:'#9c8cff',fx:'mount_pounce'})}),
Object.freeze({id:1012,key:'mount_wolf_howl',name:'Aullido Umbral',icon:'🌙',sourceType:'mount',slotType:'mount',role:'control',targeting:Object.freeze({type:'self'}),resource:Object.freeze({type:'mana',cost:0}),cooldown:12,delivery:Object.freeze({type:'self_aoe',radius:125}),effects:Object.freeze([Object.freeze({type:'damage',damageType:'shadow',amount:14}),Object.freeze({type:'status',status:'slow',duration:2,magnitude:.35})]),visuals:Object.freeze({color:'#7059d9',fx:'mount_howl'})}),
Object.freeze({id:1013,key:'mount_wolf_shadow_run',name:'Carrera Sombría',icon:'🌑',sourceType:'mount',slotType:'mount',role:'mobility',targeting:Object.freeze({type:'direction',range:150}),resource:Object.freeze({type:'mana',cost:0}),cooldown:9,delivery:Object.freeze({type:'blink',distance:150}),effects:Object.freeze([]),visuals:Object.freeze({color:'#4b3b8f',fx:'mount_shadow_run'})})
]);
return Object.freeze({version:1,abilities:A});});