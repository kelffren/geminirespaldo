/* KELO-INDEX
 * area: WORLD / MAP FORGE
 * owner: KeloMapForge recipe catalog
 * purpose: data-only recipes plus reviewed evolution champion overrides for deterministic world generation
 * public-api: MAP_FORGE_RECIPES, getMapForgeRecipe(), listMapForgeRecipes()
 * consumes: MAP_FORGE_CHAMPION_OVERRIDES data only
 * state-owned: immutable recipe data only
 * extension-points: add recipes/content; approved evolution changes enter as genome overrides
 * online: recipeId + effective recipeVersion remain stable serialization inputs
 * do-not: no DOM, renderer, collision writes, Math.random or automatic promotion
 */
import {MAP_FORGE_CHAMPION_OVERRIDES} from './map-forge-champion-overrides.mjs';

const freezeDeep=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);for(const item of Object.values(value))freezeDeep(item);return value;};
const clone=value=>JSON.parse(JSON.stringify(value));
function applyChampionOverride(recipe){
  const row=MAP_FORGE_CHAMPION_OVERRIDES[recipe.id];if(!row?.genes)return recipe;
  const out=clone(recipe);
  for(const [id,value] of Object.entries(row.genes)){
    const parts=id.split('.');
    if(parts[0]==='style'&&Object.prototype.hasOwnProperty.call(out.style,parts[1]))out.style[parts[1]]=value;
    else if(parts[0]==='road'&&Object.prototype.hasOwnProperty.call(out.road,parts[1]))out.road[parts[1]]=value;
    else if(parts[0]==='district'){const target=out.districts.find(item=>item.id===parts[1]);if(target&&parts[2]==='weight')target.weight=value;}
    else if(parts[0]==='landmark'){const target=out.landmarks.find(item=>item.id===parts[1]);if(target&&parts[2]==='keepClearRadius')target.keepClearRadius=value;}
  }
  const revision=Math.max(1,Math.floor(Number(row.revision)||1));out.version=`${recipe.version}-evo.${revision}`;return out;
}

const capital={
  id:'KELO_ROYAL_CAPITAL_V1',version:'1.0.0',type:'capital',label:'Royal Capital',biome:'temperate_royal',
  worldBounds:{x:0,y:0,w:3600,h:3200},
  style:{monumentality:.94,organicRoads:.48,density:.62,vegetation:.68,symmetry:.46,exploration:.74,decoration:.7},
  road:{loopRatio:.34,arterialWidth:112,collectorWidth:80,localWidth:56,trailWidth:40,grid:64,curvature:.46},
  districts:[
    {id:'central',label:'Plaza Central',kind:'plaza',region:'center',weight:1.22,terrainProfile:'central',required:true},
    {id:'royal',label:'Distrito Real',kind:'royal',region:'north',weight:1.05,terrainProfile:'central',required:true},
    {id:'commerce',label:'Mercado',kind:'commerce',region:'east',weight:1,terrainProfile:'commerce',required:true},
    {id:'residential',label:'Residencial',kind:'residential',region:'west',weight:1,terrainProfile:'gardens',required:true},
    {id:'harbor',label:'Puerto',kind:'harbor',region:'northeast',weight:.92,terrainProfile:'commerce',required:true,requiresWater:true},
    {id:'dark_forest',label:'Bosque Oscuro',kind:'forest',region:'northwest',weight:.95,terrainProfile:'rural',required:true},
    {id:'farms',label:'Granjas',kind:'farm',region:'southeast',weight:1.02,terrainProfile:'rural',required:true},
    {id:'mining',label:'Montañas y Mina',kind:'mine',region:'southwest',weight:.96,terrainProfile:'rural',required:true}
  ],
  landmarks:[
    {id:'fountain',type:'central_fountain',role:'primary_anchor',district:'central',region:'center',keepClearRadius:190,footprint:{w:180,h:180},facing:'south',hero:true},
    {id:'castle',type:'castle',role:'hero_destination',district:'royal',region:'north',keepClearRadius:210,footprint:{w:320,h:180},facing:'south',hero:true},
    {id:'main_market',type:'main_market',role:'district_anchor',district:'commerce',region:'east',keepClearRadius:130,footprint:{w:240,h:160},facing:'west',hero:true},
    {id:'harbor_gate',type:'harbor_landmark',role:'district_anchor',district:'harbor',region:'northeast',keepClearRadius:120,footprint:{w:220,h:140},facing:'southwest',hero:true},
    {id:'ancient_tree',type:'ancient_tree',role:'district_anchor',district:'dark_forest',region:'northwest',keepClearRadius:120,footprint:{w:160,h:180},facing:'southeast',hero:true},
    {id:'windmill',type:'windmill',role:'district_anchor',district:'farms',region:'southeast',keepClearRadius:100,footprint:{w:140,h:160},facing:'northwest',hero:true},
    {id:'mine_gate',type:'mine_entrance',role:'district_anchor',district:'mining',region:'southwest',keepClearRadius:110,footprint:{w:180,h:120},facing:'northeast',hero:true}
  ],
  exits:[
    {id:'exit_south',direction:'south',target:'adventure_world',district:'central'},
    {id:'exit_northwest',direction:'northwest',target:'dark_forest_world',district:'dark_forest'},
    {id:'exit_northeast',direction:'northeast',target:'coast_route',district:'harbor'},
    {id:'exit_southwest',direction:'southwest',target:'mountain_route',district:'mining'}
  ],
  scenicAxes:[{from:'spawn',to:'fountain',weight:1},{from:'fountain',to:'castle',weight:1},{from:'commerce',to:'harbor_gate',weight:.72},{from:'farms',to:'windmill',weight:.55}],
  qualityWeights:{playability:1.25,connectivity:1.2,navigation:1.12,visualComposition:1.35,landmarkQuality:1.45,districtVariety:1.12,roadQuality:1.15,densityBalance:.9,negativeSpace:1.08,assetVariety:.72,scenicVistas:1.35,technicalSafety:1.3}
};

const village={
  id:'KELO_VILLAGE_V1',version:'1.0.0',type:'village',label:'Village',biome:'temperate_rural',
  worldBounds:{x:0,y:0,w:2400,h:2000},
  style:{monumentality:.48,organicRoads:.72,density:.42,vegetation:.78,symmetry:.22,exploration:.68,decoration:.66},
  road:{loopRatio:.24,arterialWidth:80,collectorWidth:64,localWidth:48,trailWidth:36,grid:64,curvature:.7},
  districts:[
    {id:'central',label:'Village Green',kind:'plaza',region:'center',weight:1.1,terrainProfile:'gardens',required:true},
    {id:'homes',label:'Homes',kind:'residential',region:'west',weight:1.12,terrainProfile:'gardens',required:true},
    {id:'shops',label:'Shops',kind:'commerce',region:'east',weight:.85,terrainProfile:'commerce',required:true},
    {id:'farms',label:'Fields',kind:'farm',region:'south',weight:1.18,terrainProfile:'rural',required:true},
    {id:'woods',label:'Woods',kind:'forest',region:'north',weight:1.05,terrainProfile:'rural',required:true}
  ],
  landmarks:[
    {id:'village_tree',type:'ancient_tree',role:'primary_anchor',district:'central',region:'center',keepClearRadius:130,footprint:{w:150,h:170},facing:'south',hero:true},
    {id:'village_market',type:'small_market',role:'district_anchor',district:'shops',region:'east',keepClearRadius:90,footprint:{w:170,h:120},facing:'west',hero:false},
    {id:'village_barn',type:'barn',role:'district_anchor',district:'farms',region:'south',keepClearRadius:95,footprint:{w:190,h:130},facing:'north',hero:true}
  ],
  exits:[{id:'exit_south',direction:'south',target:'road_south',district:'farms'},{id:'exit_north',direction:'north',target:'road_north',district:'woods'}],
  scenicAxes:[{from:'spawn',to:'village_tree',weight:1},{from:'central',to:'village_barn',weight:.55}],
  qualityWeights:{playability:1.25,connectivity:1.2,navigation:1.1,visualComposition:1.1,landmarkQuality:1.05,districtVariety:.95,roadQuality:1.12,densityBalance:1.08,negativeSpace:1.08,assetVariety:.7,scenicVistas:.9,technicalSafety:1.3}
};

const forest={
  id:'KELO_FOREST_V1',version:'1.0.0',type:'forest',label:'Forest',biome:'temperate_forest',
  worldBounds:{x:0,y:0,w:2600,h:2200},
  style:{monumentality:.34,organicRoads:.92,density:.54,vegetation:.96,symmetry:.08,exploration:.94,decoration:.82},
  road:{loopRatio:.38,arterialWidth:64,collectorWidth:52,localWidth:40,trailWidth:32,grid:64,curvature:.9},
  districts:[
    {id:'central',label:'Forest Clearing',kind:'clearing',region:'center',weight:.88,terrainProfile:'rural',required:true},
    {id:'grove',label:'Ancient Grove',kind:'forest',region:'northwest',weight:1.18,terrainProfile:'rural',required:true},
    {id:'ruins',label:'Ruins',kind:'ruins',region:'northeast',weight:.8,terrainProfile:'arena',required:true},
    {id:'stream',label:'Stream',kind:'water_edge',region:'southeast',weight:.72,terrainProfile:'gardens',required:true,requiresWater:true},
    {id:'deepwood',label:'Deepwood',kind:'forest',region:'southwest',weight:1.25,terrainProfile:'rural',required:true}
  ],
  landmarks:[
    {id:'ancient_tree',type:'ancient_tree',role:'primary_anchor',district:'grove',region:'northwest',keepClearRadius:145,footprint:{w:180,h:210},facing:'southeast',hero:true},
    {id:'ruin_tower',type:'mysterious_tower',role:'hero_destination',district:'ruins',region:'northeast',keepClearRadius:120,footprint:{w:140,h:190},facing:'southwest',hero:true}
  ],
  exits:[{id:'exit_south',direction:'south',target:'village_route',district:'deepwood'},{id:'exit_east',direction:'east',target:'river_route',district:'stream'}],
  scenicAxes:[{from:'spawn',to:'ancient_tree',weight:1},{from:'central',to:'ruin_tower',weight:.8}],
  qualityWeights:{playability:1.18,connectivity:1.1,navigation:1.05,visualComposition:1.05,landmarkQuality:1.08,districtVariety:1.12,roadQuality:1.02,densityBalance:1.15,negativeSpace:1.12,assetVariety:.78,scenicVistas:1.05,technicalSafety:1.28}
};

const recipes=[capital,village,forest].map(applyChampionOverride);
export const MAP_FORGE_RECIPES=freezeDeep(Object.fromEntries(recipes.map(recipe=>[recipe.id,recipe])));
export function getMapForgeRecipe(id){return MAP_FORGE_RECIPES[id]||null;}
export function listMapForgeRecipes(){return Object.values(MAP_FORGE_RECIPES);}
