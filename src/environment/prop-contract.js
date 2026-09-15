/* KELO-INDEX
 * area: PLAZA
 * keys: PROP ASSET PNG FOUNTAIN COLLIDER DEPTH FOREST PLAZA COMPILED MANIFEST PLACEABLE
 * hace: contrato data-driven de props y su metadata visual/espacial; integra Forest Plaza mediante el Asset Sheet Compiler/manifest sin crear renderer paralelo
 * online: N/A; props visuales, gameplay permanece fuera del renderer
 */
(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const RESET=window.KELO_WORLD_DECORATION_RESET===true;
  if(!R){console.error('[Kelo prop contract] TileRegistry missing');return;}
  const defs=[];
  const plazaNatureAtlas=R.atlases?.plazaNature;
  const ruralPropsAtlas=R.atlases?.ruralProps;
  const ruralFrames=R.ruralPropTiles;
  const TILE=R.worldTileSize||32;

  // Compiler-compatible bootstrap: these are the deterministic irregular frame rects detected from
  // the transparent 1448x1086 source. The canonical CI compiler replaces this bootstrap manifest
  // with full world-asset profiles when its runner becomes available.
  function forestManifest(){
    if(window.KELO_FOREST_PLAZA_TILESET_V2?.assets?.length)return window.KELO_FOREST_PLAZA_TILESET_V2;
    const rects=[[1068,6,100,112],[1323,10,121,133],[720,11,99,94],[230,12,116,117],[424,12,113,96],[534,12,94,95],[626,12,97,94],[815,12,125,94],[935,12,116,96],[104,13,113,116],[189,15,67,105],[352,15,75,74],[12,19,72,77],[1187,20,92,105],[1276,23,50,113],[1149,77,98,125],[283,81,103,97],[65,82,101,96],[373,90,62,83],[12,96,64,106],[716,103,49,121],[761,105,120,119],[1324,107,118,142],[880,108,284,117],[427,109,141,103],[129,110,190,193],[604,110,116,113],[562,112,50,113],[1244,138,121,117],[31,163,105,82],[312,163,107,81],[423,213,52,114],[1153,215,84,166],[919,216,74,164],[987,217,66,164],[472,218,57,116],[779,219,85,117],[1084,219,81,161],[525,220,76,133],[855,222,67,159],[594,225,173,102],[65,226,100,94],[284,226,102,94],[13,228,62,88],[368,228,61,113],[1049,230,43,151],[1244,236,55,87],[1281,238,72,142],[1349,252,89,129],[88,284,124,110],[235,284,125,109],[11,295,88,83],[189,296,68,103],[681,314,113,190],[1233,318,47,63],[338,331,61,58],[571,332,116,166],[417,333,115,161],[776,344,79,158],[521,371,69,132],[898,375,71,127],[9,378,168,169],[1037,378,80,133],[1316,378,124,136],[1116,379,94,131],[1217,381,107,129],[848,384,61,113],[267,385,97,164],[965,387,78,122],[357,412,75,135],[180,414,92,133],[535,506,95,101],[1019,506,84,108],[723,507,101,100],[823,507,99,100],[436,508,100,99],[629,508,96,98],[1187,508,133,107],[1321,508,112,109],[922,509,97,104],[1102,511,86,102],[115,544,106,104],[220,545,106,103],[331,545,105,103],[11,546,103,103],[724,602,99,103],[438,603,97,102],[535,603,95,104],[629,603,97,102],[822,603,99,102],[1186,610,83,144],[1259,610,179,180],[1117,611,67,71],[917,613,107,74],[1019,614,93,86],[218,644,104,99],[328,644,101,100],[112,645,104,98],[10,646,102,96],[1055,677,61,74],[923,678,89,70],[1110,681,81,59],[724,701,98,141],[630,702,95,139],[823,702,99,139],[435,703,103,139],[536,703,96,137],[1008,704,50,75],[1092,724,81,84],[1210,730,101,106],[923,736,92,103],[10,737,102,106],[327,737,103,105],[218,738,106,104],[112,739,103,104],[1015,761,98,94],[1311,771,53,72],[1362,777,73,73],[1145,778,82,74],[358,832,151,245],[1089,832,114,112],[503,834,128,245],[165,836,208,242],[8,840,171,237],[1199,844,117,103],[1310,845,131,100],[617,851,106,176],[715,853,94,125],[883,857,92,89],[805,858,79,96],[969,861,81,91],[1045,868,49,59],[1018,926,104,90],[825,937,112,85],[1335,940,111,137],[1199,941,63,58],[1254,946,92,78],[1107,947,95,75],[928,959,98,90],[706,969,137,108],[1161,991,127,91],[1008,1011,90,67],[632,1015,76,62],[840,1018,102,61],[1096,1020,69,56],[1291,1021,66,55]];
    const items=Object.freeze(rects.map((r,i)=>Object.freeze({id:`asset-${String(i+1).padStart(3,'0')}`,assetId:`asset-${String(i+1).padStart(3,'0')}`,frameId:`asset-${String(i+1).padStart(3,'0')}`,family:'forest-plaza',category:'environment/forest-plaza',layer:'props_front',sourceRect:Object.freeze({x:r[0],y:r[1],w:r[2],h:r[3]}),visualBounds:Object.freeze({x:0,y:0,w:r[2],h:r[3]}),collider:Object.freeze({mode:'none',shape:'none',passThrough:false,solidBounds:null,solidSegments:Object.freeze([]),portalCutout:null,authority:'review-required'}),scale:Object.freeze({targetPixelWidth:Math.max(24,Math.min(256,r[2]))})})));
    const manifest=Object.freeze({kind:'kelo-asset-sheet-manifest',version:'kelo-asset-sheet-manifest-v1',compiler:'kelo-asset-sheet-compiler-v1.1.0',source:Object.freeze({name:'forest-plaza-tileset-v2.png',path:'assets/world/plaza/forest-plaza-tileset-v2.png',width:1448,height:1086}),atlas:Object.freeze({id:'forest-plaza-tileset-v2',kind:'prop-atlas-irregular',frameMode:'irregular',width:1448,height:1086,sourcePath:'assets/world/plaza/forest-plaza-tileset-v2.png'}),assets:items,bootstrap:Object.freeze({status:'compatible-precompile',assetCount:items.length,canonicalWorkflowRun:34810288885})});
    window.KELO_FOREST_PLAZA_TILESET_V2=manifest;
    return manifest;
  }
  const FOREST=forestManifest();
  const forestFrames=FOREST?.assets?.length?Object.freeze(Object.fromEntries(FOREST.assets.map(frame=>[String(frame.frameId||frame.assetId),Object.freeze({x:Number(frame.sourceRect?.x)||0,y:Number(frame.sourceRect?.y)||0,w:Math.max(1,Number(frame.sourceRect?.w)||1),h:Math.max(1,Number(frame.sourceRect?.h)||1)})]))):null;
  const forestAsset=forestFrames?Object.freeze({id:'forestPlazaV2',src:'assets/world/plaza/forest-plaza-tileset-v2.png?art=801',width:Number(FOREST.atlas?.width)||1448,height:Number(FOREST.atlas?.height)||1086,frameMode:'irregular',frames:forestFrames}):null;
  const layerGroups=Object.freeze({
    plazaNature:Object.freeze({id:'plaza-nature',ownership:'plaza-nature-props-v1',priority:10,renderMode:'layer-stack',back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})}),
    plazaImperialNature:Object.freeze({id:'plaza-imperial-nature',ownership:'plaza-imperial-nature-v1',priority:12,renderMode:'layer-stack',visibleDuringReset:true,back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})}),
    plazaForestCompiled:Object.freeze({id:'plaza-forest-compiled',ownership:'kelo-creator-asset-bridge:forest-plaza-v2',priority:14,renderMode:'layer-stack',visibleDuringReset:true,back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})}),
    plazaFountain:Object.freeze({id:'plaza-fountain',ownership:'plaza-fountain-kelo-v1',priority:20,renderMode:'layer-stack',visibleDuringReset:true,front:Object.freeze({phase:'props_front'})}),
    ruralBoundary:Object.freeze({id:'rural-boundary',ownership:'rural-farm-boundary-props-v1',priority:8,renderMode:'layer-stack',back:Object.freeze({phase:'props_back'})})
  });
  if(!RESET&&plazaNatureAtlas&&Array.isArray(R.plazaNatureProps)){
    for(const p of R.plazaNatureProps){defs.push(Object.freeze({id:p.id,family:'nature_prop',asset:'plazaNature',frame:(p.frame??p.sprite??0),layerGroup:'plazaNature',layerRole:'back',position:Object.freeze({x:p.x,y:p.y}),size:Object.freeze({w:p.w,h:p.h}),anchor:Object.freeze({x:0.5,y:1}),visualBounds:Object.freeze({x:p.x,y:p.y,w:p.w,h:p.h}),footprint:Object.freeze({x:p.x+Math.round(p.w*0.28),y:p.baseY-18,w:Math.round(p.w*0.44),h:18}),collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:'props_back',front:'props_front'}),priority:10,district:'central',occlusion:Object.freeze({mode:'actor-base-y-clip-v1',baseY:p.baseY,clipPadding:8}),visualOnly:true}));}
  }
  const assets=Object.freeze({
    plazaNature:Object.freeze({id:'plazaNature',src:RESET?null:plazaNatureAtlas?.src,width:plazaNatureAtlas?.width,height:plazaNatureAtlas?.height,frameMode:plazaNatureAtlas?.frameMode,frames:plazaNatureAtlas?.frames,frameWidth:plazaNatureAtlas?.spriteWidth,frameHeight:plazaNatureAtlas?.spriteHeight,columns:plazaNatureAtlas?.columns}),
    plazaRoundTree:Object.freeze({id:'plazaRoundTree',src:'assets/world/imperial-plaza/arbol-redondo.png?art=631',width:1254,height:1254,frameWidth:1254,frameHeight:1254,columns:1}),
    ...(forestAsset?{forestPlazaV2:forestAsset}:{}),
    ruralProps:Object.freeze({id:'ruralProps',src:RESET?null:ruralPropsAtlas?.src,width:ruralPropsAtlas?.width,height:ruralPropsAtlas?.height,frameWidth:ruralPropsAtlas?.tileWidth||TILE,frameHeight:ruralPropsAtlas?.tileHeight||TILE,columns:ruralPropsAtlas?.columns}),
    plazaFountainKelo:Object.freeze({id:'plazaFountainKelo',src:'assets/justicia_fountain_v2.PNG?art=502',width:1254,height:1254,frameWidth:1254,frameHeight:1254,columns:1}),
  });
  defs.push(Object.freeze({id:'plaza-round-tree-imperial',family:'nature_prop',asset:'plazaRoundTree',frame:0,layerGroup:'plazaImperialNature',layerRole:'back',position:Object.freeze({x:1260,y:1540}),size:Object.freeze({w:192,h:192}),anchor:Object.freeze({x:0.5,y:1}),visualBounds:Object.freeze({x:1260,y:1540,w:192,h:192}),footprint:Object.freeze({x:1292,y:1668,w:128,h:64}),collider:Object.freeze({mode:'rect',x:1292,y:1668,w:128,h:64,noDraw:true}),layers:Object.freeze({back:'props_back',front:'props_front'}),priority:12,district:'central',occlusion:Object.freeze({mode:'actor-base-y-clip-v1',baseY:1732,clipPadding:8}),visualOnly:false}));
  defs.push(Object.freeze({id:'plaza-fountain-kelo',family:'landmark_prop',asset:'plazaFountainKelo',frame:0,layerGroup:'plazaFountain',layerRole:'front',position:Object.freeze({x:1080,y:800}),size:Object.freeze({w:720,h:720}),anchor:Object.freeze({x:0.5,y:1}),visualBounds:Object.freeze({x:1080,y:800,w:720,h:720}),footprint:Object.freeze({x:1190,y:1430,w:500,h:90}),collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:null,front:'props_front'}),priority:20,district:'central',occlusion:Object.freeze({mode:'actor-base-y-redraw-v1',baseY:1505,bounds:Object.freeze({x:1080,y:800,w:720,h:720})}),visualOnly:false}));

  function forestCandidates(predicate){return Array.isArray(FOREST?.assets)?FOREST.assets.filter(frame=>frame?.sourceRect&&predicate(frame.sourceRect,frame)):[];}
  function addForestProp(id,frame,x,y,w,h,role='back'){
    if(!forestAsset||!frame)return;
    const frameId=String(frame.frameId||frame.assetId),baseY=y+h;
    defs.push(Object.freeze({id,family:'forest_plaza_compiled',asset:'forestPlazaV2',frame:frameId,layerGroup:'plazaForestCompiled',layerRole:role,position:Object.freeze({x,y}),size:Object.freeze({w,h}),anchor:Object.freeze({x:0.5,y:1}),visualBounds:Object.freeze({x,y,w,h}),footprint:Object.freeze({x:x+Math.round(w*.3),y:baseY-Math.max(8,Math.round(h*.08)),w:Math.max(12,Math.round(w*.4)),h:Math.max(8,Math.round(h*.08))}),collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:'props_back',front:'props_front'}),priority:14,district:'central',occlusion:Object.freeze({mode:'none'}),visualOnly:true}));
  }
  if(forestAsset){
    const trees=forestCandidates((r)=>r.y>=790&&r.h>=120&&r.w>=70).slice(0,4);
    const banners=forestCandidates((r)=>r.y>=185&&r.y<390&&r.h>=105&&r.w<=100).slice(0,2);
    const planters=forestCandidates((r)=>r.y>=300&&r.y<515&&r.h>=90&&r.w>=55&&r.w<=150).slice(0,2);
    const treeSlots=[[770,1120],[1980,1120],[790,1710],[1960,1710]];
    trees.forEach((frame,i)=>addForestProp(`forest-plaza-tree-${i+1}`,frame,treeSlots[i][0],treeSlots[i][1],150,190));
    if(banners[0])addForestProp('forest-plaza-banner-west',banners[0],1000,1360,64,112,'front');
    if(banners[1])addForestProp('forest-plaza-banner-east',banners[1],1820,1360,64,112,'front');
    if(planters[0])addForestProp('forest-plaza-planter-west',planters[0],970,1570,100,116,'front');
    if(planters[1])addForestProp('forest-plaza-planter-east',planters[1],1810,1570,100,116,'front');
    const probe=trees[0]||banners[0]||planters[0]||FOREST.assets[0];
    if(probe)addForestProp('map-editor-probe-20260914',probe,1488,1496,140,168,'front');
  }

  function ruralTile(frame,x,y,id,family){return Object.freeze({id,family:family||'rural_boundary_prop',asset:'ruralProps',frame,layerGroup:'ruralBoundary',layerRole:'back',position:Object.freeze({x,y}),size:Object.freeze({w:TILE,h:TILE}),anchor:Object.freeze({x:0,y:0}),visualBounds:Object.freeze({x,y,w:TILE,h:TILE}),footprint:Object.freeze({x,y:y+Math.round(TILE*0.65),w:TILE,h:Math.max(1,Math.round(TILE*0.35))}),collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:'props_back',front:null}),priority:8,district:'rural',occlusion:Object.freeze({mode:'none'}),visualOnly:true});}
  function buildRuralFarmBoundary(farm){
    if(!farm||!ruralPropsAtlas||!ruralFrames)return Object.freeze([]);
    const out=[];const left=farm.x-16,right=farm.x+farm.w+16,top=farm.y-16,bottom=farm.y+farm.h+16;const gateX=Math.round((farm.x+farm.w/2)/TILE)*TILE-TILE/2;let n=0;
    const add=(frame,x,y,role)=>out.push(ruralTile(frame,x,y,`rural-boundary-${role}-${n++}`,`rural_${role}`));
    add(ruralFrames.DIRT_VERTICAL,gateX,top-TILE,'threshold');
    for(let x=left+TILE;x<=right-TILE;x+=TILE){if(Math.abs(x-gateX)>TILE/2)add(ruralFrames.FENCE_H,x,top,'fence');add(ruralFrames.FENCE_H,x,bottom,'fence');}
    for(let y=top+TILE;y<=bottom-TILE;y+=TILE){add(ruralFrames.FENCE_V,left,y,'fence');add(ruralFrames.FENCE_V,right,y,'fence');}
    add(ruralFrames.CORNER_LEFT,left,top,'corner');add(ruralFrames.CORNER_RIGHT,right-TILE,top,'corner');add(ruralFrames.CORNER_LEFT,left,bottom,'corner');add(ruralFrames.CORNER_RIGHT,right-TILE,bottom,'corner');add(ruralFrames.GATE_OPEN,gateX,top,'gate');add(ruralFrames.FIELD_SIGN,left+TILE,top+TILE,'sign');add(ruralFrames.WEED_A,left-TILE,top+2*TILE,'vegetation');add(ruralFrames.STONE_A,right+6,top+5*TILE,'stone');add(ruralFrames.WEED_B,right+4,bottom-2*TILE,'vegetation');
    return Object.freeze(out);
  }
  const sources=Object.freeze({ruralFarmBoundary:Object.freeze({id:'ruralFarmBoundary',layerGroup:'ruralBoundary',build:buildRuralFarmBoundary,instances:function(){if(typeof STATE==='undefined'||!STATE||!STATE.farm)return Object.freeze([]);return buildRuralFarmBoundary(STATE.farm);}})});
  window.KELO_PROP_CONTRACT=Object.freeze({version:'1.10.0',mode:'generic-prop-contract-v10-forest-plaza-playable',assets,layerGroups,props:Object.freeze(defs),sources,getByDistrict(district){return defs.filter(p=>p.district===district);}});

  // One-shot content loader. Catalog self-registers immediately if its owner exists, or once on window load.
  if(typeof document!=='undefined'&&!document.querySelector('script[data-kelo-forest-plaza-catalog]')){
    const s=document.createElement('script');s.src='src/property/forest-plaza-asset-catalog.js?v=2';s.dataset.keloForestPlazaCatalog='1';document.head.appendChild(s);
  }
})();