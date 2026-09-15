/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for non-overlapping buildable blocks
 * public-api: CLI
 * consumes: map-forge recipes + pure core
 * state-owned: none
 * do-not: no browser/runtime assertions
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

function overlaps(a,b,pad=0){
  return !(a.x+a.w+pad<=b.x-pad||b.x+b.w+pad<=a.x-pad||a.y+a.h+pad<=b.y-pad||b.y+b.h+pad<=a.y-pad);
}

const stats={};
let totalPairs=0,totalOverlaps=0,totalRejects=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let pairs=0,overlapCount=0,rejects=0,minBlocks=Infinity,maxBlocks=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    minBlocks=Math.min(minBlocks,map.blocks.length);maxBlocks=Math.max(maxBlocks,map.blocks.length);
    rejects+=map.generationStats.blockOverlapRejects||0;
    for(let i=0;i<map.blocks.length;i++)for(let j=i+1;j<map.blocks.length;j++){
      pairs++;
      if(overlaps(map.blocks[i].bounds,map.blocks[j].bounds,12))overlapCount++;
    }
  }
  totalPairs+=pairs;totalOverlaps+=overlapCount;totalRejects+=rejects;
  stats[id]={seeds:100,pairs,overlaps:overlapCount,blockOverlapRejects:rejects,minBlocks,maxBlocks};
  assert.equal(overlapCount,0,`${id} produced overlapping/near-touching buildable blocks`);
}
assert.ok(totalPairs>0,'audit must compare generated block pairs');
assert.ok(totalRejects>0,'fixed-seed audit must exercise the block-overlap rejection path');
assert.equal(totalOverlaps,0,'300 fixed-seed maps must contain zero overlapping buildable block pairs');
console.log(JSON.stringify({ok:true,totalPairs,totalOverlaps,totalRejects,stats},null,2));
