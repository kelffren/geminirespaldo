/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: prove generated buildable parcel footprints never intrude into road corridors
 * public-api: CLI
 * consumes: map-forge recipes + deterministic core
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

function segmentIntersectsRect(a,b,r,pad=0){const minX=r.x-pad,maxX=r.x+r.w+pad,minY=r.y-pad,maxY=r.y+r.h+pad,dx=b.x-a.x,dy=b.y-a.y;let t0=0,t1=1;const clip=(p,q)=>{if(Math.abs(p)<1e-9)return q>=0;const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}return true;};return clip(-dx,a.x-minX)&&clip(dx,maxX-a.x)&&clip(-dy,a.y-minY)&&clip(dy,maxY-a.y);}
function parcelRoadIntrusions(map,pad=4){const hits=[];for(const parcel of map.parcels)for(const road of map.roads){const clearance=(Number(road.width)||0)/2+pad,points=road.polyline||[];for(let i=1;i<points.length;i++)if(segmentIntersectsRect(points[i-1],points[i],parcel.buildableArea,clearance)){hits.push({parcelId:parcel.id,blockId:parcel.blockId,roadId:road.id});break;}}return hits;}

const fixedSeeds=[7,42,1337,20260910];
const stats={};let totalMaps=0,totalIntrusions=0,totalRoadRejects=0;
for(const [recipeId,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let intrusions=0,roadRejects=0,valid=0,minBlocks=Infinity,minParcels=Infinity,maxParcels=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'road-clearance-audit'});
    totalMaps++;
    if(map.validation.valid)valid++;
    const hits=parcelRoadIntrusions(map,4);
    intrusions+=hits.length;
    roadRejects+=map.generationStats.parcelRoadRejects||0;
    minBlocks=Math.min(minBlocks,map.blocks.length);
    minParcels=Math.min(minParcels,map.parcels.length);maxParcels=Math.max(maxParcels,map.parcels.length);
    assert.equal(hits.length,0,`${recipeId} seed ${seed} has ${hits.length} buildable parcel/road intrusions: ${JSON.stringify(hits.slice(0,3))}`);
  }
  assert.ok(valid>=99,`${recipeId} validity regressed to ${valid}/100`);
  assert.ok(minBlocks>0,`${recipeId} must retain urban blocks after parcel road clearance`);
  assert.ok(minParcels>0,`${recipeId} must retain buildable parcels after road clearance`);
  stats[recipeId]={validRate:valid/100,intrusions,parcelRoadRejects:roadRejects,minBlocks,minParcels,maxParcels};
  totalIntrusions+=intrusions;totalRoadRejects+=roadRejects;
}
assert.equal(totalIntrusions,0,'300 fixed-seed maps must have zero buildable parcel/road intrusions');
assert.ok(totalRoadRejects>0,'fixed-seed fuzz must exercise the parcel-vs-road collision guard');
for(const [recipeId,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of fixedSeeds){const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'road-clearance-audit'}),b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'road-clearance-audit'});assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,`${recipeId} seed ${seed} must stay deterministic`);}
console.log(JSON.stringify({ok:true,mapsChecked:totalMaps,beforePreventableParcelRoadIntrusions:totalRoadRejects,afterParcelRoadIntrusions:totalIntrusions,fixedSeedDeterminismChecks:Object.keys(MAP_FORGE_RECIPES).length*fixedSeeds.length,stats},null,2));
