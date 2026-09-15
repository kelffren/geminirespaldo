/* KELO-INDEX
 * area: UI / MAP FORGE / IOS RECOVERY
 * owner: Map Forge launch recovery
 * purpose: if an old Safari Creator module receives the Map Forge tap but fails to mount the editor,
 *          recover by loading a fresh Map Forge UI module without changing normal Creator routing.
 * do-not: this is a fallback only; never intercept a successful normal launch.
 */
(function(){
'use strict';
if(window.KELO_MAP_FORGE_LAUNCH_RECOVERY)return;
const VERSION='map-forge-launch-recovery-v1.0.0-20260912';
let seq=0,pending=null,lastTouchAt=0;
const isMapForgeCard=node=>{
  const card=node?.closest?.('[data-workspace="map-forge"]');
  return card&&!card.disabled&&card.closest?.('#kelo-creators-hub')?card:null;
};
const mounted=()=>!!document.getElementById('kelo-map-forge');
async function freshOpen(){
  if(mounted())return true;
  const nonce=`${Date.now().toString(36)}-${(++seq).toString(36)}`;
  const mod=await import(`../creators/ui/map-forge-workspace.mjs?v=ios-recovery-${nonce}`);
  if(typeof mod.openMapForgeWorkspace!=='function')throw new Error('MAP_FORGE_RECOVERY_ENTRY_MISSING');
  const onOpenWorld=async(map,options={})=>{
    const entry=await import(`../creators/creator-entry.mjs?v=ios-recovery-world-${Date.now().toString(36)}`);
    const platform=await entry.bootKeloCreators({root:window});
    return platform.openWorkspace('world',{...options,mapDefinition:map,source:'map-forge-recovery'});
  };
  const opening=Promise.resolve(mod.openMapForgeWorkspace({root:window,onOpenWorld}));
  // The shell mounts synchronously before the first generation finishes. Do not wait for generation.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(mounted()){
    document.getElementById('kelo-creators-hub')?.remove();
    opening.catch(error=>console.error('[Map Forge recovery background]',error));
    return true;
  }
  await opening;
  if(!mounted())throw new Error('MAP_FORGE_RECOVERY_MOUNT_FAILED');
  document.getElementById('kelo-creators-hub')?.remove();
  return true;
}
function schedule(card,source){
  if(!card||mounted())return;
  if(pending)clearTimeout(pending);
  card.dataset.keloMapForgeTap='1';
  pending=setTimeout(async()=>{
    pending=null;
    if(mounted())return;
    try{
      card.setAttribute('aria-busy','true');
      await freshOpen();
    }catch(error){
      console.error('[Kelo Map Forge launch recovery]',source,error);
      window.showToast?.('Map Forge no abrió. Reintentando con entrada limpia…');
      try{await freshOpen();}catch(second){console.error('[Kelo Map Forge recovery retry]',second);window.showToast?.('No se pudo abrir Map Forge');}
    }finally{
      if(card?.isConnected)card.removeAttribute('aria-busy');
    }
  },420);
}
// pointerup is the primary iPhone path. click covers keyboard/mouse and WebKit click synthesis.
document.addEventListener('pointerup',event=>{
  const card=isMapForgeCard(event.target);if(!card)return;
  lastTouchAt=Date.now();schedule(card,'pointerup');
},true);
document.addEventListener('click',event=>{
  const card=isMapForgeCard(event.target);if(!card)return;
  if(Date.now()-lastTouchAt<700)return;
  schedule(card,'click');
},true);
window.KELO_MAP_FORGE_LAUNCH_RECOVERY=Object.freeze({version:VERSION,open:freshOpen,get pending(){return!!pending;}});
})();
