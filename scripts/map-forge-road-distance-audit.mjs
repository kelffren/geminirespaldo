/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for segment-aware road distance and decoration clearance
 * public-api: CLI
 * consumes: map-forge recipes + pure core + geometry
 * state-owned: none
 * do-not: no browser/runtime assertions
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {nearestRoadDistance} from '../src/world/map-forge/map-forge-geometry.mjs';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const legacyVertexOnly=(p,roads)=>{let best=Infinity;for(const road of roads)for(const q of road.polyline||[])best=Math.min(best,dist(p,q));return best;};
const ROUNDING_TOLERANCE=.2;

// Minimal reproduction of the old bug: midpoint is close to the road segment but far from both vertices.
const fixtureRoads=[{id:'fixture',polyline:[{x:0,y:0},{x:100,y:0}]}];
const fixturePoint={x:50,y:10};
const beforeFixture=legacyVertexOnly(fixturePoint,fixtureRoads);
const afterFixture=nearestRoadDistance(fixturePoint,fixtureRoads);
assert.ok(Math.abs(beforeFixture-Math.hypot(50,10))<1e-9,'legacy fixture must reproduce vertex-only distance');
assert.equal(afterFixture,10,'segment-aware distance must measure perpendicular clearance');

const stats={};
let totalDecorations=0,totalViolations=0,totalDeterminismChecks=0,totalVertexSegmentGap=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let decorations=0,violations=0,minClearance=Infinity,vertexSegmentGap=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    const districtKind=new Map(map.districts.map(d=>[d.id,d.kind]));
    for(const decoration of map.decorations){
      const required=districtKind.get(decoration.district)==='commerce'?35:22;
      const observed=nearestRoadDistance(decoration,map.roads);
      const legacy=legacyVertexOnly(decoration,map.roads);
      decorations++;
      minClearance=Math.min(minClearance,observed-required);
      if(legacy-observed>1)vertexSegmentGap++;
      if(observed<required-ROUNDING_TOLERANCE)violations++;
    }
  }
  stats[id]={seeds:100,decorations,violations,minClearanceAboveRule:Number.isFinite(minClearance)?Number(minClearance.toFixed(2)):null,vertexSegmentGapCases:vertexSegmentGap};
  totalDecorations+=decorations;totalViolations+=violations;totalVertexSegmentGap+=vertexSegmentGap;
  assert.equal(violations,0,`${id} produced decorations inside the configured road-clearance corridor`);
}

for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  const b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(a.layoutHash,b.layoutHash,`${id}/${seed} layout hash must stay deterministic`);
  assert.deepEqual(a.decorations,b.decorations,`${id}/${seed} decorations must stay deterministic`);
  totalDeterminismChecks++;
}

assert.ok(totalDecorations>0,'audit must inspect generated decorations');
assert.ok(totalVertexSegmentGap>0,'fixed-seed corpus must exercise geometry where vertex-only and segment-aware distance differ');
assert.equal(totalViolations,0,'300 fixed-seed maps must contain zero road-clearance violations');
console.log(JSON.stringify({ok:true,fixture:{beforeVertexOnly:Number(beforeFixture.toFixed(2)),afterSegmentAware:afterFixture,errorRemoved:Number((beforeFixture-afterFixture).toFixed(2))},totalDecorations,totalViolations,totalVertexSegmentGap,determinismChecks:totalDeterminismChecks,stats},null,2));