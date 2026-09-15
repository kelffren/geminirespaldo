/* KELO-INDEX
 * area: PLAZA
 * keys: TILES REGISTRY ASSET PNG TERRAIN
 * hace: registra atlas, familias, estilos y prefabs visuales del mundo
 * online: N/A; metadata visual cliente
 */
(function () {
  const TILE = 32;
  const RESET = window.KELO_WORLD_DECORATION_RESET === true;
  function resetBlank(width,height){
    const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'%3E%3C/svg%3E#kelo-reset`;
  }
  function assetSrc(src,width,height){ return RESET ? resetBlank(width,height) : src; }
  const atlas = Object.freeze({
    id:'plaza-core', src:resetBlank(512,512), retiredVisual:true, width:512, height:512,
    tileWidth:TILE, tileHeight:TILE, columns:16
  });
  const cespedAtlas = Object.freeze({
    id:'cesped-hd', src:'assets/cesped-runtime.PNG?art=501', width:160, height:160,
    tileWidth:TILE, tileHeight:TILE, columns:5, tileCount:25, family:'ground_grass'
  });
  const transitionAtlas = Object.freeze({
    id:'plaza-transitions', src:resetBlank(128,128), retiredVisual:true, width:128, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:4
  });
  const grassVariationAtlas = Object.freeze({
    id:'grass-variation', src:resetBlank(128,64), retiredVisual:true, width:128, height:64,
    tileWidth:TILE, tileHeight:TILE, columns:4, tileCount:8
  });
  const marbleVariationAtlas = Object.freeze({
    id:'marble-variation', src:resetBlank(128,64), retiredVisual:true, width:128, height:64,
    tileWidth:TILE, tileHeight:TILE, columns:4, tileCount:8, overlay:true
  });
  const plazaGroundAtlas = Object.freeze({
    id:'plaza-ground', src:resetBlank(800,560), retiredVisual:true, width:800, height:560,
    worldWidth:800, worldHeight:560, family:'ground'
  });
  const plazaNatureMeta = window.KELO_ARBOL_1_ATLAS_META;
  if (!plazaNatureMeta?.frames?.tree_large) {
    console.error('[Kelo registry] Arboleskelo1 irregular atlas metadata missing');
    return;
  }
  const plazaNatureAtlas = Object.freeze({
    id:'plaza-nature', src:'assets/Arboleskelo1.PNG?art=306', retiredVisual:true,
    width:plazaNatureMeta.width, height:plazaNatureMeta.height,
    frameMode:'irregular', frames:plazaNatureMeta.frames,
    spriteCount:Object.keys(plazaNatureMeta.frames).length
  });
  const trainingDummyAtlas = Object.freeze({
    id:'plaza-training-dummy', src:resetBlank(96,96), retiredVisual:true, width:96, height:96,
    spriteWidth:96, spriteHeight:96, columns:1, spriteCount:1, family:'training_prop'
  });
  const plazaNpcsAtlas = Object.freeze({
    id:'plaza-npcs', src:resetBlank(288,96), retiredVisual:true, width:288, height:96,
    spriteWidth:96, spriteHeight:96, columns:3, spriteCount:3, family:'npc_visual'
  });
  const ruralSoilAtlas = Object.freeze({
    id:'rural-soil', src:resetBlank(128,128), retiredVisual:true, width:128, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:4
  });
  const ruralPropsAtlas = Object.freeze({
    id:'rural-props', src:resetBlank(128,128), retiredVisual:true, width:128, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:4
  });
  const ruralLandmarksAtlas = Object.freeze({
    id:'rural-landmarks', src:resetBlank(256,128), retiredVisual:true, width:256, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:8
  });
  const ruralNatureAtlas = window.KELO_RURAL_NATURE_ATLAS;
  if (!ruralNatureAtlas || ruralNatureAtlas.width!==256 || ruralNatureAtlas.height!==128) {
    console.error('[Kelo registry] authored rural nature atlas missing or invalid');
    return;
  }

  const architectureAssets = Object.freeze({
    luxeBoutique:Object.freeze({
      id:'luxe-boutique', src:resetBlank(192,222), retiredVisual:true, width:192, height:222,
      worldWidth:192, worldHeight:222, family:'architecture'
    }),
    commerceArcadeWest:Object.freeze({
      id:'commerce-arcade-west', src:resetBlank(160,432), retiredVisual:true, width:160, height:432,
      worldWidth:80, worldHeight:216, family:'commerce-architecture'
    }),
    commerceArcadeEast:Object.freeze({
      id:'commerce-arcade-east', src:resetBlank(160,432), retiredVisual:true, width:160, height:432,
      worldWidth:80, worldHeight:216, family:'commerce-architecture'
    }),
    arenaWarWall:Object.freeze({
      id:'arena-war-wall', src:resetBlank(640,192), retiredVisual:true, width:640, height:192,
      worldWidth:640, worldHeight:192, family:'arena-architecture'
    }),
    arenaWarEdgeDecor:Object.freeze({
      id:'arena-war-edge-decor', src:resetBlank(640,96), retiredVisual:true, width:640, height:96,
      worldWidth:640, worldHeight:96, family:'arena-landmark'
    })
  });
  const architecturePrefabs = Object.freeze({
    luxeBoutique:Object.freeze({
      id:'luxe-boutique-central', asset:'luxeBoutique', x:1112, y:1318, baseYOffset:222,
      collision:Object.freeze({x:1140,y:1488,w:136,h:52}),
      interaction:Object.freeze({x:1208,y:1552,radius:90}),
      occlusion:Object.freeze({sideInset:9,topInset:40,bottomPadding:4,clip:Object.freeze({xPadding:7,topPadding:24,bottomPadding:7})}),
      legacyVisualReplacement:true
    }),
    commerceArcadeWest:Object.freeze({
      id:'commerce-arcade-west-south', asset:'commerceArcadeWest', x:1936, y:1736, worldWidth:80, worldHeight:216, baseYOffset:216,
      collision:Object.freeze({x:1944,y:1932,w:64,h:20}),
      occlusion:Object.freeze({sideInset:8,topInset:36,bottomPadding:4,clip:Object.freeze({xPadding:6,topPadding:18,bottomPadding:6})}),
      districts:Object.freeze(['commerce']), priority:24, ownership:'commerce-authored-arcade-v1', legacyVisualReplacement:true
    }),
    commerceArcadeEast:Object.freeze({
      id:'commerce-arcade-east-south', asset:'commerceArcadeEast', x:2692, y:1736, worldWidth:80, worldHeight:216, baseYOffset:216,
      collision:Object.freeze({x:2700,y:1932,w:64,h:20}),
      occlusion:Object.freeze({sideInset:8,topInset:36,bottomPadding:4,clip:Object.freeze({xPadding:6,topPadding:18,bottomPadding:6})}),
      districts:Object.freeze(['commerce']), priority:24, ownership:'commerce-authored-arcade-v1', legacyVisualReplacement:true
    }),
    arenaWarWall:Object.freeze({
      id:'arena-war-wall-north', asset:'arenaWarWall', x:1840, y:480, baseYOffset:192,
      districts:Object.freeze(['arena']), priority:24, ownership:'arena-authored-war-v1'
    }),
    arenaWarEdgeDecor:Object.freeze({
      id:'arena-war-edge-decor-south', asset:'arenaWarEdgeDecor', x:1840, y:912, baseYOffset:96,
      districts:Object.freeze(['arena']), priority:18, ownership:'arena-authored-war-v1'
    })
  });
  const plazaNatureProps = Object.freeze([
    Object.freeze({id:'plaza-tree-nw',frame:'tree_large',x:1096,y:1196,w:144,h:192,baseY:1388}),
    Object.freeze({id:'plaza-tree-ne',frame:'tree_pink',x:1640,y:1208,w:144,h:180,baseY:1388}),
    Object.freeze({id:'plaza-tree-sw',frame:'tree_medium',x:1100,y:1560,w:136,h:180,baseY:1740}),
    Object.freeze({id:'plaza-tree-se',frame:'tree_large',x:1640,y:1548,w:144,h:192,baseY:1740}),
    Object.freeze({id:'plaza-tree-west-1',frame:'tree_small',x:1018,y:1368,w:112,h:144,baseY:1512}),
    Object.freeze({id:'plaza-tree-west-2',frame:'tree_cypress',x:1030,y:1452,w:88,h:228,baseY:1680}),
    Object.freeze({id:'plaza-tree-east-1',frame:'tree_pink',x:1740,y:1340,w:132,h:172,baseY:1512}),
    Object.freeze({id:'plaza-tree-east-2',frame:'tree_medium',x:1746,y:1510,w:126,h:170,baseY:1680}),
    Object.freeze({id:'plaza-tree-north-west',frame:'tree_small',x:1244,y:1144,w:104,h:138,baseY:1282}),
    Object.freeze({id:'plaza-tree-north-east',frame:'tree_cypress',x:1540,y:1086,w:88,h:196,baseY:1282}),
    Object.freeze({id:'plaza-tree-south-west',frame:'tree_pink',x:1228,y:1730,w:140,h:176,baseY:1906}),
    Object.freeze({id:'plaza-tree-south-east',frame:'tree_medium',x:1524,y:1736,w:132,h:170,baseY:1906}),
    Object.freeze({id:'plaza-grove-west-large',frame:'tree_large',x:880,y:1160,w:132,h:176,baseY:1336}),
    Object.freeze({id:'plaza-grove-west-pink',frame:'tree_pink',x:850,y:1584,w:126,h:160,baseY:1744}),
    Object.freeze({id:'plaza-grove-east-large',frame:'tree_large',x:1880,y:1170,w:132,h:176,baseY:1346}),
    Object.freeze({id:'plaza-grove-east-small',frame:'tree_small',x:1900,y:1576,w:106,h:142,baseY:1718}),
    Object.freeze({id:'plaza-grove-north-medium',frame:'tree_medium',x:1370,y:1000,w:118,h:154,baseY:1154}),
    Object.freeze({id:'plaza-grove-north-cypress',frame:'tree_cypress',x:1448,y:944,w:82,h:210,baseY:1154}),
    Object.freeze({id:'plaza-grove-south-pink',frame:'tree_pink',x:1370,y:1900,w:128,h:160,baseY:2060}),
    Object.freeze({id:'plaza-grove-south-small',frame:'tree_small',x:1508,y:1918,w:106,h:142,baseY:2060})
  ]);
  const trainingDummyProp = Object.freeze({
    id:'training-dummy-plaza',asset:'trainingDummy',x:1532,y:1608,w:96,h:96,baseY:1702,
    gameplayAnchor:Object.freeze({x:1580,y:1680,radius:22}),visualOnly:true
  });
  const plazaNpcVisuals = Object.freeze({
    portero:Object.freeze({sprite:0,xOffset:-48,yOffset:-72,w:96,h:96,labelYOffset:-34}),
    joyero:Object.freeze({sprite:1,xOffset:-48,yOffset:-72,w:96,h:96,labelYOffset:-34}),
    maestro:Object.freeze({sprite:2,xOffset:-48,yOffset:-72,w:96,h:96,labelYOffset:-34})
  });

  const tiles = Object.freeze({
    GRASS_A:0, GRASS_B:1, GRASS_C:2, GRASS_FLOWERS:3,
    MARBLE_A:4, MARBLE_B:5, MARBLE_GOLD_A:6, MARBLE_GOLD_B:7,
    MARBLE_GREEN_DIAMOND:8, MARBLE_GREEN_CENTER:9, MARBLE_DIAMOND:10,
    GRASS_SOFT:25, MARBLE_CLEAN_A:26, MARBLE_CLEAN_B:27,
    MARBLE_CLEAN_C:28, MARBLE_CLEAN_D:29,
    MARBLE_IVORY_A:80, MARBLE_IVORY_B:81, MARBLE_IVORY_C:82, MARBLE_IVORY_D:83,
    FOUNTAIN:Object.freeze([32,33,34,48,49,50,64,65,66]),
    TREE:Object.freeze([35,36,51,52,67,68]), COLUMN:Object.freeze([37,53]),
    BUSH_A:38, BUSH_FLOWERS:39, FLOWERBED:Object.freeze([40,41]),
    STATUE:Object.freeze([42,58]), LAMP:Object.freeze([43,59]), BENCH:Object.freeze([44,45]),
    BUSH_B:54, BUSH_FLOWERS_B:55, PLANTER:56, PLANTER_FLOWERS:57
  });
  const families = Object.freeze({
    grass:Object.freeze([tiles.GRASS_A,tiles.GRASS_B,tiles.GRASS_C,tiles.GRASS_SOFT]),
    grassDetail:Object.freeze([tiles.GRASS_FLOWERS]),
    grassAuthored:Object.freeze([0,1,2,3,4,5,6,7]),
    marble:Object.freeze([tiles.MARBLE_IVORY_A,tiles.MARBLE_IVORY_B,tiles.MARBLE_IVORY_C,tiles.MARBLE_IVORY_D,tiles.MARBLE_IVORY_A,tiles.MARBLE_IVORY_B,tiles.MARBLE_IVORY_C,tiles.MARBLE_IVORY_D]),
    marbleVariation:Object.freeze([0,1,2,3,4,5,6,7]),
    marbleAccent:Object.freeze([tiles.MARBLE_A,tiles.MARBLE_B,tiles.MARBLE_DIAMOND]),
    marbleGold:Object.freeze([tiles.MARBLE_GOLD_A,tiles.MARBLE_GOLD_B])
  });
  const districtGroundStyles = Object.freeze({
    central:Object.freeze({detailEvery:43,detailCluster:false,marbleAccentEvery:0}),
    rural:Object.freeze({detailEvery:31,detailCluster:true,marbleAccentEvery:0}),
    arena:Object.freeze({detailEvery:61,detailCluster:false,marbleAccentEvery:29,marbleVariation:true}),
    commerce:Object.freeze({detailEvery:67,detailCluster:false,marbleAccentEvery:23,marbleVariation:true}),
    gardens:Object.freeze({detailEvery:17,detailCluster:true,marbleAccentEvery:0,marbleVariation:true}),
    default:Object.freeze({detailEvery:53,detailCluster:false,marbleAccentEvery:0})
  });
  const ruralTiles = Object.freeze({
    TOP_LEFT:0, TOP:1, TOP_RIGHT:2, CENTER_ALT_A:3,
    LEFT:4, CENTER:5, RIGHT:6, CENTER_ALT_B:7,
    BOTTOM_LEFT:8, BOTTOM:9, BOTTOM_RIGHT:10, CENTER_ALT_C:11
  });
  const ruralPropTiles = Object.freeze({
    FENCE_H:0, FENCE_V:1, CORNER_LEFT:2, CORNER_RIGHT:3,
    GATE_CLOSED:4, GATE_OPEN:5, FIELD_SIGN:6, FENCE_BROKEN:7,
    DIRT_FULL:8, DIRT_VERTICAL:9, DIRT_HORIZONTAL:10, DIRT_CROSS:11,
    WEED_A:12, STONE_A:13, WEED_B:14, LOG_A:15
  });
  const ruralLandmarkTiles = Object.freeze({HAY:7,CRATE:15,BUSH:23,FLOWERS:31});
  const ruralLandmarkSprites = Object.freeze({
    barn:Object.freeze({sx:0,sy:0,w:160,h:128,baseY:112}),
    silo:Object.freeze({sx:160,sy:0,w:64,h:128,baseY:116})
  });
  const ruralNatureTiles = ruralNatureAtlas.tiles;
  const ruralNatureSprites = ruralNatureAtlas.treeFamilies;
  const transitionMasks = Object.freeze({
    0:15,1:0,2:1,3:5,4:2,5:12,6:6,7:9,8:3,9:4,10:13,11:8,12:7,13:11,14:10,15:14
  });
  const styles = Object.freeze({
    plazaTransition:Object.freeze({mode:'authored-organic-fringe-overlay-v3',neighbourMask:'TRBL',softenStickerAccents:true}),
    marbleVariation:Object.freeze({mode:'authored-eight-variant-overlay-v1',scope:'gardens-commerce-arena-roads',subtle:true}),
    plazaNature:Object.freeze({mode:'authored-transparent-prop-family-v1',depthMode:'actor-base-y-v1',visualOnly:true,collision:false}),
    trainingDummy:Object.freeze({mode:'registry-authored-training-prop-v1',asset:'trainingDummy',visualOnly:true,preserveGameplayAnchor:true,labelMode:'hp-only-v1'}),
    plazaNpcs:Object.freeze({mode:'registry-authored-npc-visual-v1',asset:'plazaNpcs',preserveGameplayAnchors:true,labelMode:'proximity-name-v1',visualOnly:true}),
    propDepth:Object.freeze({mode:'y-occlusion-overlay-v1',localActorIntersection:true,frontOccluders:Object.freeze(['fountain','column','tree','lamp'])}),
    architecture:Object.freeze({mode:'authored-layered-raster-v1',depthMode:'building-base-y-occlusion-v1',actorClip:true,prefabContract:'registry-asset-placement-collision-v1',rendererMode:'generic-prefab-list-v1'}),
    surfaceGround:Object.freeze({mode:'rebuild-hd-grass-v1',asset:'cesped',baseFrames:Object.freeze([1,7,12,21]),detailFrames:Object.freeze([0,2,6,10,16,19,24]),detailModulo:11}),
    districtGround:Object.freeze({mode:'district-profile-v1',profiles:districtGroundStyles,grassMode:'authored-eight-variant-atlas-v1'}),
    ruralFarm:Object.freeze({
      mode:'authored-nine-slice-v1',
      plotTiles:Object.freeze([0,1,2,4,5,6,8,9,10]),
      logicalPlotSize:96,
      cropAnchors:Object.freeze([[16,18],[48,18],[80,18],[16,50],[48,50],[80,50]]),
      boundary:Object.freeze({mode:'modular-fence-gate-v1',padding:16,gateSide:'north',dirtApproachTiles:1,propAtlas:'rural-props'})
    }),
    ruralLandmarks:Object.freeze({
      mode:'layered-rural-landmarks-v1',
      authoredLandmarks:Object.freeze(['barn','silo']),
      depthMode:'actor-base-y-v1',
      gameplayFootprint:'visual-only-v1',
      edgeVegetation:Object.freeze({
        mode:'authored-rural-nature-edge-clusters-v1',
        sourceAtlas:'ruralNature',
        treeFamilies:Object.freeze(['oak','fruit']),
        hedgeTiles:Object.freeze(['HEDGE_A','HEDGE_B','HEDGE_FLOWERS_A','HEDGE_FLOWERS_B']),
        detailTiles:Object.freeze(['TALL_GRASS','WILDFLOWERS','STUMP','STONE']),
        centerClear:true,
        roadClearance:32
      })
    })
  });
  window.KELO_TILE_REGISTRY = Object.freeze({
    version:'1.13.0', worldTileSize:TILE,
    atlases:Object.freeze({cesped:cespedAtlas,plaza:atlas,plazaGround:plazaGroundAtlas,transitions:transitionAtlas,grassVariation:grassVariationAtlas,marbleVariation:marbleVariationAtlas,plazaNature:plazaNatureAtlas,trainingDummy:trainingDummyAtlas,plazaNpcs:plazaNpcsAtlas,ruralSoil:ruralSoilAtlas,ruralProps:ruralPropsAtlas,ruralLandmarks:ruralLandmarksAtlas,ruralNature:ruralNatureAtlas}),
    architectureAssets,architecturePrefabs,plazaNatureProps,trainingDummyProp,plazaNpcVisuals,
    tiles,ruralTiles,ruralPropTiles,ruralLandmarkTiles,ruralLandmarkSprites,ruralNatureTiles,ruralNatureSprites,families,transitionMasks,styles
  });
})();