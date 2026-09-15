(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY;
const GC=R?.styles?.gardensCompositions;
const A=R?.atlases?.gardensTJunctions;
const L=window.KELO_ENVIRONMENT_LAYERS;
if(!GC||!A||GC.tJunctionAtlas?.id!==A.id||!L||typeof L.register!=='function'){console.error('[Kelo gardens junctions] registry or environment layer contract missing');return;}
const TILE=R.worldTileSize||32;
const ORIGIN_X=33,ORIGIN_Y=67;
const placements=[];
for(const comp of GC.compositions||[]){
  for(const cell of comp.cells||[]){
    if(String(cell[2]||'').indexOf('HEDGE_T_')===0){
      placements.push(Object.freeze({lx:cell[0],ly:cell[1],orientation:((Number(cell[3])||0)%4+4)%4,id:cell[2]}));
    }
  }
}
const spatialBounds=()=>placements.map((p,i)=>({id:`gardens-t-${i}-${p.id}`,x:(ORIGIN_X+p.lx)*TILE,y:(ORIGIN_Y+p.ly)*TILE,w:TILE,h:TILE}));
const img=new Image();
let assetReady=false;
window.KELO_GARDENS_JUNCTION_AUDIT={
  version:'gardens-junction-layer-v4',ready:false,assetLoaded:false,mode:'formal-props-back-t-junction-layer-v1',
  atlasId:A.id,registryKey:'gardensTJunctions',registryOwned:true,atlasWidth:A.width,atlasHeight:A.height,orientationCount:Object.keys(A.orientations||{}).length,placementCount:placements.length,
  authoredPlacementCount:placements.length,legacyVirtualOwnership:false,ownership:'tile-registry-formal-layer-v1',spatialOwnership:'gardens-t-junctions-v1',spatialBoundsCount:placements.length,layerStackVersion:L.version,layerId:'gardens-t-junctions',layerPhase:'props_back',localOrigin:Object.freeze([ORIGIN_X,ORIGIN_Y])
};
function drawLayer(g){
  if(!assetReady||!placements.length)return;
  const prev=g.imageSmoothingEnabled;g.imageSmoothingEnabled=false;
  for(const p of placements){
    const sx=p.orientation*TILE,wx=(ORIGIN_X+p.lx)*TILE,wy=(ORIGIN_Y+p.ly)*TILE;
    g.drawImage(img,sx,0,TILE,TILE,wx,wy,TILE,TILE);
  }
  g.imageSmoothingEnabled=prev;
}
L.register({id:'gardens-t-junctions',phase:'props_back',priority:20,required:true,ready:()=>assetReady,draw:drawLayer,ownership:'gardens-t-junctions-v1',bounds:spatialBounds});
img.onload=function(){
  if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){console.error('[Kelo gardens junctions] invalid atlas dimensions',img.naturalWidth,img.naturalHeight);return;}
  assetReady=true;Object.assign(window.KELO_GARDENS_JUNCTION_AUDIT,{ready:true,assetLoaded:true});
};
img.onerror=function(){console.error('[Kelo gardens junctions] atlas load failed');};
img.src=A.src;
})();
