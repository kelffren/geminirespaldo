/* KELO-INDEX
 * area: CREATORS / EVOLUTION / SOURCE PROPOSER
 * owner: KeloEvolution
 * purpose: orchestrate bounded external-agent source repair attempts into kelo-code-patch-v2 candidates, then accept only independently evaluated sandbox evidence
 * public-api: createSourceRepairPolicy, normalizeSourceProblem, buildSourceRepairContext, validateSourceAgentProposal, runAutonomousSourceRepairCycle
 * consumes: explicit source snapshots + problem evidence + authorized agent callback + independent evaluator callback
 * state-owned: none; all attempts and decisions are returned as immutable reports
 * online: agent/evaluator may run remotely; Git/apply/merge authority remains outside this module
 * do-not: no filesystem, Git, network, secrets, shell, arbitrary paths, direct apply, merge or deployment
 */
import {
  createCodePatchPolicy,
  createCodePatchCandidate,
  validateCodePatchCandidate
} from './code-patch-candidate.mjs';
import {evaluateCodePatchSandboxReport} from './code-patch-evaluator.mjs';

const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value))freeze(child);
  }
  return value;
};
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const text=value=>String(value??'').trim();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const ALLOWED_PROBLEM_KINDS=Object.freeze(['ci_failure','regression','measured_opportunity']);

export function createSourceRepairPolicy({
  codePatchPolicy=createCodePatchPolicy(),
  maxAttempts=3,
  maxContextFiles=8,
  maxContextChars=80000,
  minObjectiveScore=60,
  requireEvidence=true
}={}){
  return freeze({
    codePatchPolicy,
    maxAttempts:Math.max(1,Math.min(6,Math.floor(Number(maxAttempts)||3))),
    maxContextFiles:Math.max(1,Math.min(16,Math.floor(Number(maxContextFiles)||8))),
    maxContextChars:Math.max(4000,Math.min(300000,Math.floor(Number(maxContextChars)||80000))),
    minObjectiveScore:clamp(minObjectiveScore,0,100),
    requireEvidence:requireEvidence!==false
  });
}

export function normalizeSourceProblem(problemInput={}){
  const evidence=(Array.isArray(problemInput?.evidence)?problemInput.evidence:[])
    .map(row=>freeze({
      type:text(row?.type)||'observation',
      source:text(row?.source),
      detail:text(row?.detail)
    }))
    .filter(row=>row.source||row.detail);
  const paths=[...new Set((problemInput?.paths||[]).map(text).filter(Boolean))];
  return freeze({
    id:text(problemInput?.id),
    kind:ALLOWED_PROBLEM_KINDS.includes(text(problemInput?.kind))?text(problemInput.kind):'',
    summary:text(problemInput?.summary),
    baselineSha:text(problemInput?.baselineSha),
    paths,
    evidence
  });
}

function pathAllowed(path,policy){
  const value=text(path),lower=value.toLowerCase();
  return Boolean(value)
    && policy.allowedPrefixes.some(prefix=>value.startsWith(prefix))
    && !policy.denyFragments.some(fragment=>lower.includes(fragment));
}

export function buildSourceRepairContext({problem:problemInput,snapshot=[],policy:policyInput={}}={}){
  const policy=createSourceRepairPolicy(policyInput),problem=normalizeSourceProblem(problemInput),errors=[];
  if(!problem.id)errors.push('problem_id_missing');
  if(!problem.kind)errors.push('problem_kind_invalid');
  if(!problem.summary)errors.push('problem_summary_missing');
  if(!problem.baselineSha)errors.push('problem_baseline_sha_missing');
  if(policy.requireEvidence&&!problem.evidence.length)errors.push('problem_evidence_missing');

  const rows=(Array.isArray(snapshot)?snapshot:[])
    .map(row=>({path:text(row?.path),beforeHash:text(row?.beforeHash),content:String(row?.content??'')}))
    .filter(row=>pathAllowed(row.path,policy.codePatchPolicy));
  const preferred=new Set(problem.paths),ordered=[...rows].sort((a,b)=>Number(preferred.has(b.path))-Number(preferred.has(a.path))||a.path.localeCompare(b.path));
  const files=[];let remaining=policy.maxContextChars;
  for(const row of ordered){
    if(files.length>=policy.maxContextFiles)break;
    const cost=row.content.length;
    if(!row.beforeHash){
      files.push(freeze({path:row.path,beforeHash:'',content:null,omitted:true,reason:'before_hash_missing'}));
      continue;
    }
    if(cost>remaining){
      files.push(freeze({path:row.path,beforeHash:row.beforeHash,content:null,omitted:true,reason:'context_budget'}));
      continue;
    }
    files.push(freeze({path:row.path,beforeHash:row.beforeHash,content:row.content,omitted:false,reason:null}));
    remaining-=cost;
  }
  const writablePaths=files.filter(row=>!row.omitted&&row.beforeHash).map(row=>row.path);
  if(!writablePaths.length)errors.push('context_has_no_writable_files');
  return freeze({
    valid:errors.length===0,
    errors,
    problem,
    files,
    writablePaths,
    limits:{maxAttempts:policy.maxAttempts,maxContextFiles:policy.maxContextFiles,maxContextChars:policy.maxContextChars,minObjectiveScore:policy.minObjectiveScore},
    instructions:Object.freeze([
      'Return the smallest source change that addresses the evidenced problem.',
      'Only modify writablePaths and preserve each supplied beforeHash exactly.',
      'Declare every required registered test; do not invent shell commands.',
      'Do not touch secrets, server authority, Supabase, deployment or runtime credentials.',
      'A proposal is never applied directly: sandbox tests and an independent objective score decide acceptance.'
    ])
  });
}

function normalizeProposal({raw,context,attempt}){
  const changes=(raw?.changes||[]).map(row=>({
    path:text(row?.path),
    beforeHash:text(row?.beforeHash),
    afterContent:String(row?.afterContent??'')
  }));
  const candidate=createCodePatchCandidate({
    id:text(raw?.id)||`agent-${context.problem.id}-attempt-${attempt}`,
    baseSha:context.problem.baselineSha,
    objective:text(raw?.objective),
    changes,
    tests:(raw?.tests||[]).map(text).filter(Boolean)
  });
  return freeze({
    schema:'kelo-source-agent-proposal-v1',
    attempt,
    rationale:text(raw?.rationale),
    candidate
  });
}

export function validateSourceAgentProposal({raw,context,attempt=1,policy:policyInput={}}={}){
  const policy=createSourceRepairPolicy(policyInput),proposal=normalizeProposal({raw,context,attempt}),errors=[];
  if(!context?.valid)errors.push('context_invalid');
  if(!proposal.rationale)errors.push('proposal_rationale_missing');
  if(!proposal.candidate.objective)errors.push('proposal_objective_missing');
  if(attempt<1||attempt>policy.maxAttempts)errors.push(`proposal_attempt_out_of_range:${attempt}`);

  const writable=new Map((context?.files||[]).filter(row=>!row.omitted).map(row=>[row.path,row]));
  for(const change of proposal.candidate.changes){
    const source=writable.get(change.path);
    if(!source){errors.push(`proposal_path_not_in_context:${change.path}`);continue;}
    if(source.beforeHash!==change.beforeHash)errors.push(`proposal_before_hash_mismatch:${change.path}`);
    if(source.content===change.afterContent)errors.push(`proposal_noop_change:${change.path}`);
  }

  const codeValidation=validateCodePatchCandidate(proposal.candidate,policy.codePatchPolicy);
  errors.push(...codeValidation.errors);
  return freeze({
    valid:errors.length===0,
    errors:[...new Set(errors)],
    proposal:copy(proposal),
    codeValidation
  });
}

export async function runAutonomousSourceRepairCycle({
  problem,
  snapshot,
  agent,
  evaluate,
  policy:policyInput={}
}={}){
  const policy=createSourceRepairPolicy(policyInput),context=buildSourceRepairContext({problem,snapshot,policy}),attempts=[],fingerprints=new Set();
  if(!context.valid)return freeze({accepted:false,stage:'context',context,attempts,final:null});
  if(typeof agent!=='function')throw new Error('SOURCE_REPAIR_AGENT_REQUIRED');
  if(typeof evaluate!=='function')throw new Error('SOURCE_REPAIR_EVALUATOR_REQUIRED');

  let feedback=[];
  for(let attempt=1;attempt<=policy.maxAttempts;attempt++){
    let raw;
    try{
      raw=await agent(freeze({context,attempt,feedback:Object.freeze([...feedback])}));
    }catch(error){
      const row=freeze({attempt,stage:'agent',accepted:false,failures:[`agent_error:${text(error?.message||error)}`]});
      attempts.push(row);feedback=row.failures;continue;
    }

    const validated=validateSourceAgentProposal({raw,context,attempt,policy});
    if(!validated.valid){
      const row=freeze({attempt,stage:'proposal',accepted:false,failures:validated.errors,candidateFingerprint:validated.proposal.candidate.fingerprint});
      attempts.push(row);feedback=row.failures;continue;
    }

    const fingerprint=validated.proposal.candidate.fingerprint;
    if(fingerprints.has(fingerprint)){
      const row=freeze({attempt,stage:'dedupe',accepted:false,failures:['candidate_duplicate'],candidateFingerprint:fingerprint});
      attempts.push(row);feedback=row.failures;continue;
    }
    fingerprints.add(fingerprint);

    let evidence;
    try{
      evidence=await evaluate(freeze({candidate:validated.proposal.candidate,problem:context.problem,attempt}));
    }catch(error){
      const row=freeze({attempt,stage:'evaluate',accepted:false,failures:[`evaluator_error:${text(error?.message||error)}`],candidateFingerprint:fingerprint});
      attempts.push(row);feedback=row.failures;continue;
    }

    const evaluation=evaluateCodePatchSandboxReport({
      candidate:validated.proposal.candidate,
      report:evidence?.report,
      policy:policy.codePatchPolicy,
      objectiveScore:evidence?.objectiveScore,
      requireObjective:true,
      minObjectiveScore:policy.minObjectiveScore
    });
    const row=freeze({
      attempt,
      stage:'evaluated',
      accepted:evaluation.valid,
      failures:evaluation.failures,
      candidateFingerprint:fingerprint,
      score:evaluation.score,
      objectiveScore:Number.isFinite(Number(evidence?.objectiveScore))?Number(evidence.objectiveScore):null,
      evaluation,
      proposal:validated.proposal
    });
    attempts.push(row);
    if(row.accepted)return freeze({accepted:true,stage:'accepted',context,attempts,final:row});
    feedback=row.failures;
  }
  return freeze({accepted:false,stage:'exhausted',context,attempts,final:attempts.at(-1)||null});
}
