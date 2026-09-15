/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: reject accidental paving blobs and protect deterministic semantic civic paving
 * public-api: CLI
 * consumes: Map Forge recipes + pure generator/validator
 * state-owned: none
 * do-not: no browser/runtime assertions in this headless audit
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate,validateMapDefinition} from '../src/world/map-forge/map-forge-core.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const HISTORICAL_BASELINE=Object.freeze({
  KELO_ROYAL_CAPITAL_V1:Object.freeze({averageLargestRatio:.2236,maxLargestRatio:.3571,maxSeed:68}),
  KELO_VILLAGE_V1:Object.freeze({averageLargestRatio:.2029,maxLargestRatio:.3194,maxSeed:2}),
  KELO_FOREST_V1:Object.freeze({averageLargestRatio:0,maxLargestRatio:0,maxSeed:null})
});
const CIVIC_KINDS=new Set(['plaza','royal','commerce']);

function assertPlanConnected(map,plan){
  const step=map.terrain.cellSize,cells=map.terrain.cells.filter(c=>c.pavingIntent?.planId===plan.id),keys=new Set(cells.map(c=>`${c.x}:${c.y}`)),seen=new Set(),queue=cells.length?[cells[0]]:[];
  while(queue.length){const cell=queue.shift(),key=`${cell.x}:${cell.y}`;if(seen.has(key))continue;seen.add(key);for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const nextKey=`${cell.x+dx}:${cell.y+dy}`;if(keys.has(nextKey)&&!seen.has(nextKey)){const [x,y]=nextKey.split(':').map(Number);queue.push({x,y});}}}
  assert.equal(cells.length,plan.cellCount,`${map.metadata.mapId} ${plan.id} plan count drift`);
  assert.equal(seen.size,cells.length,`${map.metadata.mapId} ${plan.id} must be connected`);
}

const stats={};
for(const recipe of Object.values(MAP_FORGE_RECIPES)){
  const ratios=[],civicIds=new Set(recipe.districts.filter(d=>CIVIC_KINDS.has(d.kind)).map(d=>d.id));let maximum={ratio:0,seed:null,cells:0,total:0};
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),paving=map.validation.paving;
    assert.equal(map.validation.valid,true,`${recipe.id} seed ${seed}: ${map.validation.errors.join(',')}`);
    assert.ok(paving.largestComponentRatio<=.10,`${recipe.id} seed ${seed} exceeds 10% paving gate`);
    assert.equal(paving.missingIntentCells,0,`${recipe.id} seed ${seed} has undeclared paving`);
    assert.ok(map.terrain.cells.filter(c=>c.material==='stone').every(c=>c.pavingIntent?.type==='district_core'),`${recipe.id} seed ${seed} must explain every stone cell`);
    assert.ok(map.terrain.pavingPlans.every(p=>civicIds.has(p.district)),`${recipe.id} seed ${seed} has paving outside a civic district`);
    for(const plan of map.terrain.pavingPlans)assertPlanConnected(map,plan);
    ratios.push(paving.largestComponentRatio);
    if(paving.largestComponentRatio>maximum.ratio)maximum={ratio:paving.largestComponentRatio,seed,cells:paving.largestComponentCells,total:paving.totalCellCount};
  }
  const average=Number((ratios.reduce((sum,value)=>sum+value,0)/ratios.length).toFixed(4)),baseline=HISTORICAL_BASELINE[recipe.id];
  if(baseline.averageLargestRatio>0)assert.ok(average<=baseline.averageLargestRatio*.35,`${recipe.id} average paving blob reduction is insufficient: ${average}`);
  else assert.equal(average,0,`${recipe.id} must not invent civic paving`);
  stats[recipe.id]={mapsChecked:100,historicalBaseline:baseline,current:{averageLargestRatio:average,maxLargestRatio:maximum.ratio,maxSeed:maximum.seed,maxCells:maximum.cells,totalCells:maximum.total},reductionPercent:baseline.averageLargestRatio?Number(((1-average/baseline.averageLargestRatio)*100).toFixed(1)):0};
}

const capital=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1,canary=generateMapCandidate(capital,{seed:68,assetCatalogVersion:'ci-catalog'});
const missingIntent=clone(canary),firstStone=missingIntent.terrain.cells.find(c=>c.material==='stone');delete firstStone.pavingIntent;
const missingValidation=validateMapDefinition(missingIntent,capital);
assert.equal(missingValidation.valid,false,'undeclared paving must invalidate AUTO candidate');
assert.ok(missingValidation.errors.includes('paving_intent_missing'),'missing paving intent hard gate code must be stable');

const oversized=clone(canary),plan=oversized.terrain.pavingPlans[0];
for(const cell of oversized.terrain.cells){cell.material='stone';cell.pavingIntent={type:'district_core',planId:plan.id,district:plan.district,purpose:plan.purpose};}
const oversizedValidation=validateMapDefinition(oversized,capital);
assert.equal(oversizedValidation.valid,false,'dominant declared paving must invalidate AUTO candidate');
assert.ok(oversizedValidation.errors.includes('paving_blob_excessive'),'paving blob hard gate code must be stable');

console.log(JSON.stringify({ok:true,defect:'PAVING_BLOB',hardGates:{missingIntent:missingValidation.errors,oversized:oversizedValidation.errors},canary:{seed:68,largestComponentRatio:canary.validation.paving.largestComponentRatio,largestComponentCells:canary.validation.paving.largestComponentCells},stats},null,2));
