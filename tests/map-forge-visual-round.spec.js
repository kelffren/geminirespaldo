/* KELO-INDEX
 * area: TEST / MAP FORGE / VISUAL ROUND
 * owner: Map Forge visual convergence CI
 * purpose: capture deterministic fixed-seed preview + real exterior evidence and validate representative seeds
 * public-api: Playwright test
 * consumes: Map Forge workspace, World Builder preview/runtime, golden seeds
 * state-owned: test-results evidence only
 * do-not: no publish or LIVE mutation
 */
const {test,expect}=require('@playwright/test');
const fs=require('fs');

const MAIN_SEED=81746291;
const VALIDATION_SEEDS=[81746291,12345,424242,29011987];
const STAGE=process.env.KELO_VISUAL_STAGE==='after'?'after':'before';
const URBAN_KINDS=new Set(['plaza','royal','commerce']);
const DIRECTIONAL_FAMILIES=new Set(['bench','market_prop']);
const DECORATION_MIN=195;
const DECORATION_MAX=215;
const VALIDATION_QUALITY_MIN=94;
const VALIDATION_VISTAS_MIN=81;
const VALIDATION_SPACE_MIN=78;
const LOCAL_SAME_FAMILY_MAX=0.04;
const FACING_ROTATIONS=Object.freeze({south:0,southwest:1,west:1,northwest:2,north:2,northeast:2,east:3,southeast:3});

test.use({viewport:{width:1440,height:900}});
test.setTimeout(90000);

function pointSegmentDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
  return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));
}
function nearestRoadDistance(p,roads){
  let best=Infinity;
  for(const road of roads||[])for(let i=1;i<(road.polyline||[]).length;i++)best=Math.min(best,pointSegmentDistance(p,road.polyline[i-1],road.polyline[i]));
  return best;
}
function decorationRhythmMetrics(map){
  const decorations=map.decorations||[],nearestDistances=[];
  let localNeighborCount=0,localSameFamilyCount=0;
  for(let i=0;i<decorations.length;i++){
    const current=decorations[i];let nearest=null,best=Infinity;
    for(let j=0;j<decorations.length;j++){
      if(i===j)continue;
      const candidate=decorations[j];
      if(candidate.district!==current.district)continue;
      const distance=Math.hypot(candidate.x-current.x,candidate.y-current.y);
      if(distance<best){best=distance;nearest=candidate;}
    }
    if(!nearest||!Number.isFinite(best))continue;
    nearestDistances.push(best);
    if(best<=220){localNeighborCount++;if(nearest.family===current.family)localSameFamilyCount++;}
  }
  const mean=nearestDistances.length?nearestDistances.reduce((sum,value)=>sum+value,0)/nearestDistances.length:0;
  const variance=nearestDistances.length?nearestDistances.reduce((sum,value)=>sum+(value-mean)**2,0)/nearestDistances.length:0;
  return{
    nearestSpacingMean:Number(mean.toFixed(2)),
    nearestSpacingCv:mean?Number((Math.sqrt(variance)/mean).toFixed(4)):0,
    localNeighborCount,
    localSameFamilyCount,
    localSameFamilyRatio:localNeighborCount?Number((localSameFamilyCount/localNeighborCount).toFixed(4)):0
  };
}
function scenePairMetrics(map){
  let completePairs=0,orphanPairs=0;
  for(const scene of map.scenePrefabs||[]){
    const groups=new Map();
    for(const member of scene.members||[]){
      const match=String(member.role||'').match(/^(.*)-(left|right)$/);if(!match)continue;
      const sides=groups.get(match[1])||new Set();sides.add(match[2]);groups.set(match[1],sides);
    }
    for(const sides of groups.values()){if(sides.size===2)completePairs++;else orphanPairs++;}
  }
  const exitScenes=(map.scenePrefabs||[]).filter(scene=>scene.sceneType==='exit');
  return{scenePrefabCount:(map.scenePrefabs||[]).length,sceneCompletePairCount:completePairs,sceneOrphanPairCount:orphanPairs,scenePairRollbackCount:Number(map.generationStats?.scenePrefabPairRollbackCount||0),exitSceneCount:exitScenes.length,exitSceneMovedCount:Number(map.generationStats?.exitSceneMovedCount||0),exitSceneMovementDistance:Number(map.generationStats?.exitSceneMovementDistance||0)};
}
function mapMetrics(map){
  const districtById=new Map((map.districts||[]).map(d=>[d.id,d]));
  const decorations=map.decorations||[];
  const urban=decorations.filter(d=>URBAN_KINDS.has(districtById.get(d.district)?.kind));
  const upright=decorations.filter(d=>!DIRECTIONAL_FAMILIES.has(d.family));
  const uprightRotated=upright.filter(d=>((Number(d.rotation)||0)%360+360)%360!==0);
  const roadDistances=urban.map(d=>nearestRoadDistance(d,map.roads));
  const streetscape=urban.filter((decoration,index)=>decoration.scenePrefabId||(roadDistances[index]>=35&&roadDistances[index]<=190)).length;
  const familyCounts={};for(const d of decorations)familyCounts[d.family]=(familyCounts[d.family]||0)+1;
  const uprightRotationCounts={};for(const d of upright){const key=String(((Number(d.rotation)||0)%360+360)%360);uprightRotationCounts[key]=(uprightRotationCounts[key]||0)+1;}
  return{
    seed:map.metadata?.seed,
    generatorVersion:map.metadata?.generatorVersion,
    layoutHash:map.metadata?.layoutHash,
    valid:!!map.validation?.valid,
    errors:map.validation?.errors||[],
    qualityTotal:Number(map.quality?.total||0),
    scenicVistas:Number(map.quality?.breakdown?.scenicVistas||0),
    negativeSpace:Number(map.quality?.breakdown?.negativeSpace||0),
    assetVariety:Number(map.quality?.breakdown?.assetVariety||0),
    roadCount:(map.roads||[]).length,
    blockCount:(map.blocks||[]).length,
    decorationCount:decorations.length,
    declusterSwapCount:Number(map.generationStats?.decorationDeclusterSwapCount||0),
    naturalClusterAttemptCount:Number(map.generationStats?.decorationNaturalClusterAttemptCount||0),
    naturalClusterAcceptedCount:Number(map.generationStats?.decorationNaturalClusterAcceptedCount||0),
    landmarkRoadFacingCount:Number(map.generationStats?.landmarkRoadFacingCount||0),
    landmarkRoadFacingChangedCount:Number(map.generationStats?.landmarkRoadFacingChangedCount||0),
    uprightDecorationCount:upright.length,
    uprightRotatedCount:uprightRotated.length,
    uprightNormalizedCount:Number(map.generationStats?.decorationUprightNormalizedCount||0),
    uprightRotationCounts,
    urbanDecorationCount:urban.length,
    urbanStreetscapeCount:streetscape,
    urbanStreetscapeRatio:urban.length?Number((streetscape/urban.length).toFixed(4)):1,
    familyCounts,
    ...decorationRhythmMetrics(map),
    ...scenePairMetrics(map)
  };
}
function landmarkFacingEvidence(map,runtime){
  const expected=(map.landmarks||[]).map(row=>({id:String(row.id||''),facing:String(row.frontage?.facing||row.facing||'south').toLowerCase(),rotation:FACING_ROTATIONS[String(row.frontage?.facing||row.facing||'south').toLowerCase()]??0,source:String(row.frontage?.source||'recipe')}));
  const actual=new Map((runtime.landmarkPlacements||[]).map(row=>[String(row.placementId||'').replace(/^map-forge:landmark:/,''),Number(row.rotation)]));
  const resolved=expected.filter(row=>actual.has(row.id)).map(row=>({...row,actualRotation:actual.get(row.id),matches:actual.get(row.id)===row.rotation}));
  return{expected,resolved,resolvedCount:resolved.length,mismatchCount:resolved.filter(row=>!row.matches).length,mismatches:resolved.filter(row=>!row.matches)};
}

async function bootForge(page){
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  const response=await page.goto('/?mapEditor=1&offline=1',{waitUntil:'commit',timeout:15000});
  expect(response.status()).toBeLessThan(400);
  await page.waitForSelector('body',{timeout:10000});
  await page.evaluate(async()=>{
    const {bootKeloCreators}=await import('./src/creators/creator-entry.mjs');
    const platform=await bootKeloCreators({root:window});
    window.__KELO_TEST_MAP_FORGE_WORKSPACE__=await platform.openWorkspace('map-forge');
  });
  const forge=page.locator('#kelo-map-forge');await expect(forge).toBeVisible({timeout:20000});
  return{forge,pageErrors};
}

// KELO-INDEX QA/ASSET-READY blocks current captures until every projected sprite has rendered.
async function waitForPreviewAssets(forge){
  const contract=forge.locator('[data-preview-assets-expected]');
  if(await contract.count()){
    await expect.poll(async()=>contract.evaluate(node=>Number(node.dataset.previewAssetsExpected)>0&&Number(node.dataset.previewAssets)>=Number(node.dataset.previewAssetsExpected)),{timeout:20000,message:'all projected Map Forge sprites must render before visual evidence is captured'}).toBe(true);
    return;
  }
  await forge.evaluate(()=>new Promise(resolve=>setTimeout(resolve,2000)));
}

async function generateSelected(page,forge,seed){
  await page.getByRole('spinbutton',{name:/Seed/}).fill(String(seed));
  await page.getByRole('combobox',{name:'Candidatos'}).selectOption({label:'Best of 4'});
  await page.getByRole('button',{name:'GENERAR'}).click();
  await expect(forge.getByText(/4\/4 válidos/)).toBeVisible({timeout:15000});
  await forge.getByRole('button').filter({hasText:`Seed ${seed}`}).first().click();
  for(let attempt=0;attempt<50;attempt++){
    const map=await page.evaluate(expected=>{const selected=window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected;return selected?.metadata?.seed===expected?JSON.parse(JSON.stringify(selected)):null;},seed);
    if(map)return map;
    await page.waitForTimeout(100);
  }
  throw new Error(`Map Forge selected map ${seed} was not available for visual evidence`);
}

test(`Map Forge ${STAGE} fixed-seed preview/runtime visual evidence`,async({page})=>{
  fs.mkdirSync('test-results',{recursive:true});
  const {forge,pageErrors}=await bootForge(page);
  const mainMap=await generateSelected(page,forge,MAIN_SEED);
  await waitForPreviewAssets(forge);
  const mainMetrics=mapMetrics(mainMap);
  expect(mainMetrics.valid).toBe(true);expect(mainMetrics.errors).toEqual([]);
  if(STAGE==='after'){
    expect(mainMetrics.urbanStreetscapeRatio).toBe(1);
    expect(mainMetrics.decorationCount).toBeGreaterThanOrEqual(DECORATION_MIN);
    expect(mainMetrics.decorationCount).toBeLessThanOrEqual(DECORATION_MAX);
    expect(mainMetrics.qualityTotal).toBeGreaterThanOrEqual(94);
    expect(mainMetrics.scenicVistas).toBeGreaterThanOrEqual(82);
    expect(mainMetrics.negativeSpace).toBeGreaterThanOrEqual(78);
    expect(mainMetrics.declusterSwapCount).toBeGreaterThan(0);
    expect(mainMetrics.naturalClusterAcceptedCount).toBeGreaterThanOrEqual(8);
    expect(mainMetrics.localSameFamilyRatio).toBeLessThanOrEqual(LOCAL_SAME_FAMILY_MAX);
    expect(mainMetrics.landmarkRoadFacingCount).toBeGreaterThanOrEqual(3);
    expect(mainMetrics.landmarkRoadFacingChangedCount).toBeGreaterThan(0);
    expect(mainMetrics.scenePrefabCount).toBeGreaterThan(0);
    expect(mainMetrics.sceneCompletePairCount).toBeGreaterThan(0);
    expect(mainMetrics.sceneOrphanPairCount).toBe(0);
    expect(mainMetrics.exitSceneCount).toBeGreaterThanOrEqual(2);
    expect(mainMetrics.exitSceneMovedCount).toBeGreaterThanOrEqual(4);
    expect(mainMetrics.exitSceneMovementDistance).toBeGreaterThan(0);
    expect(mainMetrics.uprightDecorationCount).toBeGreaterThan(0);
    expect(mainMetrics.uprightRotatedCount).toBe(0);
    expect(mainMetrics.uprightNormalizedCount).toBeGreaterThan(0);
  }
  await page.screenshot({path:`test-results/screenshot_preview_${STAGE}.png`,fullPage:true});

  await page.getByRole('button',{name:'VER EN MAPA EXTERIOR'}).click();
  await expect(forge).toHaveCount(0,{timeout:1000});
  await expect(page.getByRole('button',{name:'VOLVER A MAP FORGE'})).toBeVisible({timeout:15000});
  const runtime=await page.evaluate(()=>{const snapshot=window.KELO_WORLD_BUILDER.snapshot(),placements=window.KELO_PROPERTY_SYSTEM.getPlacements('parcel:world:editor')||[];return{viewKind:snapshot?.view?.kind||null,cellCount:Object.keys(snapshot?.cells||{}).length,placementCount:placements.length,landmarkPlacements:placements.filter(p=>String(p?.placementId||'').startsWith('map-forge:landmark:')).map(p=>({placementId:p.placementId,assetId:p.assetId,rotation:Number(p.rotation)}))};});
  expect(runtime.viewKind).toBe('preview');expect(runtime.cellCount).toBeGreaterThan(5000);expect(runtime.placementCount).toBeGreaterThan(0);
  const landmarkFacing=landmarkFacingEvidence(mainMap,runtime);
  if(STAGE==='after'){
    expect(landmarkFacing.resolvedCount).toBeGreaterThan(0);
    expect(landmarkFacing.mismatchCount).toBe(0);
    const roadFacingResolved=landmarkFacing.resolved.filter(row=>row.source==='nearest-road');
    expect(roadFacingResolved.length).toBeGreaterThanOrEqual(3);
    expect(roadFacingResolved.every(row=>row.matches)).toBe(true);
  }
  await page.screenshot({path:`test-results/screenshot_runtime_${STAGE}.png`,fullPage:true});

  await page.getByRole('button',{name:'VOLVER A MAP FORGE'}).click();
  await expect(page.locator('#kelo-map-forge')).toBeVisible({timeout:15000});
  const validation=[];
  for(const seed of VALIDATION_SEEDS){
    const map=await generateSelected(page,page.locator('#kelo-map-forge'),seed),metrics=mapMetrics(map);
    expect(metrics.valid).toBe(true);expect(metrics.errors).toEqual([]);
    if(STAGE==='after'){
      expect(metrics.urbanStreetscapeRatio).toBe(1);
      expect(metrics.decorationCount).toBeGreaterThanOrEqual(DECORATION_MIN);
      expect(metrics.decorationCount).toBeLessThanOrEqual(DECORATION_MAX);
      expect(metrics.qualityTotal).toBeGreaterThanOrEqual(VALIDATION_QUALITY_MIN);
      expect(metrics.scenicVistas).toBeGreaterThanOrEqual(VALIDATION_VISTAS_MIN);
      expect(metrics.negativeSpace).toBeGreaterThanOrEqual(VALIDATION_SPACE_MIN);
      expect(metrics.declusterSwapCount).toBeGreaterThan(0);
      expect(metrics.naturalClusterAcceptedCount).toBeGreaterThanOrEqual(8);
      expect(metrics.localSameFamilyRatio).toBeLessThanOrEqual(LOCAL_SAME_FAMILY_MAX);
      expect(metrics.landmarkRoadFacingCount).toBeGreaterThanOrEqual(3);
      expect(metrics.sceneOrphanPairCount).toBe(0);
      expect(metrics.uprightDecorationCount).toBeGreaterThan(0);
      expect(metrics.uprightRotatedCount).toBe(0);
    }
    validation.push(metrics);
  }
  const evidence={stage:STAGE,mainSeed:MAIN_SEED,validationSeeds:VALIDATION_SEEDS,decorationBand:[DECORATION_MIN,DECORATION_MAX],localSameFamilyMax:LOCAL_SAME_FAMILY_MAX,main:mainMetrics,runtime,landmarkFacing,validation,pageErrors};
  fs.writeFileSync(`test-results/map-forge-visual-metrics-${STAGE}.json`,JSON.stringify(evidence,null,2));
  expect(pageErrors).toEqual([]);
});
