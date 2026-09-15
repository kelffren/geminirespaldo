/* KELO-INDEX
 * area: LEGACY PLAZA GROUND / AIM PRESENTATION
 * owner: plaza ground legacy; frame extension owned by KeloRender; viewport owned by KeloCamera
 * keys: PLAZA ATLAS LANDING RENDER CAMERA FOUNDATION
 * purpose: conserva ground authored y landing marker sin envolver render ni poseer Canvas/viewport
 * public-api: KELO_PLAZA_TILESET, KELO_PLAZA_AUDIT
 * consumes: KeloRender, KeloCamera viewport policy, tile registry, world renderer, skillAim
 * state-owned: atlas images + baked layers
 * extension-points: KeloRender.afterFrame
 * reuse: contenido de plaza debe ir al registry/world renderer; viewport y DPR se delegan a KeloCamera
 * legacy: castAimedSkill y world-renderer decorator pendientes de consolidación
 * do-not: NO envolver render; NO escribir canvas.width/height, resize o CONFIG.zoom
 */
(function () {
  // LIVE owner: plaza tiles + aimed-skill landing marker. Viewport/HiDPI belongs to KeloCamera.
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  const REGISTRY = window.KELO_TILE_REGISTRY;
  const collision=window.KELO_COLLISION;
  if (!REGISTRY?.atlases?.plaza || !REGISTRY?.atlases?.plazaGround || !REGISTRY?.atlases?.transitions || !REGISTRY?.tiles || !REGISTRY?.families || !REGISTRY?.transitionMasks) {
    console.error('[Kelo plaza] visual registry missing authored ground or transition metadata');
    return;
  }
  if(!collision||typeof collision.remove!=='function'){
    console.error('[Kelo plaza] collision owner registry missing');
    return;
  }
  const ATLAS = REGISTRY.atlases.plaza;
  const GROUND_ATLAS = REGISTRY.atlases.plazaGround;
  const TRANSITION_ATLAS = REGISTRY.atlases.transitions;
  const TILE = REGISTRY.worldTileSize;
  const COLS = ATLAS.columns;
  const T = REGISTRY.tiles;
  const F = REGISTRY.families;
  const TRANSITION_MASKS = REGISTRY.transitionMasks;

  window.KELO_PLAZA_AUDIT = {
    version: 'V5.94-collision-owner-registry',
    ready: false,
    assetLoaded: false,
    groundAssetLoaded: false,
    fallbackActive: true,
    renderingMode: 'authored-plaza-ground-v1',
    registryVersion: REGISTRY.version,
    atlas: ATLAS.src,
    groundAsset: GROUND_ATLAS.src,
    groundWidth: GROUND_ATLAS.width,
    groundHeight: GROUND_ATLAS.height,
    worldLayerWrapped: false,
    preActorContractPreserved: false,
    postActorContractPreserved: false,
    transitionAtlas: TRANSITION_ATLAS.src,
    atlasWidth: ATLAS.width,
    atlasHeight: ATLAS.height,
    tileSize: TILE,
    layeredTransitions: true,
    authoredTransitions: true,
    propsDisabled: true,
    decorationReset: window.KELO_WORLD_DECORATION_RESET === true,
    decorationResetSuppressed: window.KELO_WORLD_DECORATION_RESET === true,
    renderOwner:'KeloRender',
    viewportOwner:'KeloCamera',
    directViewportWrites:false,
    collisionMutationMode:'collision-owner-registry-v1',
    collisionRemovals:0
  };

  function inPlaza(o) {
    const x=o.x||0, y=o.y||0, w=o.w||o.width||0, h=o.h||o.height||0;
    return x < PLAZA.x+PLAZA.w && x+w > PLAZA.x && y < PLAZA.y+PLAZA.h && y+h > PLAZA.y;
  }
  function clearPlazaColliders(){
    if(!Array.isArray(obstacles))return 0;
    const removals=[];
    for(const o of obstacles){
      if(!o||!inPlaza(o))continue;
      const owner=String(o._keloCollisionOwner||'');const id=String(o.id||'');
      if(owner&&id)removals.push({owner,id});
      else console.warn('[Kelo plaza] unowned collider in plaza left untouched',o);
    }
    for(const item of removals)collision.remove(item.owner,item.id);
    window.KELO_PLAZA_AUDIT.collisionRemovals=removals.length;
    return removals.length;
  }
  clearPlazaColliders();

  let floorLayer=null, transitionLayer=null, propLayer=null;
  let baseLoaded=false, transitionsLoaded=false, groundLoaded=false;
  const sheet=new Image();
  const groundSheet=new Image();
  const transitionSheet=new Image();
  sheet.decoding='async';
  groundSheet.decoding='async';
  transitionSheet.decoding='async';

  function origin(id){ return {x:(id%COLS)*TILE,y:Math.floor(id/COLS)*TILE}; }
  function drawTile(g,id,dx,dy){
    const p=origin(id);
    g.drawImage(sheet,p.x,p.y,TILE,TILE,dx,dy,TILE,TILE);
  }
  function transitionOrigin(id){
    return {x:(id%TRANSITION_ATLAS.columns)*TILE,y:Math.floor(id/TRANSITION_ATLAS.columns)*TILE};
  }
  function drawTransitionTile(g,id,dx,dy){
    const p=transitionOrigin(id);
    g.drawImage(transitionSheet,p.x,p.y,TILE,TILE,dx,dy,TILE,TILE);
  }
  function pick(gx,gy,list){
    const n=Math.abs(((gx+17)*73856093)^((gy+29)*19349663));
    return list[n%list.length];
  }

  function buildFallback() {
    const c=document.createElement('canvas'); c.width=PLAZA.w; c.height=PLAZA.h;
    const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
    const cols=Math.ceil(PLAZA.w/TILE), rows=Math.ceil(PLAZA.h/TILE);
    const cx=Math.floor(cols/2), cy=Math.floor(rows/2);
    for(let gy=0;gy<rows;gy++) for(let gx=0;gx<cols;gx++) {
      const dx=Math.abs(gx-cx), dy=Math.abs(gy-cy);
      const marble=(dx<=5&&dy<=4)||dx<=1||dy<=1;
      g.fillStyle=marble ? (((gx+gy)&1)?'#f4efd9':'#fff9e9') : (((gx*3+gy)&1)?'#55d83c':'#49c934');
      g.fillRect(gx*TILE,gy*TILE,TILE,TILE);
    }
    floorLayer=c; transitionLayer=null; propLayer=null;
    window.KELO_PLAZA_AUDIT.ready=true;
  }

  function bakeAtlas() {
    if(!baseLoaded || !transitionsLoaded) return;
    const cols=Math.ceil(PLAZA.w/TILE), rows=Math.ceil(PLAZA.h/TILE);
    const cx=Math.floor(cols/2), cy=Math.floor(rows/2);
    const floor=document.createElement('canvas'); floor.width=PLAZA.w; floor.height=PLAZA.h;
    const fg=floor.getContext('2d'); fg.imageSmoothingEnabled=false;
    const marbleMask=Array.from({length:rows},()=>Array(cols).fill(false));

    function isMarbleCell(gx,gy){
      if(gx<0||gy<0||gx>=cols||gy>=rows) return false;
      return marbleMask[gy][gx];
    }

    for(let gy=0;gy<rows;gy++) for(let gx=0;gx<cols;gx++) {
      const dx=Math.abs(gx-cx), dy=Math.abs(gy-cy);
      const inSquare=dx<=5&&dy<=4;
      const marble=inSquare||dx<=1||dy<=1;
      marbleMask[gy][gx]=marble;
      let id;
      if(marble) id=pick(gx,gy,F.marble);
      else {
        id=pick(gx,gy,F.grass);
        if(((gx*11+gy*7)%29)===0) id=pick(gx,gy,F.grassDetail);
      }
      drawTile(fg,id,gx*TILE,gy*TILE);
    }
    drawTile(fg,T.MARBLE_GREEN_CENTER,cx*TILE,cy*TILE);

    const transitions=document.createElement('canvas'); transitions.width=PLAZA.w; transitions.height=PLAZA.h;
    const tg=transitions.getContext('2d'); tg.imageSmoothingEnabled=false;
    for(let gy=0;gy<rows;gy++) for(let gx=0;gx<cols;gx++) {
      if(!isMarbleCell(gx,gy)) continue;
      let mask=0;
      if(!isMarbleCell(gx,gy-1)) mask|=1;
      if(!isMarbleCell(gx+1,gy)) mask|=2;
      if(!isMarbleCell(gx,gy+1)) mask|=4;
      if(!isMarbleCell(gx-1,gy)) mask|=8;
      if(mask===0) continue;
      const transitionId=TRANSITION_MASKS[mask];
      if(transitionId==null) continue;
      drawTransitionTile(tg,transitionId,gx*TILE,gy*TILE);
    }

    if(groundLoaded) return;
    floorLayer=floor; transitionLayer=transitions; propLayer=null;
    window.KELO_PLAZA_AUDIT.ready=true;
    window.KELO_PLAZA_AUDIT.assetLoaded=true;
    window.KELO_PLAZA_AUDIT.fallbackActive=true;
  }

  buildFallback();
  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){
      console.error('[Kelo plaza] invalid tileset dimensions',sheet.naturalWidth,sheet.naturalHeight,'expected',ATLAS.width,ATLAS.height); return;
    }
    baseLoaded=true; bakeAtlas();
  };
  transitionSheet.onload=function(){
    if(transitionSheet.naturalWidth!==TRANSITION_ATLAS.width||transitionSheet.naturalHeight!==TRANSITION_ATLAS.height){
      console.error('[Kelo plaza] invalid transition atlas dimensions'); return;
    }
    transitionsLoaded=true; bakeAtlas();
  };
  groundSheet.onload=function(){
    if(groundSheet.naturalWidth!==GROUND_ATLAS.width||groundSheet.naturalHeight!==GROUND_ATLAS.height){
      console.error('[Kelo plaza] invalid authored ground dimensions',groundSheet.naturalWidth,groundSheet.naturalHeight,'expected',GROUND_ATLAS.width,GROUND_ATLAS.height); return;
    }
    groundLoaded=true; floorLayer=groundSheet; transitionLayer=null; propLayer=null;
    window.KELO_PLAZA_AUDIT.ready=true;
    window.KELO_PLAZA_AUDIT.assetLoaded=true;
    window.KELO_PLAZA_AUDIT.groundAssetLoaded=true;
    window.KELO_PLAZA_AUDIT.fallbackActive=false;
  };
  sheet.onerror=function(){ console.error('[Kelo plaza] tileset load failed'); };
  transitionSheet.onerror=function(){ console.error('[Kelo plaza] transition atlas load failed'); };
  groundSheet.onerror=function(){ console.error('[Kelo plaza] authored ground load failed'); };
  if(window.KELO_WORLD_DECORATION_RESET!==true){
    sheet.src=ATLAS.src+'&v=100';
    transitionSheet.src=TRANSITION_ATLAS.src+'&v=100';
    groundSheet.src=GROUND_ATLAS.src+'&v=100';
  }else{
    window.KELO_PLAZA_AUDIT.ready=true;
    window.KELO_PLAZA_AUDIT.assetLoaded=false;
    window.KELO_PLAZA_AUDIT.groundAssetLoaded=false;
    window.KELO_PLAZA_AUDIT.fallbackActive=false;
    window.KELO_PLAZA_AUDIT.decorationReset=true;
    window.KELO_PLAZA_AUDIT.decorationResetSuppressed=true;
  }

  let worldLayerWrapped=false;
  function installWorldGroundLayer(){
    if(worldLayerWrapped)return true;
    const base=window.KELO_WORLD_RENDERER;
    if(!base||typeof base.draw!=='function') return false;
    if(base.__keloPlazaGround){
      worldLayerWrapped=true;
      window.KELO_PLAZA_AUDIT.worldLayerWrapped=true;
      window.KELO_PLAZA_AUDIT.preActorContractPreserved=typeof base.drawPreActors==='function';
      window.KELO_PLAZA_AUDIT.postActorContractPreserved=typeof base.drawPostActors==='function';
      window.KELO_PLAZA_AUDIT.decorationReset=base.decorationReset===true||window.KELO_WORLD_DECORATION_RESET===true;
      window.KELO_PLAZA_AUDIT.decorationResetSuppressed=window.KELO_PLAZA_AUDIT.decorationReset;
      return true;
    }
    const wrapped={
      __keloPlazaGround:true,
      decorationReset:base.decorationReset===true||window.KELO_WORLD_DECORATION_RESET===true,
      draw(g){
        const ok=base.draw(g);
        const reset=base.decorationReset===true||window.KELO_WORLD_DECORATION_RESET===true;
        window.KELO_PLAZA_AUDIT.decorationReset=reset;
        window.KELO_PLAZA_AUDIT.decorationResetSuppressed=reset;
        if(ok===true&&floorLayer&&!reset){
          g.save();g.imageSmoothingEnabled=false;g.drawImage(floorLayer,PLAZA.x,PLAZA.y);
          if(transitionLayer)g.drawImage(transitionLayer,PLAZA.x,PLAZA.y);
          g.restore();
        }
        return ok;
      },
      districts:base.districts,
      chunkSize:base.chunkSize,
      get ready(){return base.ready;}
    };
    if(typeof base.drawPreActors==='function') wrapped.drawPreActors=g=>base.drawPreActors(g);
    if(typeof base.drawPostActors==='function') wrapped.drawPostActors=g=>base.drawPostActors(g);
    if(base.environmentLayerStack===true) wrapped.environmentLayerStack=true;
    if(base.preActorLayerStack===true) wrapped.preActorLayerStack=true;
    if(base.postActorLayerStack===true) wrapped.postActorLayerStack=true;
    window.KELO_WORLD_RENDERER=Object.freeze(wrapped);
    worldLayerWrapped=true;
    window.KELO_PLAZA_AUDIT.worldLayerWrapped=true;
    window.KELO_PLAZA_AUDIT.preActorContractPreserved=typeof window.KELO_WORLD_RENDERER.drawPreActors==='function';
    window.KELO_PLAZA_AUDIT.postActorContractPreserved=typeof window.KELO_WORLD_RENDERER.drawPostActors==='function';
    return true;
  }
  installWorldGroundLayer();setTimeout(installWorldGroundLayer,120);setTimeout(installWorldGroundLayer,600);

  function landingPoint(){
    const range=skillAim.castRange||120;
    return {x:localPlayer.x+(skillAim.dirX||1)*range,y:localPlayer.y+(skillAim.dirY||0)*range,range};
  }
  function burst(x,y,color,n,size){
    if(typeof spawnParticle!=='function') return;
    for(let i=0;i<n;i++) spawnParticle(x+(Math.random()-.5)*28,y+(Math.random()-.5)*28,color||'#ffd166',size||16,.35+Math.random()*.5);
  }
  function trailLine(x1,y1,x2,y2,color){
    for(let i=0;i<=10;i++){ const t=i/10; burst(x1+(x2-x1)*t,y1+(y2-y1)*t,color,2,12); }
    if(typeof spawnDashTrail==='function') spawnDashTrail(x1,y1,x2,y2,color);
  }
  const _cast=castAimedSkill;
  castAimedSkill=function(index,typeId,dirX,dirY){
    const stone=STATE.equipped[index]; if(!stone||stone.currentCd>0) return;
    const land=landingPoint(), color=stone.color||'#ffd166';
    if(typeId==='dash'){
      stone.currentCd=stone.baseCd; dashTween.active=true; dashTween.t=0;
      dashTween.dur=.11+.08*(land.range/170); dashTween.fromX=localPlayer.x; dashTween.fromY=localPlayer.y;
      dashTween.toX=Math.max(24,Math.min(CONFIG.worldWidth-24,land.x)); dashTween.toY=Math.max(24,Math.min(CONFIG.worldHeight-24,land.y));
      aim.x=dirX; aim.y=dirY; trailLine(dashTween.fromX,dashTween.fromY,dashTween.toX,dashTween.toY,color); burst(dashTween.toX,dashTween.toY,color,14,18); return;
    }
    _cast(index,typeId,dirX,dirY); trailLine(localPlayer.x,localPlayer.y,land.x,land.y,color); burst(land.x,land.y,color,typeId==='meteor'?22:12,typeId==='meteor'?22:14);
  };

  function drawLanding(){
    if(!skillAim.active) return;
    const land=landingPoint(), z=CONFIG.zoom||1;
    ctx.save(); ctx.translate(screenW/2,screenH/2); ctx.scale(z,z); ctx.translate(-camera.x,-camera.y);
    ctx.strokeStyle='rgba(255,214,102,.95)'; ctx.fillStyle='rgba(255,214,102,.22)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(localPlayer.x,localPlayer.y); ctx.lineTo(land.x,land.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(land.x,land.y,skillAim.typeId==='meteor'?64:18,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-l');
  window.KeloRender.afterFrame('engine-l:landing-marker', drawLanding, 40);

  window.KELO_PLAZA_TILESET=Object.freeze({sourceMode:'authored-raster-ground-v1',registryVersion:REGISTRY.version,assetPath:GROUND_ATLAS.src,fallbackAssetPath:ATLAS.src,transitionAssetPath:TRANSITION_ATLAS.src,atlasWidth:GROUND_ATLAS.width,atlasHeight:GROUND_ATLAS.height,atlasTileSize:TILE,worldTileSize:TILE,columns:COLS,layeredTransitions:true,authoredTransitions:true,authoredGround:true,plaza:Object.freeze({...PLAZA}),renderOwner:'KeloRender',viewportOwner:'KeloCamera',directViewportWrites:false});
})();