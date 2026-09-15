(function(){
  'use strict';
  const C=window.KELO_PROP_CONTRACT;
  const G=window.KELO_GENERIC_PROPS;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  const fountain=C?.props?.find(p=>p.id==='plaza-fountain-kelo');
  if(!C||!G||!L||!fountain){console.error('[Kelo fountain audit bridge] fuentekelo generic prop unavailable');return;}
  const baseY=fountain.occlusion?.baseY||1505;
  const asset=C.assets?.plazaFountainKelo;
  const audit={
    version:'plaza-fountain-v3.0',failed:false,
    depthMode:'single-front-layer-with-actor-redraw-v1',renderWrapped:false,environmentLayerStack:true,
    postActorBridgeRestored:false,postActorBridgeAvailable:true,bridgePolicy:'generic-prop-contract-v1',
    frontLayer:'props_front',frontLayerId:'plaza-fountain-front',spatialOwnership:'plaza-fountain-kelo-v1',
    assetMode:'single-authored-png-v1',alignmentMode:'bottom-centered-on-plaza-v1',
    x:fountain.position.x,y:fountain.position.y,width:fountain.size.w,height:fountain.size.h,visualHeight:fountain.size.h,baseY,
    sourceWidth:asset?.width||0,sourceHeight:asset?.height||0,asset:asset?.src||'',collision:{...fountain.collider},
    decorationResetVisible:true,
    get ready(){return !!G.ready&&G.isAssetReady('plazaFountainKelo');},
    get loaded(){return G.isAssetReady('plazaFountainKelo');},
    get lastLocalDepth(){return (typeof localPlayer!=='undefined'&&localPlayer)?((localPlayer.y||0)>baseY?'in-front-of-front-layer':'behind-front-layer'):null;},
    get lastFrontActorRedraws(){return Number(window.KELO_GENERIC_PROP_AUDIT?.actorRedrawCountByGroup?.plazaFountain||0);},
    get frontDrawCount(){return Number(window.KELO_GENERIC_PROP_AUDIT?.frontDrawCountByGroup?.plazaFountain||0);}
  };
  window.KELO_PLAZA_FOUNTAIN_AUDIT=audit;
  if(window.KELO_PLAZA_AUDIT){
    window.KELO_PLAZA_AUDIT.fountainVersion=audit.version;
    window.KELO_PLAZA_AUDIT.fountainDepthMode=audit.depthMode;
    window.KELO_PLAZA_AUDIT.fountainAssetMode=audit.assetMode;
    Object.defineProperty(window.KELO_PLAZA_AUDIT,'fountainReady',{configurable:true,get:()=>audit.ready});
    Object.defineProperty(window.KELO_PLAZA_AUDIT,'fountainLastLocalDepth',{configurable:true,get:()=>audit.lastLocalDepth});
  }
  window.KELO_PLAZA_FOUNTAIN=Object.freeze({version:audit.version,prefab:fountain,get ready(){return audit.ready;},get failed(){return audit.failed;}});
})();
