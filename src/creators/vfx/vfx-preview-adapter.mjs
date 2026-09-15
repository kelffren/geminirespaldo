/* KELO-INDEX
 * area: CREATORS / VFX PREVIEW ADAPTER
 * owner: VFX workspace preview bridge
 * owns: translation from VfxDocument to transient KeloFX preview calls
 * does-not-own: FX runtime/rendering, registry, camera, assets, gameplay or persistence
 * reuse: existing KeloFX + KeloAssetRegistry + KeloCamera/KeloVisualContext
 */
import { vfxDefinitionFromDocument } from './vfx-document.mjs';
export function createVfxPreviewAdapter(root=globalThis){
  let activeId=null;
  async function warm(document){const def=vfxDefinitionFromDocument(document);if((def.type==='static_sprite'||def.type==='sprite_animation')&&def.assetId&&root.KeloAssetRegistry?.load)await root.KeloAssetRegistry.load(def.assetId);return def;}
  function previewContext(def){
    const actorId=String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'');
    const actor=root.KeloVisualContext?.resolveActor?.(actorId)||root.localPlayer||null;
    if(def.space==='ACTOR'&&actor)return{actor,actorId,origin:{x:Number(actor.x)||0,y:Number(actor.y)||0},visual:{scale:1,seed:17}};
    const center=root.KeloCamera?.screenToWorld?.((root.innerWidth||390)/2,(root.innerHeight||844)/2)||{x:Number(actor?.x)||0,y:Number(actor?.y)||0};
    return{origin:center,target:{x:center.x+Math.max(80,Number(def.radius)||28)*2,y:center.y},visual:{scale:1,seed:17}};
  }
  async function play(document,{scale=1}={}){
    if(typeof root.KeloFX?.preview!=='function')throw new Error('KELO_FX_PREVIEW_NOT_READY');stop();const def=await warm(document),context=previewContext(def),space=def.space==='ACTOR'&&!context.actor?'WORLD':def.space;activeId=root.KeloFX.preview(def,context,{scale:Number(scale)||1,space,seed:17});if(!activeId)throw new Error('KELO_FX_PREVIEW_SPAWN_REJECTED');return activeId;
  }
  function stop(){if(!activeId)return false;const id=activeId;activeId=null;return root.KeloFX?.stop?.(id)||false;}
  return Object.freeze({version:'vfx-preview-adapter-v1.0.0',warm,play,stop,get activeId(){return activeId;}});
}
