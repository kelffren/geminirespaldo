/* KELO-INDEX
 * area: TEST / MAP FORGE / SCENE PREFABS
 * owner: Map Forge CI
 * purpose: lock authored scene materialization, spawn arrival composition, sprite requirements and road-entry connectors across representative Royal Capital seeds
 * public-api: CLI regression guard
 * consumes: Map Forge recipes + pure generator core
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const PRIMARY_SEED=81746291;
const SEEDS=[PRIMARY_SEED,12345,424242,29011987];
const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
const results=[];
let totalScenes=0,totalMembers=0,totalMoved=0,totalConnectors=0,totalImprovement=0,totalPairRollbacks=0,totalArrivalScenes=0,totalManifestSprites=0;

function pairBalance(scene){
  const groups=new Map();
  for(const member of scene.members||[]){
    const match=String(member.role||'').match(/^(.*)-(left|right)$/);if(!match)continue;
    const sides=groups.get(match[1])||new Set();sides.add(match[2]);groups.set(match[1],sides);
  }
  let complete=0,orphan=0;
  for(const sides of groups.values()){if(sides.size===2)complete++;else orphan++;}
  return{complete,orphan};
}

for(const seed of SEEDS){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: map must remain valid after authored scene materialization`);
  assert.equal(map.metadata.generatorVersion,'1.10.0',`${seed}: district tree palette guard targets generator 1.10.0`);

  const stats=map.generationStats||{};
  const evaluated=Number(stats.scenePrefabEvaluatedCount||0);
  const scenes=Number(stats.scenePrefabSceneCount||0);
  const members=Number(stats.scenePrefabMemberCount||0);
  const moved=Number(stats.scenePrefabMovedCount||0);
  const connectors=Number(stats.scenePrefabConnectorCount||0);
  const improvement=Number(stats.scenePrefabDistanceImprovement||0);
  const movement=Number(stats.scenePrefabMovementDistance||0);
  const pairRollbacks=Number(stats.scenePrefabPairRollbackCount||0);
  const prefabs=map.scenePrefabs||[],landmarkPrefabs=prefabs.filter(scene=>scene.sceneType!=='arrival'&&scene.sceneType!=='exit'),arrival=prefabs.find(scene=>scene.sceneType==='arrival');

  assert.ok(evaluated>=4,`${seed}: Royal Capital must evaluate multiple authored landmark prefab patterns`);
  assert.equal(landmarkPrefabs.length,scenes,`${seed}: landmark scenePrefabSceneCount must match landmark scene payload`);
  assert.ok(scenes>=1,`${seed}: at least one authored landmark scene prefab must resolve`);
  assert.ok(members>=2,`${seed}: resolved authored landmark scenes must contain multiple semantic members`);
  assert.equal(connectors,scenes,`${seed}: every resolved landmark scene must expose its road-entry connector`);
  const exits=map.scenePrefabs.filter(scene=>scene.sceneType==='exit');
  assert.ok(exits.length>=1,`${seed}: at least one authored world-edge gateway must resolve`);
  assert.ok(exits.every(scene=>scene.memberCount===2),`${seed}: every resolved world-edge gateway must remain a balanced pair`);
  assert.ok(exits.every(scene=>(scene.connectors||[]).some(connector=>connector.kind==='road'&&connector.required&&connector.roadId)),`${seed}: every world-edge gateway must retain its egress road connector`);
  assert.ok(exits.every(scene=>{const plan=map.sceneBuildPlan.find(row=>row.sceneId===scene.id);return plan&&Array.isArray(plan.needsGeneration)&&plan.needsGeneration.length===0;}),`${seed}: every resolved world-edge gateway must be drawable with approved sprite art now, not future generation`);
  if(seed===PRIMARY_SEED){assert.ok(exits.length>=2,`${seed}: fallback semantic pairs must frame at least two world exits`);assert.ok(exits.some(scene=>scene.exitId==='exit_northwest'&&scene.members.every(member=>member.family==='tree')),`${seed}: northwest forest exit must fall back from unavailable shrubs to approved tree markers`);}
  const royalGrove=landmarkPrefabs.find(scene=>scene.landmarkId==='ancient_tree');
  const royalCanopy=(royalGrove?.members||[]).filter(member=>member.family==='tree');
  assert.equal(royalCanopy.length,2,`${seed}: Royal Capital ancient grove must retain its authored tree canopy`);
  assert.deepEqual(royalCanopy.map(member=>member.role).sort(),['canopy-tree-left','canopy-tree-right'],`${seed}: Royal Capital grove canopy must frame both sides of the approach`);
  assert.ok(improvement>=0,`${seed}: authored scene distance improvement cannot be negative`);
  assert.ok(movement>=0,`${seed}: authored scene movement cannot be negative`);

  assert.equal(Number(stats.arrivalSceneResolvedCount||0),1,`${seed}: first visible spawn area must resolve an authored arrival scene`);
  assert.ok(arrival,`${seed}: scenePrefabs must expose the authored arrival scene`);
  assert.equal(arrival.prefabId,'spawn-arrival-gateway-v1',`${seed}: arrival scene must use the stable gateway prefab`);
  assert.equal(arrival.district,map.spawnPoints[0].district,`${seed}: arrival scene belongs to the spawn district`);
  assert.ok((arrival.members||[]).length>=2,`${seed}: arrival scene must visibly contain at least one balanced prop pair`);
  assert.equal(pairBalance(arrival).orphan,0,`${seed}: arrival scene must never expose a one-sided pair`);
  assert.equal((arrival.connectors||[]).filter(row=>row.kind==='road'&&row.required===true&&row.roadId).length,1,`${seed}: arrival scene must expose a required road connector`);
  const otherSceneMemberIds=new Set(prefabs.filter(scene=>scene.sceneType!=='arrival').flatMap(scene=>(scene.members||[]).map(member=>member.decorationId)));
  for(const member of arrival.members||[])assert.ok(!otherSceneMemberIds.has(member.decorationId),`${seed}: arrival scene cannot steal ${member.decorationId} from another authored scene`);

  const manifest=map.spriteManifest;
  assert.ok(manifest&&manifest.version==='map-forge-sprite-manifest-v2',`${seed}: map must return the sprite manifest it needs`);
  assert.equal(manifest.sprites.length,manifest.uniqueSprites,`${seed}: sprite manifest unique count must match payload`);
  assert.ok(manifest.uniqueSprites>0&&manifest.totalInstances>0,`${seed}: sprite manifest must contain concrete requirements`);
  assert.ok(Array.isArray(manifest.generationQueue)&&manifest.generationQueue.length>0,`${seed}: Royal Capital must expose sprites that still need art generation`);
  assert.ok(Array.isArray(manifest.tileMaterials)&&manifest.tileMaterials.length>0,`${seed}: manifest must also expose tile materials used by the map`);
  assert.equal(map.sceneBuildPlan.length,prefabs.length,`${seed}: every resolved scene must have a practical build plan`);
  assert.equal(Number(stats.sceneBuildPlanCount||0),map.sceneBuildPlan.length,`${seed}: scene build-plan stat must match payload`);
  assert.equal(Number(stats.spriteManifestUniqueCount||0),manifest.uniqueSprites,`${seed}: sprite manifest stat must match payload`);
  assert.equal(Number(stats.spriteManifestNeedsGenerationCount||0),manifest.needsGenerationTypes,`${seed}: missing-art stat must match manifest`);
  for(const member of arrival.members){const key=`decoration:${member.family}`,sprite=manifest.sprites.find(row=>row.key===key);assert.ok(sprite,`${seed}: arrival member ${member.role} must resolve to ${key} in sprite manifest`);assert.ok(sprite.sceneIds.includes(arrival.id),`${seed}: ${key} must retain arrival-scene usage`);}

  const ids=new Set();let completePairs=0,orphanPairs=0;
  for(const scene of prefabs){
    assert.ok(scene.id&&!ids.has(scene.id),`${seed}: scene prefab IDs must be unique`);ids.add(scene.id);
    assert.ok(scene.prefabId&&scene.kit&&scene.variant,`${seed}: scene prefab must expose authored identity, kit and variant`);
    assert.ok(Array.isArray(scene.members)&&scene.members.length>=2,`${seed}: scene prefab needs at least two resolved members`);
    const balance=pairBalance(scene);completePairs+=balance.complete;orphanPairs+=balance.orphan;
    assert.equal(balance.orphan,0,`${seed}: ${scene.id} must never expose a one-sided authored pair`);
    const roadConnectors=(scene.connectors||[]).filter(row=>row.kind==='road'&&row.required===true&&row.roadId);
    assert.equal(roadConnectors.length,1,`${seed}: each authored scene must have exactly one required road-entry connector`);
    assert.ok(Number.isFinite(roadConnectors[0].position?.x)&&Number.isFinite(roadConnectors[0].position?.y),`${seed}: road connector must expose a concrete point`);
    for(const member of scene.members){
      const decoration=map.decorations.find(row=>row.id===member.decorationId);
      assert.ok(decoration,`${seed}: ${member.decorationId} must resolve to a real decoration`);
      assert.equal(decoration.scenePrefabId,scene.id,`${seed}: real decoration must retain scene ownership`);
      assert.equal(decoration.sceneRole,member.role,`${seed}: real decoration must retain authored semantic role`);
      assert.equal(decoration.sceneKit,scene.kit,`${seed}: real decoration must retain district scene kit`);
    }
  }

  if(seed===PRIMARY_SEED){
    assert.ok(scenes>=2,`${seed}: primary visual seed must materially contain multiple authored landmark scenes`);
    assert.ok(moved>0,`${seed}: primary visual seed must physically move authored scene members`);
    assert.ok(improvement>0,`${seed}: primary visual seed must move members closer to authored targets`);
    assert.ok(connectors>=2,`${seed}: primary visual seed must expose multiple real road-entry connectors`);
    assert.ok(completePairs>0,`${seed}: primary visual seed must retain at least one complete authored left/right pair`);
  }

  totalScenes+=scenes;totalMembers+=members;totalMoved+=moved;totalConnectors+=connectors;totalImprovement+=improvement;totalPairRollbacks+=pairRollbacks;totalArrivalScenes+=arrival?1:0;totalManifestSprites+=manifest.uniqueSprites;
  results.push({seed,evaluated,scenes,members,moved,connectors,improvement,movement,pairRollbacks,arrivalMembers:arrival?.memberCount||0,manifestSprites:manifest.uniqueSprites,needsGeneration:manifest.needsGenerationTypes,completePairs,orphanPairs,safetyRejected:Number(stats.scenePrefabSafetyRejectedCount||0),rhythmProtected:Number(stats.scenePrefabRhythmProtectedCount||0),prefabs:prefabs.map(scene=>({id:scene.id,prefabId:scene.prefabId,kit:scene.kit,variant:scene.variant,sceneType:scene.sceneType||'landmark',memberCount:scene.memberCount,movedCount:scene.movedCount,distanceImprovement:scene.distanceImprovement,connectorRoadId:scene.connectors?.[0]?.roadId||null}))});
}

assert.ok(totalScenes>=SEEDS.length,'representative seeds must all resolve authored landmark scenes');
assert.equal(totalArrivalScenes,SEEDS.length,'representative seeds must all resolve the first-minute arrival scene');
assert.ok(totalMoved>0,'representative seeds must physically use authored placement');
assert.ok(totalConnectors>=totalScenes,'representative authored landmark scenes must remain connected to roads');
assert.ok(totalImprovement>0,'representative authored landmark scenes must retain positive composition gain');
assert.ok(totalManifestSprites>0,'representative maps must return sprite requirements');

const forestRecipe=MAP_FORGE_RECIPES.KELO_FOREST_V1;
let forestAdaptiveBackoffs=0;
for(const seed of SEEDS){
  const map=generateMapCandidate(forestRecipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: Forest must remain valid after adaptive scene placement`);
  const ancient=(map.scenePrefabs||[]).find(scene=>scene.landmarkId==='ancient_tree');
  assert.ok(ancient,`${seed}: Forest must resolve a recognizable ancient-tree grove`);
  assert.equal(ancient.prefabId,'ancient-grove-v1',`${seed}: Forest grove must use the existing authored scene owner`);
  assert.ok(ancient.memberCount>=2&&ancient.movedCount>=1,`${seed}: Forest grove must physically compose at least two existing decorations`);
  const canopy=ancient.members.filter(member=>member.family==='tree');
  assert.equal(canopy.length,2,`${seed}: Forest grove must include a balanced authored tree canopy`);
  assert.deepEqual(canopy.map(member=>member.role).sort(),['canopy-tree-left','canopy-tree-right'],`${seed}: Forest grove canopy must frame both sides of the approach`);
  assert.equal(pairBalance(ancient).orphan,0,`${seed}: Forest grove must retain balanced left/right pairs`);
  assert.equal((ancient.connectors||[]).filter(row=>row.kind==='road'&&row.required===true&&row.roadId).length,1,`${seed}: Forest grove must stay connected to a road`);
  forestAdaptiveBackoffs+=Number(map.generationStats.scenePrefabAdaptiveBackoffCount||0);
}
assert.ok(forestAdaptiveBackoffs>0,'Forest scene coverage must exercise adaptive spatial backoff');
console.log(JSON.stringify({ok:true,primarySeed:PRIMARY_SEED,seeds:SEEDS,totalScenes,totalArrivalScenes,totalMembers,totalMoved,totalConnectors,totalImprovement,totalPairRollbacks,totalManifestSprites,results},null,2));
