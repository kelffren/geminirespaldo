/* KELO-INDEX
 * area: AUDIT / MAP FORGE
 * purpose: fixed-seed regression for scenic-vista scoring; buildings and unrelated landmarks must count as visual blockers
 * consumes: live Map Forge generator + recipe catalog + geometry primitive
 */
import assert from 'node:assert/strict';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {listMapForgeRecipes} from '../src/world/map-forge/map-forge-recipes.mjs';
import {pointSegmentDistance} from '../src/world/map-forge/map-forge-geometry.mjs';

const seeds=[7,42,1337,20260910];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function legacyScenicScore(map){
  const vistas=(map.scenicVistas||[]).filter(v=>v.reserved&&v.from&&v.to);
  if(!vistas.length)return 60;
  let sum=0;
  for(const v of vistas){
    const corridor=Math.max(56,90*(v.weight||1));
    const blockers=(map.decorations||[]).filter(d=>pointSegmentDistance(d,v.from,v.to)<corridor).length;
    const length=Math.max(1,Math.hypot(v.from.x-v.to.x,v.from.y-v.to.y));
    const density=blockers/(length/400);
    sum+=clamp(100-density*12,35,100);
  }
  return sum/vistas.length;
}
function structuralVistaBlockers(map){
  let blocks=0,landmarks=0;
  for(const v of (map.scenicVistas||[]).filter(row=>row.reserved&&row.from&&row.to)){
    const corridor=Math.max(56,90*(v.weight||1));
    for(const b of map.blocks||[]){
      const bounds=b?.bounds||{},center={x:Number(bounds.x||0)+Number(bounds.w||0)/2,y:Number(bounds.y||0)+Number(bounds.h||0)/2};
      const bodyRadius=Math.max(18,Math.min(Number(bounds.w||0),Number(bounds.h||0))*.28);
      if(pointSegmentDistance(center,v.from,v.to)<corridor+bodyRadius)blocks++;
    }
    for(const l of map.landmarks||[]){
      if(l.id===v.fromRef||l.id===v.toRef||!l.position)continue;
      const bounds=l.bounds||{},bodyRadius=Math.max(18,Math.min(Number(bounds.w||0),Number(bounds.h||0))*.25);
      if(pointSegmentDistance(l.position,v.from,v.to)<corridor+bodyRadius)landmarks++;
    }
  }
  return {blocks,landmarks};
}

const rows=[];
let structuralCases=0,penalizedCases=0;
for(const recipe of listMapForgeRecipes()){
  for(const seed of seeds){
    const a=generateMapCandidate(recipe,{seed});
    const b=generateMapCandidate(recipe,{seed});
    assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,`${recipe.id}/${seed}: generation lost determinism`);
    const before=legacyScenicScore(a),after=a.quality.breakdown.scenicVistas,structural=structuralVistaBlockers(a);
    if(structural.blocks+structural.landmarks>0){structuralCases++;if(after<before)penalizedCases++;}
    assert.ok(after<=before+0.01,`${recipe.id}/${seed}: structural-aware scenic score unexpectedly exceeds legacy score`);
    rows.push({recipe:recipe.id,seed,structuralBlocks:structural.blocks,structuralLandmarks:structural.landmarks,before:Number(before.toFixed(2)),after:Number(after.toFixed(2)),delta:Number((after-before).toFixed(2)),quality:a.quality.total,layoutHash:a.metadata.layoutHash});
  }
}
assert.ok(structuralCases>0,'Representative fixed seeds did not exercise any structural vista blocker');
assert.equal(penalizedCases,structuralCases,'Every structural-blocker case must receive a scenic-vista penalty');
console.table(rows);
console.log(JSON.stringify({ok:true,seeds,recipes:listMapForgeRecipes().map(r=>r.id),cases:rows.length,structuralCases,penalizedCases},null,2));
