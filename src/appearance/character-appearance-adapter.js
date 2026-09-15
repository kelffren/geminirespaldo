/* KELO-INDEX
 * area: APPEARANCE / CHARACTER ADAPTER
 * owner: compatibility adapter between KeloCharacterSlotSchema and KeloAppearance
 * purpose: expone el perfil character humano usando los 24 slots/orden del owner existente sin migrarlo
 * public-api: KeloCharacterAppearanceAdapter.install/profileId
 * consumes: KeloCharacterSlotSchema, KeloAppearance
 * state-owned: ninguno
 * online: N/A; solo contrato visual IDs-only
 * legacy: CharacterCustomization sigue siendo owner de su estado/render actual
 * do-not: no duplicar slots; no reemplazar CharacterCustomization; no stats
 */
(function(root){'use strict';const PROFILE_ID='appearance.character.human.standard';function install(){const A=root.KeloAppearance,S=root.KeloCharacterSlotSchema;if(!A||!S)return{ok:false,error:'DEPENDENCY_NOT_READY'};if(A.getProfile(PROFILE_ID))return{ok:true,profile:A.getProfile(PROFILE_ID),existing:true};const depthRules={};for(const face of ['down','left','right','up']){depthRules[face]={};S.orderFor(face).forEach((slot,index)=>{depthRules[face][slot]=index;});}const profile=A.registerProfile({id:PROFILE_ID,targetType:'character',slots:S.slots.slice(),anchors:{root:{x:0,y:0},head:{x:0,y:-42},back:{x:0,y:-24},weaponMain:{x:13,y:-18},weaponSecondary:{x:-13,y:-18},effectOrigin:{x:0,y:-26},shadow:{x:0,y:9}},depthRules,directionRules:{faces:['down','left','right','up']},animationRules:{motions:['idle','walk','run','attack','hit','death']},tags:['character','human','adapter']});return{ok:true,profile,existing:false};}root.KeloCharacterAppearanceAdapter=Object.freeze({version:'character-appearance-adapter-v1.0.0',profileId:PROFILE_ID,install});root.KELO_CHARACTER_APPEARANCE_ADAPTER_AUDIT=Object.freeze({version:'character-appearance-adapter-v1.0.0',preservesCharacterOwner:true,duplicatesSlots:false,autoInstalled:install().ok});})(typeof globalThis!=='undefined'?globalThis:window);