(function(root){
  'use strict';
  const VERSION='1.0.1';
  const POLICY_ID='kelo-mobile-art-performance-v1';
  const isMobile=()=>Math.min(root.innerWidth||9999,root.innerHeight||9999)<=844&&(root.innerWidth||9999)<=600;
  const deviceMemory=Math.max(0,Number(root.navigator?.deviceMemory)||0);
  const lowMemory=deviceMemory>0&&deviceMemory<=2;
  const mobile=isMobile();
  const BUDGETS=Object.freeze(mobile?{
    dprCap:lowMemory?1.5:2,
    // The world renderer uses 512px chunks. With a one-chunk cull margin an iPhone
    // viewport can require ~20 chunks at once while the old cache only retained 12.
    // That creates an endless build -> evict -> rebuild loop on Safari's main thread.
    // Keep the mobile working set resident and do not pre-render an off-screen margin.
    chunkCacheCap:24,
    chunkCullMarginChunks:0,
    decodedTextureMB:lowMemory?24:40,
    residentDistrictAtlases:lowMemory?4:6,
    canvasMegapixels:lowMemory?0.9:1.5
  }:{
    dprCap:3,
    chunkCacheCap:24,
    chunkCullMarginChunks:1,
    decodedTextureMB:96,
    residentDistrictAtlases:10,
    canvasMegapixels:8
  });
  function canvasAudit(){
    const canvas=document.getElementById('game-canvas');
    const pixels=canvas?canvas.width*canvas.height:0;
    return {width:canvas?.width||0,height:canvas?.height||0,megapixels:pixels/1e6,withinBudget:!pixels||pixels/1e6<=BUDGETS.canvasMegapixels+0.05};
  }
  function snapshot(){
    const atlas=root.KELO_ATLAS_AUDIT||{};
    const world=root.KELO_WORLD_AUDIT||{};
    const canvas=canvasAudit();
    const violations=[];
    if(Number(atlas.decodedTextureMB||0)>BUDGETS.decodedTextureMB)violations.push('decoded-texture-budget');
    if(Number(atlas.residentDistrictAtlasCount||0)>BUDGETS.residentDistrictAtlases)violations.push('resident-district-atlas-budget');
    if(Number(world.chunkCacheSize||0)>BUDGETS.chunkCacheCap)violations.push('chunk-cache-budget');
    if(!canvas.withinBudget)violations.push('canvas-pixel-budget');
    return Object.freeze({version:VERSION,policyId:POLICY_ID,mobile,lowMemory,deviceMemory:deviceMemory||null,budgets:BUDGETS,canvas:Object.freeze(canvas),atlasDecodedTextureMB:Number(atlas.decodedTextureMB||0),residentDistrictAtlasCount:Number(atlas.residentDistrictAtlasCount||0),chunkCacheSize:Number(world.chunkCacheSize||0),violations:Object.freeze(violations)});
  }
  const api=Object.freeze({version:VERSION,policyId:POLICY_ID,mobile,lowMemory,budgets:BUDGETS,get dprCap(){return BUDGETS.dprCap},get chunkCacheCap(){return BUDGETS.chunkCacheCap},snapshot});
  root.KELO_MOBILE_PERFORMANCE_CONTRACT=api;
  root.KELO_MOBILE_PERFORMANCE_AUDIT=snapshot();
  const refresh=()=>{root.KELO_MOBILE_PERFORMANCE_AUDIT=snapshot()};
  root.addEventListener('resize',refresh,{passive:true});
  root.addEventListener('kelo:atlas-audit',refresh);
  root.addEventListener('kelo:world-audit',refresh);
})(typeof globalThis!=='undefined'?globalThis:window);
