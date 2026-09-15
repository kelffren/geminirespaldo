/* KELO-INDEX
 * area: CREATORS / VFX DOCUMENT
 * owner: VFX workspace document schema
 * owns: editable transient KeloFX definition data only
 * does-not-own: FX rendering/runtime, assets, gameplay, persistence or networking
 * reuse: StudioKernel documentModel + existing KeloFX/KeloAssetRegistry
 */
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const uid=prefix=>`${prefix}:${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const VFX_TYPES=Object.freeze(['ring','decal','glow','flash','burst','lightning','particle_emitter','trail','beam','static_sprite','sprite_animation']);
export const VFX_SPACES=Object.freeze(['WORLD','ACTOR','SCREEN']);
export const VFX_LAYERS=Object.freeze(['groundFX','worldFX','aboveActors','screenFX']);
export const VFX_SOCKETS=Object.freeze(['center','foot','ground','chest','head','hand','weapon','castOrigin','target']);
export function normalizeVfxDocument(input={}){
  const source=input.definition||input,rawType=String(source.type||'burst').toLowerCase(),type=VFX_TYPES.includes(rawType)?rawType:'burst',space=String(source.space||'WORLD').toUpperCase();
  return {
    schema:1,documentType:'VFX',documentId:String(input.documentId||uid('vfx-document')),
    definition:{
      id:String(source.id||'vfx_effect'),type,duration:Math.max(.02,finite(source.duration,.35)),loop:source.loop===true,
      space:VFX_SPACES.includes(space)?space:'WORLD',layer:String(source.layer||'worldFX'),socket:String(source.socket||'center'),
      color:String(source.color||'#7fd7ff'),accent:String(source.accent||'#ffffff'),alpha:clamp(finite(source.alpha,.85),0,1),radius:Math.max(1,finite(source.radius,28)),rays:Math.max(1,Math.round(finite(source.rays,8))),particleCount:Math.max(1,Math.min(32,Math.round(finite(source.particleCount,12)))),
      assetId:source.assetId==null?null:String(source.assetId),frames:Math.max(1,Math.round(finite(source.frames,4))),fps:Math.max(.001,finite(source.fps,12)),frameWidth:Math.max(1,Math.round(finite(source.frameWidth,64))),frameHeight:Math.max(1,Math.round(finite(source.frameHeight,64))),columns:Math.max(1,Math.round(finite(source.columns,4))),rows:Math.max(1,Math.round(finite(source.rows,1))),
      width:Math.max(1,finite(source.width,64)),height:Math.max(1,finite(source.height,64)),offsetX:finite(source.offsetX,0),offsetY:finite(source.offsetY,0),fadeOut:source.fadeOut!==false
    },
    meta:{createdAt:finite(input.meta?.createdAt,Date.now()),updatedAt:finite(input.meta?.updatedAt,Date.now())}
  };
}
export const vfxDocumentModel=Object.freeze({id:'vfx',normalize:normalizeVfxDocument,chunkSize:()=>512,rebuildSpatial(){},syncCommand(){}});
export function vfxDefinitionFromDocument(document){return Object.freeze(copy(normalizeVfxDocument(document).definition));}
export function validateVfxDocument(document,{assetRegistry=null}={}){
  const doc=normalizeVfxDocument(document),def=doc.definition,errors=[],warnings=[];
  if(!def.id.trim())errors.push('VFX_ID_REQUIRED');
  if(!VFX_TYPES.includes(def.type))errors.push(`VFX_TYPE_INVALID:${def.type}`);
  if(def.duration<=0)errors.push('VFX_DURATION_INVALID');
  if(def.alpha<0||def.alpha>1)errors.push('VFX_ALPHA_INVALID');
  if(def.type==='static_sprite'||def.type==='sprite_animation'){
    if(!def.assetId)errors.push('VFX_ASSET_REQUIRED');
    else if(assetRegistry?.get&&!assetRegistry.get(def.assetId))errors.push(`VFX_ASSET_NOT_FOUND:${def.assetId}`);
    if(def.type==='sprite_animation'&&(def.frames<1||def.fps<=0||def.frameWidth<1||def.frameHeight<1))errors.push('VFX_SPRITE_TIMING_INVALID');
  }
  if(def.space==='ACTOR'&&!VFX_SOCKETS.includes(def.socket))warnings.push(`VFX_SOCKET_CUSTOM:${def.socket}`);
  return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors),warnings:Object.freeze(warnings)});
}
