/* KELO-INDEX
 * area: PROPERTY / CONTENT
 * owner: KELO_PROPERTY_CATALOG content registration
 * keys: FOREST PLAZA ASSET SHEET PLACEABLE WORLD EDITOR IRREGULAR ATLAS CLASSIFICATION SEMANTIC NAMES
 * purpose: registra cada frame compilado Forest Plaza como plantilla colocable, conservando IDs legacy y exponiendo nombre/categoría semánticos
 * online: contenido inmutable; publicación/placements siguen bajo la autoridad existente de World/Property
 * do-not: no renderiza, no persiste placements, no crea catálogo paralelo
 */
(function(){
  'use strict';
  let installed=false;

  const CLASSIFICATION=Object.freeze({
    '001':Object.freeze({name:'fp_plaza_core_corner_gem_northeast',category:'plaza_core'}),
    '002':Object.freeze({name:'fp_plaza_core_wall_cap_right',category:'plaza_core'}),
    '003':Object.freeze({name:'fp_plaza_core_trim_vertical_marble',category:'plaza_core'}),
    '004':Object.freeze({name:'fp_plaza_core_spire_north_inner',category:'plaza_core'}),
    '005':Object.freeze({name:'fp_plaza_core_floor_marble_plain',category:'plaza_core'}),
    '006':Object.freeze({name:'fp_plaza_core_floor_blue_panel',category:'plaza_core'}),
    '007':Object.freeze({name:'fp_plaza_core_trim_vertical_gold',category:'plaza_core'}),
    '008':Object.freeze({name:'fp_plaza_core_gem_connector_large',category:'plaza_core'}),
    '009':Object.freeze({name:'fp_plaza_core_arc_outer_blue_gold',category:'plaza_core'}),
    '010':Object.freeze({name:'fp_plaza_core_arc_outer_laurel',category:'plaza_core'}),
    '011':Object.freeze({name:'fp_plaza_core_spire_north_outer',category:'plaza_core'}),
    '012':Object.freeze({name:'fp_plaza_core_corner_gem_northwest',category:'plaza_core'}),
    '013':Object.freeze({name:'fp_plaza_core_corner_gem_southwest',category:'plaza_core'}),
    '014':Object.freeze({name:'fp_plaza_core_wall_short',category:'plaza_core'}),
    '015':Object.freeze({name:'fp_plaza_core_column_cap_gold',category:'plaza_core'}),
    '016':Object.freeze({name:'fp_plaza_core_wall_thin',category:'plaza_core'}),
    '017':Object.freeze({name:'fp_plaza_core_arc_inner_laurel',category:'plaza_core'}),
    '018':Object.freeze({name:'fp_plaza_core_arc_inner_laurel_small',category:'plaza_core'}),
    '019':Object.freeze({name:'fp_plaza_core_gem_connector_small',category:'plaza_core'}),
    '020':Object.freeze({name:'fp_plaza_core_spire_west',category:'plaza_core'}),
    '021':Object.freeze({name:'fp_arch_column_short_left',category:'architecture'}),
    '022':Object.freeze({name:'fp_arch_column_short_right',category:'architecture'}),
    '023':Object.freeze({name:'fp_arch_wall_corner_inner',category:'architecture'}),
    '024':Object.freeze({name:'fp_arch_balustrade_long',category:'architecture'}),
    '025':Object.freeze({name:'fp_arch_stairs_center',category:'architecture'}),
    '026':Object.freeze({name:'fp_arch_spire_base_connector',category:'architecture'}),
    '027':Object.freeze({name:'fp_arch_stairs_wide',category:'architecture'}),
    '028':Object.freeze({name:'fp_arch_finial_post',category:'architecture'}),
    '029':Object.freeze({name:'fp_arch_wall_corner_outer',category:'architecture'}),
    '030':Object.freeze({name:'fp_plaza_core_spire_east',category:'plaza_core'}),
    '031':Object.freeze({name:'fp_plaza_core_arc_inner_small',category:'plaza_core'}),
    '032':Object.freeze({name:'fp_arch_banner_pedestal',category:'architecture'}),
    '033':Object.freeze({name:'fp_arch_banner_royal_a',category:'architecture'}),
    '034':Object.freeze({name:'fp_arch_banner_ornate_center',category:'architecture'}),
    '035':Object.freeze({name:'fp_arch_column_pedestal_square',category:'architecture'}),
    '036':Object.freeze({name:'fp_arch_pillar_tall_a',category:'architecture'}),
    '037':Object.freeze({name:'fp_arch_wall_short_left',category:'architecture'}),
    '038':Object.freeze({name:'fp_arch_banner_royal_b',category:'architecture'}),
    '039':Object.freeze({name:'fp_arch_wall_short_right',category:'architecture'}),
    '040':Object.freeze({name:'fp_arch_wall_short_center',category:'architecture'}),
    '041':Object.freeze({name:'fp_arch_balustrade_curved',category:'architecture'}),
    '042':Object.freeze({name:'fp_plaza_core_arc_blue_gold_large',category:'plaza_core'}),
    '043':Object.freeze({name:'fp_plaza_core_arc_laurel_half',category:'plaza_core'}),
    '044':Object.freeze({name:'fp_plaza_core_arc_blue_gold_left',category:'plaza_core'}),
    '045':Object.freeze({name:'fp_plaza_core_spire_south',category:'plaza_core'}),
    '046':Object.freeze({name:'fp_arch_pillar_tall_b',category:'architecture'}),
    '047':Object.freeze({name:'fp_arch_pergola_post_left',category:'architecture'}),
    '048':Object.freeze({name:'fp_arch_pergola_beam_center',category:'architecture'}),
    '049':Object.freeze({name:'fp_arch_pergola_post_right',category:'architecture'}),
    '050':Object.freeze({name:'fp_plaza_core_arc_blue_gold_small',category:'plaza_core'}),
    '051':Object.freeze({name:'fp_plaza_core_spire_connector_gold',category:'plaza_core'}),
    '052':Object.freeze({name:'fp_plaza_core_corner_gem_southeast',category:'plaza_core'}),
    '053':Object.freeze({name:'fp_plaza_core_arc_outer_laurel_b',category:'plaza_core'}),
    '054':Object.freeze({name:'fp_garden_planter_flower_round_a',category:'garden_decor'}),
    '055':Object.freeze({name:'fp_arch_pedestal_small',category:'architecture'}),
    '056':Object.freeze({name:'fp_plaza_core_spire_tip_small',category:'plaza_core'}),
    '057':Object.freeze({name:'fp_garden_planter_flower_round_b',category:'garden_decor'}),
    '058':Object.freeze({name:'fp_garden_planter_flower_round_c',category:'garden_decor'}),
    '059':Object.freeze({name:'fp_garden_topiary_cone_a',category:'garden_decor'}),
    '060':Object.freeze({name:'fp_garden_planter_topiary_square',category:'garden_decor'}),
    '061':Object.freeze({name:'fp_garden_topiary_cone_b',category:'garden_decor'}),
    '062':Object.freeze({name:'fp_water_fountain_round_large',category:'water_features'}),
    '063':Object.freeze({name:'fp_water_fountain_arc_small',category:'water_features'}),
    '064':Object.freeze({name:'fp_water_fountain_arc_large',category:'water_features'}),
    '065':Object.freeze({name:'fp_waterfall_panel_narrow',category:'water_features'}),
    '066':Object.freeze({name:'fp_waterfall_panel_wide',category:'water_features'}),
    '067':Object.freeze({name:'fp_garden_topiary_cone_c',category:'garden_decor'}),
    '068':Object.freeze({name:'fp_water_fountain_round_small',category:'water_features'}),
    '069':Object.freeze({name:'fp_garden_planter_flower_round_d',category:'garden_decor'}),
    '070':Object.freeze({name:'fp_water_fountain_arc_medium',category:'water_features'}),
    '071':Object.freeze({name:'fp_water_fountain_round_offset',category:'water_features'}),
    '072':Object.freeze({name:'fp_terrain_path_straight_a',category:'terrain_paths'}),
    '073':Object.freeze({name:'fp_water_pond_corner_northwest',category:'water_features'}),
    '074':Object.freeze({name:'fp_terrain_path_straight_b',category:'terrain_paths'}),
    '075':Object.freeze({name:'fp_terrain_path_straight_c',category:'terrain_paths'}),
    '076':Object.freeze({name:'fp_terrain_path_straight_d',category:'terrain_paths'}),
    '077':Object.freeze({name:'fp_terrain_path_straight_e',category:'terrain_paths'}),
    '078':Object.freeze({name:'fp_water_pond_edge_north',category:'water_features'}),
    '079':Object.freeze({name:'fp_water_pond_edge_east',category:'water_features'}),
    '080':Object.freeze({name:'fp_water_pond_lilies_small',category:'water_features'}),
    '081':Object.freeze({name:'fp_water_pond_rocks_small',category:'water_features'}),
    '082':Object.freeze({name:'fp_terrain_grass_flowers_a',category:'terrain_paths'}),
    '083':Object.freeze({name:'fp_terrain_grass_flowers_b',category:'terrain_paths'}),
    '084':Object.freeze({name:'fp_terrain_grass_flowers_c',category:'terrain_paths'}),
    '085':Object.freeze({name:'fp_terrain_grass_flowers_d',category:'terrain_paths'}),
    '086':Object.freeze({name:'fp_terrain_path_vertical_a',category:'terrain_paths'}),
    '087':Object.freeze({name:'fp_water_pond_curve_west',category:'water_features'}),
    '088':Object.freeze({name:'fp_terrain_path_vertical_b',category:'terrain_paths'}),
    '089':Object.freeze({name:'fp_terrain_path_vertical_c',category:'terrain_paths'}),
    '090':Object.freeze({name:'fp_terrain_path_vertical_d',category:'terrain_paths'}),
    '091':Object.freeze({name:'fp_market_lantern_post_single',category:'market_props'}),
    '092':Object.freeze({name:'fp_market_cart_full',category:'market_props'}),
    '093':Object.freeze({name:'fp_market_rope_fence_short_a',category:'market_props'}),
    '094':Object.freeze({name:'fp_market_rope_fence_long_a',category:'market_props'}),
    '095':Object.freeze({name:'fp_market_post_pair',category:'market_props'}),
    '096':Object.freeze({name:'fp_terrain_path_vertical_e',category:'terrain_paths'}),
    '097':Object.freeze({name:'fp_water_pond_edge_rocky_a',category:'water_features'}),
    '098':Object.freeze({name:'fp_terrain_path_vertical_f',category:'terrain_paths'}),
    '099':Object.freeze({name:'fp_terrain_path_vertical_g',category:'terrain_paths'}),
    '100':Object.freeze({name:'fp_terrain_path_vertical_h',category:'terrain_paths'}),
    '101':Object.freeze({name:'fp_market_rope_fence_middle_a',category:'market_props'}),
    '102':Object.freeze({name:'fp_market_rope_fence_short_b',category:'market_props'}),
    '103':Object.freeze({name:'fp_terrain_path_vertical_i',category:'terrain_paths'}),
    '104':Object.freeze({name:'fp_terrain_path_vertical_j',category:'terrain_paths'}),
    '105':Object.freeze({name:'fp_waterfall_stream_vertical',category:'water_features'}),
    '106':Object.freeze({name:'fp_water_pond_lilies_large',category:'water_features'}),
    '107':Object.freeze({name:'fp_water_pond_lilies_medium',category:'water_features'}),
    '108':Object.freeze({name:'fp_terrain_path_vertical_k',category:'terrain_paths'}),
    '109':Object.freeze({name:'fp_market_cart_wheel_base',category:'market_props'}),
    '110':Object.freeze({name:'fp_market_cart_body',category:'market_props'}),
    '111':Object.freeze({name:'fp_garden_flower_bed_dense_a',category:'garden_decor'}),
    '112':Object.freeze({name:'fp_terrain_path_vertical_l',category:'terrain_paths'}),
    '113':Object.freeze({name:'fp_water_pond_edge_rocky_b',category:'water_features'}),
    '114':Object.freeze({name:'fp_terrain_path_vertical_m',category:'terrain_paths'}),
    '115':Object.freeze({name:'fp_terrain_path_vertical_n',category:'terrain_paths'}),
    '116':Object.freeze({name:'fp_garden_flower_bed_dense_b',category:'garden_decor'}),
    '117':Object.freeze({name:'fp_market_barrel_wood',category:'market_props'}),
    '118':Object.freeze({name:'fp_market_crate_wood',category:'market_props'}),
    '119':Object.freeze({name:'fp_garden_flower_bed_dense_c',category:'garden_decor'}),
    '120':Object.freeze({name:'fp_nature_tree_broad_round_a',category:'nature_trees_rocks'}),
    '121':Object.freeze({name:'fp_nature_bush_large_a',category:'nature_trees_rocks'}),
    '122':Object.freeze({name:'fp_nature_tree_pine_tall_a',category:'nature_trees_rocks'}),
    '123':Object.freeze({name:'fp_nature_tree_broad_round_b',category:'nature_trees_rocks'}),
    '124':Object.freeze({name:'fp_nature_tree_round_large_gold',category:'nature_trees_rocks'}),
    '125':Object.freeze({name:'fp_nature_rock_cluster_large_a',category:'nature_trees_rocks'}),
    '126':Object.freeze({name:'fp_nature_rock_cluster_small_a',category:'nature_trees_rocks'}),
    '127':Object.freeze({name:'fp_nature_tree_pine_tall_b',category:'nature_trees_rocks'}),
    '128':Object.freeze({name:'fp_nature_tree_conifer_medium',category:'nature_trees_rocks'}),
    '129':Object.freeze({name:'fp_garden_bush_round_a',category:'garden_decor'}),
    '130':Object.freeze({name:'fp_garden_flower_bush_a',category:'garden_decor'}),
    '131':Object.freeze({name:'fp_garden_bush_round_b',category:'garden_decor'}),
    '132':Object.freeze({name:'fp_garden_hedge_patch_a',category:'garden_decor'}),
    '133':Object.freeze({name:'fp_garden_shrub_small_a',category:'garden_decor'}),
    '134':Object.freeze({name:'fp_garden_flower_bush_b',category:'garden_decor'}),
    '135':Object.freeze({name:'fp_nature_root_border_a',category:'nature_trees_rocks'}),
    '136':Object.freeze({name:'fp_nature_rock_cluster_small_b',category:'nature_trees_rocks'}),
    '137':Object.freeze({name:'fp_nature_rock_cluster_small_c',category:'nature_trees_rocks'}),
    '138':Object.freeze({name:'fp_nature_rock_cluster_medium_a',category:'nature_trees_rocks'}),
    '139':Object.freeze({name:'fp_garden_flower_bush_c',category:'garden_decor'}),
    '140':Object.freeze({name:'fp_nature_tree_round_small',category:'nature_trees_rocks'}),
    '141':Object.freeze({name:'fp_nature_rock_cluster_medium_b',category:'nature_trees_rocks'}),
    '142':Object.freeze({name:'fp_nature_rock_border_small',category:'nature_trees_rocks'}),
    '143':Object.freeze({name:'fp_garden_sapling_small',category:'garden_decor'}),
    '144':Object.freeze({name:'fp_nature_rock_flower_patch_small',category:'nature_trees_rocks'}),
    '145':Object.freeze({name:'fp_garden_grass_patch_small',category:'garden_decor'}),
    '146':Object.freeze({name:'fp_nature_root_border_b',category:'nature_trees_rocks'})
  });

  const CATEGORY_LABELS=Object.freeze({
    plaza_core:'Plaza Core',
    architecture:'Architecture',
    garden_decor:'Garden Decor',
    water_features:'Water Features',
    terrain_paths:'Terrain & Paths',
    market_props:'Market Props',
    nature_trees_rocks:'Nature · Trees & Rocks'
  });

  const pretty=(name)=>String(name||'').replace(/^fp_/,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const assetNumber=(frame)=>String(frame?.assetId||frame?.frameId||'').replace(/^asset-/,'').padStart(3,'0');

  window.KELO_FOREST_PLAZA_ASSET_CLASSIFICATION=Object.freeze({
    version:'forest-plaza-classification-v1',
    count:Object.keys(CLASSIFICATION).length,
    categories:CATEGORY_LABELS,
    assets:CLASSIFICATION
  });

  function install(){
    if(installed)return true;
    const M=window.KELO_FOREST_PLAZA_TILESET_V2;
    const A=window.KELO_ATLAS_CONTRACT;
    const C=window.KELO_PROPERTY_CATALOG;
    if(!M?.atlas||!Array.isArray(M.assets)||!A?.register||!C?.registerTemplate)return false;
    const ATLAS='forestPlazaV2';
    const SRC='assets/world/plaza/forest-plaza-tileset-v2.png?art=801';
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
    const atlasFrames=Object.fromEntries(M.assets.map(frame=>[String(frame.frameId||frame.assetId),{x:Number(frame.sourceRect?.x)||0,y:Number(frame.sourceRect?.y)||0,w:Math.max(1,Number(frame.sourceRect?.w)||1),h:Math.max(1,Number(frame.sourceRect?.h)||1)}]));
    try{A.register(ATLAS,{id:ATLAS,src:SRC,width:Number(M.atlas.width)||1448,height:Number(M.atlas.height)||1086,frameMode:'irregular',frames:atlasFrames},{role:'optional'});}catch(err){if(!A.describe?.(ATLAS))console.warn('[Kelo forest plaza catalog] atlas registration failed',err?.message||err);}
    const ids=[];
    const named=[];
    for(const frame of M.assets){
      const r=frame.sourceRect;if(!r)continue;
      const number=assetNumber(frame);
      const meta=CLASSIFICATION[number]||Object.freeze({name:`fp_unclassified_${number}`,category:'unclassified'});
      const target=clamp(frame.scale?.targetPixelWidth||frame.visualBounds?.w||r.w,24,256);
      const width=Math.max(24,Math.round(target)),height=Math.max(24,Math.round((Number(r.h)||1)/Math.max(1,Number(r.w)||1)*width));
      const sourceCollision=frame.collider?.passThrough?null:frame.collider?.solidBounds;
      const sx=width/Math.max(1,Number(r.w)||1),sy=height/Math.max(1,Number(r.h)||1);
      const collision=sourceCollision?{x:Math.round((Number(sourceCollision.x)||0)*sx),y:Math.round((Number(sourceCollision.y)||0)*sy),w:Math.max(1,Math.round((Number(sourceCollision.w)||0)*sx)),h:Math.max(1,Math.round((Number(sourceCollision.h)||0)*sy))}:null;
      const key=String(frame.frameId||frame.assetId);
      const id=`forest-plaza:${String(frame.assetId||key)}`; // legacy stable id: placements no se rompen
      let template=C.getTemplate?.(id)||null;
      if(!template)template=C.registerTemplate({
        id,
        label:pretty(meta.name),
        category:meta.category,
        family:`forest-plaza/${meta.category}`,
        districts:['*'],
        width,height,snap:32,collision,source:'kelo-asset-sheet-compiler-v1.1',sourceId:meta.name,placeable:true,
        parts:[{assetKey:ATLAS,source:{x:Number(r.x)||0,y:Number(r.y)||0,w:Math.max(1,Number(r.w)||1),h:Math.max(1,Number(r.h)||1)},offset:{x:0,y:0},size:{w:width,h:height},phase:frame.layer==='props_front'?'props_front':'props_back'}]
      });
      ids.push(template.id);
      named.push(Object.freeze({legacyId:id,assetId:String(frame.assetId||key),name:meta.name,label:pretty(meta.name),category:meta.category,family:`forest-plaza/${meta.category}`}));
    }
    installed=true;
    window.KELO_FOREST_PLAZA_CATALOG_AUDIT=Object.freeze({
      version:'forest-plaza-catalog-v1.2-semantic',
      atlasKey:ATLAS,
      compiler:M.compiler||null,
      templateCount:ids.length,
      classifiedCount:named.filter(item=>item.category!=='unclassified').length,
      categories:CATEGORY_LABELS,
      templateIds:Object.freeze(ids),
      namedAssets:Object.freeze(named),
      placeable:true,
      legacyIdsPreserved:true
    });
    try{window.dispatchEvent(new CustomEvent('kelo:forest-plaza-catalog-ready',{detail:{atlasKey:ATLAS,templateCount:ids.length,classifiedCount:named.length}}));}catch{}
    return true;
  }
  if(!install()){
    window.addEventListener('load',()=>{if(!install())console.warn('[Kelo forest plaza catalog] owners unavailable after load');},{once:true});
  }
})();
