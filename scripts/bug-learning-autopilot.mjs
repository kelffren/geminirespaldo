/* KELO-INDEX
 * area: QA / BUGS / EVOLUTION
 * owner: KeloEvolution adapter for Bug Intelligence
 * purpose: learn bounded risk multipliers, hotspots and prevention gaps from canonical bugs, reports and preventive-CI feedback using champion/challenger + chronological holdout
 * public-api: CLI --write | --json
 * consumes: bugs/registry, bugs/incoming, bugs/RISK_MAP.json, bugs/learning/STATE.json, KeloEvolution
 * state-owned: bugs/learning/STATE.json only when --write is supplied
 * online: N/A; repository-side QA automation
 * do-not: never edit source code, close bugs, invent PASS evidence, widen Git authority or bypass KeloEvolution holdout gates
 */

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {runEvolutionCycle,evolutionFingerprint} from '../src/creators/evolution/evolution-engine.mjs';
import {createEvolutionMemory,recordEvolutionExperiment,promoteEvolutionChampion,summarizeEvolutionMemory} from '../src/creators/evolution/evolution-memory.mjs';

const root=process.cwd();
const write=process.argv.includes('--write');
const jsonOut=process.argv.includes('--json');
const riskPath=path.join(root,'bugs','RISK_MAP.json');
const registryDir=path.join(root,'bugs','registry');
const incomingDir=path.join(root,'bugs','incoming');
const statePath=path.join(root,'bugs','learning','STATE.json');
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=(value,places=4)=>{const factor=10**places;return Math.round(Number(value)*factor)/factor;};
const finite=value=>Number.isFinite(Number(value));
const unique=list=>[...new Set((list||[]).filter(Boolean))];
const severityBase={critical:78,high:62,medium:43,low:25};
const resultAdjust={FAIL:16,PARTIAL:9,BLOCKED:6,NOT_RUN:2,PASS:-16};
const feedbackTarget={success:32,failure:78,cancelled:58,timed_out:72,action_required:68,neutral:45,skipped:42,stale:48};

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function listJson(dir,re){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(name=>re.test(name)).map(name=>{try{return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));}catch{return null;}}).filter(Boolean);
}
function historicalFiles(bug){
  const files=new Set([...(bug?.suspected_files||[]),...(bug?.fix?.files||[])]);
  for(const attempt of bug?.attempt_history||[])for(const file of attempt?.change?.files||[])files.add(file);
  return [...files].filter(Boolean);
}
function regressionProtected(bug){
  const refs=[...(bug?.fix?.files||[]),...(bug?.verification?.evidence||[])];
  return refs.some(value=>typeof value==='string'&&(/(^|\/)(tests?|scripts)\//i.test(value)||/\.(spec|test)\.[cm]?[jt]s$/i.test(value)))||Boolean(bug?.regression?.test||bug?.regression?.command);
}
function parseTime(value){const time=Date.parse(value||'');return Number.isFinite(time)?time:0;}
function gitHead(){try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{return null;}}
function matchedRules(files,riskMap){
  const rows=[];
  for(const rule of riskMap.rules||[]){
    const hits=files.filter(file=>(rule.patterns||[]).some(pattern=>String(file).toLowerCase().includes(String(pattern).toLowerCase())));
    if(hits.length)rows.push({rule,hits});
  }
  return rows;
}
function normalizeMultipliers(input,riskMap){
  const out={};
  const allowed=new Set((riskMap.rules||[]).map(rule=>rule.id));
  for(const [id,value] of Object.entries(input||{}))if(allowed.has(id)&&finite(value))out[id]=round(clamp(Number(value),.75,1.75),4);
  return out;
}
function compactBugForFingerprint(bug){
  return {
    id:bug.id,status:bug.status,severity:bug.severity,area:bug.area,suspected_files:bug.suspected_files,
    fix:{status:bug.fix?.status,commits:bug.fix?.commits,files:bug.fix?.files},
    verification:{status:bug.verification?.status,verified_at:bug.verification?.verified_at,evidence:bug.verification?.evidence},
    regression:bug.regression||null,
    attempts:(bug.attempt_history||[]).map(attempt=>({id:attempt.id,at:attempt.at,result:attempt.validation?.result,files:attempt.change?.files,commits:attempt.change?.commits})),
    updated_at:bug.updated_at
  };
}
function compactReportForFingerprint(report){return {id:report.id,created_at:report.created_at,category:report.category,fingerprint:report.diagnostics?.fingerprint||null,triage:report.triage||null};}
function compactObservationForFingerprint(observation){return {id:observation.id,at:observation.at,head_sha:observation.head_sha,conclusion:observation.conclusion,files:observation.files};}
function isFailureSignal(result){return ['FAIL','PARTIAL','CI_FAILURE','CI_TIMED_OUT','CI_ACTION_REQUIRED'].includes(String(result||'').toUpperCase());}

const riskMap=readJson(riskPath,{version:0,rules:[]});
const bugs=listJson(registryDir,/^BUG-\d{4}\.json$/);
const reports=listJson(incomingDir,/^REPORT-.*\.json$/);
const previous=readJson(statePath,null);
const observations=Array.isArray(previous?.observations)?previous.observations.slice(-200):[];
const sourceFingerprint=evolutionFingerprint({
  riskMap,
  bugs:bugs.map(compactBugForFingerprint),
  reports:reports.map(compactReportForFingerprint),
  observations:observations.map(compactObservationForFingerprint)
});
const riskMapFingerprint=evolutionFingerprint(riskMap);

if(previous?.source_fingerprint===sourceFingerprint){
  const summary={ok:true,changed:false,reason:'NO_NEW_BUG_EVIDENCE',sourceFingerprint,champion:previous.champion||null,hotspots:(previous.hotspots||[]).length,preventionGaps:(previous.prevention_gaps||[]).length,observations:observations.length};
  console.log(jsonOut?JSON.stringify(summary,null,2):`BUG LEARNING — no new evidence (${sourceFingerprint})`);
  process.exit(0);
}

const reportsByBug=new Map();
for(const report of reports){
  const bugId=report?.triage?.bug_id;if(!bugId)continue;
  const list=reportsByBug.get(bugId)||[];list.push(report);reportsByBug.set(bugId,list);
}

const examples=[];
for(const bug of bugs){
  const files=historicalFiles(bug);if(!files.length)continue;
  const base=severityBase[String(bug.severity||'low').toLowerCase()]||25;
  const linked=reportsByBug.get(bug.id)||[];
  const recurrenceBonus=Math.min(12,linked.length*3)+(bug.status==='REOPENED'?10:0);
  examples.push({id:`${bug.id}:summary`,bugId:bug.id,kind:'bug',at:bug.discovered_at||bug.updated_at||null,files,target:clamp(base+recurrenceBonus,8,100),result:null});
  for(const attempt of bug.attempt_history||[]){
    const attemptFiles=(attempt?.change?.files||[]).filter(Boolean);
    const result=String(attempt?.validation?.result||'NOT_RUN').toUpperCase();
    examples.push({id:`${bug.id}:${attempt.id||examples.length}`,bugId:bug.id,kind:'attempt',at:attempt.at||bug.updated_at||null,files:attemptFiles.length?attemptFiles:files,target:clamp(base+(resultAdjust[result]??2)+recurrenceBonus,8,100),result});
  }
  for(const report of linked){
    if(!report?.created_at)continue;
    const confidence=finite(report?.triage?.confidence)?Number(report.triage.confidence):.7;
    examples.push({id:`${bug.id}:${report.id}`,bugId:bug.id,kind:'report',at:report.created_at,files,target:clamp(base+8+Math.round(confidence*8)+(bug.status==='REOPENED'?8:0),8,100),result:'REPORT'});
  }
}
for(const observation of observations){
  const files=Array.isArray(observation?.files)?observation.files.filter(Boolean).slice(0,120):[];
  const conclusion=String(observation?.conclusion||'neutral').toLowerCase();
  if(!files.length||!feedbackTarget[conclusion])continue;
  examples.push({
    id:observation.id||`prevention:${observation.head_sha||examples.length}`,
    bugId:null,
    kind:'prevention_feedback',
    at:observation.at||null,
    files,
    target:feedbackTarget[conclusion],
    result:`CI_${conclusion.toUpperCase()}`
  });
}

examples.sort((a,b)=>parseTime(a.at)-parseTime(b.at)||a.id.localeCompare(b.id));
const latestTime=Math.max(0,...examples.map(row=>parseTime(row.at)));
for(const row of examples){
  const ageDays=latestTime&&parseTime(row.at)?Math.max(0,(latestTime-parseTime(row.at))/86400000):0;
  row.weight=round(.6+.4*Math.exp(-ageDays/120),4);
}
const holdoutCount=examples.length>=8?Math.max(2,Math.ceil(examples.length*.25)):0;
const searchExamples=holdoutCount?examples.slice(0,-holdoutCount):examples;
const holdoutExamples=holdoutCount?examples.slice(-holdoutCount):[];

function predict(policy,example){
  let score=Math.min(18,example.files.length*2);
  for(const {rule} of matchedRules(example.files,riskMap)){
    const multiplier=finite(policy?.multipliers?.[rule.id])?Number(policy.multipliers[rule.id]):1;
    score+=Number(rule.score||0)*clamp(multiplier,.75,1.75);
  }
  return clamp(score,0,100);
}
function evaluatePolicy(policy,dataset){
  if(!dataset.length)return {valid:true,score:0,metrics:{calibration:0,severeRecall:0,mediumRecall:0,falseAlarmSafety:100,simplicity:100,examples:0}};
  let totalWeight=0,absError=0,severeWeight=0,severeHit=0,mediumWeight=0,mediumHit=0,lowWeight=0,lowSafe=0;
  for(const row of dataset){
    const weight=Number(row.weight||1),predicted=predict(policy,row);totalWeight+=weight;absError+=Math.abs(predicted-row.target)*weight;
    if(row.target>=65){severeWeight+=weight;if(predicted>=50)severeHit+=weight;}
    if(row.target>=45){mediumWeight+=weight;if(predicted>=35)mediumHit+=weight;}
    if(row.target<45){lowWeight+=weight;if(predicted<50)lowSafe+=weight;}
  }
  const calibration=clamp(100-(absError/Math.max(.0001,totalWeight)),0,100);
  const severeRecall=severeWeight?severeHit/severeWeight*100:100;
  const mediumRecall=mediumWeight?mediumHit/mediumWeight*100:100;
  const falseAlarmSafety=lowWeight?lowSafe/lowWeight*100:100;
  const values=Object.values(policy?.multipliers||{}).map(Number).filter(Number.isFinite);
  const simplicity=clamp(100-(values.reduce((sum,value)=>sum+Math.abs(value-1),0)/Math.max(1,values.length))*55,0,100);
  const score=round(calibration*.34+severeRecall*.36+mediumRecall*.15+falseAlarmSafety*.05+simplicity*.10,3);
  return {valid:true,score,metrics:{calibration:round(calibration,3),severeRecall:round(severeRecall,3),mediumRecall:round(mediumRecall,3),falseAlarmSafety:round(falseAlarmSafety,3),simplicity:round(simplicity,3),examples:dataset.length}};
}
function derivePolicy(id,{blend=.5,recurrenceBoost=0,failBoost=0,conservative=false}={}){
  const multipliers={};
  for(const rule of riskMap.rules||[]){
    const matched=searchExamples.filter(example=>matchedRules(example.files,{rules:[rule]}).length);
    if(!matched.length){multipliers[rule.id]=1;continue;}
    let weight=0,target=0,reportsWeight=0,failWeight=0;
    for(const row of matched){
      const rowWeight=Number(row.weight||1);weight+=rowWeight;target+=row.target*rowWeight;
      if(row.kind==='report')reportsWeight+=rowWeight;
      if(isFailureSignal(row.result))failWeight+=rowWeight;
    }
    const avgTarget=target/Math.max(.0001,weight),reportRatio=reportsWeight/Math.max(.0001,weight),failRatio=failWeight/Math.max(.0001,weight);
    const evidenceIdeal=clamp(.78+(avgTarget/100)*.62+reportRatio*recurrenceBoost+failRatio*failBoost,.75,1.75);
    let value=1+(evidenceIdeal-1)*blend;if(conservative)value=Math.max(1,value);
    multipliers[rule.id]=round(clamp(value,.75,1.75),4);
  }
  return {id,multipliers};
}

const baseline={id:previous?.champion?.id||'baseline-v1',multipliers:normalizeMultipliers(previous?.champion?.multipliers||{},riskMap)};
const challengers=[
  derivePolicy('evidence-balanced',{blend:.42}),
  derivePolicy('evidence-deep',{blend:.72}),
  derivePolicy('recurrence-sensitive',{blend:.58,recurrenceBoost:.28,failBoost:.08,conservative:true}),
  derivePolicy('failure-sensitive',{blend:.58,recurrenceBoost:.08,failBoost:.24,conservative:true})
];
const cycle=await runEvolutionCycle({
  baseline,
  propose:()=>challengers,
  evaluate:policy=>evaluatePolicy(policy,searchExamples),
  holdoutEvaluate:holdoutExamples.length?policy=>evaluatePolicy(policy,holdoutExamples):null,
  fingerprintCandidate:policy=>evolutionFingerprint(policy),
  policy:{minImprovement:.2},
  holdoutPolicy:{minImprovement:0}
});
const accepted=Boolean(cycle.accepted&&holdoutExamples.length>=2);
const champion=accepted?cycle.result:baseline;
const baselineSearch=evaluatePolicy(baseline,searchExamples),championSearch=evaluatePolicy(champion,searchExamples);
const baselineHoldout=holdoutExamples.length?evaluatePolicy(baseline,holdoutExamples):null;
const championHoldout=holdoutExamples.length?evaluatePolicy(champion,holdoutExamples):null;

const statsByFile=new Map();
for(const example of examples){
  for(const file of example.files){
    const stat=statsByFile.get(file)||{file,evidence:0,weightedTarget:0,weight:0,severe:0,failures:0,reports:0,feedback:0,bugIds:new Set()};
    const weight=Number(example.weight||1);stat.evidence++;stat.weight+=weight;stat.weightedTarget+=example.target*weight;
    if(example.target>=65)stat.severe++;
    if(isFailureSignal(example.result))stat.failures++;
    if(example.kind==='report')stat.reports++;
    if(example.kind==='prevention_feedback')stat.feedback++;
    if(/^BUG-\d{4}$/.test(String(example.bugId||'')))stat.bugIds.add(example.bugId);
    statsByFile.set(file,stat);
  }
}
const hotspots=[...statsByFile.values()].map(stat=>{
  const avgTarget=stat.weightedTarget/Math.max(.0001,stat.weight);
  const bonus=clamp(Math.round(Math.max(0,avgTarget-38)/4+Math.log2(stat.evidence+1)*2+stat.reports+Math.min(3,stat.feedback)),0,20);
  const confidence=stat.evidence>=6||stat.severe>=4?'high':stat.evidence>=3||stat.severe>=2?'medium':'low';
  const rules=matchedRules([stat.file],riskMap).map(item=>item.rule);
  const tests=unique([...rules.flatMap(rule=>rule.tests||[]),...[...stat.bugIds].map(id=>`npm run bug:brief -- ${id}`)]);
  return {file:stat.file,risk_bonus:bonus,confidence,evidence_count:stat.evidence,average_target:round(avgTarget,2),severe_events:stat.severe,failed_events:stat.failures,report_events:stat.reports,feedback_events:stat.feedback,bug_ids:[...stat.bugIds].sort(),matched_rules:rules.map(rule=>rule.id),recommended_tests:tests};
}).filter(row=>row.risk_bonus>0).sort((a,b)=>b.risk_bonus-a.risk_bonus||b.evidence_count-a.evidence_count||a.file.localeCompare(b.file)).slice(0,60);

const preventionGaps=[];
for(const hotspot of hotspots)if(['high','medium'].includes(hotspot.confidence)&&hotspot.matched_rules.length===0)preventionGaps.push({type:'uncovered_hotspot',priority:hotspot.confidence==='high'?'high':'medium',file:hotspot.file,reason:`${hotspot.evidence_count} historical/feedback signals but no RISK_MAP rule matches this file.`});
for(const bug of bugs)if(['critical','high'].includes(String(bug.severity).toLowerCase())&&!regressionProtected(bug))preventionGaps.push({type:'missing_regression_defense',priority:'high',bug_id:bug.id,reason:'High-impact bug has no durable regression test/contract detected.'});
const fingerprintClusters=new Map();
for(const report of reports){
  const fingerprint=report?.diagnostics?.fingerprint;if(!fingerprint)continue;
  const row=fingerprintClusters.get(fingerprint)||{count:0,bugIds:new Set()};row.count++;if(report?.triage?.bug_id)row.bugIds.add(report.triage.bug_id);fingerprintClusters.set(fingerprint,row);
}
for(const [fingerprint,row] of fingerprintClusters)if(row.count>=2)preventionGaps.push({type:'recurring_fingerprint',priority:row.count>=3?'high':'medium',fingerprint,count:row.count,bug_ids:[...row.bugIds].sort(),reason:'Same failure shape has appeared repeatedly and deserves a durable regression defense.'});
for(const hotspot of hotspots)if(hotspot.feedback_events>=2&&hotspot.failed_events>=2)preventionGaps.push({type:'repeated_prevention_failure',priority:'high',file:hotspot.file,count:hotspot.feedback_events,reason:'Preventive CI has repeatedly produced failure signals on changes touching this file.'});

let memory=createEvolutionMemory(previous?.memory||{systemId:'bug-intelligence-risk-policy'});
const mutations=[];
for(const rule of riskMap.rules||[]){
  const before=baseline.multipliers[rule.id]??1,after=champion.multipliers[rule.id]??1;
  if(Math.abs(after-before)>.0001)mutations.push({geneId:`risk:${rule.id}`,before,after});
}
const evidenceAt=latestTime?new Date(latestTime).toISOString():null;
const cycleFailures=accepted?[]:[...(holdoutExamples.length<2?['insufficient_holdout_evidence']:[]),...(cycle.selected?.comparison?.failures||[])];
memory=recordEvolutionExperiment(memory,{
  id:`bug-learn-${sourceFingerprint}`,
  at:evidenceAt,
  sourceSha:gitHead(),
  candidateId:champion.id,
  candidateFingerprint:evolutionFingerprint(champion),
  accepted,
  rejectedStage:accepted?null:(holdoutExamples.length<2?'insufficient_holdout':cycle.rejectedStage||'search'),
  baselineScore:baselineSearch.score,
  candidateScore:championSearch.score,
  delta:round(championSearch.score-baselineSearch.score,4),
  holdout:championHoldout?{baseline:baselineHoldout?.score??null,candidate:championHoldout.score,delta:round(championHoldout.score-(baselineHoldout?.score??0),4)}:null,
  mutations,
  metrics:championSearch.metrics,
  failures:cycleFailures,
  artifacts:['bugs/learning/STATE.json']
});
if(accepted)memory=promoteEvolutionChampion(memory,{candidateId:champion.id,score:championSearch.score,fingerprint:evolutionFingerprint(champion),metadata:{sourceFingerprint,riskMapFingerprint,holdoutScore:championHoldout?.score??null}});

const state={
  schema:'kelo-bug-learning-v1',
  system_id:'bug-intelligence',
  source_fingerprint:sourceFingerprint,
  risk_map_fingerprint:riskMapFingerprint,
  source_head:gitHead(),
  champion:{id:champion.id,multipliers:normalizeMultipliers(champion.multipliers,riskMap),search_score:championSearch.score,holdout_score:championHoldout?.score??null,accepted_from_last_cycle:accepted},
  memory,
  memory_summary:summarizeEvolutionMemory(memory),
  observations,
  feedback_updated_at:previous?.feedback_updated_at||null,
  training:{examples:examples.length,search_examples:searchExamples.length,holdout_examples:holdoutExamples.length,feedback_examples:examples.filter(row=>row.kind==='prevention_feedback').length,latest_evidence_at:evidenceAt},
  metrics:{baseline_search:baselineSearch,champion_search:championSearch,baseline_holdout:baselineHoldout,champion_holdout:championHoldout,last_cycle:{accepted,rejected_stage:accepted?null:(holdoutExamples.length<2?'insufficient_holdout':cycle.rejectedStage||null),selected_id:cycle.selected?.candidate?.id||null}},
  hotspots,
  prevention_gaps:preventionGaps.slice(0,80),
  safety:{auto_write_scope:['bugs/learning/STATE.json'],arbitrary_source_code_writes:false,bug_state_mutation:false,auto_close:false,requires_holdout_for_policy_promotion:true,max_rule_multiplier:1.75,min_rule_multiplier:.75,max_hotspot_bonus:20,max_feedback_observations:200},
  updated_at:new Date().toISOString()
};

if(write){fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');}
const summary={ok:true,changed:true,written:write,sourceFingerprint,examples:examples.length,feedbackExamples:state.training.feedback_examples,search:searchExamples.length,holdout:holdoutExamples.length,accepted,champion:state.champion,hotspots:hotspots.length,preventionGaps:state.prevention_gaps.length,memory:state.memory_summary};
console.log(jsonOut?JSON.stringify({summary,state},null,2):[`BUG LEARNING — ${accepted?'PROMOTED':'OBSERVED'}`,`evidence=${examples.length} feedback=${state.training.feedback_examples} search=${searchExamples.length} holdout=${holdoutExamples.length}`,`champion=${champion.id} score=${championSearch.score}${championHoldout?` holdout=${championHoldout.score}`:''}`,`hotspots=${hotspots.length} prevention_gaps=${state.prevention_gaps.length}`,write?`written=${path.relative(root,statePath)}`:'dry-run (use --write to persist)'].join('\n'));
