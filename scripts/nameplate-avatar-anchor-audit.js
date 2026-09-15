/* KELO-INDEX
 * area: TEST / AVATAR / IDENTITY
 * owner: deterministic contract audit; production owner remains KeloActorNameplate
 * keys: NAMEPLATE AVATAR ANCHOR SCALE COLLIDER BOUNDS TEST
 * purpose: verifica que el nameplate siga la presentación visual y no el radio del collider
 * online: N/A; prueba presentación local/remota sin mutar gameplay
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.resolve(__dirname,'../src/ui/player-nameplate.js'),'utf8');
let middleware=null;
const box={console,Math,Number,Object,Array,String,Boolean,JSON};
box.globalThis=box;box.window=box;
box.KeloAvatar={use(id,fn,priority){middleware={id,fn,priority};return id;}};
let visualScale=1.15;
box.KELO_AVATAR_PRESENTATION={get(actor){const visualHeight=Math.round(81*visualScale);return{nameplateAnchorX:actor.x,nameplateAnchorY:actor.y+10-visualHeight-6,visualScale,visualHeight};}};
vm.createContext(box);vm.runInContext(source,box,{filename:'player-nameplate.js'});
if(!box.KeloActorNameplate||!middleware)throw new Error('NAMEPLATE_OWNER_NOT_READY');
const actor={x:100,y:200,radius:20,name:'Kelo',_face:'right'};
const base=box.KeloActorNameplate.anchorFor(actor);
actor.radius=30;
const radiusChanged=box.KeloActorNameplate.anchorFor(actor);
visualScale=1.20;
const scaled=box.KeloActorNameplate.anchorFor(actor);
const radiusDelta=Math.hypot(radiusChanged.x-base.x,radiusChanged.y-base.y);
const scaleDeltaY=scaled.y-radiusChanged.y;
if(base.source!=='avatar-presentation')throw new Error('NAMEPLATE_NOT_USING_SEMANTIC_ANCHOR');
if(radiusDelta!==0)throw new Error('NAMEPLATE_MOVED_WITH_COLLIDER:'+radiusDelta);
if(!(scaleDeltaY<0))throw new Error('NAMEPLATE_DID_NOT_FOLLOW_VISUAL_SCALE:'+scaleDeltaY);
const fallbackBox={console,Math,Number,Object,Array,String,Boolean,JSON};fallbackBox.globalThis=fallbackBox;fallbackBox.window=fallbackBox;fallbackBox.KeloAvatar={use(){return'fallback';}};vm.createContext(fallbackBox);vm.runInContext(source,fallbackBox,{filename:'player-nameplate-fallback.js'});
const fallback=fallbackBox.KeloActorNameplate.anchorFor({x:100,y:200,radius:20,name:'Kelo'});
if(fallback.source!=='collider-fallback'||fallback.y!==161)throw new Error('LEGACY_FALLBACK_BROKEN');
console.log(JSON.stringify({status:'NAMEPLATE_AVATAR_ANCHOR_OK',semanticSource:base.source,colliderRadius20To30DeltaPx:radiusDelta,scale115To120AnchorDeltaYPx:scaleDeltaY,legacyFallbackY:fallback.y,middlewarePriority:middleware.priority},null,2));