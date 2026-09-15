/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for landmark focal clearance against generated building blocks
 * public-api: CLI
 * consumes: map-forge recipes + deterministic core
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const BASELINE_BLOCKS=4566;
const MIN_RETENTION=.85;
function rectIntersectsCircle(r,c,radius){const x=Math.max(r.x,Math.min(c.x,r.x+r.w)),y=Math.max(r.y,Math.min(c.y,r.y+r.h)),dx=x-c.x,dy=y-c.y;return dx*dx+dy*dy<radius*radius;}
function clearanceViolations(map){let n=0;for(const block of map.blocks||[])for(const landmark of map.landmarks||[]){const radius=Math.max(0,Number(landmark.clearance?.radius)||0);if(radius&&rectIntersectsCircle(block.bounds,landmark.position,radius)){n++;break;}}return n;}

let mapsChecked=0,validMaps=0,totalBlocks=0,totalViolations=0,totalClearanceRejects=0,determinismChecks=0;
const stats={};
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let blocks=0,violations=0,valid=0,clearanceRejects=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    const found=clearanceViolations(map),rejected=Number(map.generationStats?.blockLandmarkClearanceRejects)||0;
    mapsChecked++;blocks+=map.blocks.length;violations+=found;clearanceRejects+=rejected;totalBlocks+=map.blocks.length;totalViolations+=found;totalClearanceRejects+=rejected;
    if(map.validation?.valid){valid++;validMaps++;}
  }
  assert.equal(valid,100,`${id} must keep 100/100 fixed-seed maps valid`);
  stats[id]={seeds:100,valid,blocks,violations,clearanceRejects,violationRate:Number((violations/Math.max(1,blocks)*100).toFixed(3))};
}
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,`${id}/${seed} must remain deterministic`);determinismChecks++;
}
const populationRetention=totalBlocks/BASELINE_BLOCKS;
assert.equal(validMaps,mapsChecked,'all fixed-seed maps must remain valid');
assert.equal(totalViolations,0,'generated blocks must stay outside full landmark clearance radius');
assert.ok(totalClearanceRejects>0,'landmark-clearance placement guard must be exercised by the fixed-seed corpus');
assert.ok(populationRetention>=MIN_RETENTION,`block population retention must stay >= ${MIN_RETENTION*100}% of baseline`);
console.log(JSON.stringify({ok:true,mapsChecked,validMaps,baselineBlocks:BASELINE_BLOCKS,totalBlocks,populationRetention:Number((populationRetention*100).toFixed(2)),baselineViolations:706,totalViolations,violationRate:Number((totalViolations/Math.max(1,totalBlocks)*100).toFixed(3)),totalClearanceRejects,determinismChecks,stats},null,2));