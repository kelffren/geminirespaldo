/* KELO-INDEX
 * area: CREATORS / EVOLUTION / CODE PATCH / EVALUATION
 * owner: KeloEvolution code-candidate evaluation adapter
 * purpose: translate bounded sandbox/test evidence plus objective measurements into the generic Evolution score contract
 * public-api: createCodePatchEvaluationProfile, summarizeCodePatchDiff, evaluateCodePatchSandboxReport
 * consumes: kelo-code-patch-v2 candidate + sandbox report + optional objective score
 * state-owned: none
 * online: CI/remote runners can produce the same report contract without changing scoring
 * do-not: no filesystem, Git, shell, network, apply, merge or deployment
 */
import {createEvolutionMetricProfile,scoreEvolutionMetrics} from './evolution-engine.mjs';
import {createCodePatchPolicy,validateCodePatchCandidate} from './code-patch-candidate.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const finite=value=>Number.isFinite(Number(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=(value,places=3)=>{const factor=10**places;return Math.round(Number(value)*factor)/factor;};

export function createCodePatchEvaluationProfile({requireObjective=false,minObjectiveScore=0}={}){
  return createEvolutionMetricProfile([
    {id:'validationSafety',weight:2,min:0,max:100,hardMin:100},
    {id:'syntaxPassRate',weight:2,min:0,max:100,hardMin:100},
    {id:'testPassRate',weight:3,min:0,max:100,hardMin:100},
    {id:'riskSafety',weight:1.25,min:0,max:100,hardMin:30},
    {id:'compactness',weight:.75,min:0,max:100,hardMin:20},
    {id:'objectiveScore',weight:4,min:0,max:100,required:requireObjective,hardMin:requireObjective?Number(minObjectiveScore||0):null}
  ]);
}

export function summarizeCodePatchDiff(diff=''){
  const lines=String(diff||'').split(/\r?\n/),added=lines.filter(line=>line.startsWith('+')&&!line.startsWith('+++')).length,removed=lines.filter(line=>line.startsWith('-')&&!line.startsWith('---')).length,changed=added+removed;
  return freeze({added,removed,changed,compactness:round(clamp(100-changed*.8,0,100),3)});
}

export function evaluateCodePatchSandboxReport({candidate,report,policy=createCodePatchPolicy(),objectiveScore=null,requireObjective=false,minObjectiveScore=0}={}){
  const validation=validateCodePatchCandidate(candidate,policy),tests=Array.isArray(report?.tests)?report.tests:[],syntax=tests.filter(row=>String(row?.id||'').startsWith('syntax:')),registered=tests.filter(row=>!String(row?.id||'').startsWith('syntax:')),rate=rows=>rows.length?rows.filter(row=>row?.ok===true).length/rows.length*100:100,diff=summarizeCodePatchDiff(report?.diff||''),measurements={
    validationSafety:validation.valid?100:0,
    syntaxPassRate:round(rate(syntax),3),
    testPassRate:round(rate(registered),3),
    riskSafety:round(100-validation.risk.score,3),
    compactness:diff.compactness
  };
  if(finite(objectiveScore))measurements.objectiveScore=clamp(Number(objectiveScore),0,100);
  const profile=createCodePatchEvaluationProfile({requireObjective,minObjectiveScore}),scored=scoreEvolutionMetrics(profile,measurements),failures=[...validation.errors,...scored.failures];
  if(report?.ok!==true)failures.push(`sandbox_not_ok:${String(report?.stage||'unknown')}`);
  if(report?.error)failures.push(`sandbox_error:${String(report.error)}`);
  if(requireObjective&&!finite(objectiveScore))failures.push('objective_score_missing');
  return freeze({
    valid:validation.valid&&report?.ok===true&&scored.valid&&failures.length===0,
    score:scored.score,
    metrics:measurements,
    failures:[...new Set(failures)],
    candidateFingerprint:validation.candidate.fingerprint,
    risk:validation.risk,
    requiredTests:validation.requiredTests,
    diff
  });
}
