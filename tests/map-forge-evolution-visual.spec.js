/* KELO-INDEX
 * area: TEST / MAP FORGE / EVOLUTION / VISUAL
 * owner: Kelo Evolution browser evidence
 * purpose: render fixed-seed baseline and evolved champion previews through the real World Builder renderer and save screenshots/metrics
 * public-api: Playwright test
 * consumes: Map Forge evolution + draft importer + KELO_WORLD_BUILDER.renderSnapshotPreview
 * state-owned: test DOM only
 * do-not: no publish, LIVE mutation or visual score as sole acceptance authority
 */
const {test,expect}=require('@playwright/test');
const fs=require('fs');

test.use({viewport:{width:1180,height:760}});

test('Map Forge evolution emits real baseline/champion screenshots and performance evidence',async({page})=>{
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));fs.mkdirSync('test-results',{recursive:true});
  const response=await page.goto('/?mapEditor=1',{waitUntil:'domcontentloaded',timeout:30000});expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(()=>!!(window.KELO_WORLD_BUILDER?.renderSnapshotPreview&&window.KELO_PROPERTY_CATALOG),null,{timeout:15000});
  const evidence=await page.evaluate(async()=>{
    const {MAP_FORGE_RECIPES}=await import('./src/world/map-forge/map-forge-recipes.mjs');
    const {createMapForgeGenome,applyMapForgeGenome,evaluateMapForgeGenome,evolveMapForgeStyle}=await import('./src/world/map-forge/map-forge-evolution.mjs');
    const {generateBestOf}=await import('./src/world/map-forge/map-forge-core.mjs');
    const {mapDefinitionToWorldDraftSnapshot}=await import('./src/studio/adapters/map-forge-draft-importer.mjs');
    const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1,baselineGenome=createMapForgeGenome(recipe),options={seed:731991,generations:1,population:5,mutationStep:.9,goldenSeeds:2,validationSeeds:1,bestOf:2,minImprovement:.1,assetCatalogVersion:'visual-evolution-ci'},evolved=await evolveMapForgeStyle(recipe,options),baselineEvaluation=evaluateMapForgeGenome(recipe,{genome:baselineGenome,...options}),candidateEvaluation=evaluateMapForgeGenome(recipe,{genome:evolved.bestGenome,...options});
    const baseRecipe=applyMapForgeGenome(recipe,baselineGenome),champRecipe=applyMapForgeGenome(recipe,evolved.bestGenome),fixedSeed=81746291,baselineMap=generateBestOf(baseRecipe,{seed:fixedSeed,count:4,assetCatalogVersion:'visual-evolution-ci',style:baseRecipe.style}).best,championMap=generateBestOf(champRecipe,{seed:fixedSeed,count:4,assetCatalogVersion:'visual-evolution-ci',style:champRecipe.style}).best;
    const host=document.createElement('div');host.id='kelo-evolution-visual-evidence';host.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#080b10;color:#fff;display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px;font:700 12px system-ui';document.body.append(host);
    const render=(id,label,map)=>{const wrap=document.createElement('section');wrap.style.cssText='display:grid;grid-template-rows:auto 1fr;gap:8px;min-width:0';const title=document.createElement('div');title.textContent=label;const canvas=document.createElement('canvas');canvas.id=id;canvas.width=560;canvas.height=680;canvas.style.cssText='width:100%;height:100%;background:#071018;border:1px solid #ffffff22;border-radius:12px';wrap.append(title,canvas);host.append(wrap);const tileSize=Math.max(1,Number(window.KELO_WORLD_BUILDER?.tileSize||window.KELO_TILE_REGISTRY?.worldTileSize)||32),assetCatalog=window.KELO_PROPERTY_CATALOG||null,snapshot=mapDefinitionToWorldDraftSnapshot(map,{tileSize,worldWidth:map.worldBounds.w,worldHeight:map.worldBounds.h,assetCatalog});const t0=performance.now(),info=window.KELO_WORLD_BUILDER.renderSnapshotPreview(canvas,snapshot,{bounds:map.worldBounds,padding:14}),renderMs=performance.now()-t0;return{canvas,info,renderMs};};
    const base=render('kelo-evolution-baseline','BASELINE',baselineMap),champ=render('kelo-evolution-champion','CHAMPION / RESULT',championMap);await new Promise(resolve=>setTimeout(resolve,700));
    window.KELO_WORLD_BUILDER.renderSnapshotPreview(base.canvas,mapDefinitionToWorldDraftSnapshot(baselineMap,{tileSize:32,worldWidth:baselineMap.worldBounds.w,worldHeight:baselineMap.worldBounds.h,assetCatalog:window.KELO_PROPERTY_CATALOG}),{bounds:baselineMap.worldBounds,padding:14});window.KELO_WORLD_BUILDER.renderSnapshotPreview(champ.canvas,mapDefinitionToWorldDraftSnapshot(championMap,{tileSize:32,worldWidth:championMap.worldBounds.w,worldHeight:championMap.worldBounds.h,assetCatalog:window.KELO_PROPERTY_CATALOG}),{bounds:championMap.worldBounds,padding:14});
    const pixels=canvas=>{const ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let samples=0,lumSum=0,edge=0,nonBlack=0,prev=null;for(let i=0;i<data.length;i+=64){const lum=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722);lumSum+=lum;samples++;if(lum>8)nonBlack++;if(prev!==null)edge+=Math.abs(lum-prev);prev=lum;}return{samples,meanLuminance:lumSum/Math.max(1,samples),nonBlackRatio:nonBlack/Math.max(1,samples),edgeEnergy:edge/Math.max(1,samples-1)};};
    return{accepted:evolved.accepted,improvement:evolved.improvement,baselineScore:baselineEvaluation.score,candidateScore:candidateEvaluation.score,baselineHash:baselineMap.metadata.layoutHash,championHash:championMap.metadata.layoutHash,baselinePixels:pixels(base.canvas),championPixels:pixels(champ.canvas),baselineRenderMs:base.renderMs,championRenderMs:champ.renderMs,baselineGeneration:baselineEvaluation.performance,championGeneration:candidateEvaluation.performance};
  });
  await page.locator('#kelo-evolution-baseline').screenshot({path:'test-results/map-forge-evolution-baseline.png'});await page.locator('#kelo-evolution-champion').screenshot({path:'test-results/map-forge-evolution-champion.png'});await page.screenshot({path:'test-results/map-forge-evolution-side-by-side.png',fullPage:true});fs.writeFileSync('test-results/map-forge-evolution-visual-metrics.json',JSON.stringify(evidence,null,2));
  expect(evidence.baselinePixels.nonBlackRatio).toBeGreaterThan(.2);expect(evidence.championPixels.nonBlackRatio).toBeGreaterThan(.2);expect(evidence.baselinePixels.edgeEnergy).toBeGreaterThan(.5);expect(evidence.championPixels.edgeEnergy).toBeGreaterThan(.5);if(evidence.accepted)expect(evidence.candidateScore).toBeGreaterThanOrEqual(evidence.baselineScore+.099);expect(pageErrors).toEqual([]);
});
