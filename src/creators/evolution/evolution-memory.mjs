/* KELO-INDEX
 * area: CREATORS / EVOLUTION / MEMORY
 * owner: KeloEvolution experiment-memory contract
 * purpose: keep deterministic experiment/champion records and reusable mutation/candidate learning signals without owning persistence
 * public-api: createEvolutionMemory, recordEvolutionExperiment, promoteEvolutionChampion, summarizeEvolutionMemory, mutationFailureCount, mutationPerformance, mutationPriority, candidateSeenCount
 * consumes: serializable evolution reports supplied by callers
 * state-owned: none; every operation returns a new immutable snapshot
 * online: persistence remains external and can move from Git artifacts to server storage without changing this contract
 * do-not: no localStorage, Git writes, network, gameplay state or hidden mutation
 */
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const finite=value=>Number.isFinite(Number(value));
const text=value=>String(value??'').trim();
const round=(value,places=4)=>{const factor=10**places;return Math.round(Number(value)*factor)/factor;};

export function createEvolutionMemory({systemId='generic',champion=null,entries=[]}={}){
  if(!Array.isArray(entries))throw new Error('EVOLUTION_MEMORY_ENTRIES_ARRAY_REQUIRED');
  return freeze({schema:'kelo-evolution-memory-v2',systemId:text(systemId)||'generic',champion:champion?copy(champion):null,entries:entries.map(copy)});
}

export function recordEvolutionExperiment(memoryInput,record,{maxEntries=250}={}){
  const memory=createEvolutionMemory(memoryInput||{}),id=text(record?.id);
  if(!id)throw new Error('EVOLUTION_EXPERIMENT_ID_REQUIRED');
  const entry=freeze({
    id,
    at:text(record?.at)||null,
    sourceSha:text(record?.sourceSha)||null,
    candidateId:text(record?.candidateId)||null,
    candidateFingerprint:text(record?.candidateFingerprint)||null,
    accepted:Boolean(record?.accepted),
    rejectedStage:text(record?.rejectedStage)||null,
    baselineScore:finite(record?.baselineScore)?Number(record.baselineScore):null,
    candidateScore:finite(record?.candidateScore)?Number(record.candidateScore):null,
    delta:finite(record?.delta)?Number(record.delta):null,
    holdout:copy(record?.holdout||null),
    mutations:copy(record?.mutations||[]),
    metrics:copy(record?.metrics||{}),
    failures:copy(record?.failures||[]),
    artifacts:copy(record?.artifacts||[])
  });
  const withoutDuplicate=memory.entries.filter(row=>row.id!==id),limit=Math.max(1,Math.min(5000,Math.floor(Number(maxEntries)||250))),entries=[...withoutDuplicate,entry].slice(-limit);
  return createEvolutionMemory({...memory,entries});
}

export function promoteEvolutionChampion(memoryInput,{candidateId,score,fingerprint=null,metadata={}}={}){
  const memory=createEvolutionMemory(memoryInput||{}),id=text(candidateId);
  if(!id||!finite(score))throw new Error('EVOLUTION_CHAMPION_INVALID');
  return createEvolutionMemory({...memory,champion:{candidateId:id,score:Number(score),fingerprint:text(fingerprint)||null,metadata:copy(metadata)}});
}

export function mutationPerformance(memoryInput,mutationId){
  const memory=createEvolutionMemory(memoryInput||{}),id=text(mutationId);
  if(!id)return freeze({mutationId:'',attempts:0,accepted:0,rejected:0,acceptanceRate:0,meanDelta:0,totalDelta:0});
  let attempts=0,accepted=0,totalDelta=0;
  for(const entry of memory.entries){
    const matched=(entry.mutations||[]).some(mutation=>text(mutation?.geneId||mutation?.key)===id);
    if(!matched)continue;
    attempts++;
    if(entry.accepted)accepted++;
    if(finite(entry.delta))totalDelta+=Number(entry.delta);
  }
  return freeze({mutationId:id,attempts,accepted,rejected:attempts-accepted,acceptanceRate:attempts?accepted/attempts:0,meanDelta:attempts?round(totalDelta/attempts,4):0,totalDelta:round(totalDelta,4)});
}

export function mutationFailureCount(memoryInput,mutationId){return mutationPerformance(memoryInput,mutationId).rejected;}

export function mutationPriority(memoryInput,mutationId,{exploration=.7}={}){
  const stats=mutationPerformance(memoryInput,mutationId);
  const smoothedSuccess=(stats.accepted+1)/(stats.attempts+2);
  const deltaSignal=Math.max(-1,Math.min(1,stats.meanDelta/5));
  const explorationBonus=Math.max(0,Number(exploration)||0)/Math.sqrt(stats.attempts+1);
  return round(Math.max(.08,smoothedSuccess*(1+.35*deltaSignal)+explorationBonus),6);
}

export function candidateSeenCount(memoryInput,fingerprint){
  const memory=createEvolutionMemory(memoryInput||{}),key=text(fingerprint);if(!key)return 0;
  return memory.entries.reduce((count,row)=>count+(text(row.candidateFingerprint)===key?1:0),0);
}

export function summarizeEvolutionMemory(memoryInput){
  const memory=createEvolutionMemory(memoryInput||{}),accepted=memory.entries.filter(row=>row.accepted),rejected=memory.entries.length-accepted.length,deltas=accepted.map(row=>row.delta).filter(finite).map(Number),fingerprints=new Map();
  for(const row of memory.entries){const key=text(row.candidateFingerprint);if(key)fingerprints.set(key,(fingerprints.get(key)||0)+1);}
  const repeatedCandidates=[...fingerprints.values()].filter(count=>count>1).reduce((sum,count)=>sum+(count-1),0);
  return freeze({systemId:memory.systemId,experiments:memory.entries.length,accepted:accepted.length,rejected,acceptanceRate:memory.entries.length?accepted.length/memory.entries.length:0,meanAcceptedDelta:deltas.length?deltas.reduce((sum,value)=>sum+value,0)/deltas.length:0,repeatedCandidates,champion:copy(memory.champion)});
}
