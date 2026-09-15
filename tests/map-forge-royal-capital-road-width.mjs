/* KELO-INDEX
 * area: TEST / MAP FORGE / ROYAL CAPITAL
 * owner: Map Forge CI
 * purpose: lock the visually approved Royal Capital road hierarchy, semantic landmark scenes, street-furniture composition and road-facing district landmarks across representative deterministic seeds
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const EXPECTED_ARTERIAL_WIDTH=98;
const EXPECTED_COLLECTOR_WIDTH=72;
const EXPECTED_DECORATION=0.60;
const PRIMARY_SEED=81746291;
const SEEDS=[PRIMARY_SEED,12345,424242,29011987];
const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;

function nearestRoadFrame(point,roads){let best=null;for(const road of roads||[]){const pts=road.polyline||[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0,x=a.x+dx*t,y=a.y+dy*t,vx=x-point.x,vy=y-point.y,distance=Math.hypot(vx,vy);if(!best||distance<best.distance)best={vx,vy,distance};}}return best;}
function expectedRoadRotation(row,roads){const frame=nearestRoadFrame(row.position||row,roads);if(!frame||frame.distance<1)return null;const degrees=Math.atan2(-frame.vx,frame.vy)*180/Math.PI;return ((Math.round(degrees/90)*90)%360+360)%360;}

assert.equal(recipe.road.arterialWidth,EXPECTED_ARTERIAL_WIDTH,'Royal Capital champion must keep the approved slimmer arterial width');
assert.equal(recipe.road.collectorWidth,EXPECTED_COLLECTOR_WIDTH,'Royal Capital champion must keep the approved slimmer collector width');
assert.equal(recipe.style.decoration,EXPECTED_DECORATION,'Royal Capital champion must keep the approved decoration density');
const results=[];
let representativeBenchSwaps=0,representativeRoadFacing=0,representativeRoadFacingChanges=0,representativeSceneSwaps=0,representativeSceneGain=0;
for(const seed of SEEDS){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: generated map must remain valid`);
  const arterials=map.roads.filter(road=>road.class==='arterial');
  const collectors=map.roads.filter(road=>road.class==='collector');
  assert.ok(arterials.length>0,`${seed}: representative map must contain arterial roads`);
  assert.ok(collectors.length>0,`${seed}: representative map must contain collector roads`);
  assert.ok(arterials.every(road=>road.width===EXPECTED_ARTERIAL_WIDTH),`${seed}: every arterial must use ${EXPECTED_ARTERIAL_WIDTH}px`);
  assert.ok(collectors.every(road=>road.width===EXPECTED_COLLECTOR_WIDTH),`${seed}: every collector must use ${EXPECTED_COLLECTOR_WIDTH}px`);
  assert.ok((map.generationStats.decorationStreetLampSwapCount||0)>0,`${seed}: approved lamp/flower road-affinity pass must stay active`);
  assert.ok((map.generationStats.decorationStreetLampRoadGain||0)>=36,`${seed}: lamp pass must retain a meaningful road-affinity gain`);
  const benchSwaps=map.generationStats.decorationStreetBenchSwapCount||0;
  const benchRoadGain=map.generationStats.decorationStreetBenchRoadGain||0;
  representativeBenchSwaps+=benchSwaps;
  if(seed===PRIMARY_SEED){
    assert.ok(benchSwaps>=3,`${seed}: primary visual seed must keep the approved second-pass roadside seating improvement`);
    assert.ok(benchRoadGain>=170,`${seed}: primary visual seed must keep the expanded bench road-affinity gain`);
  }

  const sceneEvaluated=map.generationStats.sceneGrammarEvaluatedCount||0;
  const sceneCount=map.generationStats.sceneGrammarSceneCount||0;
  const sceneSlots=map.generationStats.sceneGrammarSlotCount||0;
  const sceneSwaps=map.generationStats.sceneGrammarSwapCount||0;
  const sceneGain=map.generationStats.sceneGrammarDistanceGain||0;
  const sceneRhythmProtected=map.generationStats.sceneGrammarRhythmProtectedCount||0;
  assert.ok(sceneEvaluated>=2,`${seed}: Royal Capital must evaluate the fountain and market semantic scene patterns`);
  assert.ok(sceneCount>=1,`${seed}: at least one semantic landmark scene must resolve from valid generated decoration slots`);
  assert.ok(sceneSlots>=1,`${seed}: semantic landmark scenes must retain at least one resolved slot`);
  representativeSceneSwaps+=sceneSwaps;representativeSceneGain+=sceneGain;
  if(seed===PRIMARY_SEED){
    assert.ok(sceneSwaps>0,`${seed}: primary visual seed must materially compose at least one landmark scene`);
    assert.ok(sceneGain>0,`${seed}: primary visual seed must improve semantic scene-slot proximity`);
  }

  const districtAnchors=(map.landmarks||[]).filter(row=>row.role==='district_anchor'&&row.roadConnection!==false);
  let roadFacingChecked=0;
  for(const landmark of districtAnchors){
    const expected=expectedRoadRotation(landmark,map.roads);if(expected==null)continue;
    roadFacingChecked++;
    assert.equal(Number(landmark.rotation),expected,`${seed}: ${landmark.id} must face its nearest generated access road`);
    assert.equal(landmark.frontage?.source,'nearest-road',`${seed}: ${landmark.id} must expose nearest-road orientation provenance`);
  }
  assert.ok(roadFacingChecked>=3,`${seed}: representative map must verify multiple road-facing district landmarks`);
  const facingCount=map.generationStats.landmarkRoadFacingCount||0;
  const facingChanged=map.generationStats.landmarkRoadFacingChangedCount||0;
  assert.equal(facingCount,roadFacingChecked,`${seed}: road-facing generation stats must match verified landmarks`);
  representativeRoadFacing+=facingCount;representativeRoadFacingChanges+=facingChanged;
  const lampCount=map.decorations.filter(row=>row.family==='lamp').length;
  const flowerCount=map.decorations.filter(row=>row.family==='flower').length;
  const benchCount=map.decorations.filter(row=>row.family==='bench').length;
  assert.ok(lampCount>0&&flowerCount>0&&benchCount>0,`${seed}: representative map must retain lamps, flowers and benches`);
  results.push({seed,roadCount:map.roads.length,blockCount:map.blocks.length,decorationCount:map.decorations.length,arterialCount:arterials.length,collectorCount:collectors.length,arterialWidths:[...new Set(arterials.map(road=>road.width))],collectorWidths:[...new Set(collectors.map(road=>road.width))],decoration:recipe.style.decoration,streetFamilySwaps:map.generationStats.decorationStreetFamilySwapCount,streetFamilyRoadGain:map.generationStats.decorationStreetFamilyRoadGain,lampSwaps:map.generationStats.decorationStreetLampSwapCount,lampRoadGain:map.generationStats.decorationStreetLampRoadGain,benchSwaps,benchRoadGain,sceneEvaluated,sceneCount,sceneSlots,sceneSwaps,sceneGain,sceneRhythmProtected,roadFacingChecked,roadFacingChanged:facingChanged,lampCount,flowerCount,benchCount,quality:map.quality.total});
}
assert.ok(representativeBenchSwaps>=4,'Representative seeds must retain the approved second-pass roadside seating improvement');
assert.ok(representativeRoadFacing>=12,'Representative seeds must retain road-facing district landmark orientation');
assert.ok(representativeRoadFacingChanges>0,'Road-facing orientation must materially correct at least one previous fixed-facing landmark across representative seeds');
assert.ok(representativeSceneSwaps>0,'Representative seeds must materially use semantic landmark scene composition');
assert.ok(representativeSceneGain>0,'Representative semantic landmark scenes must retain positive slot-proximity gain');
console.log(JSON.stringify({ok:true,expectedArterialWidth:EXPECTED_ARTERIAL_WIDTH,expectedCollectorWidth:EXPECTED_COLLECTOR_WIDTH,expectedDecoration:EXPECTED_DECORATION,primarySeed:PRIMARY_SEED,seeds:SEEDS,representativeBenchSwaps,representativeRoadFacing,representativeRoadFacingChanges,representativeSceneSwaps,representativeSceneGain,results},null,2));