(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const A=R?.atlases?.districtDecals;
  const T=R?.districtDecalTiles;
  const style=R?.styles?.districtDecals;
  const layers=window.KELO_ENVIRONMENT_LAYERS;
  if(!A||!T||!style||!layers||typeof layers.register!=='function'){
    console.error('[Kelo district decals] registry or environment layer stack missing');
    return;
  }
  const TILE=R.worldTileSize||32;
  const img=new Image(); img.decoding='async';
  let ready=false,failed=false;
  const placements=Array.isArray(style.placements)?style.placements:[];
  const bounds=Object.freeze(placements.map((p,i)=>Object.freeze({id:`${p.district}-${i}`,x:p.x,y:p.y,w:TILE,h:TILE})));
  function origin(id){return{x:(id%A.columns)*TILE,y:Math.floor(id/A.columns)*TILE};}
  function drawOverlay(g){
    if(!ready)return false;
    const z=window.CONFIG?.zoom||1;
    const cam=window.camera||{x:1440,y:1520};
    const hw=(window.screenW||innerWidth)/(2*z)+64;
    const hh=(window.screenH||innerHeight)/(2*z)+64;
    const minX=cam.x-hw,maxX=cam.x+hw,minY=cam.y-hh,maxY=cam.y+hh;
    let visible=0;
    g.save();g.imageSmoothingEnabled=false;
    for(const p of placements){
      if(p.x+TILE<minX||p.x>maxX||p.y+TILE<minY||p.y>maxY)continue;
      const id=T[p.tile];if(id==null)continue;
      const s=origin(id);
      g.drawImage(img,s.x,s.y,TILE,TILE,p.x,p.y,TILE,TILE);
      visible++;
    }
    g.restore();
    window.KELO_DISTRICT_DECAL_AUDIT.visiblePlacementCount=visible;
    return true;
  }
  layers.register({id:'district-decals',phase:'decals_details',priority:20,required:true,ownership:style.ownership||'registry-authored-district-decals-v1',bounds,draw:drawOverlay,ready:()=>ready&&!failed});
  window.KELO_DISTRICT_DECAL_AUDIT={
    version:'district-decals-v2',ready:false,assetLoaded:false,failed:false,
    mode:'formal-layer-stack-v1',layer:'decals_details',placementCount:placements.length,visiblePlacementCount:0,
    boundsCount:bounds.length,ownership:style.ownership||'registry-authored-district-decals-v1',
    atlas:A.id,registryVersion:R.version,rendererWrapper:false,environmentLayerStack:true
  };
  img.onload=function(){
    if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){
      failed=true;window.KELO_DISTRICT_DECAL_AUDIT.failed=true;
      console.error('[Kelo district decals] invalid atlas dimensions',img.naturalWidth,img.naturalHeight);return;
    }
    ready=true;window.KELO_DISTRICT_DECAL_AUDIT.ready=true;window.KELO_DISTRICT_DECAL_AUDIT.assetLoaded=true;
  };
  img.onerror=function(){failed=true;window.KELO_DISTRICT_DECAL_AUDIT.failed=true;console.error('[Kelo district decals] atlas load failed');};
  img.src=A.src;
})();
