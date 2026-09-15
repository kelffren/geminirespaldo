(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const A=R?.atlases?.ruralNature;
  const T=R?.ruralNatureTiles;
  const style=R?.styles?.ruralLandmarks?.edgeVegetation;
  const baseRenderFarm=window.renderFarm;
  if(!A||!T||!style||typeof baseRenderFarm!=='function'){
    console.error('[Kelo rural landmarks] registry nature contract missing');
    return;
  }
  const TILE=R.worldTileSize||32;
  const img=new Image(); img.decoding='async';
  let ready=false;
  const placements=Object.freeze([
    // West edge: low clusters only; the crop/fence center stays visually open.
    {tile:'HEDGE_A',dx:-80,dy:72},{tile:'HEDGE_B',dx:-80,dy:104},{tile:'HEDGE_FLOWERS_A',dx:-80,dy:136},
    {tile:'TALL_GRASS',dx:-54,dy:214},{tile:'WILDFLOWERS',dx:-82,dy:246},{tile:'STONE',dx:-48,dy:278},
    // South edge: irregular rhythm, not a continuous hedge wall.
    {tile:'HEDGE_B',dx:70,dy:356},{tile:'HEDGE_FLOWERS_B',dx:102,dy:356},
    {tile:'TALL_GRASS',dx:178,dy:366},{tile:'WILDFLOWERS',dx:218,dy:356},{tile:'STUMP',dx:266,dy:366},
    {tile:'HEDGE_A',dx:342,dy:356},{tile:'HEDGE_FLOWERS_A',dx:374,dy:356},
    // East edge: sparse counterpart with deliberate negative space.
    {tile:'WILDFLOWERS',dx:504,dy:116},{tile:'HEDGE_FLOWERS_B',dx:512,dy:164},
    {tile:'TALL_GRASS',dx:510,dy:246},{tile:'STONE',dx:500,dy:286}
  ]);
  function origin(id){return{x:(id%A.columns)*TILE,y:Math.floor(id/A.columns)*TILE};}
  function drawTile(g,name,x,y){const id=T[name];if(id==null)return;const p=origin(id);g.drawImage(img,p.x,p.y,TILE,TILE,x,y,TILE,TILE);}
  function drawEdge(g,farm){
    if(!ready||!farm)return false;
    g.save();g.imageSmoothingEnabled=false;
    for(const p of placements)drawTile(g,p.tile,farm.x+p.dx,farm.y+p.dy);
    g.restore();
    return true;
  }
  window.renderFarm=function(farm){
    if(ready)drawEdge(ctx,farm);
    baseRenderFarm(farm);
  };
  window.KELO_RURAL_LANDMARK_AUDIT={
    version:'rural-edge-v1',ready:false,assetLoaded:false,failed:false,
    mode:'authored-low-profile-edge-clusters-v1',sourceAtlas:A.id||'rural-nature-v1',
    clusterTileCount:placements.length,centerClear:true,northRoadClear:true,
    roadClearance:Number(style.roadClearance)||32,treeCount:0
  };
  img.onload=function(){
    if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){
      window.KELO_RURAL_LANDMARK_AUDIT.failed=true;
      console.error('[Kelo rural landmarks] invalid nature atlas dimensions',img.naturalWidth,img.naturalHeight);
      return;
    }
    ready=true;
    window.KELO_RURAL_LANDMARK_AUDIT.ready=true;
    window.KELO_RURAL_LANDMARK_AUDIT.assetLoaded=true;
  };
  img.onerror=function(){window.KELO_RURAL_LANDMARK_AUDIT.failed=true;console.error('[Kelo rural landmarks] nature atlas load failed');};
  img.src=A.src;
  window.KELO_RURAL_EDGE_RENDERER=Object.freeze({draw:drawEdge,get ready(){return ready;},placements});
})();
