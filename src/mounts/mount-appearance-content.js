/* KELO-INDEX
 * area: MOUNTS / APPEARANCE CONTENT
 * owner: declarative appearance content; KeloAppearance sigue siendo owner del contrato
 * purpose: perfiles anatómicos horse/wolf y outfits de prueba para Creator/runtime
 * public-api: registration side-effect sobre KeloAppearance
 * consumes: KeloAppearance
 * online: cosmetic ownership via IDs; presentation local
 * do-not: no aplicar stats; no dibujar; no crear renderer paralelo
 */
(function(root){'use strict';if(!root?.KeloAppearance){console.error('Mount appearance requires KeloAppearance');return;}const A=root.KeloAppearance;
const profiles=[
{id:'appearance.mount.horse.standard',targetType:'mount',slots:['body','head','neck','saddle','armor','back','legs','feet','tail','aura','accessory'],anchors:{rider:{x:0,y:-20},head:{x:0,y:-34},saddle:{x:0,y:-12},back:{x:-4,y:-15},effectOrigin:{x:18,y:-18},shadow:{x:0,y:10}},depthRules:{down:{body:10,saddle:20,armor:22,head:25,aura:40},up:{head:8,body:10,saddle:15,armor:18,aura:40}},directionRules:{faces:['down','left','right','up']},animationRules:{motions:['idle','walk','run','mount','dismount','ability1','ability2','ability3']},tags:['mount','horse']},
{id:'appearance.mount.wolf.standard',targetType:'mount',slots:['body','head','neck','harness','armor','back','paws','tail','aura','accessory'],anchors:{rider:{x:0,y:-17},head:{x:4,y:-28},back:{x:-5,y:-13},effectOrigin:{x:17,y:-14},shadow:{x:0,y:9}},depthRules:{down:{body:10,harness:20,armor:22,head:25,aura:40},up:{head:8,body:10,harness:15,armor:18,aura:40}},directionRules:{faces:['down','left','right','up']},animationRules:{motions:['idle','walk','run','mount','dismount','ability1','ability2','ability3']},tags:['mount','wolf']}
];
for(const p of profiles)if(!A.getProfile(p.id))A.registerProfile(p);
const items=[
{id:'outfit.mount.royal_crown',displayName:'Corona Real de Montura',targetType:'mount',slotId:'head',compatibleProfiles:['appearance.mount.horse.standard'],assetBundleId:'outfit.mount.royal_crown',transforms:{default:{x:0,y:-2,scaleX:1,scaleY:1}},layerRules:{depth:25},rarity:'epic',tags:['royal','head']},
{id:'outfit.mount.shadow_aura',displayName:'Aura Umbral',targetType:'mount',slotId:'aura',compatibleProfiles:['appearance.mount.wolf.standard'],assetBundleId:'outfit.mount.shadow_aura',transforms:{default:{x:0,y:0,scaleX:1,scaleY:1}},layerRules:{depth:40},rarity:'legendary',tags:['aura','shadow']}
];
for(const i of items)if(!A.getItem(i.id))A.registerItem(i);
root.KELO_MOUNT_APPEARANCE_CONTENT=Object.freeze({version:'mount-appearance-content-v1.0.0',profiles:profiles.map(p=>p.id),items:items.map(i=>i.id)});
})(typeof globalThis!=='undefined'?globalThis:this);