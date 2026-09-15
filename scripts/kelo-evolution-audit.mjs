/* KELO-INDEX
 * area: QA / EVOLUTION
 * owner: Kelo Evolution CI audit
 * purpose: prove V3 weighted gates, dedupe, Pareto, holdout, rollback, memory bandit, patch risk/evaluation and deterministic Map Forge promotion
 * public-api: CLI
 * consumes: KeloEvolution + code patch evaluation + Map Forge evolution/golden seeds
 * state-owned: none
 * do-not: no browser, publish, network or LIVE state mutation
 */
import assert from 'node:assert/strict';
import {createEvolutionMetricProfile,scoreEvolutionMetrics,evolutionFingerprint,computeEvolutionParetoFrontier,runEvolutionCycle,runChampionChallengerTournament} from '../src/creators/evolution/evolution-engine.mjs';
import {createEvolutionMemory,recordEvolutionExperiment,mutationFailureCount,mutationPerformance,mutationPriority,candidateSeenCount,summarizeEvolutionMemory} from '../src/creators/evolution/evolution-memory.mjs';
import {createCodePatchCandidate,validateCodePatchCandidate,requiredTestsForChanges,codePatchFingerprint} from '../src/creators/evolution/code-patch-candidate.mjs';
import {evaluateCodePatchSandboxReport} from '../src/creators/evolution/code-patch-evaluator.mjs';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {getMapForgeGoldenSeeds} from '../src/world/map-forge/map-forge-golden-seeds.mjs';
import {createMapForgeGenome,mapForgeGenomeFingerprint,mapForgeGenomeDistance,compareMapForgePairedEvaluations,evolveMapForgeStyle,proposeMapForgeGenomeMutations} from '../src/world/map-forge/map-forge-evolution.mjs';

const profile=createEvolutionMetricProfile([{id:'quality',weight:3,min:0,max:100,hardMin:60},{id:'latency',weight:1,min:0,max:100,direction:'minimize',hardMax:80}]),good=scoreEvolutionMetrics(profile,{quality:80,latency:20}),unsafe=scoreEvolutionMetrics(profile,{quality:55,latency:20});
assert.equal(good.valid,true);assert.ok(good.score>70);assert.equal(unsafe.valid,false);assert.ok(unsafe.failures.some(x=>x.startsWith('metric_below_hard_min:quality')));
assert.equal(evolutionFingerprint({a:1,b:2}),evolutionFingerprint({b:2,a:1}),'fingerprint must ignore object key order');

const paretoRows=[{evaluation:{metrics:{quality:90,visual:65}}},{evaluation:{metrics:{quality:84,visual:84}}},{evaluation:{metrics:{quality:80,visual:70}}}],pareto=computeEvolutionParetoFrontier(paretoRows,[{id:'quality'},{id:'visual'}]);
assert.equal(pareto.frontier.length,2);assert.equal(pareto.dominated.length,1);

let prepared=0,cleaned=0;const accepted=await runEvolutionCycle({baseline:{id:'base',value:70,holdout:70},propose:()=>[{id:'duplicate-a',value:76,holdout:76},{id:'duplicate-b',value:77,holdout:77},{id:'winner',value:82,holdout:83}],prepare:async candidate=>{prepared++;return{id:candidate.id};},cleanup:async()=>{cleaned++;},evaluate:candidate=>({valid:true,score:candidate.value}),holdoutEvaluate:candidate=>({valid:true,score:candidate.holdout}),fingerprintCandidate:candidate=>candidate.id.startsWith('duplicate')?'same':candidate.id,policy:{minImprovement:.5},holdoutPolicy:{minImprovement:.5}});
assert.equal(accepted.accepted,true);assert.equal(accepted.result.id,'winner');assert.equal(accepted.duplicates.length,1);assert.equal(accepted.holdout.accepted,true);assert.equal(prepared,5,'baseline + 2 unique search challengers + baseline/winner holdout use prepare');assert.equal(cleaned,5);

const holdoutReject=await runEvolutionCycle({baseline:{id:'base',search:70,holdout:70},propose:()=>[{id:'overfit',search:85,holdout:65}],evaluate:candidate=>({valid:true,score:candidate.search}),holdoutEvaluate:candidate=>({valid:true,score:candidate.holdout}),policy:{minImprovement:1},holdoutPolicy:{minImprovement:1}});
assert.equal(holdoutReject.accepted,false);assert.equal(holdoutReject.rejectedStage,'holdout');

const tournament=await runChampionChallengerTournament({champion:{id:'champ',value:80},challengers:[{id:'low',value:79},{id:'high',value:84}],evaluate:candidate=>({valid:true,score:candidate.value,metrics:{quality:candidate.value,visual:candidate.value}}),fingerprintCandidate:candidate=>candidate.id,policy:{minImprovement:1,paretoObjectives:[{id:'quality'},{id:'visual'}]}});assert.equal(tournament.changed,true);assert.equal(tournament.championAfter.id,'high');assert.equal(tournament.ranking[0].candidate.id,'high');

let liveState={id:'base',value:70};const rollbackCycle=await runEvolutionCycle({baseline:liveState,propose:()=>[{id:'candidate',value:82}],evaluate:candidate=>({valid:true,score:candidate.value}),policy:{minImprovement:1},apply:async candidate=>{liveState=candidate;throw new Error('synthetic_apply_failure');},rollback:async baseline=>{liveState=baseline;}});assert.equal(rollbackCycle.accepted,false);assert.equal(rollbackCycle.rolledBack,true);assert.equal(liveState.id,'base');

let memory=createEvolutionMemory({systemId:'map-forge'});memory=recordEvolutionExperiment(memory,{id:'r1',candidateId:'c1',candidateFingerprint:'seen-1',accepted:false,baselineScore:70,candidateScore:69,delta:-1,rejectedStage:'holdout',mutations:[{geneId:'road.curvature'}]});memory=recordEvolutionExperiment(memory,{id:'r2',candidateId:'c2',candidateFingerprint:'seen-2',accepted:true,baselineScore:70,candidateScore:72,delta:2,mutations:[{geneId:'style.vegetation'}]});
assert.equal(mutationFailureCount(memory,'road.curvature'),1);assert.equal(mutationPerformance(memory,'style.vegetation').accepted,1);assert.ok(mutationPriority(memory,'style.vegetation')>0);assert.equal(candidateSeenCount(memory,'seen-1'),1);assert.equal(summarizeEvolutionMemory(memory).experiments,2);

const patch=createCodePatchCandidate({id:'patch-ok',baseSha:'abc',objective:'improve evolution scoring',changes:[{path:'src/creators/evolution/example.mjs',beforeHash:'x',afterContent:'export const x=1;'}],tests:['evolution']});
const patchValidation=validateCodePatchCandidate(patch);assert.equal(patchValidation.valid,true,JSON.stringify(patchValidation));assert.deepEqual(requiredTestsForChanges(patch.changes),['evolution']);assert.equal(patch.fingerprint,codePatchFingerprint(patch));
const patchEvaluation=evaluateCodePatchSandboxReport({candidate:patch,report:{ok:true,stage:'complete',tests:[{id:'syntax:src/creators/evolution/example.mjs',ok:true},{id:'evolution',ok:true}],diff:'diff --git a/x b/x\n+one\n-two\n'}});assert.equal(patchEvaluation.valid,true,JSON.stringify(patchEvaluation));
const underTested=validateCodePatchCandidate(createCodePatchCandidate({id:'under-tested',baseSha:'abc',objective:'unsafe missing test',changes:[{path:'src/world/map-forge/map-forge-evolution.mjs',beforeHash:'x',afterContent:'x'}],tests:['evolution']}));assert.equal(underTested.valid,false);assert.ok(underTested.errors.includes('required_test_missing:map-forge-core'));
const deniedPatch=validateCodePatchCandidate(createCodePatchCandidate({id:'bad',baseSha:'abc',objective:'bad',changes:[{path:'.env',beforeHash:'x',afterContent:'x'}],tests:['evolution']}));assert.equal(deniedPatch.valid,false);assert.ok(deniedPatch.errors.some(error=>error.includes('path_')));

const pairedSynthetic=compareMapForgePairedEvaluations({valid:true,runs:[{seed:1,quality:80,visual:80,navigation:80,complexity:80},{seed:2,quality:80,visual:80,navigation:80,complexity:80}]},{valid:true,runs:[{seed:1,quality:82,visual:81,navigation:80,complexity:80},{seed:2,quality:81,visual:80,navigation:80,complexity:80}]});assert.equal(pairedSynthetic.accepted,true);assert.equal(pairedSynthetic.metrics.losses,0);

const mapForge=[];
for(const recipe of Object.values(MAP_FORGE_RECIPES)){
  const golden=getMapForgeGoldenSeeds(recipe.id,{limit:3});assert.equal(golden.length,3);assert.equal(new Set(golden).size,3);
  const baseGenome=createMapForgeGenome(recipe),baseFingerprint=mapForgeGenomeFingerprint(recipe,baseGenome);assert.equal(baseFingerprint,mapForgeGenomeFingerprint(recipe,createMapForgeGenome(recipe)));assert.equal(mapForgeGenomeDistance(recipe,baseGenome,baseGenome),0);
  const roadOnly=proposeMapForgeGenomeMutations(recipe,{genome:baseGenome,seed:99,generation:0,population:4,focusScopes:['roads'],memory});assert.ok(roadOnly.length>=1);assert.ok(roadOnly.every(candidate=>candidate.mutations.every(mutation=>mutation.scope==='roads')));assert.ok(new Set(roadOnly.map(row=>row.fingerprint)).size===roadOnly.length);assert.ok(roadOnly.every(row=>row.novelty>0));
  const locked=proposeMapForgeGenomeMutations(recipe,{genome:baseGenome,seed:101,generation:0,population:4,lockedGenes:['road.*'],focusScopes:['style','roads']});assert.ok(locked.every(candidate=>candidate.mutations.every(mutation=>mutation.scope==='style')));
  const options={seed:424242,generations:1,population:3,mutationStep:.8,validationSeeds:1,goldenSeeds:2,holdoutSeeds:2,bestOf:2,minImprovement:.1,minHoldoutImprovement:0,assetCatalogVersion:'ci-evolution-v3-catalog',memory,maxPruneChecks:2},first=await evolveMapForgeStyle(recipe,options),repeat=await evolveMapForgeStyle(recipe,options);
  assert.deepEqual(first.bestGenome,repeat.bestGenome,`${recipe.id}: genome evolution must be deterministic`);assert.equal(first.bestEvaluation.score,repeat.bestEvaluation.score);assert.equal(first.evidence.fingerprint,repeat.evidence.fingerprint);assert.notEqual(first.evidence.searchSeedFingerprint,first.evidence.holdoutSeedFingerprint);assert.equal(new Set([...first.seedBanks.search,...first.seedBanks.holdout]).size,first.seedBanks.search.length+first.seedBanks.holdout.length,'search and holdout seed banks must be disjoint');assert.ok(first.bestEvaluation.score+1e-9>=first.baselineEvaluation.score);assert.equal(first.baselineEvaluation.metrics.validRate,100);assert.equal(first.baselineHoldout.metrics.validRate,100);assert.ok(Number.isFinite(first.bestEvaluation.performance.meanGenerationMs));
  if(first.accepted){assert.ok(first.improvement>=options.minImprovement);assert.ok(first.holdoutImprovement>=options.minHoldoutImprovement);assert.equal(first.pairedHoldout.accepted,true);assert.ok(first.minimization.finalMutationCount<=first.minimization.originalMutationCount);}
  mapForge.push({recipeId:recipe.id,accepted:first.accepted,baseline:first.baselineEvaluation.score,best:first.bestEvaluation.score,improvement:first.improvement,holdoutImprovement:first.holdoutImprovement,evidence:first.evidence.fingerprint,strategy:first.strategy});
}
console.log(JSON.stringify({ok:true,engine:'kelo-evolution-v3',weightedGate:{goodScore:good.score,unsafeFailures:unsafe.failures},pareto:{frontier:pareto.frontier.length,dominated:pareto.dominated.length},holdout:{accepted:accepted.holdout.accepted,rejectedStage:holdoutReject.rejectedStage},tournament:{champion:tournament.championAfter.id},sandboxHooks:{prepared,cleaned},rollback:{rolledBack:rollbackCycle.rolledBack,state:liveState},memory:summarizeEvolutionMemory(memory),patch:{fingerprint:patch.fingerprint,risk:patchValidation.risk,evaluationScore:patchEvaluation.score},mapForge},null,2));
