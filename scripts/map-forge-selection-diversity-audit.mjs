/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for useful, non-duplicate best-of visual alternatives
 * public-api: CLI
 * consumes: map-forge recipes + pure core
 * state-owned: none
 * do-not: no browser/runtime assertions
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateBestOf} from '../src/world/map-forge/map-forge-core.mjs';

const hash=map=>map?.metadata?.layoutHash||null;
const uniqueCount=selections=>new Set(Object.values(selections).map(hash).filter(Boolean)).size;
const legacySelections=candidates=>{
  const sorted=[...candidates];
  const pick=maximizer=>sorted.length?[...sorted].sort((a,b)=>maximizer(b)-maximizer(a)||b.quality.total-a.quality.total||String(hash(a)).localeCompare(String(hash(b))))[0]:null;
  return {
    bestOverall:sorted[0]||null,
    mostMonumental:pick(m=>m.quality.breakdown.landmarkQuality+m.quality.breakdown.visualComposition),
    mostOrganic:pick(m=>m.quality.breakdown.negativeSpace+m.quality.breakdown.scenicVistas),
    mostExplorable:pick(m=>m.quality.breakdown.navigation+m.quality.breakdown.districtVariety),
    mostCompact:pick(m=>100-(m.generationStats.roadCount+m.generationStats.blockCount))
  };
};

const stats={};
let runs=0,legacyUniqueTotal=0,currentUniqueTotal=0,legacyDuplicateRuns=0,currentDuplicateRuns=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let recipeLegacy=0,recipeCurrent=0,recipeLegacyDup=0,recipeCurrentDup=0;
  for(let seed=1;seed<=100;seed++){
    const result=generateBestOf(recipe,{seed,count:8,assetCatalogVersion:'ci-catalog'});
    assert.ok(result.validCount>=5,`${id}:${seed}: fixed corpus needs at least five valid candidates`);
    const legacy=uniqueCount(legacySelections(result.candidates)),current=uniqueCount(result.selections);
    recipeLegacy+=legacy;recipeCurrent+=current;
    if(legacy<5)recipeLegacyDup++;
    if(current<5)recipeCurrentDup++;
    assert.equal(current,5,`${id}:${seed}: best-of must expose five distinct useful alternatives when five candidates exist`);
    const repeat=generateBestOf(recipe,{seed,count:8,assetCatalogVersion:'ci-catalog'});
    assert.deepEqual(Object.values(result.selections).map(hash),Object.values(repeat.selections).map(hash),`${id}:${seed}: diversified selections must stay deterministic`);
    runs++;
  }
  legacyUniqueTotal+=recipeLegacy;currentUniqueTotal+=recipeCurrent;legacyDuplicateRuns+=recipeLegacyDup;currentDuplicateRuns+=recipeCurrentDup;
  stats[id]={runs:100,legacyUniqueAvg:+(recipeLegacy/100).toFixed(3),currentUniqueAvg:+(recipeCurrent/100).toFixed(3),legacyDuplicateRuns:recipeLegacyDup,currentDuplicateRuns:recipeCurrentDup};
}
assert.equal(runs,300,'expected 300 representative best-of runs');
assert.ok(legacyDuplicateRuns>0,'fixed corpus must prove the former independent selectors duplicated alternatives');
assert.equal(currentDuplicateRuns,0,'diversified selectors must remove duplicate alternative sets across the fixed corpus');
assert.ok(currentUniqueTotal>legacyUniqueTotal,'selection diversity must improve over the former independent selector behavior');
console.log(JSON.stringify({ok:true,runs,legacyUniqueAvg:+(legacyUniqueTotal/runs).toFixed(3),currentUniqueAvg:+(currentUniqueTotal/runs).toFixed(3),legacyDuplicateRuns,currentDuplicateRuns,stats},null,2));
