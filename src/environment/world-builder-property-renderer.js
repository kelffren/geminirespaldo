/* KELO-INDEX
 * area: WORLD BUILDER
 * keys: PROPERTY OBJECT RENDER FALLBACK RESET WORLD EDIT ATLAS DIAGNOSTICS
 * hace: dibuja placements del parcel world_editor cuando Decoration Reset suprime las capas Property normales
 * online: solo presentación; identidad, ownership y mutaciones siguen viviendo en KELO_PROPERTY_SYSTEM
 */
(function(){
'use strict';
if(window.KELO_WORLD_BUILDER_PROPERTY_RENDERER)return;
const VERSION='world-builder-property-renderer-v1.1.0';
const images=new Map(),pending=new Map(),errors=new Map();
function deps(){return{S:window.KELO_PROPERTY_SYSTEM,C:window.KELO_PROPERTY_CATALOG,A:window.KELO_ATLAS_CONTRACT};}
function acquire(key){const {A}=deps();if(!key||images.has(key)||pending.has(key)||!A?.acquire)return;errors.delete(key);const p=Promise.resolve(A.acquire(key)).then(img=>{if(img)images.set(key,img);pending.delete(key);}).catch(err=>{errors.set(key,String(err?.message||err));pending.delete(key);});pending.set(key,p);}
function warm(){const {C}=deps();if(!C)return;for(const t of C.list())for(const p of t.parts||[])acquire(p.assetKey);C.onRegister?.(t=>(t.parts||[]).forEach(p=>acquire(p.assetKey)));}
function rotatedSize(t,q){q=((Number(q)||0)%4+4)%4;return q%2?{w:t.height,h:t.width}:{w:t.width,h:t.height};}
function drawTemplate(g,t,rec,phase){const q=((Number(rec.rotation)||0)%4+4)%4,d=rotatedSize(t,q);g.save();g.translate(rec.x+d.w/2,rec.y+d.h/2);g.rotate(q*Math.PI/2);g.translate(-t.width/2,-t.height/2);let drew=false;for(const part of t.parts||[]){if(part.phase!==phase)continue;const img=images.get(part.assetKey);if(!img){acquire(part.assetKey);continue;}const src=part.source||{x:0,y:0,w:part.size?.w||t.width,h:part.size?.h||t.height},off=part.offset||{x:0,y:0},size=part.size||{w:t.width,h:t.height},a=g.globalAlpha;g.globalAlpha=a*(Number.isFinite(part.opacity)?part.opacity:1);g.drawImage(img,src.x,src.y,src.w,src.h,off.x,off.y,size.w,size.h);g.globalAlpha=a;drew=true;}if(!drew&&phase==='props_back'){g.globalAlpha=.42;g.fillStyle='#d6a83c';g.fillRect(2,2,Math.max(12,t.width-4),Math.max(12,t.height-4));g.globalAlpha=1;}g.restore();}
function drawPhase(g,phase,base){if(base?.decorationReset!==true||window.KELO_WORLD_BUILDER?.isMainWorld?.()===false)return;const {S,C}=deps();if(!S||!C)return;const p=S.parcel('parcel:world:editor');if(!p)return;const rows=S.getPlacements(p.parcelId);if(!rows.length)return;g.save();g.imageSmoothingEnabled=false;for(const rec of rows){const t=C.get(rec.assetId);if(t)drawTemplate(g,t,rec,phase);}g.restore();}
function install(){const {S,C,A}=deps();if(!S||!C||!A||!window.KELO_WORLD_RENDERER){setTimeout(install,80);return;}warm();const base=window.KELO_WORLD_RENDERER;if(base.worldBuilderPropertyRenderer)return;window.KELO_WORLD_RENDERER=Object.freeze({draw:g=>base.draw(g),drawPreActors(g){const r=typeof base.drawPreActors==='function'?base.drawPreActors(g):true;drawPhase(g,'props_back',base);return r;},drawPostActors(g){const r=typeof base.drawPostActors==='function'?base.drawPostActors(g):true;drawPhase(g,'props_front',base);return r;},districts:base.districts,chunkSize:base.chunkSize,get ready(){return base.ready!==false;},environmentLayerStack:base.environmentLayerStack,preActorLayerStack:true,postActorLayerStack:true,decorationReset:base.decorationReset,worldBuilderOverlay:base.worldBuilderOverlay,worldBuilderPropertyRenderer:true});window.KELO_WORLD_BUILDER_PROPERTY_RENDERER_AUDIT={version:VERSION,propertySourceOfTruth:true,directFallback:true,decorationResetOnly:true,atlasDiagnostics:true};}
window.KELO_WORLD_BUILDER_PROPERTY_RENDERER=Object.freeze({version:VERSION,get imageCount(){return images.size;},get readyKeys(){return Array.from(images.keys());},get pendingKeys(){return Array.from(pending.keys());},get errors(){return Object.fromEntries(errors);},retry:key=>acquire(String(key||''))});
if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',install,{once:true});
})();
