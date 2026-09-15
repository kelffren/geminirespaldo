/* KELO-INDEX
 * area: WORLD / MAP FORGE
 * owner: Map Forge regression audit
 * purpose: enforce a clear primary player spawn without sacrificing generated block density
 * public-api: CLI
 * consumes: map-forge recipes + deterministic core
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const SPAWN_CLEARANCE=96;
const BASELINE_BLOCKS=3954;
function rectIntersectsCircle(r,c,radius){const x=Math.max(r.x,Math.min(c.x,r.x+r.w)),y=Math.max(r.y,Math.min(c.y,r.y+r.h)),dx=x-c.x,dy=y-c.y;return dx*dx+dy*dy<radius*radius;}
function spawnBlockViolations(map){const spawn=map.spawnPoints?.[0];if(!spawn)return 0;return (map.blocks||[]).filter(block=>rectIntersectsCircle(block.bounds,spawn,SPAWN_CLEARANCE)).length;}

let mapsChecked=0,validMaps=0,totalBlocks=0,totalViolations=0,mapsWithViolations=0,relocations=0,maxShift=0,determinismChecks=0;
const stats={};
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let blocks=0,violations=0,affected=0,valid=0,moved=0,recipeMaxShift=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),found=spawnBlockViolations(map);
    mapsChecked++;blocks+=map.blocks.length;violations+=found;totalBlocks+=map.blocks.length;totalViolations+=found;
    if(found){affected++;mapsWithViolations++;}
    moved+=Number(map.generationStats?.spawnRelocations)||0;relocations+=Number(map.generationStats?.spawnRelocations)||0;
    recipeMaxShift=Math.max(recipeMaxShift,Number(map.generationStats?.spawnMaxShift)||0);maxShift=Math.max(maxShift,Number(map.generationStats?.spawnMaxShift)||0);
    if(map.validation?.valid){valid++;validMaps++;}
  }
  assert.equal(valid,100,`${id} must keep 100/100 fixed-seed maps valid`);
  stats[id]={seeds:100,valid,blocks,violations,affected,moved,maxShift:recipeMaxShift};
}
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,`${id}/${seed} must remain deterministic`);determinismChecks++;
}
assert.equal(validMaps,mapsChecked,'all fixed-seed maps must remain valid');
assert.equal(totalViolations,0,'primary spawn must keep 96px block clearance');
assert.equal(totalBlocks,BASELINE_BLOCKS,'spawn clearance must not reduce generated block population');
console.log(JSON.stringify({ok:true,spawnClearance:SPAWN_CLEARANCE,mapsChecked,validMaps,totalBlocks,totalViolations,mapsWithViolations,relocations,maxShift,determinismChecks,stats},null,2));
