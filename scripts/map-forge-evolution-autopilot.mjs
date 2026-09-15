/* KELO-INDEX
 * area: QA / MAP FORGE / EVOLUTION / AUTOPILOT
 * owner: KeloEvolution CI-side champion challenger runner
 * purpose: evolve current Map Forge champions with search/holdout separation, paired gates and reproducible evidence, writing overrides only when a measured improvement wins
 * public-api: CLI; writes champion override module + memory only when accepted and always writes test-results report
 * consumes: Map Forge recipes/evolution + experiment memory
 * state-owned: CI checkout files only; GitHub workflow owns branch/PR persistence
 * online: N/A gameplay; promotion authority is GitHub PR review/checks
 * do-not: no direct main push, no merge, no secrets, no runtime mutation
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {MAP_FORGE_CHAMPION_OVERRIDES} from '../src/world/map-forge/map-forge-champion-overrides.mjs';
import {evolveMapForgeStyle} from '../src/world/map-forge/map-forge-evolution.mjs';
import {createEvolutionMemory,recordEvolutionExperiment,promoteEvolutionChampion} from '../src/creators/evolution/evolution-memory.mjs';

const memoryPath=path.resolve('docs/evolution/map-forge-memory.json'),championPath=path.resolve('src/world/map-forge/map-forge-champion-overrides.mjs'),reportPath=path.resolve('test-results/map-forge-evolution-autopilot.json');
const sourceSha=String(process.env.GITHUB_SHA||process.env.KELO_SOURCE_SHA||'local').trim();
async function readMemory(){try{return createEvolutionMemory(JSON.parse(await fs.readFile(memoryPath,'utf8')));}catch{return createEvolutionMemory({systemId:'map-forge'});}}
function championModule(overrides){return `/* KELO-INDEX\n * area: WORLD / MAP FORGE / EVOLUTION / CHAMPION\n * owner: KeloMapForge champion data registry\n * purpose: store only evolution overrides that passed search + unseen holdout + paired-seed gates and GitHub review\n * public-api: MAP_FORGE_CHAMPION_OVERRIDES\n * consumes: Map Forge recipe ids\n * state-owned: immutable approved override data\n * online: base-world recipe data only; server/runtime deltas remain separate\n * do-not: no generator logic, runtime writes or auto-merge authority\n */\nexport const MAP_FORGE_CHAMPION_OVERRIDES=Object.freeze(${JSON.stringify(overrides,null,2)});\n`;}

let memory=await readMemory(),overrides=JSON.parse(JSON.stringify(MAP_FORGE_CHAMPION_OVERRIDES)),acceptedAny=false;const reports=[];
for(const recipe of Object.values(MAP_FORGE_RECIPES)){
  const result=await evolveMapForgeStyle(recipe,{seed:`autopilot-v3:${recipe.id}`,generations:3,population:9,mutationStep:1,minimumNovelty:.018,goldenSeeds:6,validationSeeds:2,holdoutSeeds:4,bestOf:4,minImprovement:.2,minHoldoutImprovement:.05,assetCatalogVersion:'autopilot-v3-catalog',memory,pairedPolicy:{minWinRate:50,minMeanDelta:0,minMedianDelta:-.1,maxWorstRegression:4},maxPruneChecks:5});
  const winningMutations=result.history.filter(row=>row.accepted).flatMap(row=>row.mutations||[]),candidateId=`${recipe.id}:${result.evidence.championFingerprint}:${sourceSha.slice(0,8)}`;
  const rejectedStage=result.accepted?null:(result.history.some(row=>row.searchAccepted&&!row.accepted)?'holdout':'search');
  memory=recordEvolutionExperiment(memory,{
    id:`${recipe.id}:${sourceSha}`,sourceSha,candidateId,candidateFingerprint:result.evidence.championFingerprint,accepted:result.accepted,rejectedStage,
    baselineScore:result.baselineEvaluation.score,candidateScore:result.bestEvaluation.score,delta:result.improvement,
    holdout:{baselineScore:result.baselineHoldout.score,candidateScore:result.bestHoldout.score,delta:result.holdoutImprovement,paired:result.pairedHoldout.metrics},
    mutations:result.history.flatMap(row=>row.mutations||[]),metrics:result.bestEvaluation.metrics,failures:result.bestEvaluation.failures,
    artifacts:[{kind:'evolution-evidence',fingerprint:result.evidence.fingerprint,evaluatorVersion:result.evaluatorVersion}]
  });
  if(result.accepted){
    acceptedAny=true;const previous=overrides[recipe.id]||{};
    overrides[recipe.id]={revision:Math.max(0,Number(previous.revision)||0)+1,sourceSha,score:result.bestEvaluation.score,holdoutScore:result.bestHoldout.score,evidenceFingerprint:result.evidence.fingerprint,evaluatorVersion:result.evaluatorVersion,genes:result.bestGenome.genes};
    memory=promoteEvolutionChampion(memory,{candidateId,score:result.bestEvaluation.score,fingerprint:result.evidence.championFingerprint,metadata:{recipeId:recipe.id,holdoutScore:result.bestHoldout.score,paired:result.pairedHoldout.metrics,evidence:result.evidence,mutations:winningMutations,minimization:result.minimization}});
  }
  reports.push({recipeId:recipe.id,accepted:result.accepted,rejectedStage,improvement:result.improvement,holdoutImprovement:result.holdoutImprovement,baselineScore:result.baselineEvaluation.score,bestScore:result.bestEvaluation.score,baselineHoldoutScore:result.baselineHoldout.score,bestHoldoutScore:result.bestHoldout.score,pairedHoldout:result.pairedHoldout,performance:result.bestEvaluation.performance,strategy:result.strategy,minimization:result.minimization,evidence:result.evidence,seedBanks:result.seedBanks,history:result.history,bestGenome:result.bestGenome});
}
await fs.mkdir(path.dirname(reportPath),{recursive:true});
const manifest={schema:'kelo-map-forge-autopilot-v2',evolutionVersion:'v3',sourceSha,acceptedAny,reports};
await fs.writeFile(reportPath,JSON.stringify(manifest,null,2)+'\n');
if(acceptedAny){await fs.mkdir(path.dirname(memoryPath),{recursive:true});await fs.writeFile(memoryPath,JSON.stringify(memory,null,2)+'\n');await fs.writeFile(championPath,championModule(overrides));}
console.log(JSON.stringify({ok:true,version:'v3',acceptedAny,sourceSha,recipes:reports.map(row=>({recipeId:row.recipeId,accepted:row.accepted,rejectedStage:row.rejectedStage,improvement:row.improvement,holdoutImprovement:row.holdoutImprovement,baselineScore:row.baselineScore,bestScore:row.bestScore,evidence:row.evidence.fingerprint}))},null,2));
