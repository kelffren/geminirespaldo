(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const assets=R?.architectureAssets;
  const prefabs=R?.architecturePrefabs;
  const style=R?.styles?.architecture;
  if(!assets||!prefabs||!style){console.error('[Kelo prefab contract] architecture registry missing');return;}

  function freezeFrame(f,i){
    const x=Number(f?.x)||0,y=Number(f?.y)||0,w=Math.max(0,Number(f?.w)||0),h=Math.max(0,Number(f?.h)||0);
    return Object.freeze({id:String(f?.id??i),x,y,w,h,worldWidth:Math.max(0,Number(f?.worldWidth)||w),worldHeight:Math.max(0,Number(f?.worldHeight)||h)});
  }
  const normalizedAssets={};
  for(const [key,a] of Object.entries(assets)){
    normalizedAssets[key]=Object.freeze({
      id:a.id||key,family:a.family||'architecture',version:a.version||'1',src:a.src,
      width:a.width,height:a.height,worldWidth:a.worldWidth||a.width,worldHeight:a.worldHeight||a.height,
      sampling:a.sampling||'nearest',alpha:a.alpha!==false,
      frames:Object.freeze((a.frames||[]).map(freezeFrame)),fallback:a.fallback||null
    });
  }

  function freezeRect(r){return r?Object.freeze({x:r.x,y:r.y,w:r.w,h:r.h,noDraw:r.noDraw!==false}):null;}
  function findFrame(a,ref){
    if(ref===null||typeof ref==='undefined')return null;
    const f=typeof ref==='number'?a.frames[ref]:a.frames.find(x=>x.id===String(ref));
    if(!f)throw new Error(`[Kelo prefab contract] missing frame ${String(ref)} in ${a.id}`);
    return f;
  }
  function normalizePart(raw,defaults,index){
    if(raw===false||raw===null||typeof raw==='undefined')return null;
    const spec=raw===true?{}:raw;
    const assetKey=spec.asset||defaults.asset;
    const a=normalizedAssets[assetKey];
    if(!a)throw new Error(`[Kelo prefab contract] missing render asset ${assetKey}`);
    const frame=findFrame(a,spec.frame);
    const phase=spec.phase||defaults.phase||'props_back';
    if(phase!=='props_back'&&phase!=='props_front')throw new Error(`[Kelo prefab contract] invalid render phase ${phase}`);
    const source=frame?{x:frame.x,y:frame.y,w:frame.w,h:frame.h}:{x:0,y:0,w:a.width,h:a.height};
    const size={
      w:Math.max(0,Number(spec.worldWidth)||Number(defaults.worldWidth)||frame?.worldWidth||a.worldWidth||source.w),
      h:Math.max(0,Number(spec.worldHeight)||Number(defaults.worldHeight)||frame?.worldHeight||a.worldHeight||source.h)
    };
    return Object.freeze({
      id:String(spec.id||`${defaults.role||'part'}-${index}`),role:String(spec.role||defaults.role||'part'),asset:assetKey,
      frame:spec.frame??null,phase,source:Object.freeze(source),offset:Object.freeze({x:Number(spec.xOffset)||0,y:Number(spec.yOffset)||0}),
      size:Object.freeze(size),opacity:Number.isFinite(spec.opacity)?Math.max(0,Math.min(1,spec.opacity)):1
    });
  }
  function normalizeParts(raw,defaults){
    const list=Array.isArray(raw)?raw:(raw===false||raw===null||typeof raw==='undefined'?[]:[raw]);
    return Object.freeze(list.map((x,i)=>normalizePart(x,defaults,i)).filter(Boolean));
  }

  const normalizedPrefabs=[];
  for(const [key,p] of Object.entries(prefabs)){
    const a=normalizedAssets[p.asset];
    if(!a){console.error('[Kelo prefab contract] missing asset',key,p.asset);return;}
    const x=p.x||0,y=p.y||0,w=p.worldWidth||a.worldWidth,h=p.worldHeight||a.worldHeight;
    const collision=freezeRect(p.collision);
    const interaction=p.interaction?Object.freeze({...p.interaction}):null;
    const occlusion=p.occlusion?Object.freeze({...p.occlusion,clip:p.occlusion.clip?Object.freeze({...p.occlusion.clip}):null}):null;
    const render=p.render||{};
    const backInput=Object.prototype.hasOwnProperty.call(render,'back')?render.back:(Object.prototype.hasOwnProperty.call(p,'back')?p.back:{id:'base',asset:p.asset});
    const frontInput=Object.prototype.hasOwnProperty.call(render,'front')?render.front:(p.front||[]);
    const shadowInput=Object.prototype.hasOwnProperty.call(render,'shadows')?render.shadows:[];
    const overlayInput=Object.prototype.hasOwnProperty.call(render,'overlays')?render.overlays:[];
    const back=normalizeParts(backInput,{asset:p.asset,phase:'props_back',role:'back',worldWidth:w,worldHeight:h});
    const front=normalizeParts(frontInput,{asset:p.asset,phase:'props_front',role:'front'});
    const shadows=normalizeParts(shadowInput,{asset:p.asset,phase:'props_back',role:'shadow'});
    const overlays=normalizeParts(overlayInput,{asset:p.asset,phase:'props_front',role:'overlay'});
    const renderPlan=Object.freeze({
      back,front,shadows,overlays,
      parts:Object.freeze([...shadows,...back,...overlays,...front]),
      occlusionFallback:front.length===0&&!!occlusion?'clip-redraw-back-v1':'none'
    });
    normalizedPrefabs.push(Object.freeze({
      key,id:p.id||key,asset:p.asset,position:Object.freeze({x,y}),size:Object.freeze({w,h}),
      anchor:Object.freeze(p.anchor||{x:0.5,y:1}),baseY:y+(p.baseYOffset??h),
      visualBounds:Object.freeze(p.visualBounds||{x,y,w,h}),footprint:Object.freeze(p.footprint||collision||{x,y:y+h,w,h:0}),
      collider:collision,interaction,entrance:p.entrance?Object.freeze({...p.entrance}):interaction,
      doors:Object.freeze(p.doors||[]),shadows:Object.freeze(p.shadows||[]),overlays:Object.freeze(p.overlays||[]),
      animation:Object.freeze(p.animation||[]),occlusion,renderPlan,districts:Object.freeze(p.districts||['central']),
      layerGroup:p.layerGroup||'architecture',priority:Number.isFinite(p.priority)?p.priority:20,
      ownership:p.ownership||'architecture-prefabs-v1',legacyVisualReplacement:!!p.legacyVisualReplacement,
      legacyObstacleRects:Object.freeze((p.legacyObstacleRects||[]).map(r=>Object.freeze({...r})))
    }));
  }

  const layerGroups=Object.freeze({
    architecture:Object.freeze({id:'architecture-prefabs',ownership:'architecture-prefabs-v1',priority:20,
      back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})})
  });

  window.KELO_PREFAB_CONTRACT=Object.freeze({
    version:'1.1.0',sourceRegistryVersion:R.version,mode:'data-driven-building-prefabs-v2',
    assets:Object.freeze(normalizedAssets),prefabs:Object.freeze(normalizedPrefabs),layerGroups,
    capabilities:Object.freeze({renderParts:true,splitLayers:true,splitAssets:true,frameSelection:true,colliders:true,interactionMetadata:true,entrances:true,doors:true,shadows:true,overlays:true,animationFrames:true,occlusion:true,districtCompatibility:true,legacyReplacement:true})
  });
})();