/* KELO-INDEX
 * area: WORLD / MAP FORGE / EVOLUTION
 * owner: KeloMapForge evolution adapter
 * purpose: evolve style, roads, district weights and landmark clearance through diverse multi-seed search plus paired holdout promotion
 * public-api: MAP_FORGE_EVOLUTION_PROFILE, MAP_FORGE_PARETO_OBJECTIVES, createMapForgeGenome, mapForgeGenomeFingerprint, mapForgeGenomeDistance, applyMapForgeGenome, evaluateMapForgeGenome, compareMapForgePairedEvaluations, proposeMapForgeGenomeMutations, minimizeMapForgeWinner, evolveMapForgeStyle
 * consumes: KeloEvolution gate + Map Forge generator/scorer + golden seed bank + optional experiment memory
 * state-owned: none; returns immutable reports/genomes
 * online: deterministic candidate identity and evidence can be evaluated remotely; persistence/publish stay outside
 * do-not: no source rewriting, DOM, renderer, Property, collision, publish or bypass of Map Forge validation
 */
import {createEvolutionMetricProfile,scoreEvolutionMetrics,compareEvolutionEvaluations,runEvolutionCycle} from '../../creators/evolution/evolution-engine.mjs';
import {mutationPriority,candidateSeenCount} from '../../creators/evolution/evolution-memory.mjs';
import {generateBestOf} from './map-forge-core.mjs';
import {getMapForgeGoldenSeeds} from './map-forge-golden-seeds.mjs';
import {clamp,round,freezeDeep,createRng,seed32,stableStringify,hashString} from './map-forge-prng.mjs';

export const MAP_FORGE_EVOLVABLE_STYLE_KEYS=Object.freeze(['monumentality','organicRoads','density','vegetation','exploration','decoration']);
export const MAP_FORGE_EVOLUTION_PROFILE=createEvolutionMetricProfile([
  {id:'meanQuality',weight:4,min:0,max:100},
  {id:'worstQuality',weight:2.5,min:0,max:100},
  {id:'meanVisual',weight:2,min:0,max:100},
  {id:'worstVisual',weight:1.25,min:0,max:100},
  {id:'navigationFloor',weight:1.5,min:0,max:100,hardMin:60},
  {id:'complexitySafety',weight:1,min:0,max:100,hardMin:55},
  {id:'stability',weight:1,min:0,max:100},
  {id:'validRate',weight:2,min:0,max:100,hardMin:100}
]);
export const MAP_FORGE_PARETO_OBJECTIVES=Object.freeze([
  Object.freeze({id:'meanQuality',direction:'maximize'}),
  Object.freeze({id:'worstQuality',direction:'maximize'}),
  Object.freeze({id:'meanVisual',direction:'maximize'}),
  Object.freeze({id:'navigationFloor',direction:'maximize'}),
  Object.freeze({id:'complexitySafety',direction:'maximize'})
]);
export const MAP_FORGE_EVOLUTION_EVALUATOR_VERSION='map-forge-evolution-v3';

const numeric=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const median=values=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
const standardDeviation=values=>{if(values.length<2)return 0;const avg=mean(values);return Math.sqrt(mean(values.map(value=>(value-avg)**2)));};
const visualScore=map=>{const m=map?.quality?.breakdown||{},keys=['visualComposition','landmarkQuality','districtVariety','densityBalance','negativeSpace','assetVariety','scenicVistas','districtCoherence'];return mean(keys.map(key=>numeric(m[key],0)));};
const clone=value=>JSON.parse(JSON.stringify(value));
const geneMatches=(id,patterns=[])=>patterns.some(pattern=>{const p=String(pattern||'');return p.endsWith('*')?id.startsWith(p.slice(0,-1)):id===p;});

export function createMapForgeGeneCatalog(recipe){
  if(!recipe?.id)throw new Error('MAP_FORGE_EVOLUTION_RECIPE_REQUIRED');
  const rows=[];
  for(const key of MAP_FORGE_EVOLVABLE_STYLE_KEYS)rows.push({id:`style.${key}`,scope:'style',min:0,max:1,step:.1,value:numeric(recipe.style?.[key],.5)});
  rows.push({id:'road.loopRatio',scope:'roads',min:.05,max:.72,step:.08,value:numeric(recipe.road?.loopRatio,.25)});
  rows.push({id:'road.curvature',scope:'roads',min:.05,max:1,step:.1,value:numeric(recipe.road?.curvature,.5)});
  for(const district of recipe.districts||[])rows.push({id:`district.${district.id}.weight`,scope:'districts',min:.55,max:1.65,step:.11,value:numeric(district.weight,1)});
  for(const landmark of recipe.landmarks||[])rows.push({id:`landmark.${landmark.id}.keepClearRadius`,scope:'landmarks',min:48,max:360,step:18,value:numeric(landmark.keepClearRadius,120)});
  return freezeDeep(rows);
}

export function createMapForgeGenome(recipe,{style={},genes={}}={}){
  const catalog=createMapForgeGeneCatalog(recipe),values={};
  for(const descriptor of catalog){
    const key=descriptor.id,styleKey=key.startsWith('style.')?key.slice(6):null;
    const requested=Object.prototype.hasOwnProperty.call(genes,key)?genes[key]:(styleKey&&Object.prototype.hasOwnProperty.call(style,styleKey)?style[styleKey]:descriptor.value);
    values[key]=round(clamp(numeric(requested,descriptor.value),descriptor.min,descriptor.max),4);
  }
  return freezeDeep({schema:'kelo-map-forge-genome-v3',recipeId:recipe.id,genes:values});
}

export function mapForgeGenomeFingerprint(recipe,genomeInput){
  const genome=createMapForgeGenome(recipe,{genes:genomeInput?.genes||genomeInput||{}});
  return `mf-${hashString(stableStringify(genome.genes)).slice(0,12)}`;
}

export function mapForgeGenomeDistance(recipe,aInput,bInput){
  const a=createMapForgeGenome(recipe,{genes:aInput?.genes||aInput||{}}),b=createMapForgeGenome(recipe,{genes:bInput?.genes||bInput||{}}),catalog=createMapForgeGeneCatalog(recipe);
  if(!catalog.length)return 0;
  return round(Math.sqrt(mean(catalog.map(row=>(Math.abs(a.genes[row.id]-b.genes[row.id])/(row.max-row.min))**2))),6);
}

export function applyMapForgeGenome(recipe,genomeInput){
  const genome=createMapForgeGenome(recipe,{genes:genomeInput?.genes||genomeInput||{}}),variant=clone(recipe);
  for(const [id,value] of Object.entries(genome.genes)){
    const parts=id.split('.');
    if(parts[0]==='style')variant.style[parts[1]]=value;
    else if(parts[0]==='road')variant.road[parts[1]]=value;
    else if(parts[0]==='district'){const row=variant.districts.find(item=>item.id===parts[1]);if(row)row.weight=value;}
    else if(parts[0]==='landmark'){const row=variant.landmarks.find(item=>item.id===parts[1]);if(row)row.keepClearRadius=value;}
  }
  return freezeDeep(variant);
}

function searchSeedBank(recipe,{seed=1,validationSeeds=2,goldenSeeds=4}={}){
  const rows=[...getMapForgeGoldenSeeds(recipe.id,{limit:Math.max(1,Math.min(8,Math.floor(numeric(goldenSeeds,4))))})],extra=Math.max(0,Math.min(8,Math.floor(numeric(validationSeeds,2))));
  for(let index=0;index<extra;index++)rows.push(index===0?seed32(seed):seed32(`${seed}|map-forge-evolution-validation|${index}`));
  return Object.freeze([...new Set(rows)]);
}
function holdoutSeedBank(recipe,{seed=1,holdoutSeeds=3,exclude=[]}={}){
  const target=Math.max(2,Math.min(8,Math.floor(numeric(holdoutSeeds,3)))),blocked=new Set(exclude),rows=[];let index=0;
  while(rows.length<target&&index<target*8){
    const value=seed32(`${recipe.id}|${seed}|map-forge-evolution-holdout|${index++}`);
    if(blocked.has(value)||rows.includes(value))continue;
    rows.push(value);
  }
  return Object.freeze(rows);
}
function complexityScore(map){const areaMillions=Math.max(.25,(map.worldBounds?.w||1)*(map.worldBounds?.h||1)/1e6),density=(map.decorations?.length||0)/areaMillions,roads=map.roads?.length||0,blocks=map.blocks?.length||0,parcels=map.parcels?.length||0,penalty=Math.max(0,density-34)*.9+Math.max(0,roads-18)*1.2+Math.max(0,blocks-40)*.5+Math.max(0,parcels-80)*.12;return clamp(100-penalty,35,100);}
function navigationFloor(map){const m=map?.quality?.breakdown||{};return Math.min(numeric(m.navigation,0),numeric(m.connectivity,0),numeric(m.roadQuality,0));}

export function evaluateMapForgeGenome(recipe,{genome=null,style={},seed=1,validationSeeds=2,goldenSeeds=4,bestOf=3,assetCatalogVersion='catalog-unbound',constraints={},seedBank=null}={}){
  const normalized=createMapForgeGenome(recipe,genome?{genes:genome.genes||genome}:{style}),variantRecipe=applyMapForgeGenome(recipe,normalized),seeds=Object.freeze([...(seedBank||searchSeedBank(recipe,{seed,validationSeeds,goldenSeeds}))]),runs=[];
  for(const validationSeed of seeds){
    const t0=globalThis.performance?.now?.()??0,batch=generateBestOf(variantRecipe,{seed:validationSeed,count:clamp(Math.floor(numeric(bestOf,3)),1,8),assetCatalogVersion,style:variantRecipe.style,constraints}),elapsed=(globalThis.performance?.now?.()??t0)-t0,best=batch.best;
    runs.push(Object.freeze({seed:validationSeed,valid:Boolean(best?.validation?.valid),quality:numeric(best?.quality?.total,0),visual:best?round(visualScore(best),3):0,navigation:best?round(navigationFloor(best),3):0,complexity:best?round(complexityScore(best),3):0,generationMs:round(elapsed,3),layoutHash:best?.metadata?.layoutHash||null,validCount:batch.validCount,rejectedCount:batch.rejectedCount}));
  }
  const validRuns=runs.filter(run=>run.valid),qualities=validRuns.map(run=>run.quality),visuals=validRuns.map(run=>run.visual);
  const measurements={meanQuality:round(mean(qualities),3),worstQuality:round(qualities.length?Math.min(...qualities):0,3),meanVisual:round(mean(visuals),3),worstVisual:round(visuals.length?Math.min(...visuals):0,3),navigationFloor:round(validRuns.length?Math.min(...validRuns.map(run=>run.navigation)):0,3),complexitySafety:round(mean(validRuns.map(run=>run.complexity)),3),stability:round(clamp(100-standardDeviation(qualities)*5,0,100),3),validRate:round(runs.length?validRuns.length/runs.length*100:0,3)};
  const scored=scoreEvolutionMetrics(MAP_FORGE_EVOLUTION_PROFILE,measurements),performance={meanGenerationMs:round(mean(runs.map(run=>run.generationMs)),3),worstGenerationMs:round(Math.max(0,...runs.map(run=>run.generationMs)),3)};
  return freezeDeep({valid:scored.valid,score:scored.score,metrics:measurements,performance,failures:scored.failures,genome:normalized,genomeFingerprint:mapForgeGenomeFingerprint(recipe,normalized),seedBankFingerprint:hashString(stableStringify(seeds)),style:Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,normalized.genes[`style.${key}`]])),runs});
}
export const evaluateMapForgeStyle=(recipe,options={})=>evaluateMapForgeGenome(recipe,options);

function pairedUtility(run){return numeric(run?.quality,0)*.55+numeric(run?.visual,0)*.25+numeric(run?.navigation,0)*.15+numeric(run?.complexity,0)*.05;}
export function compareMapForgePairedEvaluations(baseline,candidate,{minWinRate=50,minMeanDelta=0,minMedianDelta=-.1,maxWorstRegression=5}={}){
  const baseBySeed=new Map((baseline?.runs||[]).map(run=>[run.seed,run])),candidateBySeed=new Map((candidate?.runs||[]).map(run=>[run.seed,run])),deltas=[],missing=[];
  for(const [seed,baseRun] of baseBySeed){const candidateRun=candidateBySeed.get(seed);if(!candidateRun){missing.push(seed);continue;}deltas.push(round(pairedUtility(candidateRun)-pairedUtility(baseRun),4));}
  const epsilon=.05,wins=deltas.filter(delta=>delta>epsilon).length,losses=deltas.filter(delta=>delta<-epsilon).length,ties=deltas.length-wins-losses,winRate=deltas.length?round((wins+ties*.5)/deltas.length*100,3):0,meanDelta=round(mean(deltas),4),medianDelta=round(median(deltas),4),worstDelta=round(deltas.length?Math.min(...deltas):0,4),failures=[];
  if(missing.length)failures.push(`paired_seed_missing:${missing.join(',')}`);
  if(!baseline?.valid)failures.push('paired_baseline_invalid');
  if(!candidate?.valid)failures.push('paired_candidate_invalid');
  if(winRate<minWinRate)failures.push(`paired_win_rate_low:${winRate}<${minWinRate}`);
  if(meanDelta<minMeanDelta)failures.push(`paired_mean_delta_low:${meanDelta}<${minMeanDelta}`);
  if(medianDelta<minMedianDelta)failures.push(`paired_median_delta_low:${medianDelta}<${minMedianDelta}`);
  if(worstDelta<-Math.abs(maxWorstRegression))failures.push(`paired_worst_regression:${worstDelta}<-${Math.abs(maxWorstRegression)}`);
  return freezeDeep({accepted:failures.length===0,metrics:{cases:deltas.length,wins,losses,ties,winRate,meanDelta,medianDelta,worstDelta},deltas,failures});
}

function weightedPick(rng,rows,memory){
  const weights=rows.map(row=>mutationPriority(memory||{},row.id)),total=weights.reduce((a,b)=>a+b,0),needle=rng.float(0,total);let cursor=0;
  for(let i=0;i<rows.length;i++){cursor+=weights[i];if(needle<=cursor)return rows[i];}return rows.at(-1);
}
export function proposeMapForgeGenomeMutations(recipe,{genome=null,style={},seed=1,generation=0,population=8,mutationStep=1,minimumNovelty=.018,lockedGenes=[],focusScopes=[],focusGenes=[],memory=null}={}){
  const base=createMapForgeGenome(recipe,genome?{genes:genome.genes||genome}:{style}),catalog=createMapForgeGeneCatalog(recipe),eligible=catalog.filter(row=>!geneMatches(row.id,lockedGenes)&&(!focusScopes.length||focusScopes.includes(row.scope))&&(!focusGenes.length||geneMatches(row.id,focusGenes)));
  if(!eligible.length)throw new Error('MAP_FORGE_EVOLUTION_NO_MUTABLE_GENES');
  const rng=createRng(seed32(`${seed}|generation|${generation}`),'map-forge-genome-evolution-v3'),count=clamp(Math.floor(numeric(population,8)),2,24),scale=clamp(numeric(mutationStep,1),.1,3),seen=new Set([stableStringify(base.genes)]),candidates=[],noveltyFloor=clamp(numeric(minimumNovelty,.018),0,.35);
  for(let index=0;index<count;index++){
    let attempts=0,candidateGenes=null,mutations=[],novelty=0,fingerprint='';
    do{
      const draft={...base.genes},mutationCount=rng.chance(.22)?3:(rng.chance(.38)?2:1),used=new Set();mutations=[];
      for(let m=0;m<Math.min(mutationCount,eligible.length);m++){
        const descriptor=weightedPick(rng,eligible.filter(row=>!used.has(row.id)),memory);if(!descriptor)break;used.add(descriptor.id);
        const before=draft[descriptor.id],magnitude=descriptor.step*scale*rng.float(.55,1.2),after=round(clamp(before+(rng.chance(.5)?-1:1)*magnitude,descriptor.min,descriptor.max),4);draft[descriptor.id]=after;mutations.push(Object.freeze({geneId:descriptor.id,scope:descriptor.scope,before,after,delta:round(after-before,4)}));
      }
      candidateGenes=draft;novelty=mapForgeGenomeDistance(recipe,base,{genes:candidateGenes});fingerprint=mapForgeGenomeFingerprint(recipe,{genes:candidateGenes});attempts++;
    }while((seen.has(stableStringify(candidateGenes))||novelty<noveltyFloor||candidateSeenCount(memory||{},fingerprint)>0||candidates.some(row=>mapForgeGenomeDistance(recipe,row.genome,{genes:candidateGenes})<noveltyFloor*.45))&&attempts<24);
    const signature=stableStringify(candidateGenes),tooClose=candidates.some(row=>mapForgeGenomeDistance(recipe,row.genome,{genes:candidateGenes})<noveltyFloor*.45);
    if(seen.has(signature)||novelty<noveltyFloor||candidateSeenCount(memory||{},fingerprint)>0||tooClose)continue;seen.add(signature);
    candidates.push(freezeDeep({id:`mf-evo:${generation}:${index}:${hashString(signature).slice(0,8)}`,fingerprint,genome:createMapForgeGenome(recipe,{genes:candidateGenes}),novelty,mutations}));
  }
  return freezeDeep(candidates);
}
export function proposeMapForgeStyleMutations(recipe,options={}){return proposeMapForgeGenomeMutations(recipe,options).map(candidate=>freezeDeep({...candidate,style:Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,candidate.genome.genes[`style.${key}`]]))}));}

function diffGenomes(recipe,baselineInput,candidateInput){
  const baseline=createMapForgeGenome(recipe,{genes:baselineInput?.genes||baselineInput||{}}),candidate=createMapForgeGenome(recipe,{genes:candidateInput?.genes||candidateInput||{}}),catalog=createMapForgeGeneCatalog(recipe),byId=new Map(catalog.map(row=>[row.id,row]));
  return freezeDeep(Object.keys(candidate.genes).filter(id=>candidate.genes[id]!==baseline.genes[id]).map(id=>({geneId:id,scope:byId.get(id)?.scope||'unknown',before:baseline.genes[id],after:candidate.genes[id],delta:round(candidate.genes[id]-baseline.genes[id],4)})));
}

export function minimizeMapForgeWinner(recipe,{baselineGenome,candidateGenome,searchSeeds,holdoutSeeds,bestOf=3,assetCatalogVersion='catalog-unbound',constraints={},minImprovement=.3,minHoldoutImprovement=.05,pairedPolicy={},maxPruneChecks=4}={}){
  const baseline=createMapForgeGenome(recipe,{genes:baselineGenome?.genes||baselineGenome||{}});let current=createMapForgeGenome(recipe,{genes:candidateGenome?.genes||candidateGenome||{}});
  const baselineSearch=evaluateMapForgeGenome(recipe,{genome:baseline,seedBank:searchSeeds,bestOf,assetCatalogVersion,constraints}),baselineHoldout=evaluateMapForgeGenome(recipe,{genome:baseline,seedBank:holdoutSeeds,bestOf,assetCatalogVersion,constraints});
  const originalMutations=diffGenomes(recipe,baseline,current),checks=[],limit=Math.max(0,Math.min(12,Math.floor(numeric(maxPruneChecks,4))));
  for(const mutation of originalMutations.slice(0,limit)){
    const trialGenes={...current.genes,[mutation.geneId]:baseline.genes[mutation.geneId]},trial=createMapForgeGenome(recipe,{genes:trialGenes});
    const searchEval=evaluateMapForgeGenome(recipe,{genome:trial,seedBank:searchSeeds,bestOf,assetCatalogVersion,constraints}),holdoutEval=evaluateMapForgeGenome(recipe,{genome:trial,seedBank:holdoutSeeds,bestOf,assetCatalogVersion,constraints}),searchComparison=compareEvolutionEvaluations(baselineSearch,searchEval,{minImprovement}),holdoutComparison=compareEvolutionEvaluations(baselineHoldout,holdoutEval,{minImprovement:minHoldoutImprovement}),paired=compareMapForgePairedEvaluations(baselineHoldout,holdoutEval,pairedPolicy),keepPruned=searchComparison.accepted&&holdoutComparison.accepted&&paired.accepted;
    checks.push(freezeDeep({geneId:mutation.geneId,pruned:keepPruned,searchDelta:searchComparison.delta,holdoutDelta:holdoutComparison.delta,paired:paired.metrics}));if(keepPruned)current=trial;
  }
  return freezeDeep({genome:current,originalMutationCount:originalMutations.length,finalMutationCount:diffGenomes(recipe,baseline,current).length,prunedCount:originalMutations.length-diffGenomes(recipe,baseline,current).length,checks});
}

export async function evolveMapForgeStyle(recipe,{genome=null,style={},seed=1,generations=3,population=8,mutationStep=1,minimumNovelty=.018,validationSeeds=2,goldenSeeds=4,holdoutSeeds=3,bestOf=3,minImprovement=.3,minHoldoutImprovement=.05,minScore=0,assetCatalogVersion='catalog-unbound',constraints={},lockedGenes=[],focusScopes=[],focusGenes=[],memory=null,pairedPolicy={},minimizeWinner=true,maxPruneChecks=4}={}){
  if(!recipe?.id)throw new Error('MAP_FORGE_EVOLUTION_RECIPE_REQUIRED');
  const original=freezeDeep({id:'baseline',genome:createMapForgeGenome(recipe,genome?{genes:genome.genes||genome}:{style}),mutations:[]}),history=[];let current=original,step=clamp(numeric(mutationStep,1),.1,3),acceptedGenerations=0,stagnation=0,strategyEscalations=0;
  const generationCount=clamp(Math.floor(numeric(generations,3)),1,10),searchSeeds=searchSeedBank(recipe,{seed,validationSeeds,goldenSeeds}),holdoutSeedsBank=holdoutSeedBank(recipe,{seed,holdoutSeeds,exclude:searchSeeds});
  const evaluateSearch=candidate=>evaluateMapForgeGenome(recipe,{genome:candidate.genome,seedBank:searchSeeds,bestOf,assetCatalogVersion,constraints}),scopes=['style','roads','districts','landmarks'];
  for(let generation=0;generation<generationCount;generation++){
    const escalated=!focusScopes.length&&stagnation>=2,effectiveScopes=focusScopes.length?[...focusScopes]:(escalated?[scopes[(generation+stagnation)%scopes.length]]:[]),effectiveStep=clamp(step*(escalated?1.35:1),.1,3);if(escalated)strategyEscalations++;
    const cycle=await runEvolutionCycle({baseline:current,propose:()=>proposeMapForgeGenomeMutations(recipe,{genome:current.genome,seed,generation,population,mutationStep:effectiveStep,minimumNovelty,lockedGenes,focusScopes:effectiveScopes,focusGenes,memory}),evaluate:evaluateSearch,fingerprintCandidate:candidate=>candidate.fingerprint||mapForgeGenomeFingerprint(recipe,candidate.genome),policy:{minImprovement,minScore,paretoObjectives:MAP_FORGE_PARETO_OBJECTIVES}}),selected=cycle.selected;
    let accepted=false,holdout=null;
    if(cycle.accepted&&selected){
      const baselineHoldout=evaluateMapForgeGenome(recipe,{genome:current.genome,seedBank:holdoutSeedsBank,bestOf,assetCatalogVersion,constraints}),candidateHoldout=evaluateMapForgeGenome(recipe,{genome:selected.candidate.genome,seedBank:holdoutSeedsBank,bestOf,assetCatalogVersion,constraints}),absolute=compareEvolutionEvaluations(baselineHoldout,candidateHoldout,{minImprovement:minHoldoutImprovement,minScore}),paired=compareMapForgePairedEvaluations(baselineHoldout,candidateHoldout,pairedPolicy);
      holdout=freezeDeep({accepted:absolute.accepted&&paired.accepted,absoluteDelta:absolute.delta,paired:paired.metrics,failures:[...absolute.failures,...paired.failures],baselineScore:baselineHoldout.score,candidateScore:candidateHoldout.score});
      if(holdout.accepted){current=cycle.result;accepted=true;acceptedGenerations++;stagnation=0;step=clamp(step*.9,.1,3);}
    }
    if(!accepted){stagnation++;step=clamp(stagnation>=2?step*1.18:step*.72,.1,3);}
    history.push(freezeDeep({generation,accepted,searchAccepted:cycle.accepted,baselineScore:cycle.baselineEvaluation.score,candidateScore:selected?.evaluation?.score??null,delta:selected?.comparison?.delta??0,selectedId:selected?.candidate?.id||null,candidateFingerprint:selected?.candidate?.fingerprint||null,novelty:selected?.candidate?.novelty??null,mutations:selected?.candidate?.mutations||[],candidateCount:cycle.evaluated.length,duplicateCount:cycle.duplicates?.length||0,paretoFrontierCount:cycle.paretoFrontier?.length||0,step:round(effectiveStep,4),stagnation,escalatedScope:effectiveScopes,holdout}));
  }
  let minimization=null;
  if(acceptedGenerations>0&&minimizeWinner){minimization=minimizeMapForgeWinner(recipe,{baselineGenome:original.genome,candidateGenome:current.genome,searchSeeds,holdoutSeeds:holdoutSeedsBank,bestOf,assetCatalogVersion,constraints,minImprovement,minHoldoutImprovement,pairedPolicy,maxPruneChecks});current=freezeDeep({id:'minimized-champion',genome:minimization.genome,mutations:diffGenomes(recipe,original.genome,minimization.genome)});}
  const baselineEvaluation=evaluateMapForgeGenome(recipe,{genome:original.genome,seedBank:searchSeeds,bestOf,assetCatalogVersion,constraints}),bestEvaluation=evaluateMapForgeGenome(recipe,{genome:current.genome,seedBank:searchSeeds,bestOf,assetCatalogVersion,constraints}),baselineHoldout=evaluateMapForgeGenome(recipe,{genome:original.genome,seedBank:holdoutSeedsBank,bestOf,assetCatalogVersion,constraints}),bestHoldout=evaluateMapForgeGenome(recipe,{genome:current.genome,seedBank:holdoutSeedsBank,bestOf,assetCatalogVersion,constraints}),finalPaired=compareMapForgePairedEvaluations(baselineHoldout,bestHoldout,pairedPolicy),finalHoldoutComparison=compareEvolutionEvaluations(baselineHoldout,bestHoldout,{minImprovement:acceptedGenerations>0?minHoldoutImprovement:0,minScore});
  const finalAccepted=acceptedGenerations>0&&bestEvaluation.score-baselineEvaluation.score>=minImprovement&&finalHoldoutComparison.accepted&&finalPaired.accepted;if(!finalAccepted&&acceptedGenerations>0)current=original;
  const finalBestEvaluation=finalAccepted?bestEvaluation:baselineEvaluation,finalBestHoldout=finalAccepted?bestHoldout:baselineHoldout,finalGenome=finalAccepted?current.genome:original.genome,finalStyle=Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,finalGenome.genes[`style.${key}`]]));
  const evidenceBase={evaluatorVersion:MAP_FORGE_EVOLUTION_EVALUATOR_VERSION,recipeId:recipe.id,searchSeedFingerprint:hashString(stableStringify(searchSeeds)),holdoutSeedFingerprint:hashString(stableStringify(holdoutSeedsBank)),baselineFingerprint:mapForgeGenomeFingerprint(recipe,original.genome),championFingerprint:mapForgeGenomeFingerprint(recipe,finalGenome),baselineScore:baselineEvaluation.score,championScore:finalBestEvaluation.score,holdoutBaselineScore:baselineHoldout.score,holdoutChampionScore:finalBestHoldout.score},evidence=freezeDeep({...evidenceBase,fingerprint:`mf-evidence-${hashString(stableStringify(evidenceBase)).slice(0,12)}`});
  return freezeDeep({version:'kelo-map-forge-evolution-v3',evaluatorVersion:MAP_FORGE_EVOLUTION_EVALUATOR_VERSION,recipeId:recipe.id,seed:seed32(seed),accepted:finalAccepted,acceptedGenerations:finalAccepted?acceptedGenerations:0,generations:generationCount,originalGenome:original.genome,bestGenome:finalGenome,originalStyle:Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,original.genome.genes[`style.${key}`]])),bestStyle:finalStyle,baselineEvaluation,bestEvaluation:finalBestEvaluation,baselineHoldout,bestHoldout:finalBestHoldout,pairedHoldout:finalAccepted?finalPaired:compareMapForgePairedEvaluations(baselineHoldout,baselineHoldout,pairedPolicy),improvement:round(finalBestEvaluation.score-baselineEvaluation.score,4),holdoutImprovement:round(finalBestHoldout.score-baselineHoldout.score,4),history,minimization,strategy:{strategyEscalations,finalStagnation:stagnation,finalStep:round(step,4)},evidence,seedBanks:{search:[...searchSeeds],holdout:[...holdoutSeedsBank]},locks:{lockedGenes:[...lockedGenes],focusScopes:[...focusScopes],focusGenes:[...focusGenes]}});
}
