/* KELO-INDEX
 * area: TEST / MAP FORGE / ORIENTATION
 * owner: Map Forge CI
 * purpose: keep visually upright decoration families unrotated while allowing only explicit directional families to face roads
 * public-api: CLI regression guard
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const SEEDS=[81746291,12345,424242,29011987];
const DIRECTIONAL=new Set(['bench','market_prop']);
const UPRIGHT=new Set(['tree','bush','flower','rock','lamp','crate','barrel']);
const VALID_ROTATIONS=new Set([0,90,180,270]);
const results=[];
let checkedUpright=0;
let checkedDirectional=0;
let normalized=0;

for(const [recipeId,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  for(const seed of SEEDS){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    assert.equal(map.validation.valid,true,`${recipeId}/${seed}: generated map must remain valid`);
    let upright=0,directional=0;
    for(const row of map.decorations||[]){
      const rotation=Number(row.rotation)||0;
      assert.ok(VALID_ROTATIONS.has(rotation),`${recipeId}/${seed}/${row.id}: invalid quarter-turn rotation ${rotation}`);
      if(UPRIGHT.has(row.family)){
        upright++;
        assert.equal(rotation,0,`${recipeId}/${seed}/${row.id}: ${row.family} is authored upright and must stay at 0 degrees`);
      }else if(DIRECTIONAL.has(row.family)){
        directional++;
      }
    }
    checkedUpright+=upright;
    checkedDirectional+=directional;
    normalized+=Number(map.generationStats?.decorationUprightNormalizedCount||0);
    results.push({recipeId,seed,upright,directional,normalized:Number(map.generationStats?.decorationUprightNormalizedCount||0)});
  }
}

assert.ok(checkedUpright>0,'must inspect upright decorations');
assert.ok(checkedDirectional>0,'must inspect directional decorations');
assert.ok(normalized>0,'guard must prove non-zero random source rotations were normalized away');
console.log(JSON.stringify({ok:true,seeds:SEEDS,checkedUpright,checkedDirectional,normalized,results},null,2));
