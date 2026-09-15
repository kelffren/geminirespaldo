/* KELO-INDEX
 * area: CREATORS / EVOLUTION
 * owner: KeloEvolution generic candidate evaluation and acceptance gate
 * purpose: compare a champion baseline against diverse challengers and apply only measured, sandboxed, holdout-verified improvements
 * public-api: createEvolutionMetricProfile, scoreEvolutionMetrics, compareEvolutionEvaluations, evolutionFingerprint, computeEvolutionParetoFrontier, selectEvolutionCandidate, runEvolutionCycle, runChampionChallengerTournament
 * consumes: injected proposer/evaluator/prepare/cleanup/apply/rollback callbacks; owns no gameplay or editor state
 * state-owned: none
 * extension-points: Map Forge genomes, visual candidates and guarded AI/code patch candidates
 * online: authority-neutral; caller decides where candidate generation, evaluation, persistence and apply execute
 * do-not: never self-apply an unevaluated candidate; never bypass hard metric gates; never grant filesystem/Git authority here
 */

const clone=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const finite=value=>Number.isFinite(Number(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=(value,places=4)=>{const factor=10**places;return Math.round(Number(value)*factor)/factor;};
const invalidEvaluation=error=>freeze({valid:false,score:0,metrics:{},failures:[`evaluation_error:${String(error?.message||error||'unknown')}`]});

function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
    return out;
  }
  if(typeof value==='number'&&!Number.isFinite(value))return null;
  return value;
}
function stableStringify(value){return JSON.stringify(canonicalize(value));}
export function evolutionFingerprint(value){
  const text=stableStringify(value);let hash=2166136261;
  for(let index=0;index<text.length;index++){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
  return `evo-${(hash>>>0).toString(16).padStart(8,'0')}`;
}

export function createEvolutionMetricProfile(definitions=[]){
  if(!Array.isArray(definitions)||definitions.length===0)throw new Error('EVOLUTION_METRICS_REQUIRED');
  const ids=new Set(),rows=definitions.map(raw=>{
    const id=String(raw?.id||'').trim();
    if(!id)throw new Error('EVOLUTION_METRIC_ID_REQUIRED');
    if(ids.has(id))throw new Error(`EVOLUTION_METRIC_DUPLICATE:${id}`);ids.add(id);
    const min=finite(raw.min)?Number(raw.min):0,max=finite(raw.max)?Number(raw.max):100,weight=finite(raw.weight)?Number(raw.weight):1,direction=raw.direction==='minimize'?'minimize':'maximize';
    if(!(max>min))throw new Error(`EVOLUTION_METRIC_RANGE_INVALID:${id}`);
    if(!(weight>0))throw new Error(`EVOLUTION_METRIC_WEIGHT_INVALID:${id}`);
    return Object.freeze({id,min,max,weight,direction,required:raw.required!==false,hardMin:finite(raw.hardMin)?Number(raw.hardMin):null,hardMax:finite(raw.hardMax)?Number(raw.hardMax):null});
  });
  return freeze(rows);
}

export function scoreEvolutionMetrics(profile,measurements={}){
  if(!Array.isArray(profile)||profile.length===0)throw new Error('EVOLUTION_PROFILE_REQUIRED');
  const failures=[],normalized={},observed={};let weighted=0,totalWeight=0;
  for(const metric of profile){
    const raw=measurements?.[metric.id];
    if(!finite(raw)){if(metric.required)failures.push(`metric_missing:${metric.id}`);continue;}
    const value=Number(raw);observed[metric.id]=value;
    if(metric.hardMin!==null&&value<metric.hardMin)failures.push(`metric_below_hard_min:${metric.id}:${value}<${metric.hardMin}`);
    if(metric.hardMax!==null&&value>metric.hardMax)failures.push(`metric_above_hard_max:${metric.id}:${value}>${metric.hardMax}`);
    const fraction=clamp((value-metric.min)/(metric.max-metric.min),0,1),score=(metric.direction==='minimize'?1-fraction:fraction)*100;
    normalized[metric.id]=round(score,3);weighted+=score*metric.weight;totalWeight+=metric.weight;
  }
  if(totalWeight<=0)failures.push('metric_weight_total_zero');
  return freeze({valid:failures.length===0,score:round(totalWeight>0?weighted/totalWeight:0,3),measurements:observed,normalized,failures});
}

function normalizeEvaluation(value){
  const score=Number(value?.score);
  return freeze({valid:value?.valid!==false&&Number.isFinite(score),score:Number.isFinite(score)?score:0,metrics:clone(value?.metrics||value?.measurements||{}),failures:[...(value?.failures||[])]});
}

export function compareEvolutionEvaluations(baselineInput,candidateInput,{minImprovement=.25,minScore=0}={}){
  const baseline=normalizeEvaluation(baselineInput),candidate=normalizeEvaluation(candidateInput),delta=round(candidate.score-baseline.score,4),failures=[...candidate.failures];
  if(!candidate.valid)failures.push('candidate_invalid');
  if(candidate.score<Number(minScore||0))failures.push(`candidate_below_min_score:${candidate.score}<${Number(minScore||0)}`);
  if(delta<Number(minImprovement||0))failures.push(`candidate_improvement_too_small:${delta}<${Number(minImprovement||0)}`);
  return freeze({accepted:failures.length===0,baseline,candidate,delta,failures:[...new Set(failures)]});
}

function objectiveValue(row,objective){
  const metrics=row?.evaluation?.metrics||row?.comparison?.candidate?.metrics||{};
  const raw=metrics?.[objective.id];
  return finite(raw)?Number(raw):null;
}
function dominates(a,b,objectives){
  let strictlyBetter=false;
  for(const objective of objectives){
    const av=objectiveValue(a,objective),bv=objectiveValue(b,objective);
    if(av===null||bv===null)return false;
    const direction=objective.direction==='minimize'?'minimize':'maximize';
    if(direction==='maximize'){if(av<bv)return false;if(av>bv)strictlyBetter=true;}
    else{if(av>bv)return false;if(av<bv)strictlyBetter=true;}
  }
  return strictlyBetter;
}

export function computeEvolutionParetoFrontier(rows=[],objectives=[]){
  const clean=(objectives||[]).map(raw=>({id:String(raw?.id||raw||'').trim(),direction:raw?.direction==='minimize'?'minimize':'maximize'})).filter(row=>row.id);
  if(!clean.length)return freeze({frontier:[...rows],dominated:[]});
  const frontier=[],dominated=[];
  for(let index=0;index<rows.length;index++){
    const row=rows[index],by=[];
    for(let other=0;other<rows.length;other++){if(index===other)continue;if(dominates(rows[other],row,clean))by.push(other);}
    if(by.length)dominated.push(freeze({row,dominatedBy:by}));else frontier.push(row);
  }
  return freeze({frontier,dominated});
}

export function selectEvolutionCandidate({baselineEvaluation,candidates=[],policy={}}={}){
  const evaluated=candidates.map((row,index)=>{const comparison=compareEvolutionEvaluations(baselineEvaluation,row.evaluation,policy);return freeze({index,candidate:row.candidate,evaluation:comparison.candidate,comparison,fingerprint:row.fingerprint||null});});
  const baseSort=(a,b)=>Number(b.comparison.accepted)-Number(a.comparison.accepted)||b.evaluation.score-a.evaluation.score||b.comparison.delta-a.comparison.delta||a.index-b.index;
  const baseRanking=[...evaluated].sort(baseSort),accepted=baseRanking.filter(row=>row.comparison.accepted);
  const pareto=computeEvolutionParetoFrontier(accepted,policy.paretoObjectives||[]);
  const frontierSet=new Set(pareto.frontier.map(row=>row.index));
  const ranking=[...baseRanking].sort((a,b)=>{
    const aa=a.comparison.accepted,ba=b.comparison.accepted;
    if(aa!==ba)return Number(ba)-Number(aa);
    if(aa&&frontierSet.size){const af=frontierSet.has(a.index),bf=frontierSet.has(b.index);if(af!==bf)return Number(bf)-Number(af);}
    return baseSort(a,b);
  });
  const selected=ranking.find(row=>row.comparison.accepted)||null;
  return freeze({accepted:Boolean(selected),selected,evaluated,ranking,paretoFrontier:pareto.frontier,paretoDominated:pareto.dominated});
}

async function evaluateOne(candidate,context,{evaluate,prepare,cleanup}){
  let sandbox=null,evaluation=null,prepareError=null,cleanupError=null;
  try{
    if(typeof prepare==='function')sandbox=await prepare(candidate,context);
    evaluation=normalizeEvaluation(await evaluate(candidate,{...context,sandbox}));
  }catch(error){prepareError=String(error?.message||error);evaluation=normalizeEvaluation(invalidEvaluation(error));}
  finally{if(typeof cleanup==='function'&&sandbox!==null)try{await cleanup(sandbox,{candidate,...context});}catch(error){cleanupError=String(error?.message||error);}}
  if(cleanupError)evaluation=normalizeEvaluation({...evaluation,valid:false,failures:[...evaluation.failures,`cleanup_error:${cleanupError}`]});
  return freeze({evaluation,sandboxPrepared:sandbox!==null,prepareError,cleanupError});
}

async function emitExperiment(onExperiment,report){if(typeof onExperiment==='function')await onExperiment(report);return report;}

export async function runEvolutionCycle({baseline,propose,evaluate,prepare=null,cleanup=null,holdoutEvaluate=null,holdoutPolicy=null,fingerprintCandidate=null,apply=null,rollback=null,policy={},onExperiment=null}={}){
  if(typeof propose!=='function')throw new Error('EVOLUTION_PROPOSER_REQUIRED');
  if(typeof evaluate!=='function')throw new Error('EVOLUTION_EVALUATOR_REQUIRED');
  const baselinePrepared=await evaluateOne(baseline,{role:'baseline',phase:'search'},{evaluate,prepare,cleanup}),baselineEvaluation=baselinePrepared.evaluation;
  const proposedRaw=await propose({baseline,baselineEvaluation});if(!Array.isArray(proposedRaw))throw new Error('EVOLUTION_PROPOSALS_MUST_BE_ARRAY');
  const proposed=[],duplicates=[],seen=new Set();
  for(let index=0;index<proposedRaw.length;index++){
    const candidate=proposedRaw[index];
    const fingerprint=typeof fingerprintCandidate==='function'?String(await fingerprintCandidate(candidate,{index,baseline})||''):'';
    if(fingerprint&&seen.has(fingerprint)){duplicates.push(freeze({index,fingerprint,candidate}));continue;}
    if(fingerprint)seen.add(fingerprint);
    proposed.push({candidate,fingerprint,index});
  }
  const rows=[];
  for(let localIndex=0;localIndex<proposed.length;localIndex++){
    const row=proposed[localIndex],prepared=await evaluateOne(row.candidate,{role:'candidate',phase:'search',index:row.index,baseline,baselineEvaluation},{evaluate,prepare,cleanup});
    rows.push({candidate:row.candidate,evaluation:prepared.evaluation,sandboxPrepared:prepared.sandboxPrepared,prepareError:prepared.prepareError,cleanupError:prepared.cleanupError,fingerprint:row.fingerprint||null});
  }
  const selection=selectEvolutionCandidate({baselineEvaluation,candidates:rows,policy}),baseReport={baseline,baselineEvaluation,baselineSandboxPrepared:baselinePrepared.sandboxPrepared,evaluated:selection.evaluated,ranking:selection.ranking,paretoFrontier:selection.paretoFrontier,duplicates};
  if(!selection.selected)return emitExperiment(onExperiment,freeze({accepted:false,applied:false,rolledBack:false,rejectedStage:'search',holdout:null,...baseReport,selected:null,result:baseline}));
  const winner=selection.selected;
  let holdout=null;
  if(typeof holdoutEvaluate==='function'){
    const baselineHoldout=await evaluateOne(baseline,{role:'baseline',phase:'holdout'},{evaluate:holdoutEvaluate,prepare,cleanup});
    const candidateHoldout=await evaluateOne(winner.candidate,{role:'candidate',phase:'holdout',baseline,searchEvaluation:winner.evaluation},{evaluate:holdoutEvaluate,prepare,cleanup});
    const comparison=compareEvolutionEvaluations(baselineHoldout.evaluation,candidateHoldout.evaluation,holdoutPolicy||policy);
    holdout=freeze({accepted:comparison.accepted,baselineEvaluation:baselineHoldout.evaluation,candidateEvaluation:candidateHoldout.evaluation,comparison});
    if(!comparison.accepted)return emitExperiment(onExperiment,freeze({accepted:false,applied:false,rolledBack:false,rejectedStage:'holdout',holdout,...baseReport,selected:winner,result:baseline}));
  }
  if(typeof apply!=='function')return emitExperiment(onExperiment,freeze({accepted:true,applied:false,rolledBack:false,rejectedStage:null,holdout,...baseReport,selected:winner,result:winner.candidate}));
  try{
    const appliedResult=await apply(winner.candidate,{baseline,baselineEvaluation,selection:winner,holdout});
    return emitExperiment(onExperiment,freeze({accepted:true,applied:true,rolledBack:false,rejectedStage:null,holdout,...baseReport,selected:winner,result:appliedResult??winner.candidate}));
  }catch(error){
    let rolledBack=false,rollbackError=null;if(typeof rollback==='function')try{await rollback(baseline,{error,candidate:winner.candidate,selection:winner,holdout});rolledBack=true;}catch(inner){rollbackError=String(inner?.message||inner);}
    return emitExperiment(onExperiment,freeze({accepted:false,applied:false,rolledBack,rejectedStage:'apply',error:String(error?.message||error),rollbackError,holdout,...baseReport,selected:winner,result:baseline}));
  }
}

export async function runChampionChallengerTournament({champion,challengers=[],evaluate,prepare=null,cleanup=null,holdoutEvaluate=null,holdoutPolicy=null,fingerprintCandidate=null,policy={}}={}){
  if(!Array.isArray(challengers))throw new Error('EVOLUTION_CHALLENGERS_ARRAY_REQUIRED');
  const cycle=await runEvolutionCycle({baseline:champion,propose:()=>challengers,evaluate,prepare,cleanup,holdoutEvaluate,holdoutPolicy,fingerprintCandidate,policy});
  return freeze({championBefore:champion,championAfter:cycle.accepted?cycle.result:champion,changed:cycle.accepted,selected:cycle.selected,ranking:cycle.ranking,paretoFrontier:cycle.paretoFrontier,duplicates:cycle.duplicates,holdout:cycle.holdout,rejectedStage:cycle.rejectedStage,baselineEvaluation:cycle.baselineEvaluation});
}
