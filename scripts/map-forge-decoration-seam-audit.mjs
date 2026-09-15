/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for cross-district decoration spacing
 * public-api: CLI
 * consumes: map-forge recipes + pure core
 * state-owned: none
 * do-not: no browser/runtime assertions
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const spacingForKind=kind=>kind==='forest'?70:88;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const ROUNDING_TOLERANCE=.2;

const stats={};
let totalPairs=0,totalViolations=0,totalRejects=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let pairs=0,violations=0,rejects=0,minObserved=Infinity;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    const districtKind=new Map(map.districts.map(d=>[d.id,d.kind]));
    rejects+=map.generationStats.decorationSeamRejects||0;
    for(let i=0;i<map.decorations.length;i++)for(let j=i+1;j<map.decorations.length;j++){
      const a=map.decorations[i],b=map.decorations[j];
      if(a.district===b.district)continue;
      const required=Math.min(spacingForKind(districtKind.get(a.district)),spacingForKind(districtKind.get(b.district)));
      const observed=distance(a,b);
      pairs++;
      minObserved=Math.min(minObserved,observed);
      if(observed<required-ROUNDING_TOLERANCE)violations++;
    }
  }
  totalPairs+=pairs;totalViolations+=violations;totalRejects+=rejects;
  stats[id]={seeds:100,pairs,violations,decorationSeamRejects:rejects,minObserved:Number.isFinite(minObserved)?Number(minObserved.toFixed(2)):null};
  assert.equal(violations,0,`${id} produced cross-district decorations below the shared Poisson spacing`);
}

for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  const b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.deepEqual(a.decorations,b.decorations,`${id}/${seed} decoration layout must stay deterministic`);
  assert.equal(a.generationStats.decorationSeamRejects,b.generationStats.decorationSeamRejects,`${id}/${seed} seam rejection count must stay deterministic`);
}

assert.ok(totalPairs>0,'audit must compare decorations across district boundaries');
assert.ok(totalRejects>0,'fixed-seed audit must exercise the cross-district spacing rejection path');
assert.equal(totalViolations,0,'300 fixed-seed maps must contain zero cross-district spacing violations');
console.log(JSON.stringify({ok:true,totalPairs,totalViolations,totalRejects,determinismChecks:Object.keys(MAP_FORGE_RECIPES).length*4,stats},null,2));
