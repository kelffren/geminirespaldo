/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for decoration, building-block and buildable-parcel district spatial coherence
 * public-api: CLI
 * consumes: map-forge recipes + pure core + quality scorer
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

function ownerAt(map,p){let owner=null,best=Infinity;for(const d of map.districts||[]){const dx=p.x-d.center.x,dy=p.y-d.center.y,cost=(dx*dx+dy*dy)/Math.max(.2,Number(d.weight)||1);if(cost<best){best=cost;owner=d.id;}}return owner;}
function mismatchCount(map){let n=0;for(const row of map.decorations||[])if(ownerAt(map,row)!==row.district)n++;return n;}
function blockMismatchCount(map){let n=0;for(const block of map.blocks||[]){const r=block.bounds,p={x:r.x+r.w/2,y:r.y+r.h/2};if(ownerAt(map,p)!==block.district)n++;}return n;}
function rectInsetCorners(r,inset=4){const x0=r.x+Math.min(inset,r.w/2),x1=r.x+r.w-Math.min(inset,r.w/2),y0=r.y+Math.min(inset,r.h/2),y1=r.y+r.h-Math.min(inset,r.h/2);return[{x:x0,y:y0},{x:x1,y:y0},{x:x0,y:y1},{x:x1,y:y1}];}
function parcelBoundaryMismatchCount(map){let n=0;for(const parcel of map.parcels||[])if(rectInsetCorners(parcel.buildableArea).some(p=>ownerAt(map,p)!==parcel.district))n++;return n;}

const BASELINE_DECORATIONS=54597;
const BASELINE_MISMATCHES=13052;
// Production baselines after district-ownership and semantic-paving guards removed geometry that no
// longer satisfies current placement contracts. Preserve the 98% retention gates so future density
// losses still fail instead of silently redefining the corpus.
const BASELINE_BLOCKS=3954;
const BASELINE_BLOCK_MISMATCHES=1;
const BASELINE_PARCELS=4567;
const BASELINE_PARCEL_BOUNDARY_MISMATCHES=34;
const stats={};
let mapsChecked=0,totalDecorations=0,totalMismatches=0,totalDistrictRejects=0,totalBlocks=0,totalBlockMismatches=0,totalBlockDistrictRejects=0,totalParcels=0,totalParcelBoundaryMismatches=0,totalParcelDistrictRejects=0,totalDeterminismChecks=0,validMaps=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let decorations=0,mismatches=0,districtRejects=0,blocks=0,blockMismatches=0,blockDistrictRejects=0,parcels=0,parcelBoundaryMismatches=0,parcelDistrictRejects=0,minCoherence=100,maxCoherence=0,valid=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    const mismatch=mismatchCount(map),blockMismatch=blockMismatchCount(map),parcelBoundaryMismatch=parcelBoundaryMismatchCount(map),coherence=map.quality?.breakdown?.districtCoherence,rejects=map.generationStats?.decorationDistrictRejects,blockRejects=map.generationStats?.blockDistrictRejects,parcelRejects=map.generationStats?.parcelDistrictRejects;
    assert.ok(Number.isFinite(coherence),`${id}/${seed} must expose districtCoherence`);
    assert.equal(mismatch,0,`${id}/${seed} decorations must remain inside their weighted spatial district`);
    assert.equal(blockMismatch,0,`${id}/${seed} building blocks must remain centered inside their weighted spatial district`);
    assert.equal(parcelBoundaryMismatch,0,`${id}/${seed} buildable parcel corners must remain inside their weighted spatial district`);
    assert.equal(coherence,100,`${id}/${seed} districtCoherence must be perfect after placement filtering`);
    assert.ok(Number.isFinite(rejects)&&rejects>=0,`${id}/${seed} must expose decorationDistrictRejects`);
    assert.ok(Number.isFinite(blockRejects)&&blockRejects>=0,`${id}/${seed} must expose blockDistrictRejects`);
    assert.ok(Number.isFinite(parcelRejects)&&parcelRejects>=0,`${id}/${seed} must expose parcelDistrictRejects`);
    if(map.validation?.valid){valid++;validMaps++;}
    mapsChecked++;decorations+=map.decorations.length;mismatches+=mismatch;districtRejects+=rejects;blocks+=map.blocks.length;blockMismatches+=blockMismatch;blockDistrictRejects+=blockRejects;parcels+=map.parcels.length;parcelBoundaryMismatches+=parcelBoundaryMismatch;parcelDistrictRejects+=parcelRejects;totalDecorations+=map.decorations.length;totalMismatches+=mismatch;totalDistrictRejects+=rejects;totalBlocks+=map.blocks.length;totalBlockMismatches+=blockMismatch;totalBlockDistrictRejects+=blockRejects;totalParcels+=map.parcels.length;totalParcelBoundaryMismatches+=parcelBoundaryMismatch;totalParcelDistrictRejects+=parcelRejects;
    minCoherence=Math.min(minCoherence,coherence);maxCoherence=Math.max(maxCoherence,coherence);
  }
  assert.equal(valid,100,`${id} must keep 100/100 fixed-seed maps valid`);
  stats[id]={seeds:100,valid,decorations,mismatches,mismatchRate:Number((mismatches/Math.max(1,decorations)*100).toFixed(2)),districtRejects,blocks,blockMismatches,blockMismatchRate:Number((blockMismatches/Math.max(1,blocks)*100).toFixed(2)),blockDistrictRejects,parcels,parcelBoundaryMismatches,parcelBoundaryMismatchRate:Number((parcelBoundaryMismatches/Math.max(1,parcels)*100).toFixed(2)),parcelDistrictRejects,coherenceRange:[minCoherence,maxCoherence]};
}
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,`${id}/${seed} layout hash must stay deterministic`);
  assert.equal(a.quality.breakdown.districtCoherence,b.quality.breakdown.districtCoherence,`${id}/${seed} coherence score must stay deterministic`);
  assert.equal(a.generationStats.decorationDistrictRejects,b.generationStats.decorationDistrictRejects,`${id}/${seed} decoration district rejects must stay deterministic`);
  assert.equal(a.generationStats.blockDistrictRejects,b.generationStats.blockDistrictRejects,`${id}/${seed} block district rejects must stay deterministic`);
  assert.equal(a.generationStats.parcelDistrictRejects,b.generationStats.parcelDistrictRejects,`${id}/${seed} parcel district rejects must stay deterministic`);
  totalDeterminismChecks++;
}
assert.equal(mapsChecked,Object.keys(MAP_FORGE_RECIPES).length*100,'audit must inspect 100 seeds per recipe');
assert.equal(validMaps,mapsChecked,'all fixed-seed maps must remain valid');
assert.ok(totalDecorations>=BASELINE_DECORATIONS*.8,`decoration population collapsed: ${totalDecorations} vs baseline ${BASELINE_DECORATIONS}`);
assert.equal(totalMismatches,0,`decoration district leakage regressed from expected 0: ${totalMismatches}`);
assert.ok(totalDistrictRejects>0,'fixed-seed corpus must exercise the decoration district placement guard');
assert.ok(totalBlocks>=BASELINE_BLOCKS*.98,`building-block population collapsed: ${totalBlocks} vs baseline ${BASELINE_BLOCKS}`);
assert.equal(totalBlockMismatches,0,`building-block district leakage regressed from expected 0: ${totalBlockMismatches}`);
assert.ok(totalBlockDistrictRejects>0,'fixed-seed corpus must exercise the building-block district placement guard');
assert.ok(totalParcels>=BASELINE_PARCELS*.98,`parcel population collapsed: ${totalParcels} vs baseline ${BASELINE_PARCELS}`);
assert.equal(totalParcelBoundaryMismatches,0,`buildable parcel district leakage regressed from expected 0: ${totalParcelBoundaryMismatches}`);
assert.ok(totalParcelDistrictRejects>0,'fixed-seed corpus must exercise the buildable parcel district placement guard');
console.log(JSON.stringify({ok:true,mapsChecked,validMaps,totalDecorations,baselineDecorations:BASELINE_DECORATIONS,decorationRetentionPct:Number((totalDecorations/BASELINE_DECORATIONS*100).toFixed(2)),baselineMismatches:BASELINE_MISMATCHES,totalMismatches,mismatchRate:Number((totalMismatches/Math.max(1,totalDecorations)*100).toFixed(2)),totalDistrictRejects,totalBlocks,baselineBlocks:BASELINE_BLOCKS,blockRetentionPct:Number((totalBlocks/BASELINE_BLOCKS*100).toFixed(2)),baselineBlockMismatches:BASELINE_BLOCK_MISMATCHES,totalBlockMismatches,blockMismatchRate:Number((totalBlockMismatches/Math.max(1,totalBlocks)*100).toFixed(2)),totalBlockDistrictRejects,totalParcels,baselineParcels:BASELINE_PARCELS,parcelRetentionPct:Number((totalParcels/BASELINE_PARCELS*100).toFixed(2)),baselineParcelBoundaryMismatches:BASELINE_PARCEL_BOUNDARY_MISMATCHES,totalParcelBoundaryMismatches,parcelBoundaryMismatchRate:Number((totalParcelBoundaryMismatches/Math.max(1,totalParcels)*100).toFixed(2)),totalParcelDistrictRejects,determinismChecks:totalDeterminismChecks,stats},null,2));
