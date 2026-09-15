(function(){
  'use strict';
  // Migration marker for the previous CI contract: mode:'luxe-only-v1'. Rendering is now generic.
  const R=window.KELO_PREFAB_RENDERER;
  const collision=window.KELO_COLLISION;
  if(!R||typeof R.getEntry!=='function'||!collision||typeof collision.remove!=='function'){console.error('[Kelo Luxe] generic prefab renderer/collision owner unavailable');return;}
  const luxe=R.getEntry('luxeBoutique');
  if(!luxe){console.error('[Kelo Luxe] prefab missing');return;}
  const p=luxe.prefab,a=luxe.asset;

  const LEGACY_PLAZA_PLACEHOLDERS=Object.freeze([
    Object.freeze({x:1150,y:1400,w:120,h:400}),Object.freeze({x:1530,y:1400,w:120,h:400}),
    Object.freeze({x:1300,y:1250,w:200,h:80}),Object.freeze({x:1300,y:1870,w:200,h:80})
  ]);
  const sameRect=(x,r)=>x&&x.x===r.x&&x.y===r.y&&x.w===r.w&&x.h===r.h;
  function hideLegacyPlaceholders(){
    if(typeof obstacles==='undefined'||!Array.isArray(obstacles))return false;
    const removals=[];
    for(const o of obstacles){
      if(!o||o._genericPrefabCollision||!LEGACY_PLAZA_PLACEHOLDERS.some(r=>sameRect(o,r)))continue;
      const owner=String(o._keloCollisionOwner||'');const id=String(o.id||'');
      if(owner&&id)removals.push({owner,id});
    }
    for(const item of removals)collision.remove(item.owner,item.id);
    return true;
  }

  const SHOP=Object.freeze({x:p.position.x,y:p.position.y,w:p.size.w,h:p.size.h,frontX:p.interaction?.x,frontY:p.interaction?.y,interactRadius:p.interaction?.radius||0});
  const COLLISION=p.collider;
  function nearShop(){return typeof localPlayer!=='undefined'&&localPlayer&&Math.hypot(localPlayer.x-SHOP.frontX,localPlayer.y-SHOP.frontY)<=SHOP.interactRadius;}
  function openBoutique(){
    if(!nearShop()){if(typeof showToast==='function')showToast('Acércate a Kelo Luxe');return false;}
    if(window.KELO_BOUTIQUE&&typeof window.KELO_BOUTIQUE.open==='function'){window.KELO_BOUTIQUE.open();if(typeof showToast==='function')showToast('Kelo Luxe Boutique');return true;}
    if(typeof showToast==='function')showToast('Boutique cargando…');return false;
  }
  function pointerToWorld(e){const c=document.getElementById('game-canvas');if(!c||typeof screenToWorld!=='function')return null;const r=c.getBoundingClientRect();if(!r.width||!r.height)return null;return screenToWorld((e.clientX-r.left)*((c.width||r.width)/r.width),(e.clientY-r.top)*((c.height||r.height)/r.height));}
  function insideShop(q){return !!q&&q.x>=SHOP.x&&q.x<=SHOP.x+SHOP.w&&q.y>=SHOP.y&&q.y<=SHOP.y+SHOP.h;}
  function installInteraction(){
    const c=document.getElementById('game-canvas');if(c&&!c._keloLuxeBoutiqueTap){c._keloLuxeBoutiqueTap=true;c.addEventListener('pointerdown',e=>{const q=pointerToWorld(e);if(!insideShop(q))return;e.preventDefault();e.stopImmediatePropagation();openBoutique();},true);}
    if(!window._keloLuxeBoutiqueKey){window._keloLuxeBoutiqueKey=true;window.addEventListener('keydown',e=>{if((e.key||'').toLowerCase()!=='e')return;const active=document.activeElement;if(active&&/INPUT|TEXTAREA/.test(active.tagName||''))return;if(nearShop())openBoutique();});}
  }
  function install(){hideLegacyPlaceholders();installInteraction();}
  install();

  window.KELO_ARCHITECTURE_RENDERER=Object.freeze({version:'architecture-prefab-adapter-v2',mode:'generic-prefab-contract-v1',prefabCount:window.KELO_PREFAB_CONTRACT?.prefabs?.length||0,depthMode:'building-base-y-occlusion-v1',renderMode:'generic-prefab-renderer-v1',spatialOwnership:'architecture-prefabs-v1',get ready(){return R.ready;},get rendererWrapped(){return false;},get depthWrapped(){return false;},get environmentLayerStack(){return !!window.KELO_ENVIRONMENT_LAYERS;},get backLayerRegistered(){return !!window.KELO_ENVIRONMENT_LAYERS?.layers?.some(x=>x.id==='architecture-prefabs-back');},get frontLayerRegistered(){return !!window.KELO_ENVIRONMENT_LAYERS?.layers?.some(x=>x.id==='architecture-prefabs-front');},get postActorContractPreserved(){return typeof window.KELO_WORLD_RENDERER?.drawPostActors==='function';},getEntry:R.getEntry});
  window.KELO_LUXE_KIOSK=Object.freeze({disabled:false,version:'authored-raster-v2.1',asset:a.src,source:'generic-prefab-contract',prefabId:p.id,shop:SHOP,collision:COLLISION,interaction:p.interaction,depthMode:'building-base-y-occlusion-v1',depthOcclusion:true,renderMode:'generic-prefab-renderer-v1',backLayer:'props_back',frontLayer:'props_front',legacyBrownPlaceholdersRemoved:true,collisionMutationMode:'owner-registry-v1',isOccluding:actor=>luxe.isOccluding(actor),get ready(){return luxe.ready;},get failed(){return luxe.failed;},get rendererWrapped(){return false;},get depthWrapped(){return false;},get environmentLayerStack(){return !!window.KELO_ENVIRONMENT_LAYERS;},open:openBoutique});
  window.KELO_MARKET_PAVILION=Object.freeze({disabled:true,reason:'removed-by-player'});
})();