/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard preventing decoration-heavy sparse capitals from retaining 95+ elite scores
 * public-api: CLI
 * consumes: Royal Capital recipe + generator/scorer
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {scoreMapDefinition,validateMapDefinition} from '../src/world/map-forge/map-forge-quality.mjs';

const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
const seeds=[81746291,12345,424242,29011987];
const results=[];
for(const seed of seeds){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: production capital must remain structurally valid`);
  const blocks=map.blocks?.length||0,decorations=map.decorations?.length||0,districts=map.districts?.length||1;
  const blocksPerDistrict=blocks/districts,decorationsPerBlock=decorations/Math.max(1,blocks);
  assert.ok(blocksPerDistrict<2.5&&decorationsPerBlock>9.5,`${seed}: regression seed no longer reproduces sparse/decor-heavy fabric; update the fixture only after visual review`);
  assert.ok(map.quality.total<=94,`${seed}: sparse decoration-heavy capital must not retain 95+ elite score, got ${map.quality.total}`);
  results.push({seed,score:map.quality.total,blocks,decorations,blocksPerDistrict:Number(blocksPerDistrict.toFixed(3)),decorationsPerBlock:Number(decorationsPerBlock.toFixed(3))});
}

const source=generateMapCandidate(recipe,{seed:81746291,assetCatalogVersion:'ci-catalog'});
const severe=JSON.parse(JSON.stringify(source));
severe.blocks=severe.blocks.slice(0,Math.max(1,Math.floor(severe.blocks.length*.5)));
const structural=validateMapDefinition(severe,recipe);
assert.equal(structural.valid,true,'severe fabric fixture must remain structurally valid so the scorer gate is isolated');
const severeScore=scoreMapDefinition(severe,recipe,structural);
assert.ok(severeScore.total<=89,`severely sparse decoration-heavy capital must cap below 90, got ${severeScore.total}`);

const zeroBlock=JSON.parse(JSON.stringify(source));
zeroBlock.blocks=[];
zeroBlock.parcels=[];
const zeroBlockStructural=validateMapDefinition(zeroBlock,recipe);
assert.equal(zeroBlockStructural.valid,true,'zero-block capital fixture must remain structurally valid so the scorer gate is isolated');
const zeroBlockScore=scoreMapDefinition(zeroBlock,recipe,zeroBlockStructural);
assert.ok(zeroBlockScore.total<=89,`capital with no urban blocks must cap below 90, got ${zeroBlockScore.total}`);

console.log(JSON.stringify({ok:true,seeds:results,severeScore:severeScore.total,zeroBlockScore:zeroBlockScore.total},null,2));
