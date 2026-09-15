(function(){
  'use strict';
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  async function boot(){
    try{
      if(!window.KELO_PROP_CONTRACT)await load('src/environment/prop-contract.js?v=2');
      if(!window.KELO_GENERIC_PROP_AUDIT)await load('src/environment/generic-props.js?v=2');
      const R=window.KELO_TILE_REGISTRY,C=window.KELO_PROP_CONTRACT,G=window.KELO_GENERIC_PROP_AUDIT;
      if(!R||!C||!G)throw new Error('generic prop contract missing after bootstrap');
      const plazaProps=C.props.filter(p=>p.layerGroup==='plazaNature');
      const audit=window.KELO_PLAZA_NATURE_AUDIT={
        version:'plaza-nature-v3.1',ready:G.ready,assetLoaded:G.ready&&!G.failed,failed:G.failed,propCount:plazaProps.length,
        depthMode:'formal-back-front-layer-stack-v1',visualOnly:true,registryVersion:R.version,environmentLayerStack:true,
        backLayer:'props_back',frontLayer:'props_front',frontClipOcclusion:true,fullActorRedraw:false,rendererWrapper:false,
        backLayerId:'plaza-nature-back',frontLayerId:'plaza-nature-front',spatialOwnership:'plaza-nature-props-v1',boundsCount:plazaProps.length,
        layerPriority:10,precedencePolicy:'nature-before-architecture-on-overlap-v1',genericPropContract:true,contractVersion:C.version,rendererMode:G.rendererMode
      };
      function sync(){audit.ready=G.ready;audit.assetLoaded=G.ready&&!G.failed;audit.failed=G.failed;if(!G.ready&&!G.failed)requestAnimationFrame(sync);}sync();
    }catch(err){console.error('[Kelo plaza nature] generic prop bootstrap failed',err);window.KELO_PLAZA_NATURE_AUDIT={version:'plaza-nature-v3.1',ready:false,assetLoaded:false,failed:true,genericPropContract:true};}
  }
  boot();
})();
