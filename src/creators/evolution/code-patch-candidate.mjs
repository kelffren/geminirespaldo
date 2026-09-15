/* KELO-INDEX
 * area: CREATORS / EVOLUTION / CODE PATCH
 * owner: KeloEvolution code-patch candidate contract
 * purpose: represent source-code changes as bounded, reviewable, test-covered candidates before sandbox evaluation
 * public-api: createCodePatchPolicy, createCodePatchCandidate, codePatchFingerprint, requiredTestsForChanges, estimateCodePatchRisk, validateCodePatchCandidate
 * consumes: serializable full-text replacements proposed by an authorized external agent
 * state-owned: none
 * online: authority-neutral; Git/CI/server remain external apply authorities
 * do-not: no filesystem, Git, network, arbitrary commands, secret paths or direct deployment
 */
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const text=value=>String(value??'').trim();
const bytes=value=>new TextEncoder().encode(String(value??'')).length;
const DEFAULT_PREFIXES=Object.freeze(['src/world/map-forge/','src/creators/evolution/','scripts/','tests/','docs/systems/','docs/evolution/']);
const DEFAULT_DENY=Object.freeze(['.env','node_modules/','.git/','supabase/','server/','secrets','credential','private-key','service-role']);
const DEFAULT_REQUIRED_TESTS=Object.freeze([
  Object.freeze({prefix:'src/creators/evolution/',tests:Object.freeze(['evolution'])}),
  Object.freeze({prefix:'src/world/map-forge/',tests:Object.freeze(['evolution','map-forge-core'])}),
  Object.freeze({prefix:'scripts/kelo-',tests:Object.freeze(['evolution'])}),
  Object.freeze({prefix:'scripts/map-forge-',tests:Object.freeze(['evolution','map-forge-core'])}),
  Object.freeze({prefix:'tests/map-forge-',tests:Object.freeze(['evolution','map-forge-handoff'])}),
  Object.freeze({prefix:'docs/systems/',tests:Object.freeze(['docs'])}),
  Object.freeze({prefix:'docs/evolution/',tests:Object.freeze(['docs'])})
]);
function safePath(path){const value=text(path).replaceAll('\\','/');return value&&!value.startsWith('/')&&!value.includes('../')&&!value.includes('/..')&&!value.includes('\0');}
function stableStringify(value){
  if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function fnv(value){const source=String(value??'');let hash=2166136261;for(let index=0;index<source.length;index++){hash^=source.charCodeAt(index);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');}

function normalizeRequiredTests(rows){
  return (rows||[]).map(row=>freeze({prefix:text(row?.prefix),tests:[...new Set((row?.tests||[]).map(text).filter(Boolean))]})).filter(row=>row.prefix&&row.tests.length);
}

export function createCodePatchPolicy({allowedPrefixes=DEFAULT_PREFIXES,denyFragments=DEFAULT_DENY,requiredTestsByPrefix=DEFAULT_REQUIRED_TESTS,maxFiles=8,maxBytes=120000,maxRiskScore=70,requireBeforeHash=true,requireObjective=true}={}){
  const prefixes=[...new Set((allowedPrefixes||[]).map(text).filter(Boolean))],deny=[...new Set((denyFragments||[]).map(value=>text(value).toLowerCase()).filter(Boolean))];
  if(!prefixes.length)throw new Error('CODE_PATCH_ALLOWLIST_REQUIRED');
  return freeze({
    allowedPrefixes:prefixes,
    denyFragments:deny,
    requiredTestsByPrefix:normalizeRequiredTests(requiredTestsByPrefix),
    maxFiles:Math.max(1,Math.min(50,Math.floor(Number(maxFiles)||8))),
    maxBytes:Math.max(1024,Math.min(2_000_000,Math.floor(Number(maxBytes)||120000))),
    maxRiskScore:Math.max(1,Math.min(100,Number(maxRiskScore)||70)),
    requireBeforeHash:requireBeforeHash!==false,
    requireObjective:requireObjective!==false
  });
}

export function codePatchFingerprint(candidateInput){
  const candidate={
    baseSha:text(candidateInput?.baseSha),
    objective:text(candidateInput?.objective),
    changes:(candidateInput?.changes||[]).map(row=>({path:text(row?.path),beforeHash:text(row?.beforeHash),afterContent:String(row?.afterContent??'')})).sort((a,b)=>a.path.localeCompare(b.path)),
    tests:[...new Set((candidateInput?.tests||[]).map(text).filter(Boolean))].sort()
  };
  return `patch-${fnv(stableStringify(candidate))}`;
}

export function createCodePatchCandidate({id,baseSha,objective='',changes=[],tests=[]}={}){
  const candidate={schema:'kelo-code-patch-v2',id:text(id),baseSha:text(baseSha),objective:text(objective),changes:(changes||[]).map(row=>({path:text(row?.path),beforeHash:text(row?.beforeHash),afterContent:String(row?.afterContent??'')})),tests:[...new Set((tests||[]).map(text).filter(Boolean))]};
  candidate.fingerprint=codePatchFingerprint(candidate);
  return freeze(candidate);
}

export function requiredTestsForChanges(changes=[],policyInput={}){
  const policy=createCodePatchPolicy(policyInput),required=new Set();
  for(const change of changes||[])for(const rule of policy.requiredTestsByPrefix)if(text(change?.path).startsWith(rule.prefix))for(const id of rule.tests)required.add(id);
  return freeze([...required].sort());
}

export function estimateCodePatchRisk(candidateInput,policyInput={}){
  const candidate=createCodePatchCandidate(candidateInput||{}),policy=createCodePatchPolicy(policyInput),fileCount=candidate.changes.length,totalBytes=candidate.changes.reduce((sum,row)=>sum+bytes(row.afterContent),0);
  const fileLoad=Math.min(25,fileCount/policy.maxFiles*25),byteLoad=Math.min(30,totalBytes/policy.maxBytes*30);
  let surface=0;
  for(const change of candidate.changes){
    if(change.path.startsWith('src/'))surface+=7;
    else if(change.path.startsWith('scripts/'))surface+=5;
    else if(change.path.startsWith('tests/'))surface+=2;
    else if(change.path.startsWith('docs/'))surface+=1;
  }
  surface=Math.min(30,surface);
  const objectivePenalty=candidate.objective?0:10,testPenalty=candidate.tests.length?0:10;
  const score=Math.min(100,Math.round((fileLoad+byteLoad+surface+objectivePenalty+testPenalty)*100)/100);
  const riskClass=score>=70?'high':score>=40?'medium':'low';
  return freeze({score,riskClass,fileCount,totalBytes,components:{fileLoad:Math.round(fileLoad*100)/100,byteLoad:Math.round(byteLoad*100)/100,surface,objectivePenalty,testPenalty}});
}

export function validateCodePatchCandidate(candidateInput,policyInput={}){
  const candidate=createCodePatchCandidate(candidateInput||{}),policy=createCodePatchPolicy(policyInput),errors=[],paths=new Set();let totalBytes=0;
  if(!candidate.id)errors.push('candidate_id_missing');
  if(!candidate.baseSha)errors.push('base_sha_missing');
  if(policy.requireObjective&&!candidate.objective)errors.push('objective_missing');
  if(!candidate.changes.length)errors.push('changes_missing');
  if(candidate.changes.length>policy.maxFiles)errors.push(`too_many_files:${candidate.changes.length}>${policy.maxFiles}`);
  for(const change of candidate.changes){
    const lower=change.path.toLowerCase();
    if(!safePath(change.path))errors.push(`path_unsafe:${change.path}`);
    if(paths.has(change.path))errors.push(`path_duplicate:${change.path}`);paths.add(change.path);
    if(!policy.allowedPrefixes.some(prefix=>change.path.startsWith(prefix)))errors.push(`path_not_allowlisted:${change.path}`);
    if(policy.denyFragments.some(fragment=>lower.includes(fragment)))errors.push(`path_denied:${change.path}`);
    if(policy.requireBeforeHash&&!change.beforeHash)errors.push(`before_hash_missing:${change.path}`);
    totalBytes+=bytes(change.afterContent);
  }
  if(totalBytes>policy.maxBytes)errors.push(`patch_too_large:${totalBytes}>${policy.maxBytes}`);
  const requiredTests=requiredTestsForChanges(candidate.changes,policy),declared=new Set(candidate.tests);
  for(const testId of requiredTests)if(!declared.has(testId))errors.push(`required_test_missing:${testId}`);
  const risk=estimateCodePatchRisk(candidate,policy);
  if(risk.score>policy.maxRiskScore)errors.push(`candidate_risk_too_high:${risk.score}>${policy.maxRiskScore}`);
  return freeze({valid:errors.length===0,errors:[...new Set(errors)],candidate:copy(candidate),policy,totalBytes,fileCount:candidate.changes.length,requiredTests,risk});
}
