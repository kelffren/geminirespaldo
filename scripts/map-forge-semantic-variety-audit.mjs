/* KELO-INDEX
 * area: TEST / MAP FORGE / STUDIO HANDOFF
 * owner: Map Forge Studio handoff contract audit
 * purpose: prove district labels cannot override intrinsic semantic kind while unsafe decoration footprints may be culled
 */
// KELO-INDEX MAP-FORGE/TREE-PALETTE keeps forest, farm and ceremonial sprite families deterministic.
import assert from 'node:assert/strict';
import {generateBestOf} from '../src/world/map-forge/map-forge-core.mjs';
import {getMapForgeRecipe} from '../src/world/map-forge/map-forge-recipes.mjs';
import {mapDefinitionToWorldDraftSnapshot} from '../src/studio/adapters/map-forge-draft-importer.mjs';

const EXPECTED=Object.freeze({
  fountain:['imperial:fuente-justicia','imperial:fuente-astral','imperial:fuente-leones'],
  market_prop:['imperial:carrito-mercado'],
  market:['imperial:kiosco'],
  tree:['imperial:arbol-florido-blanco','imperial:arbol-florido-azul','tree:oak-dense-dark','tree:pine-tall-evergreen','tree:willow-weeping','tree:oak-broad-green','tree:apple-red','tree:birch-green','tree:canopy-light-green'],
  lamp:['imperial:farola','imperial:farola-monumental'],
  bench:['imperial:banco'],
  flower:['imperial:jardinera-floral','imperial:jardinera-curva'],
  bush:['imperial:topiario']
});
const templates=[
  ['imperial:fuente-justicia',128,128],['imperial:fuente-astral',128,128],['imperial:fuente-leones',128,128],
  ['imperial:kiosco',160,160],['imperial:carrito-mercado',128,96],['imperial:arbol-florido-blanco',128,128],['imperial:arbol-florido-azul',128,128],
  ['tree:oak-dense-dark',128,128],['tree:pine-tall-evergreen',88,144],['tree:willow-weeping',128,128],['tree:oak-broad-green',120,128],['tree:apple-red',120,128],['tree:birch-green',104,128],['tree:canopy-light-green',120,128],
  ['imperial:farola',64,96],['imperial:farola-monumental',64,96],['imperial:banco',128,96],
  ['imperial:jardinera-floral',128,96],['imperial:jardinera-curva',160,160],['imperial:topiario',96,96],['imperial:puente',160,128],['imperial:obelisco',96,128]
].map(([id,width,height])=>({id,label:id,family:id,category:'decor',width,height,placeable:true}));
const catalog={version:'semantic-kind-audit-v1',list:()=>templates,get:id=>templates.find(row=>row.id===id)||null};
const recipes=['KELO_ROYAL_CAPITAL_V1','KELO_VILLAGE_V1','KELO_FOREST_V1'];
const VISUAL_SEED=81746291;
const legacyRules=[
  [/\b(fountain|fuente)\b/,'imperial:fuente-justicia'],[/\b(market|mercado|commerce|shop)\b/,'imperial:kiosco'],
  [/\b(ancient tree|tree|arbol|grove)\b/,'imperial:arbol-florido-blanco'],[/\b(lamp|farola|light)\b/,'imperial:farola'],
  [/\b(bench|banco)\b/,'imperial:banco'],[/\b(flower|floral|garden|jardin)\b/,'imperial:jardinera-curva'],[/\b(bush|topiary|topiario)\b/,'imperial:topiario']
];
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]+/g,' ').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
let worlds=0,checked=0,culledDecorations=0,beforeWrong=0,afterWrong=0,beforeWrongKiosk=0,afterWrongKiosk=0,marketProps=0,marketPropBeforeArea=0,marketPropAfterArea=0;
const byKind={},assetCountsByKind={},styledTreeCounts={forest:0,farm:0,urban:0};
const FOREST_TREE_IDS=new Set(['tree:oak-dense-dark','tree:pine-tall-evergreen','tree:willow-weeping','tree:oak-broad-green']);
const FARM_TREE_IDS=new Set(['tree:apple-red','tree:birch-green','tree:canopy-light-green']);
const URBAN_TREE_IDS=new Set(['imperial:arbol-florido-blanco','imperial:arbol-florido-azul']);

function authoritativeKind(row){
  const text=normalize([row?.kind,row?.type,row?.family,row?.name,row?.label,row?.role].filter(Boolean).join(' '));
  if(/\b(fountain|fuente)\b/.test(text))return'fountain';
  if(/\bmarket prop\b/.test(text))return'market_prop';
  if(/\b(market|mercado|shop)\b/.test(text))return'market';
  if(/\b(ancient tree|tree|arbol|grove)\b/.test(text))return'tree';
  if(/\b(lamp|farola|light)\b/.test(text))return'lamp';
  if(/\b(bench|banco)\b/.test(text))return'bench';
  if(/\b(flower|floral|garden|jardin)\b/.test(text))return'flower';
  if(/\b(bush|topiary|topiario)\b/.test(text))return'bush';
  return null;
}
function legacyAsset(row){
  const text=normalize([row?.type,row?.family,row?.id,row?.name,row?.label,row?.role,row?.district].filter(Boolean).join(' '));
  for(const [test,assetId] of legacyRules)if(test.test(text))return assetId;
  return null;
}
function inspect(collection,placementKind,snapshot){
  const placements=new Map(snapshot.placements.map(row=>[row.placementId,row]));
  for(const [index,row] of collection.entries()){
    const kind=authoritativeKind(row); if(!kind)continue;
    const before=legacyAsset(row);
    if(before&&!EXPECTED[kind].includes(before)){beforeWrong+=1;if(before==='imperial:kiosco'&&kind!=='market')beforeWrongKiosk+=1;}
    const placementId=`map-forge:${placementKind}:${String(row?.id||index)}`;
    const placement=placements.get(placementId);
    if(!placement){
      assert.equal(placementKind,'decoration',`landmark semantic placement may not disappear: ${placementId}`);
      culledDecorations+=1;
      continue;
    }
    checked+=1; byKind[kind]=(byKind[kind]||0)+1;
    if(kind==='tree'&&placementKind==='decoration'){const district=String(row?.district||'');if(/^(dark_forest|woods|grove|deepwood)$/.test(district)){assert.ok(FOREST_TREE_IDS.has(placement.assetId),`${district} must use a forest tree, got ${placement.assetId}`);styledTreeCounts.forest++;}else if(/^(farms|fields)$/.test(district)){assert.ok(FARM_TREE_IDS.has(placement.assetId),`${district} must use a farm tree, got ${placement.assetId}`);styledTreeCounts.farm++;}else{assert.ok(URBAN_TREE_IDS.has(placement.assetId),`${district} must retain ceremonial trees, got ${placement.assetId}`);styledTreeCounts.urban++;}}
    assetCountsByKind[kind]??={};assetCountsByKind[kind][placement.assetId]=(assetCountsByKind[kind][placement.assetId]||0)+1;
    if(kind==='market_prop'){
      const template=templates.find(item=>item.id===placement.assetId);
      marketProps+=1;marketPropBeforeArea+=160*160;marketPropAfterArea+=(template?.width||0)*(template?.height||0);
    }
    if(!EXPECTED[kind].includes(placement.assetId)){afterWrong+=1;if(placement.assetId==='imperial:kiosco'&&kind!=='market')afterWrongKiosk+=1;}
  }
}

for(const recipeId of recipes){
  const recipe=getMapForgeRecipe(recipeId);
  for(let seed=1;seed<=20;seed++){
    const run=generateBestOf(recipe,{seed,count:4,assetCatalogVersion:catalog.version});
    assert(run.best?.validation?.valid,`${recipeId} seed ${seed} must produce a valid candidate`);
    const snapshot=mapDefinitionToWorldDraftSnapshot(run.best,{assetCatalog:catalog});
    inspect(run.best.landmarks||[],'landmark',snapshot);
    inspect(run.best.decorations||[],'decoration',snapshot);
    if(seed===1){
      const replay=generateBestOf(recipe,{seed,count:4,assetCatalogVersion:catalog.version});
      const replaySnapshot=mapDefinitionToWorldDraftSnapshot(replay.best,{assetCatalog:catalog});
      assert.deepEqual(replaySnapshot.placements,snapshot.placements,`${recipeId} projection must remain deterministic`);
    }
    worlds+=1;
  }
}
assert(checked>100,'corpus must exercise semantic placements heavily after footprint culling');
assert(culledDecorations>0,'corpus must exercise the real-footprint safety gate');
assert(beforeWrong>0,'legacy district-contaminated resolver must reproduce at least one wrong semantic placement');
assert(beforeWrongKiosk>0,'legacy resolver must reproduce non-market props becoming the oversized kiosk');
assert.equal(afterWrong,0,'intrinsic semantic kind must win over district labels');
assert.equal(afterWrongKiosk,0,'non-market props must never resolve to imperial:kiosco');
assert(marketProps>0,'corpus must exercise ordinary market props');
assert(marketPropAfterArea<marketPropBeforeArea,'ordinary market props must reduce projected footprint');
assert.ok(styledTreeCounts.forest>0&&styledTreeCounts.farm>0&&styledTreeCounts.urban>0,'corpus must exercise forest, farm and ceremonial tree palettes');
for(const kind of ['fountain','tree','lamp','flower'])assert(Object.keys(assetCountsByKind[kind]||{}).length>1,`${kind} must deterministically use more than the first available semantic asset`);
const visualRun=generateBestOf(getMapForgeRecipe('KELO_ROYAL_CAPITAL_V1'),{seed:VISUAL_SEED,count:4,assetCatalogVersion:catalog.version});
const visualSnapshot=mapDefinitionToWorldDraftSnapshot(visualRun.best,{assetCatalog:catalog});
const visualPlacementById=new Map(visualSnapshot.placements.map(row=>[row.placementId,row]));
const visualVariantCounts={};let visualResolved=0,visualProjectedArea=0;
for(const [collection,placementKind] of [[visualRun.best.landmarks||[],'landmark'],[visualRun.best.decorations||[],'decoration']])for(const [index,row] of collection.entries()){
  const kind=authoritativeKind(row);if(!kind)continue;const placement=visualPlacementById.get(`map-forge:${placementKind}:${String(row?.id||index)}`);if(!placement)continue;
  const template=templates.find(item=>item.id===placement.assetId);visualVariantCounts[kind]??={};visualVariantCounts[kind][placement.assetId]=(visualVariantCounts[kind][placement.assetId]||0)+1;visualResolved++;visualProjectedArea+=(template?.width||0)*(template?.height||0);
}
for(const kind of ['tree','lamp','flower'])assert(Object.keys(visualVariantCounts[kind]||{}).length>1,`visual seed ${VISUAL_SEED} must visibly exercise ${kind} variants`);

console.log(JSON.stringify({ok:true,worlds,recipes:recipes.length,seedsPerRecipe:20,deterministicReplays:recipes.length,checked,culledDecorations,before:{wrongSemanticPlacements:beforeWrong,wrongKioskConversions:beforeWrongKiosk,errorRatePct:Number((beforeWrong/Math.max(1,checked)*100).toFixed(2)),semanticVariantsPerFamily:1},after:{wrongSemanticPlacements:afterWrong,wrongKioskConversions:afterWrongKiosk,errorRatePct:Number((afterWrong/Math.max(1,checked)*100).toFixed(2)),assetCountsByKind,styledTreeCounts},visualSeed:{seed:VISUAL_SEED,layoutHash:visualRun.best.metadata.layoutHash,resolved:visualResolved,projectedArea:visualProjectedArea,variantCounts:visualVariantCounts},marketPropFootprint:{count:marketProps,beforePixels:marketPropBeforeArea,afterPixels:marketPropAfterArea,reductionPct:Number((100-marketPropAfterArea/marketPropBeforeArea*100).toFixed(2))},byKind},null,2));
