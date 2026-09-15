(function () {
  const REGISTRY=window.KELO_TILE_REGISTRY;
  const ATLAS=REGISTRY?.atlases?.ruralSoil;
  const R=REGISTRY?.ruralTiles;
  const PROP_CONTRACT=window.KELO_PROP_CONTRACT;
  const GENERIC_PROPS=window.KELO_GENERIC_PROPS;
  const boundarySource=PROP_CONTRACT?.sources?.ruralFarmBoundary;
  const originalRenderFarm=window.renderFarm;
  if(!ATLAS||!R||!boundarySource||!GENERIC_PROPS||typeof originalRenderFarm!=='function'){
    console.error('[Kelo rural] soil atlas, generic prop contract, or farm renderer missing'); return;
  }
  const TILE=REGISTRY.worldTileSize||32;
  const PLOT=96;
  const GRID=Object.freeze([R.TOP_LEFT,R.TOP,R.TOP_RIGHT,R.LEFT,R.CENTER,R.RIGHT,R.BOTTOM_LEFT,R.BOTTOM,R.BOTTOM_RIGHT]);
  const sheet=new Image(); sheet.decoding='async';
  let soilReady=false;

  function origin(id,atlas){ return {x:(id%atlas.columns)*TILE,y:Math.floor(id/atlas.columns)*TILE}; }
  function tile(g,img,atlas,id,x,y){ const p=origin(id,atlas); g.drawImage(img,p.x,p.y,TILE,TILE,x,y,TILE,TILE); }
  function plot(g,x,y,index){
    for(let row=0;row<3;row++) for(let col=0;col<3;col++){
      let id=GRID[row*3+col];
      if(row===1&&col===1) id=[R.CENTER,R.CENTER_ALT_A,R.CENTER_ALT_B,R.CENTER_ALT_C][index%4];
      tile(g,sheet,ATLAS,id,x+col*TILE,y+row*TILE);
    }
  }
  function crop(g,c,x,y,now,index){
    if(!c.type) return;
    const meta=CROP_TYPES[c.type];
    const progress=Math.max(0,Math.min(1,(now-c.plantedAt)/(meta.growTime*1000)));
    const anchors=[[16,18],[48,18],[80,18],[16,50],[48,50],[80,50]];
    anchors.forEach((a,i)=>{
      const sway=((index+i)&1), px=x+a[0], py=y+a[1];
      g.fillStyle='#285f2e'; g.fillRect(px-1+sway,py+4,3,9);
      g.fillStyle=progress>=1?'#e5bd45':'#70c94f'; g.fillRect(px-5,py+2,5,3); g.fillRect(px+2,py,5,3);
      if(progress>.55){ g.fillStyle=c.type==='carrot'?'#f18b35':'#f2cf62'; g.fillRect(px-3,py-3,7,4); }
    });
  }
  function genericBoundaryReady(){return GENERIC_PROPS.ready&&GENERIC_PROPS.isAssetReady('ruralProps');}

  window.renderFarm=function(farm){
    if(!soilReady){ originalRenderFarm(farm); return; }
    const now=Date.now();
    ctx.save(); ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='rgba(22,80,49,.13)'; ctx.fillRect(farm.x-8,farm.y-8,farm.w+16,farm.h+16);
    farm.crops.forEach((c,index)=>{
      const x=farm.x+20+(index%2)*110, y=farm.y+30+Math.floor(index/2)*110;
      plot(ctx,x,y,index); crop(ctx,c,x,y,now,index);
    });
    ctx.restore();
    syncReady();
  };

  window.KELO_RURAL_GROUND_AUDIT={
    version:'rural-v2.3',ready:false,assetLoaded:false,propsLoaded:false,fallbackActive:true,
    atlas:ATLAS.src,propAtlas:PROP_CONTRACT.assets?.ruralProps?.src||null,atlasWidth:ATLAS.width,atlasHeight:ATLAS.height,
    propAtlasWidth:PROP_CONTRACT.assets?.ruralProps?.width||0,propAtlasHeight:PROP_CONTRACT.assets?.ruralProps?.height||0,tileSize:TILE,modularTiles:true,
    renderingMode:'authored-nine-slice-v1',plotSize:PLOT,boundaryMode:'environment-layer-stack-props-back-v1',
    gateSide:'north',dirtApproachTiles:1,genericPropContract:true,propContractVersion:PROP_CONTRACT.version,
    propRendererVersion:GENERIC_PROPS.version,boundarySource:boundarySource.id,immediateBoundaryDraw:false
  };
  function syncReady(){
    const a=window.KELO_RURAL_GROUND_AUDIT,propsReady=genericBoundaryReady();
    a.assetLoaded=soilReady&&propsReady;a.propsLoaded=propsReady;a.ready=soilReady&&propsReady;a.fallbackActive=!soilReady;
  }
  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){console.error('[Kelo rural] invalid soil atlas dimensions',sheet.naturalWidth,sheet.naturalHeight);return;}
    soilReady=true;syncReady();
  };
  sheet.onerror=function(){console.error('[Kelo rural] soil atlas load failed');};
  sheet.src=ATLAS.src+'&rural=173';
  function waitForGeneric(){syncReady();if(!window.KELO_RURAL_GROUND_AUDIT.ready&&!window.KELO_GENERIC_PROP_AUDIT?.failed)requestAnimationFrame(waitForGeneric);}
  waitForGeneric();
})();
