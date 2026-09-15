/* KELO-INDEX
 * area: WORLD / MAP FORGE
 * owner: KeloMapForge deterministic generator core
 * purpose: orchestrate pure MapDefinition generation, hashing, validation, scoring and best-of-N selection
 * public-api: MAP_FORGE_GENERATOR_VERSION, generateMapCandidate, generateBestOf, serializeMapDefinition, deserializeMapDefinition
 * consumes: recipe data + map-forge builder/quality primitives
 * state-owned: none
 * extension-points: future lock regeneration and worker adapter call this same pure API
 * online: metadata uniquely identifies the base generated world; server/runtime deltas remain separate
 * do-not: no DOM, renderer, collision writes, camera, PropertySystem, wall-clock fields or Math.random
 */
import {clamp,freezeDeep,stableStringify,hashString,seed32,createRng} from './map-forge-prng.mjs';
import {createMapIntent,buildCandidateParts} from './map-forge-builder.mjs';
import {validateMapDefinition,scoreMapDefinition} from './map-forge-quality.mjs';
import {materializeScenePrefabs,scenePrefabTieScore} from './map-forge-scene-prefabs.mjs';
import {materializeArrivalScene} from './map-forge-arrival-scene.mjs';
import {buildSpriteManifest} from './map-forge-sprite-manifest.mjs';
export const MAP_FORGE_GENERATOR_VERSION='1.10.0';
export {createMapIntent} from './map-forge-builder.mjs';
export {createRng,stableStringify} from './map-forge-prng.mjs';
export {validateMapDefinition,scoreMapDefinition} from './map-forge-quality.mjs';

const DIRECTIONAL_DECORATION_FAMILIES=new Set(['bench','market_prop']);
const ROAD_FACING_LANDMARK_ROLES=new Set(['district_anchor']);
const ROTATION_FACING=Object.freeze({0:'south',90:'west',180:'north',270:'east'});
const DECORATION_DECLUSTER_RADIUS=240;
const DECORATION_DECLUSTER_GAIN=23;
const STREET_LAMP_ROAD_GAIN=36;
const STREET_BENCH_ROAD_GAIN=36;
const STREET_BENCH_SWAPS_PER_DISTRICT=2;
const SCENE_SLOT_MAX_DISTANCE=320;
const SCENE_SLOT_MIN_GAIN=12;
const SCENE_LOCAL_NEIGHBOR_RADIUS=220;
const LANDMARK_SCENE_PATTERNS=Object.freeze({
  central_fountain:Object.freeze({id:'fountain-approach-v1',slots:Object.freeze([
    Object.freeze({role:'approach-lamp-left',family:'lamp',forwardGap:82,lateral:-118}),
    Object.freeze({role:'approach-lamp-right',family:'lamp',forwardGap:82,lateral:118}),
    Object.freeze({role:'rest-bench-left',family:'bench',forwardGap:148,lateral:-205}),
    Object.freeze({role:'rest-bench-right',family:'bench',forwardGap:148,lateral:205})
  ])}),
  main_market:Object.freeze({id:'market-threshold-v1',slots:Object.freeze([
    Object.freeze({role:'entry-lamp-left',family:'lamp',forwardGap:68,lateral:-108}),
    Object.freeze({role:'entry-lamp-right',family:'lamp',forwardGap:68,lateral:108}),
    Object.freeze({role:'stall-left',family:'market_prop',forwardGap:132,lateral:-188}),
    Object.freeze({role:'stall-right',family:'market_prop',forwardGap:132,lateral:188})
  ])})
});
const decorationDistance=(a,b)=>Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));
function nearestFamilyDistance(rows,index,family){const current=rows[index];let best=Infinity;for(let i=0;i<rows.length;i++){if(i===index)continue;const row=rows[i];if(row.district!==current.district||row.family!==family)continue;best=Math.min(best,decorationDistance(current,row));}return best;}
function declusterDecorationFamilies(parts){
  const rows=(parts.decorations||[]).map(row=>({...row}));let swaps=0;
  for(let i=0;i<rows.length;i++){
    const current=rows[i],nearest=nearestFamilyDistance(rows,i,current.family);
    if(nearest>DECORATION_DECLUSTER_RADIUS)continue;
    let bestIndex=-1,bestGain=0;
    for(let j=i+1;j<rows.length;j++){
      const candidate=rows[j];if(candidate.district!==current.district||candidate.family===current.family)continue;
      const before=Math.min(nearestFamilyDistance(rows,i,current.family),nearestFamilyDistance(rows,j,candidate.family));
      const aFamily=current.family,aAsset=current.assetRef,bFamily=candidate.family,bAsset=candidate.assetRef;
      current.family=bFamily;current.assetRef=bAsset;candidate.family=aFamily;candidate.assetRef=aAsset;
      const after=Math.min(nearestFamilyDistance(rows,i,current.family),nearestFamilyDistance(rows,j,candidate.family));
      current.family=aFamily;current.assetRef=aAsset;candidate.family=bFamily;candidate.assetRef=bAsset;
      const gain=after-before;if(gain>bestGain){bestGain=gain;bestIndex=j;}
    }
    if(bestIndex<0||bestGain<DECORATION_DECLUSTER_GAIN)continue;
    const candidate=rows[bestIndex],family=current.family,assetRef=current.assetRef;
    current.family=candidate.family;current.assetRef=candidate.assetRef;candidate.family=family;candidate.assetRef=assetRef;swaps++;
  }
  return{...parts,decorations:rows,generationStats:{...parts.generationStats,decorationDeclusterSwapCount:swaps}};
}
function nearestRoadVector(p,roads){let best=null;for(const road of roads||[]){const points=road.polyline||[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0,x=a.x+dx*t,y=a.y+dy*t,vx=x-p.x,vy=y-p.y,distance=Math.hypot(vx,vy);if(!best||distance<best.distance)best={vx,vy,distance};}}return best;}
function swapDecorationIdentity(a,b){const family=a.family,assetRef=a.assetRef;a.family=b.family;a.assetRef=b.assetRef;b.family=family;b.assetRef=assetRef;}
function findRoadAffinitySwap(rows,roads,district,targetFamily,donorFamily,minGain){let best=null;for(let i=0;i<rows.length;i++){const target=rows[i];if(target.district!==district||target.family!==targetFamily)continue;const targetRoad=nearestRoadVector(target,roads)?.distance??Infinity;for(let j=0;j<rows.length;j++){if(i===j)continue;const donor=rows[j];if(donor.district!==district||donor.family!==donorFamily)continue;const donorRoad=nearestRoadVector(donor,roads)?.distance??Infinity,gain=targetRoad-donorRoad;if(!Number.isFinite(gain)||gain<minGain)continue;const before=Math.min(nearestFamilyDistance(rows,i,targetFamily),nearestFamilyDistance(rows,j,donorFamily));swapDecorationIdentity(target,donor);const after=Math.min(nearestFamilyDistance(rows,i,target.family),nearestFamilyDistance(rows,j,donor.family));swapDecorationIdentity(target,donor);if(after+0.1<before)continue;if(!best||gain>best.gain+1e-6||Math.abs(gain-best.gain)<=1e-6&&(i<best.i||i===best.i&&j<best.j))best={i,j,gain};}}return best;}
function organizeStreetFurnitureFamilies(parts){
  const rows=(parts.decorations||[]).map(row=>({...row})),districts=[...new Set(rows.map(row=>row.district))].sort();let lampSwaps=0,lampRoadGain=0,benchSwaps=0,benchRoadGain=0;
  for(const district of districts){
    const lampBest=findRoadAffinitySwap(rows,parts.roads,district,'lamp','flower',STREET_LAMP_ROAD_GAIN);if(lampBest){swapDecorationIdentity(rows[lampBest.i],rows[lampBest.j]);lampSwaps++;lampRoadGain+=lampBest.gain;}
    for(let pass=0;pass<STREET_BENCH_SWAPS_PER_DISTRICT;pass++){const benchBest=findRoadAffinitySwap(rows,parts.roads,district,'bench','flower',STREET_BENCH_ROAD_GAIN);if(!benchBest)break;swapDecorationIdentity(rows[benchBest.i],rows[benchBest.j]);benchSwaps++;benchRoadGain+=benchBest.gain;}
  }
  const swaps=lampSwaps+benchSwaps,totalRoadGain=lampRoadGain+benchRoadGain;
  return{...parts,decorations:rows,generationStats:{...parts.generationStats,decorationStreetFamilySwapCount:swaps,decorationStreetFamilyRoadGain:Math.round(totalRoadGain*10)/10,decorationStreetLampSwapCount:lampSwaps,decorationStreetLampRoadGain:Math.round(lampRoadGain*10)/10,decorationStreetBenchSwapCount:benchSwaps,decorationStreetBenchRoadGain:Math.round(benchRoadGain*10)/10}};
}
function roadFacingRotation(p,roads,fallback=0){const frame=nearestRoadVector(p,roads);if(!frame||frame.distance<1e-6)return fallback;const degrees=Math.atan2(-frame.vx,frame.vy)*180/Math.PI;return((Math.round(degrees/90)*90)%360+360)%360;}
function orientRoadFacingLandmarks(parts){let oriented=0,changed=0;const landmarks=(parts.landmarks||[]).map(row=>{if(!ROAD_FACING_LANDMARK_ROLES.has(row.role)||row.roadConnection===false)return row;const point=row.position||row,frame=nearestRoadVector(point,parts.roads);if(!frame||frame.distance<1)return row;const degrees=roadFacingRotation(point,parts.roads,0),facing=ROTATION_FACING[degrees]||'south',previous=String(row?.frontage?.facing||row?.facing||'south').toLowerCase();oriented++;if(previous!==facing)changed++;return{...row,rotation:degrees,frontage:{...(row.frontage||{}),facing,source:'nearest-road'}};});return{...parts,landmarks,generationStats:{...parts.generationStats,landmarkRoadFacingCount:oriented,landmarkRoadFacingChangedCount:changed}};}
function rotationAxes(rotation=0){const value=((Number(rotation)||0)%360+360)%360;if(value===90)return{forward:{x:-1,y:0},lateral:{x:0,y:1}};if(value===180)return{forward:{x:0,y:-1},lateral:{x:-1,y:0}};if(value===270)return{forward:{x:1,y:0},lateral:{x:0,y:-1}};return{forward:{x:0,y:1},lateral:{x:1,y:0}};}
function sceneSlotPoint(landmark,slot){const center=landmark.position||landmark,radius=Math.max(80,Number(landmark?.clearance?.radius)||Math.max(Number(landmark?.bounds?.w)||0,Number(landmark?.bounds?.h)||0)*.7),axes=rotationAxes(landmark.rotation);return{x:center.x+axes.forward.x*(radius+slot.forwardGap)+axes.lateral.x*slot.lateral,y:center.y+axes.forward.y*(radius+slot.forwardGap)+axes.lateral.y*slot.lateral};}
function pointDistance(a,b){return Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));}
function nearestSceneDecoration(rows,district,point,filter,excluded){let best=null;for(let i=0;i<rows.length;i++){if(excluded.has(i))continue;const row=rows[i];if(row.district!==district||filter&&!filter(row))continue;const distance=pointDistance(row,point);if(!best||distance<best.distance-1e-6||Math.abs(distance-best.distance)<=1e-6&&i<best.index)best={index:i,distance};}return best;}
function localSameFamilyCount(rows){let count=0;for(let i=0;i<rows.length;i++){const current=rows[i];let nearest=null,best=Infinity;for(let j=0;j<rows.length;j++){if(i===j)continue;const candidate=rows[j];if(candidate.district!==current.district)continue;const distance=decorationDistance(current,candidate);if(distance<best){best=distance;nearest=candidate;}}if(nearest&&best<=SCENE_LOCAL_NEIGHBOR_RADIUS&&nearest.family===current.family)count++;}return count;}
function findRhythmSafeSceneDonor(rows,district,targetIndex,family,used){const baseline=localSameFamilyCount(rows);let best=null;for(let i=0;i<rows.length;i++){if(i===targetIndex||used.has(i))continue;const donor=rows[i];if(donor.district!==district||donor.family!==family)continue;swapDecorationIdentity(rows[targetIndex],donor);const after=localSameFamilyCount(rows);swapDecorationIdentity(rows[targetIndex],donor);if(after>baseline)continue;const distance=decorationDistance(rows[targetIndex],donor);if(!best||after<best.after||after===best.after&&distance<best.distance-1e-6||after===best.after&&Math.abs(distance-best.distance)<=1e-6&&i<best.index)best={index:i,after,distance};}return best;}
function composeLandmarkScenes(parts){
  const rows=(parts.decorations||[]).map(row=>({...row})),scenes=[];let evaluated=0,sceneSwaps=0,slotCount=0,totalGain=0,rhythmProtected=0;
  for(const landmark of parts.landmarks||[]){
    const pattern=LANDMARK_SCENE_PATTERNS[landmark.type];if(!pattern)continue;evaluated++;
    const used=new Set(),slots=[];let swaps=0,gain=0;
    for(const slot of pattern.slots){
      const ideal=sceneSlotPoint(landmark,slot),before=nearestSceneDecoration(rows,landmark.district,ideal,row=>row.family===slot.family,used),target=nearestSceneDecoration(rows,landmark.district,ideal,null,used);
      if(!before||!target||target.distance>SCENE_SLOT_MAX_DISTANCE)continue;
      let changed=false,slotGain=0;
      if(rows[target.index].family!==slot.family){
        slotGain=before.distance-target.distance;
        if(slotGain>=SCENE_SLOT_MIN_GAIN){const donor=findRhythmSafeSceneDonor(rows,landmark.district,target.index,slot.family,used);if(donor){swapDecorationIdentity(rows[target.index],rows[donor.index]);used.add(donor.index);changed=true;swaps++;sceneSwaps++;gain+=slotGain;totalGain+=slotGain;}else rhythmProtected++;}
      }
      if(rows[target.index].family===slot.family){used.add(target.index);slotCount++;slots.push({role:slot.role,family:slot.family,decorationId:rows[target.index].id,distance:Math.round(target.distance*10)/10,improvedBy:changed?Math.round(slotGain*10)/10:0});}
    }
    if(slots.length)scenes.push({id:`scene:${landmark.id}:${pattern.id}`,patternId:pattern.id,landmarkId:landmark.id,district:landmark.district,slotCount:slots.length,swapCount:swaps,distanceGain:Math.round(gain*10)/10,slots});
  }
  return{...parts,decorations:rows,sceneCompositions:scenes,generationStats:{...parts.generationStats,sceneGrammarEvaluatedCount:evaluated,sceneGrammarSceneCount:scenes.length,sceneGrammarSlotCount:slotCount,sceneGrammarSwapCount:sceneSwaps,sceneGrammarDistanceGain:Math.round(totalGain*10)/10,sceneGrammarRhythmProtectedCount:rhythmProtected}};
}
function orientDecorations(parts){let oriented=0,uprightNormalized=0;const decorations=(parts.decorations||[]).map(row=>{if(DIRECTIONAL_DECORATION_FAMILIES.has(row.family)){oriented++;return{...row,rotation:roadFacingRotation(row,parts.roads,row.rotation)};}if(Number(row.rotation)||0){uprightNormalized++;return{...row,rotation:0};}return row;});return{...parts,decorations,generationStats:{...parts.generationStats,decorationRoadFacingCount:oriented,decorationUprightNormalizedCount:uprightNormalized}};}

export function generateMapCandidate(recipe,{seed=1,assetCatalogVersion='catalog-unbound',style={},constraints={}}={}){const intent=createMapIntent(recipe,{seed,assetCatalogVersion,style,constraints}),rawParts=buildCandidateParts(recipe,intent,createRng(intent.seed,'map-forge')),declustered=declusterDecorationFamilies(rawParts),organized=organizeStreetFurnitureFamilies(declustered),landmarkOriented=orientRoadFacingLandmarks(organized),sceneComposed=composeLandmarkScenes(landmarkOriented),prefabComposed=materializeScenePrefabs(sceneComposed,{worldBounds:intent.worldBounds}),arrivalComposed=materializeArrivalScene(prefabComposed,{worldBounds:intent.worldBounds}),oriented=orientDecorations(arrivalComposed),manifest=buildSpriteManifest(oriented),parts={...oriented,...manifest,generationStats:{...oriented.generationStats,spriteManifestUniqueCount:manifest.spriteManifest.uniqueSprites,spriteManifestNeedsGenerationCount:manifest.spriteManifest.needsGenerationTypes,sceneBuildPlanCount:manifest.sceneBuildPlan.length}},base={metadata:{mapId:`map:${recipe.id}:${intent.seed}`,seed:intent.seed,generatorVersion:MAP_FORGE_GENERATOR_VERSION,recipeId:recipe.id,recipeVersion:recipe.version,assetCatalogVersion:intent.assetCatalogVersion,layoutHash:null},worldBounds:{...intent.worldBounds},...parts};const hashPayload={...base,metadata:{...base.metadata,layoutHash:null}};base.metadata.layoutHash=hashString(stableStringify(hashPayload));base.validation=validateMapDefinition(base,recipe);base.quality=scoreMapDefinition(base,recipe,base.validation);return freezeDeep(base);}
function deriveCandidateSeed(seed,index){return seed32(`${seed}|candidate|${index}`);}
function visualTieScore(map){const m=map?.quality?.breakdown||{};return Number(m.visualComposition||0)*1.35+Number(m.scenicVistas||0)*1.25+Number(m.negativeSpace||0)*1.05+Number(m.assetVariety||0)+Number(m.districtCoherence||0)+scenePrefabTieScore(map);}
function candidateComparator(a,b){return b.quality.total-a.quality.total||visualTieScore(b)-visualTieScore(a)||String(a.metadata.layoutHash).localeCompare(String(b.metadata.layoutHash));}
function specialtyPick(sorted,maximizer,used){if(!sorted.length)return null;const ranked=[...sorted].sort((a,b)=>maximizer(b)-maximizer(a)||candidateComparator(a,b)),fresh=ranked.find(map=>!used.has(map.metadata.layoutHash)),chosen=fresh||ranked[0];used.add(chosen.metadata.layoutHash);return chosen;}
export function generateBestOf(recipe,{seed=1,count=8,assetCatalogVersion='catalog-unbound',style={},constraints={}}={}){const n=clamp(Math.floor(count),1,32),candidates=[];for(let i=0;i<n;i++){const s=i===0?seed:deriveCandidateSeed(seed,i),map=generateMapCandidate(recipe,{seed:s,assetCatalogVersion,style,constraints});if(map.validation.valid)candidates.push(map);}const sorted=[...candidates].sort(candidateComparator),used=new Set(),bestOverall=sorted[0]||null;if(bestOverall)used.add(bestOverall.metadata.layoutHash);const selections={bestOverall,mostMonumental:specialtyPick(sorted,m=>m.quality.breakdown.landmarkQuality+m.quality.breakdown.visualComposition,used),mostOrganic:specialtyPick(sorted,m=>m.quality.breakdown.negativeSpace+m.quality.breakdown.scenicVistas,used),mostExplorable:specialtyPick(sorted,m=>m.quality.breakdown.navigation+m.quality.breakdown.districtVariety,used),mostCompact:specialtyPick(sorted,m=>100-(m.generationStats.roadCount+m.generationStats.blockCount),used)};return freezeDeep({requested:n,validCount:sorted.length,rejectedCount:n-sorted.length,best:bestOverall,selections,candidates:sorted});}
export function serializeMapDefinition(map){return stableStringify(map);}
export function deserializeMapDefinition(json){return freezeDeep(JSON.parse(json));}
